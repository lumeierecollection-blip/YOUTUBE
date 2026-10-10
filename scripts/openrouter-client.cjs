#!/usr/bin/env node
/**
 * OpenRouter client — the second tier of every model chain: Gemini → OpenRouter → Groq → Ollama.
 * Used by src/lib/llm.js (every callLLM site), scripts/verify-cutout-image.cjs and
 * scripts/verify-person-image.cjs (the image verifiers), and scripts/gate-visual-qa.js.
 *
 * callOpenRouter(messages, opts) takes what callGemini takes (OpenAI-style messages, text or
 * image_url parts) and returns what it returns: the parsed JSON answer, { content } when the answer
 * is not JSON, or { source: "openrouter", error, detail } on failure:
 *   429 / rate limit / quota  -> "quota_exhausted"
 *   5xx / timeout / network   -> "unavailable"
 *   other HTTP errors         -> "hard_error" (bad model id, unsupported input, too large, ...)
 *   no OPENROUTER_API_KEY     -> "no_key"
 * One attempt per request; the caller falls to the next provider.
 *
 *   endpoint  https://openrouter.ai/api/v1/chat/completions
 *   vision    OPENROUTER_VISION_MODEL (default qwen/qwen3.7-plus)
 *   text      OPENROUTER_TEXT_MODEL   (default openai/gpt-oss-120b)
 *
 * These defaults are NOT verified facts until scripts/openrouter-probe.mjs has run on a CI runner
 * and found them in the account's catalog. The probe's output is the evidence; this comment is not.
 *
 * The answer is never trusted by source: the caller's own parser (normalize, judge, ...) decides
 * what counts as an answer, exactly as for Gemini and Groq.
 */
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TEXT_MODEL = () => process.env.OPENROUTER_TEXT_MODEL || "openai/gpt-oss-120b";
const VISION_MODEL = () => process.env.OPENROUTER_VISION_MODEL || "qwen/qwen3.7-plus";

const fail = (error, detail) => ({ source: "openrouter", error, detail: String(detail || "").slice(0, 300) });

function countImages(messages) {
  return (messages || []).flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((c) => c && c.type === "image_url").length;
}

// The request body, built without sending it, so the shape can be tested.
function buildBody(messages, opts = {}) {
  const images = countImages(messages);
  const model = opts.openrouterModel || (images ? VISION_MODEL() : TEXT_MODEL());
  return {
    model,
    messages,
    temperature: opts.temperature ?? 0,
    max_tokens: Math.min(Number(opts.maxTokens || 1200), 32768),
    response_format: { type: "json_object" },
  };
}

function parseAnswer(text) {
  const cleaned = String(text || "").trim()
    .replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { return { content: String(text || "") }; }
}

async function callOpenRouter(messages, opts = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return fail("no_key", "OPENROUTER_API_KEY not set");
  const body = buildBody(messages, opts);
  const images = countImages(messages);
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://github.com/lumeierecollection-blip/YOUTUBE",
        "X-Title": "YOUTUBE pipeline",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Number(opts.openrouterTimeoutMs || 120000)),
    });
  } catch (e) {
    return fail("unavailable", `${body.model}: ${e.message || e}`);
  }
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (!res.ok || parsed?.error) {
    const msg = parsed?.error?.message || text.slice(0, 200);
    const kind = res.status === 429 || /rate.?limit|quota/i.test(msg) ? "quota_exhausted"
      : res.status >= 500 ? "unavailable" : "hard_error";
    return fail(kind, `${res.status} ${body.model}: ${msg}`);
  }
  const content = parsed?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return fail("bad_response", `${body.model}: no message in the answer`);
  const cost = parsed.usage?.cost != null ? `, cost $${Number(parsed.usage.cost).toFixed(6)}` : "";
  console.error(`[openrouter] ${body.model}: ${parsed.usage?.prompt_tokens ?? "?"} prompt + ${parsed.usage?.completion_tokens ?? "?"} answer tokens, ${images} image(s)${cost}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return parseAnswer(content);
}

module.exports = { callOpenRouter, buildBody, countImages, TEXT_MODEL, VISION_MODEL, ENDPOINT };
