/**
 * llm.js — one call, three providers: Gemini → Groq → local Ollama.
 * Groq (scripts/groq-client.cjs) answers when Gemini cannot; Ollama is the
 * last resort when both are down (slow on a CPU runner, rarely used). Used by every model call site (the planner, the
 * challenger, the frame reviews, the beat check, the section-7 vision QA).
 *
 *   callLLM(messages, opts, tag)
 *     - FORCE_PLANNER=ollama: Ollama only; Gemini is never called.
 *     - otherwise Gemini (src/lib/gemini-client.js). On any Gemini failure
 *       — { source: "gemini", error: quota_exhausted | unavailable |
 *       hard_error | bad_response | budget_exhausted | no_key } — the SAME
 *       messages go to Ollama at once (scripts/ollama-client.cjs), so the
 *       answer has the same schema whichever provider produced it.
 *     - every transition is logged:  [planner] gemini: quota_exhausted → ollama
 *
 * The return value is the provider's parsed JSON (or { content }), or an
 * error object { source: "ollama", error, detail } when Ollama fails too.
 */
import { createRequire } from "node:module";
import { callGemini } from "./gemini-client.js";

const require = createRequire(import.meta.url);
const ollama = require("../../scripts/ollama-client.cjs");
const groq = require("../../scripts/groq-client.cjs");

export function forcedOllama() {
  return String(process.env.FORCE_PLANNER || "").toLowerCase() === "ollama";
}

/**
 * FORCE_PROVIDER=gemini|groq|ollama addresses ONE provider and fails rather than
 * failing over. Unset (the default) is the normal chain, unchanged.
 *
 * This exists for the A1 discrimination test, which has to know which model
 * produced a judgement before it can compare judgements across models. It is also
 * the only way to exercise the Groq path on a machine whose Gemini key still has
 * quota — the quota_exhausted → groq transition hides it otherwise.
 *
 * A pinned call that fails returns the provider's own error object with
 * `pinned: true`; it does NOT silently fall through, because a test that cannot
 * tell "this model said NO" from "this model was skipped" is the exact blind spot
 * this pin exists to close.
 */
export function forcedProvider() {
  const p = String(process.env.FORCE_PROVIDER || "").toLowerCase();
  return ["gemini", "groq", "ollama"].includes(p) ? p : null;
}

