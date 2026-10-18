#!/usr/bin/env node
/**
 * Ollama client — the local fallback for every Gemini call, and the prep
 * stage's readiness check.
 *
 * callOllama(messages, opts) takes EXACTLY what callGemini(messages, opts)
 * takes (OpenAI-style messages; string content or [{type:"text"}|
 * {type:"image_url"}] parts) and returns what it returns: the model's
 * parsed JSON object, or { content } when the answer is not JSON, or
 * { source: "ollama", error, detail } on failure. The caller sends the SAME
 * prompt, so the answer has the same schema whichever provider produced it
 * (src/lib/llm.js routes between them).
 *
 *   endpoint  POST $OLLAMA_URL/api/generate (default http://127.0.0.1:11434)
 *   format    "json" (JSON-constrained decoding)
 *   models    text:   $OLLAMA_TEXT_MODEL   (default qwen2.5:7b)
 *             images: $OLLAMA_VISION_MODEL (default qwen2.5vl:3b) — a
 *             request carrying frames goes to a vision model, because
 *             qwen2.5:7b cannot see images; a review answered by a model
 *             that cannot see the frames would not be a review.
 *
 * Images are downscaled (long side $OLLAMA_IMAGE_MAX, default 512 px, JPEG)
 * before they are sent: CPU inference cost grows with pixels, and the
 * frame reviews send 6-13 frames per call. In the prompt each image is
 * announced where it sat ("[image 3]") so a frame keeps its caption.
 *
 * Where this stops: a 7B / 3B model on a CPU runner is slower and weaker
 * than Gemini. The pipeline's gates (checkVisual, the challenger, the beat
 * check, the reviews) judge its output exactly as they judge Gemini's.
 *
 * CLI:
 *   node scripts/ollama-client.cjs --check [--model qwen2.5:7b] [--timeout 60]
 *     waits for /api/tags, verifies the model is pulled, sends one warm-up
 *     generation (loads the weights into memory). Exit 0 = ready.
 */

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const TEXT_MODEL = () => process.env.OLLAMA_TEXT_MODEL || "qwen2.5:7b";
const VISION_MODEL = () => process.env.OLLAMA_VISION_MODEL || "qwen2.5vl:3b";
const IMAGE_MAX = () => Number(process.env.OLLAMA_IMAGE_MAX || 512);

// node:http, not fetch(): Node's fetch (undici) aborts any response whose
// headers take longer than 300 s (UND_ERR_HEADERS_TIMEOUT), and a
// non-streamed /api/generate sends its headers only when the answer is
// complete — run 36428496329 lost every plan to it (qwen2.5:7b on a CPU
// runner takes longer than 5 minutes). The only limit here is timeoutMs.
const http = require("node:http");
const https = require("node:https");
function request(path, body, timeoutMs = 120000, { base = OLLAMA_URL, auth = null } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${base}${path}`);
    const payload = body ? JSON.stringify(body) : null;
    const headers = { ...(body ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}), ...(auth ? { authorization: `Bearer ${auth}` } : {}) };
    const req = (url.protocol === "https:" ? https : http).request(url, {
      method: body ? "POST" : "GET",
      headers: Object.keys(headers).length ? headers : undefined,
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        clearTimeout(timer);
        const text = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(Object.assign(new Error(`${path} → HTTP ${res.statusCode}: ${text.slice(0, 300)}`), { status: res.statusCode }));
        try { resolve(text ? JSON.parse(text) : {}); } catch (e) { reject(new Error(`${path} → unparseable answer: ${text.slice(0, 200)}`)); }
      });
      res.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
    const timer = setTimeout(() => {
      const e = new Error(`${path} → no answer in ${Math.round(timeoutMs / 1000)} s`);
      e.name = "AbortError";
      req.destroy(e);
    }, timeoutMs);
    req.on("error", (e) => { clearTimeout(timer); reject(e); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitForServer(timeoutS = 60) {
  const deadline = Date.now() + timeoutS * 1000;
  let last;
  while (Date.now() < deadline) {
    try {
      return await request("/api/tags", null, 5000);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Ollama at ${OLLAMA_URL} not reachable after ${timeoutS}s: ${last?.message}`);
}

