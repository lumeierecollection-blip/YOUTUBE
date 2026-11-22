#!/usr/bin/env node
/**
 * STRICT PRE-SCREEN - can this topic's RESEARCH ground enough sentences?
 *
 * Why this exists (runs 39790127811 and 39961381904, ch-2 and ch-48, both
 * `strict_visual`): the SCR-17 STRICT gate (gate-script.js ->
 * strict-visual.mjs strictUngroundableSentences) is deliberate and unchanged,
 * but it only runs AFTER a script exists, so a topic whose research states no
 * figure, date-event, place, list or comparison cost eight script-model
 * attempts (plus one re-pick that was itself unscreened) before the channel
 * failed. "OpenAI Dots vs Meta Muse" (4 facts, every one a journalist
 * doing something) and "MIT X-Hinges" (3 facts, all entity/method statements)
 * could never have passed: the writer may only use what the research states.
 *
 * This module answers that question deterministically, BEFORE the writer is
 * called, with the gate's own definition of "groundable" (groundedVisualFor,
 * which runs the planner's checkVisual). It loosens nothing: a topic that
 * passes here still has to pass the full script gate.
 *
 * Two tiers per research fact, because the gate is lenient about what a
 * "date" or a "place" is and a news item's metadata is not its content:
 *   weak   - groundedVisualFor(fact) draws something.
 *   strong - it STILL draws something after the publication-metadata is
 *            removed: dates ("Published on October 1, 2026") and places that
 *            only occur inside an institution name ("University of Michigan").
 *            Run 39961381904 ch-48 michigan-engineering-haptic-steering-wheel:
 *            all four facts were weak-only (a date and a university name), and
 *            the writer, which has to say something about the study itself,
 *            produced sentences with neither -> 8 rejected attempts.
 * A topic is `ok` with >= STRICT_MIN_STRONG strong units. `ok: false` is NOT a
 * ruling that the topic is impossible - it means "try the next candidate
 * first"; the workflow falls back to the best-scoring candidate it examined
 * rather than skipping a channel on a heuristic.
 *
 * Known limits (keep saying them): the unit is a whole key_fact, not the
 * sentence the writer will actually produce; the writer can still drop the
 * grounding when it paraphrases (michigan-style) or add questions/bridge
 * sentences that ground nothing (flint-style). This catches the topics the
 * writer cannot succeed on, not every way a writer can fail.
 *
 * CLI (exit 0 = ok or channel not strict, 3 = starved):
 *   node scripts/strict-prescreen.mjs <channel-id> <research-slug>
 *   node scripts/strict-prescreen.mjs --is-strict <channel-id>   (prints true|false)
 *   node scripts/strict-prescreen.mjs --hint <channel-id> <research-slug>
 *   node scripts/strict-prescreen.mjs --score <channel-id> <research-slug>  (prints "<strong> <weak>")
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// Importing the planner chain prints "[vocab] ..." to STDOUT; the CLI modes below are parsed from stdout by the
// workflow (SV=$(... --is-strict), --score, --hint), so that noise is sent to stderr while the module loads.
const _log = console.log;
console.log = (...a) => console.error(...a);
const { groundedVisualFor, strictVisualEnabled } = await import("./strict-visual.mjs");
console.log = _log;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Strong units a topic needs. A Short is 5-8 sentences from 3-6 facts; every passing strict script on record had >= 3. */
export const STRICT_MIN_STRONG = 3;

