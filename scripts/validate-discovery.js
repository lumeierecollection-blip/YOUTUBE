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
 * POLICY MODE (env DISCOVERY_VALIDATION, default "advisory"; anything else but "enforce" is an error, never a silent default):
 *   advisory - the checks run and are reported, but a channel is not stopped by them. If no candidate passes, every
 *              candidate is kept in ranked order, tagged validation.status "advisory_fail" with its reason, a ::warning::
 *              is printed, doc.validation.outcome is "advisory" and the exit code is 0. This is what production has
 *              effectively done since the "skip" result was never read (see the Reserve topic step).
 *   enforce  - if no candidate passes, exit 1. The workflow then marks the channel skipped and the Reserve topic step
 *              reserves nothing.
 * Exit 0 if a topic passes (outcome "passed") or the mode is advisory (outcome "advisory"); 1 if all candidates were
 * rejected under "enforce" (a policy outcome); 2 if the validator itself failed (see EXIT).
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

// Whole-word match (a plural is allowed). It was a substring test, so "Alterations" counted as containing "ratio", "Operate" as "rate",
// "Separate" as "rate", "Bi-annual" etc. - a topic could pass the rule on a word that has nothing to do with a measurement.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The list repeats "survey" and "poll"; each hit is counted, so a single "survey" used to satisfy the angle's ">= 2 keywords" rule.
// De-duplicate so a hit means a distinct keyword.
const KEYWORD_RES = [...new Set(MEASURABLE_KEYWORDS.map((kw) => kw.toLowerCase()))].map((kw) => new RegExp(`(?<![a-z0-9])${escapeRe(kw)}(?:s|es)?(?![a-z0-9])`, "i"));
// A stated percentage ("78%", "12.5 percent", "3 per cent") is a measurement. The rejection message has always listed "percent" as a
// qualifying word, but the word list omitted it, so a title that carried its own figure ("AAMI Study Finds 78% of Nurses ...") was
// rejected as "lacking a measurable keyword" (run 41009396847, ch-48). It counts once, as one distinct keyword.
const PERCENT_RE = /\d(?:[.,]\d+)?\s?(?:%|percent\b|per cent\b|percentage points?\b)/i;
const keywordHits = (text) => KEYWORD_RES.reduce((n, re) => n + (re.test(String(text || "")) ? 1 : 0), 0) + (PERCENT_RE.test(String(text || "")) ? 1 : 0);

function hasMeasurableKeywords(text) {
  return keywordHits(text) > 0;
}

