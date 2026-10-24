#!/usr/bin/env node
/**
 * validate-discovery.js — Enforce 2-domain sourcing AND visual coverage
 * BEFORE a topic is reserved. Runs after rank-topics-imagery.js, before
 * reserve-topics.js.
 *
 * Usage: node scripts/validate-discovery.js <topics.json> <channel-id>
 *
 * For each candidate topic (in ranked order):
 *   1. Quick web search for the topic; collect unique source domains.
 *   2. If unique domains < 2 → reject, log, try next candidate.
 *   3. Check visual coverage: resolve entities from subjects; count how many
 *      have a real asset (logo, portrait, map, cutout). If coverage < 80% →
 *      reject, log, try next candidate.
 *   4. First passing topic becomes the chosen one; rewrite topics.json with
 *      only that topic (others moved to "rejected" array for audit).
 *
 * Exit 0 if a topic passes; 1 if all candidates exhausted.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";

const __dirname = new URL(".", import.meta.url).pathname;
const ROOT = join(__dirname, "..");
const require = createRequire(import.meta.url);
const { scoreTopic, subjectIllustrated } = require("./lib/imagery-score.mjs");
import { collectSourceDomains } from "./lib/source-domains.mjs";

const UA = "youtube-automation/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE)";
const getJson = async (url) => {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
};

const WEBSEARCH_URL = "https://api.duckduckgo.com/";

const FIGURE_PATTERNS = [
  /\$\s*\d[\d,.]*/,           // currency
  /\d[\d,.]*\s*%\b/,          // percentages
  /\b\d[\d,.]*\s*(?:km|m|cm|mm|mi|ft|in|kg|g|lb|oz|l|ml|gal|tbsp|tsp)\b/i,  // measurements
  /\b\d[\d,.]*\s*(?:years?|months?|weeks?|days?|hours?|minutes?|seconds?)\b/i, // time
  /\b\d[\d,.]*\s*(?:million|billion|trillion|thousand|k|M|B)\b/i, // large numbers
  /\b\d[\d,.]*\s*(?:times|x|fold|percent)\b/i, // multipliers
  /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/, // formatted numbers (1,000)
  /\b\d{4,}\b/, // raw large numbers
];

const MEASURABLE_KEYWORDS = [
  // Explicit quantitative/measurable terms only — no generic "%" or "release"
  "survey", "poll", "census",
  "statistics", "statistic",
  "million", "millions", "billion", "billions", "trillion", "trillions",
  "thousand", "thousands",
  "increase", "increases", "increased", "decrease", "decreases", "decreased",
  "growth", "growth rate", "decline", "declined",
  "survey", "surveyed", "poll", "polled",
  "ratio", "rate", "rate of",
  "score", "index", "benchmark",
  "metric", "metrics", "measurement", "measurements",
  "quarter", "quarters", "fiscal",
  "revenue", "profit", "loss", "earnings",
  "participants", "respondents", "sample size",
  "significant", "significance", "p-value", "confidence interval",
];

function hasMeasurableKeywords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return MEASURABLE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

async function checkMeasurableKeywords(topic) {
  // Require the topic TITLE itself to contain a measurable keyword (strong signal).
  // Topics like "API release", "product launch", "model release" lack measurable keywords.
  const titleLower = topic.topic.toLowerCase();
  for (const kw of MEASURABLE_KEYWORDS) {
    if (titleLower.includes(kw.toLowerCase())) return { pass: true };
  }
  // If title lacks measurable keyword, require angle to have ≥2 measurable keywords
  let count = 0;
  const angleLower = (topic.angle || "").toLowerCase();
  for (const kw of MEASURABLE_KEYWORDS) {
    if (angleLower.includes(kw.toLowerCase())) count++;
  }
  return count >= 2 ? { pass: true } : { pass: false, reason: "topic title lacks measurable keyword; angle needs ≥2 (percent, survey, million, revenue, etc.)" };
}

