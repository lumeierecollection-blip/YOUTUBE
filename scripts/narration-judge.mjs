#!/usr/bin/env node
/**
 * narration-judge — Gemini LISTENS to the voiceover, sentence by sentence (owner, 2026-10-10: "THE VOICE IS ROBOTIC").
 *
 *   node scripts/narration-judge.mjs --audio <narration.mp3> --srt <narration.srt> [--out <json>]
 *
 * Robotic, defined: a flat pitch contour across the sentence, uniform stress on every word, no breath, mechanical even pacing,
 * audible vocoder / metallic artifacts. For every sentence Gemini answers SOUNDS (HUMAN | SYNTHETIC), INTONATION (VARIED | FLAT)
 * and PAUSES (NATURAL | WRONG). A sentence that is SYNTHETIC or FLAT fails; ANY failing sentence fails the video (no tolerance:
 * the fix is the voice, never the gate). It hears the narration file itself, not the mixed video (no music bed, no SFX).
 *
 * THE VERDICT IS THE MEDIAN OF NINE READINGS (owner asked for three, 2026-10-10; three was measured and still flipped — see JUDGE_RUNS below). One reading of the same audio swung 5.44 / 6.89 / 7.67 (board 38054686824 stability lab:
 * the same mp3 passed or failed depending on when it was judged, temperature 0 notwithstanding). So the file is judged JUDGE_RUNS (9) times, all on
 * the SAME model (a second model is a second instrument), and every sentence takes the median score and the majority SOUNDS / INTONATION / PAUSES
 * of the readings. The bar is unchanged: a sentence whose MEDIAN is below 7, or whose majority is SYNTHETIC or FLAT, still fails, and any failing
 * sentence still fails the video. 7, 5, 7 passes (one bad reading of good audio is not a defect); 5, 7, 5 fails. Fewer than three readings is "could
 * not run" (exit 3), never a verdict from one noisy reading.
 *
 * Exit 0 = every sentence passes. Exit 1 = a sentence reads as synthetic (listed). Exit 3 = could not run.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The instrument. gemini-3.5-flash was FIRST in this chain and never answered: the probe (voice-lab "probe", run 38058109444) got HTTP 429
// RESOURCE_EXHAUSTED from it on every key, for a one-word text prompt as much as for audio - its quota on these keys is spent, not misconfigured.
// Left first it would also make the instrument depend on the day: when its quota resets it would judge, and the same audio would be read by a
// different model than yesterday's. The bar (7) was set on gemini-3.5-flash-lite, which is what has judged every board, so it is first; it is not
// shown equivalent to a model that has never answered. The preview model is the failover only.
export const MODELS = (process.env.NARRATION_JUDGE_MODELS || "gemini-3.5-flash-lite,gemini-3.1-flash-lite-preview").split(",").map((m) => m.trim()).filter(Boolean);
export const keys = () => [...new Set(["GEMINI_API_KEY_4", "GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"].map((k) => process.env[k]).filter(Boolean))];

export function cuesOf(srt) {
  return String(srt).replace(/\r/g, "").split(/\n\n+/).map((b) => b.split("\n")).filter((l) => l.length >= 3 && /-->/.test(l[1]))
    .map((l) => { const [a, z] = l[1].split("-->").map((t) => { const [h, m, s] = t.trim().replace(",", ".").split(":").map(Number); return h * 3600 + m * 60 + s; }); return { start: a, end: z, text: l.slice(2).join(" ").trim() }; });
}

export const PROMPT = (cues) => `You are a voice director judging a documentary narration. Listen to the WHOLE audio file. It is read in these sentences (times in seconds):
${cues.map((c, i) => `${i}. [${c.start.toFixed(1)}-${c.end.toFixed(1)}] "${c.text}"`).join("\n")}

Robotic means ANY of: a flat pitch contour across the sentence, uniform stress on every word, no breath, mechanical even pacing, audible vocoder or metallic artifacts.
Be a strict listener: most text-to-speech, including good neural voices, is SYNTHETIC. Give each sentence a HUMAN-LIKENESS score: 10 = indistinguishable from a recorded professional human narrator; 7 = a person reading, with only the faintest trace of synthesis; 5 = clearly a good text-to-speech voice (even pacing, predictable stress, no breath); 3 = obviously robotic; 1 = vocoder. Then: sounds HUMAN (score 7 or more) or SYNTHETIC (6 or less); intonation VARIED or FLAT; pauses NATURAL or WRONG.
Respond ONLY with JSON: {"sentences":[{"index":<n>,"score":<1-10>,"sounds":"HUMAN"|"SYNTHETIC","intonation":"VARIED"|"FLAT","pauses":"NATURAL"|"WRONG","why":"<one short line>"}]} — one entry per sentence, by index.`;

/** One reading. `pin` = a model to stay on (the three readings must come from one instrument). `tried` collects every failure (model, key #, why). */
export async function ask(audioB64, prompt, { pin = null, tried = [] } = {}) {
  const ks = keys();
  for (const model of pin ? [pin] : MODELS) for (const [ki, key] of ks.entries()) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "audio/mpeg", data: audioB64 } }] }], generationConfig: { temperature: 0, responseMimeType: "application/json", ...(SEED !== null ? { seed: SEED } : {}) } }),
        signal: AbortSignal.timeout(180000),
      });
      const j = await r.json();
      if (j.error) { tried.push({ model, key: ki + 1, status: j.error.code, why: String(j.error.status || ""), message: String(j.error.message).slice(0, 160) }); continue; }
      return { model, out: JSON.parse(j.candidates[0].content.parts[0].text) };
    } catch (e) { tried.push({ model, key: ki + 1, status: null, why: "exception", message: String(e.message).slice(0, 160) }); }
  }
  throw new Error(tried.length ? `${tried[tried.length - 1].model}: ${tried[tried.length - 1].status} ${tried[tried.length - 1].message}` : "no Gemini key configured");
}