async function generate(prompt, { model = DEFAULT_MODEL, format, options, images } = {}) {
  const r = await request("/api/generate", { model, prompt, images, stream: false, format, options }, 600000);
  return r.response;
}

// ── The Gemini-shaped call ─────────────────────────────────────────

async function shrink(b64, max = IMAGE_MAX()) {
  try {
    const sharp = require("sharp");
    const out = await sharp(Buffer.from(b64, "base64"))
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 }).toBuffer();
    return out.toString("base64");
  } catch {
    return b64;
  }
}

// OpenAI-style messages -> one prompt + its images, in order.
async function messagesToPrompt(messages, max = IMAGE_MAX()) {
  const parts = [], images = [];
  for (const m of messages || []) {
    const content = typeof m.content === "string" ? [{ type: "text", text: m.content }] : (m.content || []);
    for (const c of content) {
      if (c && c.type === "text") parts.push(String(c.text));
      else if (c && c.type === "image_url") {
        const url = String(c.image_url?.url || "");
        images.push(await shrink(url.replace(/^data:[^;]+;base64,/, ""), max));
        parts.push(`[image ${images.length}]`);
      }
    }
  }
  return { prompt: parts.join("\n"), images };
}

function parseAnswer(text) {
  const cleaned = String(text || "").trim()
    .replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { content: String(text || "") };
  }
}

// Per-call cap = a share of the job's budget (JOB_TIMEOUT_MIN, set by the
// workflow): plan 40%, challenger 15%, vision 20%. A 20-min job caps a
// plan call at 8 min; a 90-min job at 36. Without JOB_TIMEOUT_MIN
// (local runs) the cap is OLLAMA_TIMEOUT_MS or 30 min.
const CAP_SHARE = { plan: 0.4, challenger: 0.15, vision: 0.2 };
function callCapMs(kind) {
  const job = Number(process.env.JOB_TIMEOUT_MIN || 0);
  if (!job) return Number(process.env.OLLAMA_TIMEOUT_MS || 1800000);
  return Math.round(job * 60000 * (CAP_SHARE[kind] || CAP_SHARE.vision));
}

// Models pulled in the background (.github/actions/ollama background: true)
// are not usable until /tmp/ollama-ready exists: a local call waits for it,
// inside its own time cap. A failed pull fails the call at once.
async function waitForModels(maxMs) {
  const f = process.env.OLLAMA_READY_FILE;
  if (!f) return { ok: true, waited: 0 };
  const fs = require("node:fs");
  const t0 = Date.now();
  while (!fs.existsSync(f)) {
    if (fs.existsSync(f.replace(/ready$/, "failed"))) return { ok: false, why: `background model pull failed: ${fs.readFileSync(f.replace(/ready$/, "failed"), "utf8").trim()}` };
    if (Date.now() - t0 > maxMs) return { ok: false, why: `models still pulling after ${Math.round(maxMs / 1000)}s` };
    await new Promise((r) => setTimeout(r, 3000));
  }
  const waited = Date.now() - t0;
  if (waited > 3000) console.error(`[ollama] waited ${Math.round(waited / 1000)}s for the background model pull`);
  return { ok: true, waited };
}

