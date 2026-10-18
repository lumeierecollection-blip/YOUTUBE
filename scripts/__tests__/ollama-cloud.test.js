// Ollama Cloud (owner 2026-10-17): the second provider after Gemini. Against a local stand-in for ollama.com: the request carries the key and the
// hosted model name, the answer is parsed like every provider's, a 429 is quota_exhausted, and without a key it is skipped without a request.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";

let server, seen = [], reply = () => ({ status: 200, body: { message: { content: '{"ok": true, "beats": []}' }, prompt_eval_count: 10, eval_count: 5 } });
before(async () => {
  server = http.createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      seen.push({ url: req.url, auth: req.headers.authorization, body: b ? JSON.parse(b) : null });
      const r = reply();
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(JSON.stringify(r.body));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  process.env.OLLAMA_CLOUD_URL = `http://127.0.0.1:${server.address().port}`;
  // empty, not deleted: dotenv never overrides a variable that exists, and an empty key is no key (gemini-client's own OpenRouter step, openrouter, groq)
  for (const k of ["OPENROUTER_API_KEY", "GROQ_API_KEY"]) process.env[k] = "";
  for (const k of ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GOOGLE_GENERATIVE_AI_API_KEY", "FORCE_PROVIDER", "FORCE_PLANNER"]) delete process.env[k];
});
after(() => server.close());

const client = () => createRequire(import.meta.url)("../ollama-client.cjs");

test("no key: no request, error no_key", async () => {
  delete process.env.OLLAMA_API_KEY;
  seen = [];
  const r = await client().callOllamaCloud([{ role: "user", content: "x" }]);
  assert.equal(r.error, "no_key");
  assert.equal(seen.length, 0);
});

test("with a key: /api/chat, bearer key, the hosted text model, JSON parsed", async () => {
  process.env.OLLAMA_API_KEY = "test-key";
  seen = [];
  const r = await client().callOllamaCloud([{ role: "user", content: "plan" }], { maxTokens: 100 });
  assert.deepEqual(r, { ok: true, beats: [] });
  assert.equal(seen[0].url, "/api/chat");
  assert.equal(seen[0].auth, "Bearer test-key");
  assert.equal(seen[0].body.model, "gpt-oss:120b");
  assert.equal(seen[0].body.format, "json");
});

test("a 429 is quota_exhausted, so the chain moves on", async () => {
  process.env.OLLAMA_API_KEY = "test-key";
  reply = () => ({ status: 429, body: { error: "rate limited" } });
  const r = await client().callOllamaCloud([{ role: "user", content: "x" }]);
  assert.equal(r.source, "ollama-cloud");
  assert.equal(r.error, "quota_exhausted");
  reply = () => ({ status: 200, body: { message: { content: '{"ok": true}' } } });
});

test("llm.js: Gemini without a key falls to Ollama Cloud first, and says so", async () => {
  process.env.OLLAMA_API_KEY = "test-key";
  const { callLLMWithProvenance } = await import("../../src/lib/llm.js");
  const r = await callLLMWithProvenance([{ role: "user", content: "x" }], { maxTokens: 50 }, "test");
  assert.equal(r.provider, "ollama-cloud");
  assert.deepEqual(r.chain, ["gemini", "ollama-cloud"]);
  assert.deepEqual(r.value, { ok: true });
});
