// QA loop controller + sidecar adapters (scripts/qa/loop.mjs, defects.mjs). Fixtures copy the real sidecar shapes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runQaLoop } from "../qa/loop.mjs";
import { makeDefect, fromLocalAudit, fromBeatCheck, fromCameraCheck, fromFrameReview, writeDefectReport } from "../qa/defects.mjs";

const D = (check, severity, beat = null) => makeDefect({ check, severity, source: "objective", beat_index: beat, evidence: check });
const run = (sequence, repairs, budgets = { maxAttempts: 5 }) => {
  let n = 0, r = 0, clock = 0;
  return runQaLoop({
    render: async () => ++n,
    inspect: async (ctx) => sequence[Math.min(ctx - 1, sequence.length - 1)],
    repair: async () => repairs[Math.min(r++, repairs.length - 1)],
    now: () => (clock += 10), budgets,
  });
};

test("passes as soon as only minor defects remain", async () => {
  const res = await run([[D("a", "major", 1)], [D("m", "minor")]], [{ changed: true, cost: 2 }]);
  assert.equal(res.status, "pass");
  assert.equal(res.attempts.length, 2);
  assert.equal(res.total_cost, 2);
  assert.deepEqual(res.unresolved, []);
});

test("stops with unresolved when repair changes nothing", async () => {
  const res = await run([[D("a", "blocker", 1)]], [{ changed: false }]);
  assert.equal(res.status, "unresolved");
  assert.equal(res.attempts.length, 1);
  assert.equal(res.unresolved.length, 1);
});

test("same defect set twice is no-progress", async () => {
  const res = await run([[D("a", "major", 1)], [D("a", "major", 1)]], [{ changed: true }]);
  assert.equal(res.status, "no-progress");
  assert.equal(res.attempts.length, 2);
});

test("maxAttempts, maxCostUnits and maxMs each exhaust the budget", async () => {
  const seq = [[D("a", "major", 1)], [D("b", "major", 2)], [D("c", "major", 3)], [D("d", "major", 4)]];
  const rep = [{ changed: true, cost: 5 }];
  assert.equal((await run(seq, rep, { maxAttempts: 2 })).status, "budget-exhausted");
  assert.equal((await run(seq, rep, { maxAttempts: 9, maxCostUnits: 5 })).attempts.length, 2);
  assert.equal((await run(seq, rep, { maxAttempts: 9, maxMs: 15 })).status, "budget-exhausted");
});

test("a repair that adds a blocker in a clean scene is reported and the best attempt is kept and reverted to", async () => {
  let reverted = null, n = 0;
  const res = await runQaLoop({
    render: async () => ++n,
    inspect: async (c) => (c === 1 ? [D("x", "major", 1)] : [D("x", "major", 1), D("y", "blocker", 7)]),
    repair: async () => ({ changed: true }),
    revert: async (a) => { reverted = a; },
    budgets: { maxAttempts: 2 },
  });
  assert.deepEqual(res.attempts[1].regressions, ["y||7"]);
  assert.equal(res.best_attempt, 1);
  assert.equal(res.reverted_to_best, true);
  assert.equal(reverted, 1);
  assert.equal(res.unresolved.length, 1);
});

test("fromLocalAudit keeps only failing checks and reads the beat from the detail", () => {
  const d = fromLocalAudit({ video: "v.mp4", pass: false, checks: [{ id: "pace", pass: false, detail: "beat 3: 2.40 s with nothing moving (max 2 s)" }, { id: "canvas-fit", pass: true, detail: "ok" }] });
  assert.equal(d.length, 1);
  assert.equal(d[0].check, "pace");
  assert.equal(d[0].beat_index, 3);
  assert.equal(d[0].source, "audit");
});

test("fromBeatCheck: NO verdicts become vision defects, wrong-person is a blocker", () => {
  const d = fromBeatCheck({ beats: [{ beat_index: 0, matches: "YES" }, { beat_index: 1, matches: "NO", what_is_shown: "a map", reason: "wrong-person photo", sentence: "Lee won" }, { beat_index: 2, matches: "NO", what_is_shown: "text", reason: "off topic" }], failing: [1, 2], wrong_person: [1] }, { beatTimes: [1, 5, 9] });
  assert.deepEqual(d.map((x) => [x.beat_index, x.severity, x.t_start]), [[1, "blocker", 5], [2, "major", 9]]);
  assert.equal(d[0].source, "vision");
});

test("fromCameraCheck keeps only beats whose move was not real", () => {
  const d = fromCameraCheck({ beats: [{ beat_index: 0, moved: "YES", real: true }, { beat_index: 1, moved: "NO", change: "static", real: false, pixels: { what: "scale 1" } }], failing: [1] });
  assert.equal(d.length, 1);
  assert.equal(d[0].beat_index, 1);
});

test("fromFrameReview maps persisted severity/status (best effort) and skips passes and errors", () => {
  const d = fromFrameReview({ sceneResults: [{ frame_index: 0, status: "PASS", quality_score: 9 }, { frame_index: 1, status: "FAIL", problem: "clipped text", quality_score: 3, categories: ["TEXT"], severity: "CRITICAL", correction: { level: "CRITICAL", action: "shrink" } }, { frame_index: 2, error: "x" }] }, { beatTimes: [1, 5, 9] });
  assert.equal(d.length, 1);
  assert.equal(d[0].severity, "blocker");
  assert.equal(d[0].t_start, 5);
  assert.equal(d[0].repair.kind, "gemini-correction");
});

test("writeDefectReport writes json and a severity-ordered markdown table", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-rep-"));
  try {
    const { jsonPath, mdPath } = writeDefectReport(dir, "v", [D("minor-one", "minor"), makeDefect({ check: "aspect", source: "objective", severity: "blocker", t_start: 0, t_end: 3, evidence: "a | b" })], { x: 1 });
    const j = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(j.defects[0].severity, "blocker");
    assert.deepEqual(Object.keys(j.defects[0]), ["id", "check", "source", "severity", "scene_id", "beat_index", "t_start", "t_end", "frame_paths", "evidence", "expected", "actual", "repair", "status"]);
    const md = readFileSync(mdPath, "utf8");
    assert.ok(md.indexOf("## blocker") < md.indexOf("## minor"));
    assert.ok(md.includes("a \\| b"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
