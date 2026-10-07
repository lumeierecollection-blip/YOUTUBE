import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadStyleReference, styleReferenceBlock } from "../channel-style-reference.js";
import { buildPlanPromptParts } from "../gemini-visual-plan.js";

describe("1.5 the channel style spec reaches the planner as reference", () => {
  it("loads channels/ch-05/style-spec.json for dispatch key 5 (not Harmony's)", () => {
    const s = loadStyleReference("5");
    assert.ok(s.ref, s.why);
    assert.equal(s.channel, "ch-05");
    assert.equal(s.ref.channel, "Broadsheet");
    assert.equal(s.ref.editing_style_name, "newspaper-collage");
    assert.ok(!("reference_video" in s.ref), "the reference video path is not a prompt field");
  });
  it("a channel with no spec is not an error: ref null and a reason (style_spec_missing)", () => {
    const s = loadStyleReference("26");
    assert.equal(s.ref, null);
    assert.match(s.why, /no style spec/);
  });
  it("the block is framed as reference, not instruction", () => {
    const s = loadStyleReference("5");
    const block = styleReferenceBlock(s.ref);
    assert.match(block, /reference, not instruction/);
    assert.doesNotMatch(block, /\bmust\b/i);
    assert.equal(styleReferenceBlock(null), "");
  });
  it("it goes into the per-video part of the prompt, so the cached static part stays channel-independent", () => {
    const s = loadStyleReference("5");
    const sentences = [{ start: 0, end: 3, text: "One." }, { start: 3, end: 6, text: "Two." }];
    const withRef = buildPlanPromptParts(sentences, null, "5", s.ref);
    const without = buildPlanPromptParts(sentences, null, "5", null);
    assert.equal(withRef.staticPart, without.staticPart);
    assert.match(withRef.dynamicPart, /CHANNEL STYLE REFERENCE/);
    assert.match(withRef.dynamicPart, /newspaper-collage/);
    assert.doesNotMatch(without.dynamicPart, /CHANNEL STYLE REFERENCE/);
  });
});
