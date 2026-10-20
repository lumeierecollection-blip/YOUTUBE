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

function countFigures(text) {
  if (!text) return 0;
  let count = 0;
  for (const pattern of FIGURE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

async function searchAndCountFigures(query) {
  const url = `${WEBSEARCH_URL}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const data = await getJson(url);
  if (!data) return 0;
  const text = [data.Abstract, data.AbstractText, data.RelatedTopics?.map(t => t.Text || t).join(" ")].join(" ");
  return countFigures(text);
}

async function checkFigureDensity(topic) {
  const query = `${topic.topic} ${topic.angle || ""}`.trim();
  const searchQueries = [
    query,
    `${query} statistics`,
    `${query} data`,
    `${query} numbers`,
    `${query} report`,
  ];

  let totalFigures = 0;
  for (const q of searchQueries) {
    const count = await searchAndCountFigures(q);
    totalFigures += count;
    if (totalFigures >= 4) break; // need at least 4 distinct figures for a shorts script (6-8 beats)
  }

  return totalFigures >= 4 ? { pass: true, figures: totalFigures } : { pass: false, figures: totalFigures };
}

async function checkTwoDomains(topic) {
  const url = `${WEBSEARCH_URL}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const data = await getJson(url);
  if (!data?.Abstract || !data?.AbstractURL) return [];
  try {
    const host = new URL(data.AbstractURL).hostname.replace(/^www\./, "");
    return [host];
  } catch { return []; }
}

async function checkTwoDomains(topic) {
  const query = `${topic.topic} ${topic.angle || ""}`.trim();
  const domains = new Set();

  const searchQueries = [
    query,
    `${query} study`,
    `${query} report`,
    `${query} data`,
  ];

  for (const q of searchQueries) {
    if (domains.size >= 2) break;
    const d = await quickSearchDomains(q);
    for (const d of d) domains.add(d);
  }

  return domains.size >= 2 ? { pass: true, domains: [...domains] } : { pass: false, domains: [...domains] };
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

    const domainCheck = await checkTwoDomains(topic);
    if (!domainCheck.pass) {
      console.log(`[validate-discovery] ch-${channelId}: REJECTED "${topic.topic}" — ${domainCheck.domains.length} domain(s) (${domainCheck.domains.join(", ")}), need 2`);
      rejected.push({ ...topic, reject_reason: `only ${domainCheck.domains.length} domain(s): ${domainCheck.domains.join(", ")}` });
      continue;
    }

    const figureCheck = await checkFigureDensity(topic);
    if (!figureCheck.pass) {
      console.log(`[validate-discovery] ch-${channelId}: REJECTED "${topic.topic}" — only ${figureCheck.figures} measurable figures in search results (need ≥4)`);
      rejected.push({ ...topic, reject_reason: `only ${figureCheck.figures} measurable figures (need ≥4)` });
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

main().catch((e) => { console.error(e); process.exit(1); });