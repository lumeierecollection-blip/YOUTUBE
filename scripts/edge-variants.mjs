#!/usr/bin/env node
/**
 * edge-variants.mjs — the text-variant test on Edge-TTS (no API key), scored by the ACOUSTIC measure.
 *
 * One production sentence (the committed script's own text, ci-artifacts-31503638942), four texts:
 *   a  as the script writes it
 *   b  speakable()                      — what production synthesises
 *   c  digits spelled with numberWords  — a naive digits-only transform
 *   d  c, then speakable()
 * Each text is synthesised with the same Edge voice at production delivery (rate +0%, pitch +0Hz) by
 * src/utils/tts_words.py, then measured by scripts/acoustic/narration-acoustics.py.
 *
 * The numbers are ACOUSTIC (per-sentence F0 spread, in semitones). They are NOT the Gemini
 * listener's score: that is a different instrument on a different scale (scripts/narration-judge.mjs).
 * Nothing here calibrates or gates anything; it reports.
 *
 *   node scripts/edge-variants.mjs --out <dir> [--voice en-US-GuyNeural]
 * Writes <dir>/{a,b,c,d}.{txt,mp3,srt,words.json,acoustic.json} and prints a table.
 * Needs python3 with edge-tts and numpy, and ffmpeg on PATH.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { speakable, numberWords } from "../src/utils/tts-normalize.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const out = arg("out", join(ROOT, "probe", "edge"));
const voice = arg("voice", "en-US-GuyNeural");
mkdirSync(out, { recursive: true });

// A sentence where the four variants differ. (The earlier production sentence, "375 DNA", gave b, c and d the same
// text: speakable() already spells digits, so the digits-only variant added nothing. Fixed 2026-10-10.)
const sentence = "Revenue hit $1.5M, up 30% from 2023, over a 12–18 month window.";

// Same naive digits-only transform as scripts/voice-lab.mjs. It is deliberately naive: it is the variant
// under test, and it is expected to produce broken text on money and percentages.
const digitsOnly = (t) => t.replace(/\b\d[\d,]*(?:\.\d+)?\b/g, (m) => { const n = Number(m.replace(/,/g, "")); return Number.isFinite(n) ? numberWords(m.replace(/,/g, "")) : m; });
const texts = { a: sentence, b: speakable(sentence), c: digitsOnly(sentence), d: speakable(digitsOnly(sentence)) };
// The four must be distinct, or the test has fewer than four texts. Refuse to synthesize otherwise.
const distinct = new Set(Object.values(texts));
console.log("Texts:");
for (const [v, t] of Object.entries(texts)) console.log(`  [${v}] ${t}`);
if (distinct.size !== 4) throw new Error(`only ${distinct.size} distinct texts out of 4; the variant test needs four`);
console.log(`Distinct texts: ${distinct.size} of 4`);

const rows = [];
for (const [v, text] of Object.entries(texts)) {
  const base = join(out, v);
  writeFileSync(`${base}.txt`, text + "\n");
  const tts = spawnSync("python3", [join(ROOT, "src", "utils", "tts_words.py"), "--voice", voice, "--rate", "+0%", "--pitch", "+0Hz",
    "--file", `${base}.txt`, "--mp3", `${base}.mp3`, "--srt", `${base}.srt`, "--words", `${base}.words.json`], { encoding: "utf8", timeout: 300000 });
  if (tts.status !== 0) { rows.push({ v, text, error: `tts failed: ${(tts.stderr || "").trim().split("\n").slice(-2).join(" | ").slice(0, 200)}` }); continue; }
  const ac = spawnSync("python3", [join(ROOT, "scripts", "acoustic", "narration-acoustics.py"), `${base}.mp3`, `${base}.srt`, "--json", `${base}.acoustic.json`], { encoding: "utf8", timeout: 300000 });
  if (ac.status !== 0) { rows.push({ v, text, error: `acoustic failed: ${(ac.stderr || "").trim().split("\n").slice(-2).join(" | ").slice(0, 200)}` }); continue; }
  const j = JSON.parse(readFileSync(`${base}.acoustic.json`, "utf8"));
  const s = j.sentences || [];
  const mean = (k) => { const xs = s.map((x) => x[k]).filter((x) => x != null); return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null; };
  rows.push({ v, text, cues: s.length, f0_std_st: mean("f0_std_st"), f0_range_st: mean("f0_range_st"), f0_slope_st: mean("f0_slope_st") });
}

console.log(`Production sentence: ${sentence}`);
console.log(`Voice ${voice}, delivery rate +0% pitch +0Hz. ACOUSTIC measure (narration-acoustics.py), not the Gemini listener.`);
for (const r of rows) {
  console.log(`\n[${r.v}] ${r.text}`);
  if (r.error) console.log(`    ${r.error}`);
  else console.log(`    cues=${r.cues}  f0_std_st=${r.f0_std_st}  f0_range_st=${r.f0_range_st}  f0_slope_st=${r.f0_slope_st}`);
}
writeFileSync(join(out, "summary.json"), JSON.stringify(rows, null, 2) + "\n");
