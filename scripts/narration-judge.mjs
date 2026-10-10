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
 * Exit 0 = every sentence passes. Exit 1 = a sentence reads as synthetic (listed). Exit 3 = could not run.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite-preview"];
const keys = () => [...new Set(["GEMINI_API_KEY_4", "GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"].map((k) => process.env[k]).filter(Boolean))];

export function cuesOf(srt) {
  return String(srt).replace(/\r/g, "").split(/\n\n+/).map((b) => b.split("\n")).filter((l) => l.length >= 3 && /-->/.test(l[1]))
    .map((l) => { const [a, z] = l[1].split("-->").map((t) => { const [h, m, s] = t.trim().replace(",", ".").split(":").map(Number); return h * 3600 + m * 60 + s; }); return { start: a, end: z, text: l.slice(2).join(" ").trim() }; });
}

export const PROMPT = (cues) => `You are a voice director judging a documentary narration. Listen to the WHOLE audio file. It is read in these sentences (times in seconds):
${cues.map((c, i) => `${i}. [${c.start.toFixed(1)}-${c.end.toFixed(1)}] "${c.text}"`).join("\n")}

Robotic means ANY of: a flat pitch contour across the sentence, uniform stress on every word, no breath, mechanical even pacing, audible vocoder or metallic artifacts.
Be a strict listener: most text-to-speech, including good neural voices, is SYNTHETIC. Give each sentence a HUMAN-LIKENESS score: 10 = indistinguishable from a recorded professional human narrator; 7 = a person reading, with only the faintest trace of synthesis; 5 = clearly a good text-to-speech voice (even pacing, predictable stress, no breath); 3 = obviously robotic; 1 = vocoder. Then: sounds HUMAN (score 7 or more) or SYNTHETIC (6 or less); intonation VARIED or FLAT; pauses NATURAL or WRONG.
Respond ONLY with JSON: {"sentences":[{"index":<n>,"score":<1-10>,"sounds":"HUMAN"|"SYNTHETIC","intonation":"VARIED"|"FLAT","pauses":"NATURAL"|"WRONG","why":"<one short line>"}]} — one entry per sentence, by index.`;

async function ask(audioB64, prompt) {
  let last = null;
  for (const model of MODELS) for (const key of keys()) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "audio/mpeg", data: audioB64 } }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
        signal: AbortSignal.timeout(180000),
      });
      const j = await r.json();
      if (j.error) { last = `${model}: ${j.error.code} ${String(j.error.message).slice(0, 120)}`; continue; }
      return { model, out: JSON.parse(j.candidates[0].content.parts[0].text) };
    } catch (e) { last = `${model}: ${e.message}`; }
  }
  throw new Error(last || "no Gemini key configured");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  const audio = arg("audio"), srt = arg("srt"), out = arg("out");
  if (!audio || !srt || !existsSync(audio) || !existsSync(srt)) { console.error("::error::narration judge: --audio and --srt must exist"); process.exit(3); }
  if (!keys().length) { console.error("::error::narration judge cannot run: no Gemini key"); process.exit(3); }
  const cues = cuesOf(readFileSync(srt, "utf8"));
  let res;
  try { res = await ask(readFileSync(audio).toString("base64"), PROMPT(cues)); } catch (e) { console.error(`::error::narration judge unavailable: ${e.message}`); process.exit(3); }
  const byIdx = new Map((res.out?.sentences || []).map((v) => [Number(v.index), v]));
  if (!cues.every((_, i) => byIdx.has(i))) { console.error(`::error::narration judge returned ${byIdx.size} verdict(s) for ${cues.length} sentences`); process.exit(3); }
  const rows = cues.map((c, i) => ({ index: i, text: c.text, ...byIdx.get(i) }));
  const failing = rows.filter((r) => String(r.sounds).toUpperCase() !== "HUMAN" || String(r.intonation).toUpperCase() !== "VARIED" || !(Number(r.score) >= 7));
  for (const r of rows) console.log(`[narration] ${r.index}: score ${r.score}, ${r.sounds}, intonation ${r.intonation}, pauses ${r.pauses} — ${r.why || ""} — "${r.text.slice(0, 60)}"`);
  if (out) writeFileSync(out, JSON.stringify({ checkedAt: new Date().toISOString(), model: res.model, audio, sentences: rows, failing: failing.map((r) => r.index) }, null, 2) + "\n");
  if (failing.length) { console.error(`::error::narration judge: ${failing.length}/${rows.length} sentence(s) read as synthetic or flat (${failing.map((r) => r.index).join(", ")})`); process.exit(1); }
  console.log(`[narration] PASS: ${rows.length}/${rows.length} sentences read as a person speaking (${res.model})`);
  process.exit(0);
}
