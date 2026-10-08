/**
 * The eval loop runs on a Layer 1 failure and records Layers 2 and 3, without
 * overriding the rejection.
 *
 * Before: render-and-qa.js `return backupAudit(...)` on a canvas-check failure BEFORE the
 * eval block, so Layers 2/3 never produced a number for a rejected render (and most renders
 * are rejected). These tests drive recordEvalLoop — the extracted call site — with a Layer 1
 * failure fixture and assert the JSONL exists and carries layer1_result + the L2/L3 numbers.
 *
 * Ordering against the early-return, and that the return still routes to backupAudit, is
 * asserted structurally in eval-loop-modes.test.js (render-and-qa.js cannot be imported).
 *
 * MUTATION (run, recorded in the commit): moving `await recordEvalLoop({` below
 * `if (canvasFailure) {` in render-and-qa.js turns the "BEFORE their early-return" test in
 * eval-loop-modes.test.js red. Restored byte-identical.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordEvalLoop } from "../eval-loop-callsite.js";

const CH = `callsite-test-${process.pid}`;
const l2 = { advisory_score: 0.62, threshold: 0.457, frame_count: 55, below_floor_count: 4, timestamps_below_floor: [1, 2], style_match: "matched", clone_frames: 0, reference_ceiling: 0.9, candidate_max: 0.87, reference_source: "stored" };
const l3 = { aggregate_local: 5.5, axes: { engagement: 6, prompt_intent: 5, composition: 5, style_coherence: 6 }, weak_beats: [] };
const quiet = { log: () => {}, logError: () => {} };
const root = mkdtempSync(join(tmpdir(), "evalloop-"));
const calls = { l2: 0, l3: 0 };
const base = () => ({
  plan: { beats: [{}, {}, {}] }, scriptPath: "/x/some-script.json", attempt: 1, channelId: CH, outputPath: "/x/v.mp4", root,
  layer2Advisory: async () => { calls.l2++; return l2; },
  judge: async () => { calls.l3++; return l3; },
  env: { EVAL_LOOP_MODE: "dry" }, ...quiet,
});
const lastLine = (p) => JSON.parse(readFileSync(p, "utf8").trim().split("\n").pop());
after(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(join(process.cwd(), "data", "audit", "layer3", CH), { recursive: true, force: true });
});

describe("eval loop on a Layer 1 failure", () => {
  it("runs Layer 2 and Layer 3 and writes the JSONL, with layer1_result failing", async () => {
    calls.l2 = calls.l3 = 0;
    const r = await recordEvalLoop({ ...base(), layer1Failures: ["zones-no-overlap", "pop-transitions"] });
    assert.equal(calls.l2, 1, "layer 2 must run on a rejected render");
    assert.equal(calls.l3, 1, "layer 3 must run on a rejected render");
    const rec = lastLine(r.auditPath);
    assert.equal(rec.layer1_result.pass, false);
    assert.deepEqual(rec.layer1_result.failures.map((f) => f.check), ["zones-no-overlap", "pop-transitions"]);
    assert.equal(rec.layer2.advisory_score, 0.62);
    assert.equal(rec.layer2.below_floor_count, 4);
    assert.equal(rec.layer2.style_match, "matched");
    assert.equal(rec.layer3.aggregate_local, 5.5);
    assert.equal(rec.layer3.axes.composition, 5);
  });
  it("records the decision as data and acts on nothing: no re-render, nothing 'rendered', human_review", async () => {
    const r = await recordEvalLoop({ ...base(), layer1Failures: ["pop-transitions"] });
    const rec = lastLine(r.auditPath);
    assert.equal(rec.decision, "human_review");
    assert.deepEqual(rec.would_rerender, [], "a Layer 1 failure is not retried at this call site");
    assert.deepEqual(rec.rendered, []);
    assert.equal(rec.retries_spent, 0);
    assert.match(rec.why, /layer 1 failed \(pop-transitions\); layers 2 and 3 recorded, not acted on/);
  });
  it("still records when Layer 3 throws — and does not throw", async () => {
    const r = await recordEvalLoop({ ...base(), judge: async () => { throw new Error("gemini 503"); }, layer1Failures: ["pop-transitions"] });
    const rec = lastLine(r.auditPath);
    assert.equal(rec.layer1_result.pass, false);
    assert.equal(rec.layer2.advisory_score, 0.62, "layer 2 is still on record");
    assert.match(rec.layer3.error, /gemini 503/);
  });
  it("still records when Layer 2 cannot run", async () => {
    const r = await recordEvalLoop({ ...base(), layer2Advisory: async () => { throw new Error("no ffmpeg"); }, layer1Failures: ["pop-transitions"] });
    const rec = lastLine(r.auditPath);
    assert.equal(rec.layer2.advisory_score, null);
    assert.match(rec.layer2.note, /no ffmpeg/);
    assert.equal(rec.layer3.aggregate_local, 5.5);
  });
});

describe("eval loop when Layer 1 passes, and when off", () => {
  it("layer1_result passes and the judged aggregate is recorded", async () => {
    const r = await recordEvalLoop({ ...base(), layer1Failures: null });
    const rec = lastLine(r.auditPath);
    assert.equal(rec.layer1_result.pass, true);
    assert.equal(rec.layer3.aggregate_local, 5.5);
    assert.ok(["human_review", "retry", "accept"].includes(rec.decision));
  });
  it("off returns null and runs nothing", async () => {
    calls.l2 = calls.l3 = 0;
    const r = await recordEvalLoop({ ...base(), env: {}, layer1Failures: ["pop-transitions"] });
    assert.equal(r, null);
    assert.equal(calls.l2 + calls.l3, 0);
  });
});

describe("Layer 3's axes and named beats reach the record on every judged path", () => {
  it("a Layer 1 pass judged below 7 with nothing named (CI run 37703727115) keeps its axes", async () => {
    const r = await recordEvalLoop({ ...base(), layer1Failures: null, judge: async () => ({ aggregate_local: 6.59, axes: { engagement: 6.2, prompt_intent: 6.8, composition: 6.5, style_coherence: 6.8 }, weak_beats: [] }) });
    const rec = lastLine(r.auditPath);
    assert.equal(rec.layer1_result.pass, true);
    assert.equal(rec.decision, "human_review");
    assert.deepEqual(rec.layer3.axes, { engagement: 6.2, prompt_intent: 6.8, composition: 6.5, style_coherence: 6.8 });
    assert.deepEqual(rec.layer3.weak_beats, []);
  });
  it("an accepted render keeps its axes", async () => {
    const r = await recordEvalLoop({ ...base(), layer1Failures: null, judge: async () => ({ aggregate_local: 7.4, axes: { engagement: 7 }, weak_beats: [] }) });
    const rec = lastLine(r.auditPath);
    assert.equal(rec.decision, "accept");
    assert.deepEqual(rec.layer3.axes, { engagement: 7 });
  });
});
