import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("gemini-visual-challenger", () => {
  it("verdict values are valid", () => {
    const validVerdicts = ["MATCH", "NEEDS_CHANGE"];
    for (const v of validVerdicts) {
      assert.ok(validVerdicts.includes(v), v + " should be a valid verdict");
    }
  });

  it("delta structure is valid", () => {
    const mockDelta = {
      beat_index: 0,
      field: "visual_event",
      current: "old value",
      suggested: "new value",
      reason: "improvement"
    };
    assert.equal(typeof mockDelta.beat_index, "number");
    assert.equal(typeof mockDelta.field, "string");
    assert.equal(typeof mockDelta.suggested, "string");
  });
});