/**
 * Layer 3 timestamps -> beat indices (eval-layer3-judge.js resolveBeatIndices). Before: every named
 * weak beat reached the retry loop with beat_index undefined ("does not identify a beat in the
 * plan"), so live could not act (CI runs 37705693390, 37718157561, 37723570093).
 *
 * MUTATION (run, recorded in the commit): making resolveBeatIndices return its input unchanged turns
 * the replay and boundary tests red. Restored byte-identical.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTimestamp, resolveBeatIndices, judge } from "../eval-layer3-judge.js";
import { resolveRevisions } from "../eval-retry-loop.js";

const fx = JSON.parse(readFileSync("scripts/fixtures/layer3-replay/run-37723570093.json", "utf8"));
const at = (ts, m = fx.manifest) => resolveBeatIndices([{ timestamp: ts, axis: "composition", element: "composition", finding: "x" }], m)[0];

describe("parseTimestamp", () => {
  it("MM:SS, M:SS, H:MM:SS and fractions", () => {
    assert.equal(parseTimestamp("00:17"), 17);
    assert.equal(parseTimestamp("1:05"), 65);
    assert.equal(parseTimestamp("1:00:02"), 3602);
    assert.equal(parseTimestamp("00:12.5"), 12.5);
  });
  it("malformed is null", () => {
    for (const t of ["", "17", "00:61", "ab:cd", null, undefined, "00:1"]) assert.equal(parseTimestamp(t), null, String(t));
  });
});

describe("boundaries (manifest beats [start, start + duration))", () => {
  it("inside a beat", () => assert.equal(at("00:17").beat_index, 2));
  it("exactly at a beat's start belongs to that beat", () => {
    const m = { beats: [{ index: 0, start_sec: 0, duration_sec: 5 }, { index: 1, start_sec: 5, duration_sec: 5 }] };
    assert.equal(at("00:05", m).beat_index, 1);
    assert.equal(at("00:04", m).beat_index, 0);
  });
  it("'00:00' before beat 0's 0.10 s start is beat 0, read at the timestamp's one-second resolution", () => assert.equal(at("00:00").beat_index, 0));
  it("past the last beat is unresolved: out of range, not guessed", () => {
    const r = at("01:30");
    assert.equal(r.beat_index, undefined);
    assert.equal(r.unresolved, "timestamp_out_of_range");
  });
  it("malformed is unresolved", () => assert.equal(at("seventeen").unresolved, "timestamp_malformed"));
  it("overlapping beats: the earlier, marked ambiguous", () => {
    const m = { beats: [{ index: 0, start_sec: 0, duration_sec: 6 }, { index: 1, start_sec: 5, duration_sec: 5 }] };
    const r = at("00:05", m);
    assert.equal(r.beat_index, 0);
    assert.equal(r.unresolved, "timestamp_ambiguous");
  });
  it("an entry that already has a beat_index is left alone", () => {
    assert.equal(resolveBeatIndices([{ timestamp: "00:17", beat_index: 7 }], fx.manifest)[0].beat_index, 7);
  });
});

describe("replay: CI run 37723570093's real Layer 3 output", () => {
  const resolved = resolveBeatIndices(fx.weak_beats, fx.manifest);
  it("every weak beat now has a beat_index", () => {
    for (const wb of resolved) assert.ok(Number.isInteger(wb.beat_index) && !wb.unresolved, JSON.stringify(wb));
    assert.deepEqual(resolved.map((w) => w.beat_index), [2, 4, 0, 4]);
  });
  it("the retry loop now resolves them into revisions instead of 'beat_index undefined'", () => {
    const beats = Array.from({ length: 10 }, () => ({ ground: "white", composition: "TYPE-FULL" }));
    const { revisions, unresolved } = resolveRevisions(resolved, beats);
    assert.ok(revisions.length >= 1, JSON.stringify(unresolved));
    assert.ok(!unresolved.some((u) => /beat_index undefined/.test(u.why || "")), JSON.stringify(unresolved));
  });
});

describe("judge() resolves them before returning", () => {
  it("weak_beats come back with beat_index from the manifest", async () => {
    const http = async () => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: JSON.stringify({ axes: { engagement: 5, prompt_intent: 6, composition: 5, style_coherence: 4 }, weak_beats: fx.weak_beats.slice(0, 2) }) }] } }] } });
    const r = await judge("x.mp4", { channelId: "5", styleSpec: null, upload: async () => ({ name: "f", uri: "u", mimeType: "video/mp4" }), poll: async () => ({ state: "ACTIVE", uri: "u" }), del: async () => {}, http, env: { GEMINI_API_KEY: "k" }, provenance: false, manifest: fx.manifest });
    assert.deepEqual(r.weak_beats.map((w) => w.beat_index), [2, 4]);
  });
});