export async function checkMeasurableKeywords(topic) {
  // Require the topic TITLE itself to contain a measurable keyword (strong signal).
  // Topics like "API release", "product launch", "model release" lack measurable keywords.
  if (keywordHits(topic.topic) > 0) return { pass: true };
  // If title lacks measurable keyword, require angle to have >=2 measurable keywords
  const count = keywordHits(topic.angle);
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

export const VALIDATION_MODES = ["advisory", "enforce"];

/** Unset -> "advisory". Anything else that is not a known mode is an ERROR: a typo must not silently pick a policy. */
export function resolveValidationMode(env = process.env) {
  const raw = String(env.DISCOVERY_VALIDATION ?? "").trim().toLowerCase();
  if (raw === "") return "advisory";
  if (VALIDATION_MODES.includes(raw)) return raw;
  throw new Error(`DISCOVERY_VALIDATION="${env.DISCOVERY_VALIDATION}" is not one of ${VALIDATION_MODES.join(", ")}`);
}

const DEFAULT_CHECKS = { keyword: checkMeasurableKeywords, domains: checkTwoDomains, figures: checkFigureDensity, visual: checkVisualCoverage };

/** Run the checks over the ranked candidates; the first that passes all of them is `chosen`. `checks` is injectable for tests. */
export async function screenCandidates(topics, channelId, checks = DEFAULT_CHECKS, log = console.log) {
  const rejected = [];
  let chosen = null;

  for (const topic of topics) {
    log(`[validate-discovery] ch-${channelId}: checking "${topic.topic}"...`);

    const keywordCheck = await checks.keyword(topic);
    if (!keywordCheck.pass) {
      log(`[validate-discovery] ch-${channelId}: REJECTED "${topic.topic}" — ${keywordCheck.reason}`);
      rejected.push({ ...topic, reject_reason: keywordCheck.reason });
      continue;
    }

    const domainCheck = await checks.domains(topic);
    if (!domainCheck.pass) {
      const why = domainCheck.status === "lookup_failed"
        ? `source lookup failed (${domainCheck.answered}/${domainCheck.lookups} lookups answered), so independent sources could not be established`
        : `only ${domainCheck.domains.length} independent domain(s): ${domainCheck.domains.join(", ")}`;
      log(`[validate-discovery] ch-${channelId}: REJECTED "${topic.topic}" — ${why}, need 2`);
      rejected.push({ ...topic, reject_reason: why });
      continue;
    }

    const figureCheck = await checks.figures(topic);
    if (!figureCheck.pass) {
      const why = figureCheck.status === "lookup_failed"
        ? `figure lookup failed (${figureCheck.answered}/${figureCheck.lookups} lookups answered), so measurable figures could not be established`
        : `only ${figureCheck.figures} measurable figures in search results (need >=8)`;
      log(`[validate-discovery] ch-${channelId}: REJECTED "${topic.topic}" — ${why}`);
      rejected.push({ ...topic, reject_reason: why });
      continue;
    }

    const visualCheck = await checks.visual(topic);
    if (!visualCheck.pass) {
      const pct = Math.round(visualCheck.coverage * 100);
      log(`[validate-discovery] ch-${channelId}: REJECTED "${topic.topic}" — ${pct}% visual coverage (need 80%)`);
      rejected.push({ ...topic, reject_reason: `${pct}% visual coverage (need 80%)` });
      continue;
    }

    log(`[validate-discovery] ch-${channelId}: ACCEPTED "${topic.topic}" — ${domainCheck.domains.length} domains, ${figureCheck.figures} figures, ${Math.round(visualCheck.coverage * 100)}% visual coverage`);
    chosen = topic;
    break;
  }
  return { chosen, rejected };
}

/**
 * Turn a screening result into the outcome + the topics document to write.
 *   passed   - a candidate passed: only it is kept (exit 0).
 *   advisory - none passed, mode advisory: ALL candidates kept in ranked order, each tagged with its reason (exit 0).
 *   rejected - none passed, mode enforce: nothing to reserve (exit 1, document untouched).
 */
export function applyPolicy(doc, { chosen, rejected }, mode) {
  const topics = doc.topics || [];
  if (chosen) {
    return { outcome: "passed", exitCode: 0, doc: { ...doc, topics: [chosen], rejected, validation: { mode, outcome: "passed", rejected: rejected.length } } };
  }
  if (mode === "advisory") {
    const reasons = new Map(rejected.map((r) => [r.topic, r.reject_reason]));
    const tagged = topics.map((t) => ({ ...t, validation: { status: "advisory_fail", reason: reasons.get(t.topic) || "not validated" } }));
    return { outcome: "advisory", exitCode: 0, doc: { ...doc, topics: tagged, rejected, validation: { mode, outcome: "advisory", rejected: rejected.length } } };
  }
  return { outcome: "rejected", exitCode: 1, doc };
}

/**
 * Exit codes, so a caller can tell a POLICY decision from a FAULT:
 *   0 - passed, or advisory (checks failed but the mode lets the channel proceed)
 *   1 - rejected under DISCOVERY_VALIDATION=enforce: a deliberate policy outcome, not a defect
 *   2 - the validator itself failed (bad usage or mode, unreadable/empty input, an unexpected exception)
 */
export const EXIT = Object.freeze({ OK: 0, REJECTED: 1, ERROR: 2 });

async function main() {
  const [topicsPath, channelId] = process.argv.slice(2);
  if (!topicsPath || !channelId) {
    console.error("Usage: node scripts/validate-discovery.js <topics.json> <channel-id>");
    process.exit(EXIT.ERROR);
  }
  const mode = resolveValidationMode();

  const doc = JSON.parse(readFileSync(topicsPath, "utf8"));
  const topics = doc.topics || [];
  if (topics.length === 0) {
    console.error("validate-discovery: no topics to validate");
    process.exit(EXIT.ERROR);
  }

  const result = await screenCandidates(topics, channelId);
  const { outcome, exitCode, doc: out } = applyPolicy(doc, result, mode);

  if (outcome === "advisory") {
    console.log(`::warning::discovery validation ADVISORY for channel ${channelId}: all ${topics.length} candidates failed validation; proceeding with them unvalidated (DISCOVERY_VALIDATION=advisory). Set DISCOVERY_VALIDATION=enforce to skip the channel instead.`);
  } else if (outcome === "rejected") {
    console.error(`validate-discovery: ch-${channelId} — ALL ${topics.length} CANDIDATES REJECTED (DISCOVERY_VALIDATION=enforce) — channel will be skipped`);
  }
  if (outcome !== "rejected") {
    writeFileSync(topicsPath, JSON.stringify(out, null, 2) + "\n");
    console.log(`[validate-discovery] ch-${channelId}: outcome=${outcome}, ${out.topics.length} candidate(s) forwarded${result.chosen ? `, chosen "${result.chosen.topic}"` : ""}`);
  }
  process.exit(exitCode);
}

if (process.argv[1] && /validate-discovery\.js$/.test(process.argv[1].replace(/\\/g, "/"))) {
  main().catch((e) => { console.error(e); process.exit(EXIT.ERROR); });
}