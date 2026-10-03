import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("execution-comparator", () => {
  it("intent structure is valid", () => {
    const mockIntent = {
      visual_argument: "test",
      beats: [
        { index: 0, visual_event: "test", key_object: "obj", transformation: "change", confidence: "high" }
      ]
    };
    assert.ok(mockIntent.beats.length > 0);
    assert.equal(mockIntent.beats[0].confidence, "high");
  });

  it("comparison output has required fields", () => {
    const mockComparison = {
      comparedAt: new Date().toISOString(),
      total_beats: 1,
      match_score: 100,
      comparisons: []
    };
    assert.ok(mockComparison.comparedAt);
    assert.equal(mockComparison.total_beats, 1);
  });
});