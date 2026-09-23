#!/usr/bin/env node
/**
 * Fit a Short's voiceover under a word ceiling by REMOVING whole sentences.
 *
 * Usage: node scripts/fit-short.js <script.json> <max-words>
 *
 * qwen2.5:3b does not converge on a length target when asked — ch-48 went
 * 70s → 66s → 64s → 90s and ch-9 68s → 60s → 75s across rewrites (runs
 * 35837564720, 35840782030), each rewrite costing ~2 minutes. This edits
 * deterministically instead, and only by deletion: nothing is added or
 * reworded, so every sentence that remains is exactly as written and every
 * fact in it stays traceable to research. The caller re-runs the script
 * gate and re-measures the real voiceover afterwards.
 *
 * Protected: the first sentence (hook) and the last sentence (payoff). A
 * middle section whose sentences are all removed is dropped, but never
 * below MIN_SECTIONS (the script schemas' sections minItems). Removal order:
 * the longest middle section first, its last sentence first.
 *
 * Exit 0: fits (prints what was removed). Exit 3: cannot fit without
 * touching protected sentences. Exit 1: usage/IO error.
 */

import { readFileSync, writeFileSync } from "node:fs";

const [, , file, maxArg] = process.argv;
const maxWords = Number(maxArg);
if (!file || !Number.isFinite(maxWords) || maxWords <= 0) {
  console.error("Usage: node scripts/fit-short.js <script.json> <max-words>");
  process.exit(1);
}

const script = JSON.parse(readFileSync(file, "utf-8"));
const sections = script.sections || [];
const words = (t) => String(t).split(/\s+/).filter(Boolean).length;
const splitSentences = (t) => String(t || "").trim().split(/(?<=[.!?])\s+/).filter(Boolean);

const parts = sections.map((s) => splitSentences(s.voiceover));
const total = () => parts.reduce((n, ss) => n + ss.reduce((m, x) => m + words(x), 0), 0);
const lastSec = parts.length - 1;

const MIN_SECTIONS = 3;
const before = total();
const removed = [];
while (total() > maxWords) {
  const live = parts.filter((ss) => ss.length).length;
  // A sentence is removable unless it is the hook (first of section 0), the
  // payoff (last of the last section), or the only sentence of a section
  // that can't be dropped without going under MIN_SECTIONS.
  const candidates = parts
    .map((ss, i) => {
      const lo = i === 0 ? 1 : 0;
      const hi = i === lastSec ? ss.length - 2 : ss.length - 1;
      const emptiesSection = ss.length === 1;
      const removable = hi >= lo && ss.length > 0 && (!emptiesSection || (i !== 0 && i !== lastSec && live > MIN_SECTIONS));
      return { i, removable, hi, size: ss.reduce((m, x) => m + words(x), 0) };
    })
    .filter((c) => c.removable)
    .sort((a, b) => b.size - a.size);
  if (!candidates.length) {
    console.error(`fit-short: ${total()} words after removing ${removed.length} sentence(s); cannot reach ${maxWords} without cutting the hook, the payoff, or going under ${MIN_SECTIONS} sections`);
    process.exit(3);
  }
  const c = candidates[0];
  const [gone] = parts[c.i].splice(c.hi, 1);
  removed.push({ section: sections[c.i].id, sentence: gone });
}

parts.forEach((ss, i) => { sections[i].voiceover = ss.join(" "); });
// Drop sections emptied above (only ever middle ones).
script.sections = sections.filter((s, i) => parts[i].length > 0);
writeFileSync(file, JSON.stringify(script, null, 2) + "\n");
console.log(`fit-short: ${before} → ${total()} words (max ${maxWords}), removed ${removed.length} sentence(s):`);
for (const r of removed) console.log(`  - [${r.section}] ${r.sentence}`);
