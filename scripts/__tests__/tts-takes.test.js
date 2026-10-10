// The narration retake loop (src/utils/tts-takes.js): it decides which take is KEPT, never what the judge accepts.
// Board 38044082797 ch 26: one Gemini take scored 5-6 on every sentence and held a video whose other takes would have passed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseTake } from "../../src/utils/tts-takes.js";

/** A fake disk: record(take) writes `take` into disk.live; save/restore move it to / from disk.best. */
const rig = (verdicts, { recordFails = [] } = {}) => {
  const disk = { live: null, best: null }, calls = [];
  return {
    disk, calls,
    run: (takes = 3) => chooseTake({
      takes,
      record: (t) => { calls.push(`record ${t}`); if (recordFails.includes(t)) return false; disk.live = `take-${t}`; return true; },
      judge: (t) => { calls.push(`judge ${t}`); return verdicts[t - 1]; },
      save: () => { calls.push("save"); disk.best = disk.live; },
      restore: () => { calls.push("restore"); disk.live = disk.best; },
    }),
  };
};

test("the first take that passes is kept, and nothing more is recorded", () => {
  const r = rig([{ status: "pass" }]);
  assert.deepEqual(r.run(), { outcome: "pass", take: 1 });
  assert.deepEqual(r.calls, ["record 1", "judge 1"]);
});

test("a failing take is re-recorded; the take that passes is kept", () => {
  const r = rig([{ status: "fail", mean: 5.2 }, { status: "pass" }]);
  assert.deepEqual(r.run(), { outcome: "pass", take: 2 });
  assert.equal(r.disk.live, "take-2");
});

test("when no take passes, the BEST one is put back (not the last)", () => {
  const r = rig([{ status: "fail", mean: 5.0 }, { status: "fail", mean: 6.4 }, { status: "fail", mean: 5.5 }]);
  const out = r.run();
  assert.equal(out.outcome, "best");
  assert.equal(out.take, 2);
  assert.equal(r.disk.live, "take-2", "the 6.4 take is what ends up on disk");
  assert.equal(r.calls.filter((c) => c.startsWith("record")).length, 3, "at most `takes` takes");
});

test("a judge that cannot run keeps the take it was given (no retake spiral)", () => {
  const r = rig([{ status: "unavailable" }]);
  assert.deepEqual(r.run(), { outcome: "unavailable", take: 1 });
  assert.deepEqual(r.calls, ["record 1", "judge 1"]);
});

test("no take could be made at all: outcome none, so the caller falls back to the next voice", () => {
  const r = rig([], { recordFails: [1] });
  assert.deepEqual(r.run(), { outcome: "none" });
});

test("a later recording failure keeps the best earlier take", () => {
  const r = rig([{ status: "fail", mean: 6.0 }], { recordFails: [2] });
  const out = r.run();
  assert.equal(out.outcome, "best");
  assert.equal(r.disk.live, "take-1");
});

test("takes = 1 records once and judges once", () => {
  const r = rig([{ status: "fail", mean: 4 }]);
  const out = r.run(1);
  assert.equal(out.outcome, "best");
  assert.equal(r.calls.filter((c) => c.startsWith("record")).length, 1);
});
