#!/usr/bin/env node
/**
 * Minimal Ollama client for the prep stage.
 *
 * The pipeline's model calls go through OpenCode (opencode.json's "ollama"
 * provider → OLLAMA_URL/v1). This module is what the workflow uses to make
 * sure that server is actually up, has the model, and has it loaded, before
 * the first stage starts — so a dead or half-started server fails in its own
 * step with its own error instead of surfacing as "All models failed" three
 * stages later.
 *
 * CLI:
 *   node scripts/ollama-client.cjs --check [--model qwen2.5:7b] [--timeout 60]
 *     waits for /api/tags, verifies the model is pulled, sends one warm-up
 *     generation (loads the weights into memory). Exit 0 = ready.
 *
 * Module:
 *   const { generate, waitForServer } = require("./ollama-client.cjs");
 */

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");

async function request(path, body, timeoutMs = 120000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timer);
  }
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

async function generate(prompt, { model = DEFAULT_MODEL, format, options } = {}) {
  const r = await request("/api/generate", { model, prompt, stream: false, format, options }, 600000);
  return r.response;
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

module.exports = { generate, waitForServer, DEFAULT_MODEL, OLLAMA_URL };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  if (!argv.includes("--check")) {
    console.error("Usage: node scripts/ollama-client.cjs --check [--model <name>] [--timeout <s>]");
    process.exit(2);
  }
  check(flag("--model", DEFAULT_MODEL), Number(flag("--timeout", 60))).catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
