/**
 * A re-plan (the corrections pass) asks for every beat complete, layout included.
 * CI runs 37705693390 and 37713312537: the first plan carried 9/9 and 10/10 planner layouts, the
 * re-plan after the challenger 0 — the corrections prompt only asked for fixes.
 * MUTATION (run): reverting the corrections header turns this red. Restored byte-identical.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { buildPlanPromptParts } from "../gemini-visual-plan.js";

const sentences = [{ start: 0, end: 3, text: "A former officer pleaded guilty." }, { start: 3, end: 6, text: "Prosecutors said 298 gold bars were found." }];
it("the corrections pass asks for complete beats, layout included", () => {
  const { dynamicPart } = buildPlanPromptParts(sentences, [{ beat: 1, problem: "MISMATCH", fix: "show the bars" }], "5");
  assert.match(dynamicPart, /return every beat complete, with every field the format above asks for \(its layout, ground and entrance_style included\)/);
});
it("a first plan has no corrections block", () => {
  assert.doesNotMatch(buildPlanPromptParts(sentences, null, "5").dynamicPart, /PREVIOUS REVIEW CORRECTIONS/);
});
it("the LAYOUT section states Layer 1's zone rule the way the audit applies it (header kind vs visual kind)", () => {
  const { staticPart } = buildPlanPromptParts(sentences, null, "5");
  assert.match(staticPart, /the two regions never hold two kinds of element/);
  assert.match(staticPart, /falls back to the default arrangement/);
});
