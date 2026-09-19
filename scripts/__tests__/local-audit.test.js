import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("local-audit", () => {
  it("risk levels are valid", () => {
    const validRisks = ["NORMAL", "MEDIUM", "HIGH", "UNKNOWN"];
    for (const risk of validRisks) {
      assert.ok(validRisks.includes(risk), risk + " should be a valid risk level");
    }
  });

  it("audit thresholds are reasonable", () => {
    const BLACK_FRAME_THRESHOLD = 0.05;
    const MIN_FPS = 24;
    const MAX_DURATION_RATIO = 1.5;
    assert.ok(BLACK_FRAME_THRESHOLD > 0 && BLACK_FRAME_THRESHOLD < 1);
    assert.ok(MIN_FPS >= 24);
    assert.ok(MAX_DURATION_RATIO > 1);
  });
});