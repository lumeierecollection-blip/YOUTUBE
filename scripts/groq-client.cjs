#!/usr/bin/env node
/**
 * Groq client — the second tier of the model chain (Gemini → Groq → Ollama,
 * src/lib/llm.js).
 *
 * callGroq(messages, opts) takes what callGemini takes (OpenAI-style
 * messages, text or image_url parts) and returns what it returns: the
 * parsed JSON answer, or { content } when the answer is not JSON, or
 * { source: "groq", error, detail } on failure:
 *   429 / rate limit / quota   -> "quota_exhausted"
 *   5xx / timeout / network    -> "unavailable"
 *   400 / 401 / 403 / 404      -> "hard_error" (bad key, retired model,
 *                                 too many images, ...)
 *   no GROQ_API_KEY            -> "no_key"
 * One attempt per request — no retry: the caller falls to Ollama.
 *
 *   endpoint  https://api.groq.com/openai/v1/chat/completions
 *   models    text $GROQ_TEXT_MODEL (default openai/gpt-oss-120b)
 *             images $GROQ_VISION_MODEL (default qwen/qwen3.8-27b)
 *   format    response_format { type: "json_object" }
 *
 * The llama-3.3-70b-versatile / llama-3.2-90b-vision-preview defaults were
 * replaced 2026-09-28: the account's key answers 404 model_not_found for
 * both. GET /openai/v1/models on that key lists gpt-oss-120b/20b (text) and
 * qwen/qwen3.8-27b (text + image); both answered a json_object call with 200.
 *
 * Where this stops: a Groq vision model takes a fixed number of images per
 * request — qwen/qwen3.8-27b answers "400 ... supports up to 3 images".
 * GROQ_MAX_IMAGES (default 3) must match GROQ_VISION_MODEL. Callers with
 * more frames split them (src/lib/llm.js groqBatch); a single call over the
 * cap is not sent — "hard_error" (too_many_images), the caller falls to
 * Ollama.
 */
const https = require("node:https");

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const TEXT_MODEL = () => process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-120b";
const VISION_MODEL = () => process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
const MAX_IMAGES = Math.max(1, Number(process.env.GROQ_MAX_IMAGES || 3));

const fail = (error, detail) => ({ source: "groq", error, detail: String(detail || "").slice(0, 300) });

function post(body, key, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(ENDPOINT, {
      method: "POST",
      // A fresh connection per request: with Node's default keep-alive agent
      // the SECOND request in a process reused a socket Groq had closed and
      // died with "read ECONNRESET" (seen 2026-09-28 on every 2nd batch).
      agent: false,
      headers: { connection: "close", "content-type": "application/json", authorization: `Bearer ${key}`, "content-length": Buffer.byteLength(payload) },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => { clearTimeout(timer); resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }); });
      res.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
    const timer = setTimeout(() => { const e = new Error(`no answer in ${Math.round(timeoutMs / 1000)} s`); e.name = "AbortError"; req.destroy(e); }, timeoutMs);
    req.on("error", (e) => { clearTimeout(timer); reject(e); });
    req.write(payload);
    req.end();
  });
}

function parseAnswer(text) {
  const cleaned = String(text || "").trim()
    .replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { return { content: String(text || "") }; }
}

async function callGroq(messages, opts = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return fail("no_key", "GROQ_API_KEY not set");
  const images = (messages || []).flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((c) => c && c.type === "image_url").length;
  if (images > MAX_IMAGES) return fail("hard_error", `too_many_images: ${images} frames, Groq vision takes at most ${MAX_IMAGES}`);
  const model = opts.groqModel || (images ? VISION_MODEL() : TEXT_MODEL());
  const body = {
    model, messages,
    temperature: opts.temperature ?? 0,
    max_tokens: Math.min(Number(opts.maxTokens || 1200), 32768),
    response_format: { type: "json_object" },
  };
  const t0 = Date.now();
  let res;
  try {
    res = await post(body, key, Number(opts.groqTimeoutMs || 120000));
  } catch (e) {
    return fail("unavailable", `${model}: ${e.message || e}`);
  }
  let parsed = null;
  try { parsed = JSON.parse(res.text); } catch {}
  if (res.status < 200 || res.status >= 300 || parsed?.error) {
    const msg = parsed?.error?.message || res.text.slice(0, 200);
    const kind = res.status === 429 || /rate.?limit|quota|tokens per/i.test(msg) ? "quota_exhausted"
      : res.status >= 500 ? "unavailable" : "hard_error";
    // The wait hint sits at the END of Groq's 429 message; keep it past the
    // 300-char detail cut so the batch pacer (src/lib/llm.js) can read it.
    const hint = (msg.match(/try again in [\dm.]+s/i) || [""])[0];
    return fail(kind, `${res.status} ${model}: ${hint ? `[${hint}] ` : ""}${msg}`);
  }
  const content = parsed?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return fail("bad_response", `${model}: no message in the answer`);
  console.error(`[groq] ${model}: ${parsed.usage?.prompt_tokens ?? "?"} prompt + ${parsed.usage?.completion_tokens ?? "?"} answer tokens, ${images} image(s), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return parseAnswer(content);
}

module.exports = { callGroq, TEXT_MODEL, VISION_MODEL, MAX_IMAGES };