// An optional fixed sampling seed (NARRATION_JUDGE_SEED): the same audio asked the same way at temperature 0 still read differently from call to call
// (board 38054686824); whether a seed removes that is measured by scripts/judge-readings.mjs before it is relied on.
const SEED = process.env.NARRATION_JUDGE_SEED !== undefined && process.env.NARRATION_JUDGE_SEED !== "" ? Number(process.env.NARRATION_JUDGE_SEED) : null;
// NINE readings, not three (owner asked for three; three was measured and failed: 4 of 8 channels still flipped, board 38054686824 judge lab 38058404181).
// Raw readings of one file (lab 38058711261, 8 each, gemini-3.5-flash-lite): good audio reads as a uniform "5" in about 1 reading in 8 to 1 in 4
// (ch49: 1/8 and 2/8; ch9 1/8), and a borderline file scatters around the bar (ch10: 8 different readings in 8). A median of 3 lets one such reading in 4
// decide ~15% of the time; a median of 9 ~2%. The bar is untouched: the median still has to be 7 for a sentence to pass.
export const JUDGE_RUNS = Number(process.env.NARRATION_JUDGE_RUNS) || 9;
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); const n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
const majority = (xs, yes) => xs.filter((x) => String(x).toUpperCase() === yes).length * 2 > xs.length;

/**
 * Combine the readings of one file (each `runs[i]` = a Map index -> verdict) into one row per cue: median score, majority labels. Pure.
 * A sentence PASSES when the median score is 7+ AND the majority say HUMAN and VARIED; the bar is the same as for one reading.
 */
export function medianRows(cues, runs) {
  return cues.map((c, i) => {
    const vs = runs.map((r) => r.get(i)).filter(Boolean);
    const scores = vs.map((v) => Number(v.score));
    const med = median(scores);
    const nearest = vs.reduce((best, v) => (Math.abs(Number(v.score) - med) < Math.abs(Number(best.score) - med) ? v : best), vs[0]);
    return {
      index: i, text: c.text, score: med, scores,
      sounds: majority(vs.map((v) => v.sounds), "HUMAN") ? "HUMAN" : "SYNTHETIC",
      intonation: majority(vs.map((v) => v.intonation), "VARIED") ? "VARIED" : "FLAT",
      pauses: majority(vs.map((v) => v.pauses), "NATURAL") ? "NATURAL" : "WRONG",
      why: nearest?.why || "",
    };
  });
}
export const isFailing = (r) => String(r.sounds).toUpperCase() !== "HUMAN" || String(r.intonation).toUpperCase() !== "VARIED" || !(Number(r.score) >= 7);

