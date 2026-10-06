/**
 * eval-layer3-judge.js — the judge.
 *
 * MUTATIONS (run, recorded):
 *   - AXIS_WEIGHTS composition 0.3 -> 0.1  -> local-aggregate test goes red
 *   - drop responseSchema from the request -> schema-in-request test goes red
 *   File restored byte-identical after each.
 *
 * Every network dependency is injected, so the failure paths run offline.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  judge, buildPrompt, validateResponse, aggregate,
  AXIS_WEIGHTS, RESPONSE_SCHEMA, MODEL, MODEL_FALLBACK,
} from "../eval-layer3-judge.js";

const GOOD = {
  axes: { engagement: 8, prompt_intent: 7, composition: 9, style_coherence: 6 },
  weak_beats: [{ timestamp: "00:12", axis: "composition", element: "headline", reason: "low contrast" }],
};
const noop = async () => ({ name: "files/x", uri: "u", mimeType: "video/mp4", sizeBytes: 1 });
const pollOk = async () => ({ state: "ACTIVE", uri: "https://u/x" });
const okHttp = () => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: JSON.stringify(GOOD) }] } }] }, text: "" });

function harness(over = {}) {
  const calls = { uploads: 0, deletes: 0, http: [] };
  return {
    calls,
    deps: {
      upload: async (...a) => { calls.uploads++; return noop(...a); },
      poll: pollOk,
      del: async () => { calls.deletes++; },
      http: async (url, opts) => { calls.http.push({ url, opts }); return okHttp(); },
      env: { GEMINI_API_KEY_1: "k" },
      runId: "test-run",
      provenance: false,
      ...over,
    },
  };
}

describe("prompt", () => {
  it("has the four labelled blocks in order", () => {
    const p = buildPrompt({ channelId: 2, styleSpec: { niche: "x" }, layer2Advisory: 0.61 });
    for (const b of ["[ROLE]", "[OBJECTIVE]", "[CONSTRAINTS]", "[INPUT]"]) assert.ok(p.includes(b), `missing ${b}`);
    assert.ok(p.indexOf("[ROLE]") < p.indexOf("[OBJECTIVE]"));
    assert.ok(p.indexOf("[OBJECTIVE]") < p.indexOf("[CONSTRAINTS]"));
    assert.ok(p.indexOf("[CONSTRAINTS]") < p.indexOf("[INPUT]"));
  });
  it("carries the advisory score", () => {
    assert.match(buildPrompt({ channelId: 2, styleSpec: {}, layer2Advisory: 0.61 }), /0\.610/);
    assert.match(buildPrompt({ channelId: 2, styleSpec: {}, layer2Advisory: 0.61 }), /advisory only, not a gate/);
  });
  it("says so when no advisory was computed", () => {
    assert.match(buildPrompt({ channelId: 2, styleSpec: {} }), /not computed/);
  });
  it("carries the style spec", () => {
    assert.match(buildPrompt({ channelId: 2, styleSpec: { niche: "Know Your Rights" } }), /Know Your Rights/);
  });
});

describe("schema", () => {
  it("is flat: no $ref, $defs, anyOf or const", () => {
    const bad = [];
    (function walk(o, p) {
      if (!o || typeof o !== "object") return;
      for (const k of Object.keys(o)) {
        if (["$ref", "$defs", "anyOf", "const"].includes(k)) bad.push(p + "/" + k);
        walk(o[k], p + "/" + k);
      }
    })(RESPONSE_SCHEMA, "");
    assert.deepEqual(bad, []);
  });
  it("requires all four axes and each weak beat field", () => {
    assert.deepEqual(RESPONSE_SCHEMA.required, ["axes", "weak_beats"]);
    assert.deepEqual(RESPONSE_SCHEMA.properties.axes.required, ["engagement", "prompt_intent", "composition", "style_coherence"]);
    assert.deepEqual(RESPONSE_SCHEMA.properties.weak_beats.items.required, ["timestamp", "axis", "element", "reason"]);
  });
});

describe("aggregate", () => {
  it("weights composition and style_coherence at 0.3", () => {
    assert.equal(AXIS_WEIGHTS.composition, 0.3);
    assert.equal(AXIS_WEIGHTS.style_coherence, 0.3);
    assert.equal(AXIS_WEIGHTS.engagement, 0.2);
    assert.equal(AXIS_WEIGHTS.prompt_intent, 0.2);
  });
  it("sums the weights to 1", () => {
    const s = Object.values(AXIS_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(s - 1) < 1e-9);
  });
  it("computes the weighted mean", () => {
    assert.ok(Math.abs(aggregate(GOOD.axes) - (0.2 * 8 + 0.2 * 7 + 0.3 * 9 + 0.3 * 6)) < 1e-9);
  });
});

describe("validateResponse", () => {
  it("accepts a good response", () => {
    const v = validateResponse(GOOD);
    assert.deepEqual(v.axes, GOOD.axes);
    assert.equal(v.weak_beats.length, 1);
  });
  it("fails loud on no_video rather than scoring it zero", () => {
    assert.throws(() => validateResponse({ error: "no_video" }), /reported an error: no_video/);
  });
  it("fails loud on a missing axis", () => {
    assert.throws(() => validateResponse({ axes: { engagement: 8 }, weak_beats: [] }), /prompt_intent" is missing/);
  });
  it("fails loud on an out-of-range axis", () => {
    assert.throws(() => validateResponse({ axes: { ...GOOD.axes, composition: 11 }, weak_beats: [] }), /out of range/);
  });
  it("fails loud on a non-numeric axis", () => {
    assert.throws(() => validateResponse({ axes: { ...GOOD.axes, composition: "9" }, weak_beats: [] }), /not a number/);
  });
  it("fails loud when weak_beats is absent", () => {
    assert.throws(() => validateResponse({ axes: GOOD.axes }), /no weak_beats array/);
  });
  it("fails loud on an incomplete weak beat", () => {
    assert.throws(() => validateResponse({ axes: GOOD.axes, weak_beats: [{ timestamp: "00:01" }] }), /missing "axis"/);
  });
});

describe("judge flow", () => {
  it("uploads, polls, scores, and returns numbers with no verdict", async () => {
    const { calls, deps } = harness();
    const r = await judge("v.mp4", { channelId: 2, styleSpec: {}, layer2Advisory: 0.61, ...deps });
    assert.equal(calls.uploads, 1);
    assert.equal(calls.deletes, 1);
    assert.deepEqual(r.axes, GOOD.axes);
    assert.equal("pass" in r, false, "judge returns no verdict");
    assert.equal("verdict" in r, false);
    assert.equal(r.weak_beats.length, 1);
    assert.equal(typeof r.aggregate_local, "number");
  });
  it("sends the video as fileData and the prompt as text", async () => {
    const { calls, deps } = harness();
    await judge("v.mp4", { channelId: 2, styleSpec: {}, layer2Advisory: 0.61, ...deps });
    const body = JSON.parse(calls.http[0].opts.body);
    assert.deepEqual(body.contents[0].parts[0], { fileData: { fileUri: "https://u/x", mimeType: "video/mp4" } });
    assert.match(body.contents[0].parts[1].text, /\[ROLE\]/);
  });
  it("sends the advisory inside the prompt it actually sends", async () => {
    const { calls, deps } = harness();
    await judge("v.mp4", { channelId: 2, styleSpec: {}, layer2Advisory: 0.612, ...deps });
    const body = JSON.parse(calls.http[0].opts.body);
    assert.match(body.contents[0].parts[1].text, /0\.612/);
  });
  it("sends the responseSchema in generationConfig", async () => {
    const { calls, deps } = harness();
    await judge("v.mp4", { channelId: 2, styleSpec: {}, ...deps });
    const body = JSON.parse(calls.http[0].opts.body);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.deepEqual(body.generationConfig.responseSchema, JSON.parse(JSON.stringify(RESPONSE_SCHEMA)));
  });
  it("uses native v1beta generateContent, not the OpenAI-compat path", async () => {
    const { calls, deps } = harness();
    await judge("v.mp4", { channelId: 2, styleSpec: {}, ...deps });
    assert.match(calls.http[0].url, /generativelanguage\.googleapis\.com\/v1beta\/models\/.+:generateContent$/);
    assert.doesNotMatch(calls.http[0].url, /\/v1beta\/openai/);
  });
  it("computes the aggregate locally and ignores Gemini's own", async () => {
    const lying = { ...GOOD, aggregate: 9.9 };
    const { deps } = harness({
      http: async () => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: JSON.stringify(lying) }] } }] }, text: "" }),
    });
    const r = await judge("v.mp4", { channelId: 2, styleSpec: {}, ...deps });
    assert.ok(Math.abs(r.aggregate_local - (0.2 * 8 + 0.2 * 7 + 0.3 * 9 + 0.3 * 6)) < 1e-9, "local computation must win");
    assert.ok(Math.abs(r.aggregate_local - 9.9) > 0.5);
    assert.equal(r.aggregate_gemini, 9.9, "Gemini's number is still recorded for comparison");
  });
  it("fails loud on no_video, and still deletes the upload", async () => {
    const { calls, deps } = harness({
      http: async () => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: '{"error":"no_video"}' }] } }] }, text: "" }),
    });
    await assert.rejects(() => judge("v.mp4", { channelId: 2, styleSpec: {}, ...deps }), /reported an error: no_video/);
    assert.equal(calls.deletes, 1, "the upload must not leak when scoring fails");
  });
  it("fails loud on malformed JSON, and still deletes", async () => {
    const { calls, deps } = harness({
      http: async () => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: "looks good to me" }] } }] }, text: "" }),
    });
    await assert.rejects(() => judge("v.mp4", { channelId: 2, styleSpec: {}, ...deps }), /not JSON/);
    assert.equal(calls.deletes, 1);
  });
  it("deletes even when the scoring call throws", async () => {
    const { calls, deps } = harness({ http: async () => { throw new Error("socket hang up"); } });
    await assert.rejects(() => judge("v.mp4", { channelId: 2, styleSpec: {}, ...deps }), /socket hang up/);
    assert.equal(calls.deletes, 1);
  });
  it("propagates a delete failure rather than returning a score", async () => {
    const { deps } = harness({ del: async () => { throw new Error("delete failed: HTTP 500"); } });
    await assert.rejects(() => judge("v.mp4", { channelId: 2, styleSpec: {}, ...deps }), /delete failed: HTTP 500/);
  });
  it("refuses to score a file that is not ACTIVE", async () => {
    const { calls, deps } = harness({ poll: async () => ({ state: "PROCESSING", uri: "u" }) });
    await assert.rejects(() => judge("v.mp4", { channelId: 2, styleSpec: {}, ...deps }), /is PROCESSING, not ACTIVE/);
    assert.equal(calls.deletes, 1);
  });
  it("rotates to its own fallback model on quota", async () => {
    const { calls, deps } = harness({
      http: async (url) => {
        calls.http.push({ url, opts: {} });
        return url.includes(MODEL) ? { status: 429, text: "quota exceeded", json: null } : okHttp();
      },
    });
    const r = await judge("v.mp4", { channelId: 2, styleSpec: {}, ...deps });
    assert.equal(r.model, MODEL_FALLBACK);
    assert.match(calls.http[1].url, new RegExp(MODEL_FALLBACK));
  });
  it("retries once on 503 before spending the fallback", async () => {
    let n = 0;
    const { deps } = harness({
      http: async (url) => {
        n++;
        return url.includes(MODEL) && n < 2 ? { status: 503, text: "high demand", json: null } : okHttp();
      },
    });
    const r = await judge("v.mp4", { channelId: 2, styleSpec: {}, ...deps });
    assert.equal(r.model, MODEL);
  });
  it("writes provenance including the advisory", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const { deps } = harness({ provenance: true });
    const r = await judge("v.mp4", { channelId: "9999", styleSpec: {}, layer2Advisory: 0.77, ...deps, runId: "unit-test" });
    assert.ok(r.provenance_path);
    const line = JSON.parse(readFileSync(r.provenance_path, "utf8").trim().split("\n").pop());
    assert.equal(line.channel, "9999");
    assert.equal(line.provider, "gemini");
    assert.equal(line.layer2_advisory, 0.77);
    assert.ok(line.axes && typeof line.aggregate_local === "number");
    assert.ok(line.raw_response.includes("engagement"));
    try { readFileSync(r.provenance_path); existsSync(r.provenance_path); } catch { /* best effort */ }
  });
});