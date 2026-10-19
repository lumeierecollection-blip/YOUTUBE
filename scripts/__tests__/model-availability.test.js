import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyGeminiStatus, parseShutdown, deprecationFor, verdictFor, scanIds, unregistered, bareId, probeBody,
} from "../model-availability.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const NOW = new Date("2026-10-10T00:00:00Z");

test("a 200 is alive; a 429 is alive on quota; a 404 is retired", () => {
  assert.equal(classifyGeminiStatus(200, "{}"), "alive");
  assert.equal(classifyGeminiStatus(429, "RESOURCE_EXHAUSTED"), "alive-quota");
  assert.equal(classifyGeminiStatus(404, "no longer available to new users"), "retired");
});

test("a rejected key is reported as the key, not the model", () => {
  assert.equal(classifyGeminiStatus(400, "Please pass a valid API key"), "key-rejected");
  assert.equal(classifyGeminiStatus(403, ""), "key-rejected");
});

test("a 5xx is transient, not a verdict on the model", () => {
  assert.equal(classifyGeminiStatus(503, "overloaded"), "unknown-transient");
});

test("shutdown dates parse from both page formats; 'No shutdown date' is no date", () => {
  assert.equal(parseShutdown("November 17, 2026").getUTCFullYear(), 2026);
  assert.ok(parseShutdown("March 2027"));
  assert.equal(parseShutdown("No shutdown date announced"), null);
  assert.equal(parseShutdown(""), null);
});

test("the deprecations row for a model is found by its first column", () => {
  const page = [
    "gemini-3.5-flash\tMay 19, 2026\tNo shutdown date announced\tgemini-3.6-flash (requests ... routed)",
    "gemini-2.5-flash-preview-tts\tMay 20, 2025\tNovember 17, 2026\tgemini-3.8-flash-tts or gemini-3.8-flash-lite-tts",
  ].join("\n");
  const d = deprecationFor("gemini-2.5-flash-preview-tts", page);
  assert.equal(d.found, true);
  assert.equal(d.shutdown, "November 17, 2026");
  assert.match(d.replacement, /gemini-3\.8-flash-tts/);
  assert.equal(deprecationFor("gemini-9.9-nope", page).found, false);
});

test("a model that 404s on every key is RETIRED", () => {
  assert.equal(verdictFor({ gemini: ["retired", "retired", "retired", "retired"], now: NOW }), "RETIRED");
});

test("a model that answers on any key is not retired by the others", () => {
  assert.equal(verdictFor({ gemini: ["retired", "alive", "retired"], now: NOW }), "ALIVE");
});

test("a shutdown date that has passed is RETIRED even when the probe still answers", () => {
  assert.equal(verdictFor({ gemini: ["alive"], shutdown: new Date("2026-06-01T00:00:00Z"), now: NOW }), "RETIRED");
});

test("a shutdown inside the window is DEPRECATED-SOON, outside it ALIVE", () => {
  assert.equal(verdictFor({ gemini: ["alive"], shutdown: new Date("2026-11-17T00:00:00Z"), now: NOW }), "DEPRECATED-SOON");
  assert.equal(verdictFor({ gemini: ["alive"], shutdown: new Date("2027-05-07T00:00:00Z"), now: NOW }), "ALIVE");
});

test("a key that is rejected everywhere is KEY-REJECTED; a 5xx everywhere is PROBE-TRANSIENT, not UNKNOWN", () => {
  assert.equal(verdictFor({ gemini: ["key-rejected", "key-rejected"], now: NOW }), "KEY-REJECTED");
  // 2026-10-19: both Gemini models answered HTTP 503 on every key and the weekly gate failed as if the
  // models were broken. The provider was down; that is a warning, not a verdict.
  assert.equal(verdictFor({ gemini: ["unknown-transient", "unknown-transient"], now: NOW }), "PROBE-TRANSIENT");
  // A non-5xx unknown is still a failure, and a mixed result is not "every key 5xx".
  assert.equal(verdictFor({ gemini: ["unknown"], now: NOW }), "UNKNOWN");
  assert.equal(verdictFor({ gemini: ["unknown-transient", "unknown"], now: NOW }), "UNKNOWN");
});

test("a TTS model is probed with the audio response modality; other models with plain text", () => {
  assert.deepEqual(JSON.parse(probeBody("gemini-3.8-flash-tts")).generationConfig, { responseModalities: ["AUDIO"] });
  assert.equal(JSON.parse(probeBody("gemini-3.5-flash")).generationConfig.maxOutputTokens, 8);
});

test("a TTS model that still gives no usable answer is PROBE-LIMIT (a warning), never UNKNOWN (a failure)", () => {
  assert.equal(verdictFor({ id: "gemini-3.1-flash-tts-preview", gemini: ["unknown", "unknown", "unknown", "unknown"], now: NOW }), "PROBE-LIMIT");
  assert.equal(verdictFor({ id: "gemini-3.5-flash", gemini: ["unknown", "unknown"], now: NOW }), "UNKNOWN");
});

test("OpenRouter or Groq: a model missing from the list is MISSING; no key is NOT-CHECKED", () => {
  assert.equal(verdictFor({ gemini: [], list: "absent", now: NOW }), "MISSING");
  assert.equal(verdictFor({ gemini: [], list: "not-checked", now: NOW }), "NOT-CHECKED");
  assert.equal(verdictFor({ gemini: [], list: "present", now: NOW }), "ALIVE");
});

test("a model the code does not call is NOT-CALLED and is never probed", () => {
  assert.equal(verdictFor({ called: false, gemini: ["retired"], now: NOW }), "NOT-CALLED");
});

test("bare IDs drop the google/ prefix so the same model is one model", () => {
  assert.equal(bareId("google/gemini-3.5-flash-lite"), "gemini-3.5-flash-lite");
  assert.equal(bareId("gemini-3.5-flash-lite"), "gemini-3.5-flash-lite");
});

test("the scanner finds model IDs with file and line, and the registry check reports the unknown ones", () => {
  const root = mkdtempSync(join(tmpdir(), "model-scan-"));
  mkdirSync(join(root, "scripts"));
  writeFileSync(join(root, "scripts", "a.js"), 'const m = "gemini-3.5-flash-lite";\n// old: gemini-2.5-flash\nconst q = "qwen/qwen3.7-plus";\n');
  const found = scanIds(root);
  assert.deepEqual(found.get("gemini-3.5-flash-lite"), ["scripts/a.js:1"]);
  assert.deepEqual(found.get("gemini-2.5-flash"), ["scripts/a.js:2"]);
  const reg = [{ id: "gemini-3.5-flash-lite" }, { id: "qwen/qwen3.7-plus" }];
  const missing = unregistered(found, reg).map((m) => m.id);
  assert.deepEqual(missing, ["gemini-2.5-flash"]);
});

test("COVERAGE GATE: every model ID in the live repo code is in config/model-registry.json", () => {
  const registry = JSON.parse(readFileSync(join(ROOT, "config", "model-registry.json"), "utf8"));
  const missing = unregistered(scanIds(ROOT), registry);
  assert.deepEqual(
    missing.map((m) => `${m.id} @ ${m.where.join(", ")}`), [],
    "an unregistered model ID is in the code: add it to config/model-registry.json (called true, or called false with the reason)",
  );
});
