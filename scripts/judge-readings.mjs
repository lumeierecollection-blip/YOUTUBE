#!/usr/bin/env node
/**
 * judge-readings — how noisy is ONE reading of the narration judge, and does a sampling seed remove it?
 *
 *   node scripts/judge-readings.mjs --audio <mp3> --srt <srt> [--n 8]
 *
 * Asks the judge for N raw readings of the same file under each of: no seed, seed 7. Prints each reading's per-sentence scores, whether it would
 * pass alone, and for each condition how many distinct readings came back (1 = the same answer every time). Reports only; changes nothing.
 */
import { readFileSync } from "node:fs";
import { cuesOf, PROMPT } from "./narration-judge.mjs";

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const audio = arg("audio"), srt = arg("srt"), N = Number(arg("n", 8));
const cues = cuesOf(readFileSync(srt, "utf8")), b64 = readFileSync(audio).toString("base64");
const keys = ["GEMINI_API_KEY_4", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"].map((k) => process.env[k]).filter(Boolean);
const model = process.env.NARRATION_JUDGE_MODELS?.split(",")[0] || "gemini-3.5-flash-lite";

async function reading(seed, key) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT(cues) }, { inlineData: { mimeType: "audio/mpeg", data: b64 } }] }], generationConfig: { temperature: 0, responseMimeType: "application/json", ...(seed !== null ? { seed } : {}) } }),
    signal: AbortSignal.timeout(180000),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${j.error.code} ${String(j.error.message).slice(0, 80)}`);
  const ss = JSON.parse(j.candidates[0].content.parts[0].text).sentences || [];
  return cues.map((_, i) => Number(ss.find((x) => Number(x.index) === i)?.score ?? NaN));
}
for (const seed of [null, 7]) {
  const out = [];
  for (let i = 0; i < N; i++) {
    let got = null, err = null;
    for (const k of keys) { try { got = await reading(seed, k); break; } catch (e) { err = e.message; } }
    out.push(got);
    console.log(`seed ${seed === null ? "none" : seed} reading ${i + 1}: ${got ? `[${got.join(" ")}] ${got.every((x) => x >= 7) ? "pass" : "FAIL"}` : `error ${err}`}`);
  }
  const ok = out.filter(Boolean), distinct = new Set(ok.map((g) => g.join(","))).size, pass = ok.filter((g) => g.every((x) => x >= 7)).length;
  console.log(`== ${basename(audio)} seed ${seed === null ? "none" : seed}: ${ok.length} readings, ${distinct} distinct, ${pass} pass / ${ok.length - pass} fail alone\n`);
}
function basename(p) { return p.split("/").pop(); }
