// Google first (owner, 2026-10-08): every model call goes Gemini across ALL keys, then ALL sibling
// models, before any fallback. CI run 37832958615 ch-44: keys 1-2 were out of quota (429), key 3
// 503 then 429, and the client left Google with two sibling models untried.
// A fake `curl` on PATH plays the API: it answers per model from a JSON table.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const skip = process.platform === "win32" ? "a shell script cannot stand in for curl.exe on Windows (runs on the Linux CI)" : false;

function fakeCurl(table) {
  const dir = mkdtempSync(join(tmpdir(), "fake-curl-"));
  const log = join(dir, "calls.log");
  writeFileSync(join(dir, "table.json"), JSON.stringify(table));
  writeFileSync(join(dir, "curl"), `#!/usr/bin/env node
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const key = (process.argv.find((a) => a.startsWith("Authorization: Bearer ")) || "").slice(22);
fs.appendFileSync(${JSON.stringify(log)}, body.model + " " + key + "\\n");
const t = JSON.parse(fs.readFileSync(${JSON.stringify(join(dir, "table.json"))}, "utf8"));
const a = t[body.model] || "429";
if (a === "ok") process.stdout.write(JSON.stringify({ choices: [{ message: { content: '{"answer":"' + body.model + '"}' } }] }));
else process.stdout.write(JSON.stringify({ error: { code: Number(a), message: a === "429" ? "RESOURCE_EXHAUSTED quota" : "high demand" } }));
`);
  chmodSync(join(dir, "curl"), 0o755);
  // The key-project probe (logKeyProjects) also calls curl, with no model: only model calls count.
  return { dir, calls: () => readFileSync(log, "utf8").trim().split("\n").filter((c) => c.startsWith("gemini")) };
}

test("quota spent on every key of one model -> the sibling model answers (no fallback)", { skip }, async () => {
  const f = fakeCurl({ "gemini-3.5-flash-lite": "429", "gemini-3.1-flash-lite-preview": "ok" });
  const env = { ...process.env };
  Object.assign(process.env, { PATH: `${f.dir}:${process.env.PATH}`, GEMINI_API_KEY_1: "k1aaaaaaaaaa", GEMINI_API_KEY_2: "k2aaaaaaaaaa", GEMINI_API_KEY_3: "k3aaaaaaaaaa", GEMINI_SIBLING_MODELS: "gemini-3.1-flash-lite-preview,gemini-3.5-flash" });
  delete process.env.FORCE_PLANNER;
  try {
    const g = await import(`../../src/lib/gemini-client.js?t=${Date.now()}`);
    g.reloadKeys();
    const r = await g.callGemini([{ role: "user", content: "x" }], { noCache: true });
    assert.equal(r.answer, "gemini-3.1-flash-lite-preview");
    const calls = f.calls().filter((c) => c.startsWith("gemini-3.5-flash-lite"));
    assert.deepEqual(new Set(calls.map((c) => c.split(" ")[1])), new Set(["k1aaaaaaaaaa", "k2aaaaaaaaaa", "k3aaaaaaaaaa"]), "every key tried on the first model");
  } finally { process.env = env; }
});

test("every model on every key spent -> quota_exhausted is returned only then", { skip }, async () => {
  const f = fakeCurl({});
  const env = { ...process.env };
  Object.assign(process.env, { PATH: `${f.dir}:${process.env.PATH}`, GEMINI_API_KEY_1: "k1aaaaaaaaaa", GEMINI_API_KEY_2: "k2aaaaaaaaaa", GEMINI_API_KEY_3: "k3aaaaaaaaaa", GEMINI_SIBLING_MODELS: "gemini-3.1-flash-lite-preview,gemini-3.5-flash" });
  try {
    const g = await import(`../../src/lib/gemini-client.js?t=${Date.now()}b`);
    g.reloadKeys();
    const r = await g.callGemini([{ role: "user", content: "x" }], { noCache: true });
    assert.equal(r.error, "quota_exhausted");
    const models = new Set(f.calls().map((c) => c.split(" ")[0]));
    assert.deepEqual(models, new Set(["gemini-3.5-flash-lite", "gemini-3.1-flash-lite-preview", "gemini-3.5-flash"]));
  } finally { process.env = env; }
});
