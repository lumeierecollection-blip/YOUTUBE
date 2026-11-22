#!/usr/bin/env node
/**
 * vision-providers.cjs — the one place that decides which vision model judges
 * an image, shared by verify-cutout-image / verify-image / verify-place-image /
 * verify-person-image.
 *
 *   askVision(messages, norm, { maxTokens })
 *     -> { provider, v, tried }   v = norm(answer) or null when nobody answered
 *
 * Order comes from $VISION_PROVIDERS (comma list of ollama,groq,gemini).
 * DEFAULT IS "ollama" ONLY (owner's decision 2026-10-18: the judge is the local
 * Ollama vision model). A hosted provider is used only if it is named in
 * VISION_PROVIDERS. No answer from any named provider = the image is rejected
 * by the callers, never accepted by default.
 *
 * Where this stops: a small local vision model is a weaker judge than a hosted
 * one. image-judge.cjs compensates with a second, blind pass; it does not make
 * the model infallible, and the rendered-frame review still runs after.
 */
"use strict";

const providerList = () =>
  String(process.env.VISION_PROVIDERS || "ollama").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

async function viaGroq(messages, norm, maxTokens, tried) {
  try {
    const groq = require("./groq-client.cjs");
    for (let k = 0; k < 3; k++) {
      const g = await groq.callGroq(messages, { maxTokens, temperature: 0 });
      const v = norm(g);
      if (v) return v;
      const wait = Number((String(g?.detail || "").match(/try again in ([\d.]+)s/) || [])[1]);
      if (g?.error === "quota_exhausted" && Number.isFinite(wait) && wait <= 30 && k < 2) { await new Promise((r) => setTimeout(r, (wait + 1) * 1000)); continue; }
      tried.push(`groq: ${g?.error ? `${g.error} ${String(g.detail || "").slice(0, 100)}` : "malformed answer"}`);
      break;
    }
  } catch (e) { tried.push(`groq: ${e.message}`); }
  return null;
}

async function viaGemini(messages, norm, maxTokens, tried) {
  try {
    const { callGemini } = await import("../src/lib/gemini-client.js");
    const g = await callGemini(messages, { model: "gemini-3.5-flash-lite", maxTokens, temperature: 0, noCache: true, tag: "verify-image" });
    const v = norm(g);
    if (v) return v;
    tried.push(`gemini: ${g?.error ? `${g.error} ${String(g.detail || "").slice(0, 100)}` : "malformed answer"}`);
  } catch (e) { tried.push(`gemini: ${e.message}`); }
  return null;
}

async function viaOllama(messages, norm, maxTokens, tried) {
  try {
    const ollama = require("./ollama-client.cjs");
    const o = await ollama.callOllama(messages, { maxTokens, temperature: 0, capKind: "vision" });
    const v = norm(o);
    if (v) return v;
    tried.push(`ollama: ${o?.error ? `${o.error} ${String(o.detail || "").slice(0, 100)}` : "malformed answer"}`);
  } catch (e) { tried.push(`ollama: ${e.message}`); }
  return null;
}

const RUNNERS = { ollama: viaOllama, groq: viaGroq, gemini: viaGemini };

async function askVision(messages, norm, { maxTokens = 200 } = {}) {
  const tried = [];
  for (const name of providerList()) {
    const run = RUNNERS[name];
    if (!run) { tried.push(`${name}: unknown provider`); continue; }
    const v = await run(messages, norm, maxTokens, tried);
    if (v) return { provider: name, v, tried };
  }
  return { provider: null, v: null, tried };
}

module.exports = { askVision, providerList };
