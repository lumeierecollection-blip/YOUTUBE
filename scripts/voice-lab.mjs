#!/usr/bin/env node
/**
 * voice-lab — which way of asking Gemini TTS for the narration the production judge accepts?
 *
 *   node scripts/voice-lab.mjs [--out out/lab] [--only name,name] [--text scripts/fixtures/voice-lab/script.txt]
 *
 * Board 38047691386: take after take of the same voice scored 5-6 on every sentence (mean 5.4) at the render's narration gate (7+ on every
 * sentence), so the retake loop could not help — the delivery is consistently below the bar, not unlucky. The listening test that scored the voice
 * 8-9 used one short, rhythmic sentence group. This runs ONE production-style script through a matrix of requests — voice, whole script vs one
 * request per sentence, no direction vs the current direction vs a structured director's note — and has scripts/narration-judge.mjs (the very
 * judge the gate runs) score each. It changes nothing in production: it reports. Quota: one TTS request per variant (per sentence in the
 * per-sentence variants) and one judge call.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const out = arg("out", join(ROOT, "out", "lab"));
const only = (arg("only") || "").split(",").map((s) => s.trim()).filter(Boolean);
const textFile = arg("text", join(ROOT, "scripts", "fixtures", "voice-lab", "script.txt"));
mkdirSync(out, { recursive: true });

// What production sends today (src/utils/tts.js geminiVoiceFor).
const CURRENT = "Read this as a documentary narrator speaking to one person: warm, engaged and conversational, with real variation in pitch across each sentence, a short breath at every comma and dash, a clear stop at every full stop, and a little weight on the one word in each sentence that matters. Never sing-song, never flat, never rushed.";
// A structured direction (audio profile / scene / director's notes), the form the Gemini TTS guide recommends.
const NOTES = `# AUDIO PROFILE: a seasoned documentary narrator
## THE SCENE: a quiet recording booth. The narrator is telling one curious listener a surprising true story and finds it genuinely interesting.
### DIRECTOR'S NOTES
Style: warm, close and unhurried. Energy and pitch change from sentence to sentence — a question lifts, a number lands, a reveal drops lower. Never a steady drone.
Pacing: natural and conversational; quicker through detail, slower on the key number or name; a short breath at commas and dashes.
Emphasis: lean on the single word in each sentence that matters most.
#### TRANSCRIPT`;

const V = (name, voice, style, mode = "whole") => ({ name, voice, style, mode });
const VARIANTS = [
  V("baseline-charon-whole", "Charon", CURRENT),
  V("nodirection-charon-whole", "Charon", ""),
  V("notes-charon-whole", "Charon", NOTES),
  V("current-charon-sentence", "Charon", CURRENT, "sentence"),
  V("notes-charon-sentence", "Charon", NOTES, "sentence"),
  ...["Sulafat", "Puck", "Kore", "Zephyr", "Orus", "Fenrir"].map((v) => V(`notes-${v.toLowerCase()}-whole`, v, NOTES)),
  ...["Puck", "Kore"].map((v) => V(`notes-${v.toLowerCase()}-sentence`, v, NOTES, "sentence")),
].filter((v) => !only.length || only.includes(v.name));

const rows = [];
for (const v of VARIANTS) {
  const dir = join(out, v.name); mkdirSync(dir, { recursive: true });
  const f = (n) => join(dir, n);
  console.log(`\n=== ${v.name} (voice ${v.voice}, ${v.mode}${v.style ? "" : ", no direction"})`);
  const tts = spawnSync("python3", [join(ROOT, "src", "utils", "tts_gemini.py"), "--voice", v.voice, "--style", v.style, "--mode", v.mode, "--file", textFile, "--mp3", f("vo.mp3"), "--srt", f("vo.srt"), "--words", f("vo-words.json")], { encoding: "utf8", env: process.env, timeout: 900000 });
  if (tts.status !== 0) { console.log(`TTS failed: ${(tts.stderr || "").trim().split("\n").slice(-2).join(" | ").slice(0, 300)}`); rows.push({ ...v, ok: false, why: "tts failed" }); continue; }
  const dur = Number((spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f("vo.mp3")], { encoding: "utf8" }).stdout || "0").trim()) || null;
  const j = spawnSync("node", [join(ROOT, "scripts", "narration-judge.mjs"), "--audio", f("vo.mp3"), "--srt", f("vo.srt"), "--out", f("narration.json")], { encoding: "utf8", env: process.env, timeout: 400000 });
  if (!existsSync(f("narration.json"))) { console.log(`judge could not run (exit ${j.status}): ${(j.stderr || "").trim().slice(-200)}`); rows.push({ ...v, ok: false, why: "judge could not run", seconds: dur }); continue; }
  const sentences = JSON.parse(readFileSync(f("narration.json"), "utf8")).sentences || [];
  const scores = sentences.map((s) => Number(s.score));
  const mean = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
  const row = { ...v, ok: true, seconds: dur, mean: +mean.toFixed(2), min: Math.min(...scores), passing: scores.filter((x) => x >= 7).length, of: scores.length, scores };
  rows.push(row);
  console.log(`${v.name}: mean ${row.mean}, min ${row.min}, ${row.passing}/${row.of} sentences at 7+ (${dur ? dur.toFixed(1) + " s" : "?"})`);
}

rows.sort((a, b) => (b.mean ?? -1) - (a.mean ?? -1));
const table = ["| variant | voice | mode | mean | min | at 7+ | seconds |", "|---|---|---|---|---|---|---|", ...rows.map((r) => `| ${r.name} | ${r.voice} | ${r.mode} | ${r.ok ? r.mean : "—"} | ${r.ok ? r.min : "—"} | ${r.ok ? `${r.passing}/${r.of}` : r.why} | ${r.seconds ? r.seconds.toFixed(1) : "—"} |`)].join("\n");
console.log(`\n${table}`);
writeFileSync(join(out, "lab.json"), JSON.stringify({ at: new Date().toISOString(), rows }, null, 2) + "\n");
writeFileSync(join(out, "lab.md"), table + "\n");
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## voice lab\n\n${table}\n`, { flag: "a" });
