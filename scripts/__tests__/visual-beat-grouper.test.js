import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupCuesIntoBeats } from "../visual-beat-grouper.js";

describe("visual-beat-grouper", () => {
  it("groups consecutive cues into beats", () => {
    const cues = [
      { start: 0, end: 1.5, text: "First sentence." },
      { start: 1.8, end: 3.5, text: "Second sentence." },
      { start: 4.0, end: 6.0, text: "Third sentence." },
    ];
    const beats = groupCuesIntoBeats(cues, {});
    assert.ok(beats.length >= 1, "Should produce at least 1 beat");
    assert.ok(beats.length <= cues.length, "Beats should not exceed cues");
  });

  it("merges cues separated by short pauses", () => {
    const cues = [
      { start: 0, end: 1.0, text: "Part one" },
      { start: 1.1, end: 2.0, text: "part two" },
      { start: 2.2, end: 3.0, text: "part three" },
    ];
    const beats = groupCuesIntoBeats(cues, { pauseThreshold: 0.3 });
    assert.ok(beats.length <= 2, "Short pauses should merge cues");
  });

  it("handles empty input", () => {
    const beats = groupCuesIntoBeats([], {});
    assert.equal(beats.length, 0, "Empty input should produce empty output");
  });

  it("handles single cue", () => {
    const cues = [{ start: 0, end: 2.0, text: "Only one" }];
    const beats = groupCuesIntoBeats(cues, {});
    assert.equal(beats.length, 1, "Single cue should produce one beat");
  });

  it("preserves timing information", () => {
    const cues = [
      { start: 0, end: 1.0, text: "First" },
      { start: 1.5, end: 3.0, text: "Second" },
    ];
    const beats = groupCuesIntoBeats(cues, {});
    assert.ok(beats[0].start >= 0, "Beat start should be >= 0");
    assert.ok(beats[0].end > beats[0].start, "Beat end should be after start");
  });
});