function countFigures(text) {
  if (!text) return 0;
  let count = 0;
  for (const pattern of FIGURE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

async function searchAndCountFigures(query, get = getJson) {
  const url = `${WEBSEARCH_URL}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const data = await get(url);
  if (!data) return { answered: false, figures: 0 };
  const text = [data.Abstract, data.AbstractText, data.RelatedTopics?.map(t => t.Text || t).join(" ")].join(" ");
  return { answered: true, figures: countFigures(text) };
}

// status: "ok" (>=8 figures), "insufficient" (lookups answered, too few figures) or "lookup_failed" (no lookup
// answered, so a count of 0 says nothing about the topic). The >=8 threshold is unchanged. Known limit: the
// DuckDuckGo instant-answer API often answers a long video-style query with an empty body, so "insufficient"
// can still be a thin-API result rather than a thin topic; the real figure check is research (SCR-05).
export async function checkFigureDensity(topic, get = getJson) {
  const query = `${topic.topic} ${topic.angle || ""}`.trim();
  const searchQueries = [
    query,
    `${query} statistics`,
    `${query} data`,
    `${query} numbers`,
    `${query} report`,
    `${query} study`,
    `${query} survey`,
    `${query} results`,
  ];

  let totalFigures = 0, lookups = 0, answered = 0;
  for (const q of searchQueries) {
    const r = await searchAndCountFigures(q, get);
    lookups++;
    if (r.answered) answered++;
    totalFigures += r.figures;
    if (totalFigures >= 8) break; // need at least 8 distinct figures for a shorts script (6-8 beats)
  }

  const status = totalFigures >= 8 ? "ok" : answered === 0 ? "lookup_failed" : "insufficient";
  return { pass: status === "ok", status, figures: totalFigures, lookups, answered };
}

// Pre-research triage only; SCR-02 in gate-research.js is the real two-domain gate (see lib/source-domains.mjs).
export async function checkTwoDomains(topic, get = getJson) {
  return collectSourceDomains(topic, get, { need: 2 });
}

async function checkVisualCoverage(topic) {
  const subjects = Array.isArray(topic.subjects) ? topic.subjects : [];
  if (subjects.length === 0) return { pass: true, coverage: 1, detail: [] }; // no subjects listed = unknown, don't block

  const deps = {
    getJson: async (url) => { try { const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) }); return r.ok ? await r.json() : null; } catch { return null; } },
    summaryOf: async (name) => {
      try {
        const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}?redirect=true`, { signal: AbortSignal.timeout(10000) });
        return r.ok ? await r.json() : null;
      } catch { return null; }
    },
  };

  const detail = [];
  for (const name of subjects.slice(0, 6)) {
    detail.push({ name, ...(await subjectIllustrated(name, deps)) });
  }
  const illustrated = detail.filter((d) => d.ok).length;
  const fraction = subjects.length ? illustrated / subjects.length : 1;
  return { pass: fraction >= 0.8, coverage: fraction, detail };
}

async function main() {
  const [topicsPath, channelId] = process.argv.slice(2);
  if (!topicsPath || !channelId) {
    console.error("Usage: node scripts/validate-discovery.js <topics.json> <channel-id>");
    process.exit(1);
  }

  const doc = JSON.parse(readFileSync(topicsPath, "utf8"));
  const topics = doc.topics || [];
  if (topics.length === 0) {
    console.error("validate-discovery: no topics to validate");
    process.exit(1);
  }

  const rejected = [];
  let chosen = null;

  for (const topic of topics) {
    console.log(`[validate-discovery] ch-${channelId}: checking "${topic.topic}"...`);

    const keywordCheck = await checkMeasurableKeywords(topic);
    if (!keywordCheck.pass) {
      console.log(`[validate-discovery] ch-${channelId}: REJECTED "${topic.topic}" — ${keywordCheck.reason}`);
      rejected.push({ ...topic, reject_reason: keywordCheck.reason });
      continue;
    }

    const domainCheck = await checkTwoDomains(topic);
    if (!domainCheck.pass) {
      const why = domainCheck.status === "lookup_failed"
        ? `source lookup failed (${domainCheck.answered}/${domainCheck.lookups} lookups answered), so independent sources could not be established`
        : `only ${domainCheck.domains.length} independent domain(s): ${domainCheck.domains.join(", ")}`;
      console.log(`[validate-discovery] ch-${channelId}: REJECTED "${topic.topic}" — ${why}, need 2`);
      rejected.push({ ...topic, reject_reason: why });
      continue;
    }

    const figureCheck = await checkFigureDensity(topic);
    if (!figureCheck.pass) {
      const why = figureCheck.status === "lookup_failed"
        ? `figure lookup failed (${figureCheck.answered}/${figureCheck.lookups} lookups answered), so measurable figures could not be established`
        : `only ${figureCheck.figures} measurable figures in search results (need >=8)`;
      console.log(`[validate-discovery] ch-${channelId}: REJECTED "${topic.topic}" — ${why}`);
      rejected.push({ ...topic, reject_reason: why });
      continue;
    }

    const visualCheck = await checkVisualCoverage(topic);
    if (!visualCheck.pass) {
      const pct = Math.round(visualCheck.coverage * 100);
      console.log(`[validate-discovery] ch-${channelId}: REJECTED "${topic.topic}" — ${pct}% visual coverage (need 80%)`);
      rejected.push({ ...topic, reject_reason: `${pct}% visual coverage (need 80%)` });
      continue;
    }

    console.log(`[validate-discovery] ch-${channelId}: ACCEPTED "${topic.topic}" — ${domainCheck.domains.length} domains, ${figureCheck.figures} figures, ${Math.round(visualCheck.coverage * 100)}% visual coverage`);
    chosen = topic;
    break;
  }

  if (!chosen) {
    console.error(`validate-discovery: ch-${channelId} — ALL ${topics.length} CANDIDATES REJECTED`);
    process.exit(1);
  }

  doc.topics = [chosen];
  doc.rejected = rejected;
  writeFileSync(topicsPath, JSON.stringify(doc, null, 2) + "\n");
  console.log(`[validate-discovery] ch-${channelId}: chosen "${chosen.topic}"`);
  process.exit(0);
}

if (process.argv[1] && /validate-discovery\.js$/.test(process.argv[1].replace(/\\/g, "/"))) {
  main().catch((e) => { console.error(e); process.exit(1); });
}