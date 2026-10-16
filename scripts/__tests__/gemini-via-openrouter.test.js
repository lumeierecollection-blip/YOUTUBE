// When every Gemini key fails, callGemini asks the SAME Gemini model through OpenRouter (owner 2026-10-16: "try using OpenRouter").
import { test } from "node:test";
import assert from "node:assert/strict";

test("no usable Gemini key -> google/<model> via OpenRouter, same messages, no forced JSON mode; its failure keeps the Gemini failure", async () => {
  for (const k of ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GOOGLE_GENERATIVE_AI_API_KEY", "FORCE_PLANNER", "GEMINI_VIA_OPENROUTER"]) delete process.env[k];
  process.env.OPENROUTER_API_KEY = "test-key";
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: '```json\n{"beats": []}\n```' } }], usage: { prompt_tokens: 5, completion_tokens: 3 } }) };
  };
  try {
    const { callGemini } = await import("../../src/lib/gemini-client.js");
    const r = await callGemini([{ role: "user", content: "props?" }], { model: "gemini-3.6-flash", maxTokens: 300, noCache: true, tag: "t" });
    assert.deepEqual(r, { beats: [] });
    assert.equal(sent[0].model, "google/gemini-3.6-flash");
    assert.equal(sent[0].response_format, undefined);
    assert.deepEqual(sent[0].messages, [{ role: "user", content: "props?" }]);
    globalThis.fetch = async () => ({ ok: false, status: 402, text: async () => JSON.stringify({ error: { message: "no credit" } }) });
    const f = await callGemini([{ role: "user", content: "x" }], { noCache: true });
    assert.equal(f.source, "gemini");
    assert.equal(f.error, "no_key");
    process.env.GEMINI_VIA_OPENROUTER = "off";
    sent.length = 0;
    globalThis.fetch = async (u, init) => { sent.push(init); throw new Error("must not be called"); };
    assert.equal((await callGemini([{ role: "user", content: "x" }], { noCache: true })).error, "no_key");
    assert.equal(sent.length, 0);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENROUTER_API_KEY; delete process.env.GEMINI_VIA_OPENROUTER;
  }
});
