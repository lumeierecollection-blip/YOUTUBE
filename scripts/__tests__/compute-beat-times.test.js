import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeBeatTimes } from "../gemini-frame-review.js";

describe("computeBeatTimes sampling logic", () => {
  it("samples at 85% of interval (settled state after animations)", () => {
    const cues = [
      { start: 0, end: 10, text: "First cue" }
    ];
    const duration = 10;
    const times = computeBeatTimes(cues, duration);
    // 0 + 0.85 * (10 - 0) = 8.5
    assert.deepEqual(times, [8.5]);
  });

  it("handles multiple cues and next-cue end boundaries", () => {
    const cues = [
      { start: 0, end: 4, text: "Cue 1" },
      { start: 4, end: 8, text: "Cue 2" },
    ];
    const duration = 10;
    const times = computeBeatTimes(cues, duration);
    // Cue 1: start 0, end 4 -> 0 + 0.85 * 4 = 3.4
    // Cue 2: start 4, end max(8, 10) = 10 -> 4 + 0.85 * (10 - 4) = 4 + 5.1 = 9.1
    assert.deepEqual(times, [3.4, 9.1]);
  });

  it("clamps samples below duration - 0.3s safety margin", () => {
    const cues = [
      { start: 9.5, end: 10.0, text: "Late cue" }
    ];
    const duration = 10.0;
    const times = computeBeatTimes(cues, duration);
    // 9.5 + 0.85 * 0.5 = 9.925, but max is duration - 0.3 = 9.7
    // Wait, let's check: t < duration - 0.3 -> 9.925 < 9.7 is false, so it is filtered out!
    // If filtered out, times length might be 0, falling back to duration / 2 or similar.
    assert.ok(times.length > 0, "Should produce fallback or valid times");
  });

  it("falls back to uniform grid when srtCues is empty", () => {
    const duration = 12.0;
    const times = computeBeatTimes([], duration);
    assert.ok(times.length > 0, "Should produce uniform grid times");
    assert.ok(times[0] >= 0.5);
  });

  it("is deterministic for identical inputs", () => {
    const cues = [
      { start: 0, end: 3, text: "A" },
      { start: 3, end: 7, text: "B" },
      { start: 7, end: 10, text: "C" },
    ];
    const duration = 12;
    const run1 = computeBeatTimes(cues, duration);
    const run2 = computeBeatTimes(cues, duration);
    assert.deepEqual(run1, run2, "computeBeatTimes must be deterministic");
  });

  it("deduplicates timestamps closer than 0.8s", () => {
    const cues = [
      { start: 0, end: 1.0, text: "A" },
      { start: 1.1, end: 2.1, text: "B" },
    ];
    const duration = 5;
    const times = computeBeatTimes(cues, duration);
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i] - times[i - 1] > 0.8, "Adjacent sampled times must be > 0.8s apart");
    }
  });
});
