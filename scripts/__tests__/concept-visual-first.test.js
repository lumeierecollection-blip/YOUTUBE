/**
 * TYPE-FULL concept beat + entrance_style "visual-first": the visual lands with its group.
 *
 * The behavioural evidence is rendered frames, not this file: scripts/qa-canvas-render.mjs on a
 * TYPE-FULL / warning-triangle / visual-first beat after the harness's last beat, frames 0-16 of
 * the beat, ink rows above the caption row (local-audit popTransitions' own arithmetic):
 *   before: f0-f6 113..63, f7-f14 ZERO (8 blank frames), f15 126   -> pop-transitions fails
 *   after:  f0-f16 112..187, never below 105                        -> passes
 * (ch-05 beat 5 in CI run 37687564970 showed the same: 0 rows at f6-f13, ink at f14.)
 *
 * This test is only the tripwire: it cannot import full-canvas.jsx's ConceptVisual call, so it
 * asserts the source keeps the visual-first branch. MUTATION (run): reverting `at` to
 * `tl.headlineAt + 0.45 + i * 0.12` turns it red. Restored byte-identical.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/skills/remotion-render/visual/full-canvas.jsx", "utf8");

describe("concept visual under visual-first", () => {
  it("does not stack its own 0.45 s delay on the group's arrival", () => {
    assert.match(src, /at=\{\(c\.entrance_style === "visual-first" \? 0 : tl\.headlineAt \+ 0\.45\) \+ i \* 0\.12\}/);
  });
  it("keeps the headline-then-visual delay for every other entrance style", () => {
    assert.match(src, /: tl\.headlineAt \+ 0\.45\)/);
  });
  it("TYPE-SPLIT's second half does not wait tl.splitAt under visual-first (ch-05 run 37700319999 beat 5)", () => {
    assert.match(src, /at=\{B\.headline && c\.entrance_style !== "visual-first" \? tl\.splitAt : tl\.headlineAt\}/);
  });
  it("still has the incoming-ink hold (f766ae5) and the 6-frame OUT fade untouched", () => {
    assert.match(src, /const holdingPrev = !!prev && \(local <= POP\.OUT \|\| !incomingHasInk\);/);
  });
});