const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const DATE_PHRASES = [
  new RegExp(`\\b(?:on|in|since|by|during|as of)?\\s*${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+(?:19|20)\\d{2})?\\b`, "gi"),
  new RegExp(`\\b(?:on|in|since|by|during|as of|from)?\\s*${MONTH}\\.?,?\\s+(?:19|20)\\d{2}\\b`, "gi"),
  /\b(?:published|released|announced|posted|issued|distributed|updated)\s+(?:on|in)\b/gi,
  /\b(?:in|during|since|by)\s+(?:19|20)\d{2}\b/gi,
];
const INSTITUTION_PLACE = [
  /\b(?:University|College|Institute|School|Laborator(?:y|ies)|Lab|Centre|Center|Hospital|Academy|Department)\s+of\s+(?:the\s+)?[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)?/g,
  /\b[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?\s+(?:University|College|Institute|Polytechnic)\b/g,
  /\bU-M\b/g,
];

/** The fact with its publication metadata taken out: what is left is what the story is ABOUT. */
export function stripMetadata(text) {
  let t = String(text || "");
  for (const re of DATE_PHRASES) t = t.replace(re, " ");
  for (const re of INSTITUTION_PLACE) t = t.replace(re, " ");
  return t.replace(/\s{2,}/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
}

// number entries that only restate the publication date ("Publication Day 1 day")
const DATE_PART_LABEL = /\b(?:publication|published|release|released|announcement|announced|posting|posted|issue|issued|update|updated|event|date)\b[^.]*\b(?:day|month|year|date)\b|^\s*(?:day|month|year)\s*$/i;
const DATE_PART_UNIT = /^(?:day|days|month|months|year|years|date)$/i;

function numberSentence(n) {
  return `${n.label} ${n.value} ${n.unit}`.replace(/\s+/g, " ").trim();
}

/**
 * Measure a research artifact.
 * -> { total, strong, weak, need, ok, facts:[{fact, weak, strong}], numbers:[{text, strong, extra}] }
 * `weak` / `strong` on each row are the visual_type or null. `strong` counts
 * fact units plus number entries whose figure no strong fact already carries.
 */
export function researchGroundability(research, { need = STRICT_MIN_STRONG } = {}) {
  const facts = (research?.key_facts || []).map((k) => {
    const fact = String(k?.fact || "");
    const weak = groundedVisualFor(fact)?.visual_type || null;
    const strong = groundedVisualFor(stripMetadata(fact))?.visual_type || null;
    return { fact, weak, strong };
  });
  const strongText = facts.filter((f) => f.strong).map((f) => f.fact).join(" ");
  const numbers = (research?.numbers || [])
    .filter((n) => n && !(DATE_PART_UNIT.test(String(n.unit || "")) && DATE_PART_LABEL.test(String(n.label || ""))))
    .map((n) => {
      const text = numberSentence(n);
      const strong = groundedVisualFor(stripMetadata(text))?.visual_type || null;
      const carried = new RegExp(`(?<![\\d.])${String(n.value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d])`).test(strongText);
      return { text, strong, extra: !!strong && !carried };
    });
  const strongCount = facts.filter((f) => f.strong).length + numbers.filter((n) => n.extra).length;
  const weakCount = facts.filter((f) => f.weak).length;
  return { total: facts.length, strong: strongCount, weak: weakCount, need, ok: strongCount >= need, facts, numbers };
}

/** One log line: the numbers, then why. */
export function describe(r, label = "") {
  const head = `[prescreen]${label ? ` ${label}:` : ""} ${r.strong} strong drawable unit(s) from ${r.total} key_facts (${r.weak} facts draw anything, incl. a bare date or institution place), need ${r.need} -> ${r.ok ? "OK" : "STARVED"}`;
  const rows = r.facts.map((f) => `    ${f.strong ? "+" : f.weak ? "~" : "-"} ${f.strong || f.weak || "no figure/date/place/list/comparison"}  ${f.fact.slice(0, 110)}`);
  return [head, ...rows].join("\n");
}

/** The facts a writer can state nearly verbatim and still ground a frame (for the rewrite feedback). */
export function groundedHints(research, max = 4) {
  return researchGroundability(research).facts.filter((f) => f.strong || f.weak).slice(0, max).map((f) => f.fact);
}

function loadResearch(ch, slug) {
  const p = join(ROOT, "data", "research", String(ch), `${slug}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : null;
}

function main() {
  const argv = process.argv.slice(2);
  const mode = argv[0]?.startsWith("--") ? argv.shift() : "";
  const [ch, slug] = argv;
  if (mode === "--is-strict") { console.log(strictVisualEnabled(ch) ? "true" : "false"); return; }
  if (!ch || (mode !== "--is-strict" && !slug)) {
    console.error("Usage: node scripts/strict-prescreen.mjs [--hint|--score] <channel-id> <research-slug> | --is-strict <channel-id>");
    process.exit(1);
  }
  if (!strictVisualEnabled(ch)) { if (mode === "--score") console.log("0 0"); else if (!mode) console.log(`[prescreen] ch-${ch}: not a strict_visual channel - nothing to screen`); return; }
  const research = loadResearch(ch, slug);
  if (!research) { console.error(`[prescreen] no research artifact for ch-${ch}/${slug}`); process.exit(1); }
  const r = researchGroundability(research);
  if (mode === "--score") { console.log(`${r.strong} ${r.weak}`); return; }
  if (mode === "--hint") {
    const hints = groundedHints(research);
    if (hints.length) console.log(`  - SCR-17 STRICT HINT: only these researched facts state something a frame can draw, so build the sentences from them (keep the figure/date/place in EVERY sentence, no questions or bridge lines without one): "${hints.join('" / "').slice(0, 600)}"`);
    return;
  }
  console.log(describe(r, `ch-${ch}/${slug}`));
  process.exit(r.ok ? 0 : 3);
}

if (process.argv[1] && process.argv[1].split("\\").join("/").endsWith("scripts/strict-prescreen.mjs")) main();
