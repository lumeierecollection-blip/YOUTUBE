#!/usr/bin/env node
/**
 * TEST FIXTURE GENERATOR — NOT PRODUCTION TTS.
 *
 * Writes a synthetic SRT with realistic per-word cadence for a script that
 * has no real voiceover yet, so the visual pipeline (which is driven by
 * real per-word SRT timing) can be exercised end to end offline.
 *
 * WHY THIS EXISTS
 *
 * Production timing comes from EdgeTTS (`src/utils/tts.js`), which writes a
 * real `.srt` next to the real `.mp3`. EdgeTTS talks to
 * speech.platform.bing.com over a WebSocket, and WebSocket upgrades are not
 * supported through this development sandbox's HTTPS proxy, so a real
 * voiceover cannot be produced here. Rather than let that block visual
 * verification entirely, this produces timing of the same SHAPE (caption
 * lines of 4-7 words, per-word durations scaled by word length, small
 * inter-caption gaps) so beat windows, anchor sync and state timing are
 * exercised against something structurally real.
 *
 * WHAT IT IS NOT: a substitute for a real render's timing. Word timings
 * here are modelled, not measured. Any claim about lip-sync accuracy or
 * true speech pacing needs a real EdgeTTS run. Files it writes are named
 * `*-vo.fixture.srt` so they can never be mistaken for a real TTS artifact
 * on disk, and it refuses to overwrite a real `*-vo.srt`.
 *
 * Usage:
 *   node qa-scripts/make-fixture-srt.mjs <script.json> <out.fixture.srt> [wpm]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, basename } from "path";
import { narrationSections } from "../../../utils/script-narration.js";

const [, , scriptPath, outPath, wpmArg] = process.argv;
if (!scriptPath || !outPath) {
  console.error("Usage: node qa-scripts/make-fixture-srt.mjs <script.json> <out.fixture.srt> [wpm]");
  process.exit(1);
}
if (!/\.fixture\.srt$/.test(outPath)) {
  console.error(`Refusing to write "${outPath}": fixture SRTs must end in .fixture.srt so they are never mistaken for real TTS output.`);
  process.exit(1);
}

const wpm = Number(wpmArg) || 150;
const msPerWord = 60000 / wpm;

const script = JSON.parse(readFileSync(scriptPath, "utf-8"));
const sections = narrationSections(script);

const pad = (n, l = 2) => String(n).padStart(l, "0");
const stamp = (ms) =>
  `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:${pad(Math.floor((ms % 60000) / 1000))},${pad(Math.floor(ms % 1000), 3)}`;

let t = 0;
const captions = [];
for (const sec of sections) {
  const words = String(sec.voiceover || "").split(/\s+/).filter(Boolean);
  let line = [];
  let lineStart = t;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // Longer words take longer to say; punctuation buys a beat of pause.
    const dur = msPerWord * (0.62 + Math.min(w.length, 12) * 0.055) + (/[,;:]$/.test(w) ? 90 : 0);
    line.push(w);
    t += dur;
    const sentenceEnd = /[.!?]$/.test(w);
    if (line.length >= 7 || (sentenceEnd && line.length >= 4) || i === words.length - 1) {
      captions.push({ start: lineStart, end: t, text: line.join(" ") });
      line = [];
      t += sentenceEnd ? 220 : 70;
      lineStart = t;
    }
  }
}

const srt = captions
  .map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`)
  .join("\n");

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, srt + "\n");
console.log(
  `FIXTURE (not real TTS): ${captions.length} captions, ${(t / 1000).toFixed(1)}s @ ${wpm}wpm -> ${outPath}`
);
