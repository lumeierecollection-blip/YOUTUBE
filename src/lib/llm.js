/**
 * llm.js — one call, two providers: Gemini first, local Ollama when Gemini
 * cannot answer. Used by every model call site (the planner, the
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

export function forcedOllama() {
  return String(process.env.FORCE_PLANNER || "").toLowerCase() === "ollama";
}

// A model can answer: a Gemini key, or a configured local Ollama server.
export function llmConfigured() {
  const gemini = !!(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  return (gemini && !forcedOllama()) || !!process.env.OLLAMA_URL;
}

export function isProviderError(r) {
  return !!(r && (r.source === "gemini" || r.source === "ollama") && r.error);
}

export async function callOllamaOnly(messages, opts = {}, tag = "llm") {
  const o = await ollama.callOllama(messages, opts);
  if (isProviderError(o)) console.error(`[${tag}] ollama: ${o.error}${o.detail ? ` (${String(o.detail).slice(0, 160)})` : ""}`);
  return o;
}

export async function callLLM(messages, opts = {}, tag = "llm") {
  if (forcedOllama()) {
    console.error(`[${tag}] ollama (FORCE_PLANNER=ollama — Gemini not called)`);
    return callOllamaOnly(messages, opts, tag);
  }
  const r = await callGemini(messages, opts);
  if (!(r && r.source === "gemini" && r.error)) return r;
  console.error(`[${tag}] gemini: ${r.error} → ollama${r.detail ? ` (${String(r.detail).slice(0, 120)})` : ""}`);
  return callOllamaOnly(messages, opts, tag);
}
