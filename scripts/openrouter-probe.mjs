#!/usr/bin/env node
/**
 * openrouter-probe.mjs — the OpenRouter checks, run on a CI runner (this sandbox's proxy blocks openrouter.ai).
 *
 *   1. catalog     the account-visible model list: the defaults, and every audio-input model
 *   2. text gate   one text call through the REAL chain (src/lib/llm.js), Gemini forced to fail
 *   3. image gate  one identity check through the REAL verifier, Gemini forced to fail
 *   4. flip rate   the same image N times through two image gates, each answer from OpenRouter
 *   5. audio       one mp3 to an audio-input model, if the catalog has one
 *
 * Forcing Gemini to fail: the workflow sets GEMINI_API_KEY_1 to a key that is not valid, so Gemini
 * answers hard_error (not a 429). No Groq or Ollama key is set, so the only provider left after
 * Gemini is OpenRouter; any answer printed with provider "openrouter" came from OpenRouter.
 *
 *   node scripts/openrouter-probe.mjs --image <identity.jpg> --audio <voiceover.mp3> [--n 9]
 *
 * Reports only. It changes nothing and writes no cache (useCache: false everywhere).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { callLLMWithProvenance } from "../src/lib/llm.js";

const require = createRequire(import.meta.url);
const { verifyCutoutImage } = require("./verify-cutout-image.cjs");
const { verifyPersonImage } = require("./verify-person-image.cjs");
const { callOpenRouter, TEXT_MODEL, VISION_MODEL } = require("./openrouter-client.cjs");

const argv = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const IMAGE = argv("image", null), AUDIO = argv("audio", null), N = Number(argv("n", 9));
const TEXT_DEFAULT = TEXT_MODEL(), VISION_DEFAULT = VISION_MODEL();

const key = process.env.OPENROUTER_API_KEY;
console.log(`OPENROUTER_API_KEY: ${key ? `set (${key.length} characters)` : "NOT SET"}`);
console.log(`defaults: text=${TEXT_DEFAULT} vision=${VISION_DEFAULT}`);

// 1. Catalog. Public endpoint; prices are OpenRouter's own, per token.
const cat = await (await fetch("https://openrouter.ai/api/v1/models")).json();
const models = cat.data || [];
const byId = new Map(models.map((m) => [m.id, m]));
const priceOf = (m) => m
  ? `prompt $${m.pricing?.prompt}/token, completion $${m.pricing?.completion}/token, input=${(m.architecture?.input_modalities || []).join("+")}`
  : "NOT IN CATALOG";
console.log(`\n== 1. catalog: ${models.length} models ==`);
console.log(`  ${TEXT_DEFAULT}: ${priceOf(byId.get(TEXT_DEFAULT))}`);
console.log(`  ${VISION_DEFAULT}: ${priceOf(byId.get(VISION_DEFAULT))}`);
const audioModels = models.filter((m) => (m.architecture?.input_modalities || []).includes("audio"));
console.log(`  audio-input models: ${audioModels.length}`);
for (const m of audioModels) console.log(`    ${m.id}  ${priceOf(m)}`);

// 2. Text gate through the real chain.
console.log("\n== 2. text gate through the real chain (Gemini forced to fail) ==");
const t = await callLLMWithProvenance([{ role: "user", content: 'Reply with only JSON: {"ok": true}' }], { maxTokens: 64, temperature: 0, noCache: true }, "probe-text");
console.log(`  provider=${t.provider} chain=${JSON.stringify(t.chain)} error=${t.error} value=${JSON.stringify(t.value).slice(0, 200)}`);

// 3. Image gate through the real verifier.
if (IMAGE) {
  console.log("\n== 3. image gates through the real verifiers (Gemini forced to fail, no cache) ==");
  const c = await verifyCutoutImage(IMAGE, "Chase Sui", { useCache: false });
  console.log(`  cutout: verdict=${c.verdict} provider=${c.provider} seen=${String(c.seen || "").slice(0, 120)}`);
  const p = await verifyPersonImage(IMAGE, "Chase Sui", { useCache: false });
  console.log(`  person: verdict=${p.verdict} identity=${p.identity ?? "-"} provider=${p.provider ?? "-"} reason=${p.reason ?? "-"}`);

  // 4. Flip rate: N independent answers per gate, each from OpenRouter.
  const flip = async (label, fn, keyOf) => {
    const rows = [];
    for (let i = 0; i < N; i++) rows.push(await fn());
    const counts = {}, providers = {};
    for (const r of rows) {
      counts[keyOf(r)] = (counts[keyOf(r)] || 0) + 1;
      providers[r.provider ?? "none"] = (providers[r.provider ?? "none"] || 0) + 1;
    }
    const modal = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1];
    const flips = rows.length - modal;
    console.log(`  FLIP ${label}: N=${N} verdicts=${JSON.stringify(counts)} providers=${JSON.stringify(providers)} flips=${flips}/${N} (${((100 * flips) / N).toFixed(1)}%)`);
  };
  console.log("\n== 4. flip rate, N runs per gate, OpenRouter only ==");
  await flip("cutout verifier (Chase Sui)", () => verifyCutoutImage(IMAGE, "Chase Sui", { useCache: false }), (r) => r.verdict);
  await flip("person verifier (Chase Sui)", () => verifyPersonImage(IMAGE, "Chase Sui", { useCache: false }), (r) => `${r.verdict}|${r.identity ?? ""}`);
} else {
  console.log("\n== 3-4. skipped: no --image given ==");
}

// 5. Audio input. A different instrument from the Gemini listener: reported, not calibrated against.
console.log("\n== 5. audio input ==");
if (!AUDIO) {
  console.log("  skipped: no --audio given");
} else if (!audioModels.length) {
  console.log("  no audio-input model in the account's catalog: audio judging cannot run on OpenRouter");
} else {
  // Free audio-input models first (no balance needed), then the paid Gemini one. A 402 means the account balance is
  // below the price of audio input (2026-10-10: "requires at least $0.50 in balance for audio"); a free model may still answer.
  const free = audioModels.filter((m) => m.id.endsWith(":free")).map((m) => m.id);
  const paid = audioModels.filter((m) => !m.id.endsWith(":free") && /gemini/i.test(m.id)).map((m) => m.id);
  const b64 = readFileSync(AUDIO).toString("base64");
  const msgs = [{ role: "user", content: [
    { type: "text", text: 'Listen to this voiceover. Is the voice SYNTHETIC or HUMAN? Reply only with JSON {"verdict":"SYNTHETIC" or "HUMAN","reason":"one sentence"}.' },
    { type: "input_audio", input_audio: { data: b64, format: "mp3" } },
  ] }];
  for (const id of [...free.slice(0, 3), ...paid.slice(0, 1)]) {
    const a = await callOpenRouter(msgs, { openrouterModel: id, maxTokens: 200, temperature: 0 });
    console.log(`  model ${id}: ${JSON.stringify(a)}`);
    if (!a || !a.error) { console.log(`  answered by ${id}`); break; }
  }
}