// A model can answer: a Gemini key, or a configured local Ollama server.
export function llmConfigured() {
  const gemini = !!(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  return (gemini && !forcedOllama()) || (!!process.env.GROQ_API_KEY && !forcedOllama()) || !!process.env.OLLAMA_URL;
}

export function isProviderError(r) {
  return !!(r && (r.source === "gemini" || r.source === "groq" || r.source === "ollama") && r.error);
}

export async function callOllamaOnly(messages, opts = {}, tag = "llm") {
  const o = await ollama.callOllama(messages, opts);
  if (isProviderError(o)) console.error(`[${tag}] ollama: ${o.error}${o.detail ? ` (${String(o.detail).slice(0, 160)})` : ""}`);
  return o;
}

// Groq, then Ollama if Groq cannot answer. Used by callLLM and by callers
// (the planner) that run their own Gemini step.
// opts.groqBatch = { messages: [msgs, msgs, ...], merge(answers) }: Groq's
// vision models take a fixed number of images per request (GROQ_MAX_IMAGES,
// exported below as GROQ_MAX_IMAGES), so a caller sending more frames
// supplies the same request split into parts of at most that many images and
// a merge. Groq gets ceil(N/cap) calls; Gemini and Ollama get the ONE call.
export const GROQ_MAX_IMAGES = groq.MAX_IMAGES;
async function callGroqBatched(opts, tag) {
  const parts = opts.groqBatch.messages;
  console.error(`[${tag}] groq: ${parts.length} batch(es) of <= ${groq.MAX_IMAGES} frames`);
  const answers = [];
  // Pacing, not a retry of a failed provider: the account allows 8000
  // tokens/min per model and one 3-image part is ~2400, so the parts of one
  // request run into the per-minute window. A 429 that names a wait of
  // <= 60 s ("try again in 12.3s") waits that long and sends the SAME part
  // once more; a longer wait, a 413 (one part bigger than the window), or a
  // second 429 on the part falls to Ollama as before.
  for (const [i, m] of parts.entries()) {
    let g = await groq.callGroq(m, opts);
    const wait = g?.error === "quota_exhausted" && !/^413/.test(g.detail || "") ? Number((String(g.detail).match(/try again in (?:(\d+)m)?([\d.]+)s/) || []).slice(1).reduce((t, v, k) => t + (Number(v) || 0) * (k ? 1 : 60), 0)) : 0;
    if (wait > 0 && wait <= 60) {
      console.error(`[${tag}] groq: part ${i + 1}/${parts.length} rate-limited, pacing ${wait.toFixed(1)}s`);
      await new Promise((r) => setTimeout(r, Math.ceil(wait * 1000) + 500));
      g = await groq.callGroq(m, opts);
    }
    if (isProviderError(g)) return g;
    answers.push(g);
  }
  return opts.groqBatch.merge(answers);
}

export async function callGroqThenOllama(messages, opts = {}, tag = "llm") {
  return (await groqThenOllamaWithProvenance(messages, opts, tag)).value;
}

// Same chain, but it reports WHICH provider answered. On success the clients
// return the bare parsed JSON — `source` is set only on FAILURE
// (gemini-client.js:230, groq-client.cjs:41) — so before this, nothing
// downstream could tell a Gemini answer from a Groq one. That is how a Groq
// verdict was logged as "Gemini verdict" (run 37323030454:
// gemini: quota_exhausted → groq), and it means a persisted model judgement
// could carry another model's name.
async function groqThenOllamaWithProvenance(messages, opts, tag) {
  const g = opts.groqBatch ? await callGroqBatched(opts, tag) : await groq.callGroq(messages, opts);
  if (!isProviderError(g)) return { value: g, provider: "groq" };
  console.error(`[${tag}] groq: ${g.error} → ollama${g.detail ? ` (${String(g.detail).slice(0, 120)})` : ""}`);
  return { value: await callOllamaOnly(messages, opts, tag), provider: "ollama" };
}

export async function callLLM(messages, opts = {}, tag = "llm") {
  if (forcedOllama()) {
    console.error(`[${tag}] ollama (FORCE_PLANNER=ollama — Gemini and Groq not called)`);
    return callOllamaOnly(messages, opts, tag);
  }
  const r = await callGemini(messages, { ...opts, tag });
  if (!(r && r.source === "gemini" && r.error)) return r;
  console.error(`[${tag}] gemini: ${r.error} → groq${r.detail ? ` (${String(r.detail).slice(0, 120)})` : ""}`);
  return callGroqThenOllama(messages, opts, tag);
}

/**
 * callLLM + the name of the provider that actually answered.
 * Returns { value, provider, error, chain } where `chain` is every provider
 * tried, in order, so a caller can record "gemini quota_exhausted -> groq"
 * rather than a bare answer with an unearned label.
 *
 * Use this wherever a model's judgement is persisted or acted on. A caller
 * using callLLM cannot know who answered, and mislabelling that is how the
 * frame review's Groq verdict was logged as a Gemini one (run 37323030454).
 */
export async function callLLMWithProvenance(messages, opts = {}, tag = "llm") {
  const pin = forcedProvider();
  if (pin === "ollama") {
    console.error(`[${tag}] ollama (FORCE_PROVIDER=ollama — pinned, no failover)`);
    const value = await callOllamaOnly(messages, opts, tag);
    return { value, provider: "ollama", error: isProviderError(value) ? value.error : null, chain: ["ollama"], pinned: true };
  }
  if (pin === "groq") {
    console.error(`[${tag}] groq (FORCE_PROVIDER=groq — pinned, no failover)`);
    const g = opts.groqBatch ? await callGroqBatched(opts, tag) : await groq.callGroq(messages, opts);
    return { value: g, provider: "groq", error: isProviderError(g) ? g.error : null, chain: ["groq"], pinned: true };
  }
  if (pin === "gemini") {
    console.error(`[${tag}] gemini (FORCE_PROVIDER=gemini — pinned, no failover)`);
    const r = await callGemini(messages, { ...opts, tag });
    return { value: r, provider: "gemini", error: isProviderError(r) ? r.error : null, chain: ["gemini"], pinned: true };
  }
  if (forcedOllama()) {
    console.error(`[${tag}] ollama (FORCE_PLANNER=ollama — Gemini and Groq not called)`);
    const value = await callOllamaOnly(messages, opts, tag);
    return { value, provider: "ollama", error: isProviderError(value) ? value.error : null, chain: ["ollama"] };
  }
  const r = await callGemini(messages, { ...opts, tag });
  if (!(r && r.source === "gemini" && r.error)) {
    return { value: r, provider: "gemini", error: null, chain: ["gemini"] };
  }
  console.error(`[${tag}] gemini: ${r.error} → groq${r.detail ? ` (${String(r.detail).slice(0, 120)})` : ""}`);
  const { value, provider } = await groqThenOllamaWithProvenance(messages, opts, tag);
  return { value, provider, error: isProviderError(value) ? value.error : null, chain: ["gemini", provider] };
}
