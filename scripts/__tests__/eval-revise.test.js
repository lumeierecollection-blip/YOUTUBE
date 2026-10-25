/**
 * The eval loop's revise step (scripts/eval-revise.js) and the live call site that applies it
 * (scripts/eval-loop-callsite.js).
 *
 * The reviser's answer is never trusted: every gate of the owner's revise prompt is re-checked in code.
 * MUTATIONS (run, recorded in the commit): dropping the Gate 1 score-talk check, the Gate 2
 * drawability check, or the "not judged lower" ship rule each turns a test here red. Restored
 * byte-identical.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validatePatch, reviseBeats, beatFacts, REVISE_PROMPT, MAX_REVISED_BEATS } from "../eval-revise.js";
import { recordEvalLoop } from "../eval-loop-callsite.js";
import { TEXT_GRID, canvasLayout, normalizeCanvas } from "../../src/skills/remotion-render/visual/canvas-layout.js";
// A layout patch is judged by what it changes in canvasLayout's pre-grid placement; production draws every beat on the one text grid, which TEXT_GRID.on = false steps out of for this test.
TEXT_GRID.on = false;

const proc = (layout) => ({ visual_type: "PROCESS", composition: "PROCESS-FULL", data: { nodes: ["higher rates", "rent", "savings"] }, headline: "The chain", motion_tier: "medium", ...(layout ? { layout } : {}) });
const plan = (layouts = []) => ({ beats: [0, 1, 2, 3, 4, 5].map((i) => ({ index: i, layout: layouts[i] || null, canvas: proc(layouts[i]) })) });
const legal = { cols: 4, rows: 4, slots: [{ id: "headline", col: 2, col_span: 2, row: 0, align: "right" }] };
const ch = (vc = "The headline hugs the left edge while the diagram fills the right, so the eye starts on empty space.") => [{ field: "layout.slots[headline]", visible_consequence: vc, old: null, new: legal.slots[0], forced_by: "composition" }];
const ok = (beat_index = 0, layout = legal, changes = ch()) => ({ beat_index, layout, changes });

describe("validatePatch: anti-churn", () => {
  it("a video that passed Layer 1 at or above the band is not revised", () => {
    const v = validatePatch({ patches: [ok()] }, { plan: plan(), flagged: [0], layer1Pass: true, aggregate: 7.2 });
    assert.deepEqual(v.accepted, []);
    assert.match(v.reason, /not revised/);
  });
  it("only beats Layer 3 flagged", () => {
    const v = validatePatch({ patches: [ok(1)] }, { plan: plan(), flagged: [0], layer1Pass: true, aggregate: 6 });
    assert.deepEqual(v.accepted, []);
    assert.match(v.rejected[0].why, /not a beat Layer 3 flagged/);
  });
  it(`at most ${MAX_REVISED_BEATS} beats per video`, () => {
    // Even beats: the default puts this headline left, so the patch is a visible change on each.
    const v = validatePatch({ patches: [ok(0), ok(2), ok(4)] }, { plan: plan(), flagged: [0, 2, 4], layer1Pass: true, aggregate: 6 });
    assert.equal(v.accepted.length, 2);
    assert.match(v.rejected[0].why, /more than 2/);
  });
  it("a patch that changes nothing a viewer sees is rejected", () => {
    const v = validatePatch({ patches: [ok(0, legal)] }, { plan: plan([legal]), flagged: [0], layer1Pass: true, aggregate: 6 });
    assert.match(v.rejected[0].why, /changes nothing a viewer sees/);
  });
});

describe("validatePatch: Gate 1 — a visible consequence, in words", () => {
  for (const vc of ["Composition scored 6.4", "Style coherence is 0.3 below the run mean", "lift the axis", ""]) {
    it(`rejects "${vc}"`, () => {
      const v = validatePatch({ patches: [ok(0, legal, ch(vc))] }, { plan: plan(), flagged: [0], layer1Pass: true, aggregate: 6 });
      assert.deepEqual(v.accepted, []);
      assert.match(v.rejected[0].why, /gate 1/);
    });
  }
  it("accepts a defect a viewer sees", () => {
    const v = validatePatch({ patches: [ok()] }, { plan: plan(), flagged: [0], layer1Pass: true, aggregate: 6 });
    assert.equal(v.accepted.length, 1);
  });
});

describe("validatePatch: Gate 2 — a legal, field-level layout patch drawable as given", () => {
  it("rejects a field other than the layout (a text change would change a claim)", () => {
    const v = validatePatch({ patches: [{ ...ok(), headline: "New words" }] }, { plan: plan(), flagged: [0], layer1Pass: true, aggregate: 6 });
    assert.match(v.rejected[0].why, /fields other than the layout/);
  });
  it("rejects a layout the canvas would not draw as given (headline into the nodes' zone)", () => {
    const bad = { cols: 3, rows: 4, slots: [{ id: "headline", col: 2, row: 3, align: "right", v_align: "bottom" }] };
    const v = validatePatch({ patches: [ok(0, bad)] }, { plan: plan(), flagged: [0], layer1Pass: true, aggregate: 6 });
    assert.match(v.rejected[0].why, /gate 2/);
  });
  it("keeps the planner's side: a slot it aligned left is not flipped right", () => {
    const planned = { cols: 4, rows: 4, slots: [{ id: "headline", col: 0, col_span: 2, row: 0, align: "left" }] };
    const v = validatePatch({ patches: [ok(0, legal)] }, { plan: plan([planned]), flagged: [0], layer1Pass: true, aggregate: 6 });
    assert.match(v.rejected[0].why, /flips the planner's side for headline/);
  });
});

describe("reviseBeats", () => {
  it("applies an accepted patch to that beat only, and logs the visible consequence", async () => {
    const logs = [];
    const r = await reviseBeats({ plan: plan(), weakBeats: [{ timestamp: "00:01", axis: "composition", element: "composition", finding: "x", beat_index: 0 }], layer1: { pass: true, failures: [] }, layer3: { aggregate_local: 6 }, callModel: async () => ({ patches: [ok()] }), log: (m) => logs.push(m) });
    assert.deepEqual(r.changedBeats, [0]);
    assert.deepEqual(r.planPatch.beats[0].layout, legal);
    assert.deepEqual(r.planPatch.beats[0].canvas.layout, legal);
    assert.equal(r.planPatch.beats[1].layout, null);
    assert.ok(logs.some((l) => /beat 0: The headline hugs the left edge/.test(l)));
  });
  it("an empty patch is a valid answer", async () => {
    const r = await reviseBeats({ plan: plan(), weakBeats: [{ beat_index: 0, timestamp: "00:01" }], layer1: { pass: true }, layer3: { aggregate_local: 6 }, callModel: async () => ({ patches: [], reason: "nothing a viewer would notice" }) });
    assert.equal(r.planPatch, null);
    assert.match(r.record.reason, /nothing a viewer would notice/);
  });
  it("the prompt carries the owner's text verbatim and the beat's facts", () => {
    assert.match(REVISE_PROMPT, /GATE 1 — VISIBLE CONSEQUENCE/);
    assert.match(REVISE_PROMPT, /An empty\npatch is a valid, expected result/);
    const f = beatFacts({ plan: plan(), beatIndex: 0, manifest: { beats: [{ start_sec: 0, duration_sec: 3 }] }, inkSpans: { 0: 0.61 }, layer1: { pass: true }, layer3: { aggregate_local: 6, axes: { composition: 5 } }, weakBeats: [{ beat_index: 0, axis: "composition" }] });
    assert.equal(f.rendered.ink_span, 0.61);
    assert.equal(f.acceptance_band, 7);
    assert.ok(f.rendered.bottom_bound <= 1340);
  });
});

describe("live call site: revise, re-render, keep or restore", () => {
  const dir = mkdtempSync(join(tmpdir(), "revise-live-"));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const base = (mp4, judges, extra = {}) => {
    let n = 0;
    return {
      plan: plan(), scriptPath: "/x/s.json", attempt: 1, channelId: `revise-test-${process.pid}`, outputPath: mp4, layer1Failures: null, root: dir,
      layer2Advisory: async () => ({ advisory_score: 0.6, threshold: 0.45, frame_count: 1, below_floor_count: 0, style_match: "matched", clone_frames: 0, reference_ceiling: 0.9, candidate_max: 0.7, reference_source: "t" }),
      judge: async () => judges[Math.min(n++, judges.length - 1)],
      callModel: async () => ({ patches: [ok()] }),
      rerender: async () => { writeFileSync(mp4, "REVISED"); return { outputPath: mp4 }; },
      canvasCheck: async () => ({ failures: [], inkSpans: {} }),
      readManifest: () => null,
      env: { EVAL_LOOP_MODE: "live" }, log: () => {}, logError: () => {}, ...extra,
    };
  };
  const weak = { aggregate_local: 6, axes: { composition: 5 }, weak_beats: [{ timestamp: "00:01", axis: "composition", element: "composition", finding: "x", beat_index: 0 }] };
  const lastRec = (p) => JSON.parse(readFileSync(p, "utf8").trim().split("\n").pop());

  it("a revision that passes Layer 1 and is judged higher ships", async () => {
    const mp4 = join(dir, "a.mp4"); writeFileSync(mp4, "ORIGINAL");
    const r = await recordEvalLoop(base(mp4, [weak, { aggregate_local: 7.3, axes: {}, weak_beats: [] }]));
    const rec = lastRec(r.auditPath);
    assert.equal(rec.decision, "accept");
    assert.deepEqual(rec.rendered, [0]);
    assert.equal(rec.shipped, "revised");
    assert.equal(readFileSync(mp4, "utf8"), "REVISED");
  });
  it("a revision judged lower is rolled back: the original is restored", async () => {
    const mp4 = join(dir, "b.mp4"); writeFileSync(mp4, "ORIGINAL");
    const r = await recordEvalLoop(base(mp4, [weak, { ...weak, aggregate_local: 5, weak_beats: [] }]));
    const rec = lastRec(r.auditPath);
    assert.equal(rec.shipped, "original (restored)");
    assert.equal(readFileSync(mp4, "utf8"), "ORIGINAL");
  });
  it("a revision that fails Layer 1 is rolled back", async () => {
    const mp4 = join(dir, "c.mp4"); writeFileSync(mp4, "ORIGINAL");
    const r = await recordEvalLoop(base(mp4, [weak, { aggregate_local: 8, axes: {}, weak_beats: [] }], { canvasCheck: async () => ({ failures: ["zones-no-overlap"], inkSpans: {} }) }));
    assert.equal(lastRec(r.auditPath).shipped, "original (restored)");
    assert.equal(readFileSync(mp4, "utf8"), "ORIGINAL");
  });
  it("dry decides and records the patch, renders nothing", async () => {
    const mp4 = join(dir, "d.mp4"); writeFileSync(mp4, "ORIGINAL");
    let rendered = 0;
    const r = await recordEvalLoop(base(mp4, [weak], { env: { EVAL_LOOP_MODE: "dry" }, rerender: async () => { rendered++; return { outputPath: mp4 }; } }));
    const rec = lastRec(r.auditPath);
    assert.deepEqual(rec.would_rerender, [0]);
    assert.deepEqual(rec.rendered, []);
    assert.equal(rendered, 0);
    assert.equal(readFileSync(mp4, "utf8"), "ORIGINAL");
  });
  it("an empty patch: the video ships as rendered, nothing re-rendered", async () => {
    const mp4 = join(dir, "e.mp4"); writeFileSync(mp4, "ORIGINAL");
    const r = await recordEvalLoop(base(mp4, [weak], { callModel: async () => ({ patches: [], reason: "no visible defect" }) }));
    const rec = lastRec(r.auditPath);
    assert.equal(rec.decision, "ship_as_rendered");
    assert.deepEqual(rec.rendered, []);
  });
});

after(() => rmSync(join(process.cwd(), "data", "audit", "layer3", `revise-test-${process.pid}`), { recursive: true, force: true }));
