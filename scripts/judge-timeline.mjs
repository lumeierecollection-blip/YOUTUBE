#!/usr/bin/env node
/**
 * judge-timeline — does the same audio read differently the first time the model hears it than a few minutes later?
 *
 *   node scripts/judge-timeline.mjs --audio <mp3> --srt <srt> [--n 20] [--every 15000]
 *
 * Judge lab 38059795370: judged three times in a row, ch26 and ch49 read worse the FIRST time (6.56, 7.25) than the second and third (8, 8), with a one-off
 * nonce on every request. This asks ONE reading every `every` ms for `n` readings, through the production ask() (same prompt, same model, same nonce), and
 * prints each reading's mean and whether it would pass alone, so a cold-to-warm shift (or its absence) shows. Reports only; changes nothing.
 */
import { readFileSync } from "node:fs";
import { cuesOf, PROMPT, ask, MODELS } from "./narration-judge.mjs";

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const audio = arg("audio"), srt = arg("srt"), N = Number(arg("n", 20)), EVERY = Number(arg("every", 15000));
const cues = cuesOf(readFileSync(srt, "utf8")), b64 = readFileSync(audio).toString("base64");
const name = audio.split("/").pop().slice(0, 40);
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const started = Date.now();
  try {
    const res = await ask(b64, PROMPT(cues), { pin: MODELS[0] });
    const ss = res.out?.sentences || [];
    const sc = cues.map((_, k) => Number(ss.find((x) => Number(x.index) === k)?.score ?? NaN));
    const mean = sc.reduce((a, b) => a + b, 0) / sc.length;
    console.log(`${name} t+${String(Math.round((started - t0) / 1000)).padStart(3)}s reading ${String(i + 1).padStart(2)}: mean ${mean.toFixed(2)} [${sc.join(" ")}] ${sc.every((x) => x >= 7) ? "pass" : "FAIL"}`);
  } catch (e) { console.log(`${name} t+${Math.round((started - t0) / 1000)}s reading ${i + 1}: error ${e.message}`); }
  const wait = EVERY - (Date.now() - started);
  if (wait > 0 && i < N - 1) await new Promise((r) => setTimeout(r, wait));
}
