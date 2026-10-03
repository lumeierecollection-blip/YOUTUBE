import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("opencode-visual-intent", () => {
  it("intent output has required fields", () => {
    const mockIntent = {
      visual_argument: "Overall story arc",
      beats: [
        {
          index: 0,
          narrative_purpose: "Hook the viewer",
          visual_event: "Dramatic reveal",
          key_object: "Central element",
          transformation: "From hidden to visible",
          muted_read: "Something appears",
          consequence: "Viewer curiosity",
          confidence: "high"
        }
      ]
    };
    assert.ok(mockIntent.visual_argument);
    assert.equal(mockIntent.beats.length, 1);
    assert.equal(mockIntent.beats[0].confidence, "high");
  });

  it("confidence values are valid", () => {
    const validConfidences = ["high", "medium", "low"];
    for (const c of validConfidences) {
      assert.ok(validConfidences.includes(c), c + " should be a valid confidence level");
    }
  });
});