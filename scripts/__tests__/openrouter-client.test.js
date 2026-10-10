import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { callOpenRouter, buildBody, countImages, TEXT_MODEL, VISION_MODEL } = require("../openrouter-client.cjs");

const TEXT = [{ role: "user", content: "Reply with JSON." }];
const IMG = [{ role: "user", content: [
  { type: "text", text: "What is this?" },
  { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
] }];

test("a text call goes to the text model, an image call to the vision model", () => {
  assert.equal(buildBody(TEXT, {}).model, TEXT_MODEL());
  assert.equal(buildBody(IMG, {}).model, VISION_MODEL());
});

test("image requests turn reasoning off (qwen3.7-plus returns no answer when reasoning spends the budget); text requests do not", () => {
  assert.deepEqual(buildBody(IMG, {}).reasoning, { enabled: false });
  assert.equal("reasoning" in buildBody(TEXT, {}), false);
});

test("the request asks for a JSON object, with the caller's temperature and token cap", () => {
  const b = buildBody(TEXT, { temperature: 0, maxTokens: 300 });
  assert.deepEqual(b.response_format, { type: "json_object" });
  assert.equal(b.temperature, 0);
  assert.equal(b.max_tokens, 300);
});

test("the token cap is bounded at 32768, and an explicit model overrides the default", () => {
  assert.equal(buildBody(TEXT, { maxTokens: 999999 }).max_tokens, 32768);
  assert.equal(buildBody(IMG, { openrouterModel: "some/other-model" }).model, "some/other-model");
});

test("images are counted from image_url parts only", () => {
  assert.equal(countImages(IMG), 1);
  assert.equal(countImages(TEXT), 0);
  assert.equal(countImages([{ role: "user", content: [{ type: "image_url" }, { type: "image_url" }] }]), 2);
});

test("no OPENROUTER_API_KEY is a no_key failure from this provider, never a crash", async () => {
  const saved = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const r = await callOpenRouter(TEXT, {});
    assert.equal(r.source, "openrouter");
    assert.equal(r.error, "no_key");
  } finally {
    if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
  }
});

test("the llm.js chain tries OpenRouter after Gemini and before Groq, then Ollama", async () => {
  const saved = {};
  for (const k of ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GOOGLE_GENERATIVE_AI_API_KEY", "OPENROUTER_API_KEY", "GROQ_API_KEY", "OLLAMA_URL", "FORCE_PROVIDER", "FORCE_PLANNER"]) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  const origErr = console.error;
  console.error = () => {};
  try {
    const { callLLMWithProvenance } = await import("../../src/lib/llm.js");
    const r = await callLLMWithProvenance(TEXT, { maxTokens: 16, temperature: 0 }, "test");
    assert.deepEqual(r.chain, ["gemini", "openrouter", "groq", "ollama"]);
    assert.notEqual(r.provider, "openrouter");
  } finally {
    console.error = origErr;
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
  }
});
