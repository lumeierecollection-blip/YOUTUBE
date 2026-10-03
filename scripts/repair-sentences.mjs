#!/usr/bin/env node
/**
 * The script stage's ONE re-ask, as a targeted repair: only the sentences the checks flagged
 * are rewritten; every other sentence stays exactly as it passed.
 *
 *   node scripts/repair-sentences.mjs <script.json> <research.json> <feedback.txt>
 *     exit 0 = repaired (script.json rewritten, the changes printed)
 *     exit 1 = could not repair (Gemini unavailable / unusable answer) — the caller falls back
 *              to the full-script re-ask
 *
 * Why: the full-script re-ask regenerated everything. Gemini fixed the flagged sentences and
 * wrote new generic ones elsewhere, so the second check failed on DIFFERENT sentences and the
 * voice gate skipped 6 of 6 channels in CI runs 37154369091 and 37154668613.
 *
 * feedback.txt holds the checks' "  - " lines (validate-script-story.cjs, validate-script-
 * claims.cjs). The model gets the research (facts only, the same text the claim judge reads),
 * every sentence numbered with its beat, the feedback, and the voice rules, and returns
 * {"replacements": [{"n": <sentence number>, "text": "<new sentence>"}]}. A replacement may only
 * target a sentence the feedback names (by its text or number) or, for a beat-level narrative
 * line ("SETUP … does not leave a question open"), a sentence of that beat. Nothing else changes.
 * The validators then run again on the result — this script checks nothing itself.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { callGemini } from "../src/lib/gemini-client.js";

const require = createRequire(import.meta.url);
const { sentences } = require("./validate-script.cjs");
const { researchText } = require("./validate-script-claims.cjs");
const MODEL = process.env.SCRIPT_GEMINI_MODEL || "gemini-3.5-flash-lite";
const BEATS = { HOOK: "hook", SETUP: "setup", REHOOK: "rehook", "RE-HOOK": "rehook", PAYOFF: "payoff", CLOSE: "close" };

const [scriptPath, researchPath, feedbackPath] = process.argv.slice(2);
const script = JSON.parse(readFileSync(scriptPath, "utf8"));
const research = JSON.parse(readFileSync(researchPath, "utf8"));
const feedback = readFileSync(feedbackPath, "utf8").split("\n").filter((l) => /^\s*- /.test(l)).map((l) => l.trim());
const tag = `[script] ch-${script.channel_id ?? "?"}`;
if (!feedback.length) { console.log(`${tag}: repair — no feedback lines`); process.exit(1); }

// Every sentence, numbered, with its section.
const rows = [];
(script.sections || []).forEach((sec, si) => sentences(sec.voiceover || "").forEach((s) => rows.push({ n: rows.length + 1, si, beat: sec.id, text: s })));
// Which sentences the feedback allows to change.
const allowed = new Set();
for (const l of feedback) {
  const num = l.match(/sentence (\d+)\b/i);
  if (num) allowed.add(Number(num[1]));
  for (const r of rows) if (l.includes(`"${r.text}"`) || l.includes(r.text.slice(0, 50))) allowed.add(r.n);
  const beat = (l.match(/NARRATIVE:\s*([A-Z-]+)/) || [])[1];
  if (beat && BEATS[beat]) for (const r of rows) if (r.beat === BEATS[beat]) allowed.add(r.n);
  if (/sentences start with a person's name/.test(l)) for (const r of rows) allowed.add(r.n);
}
if (!allowed.size) { console.log(`${tag}: repair — the feedback names no sentence`); process.exit(1); }

const prompt = [
  "You are repairing a YouTube Shorts script. Rewrite ONLY the sentences the checks flagged; every other sentence stays word for word.",
  "",
  "RESEARCH (the only source of facts — every name, number, date and claim must come from here):",
  researchText(research),
  "",
  "SCRIPT (numbered sentences, with their beat):",
  ...rows.map((r) => `${r.n}. [${r.beat}] ${r.text}`),
  "",
  "WHAT THE CHECKS FLAGGED:",
  ...feedback,
  "",
  `You may replace only sentences ${[...allowed].sort((a, b) => a - b).join(", ")}.`,
  "Rules for every replacement: it names a specific person, place, organization, number, date or physical object FROM THE RESEARCH; it never starts with a person's full name (a surname alone may open at most one sentence in the whole script); 12-18 words, never over 25; active voice, contractions; no hedging (may / could / might); it keeps its beat's job (the setup's last sentence ends on a question; the re-hook flips or raises the stakes; the payoff states a specific number; the close is one specific action). Keep roughly the same length so the script stays 92-107 words.",
  'Return JSON only: {"replacements": [{"n": <sentence number>, "text": "<the new sentence>"}]}',
].join("\n");

const g = await callGemini([{ role: "user", content: prompt }], { model: MODEL, maxTokens: 4096, temperature: 0.4, noCache: true, tag: "repair" });
if (g && g.source === "gemini" && g.error) { console.log(`${tag}: repair — gemini unavailable (${g.error})`); process.exit(1); }
let data = g;
if (g && typeof g.content === "string" && Object.keys(g).length === 1) {
  const t = g.content, a = t.indexOf("{"), b = t.lastIndexOf("}");
  try { data = JSON.parse(t.slice(a, b + 1)); } catch { data = null; }
}
const reps = (data?.replacements || []).filter((r) => allowed.has(Number(r?.n)) && typeof r?.text === "string" && r.text.trim().length > 3);
if (!reps.length) { console.log(`${tag}: repair — no usable replacement in the answer`); process.exit(1); }

for (const r of reps) {
  const row = rows.find((x) => x.n === Number(r.n));
  const text = r.text.trim().replace(/\s+/g, " ");
  console.log(`${tag}: repair sentence ${row.n} [${row.beat}]: "${row.text}" -> "${text}"`);
  row.text = text;
}
(script.sections || []).forEach((sec, si) => {
  const before = sec.voiceover;
  sec.voiceover = rows.filter((r) => r.si === si).map((r) => r.text).join(" ");
  if (sec.id === "hook" && script.hook === before) script.hook = sec.voiceover;
});
writeFileSync(scriptPath, JSON.stringify(script, null, 2) + "\n");
console.log(`${tag}: repair — ${reps.length} sentence(s) replaced, ${rows.length - reps.length} kept word for word`);