async function callOllama(messages, opts = {}) {
  const { maxTokens = 1200, temperature = 0 } = opts;
  const { prompt, images } = await messagesToPrompt(messages);
  const cap = Number(opts.timeoutMs || callCapMs(opts.capKind || (images.length ? "vision" : "plan")));
  const ready = await waitForModels(cap * 0.6);
  if (!ready.ok) return { source: "ollama", error: "not_ready", detail: ready.why };
  const timeoutMs = Math.max(30000, cap - ready.waited);
  // opts.ollamaModel: a caller-chosen local model (the challenger uses
  // qwen2.5:14b); otherwise vision for frames, text for the rest.
  const model = opts.ollamaModel || (images.length ? VISION_MODEL() : TEXT_MODEL());
  // Context: prompt (~3.2 chars/token) + images + the answer, rounded up.
  // Images cost far more than 400 tokens each on the vision model: run
  // 36445183210's beat check (6 frames) needed 6152 tokens against a 6144
  // context and was refused. ~1000 per image, and 25% headroom overall.
  const promptTokens = Math.ceil(prompt.length / 3.2) + images.length * 1000;
  const numCtx = Math.min(32768, Math.max(8192, Math.ceil(((promptTokens + maxTokens) * 1.25 + 256) / 1024) * 1024));
  const t0 = Date.now();
  try {
    const r = await request("/api/generate", {
      model, prompt, images: images.length ? images : undefined, format: "json", stream: false,
      options: { temperature, num_predict: maxTokens, num_ctx: numCtx },
      ...(opts.keepAlive !== undefined ? { keep_alive: opts.keepAlive } : {}),
    }, timeoutMs);
    console.error(`[ollama] ${model}: ${r.prompt_eval_count ?? "?"} prompt + ${r.eval_count ?? "?"} answer tokens, ${images.length} image(s), ctx ${numCtx}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (!String(r.response || "").trim()) return { source: "ollama", error: "empty_answer", detail: `${model} returned nothing`, model };
    return parseAnswer(r.response);
  } catch (e) {
    const timedOut = e.name === "AbortError";
    return { source: "ollama", error: timedOut ? "timed_out" : "failed", detail: timedOut ? `no answer from ${model} in ${timeoutMs / 1000}s` : String(e.cause?.code || e.message || e).slice(0, 300), model };
  }
}

// ── Ollama Cloud ───────────────────────────────────────────────────
// Owner, 2026-10-17: "using OLLAMA as well would make sense for our provider". The local server above runs 3B/7B models on a CPU runner, and boards
// run on it are not evidence (planner / props / verifier quality collapses). Ollama's hosted API (https://ollama.com, OLLAMA_API_KEY) serves the large
// open models — gpt-oss:120b for text, qwen3-vl:235b for images — with the same request shape, so it is the SECOND provider (src/lib/llm.js: Gemini ->
// Ollama Cloud -> OpenRouter -> Groq -> local Ollama). Direct-API model names carry no "-cloud" suffix. Without a key it answers { error: "no_key" } at
// once and the chain moves on. Errors: 429 -> quota_exhausted (the free tier has hourly / weekly limits), 401/403 -> unauthorized, 404 -> model_not_found.
const CLOUD_URL = () => (process.env.OLLAMA_CLOUD_URL || "https://ollama.com").replace(/\/$/, "");
const CLOUD_TEXT_MODEL = () => process.env.OLLAMA_CLOUD_TEXT_MODEL || "gpt-oss:120b";
const CLOUD_VISION_MODEL = () => process.env.OLLAMA_CLOUD_VISION_MODEL || "qwen3-vl:235b";
const cloudKey = () => String(process.env.OLLAMA_API_KEY || "").trim();
const hasCloudKey = () => !!cloudKey();
// OLLAMA_FIRST=1 (workflow input ollama_first; owner, 2026-10-18: "use Ollama for that because it's practically free"): Ollama Cloud is asked FIRST by every
// model chain — callGemini's direct callers, callLLM, both image checkers — and Gemini becomes its fallback. Off without a key.
const ollamaFirst = () => /^(1|true|on|yes)$/i.test(String(process.env.OLLAMA_FIRST || "").trim()) && hasCloudKey();
function cloudError(e) {
  const s = e && e.status;
  return s === 429 ? "quota_exhausted" : s === 401 || s === 403 ? "unauthorized" : s === 404 ? "model_not_found" : e && e.name === "AbortError" ? "timed_out" : s >= 500 ? "unavailable" : "failed";
}

/** Same messages and return shape as callOllama / callGemini; source "ollama-cloud" on failure. */
async function callOllamaCloud(messages, opts = {}) {
  if (!hasCloudKey()) return { source: "ollama-cloud", error: "no_key", detail: "OLLAMA_API_KEY is not set" };
  const { maxTokens = 1200, temperature = 0 } = opts;
  // a hosted vision model reads detail a CPU model could not afford: 1024 px, not 512
  const { prompt, images } = await messagesToPrompt(messages, Number(process.env.OLLAMA_CLOUD_IMAGE_MAX || 1024));
  const model = opts.ollamaCloudModel || (images.length ? CLOUD_VISION_MODEL() : CLOUD_TEXT_MODEL());
  const timeoutMs = Number(opts.cloudTimeoutMs || process.env.OLLAMA_CLOUD_TIMEOUT_MS || 240000);
  const t0 = Date.now();
  try {
    // /api/chat: a reasoning model (gpt-oss) answers in message.content and keeps its thinking in message.thinking. num_predict leaves room for both.
    const r = await request("/api/chat", {
      model, stream: false, format: "json",
      messages: [{ role: "user", content: prompt, ...(images.length ? { images } : {}) }],
      options: { temperature, num_predict: Math.max(maxTokens, 1024) * 4 },
    }, timeoutMs, { base: CLOUD_URL(), auth: cloudKey() });
    const text = String(r.message?.content || "").trim();
    console.error(`[ollama-cloud] ${model}: ${r.prompt_eval_count ?? "?"} prompt + ${r.eval_count ?? "?"} answer tokens, ${images.length} image(s), ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (!text) return { source: "ollama-cloud", error: "empty_answer", detail: `${model} returned nothing`, model };
    return parseAnswer(text);
  } catch (e) {
    return { source: "ollama-cloud", error: cloudError(e), detail: String(e.cause?.code || e.message || e).slice(0, 300), model };
  }
}

async function check(model, timeoutS) {
  const tags = await waitForServer(timeoutS);
  const names = (tags.models || []).map((m) => m.name);
  if (!names.includes(model)) {
    throw new Error(`model ${model} not present on ${OLLAMA_URL} (have: ${names.join(", ") || "none"})`);
  }
  const t0 = Date.now();
  const out = await generate("Reply with the single word: ready", { model, options: { num_predict: 5 } });
  console.log(`Ollama ready: ${OLLAMA_URL}, model ${model}, warm-up ${((Date.now() - t0) / 1000).toFixed(1)}s → "${String(out).trim()}"`);
}

module.exports = { waitForModels, generate, waitForServer, callOllama, callOllamaCloud, hasCloudKey, ollamaFirst, cloudError, messagesToPrompt, callCapMs, DEFAULT_MODEL, OLLAMA_URL, request, CLOUD_URL, cloudKey };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  // --cloud-check: is the key valid, and are the configured cloud models served? (exit 0 = yes, 3 = no key, 1 = not usable)
  if (argv.includes("--cloud-check")) {
    (async () => {
      if (!hasCloudKey()) { console.log("ollama-cloud: no OLLAMA_API_KEY — the chain skips it"); process.exit(3); }
      const tags = await request("/api/tags", null, 20000, { base: CLOUD_URL(), auth: cloudKey() });
      const names = (tags.models || []).map((m) => m.name || m.model);
      for (const m of [CLOUD_TEXT_MODEL(), CLOUD_VISION_MODEL()]) console.log(`ollama-cloud: ${m} ${names.some((n) => n === m || n === `${m}-cloud` || n.startsWith(`${m}`)) ? "served" : `NOT in /api/tags (have: ${names.slice(0, 30).join(", ")})`}`);
      const r = await callOllamaCloud([{ role: "user", content: 'Answer with JSON {"ok": true} and nothing else.' }], { maxTokens: 50 });
      console.log(`ollama-cloud: answer ${JSON.stringify(r).slice(0, 200)}`);
      process.exit(r && r.ok === true ? 0 : 1);
    })().catch((e) => { console.error(`::error::ollama-cloud: ${e.message}`); process.exit(1); });
    return;
  }
  if (!argv.includes("--check")) {
    console.error("Usage: node scripts/ollama-client.cjs --check [--model <name>] [--timeout <s>]");
    process.exit(2);
  }
  check(flag("--model", DEFAULT_MODEL), Number(flag("--timeout", 60))).catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
