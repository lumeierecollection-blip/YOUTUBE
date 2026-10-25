#!/usr/bin/env node
/**
 * judge-probe — why does the narration judge never run on its first model?
 *
 *   node scripts/judge-probe.mjs --audio <mp3>
 *
 * For every model in the judge's chain and every configured key (by number, never the value), asks the same one-line question with and without
 * the audio and prints the HTTP status, the API's error status and its message. The judge's old ask() swallowed these; this reports them.
 * Reports only; changes nothing.
 */
import { readFileSync, existsSync } from "node:fs";
import { MODELS, keys } from "./narration-judge.mjs";

const audio = (() => { const i = process.argv.indexOf("--audio"); return i > -1 ? process.argv[i + 1] : null; })();
const b64 = audio && existsSync(audio) ? readFileSync(audio).toString("base64") : null;
const ks = keys();
console.log(`keys configured: ${ks.length}; models: ${MODELS.join(", ")}; audio: ${b64 ? `${(b64.length * 0.75 / 1024).toFixed(0)} KiB` : "none"}`);
const call = async (model, key, parts, cfg = {}) => {
  const t0 = Date.now();
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0, ...cfg } }), signal: AbortSignal.timeout(120000),
    });
    const j = await r.json();
    const ms = Date.now() - t0;
    if (j.error) return `HTTP ${r.status} ${j.error.status || ""} — ${String(j.error.message).replace(/\s+/g, " ").slice(0, 220)} (${ms} ms)`;
    const c = j.candidates?.[0];
    return `OK ${r.status} finish=${c?.finishReason || "?"} out="${String(c?.content?.parts?.[0]?.text || "").replace(/\s+/g, " ").slice(0, 60)}" (${ms} ms)`;
  } catch (e) { return `EXCEPTION ${e.message} (${Date.now() - t0} ms)`; }
};
for (const model of MODELS) {
  for (const [i, key] of ks.entries()) {
    console.log(`[${model}] key ${i + 1} text : ${await call(model, key, [{ text: "Reply with the single word: ok" }])}`);
    if (b64) console.log(`[${model}] key ${i + 1} audio: ${await call(model, key, [{ text: 'Listen. Reply as JSON {"heard": "speech"|"silence"}' }, { inlineData: { mimeType: "audio/mpeg", data: b64 } }], { responseMimeType: "application/json" })}`);
  }
}