/** JUDGE_RUNS readings of one file, on one model. Returns { model, runs: Map[], tried } or throws. */
export async function judgeAudio(audioB64, cues, { runs = JUDGE_RUNS, ask: askFn = ask, parallel = 4 } = {}) {
  const tried = [], got = [], prompt = PROMPT(cues);
  const valid = (res) => { const m = new Map((res.out?.sentences || []).map((v) => [Number(v.index), v])); return cues.every((_, i) => m.has(i)) ? m : null; };
  const one = async (pin) => {
    const res = await askFn(audioB64, prompt, { pin, tried }).catch((e) => ({ error: e }));
    if (res.error) return { error: res.error };
    const m = valid(res);
    if (!m) { tried.push({ model: res.model, key: null, status: null, why: "incomplete", message: `verdicts for ${(res.out?.sentences || []).length}/${cues.length} sentences` }); return { model: res.model }; }
    return { model: res.model, m };
  };
  // The first reading finds the instrument (the first model in the chain that answers); every other reading stays on it, a few at a time.
  let model = null, spent = 0;
  for (; spent < 3 && !model; spent++) { const r = await one(null); if (r.error) { if (spent === 2) throw r.error; continue; } model = r.model; if (r.m) got.push(r.m); }
  if (!model) throw new Error("no model answered");
  const budget = runs + 4;
  while (got.length < runs && spent < budget) {
    const n = Math.min(parallel, runs - got.length, budget - spent);
    const batch = await Promise.all(Array.from({ length: n }, () => one(model)));
    spent += n;
    for (const r of batch) if (r.m) got.push(r.m);
  }
  if (got.length < runs) throw new Error(`only ${got.length}/${runs} complete readings${tried.length ? ` (last: ${tried[tried.length - 1].message})` : ""}`);
  return { model, runs: got.slice(0, runs), tried };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  const audio = arg("audio"), srt = arg("srt"), out = arg("out");
  if (!audio || !srt || !existsSync(audio) || !existsSync(srt)) { console.error("::error::narration judge: --audio and --srt must exist"); process.exit(3); }
  if (!keys().length) { console.error("::error::narration judge cannot run: no Gemini key"); process.exit(3); }
  const cues = cuesOf(readFileSync(srt, "utf8"));
  let res;
  try { res = await judgeAudio(readFileSync(audio).toString("base64"), cues); } catch (e) { console.error(`::error::narration judge unavailable: ${e.message}`); process.exit(3); }
  const rows = medianRows(cues, res.runs);
  const failing = rows.filter(isFailing);
  for (const r of rows) console.log(`[narration] ${r.index}: median score ${r.score} (readings ${r.scores.join(", ")}), ${r.sounds}, intonation ${r.intonation}, pauses ${r.pauses} — ${r.why || ""} — "${r.text.slice(0, 60)}"`);
  // Models the chain skipped on the way (and why): the record of which instrument judged, and which never answered.
  const skipped = [...new Map(res.tried.map((t) => [`${t.model}|${t.status}|${t.why}`, t])).values()];
  if (skipped.length) console.log(`[narration] judged on ${res.model}; other attempts failed: ${skipped.map((t) => `${t.model} ${t.status ?? ""} ${t.why} "${t.message}"`).join(" | ")}`);
  if (out) writeFileSync(out, JSON.stringify({ checkedAt: new Date().toISOString(), model: res.model, runs: res.runs.length, audio, sentences: rows, failing: failing.map((r) => r.index), skipped }, null, 2) + "\n");
  if (failing.length) { console.error(`::error::narration judge: ${failing.length}/${rows.length} sentence(s) read as synthetic or flat on the median of ${res.runs.length} readings (${failing.map((r) => r.index).join(", ")})`); process.exit(1); }
  console.log(`[narration] PASS: ${rows.length}/${rows.length} sentences read as a person speaking, median of ${res.runs.length} readings (${res.model})`);
  process.exit(0);
}
