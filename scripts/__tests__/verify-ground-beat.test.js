/**
 * render-and-qa.js measureGround: the beat it measures as "the uniform white ground" must be one
 * drawn on plain white — not one carrying the designed background variation (canvas-layout.js
 * backgroundOf: every 5th beat a gradient, every 3rd the paper texture). CI run 37702067252 ch-5
 * measured beat 4 (a gradient beat) and rejected the video: bottom-right #F8F6F3.
 *
 * render-and-qa.js runs main() on import, so the selection is asserted on its source.
 * MUTATION (run): removing the two background clauses turns this red. Restored byte-identical.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backgroundOf } from "../../src/skills/remotion-render/visual/canvas-layout.js";

const src = readFileSync("scripts/render-and-qa.js", "utf8");

it("measureGround skips beats drawn with a gradient or the paper texture", () => {
  const sel = src.slice(src.indexOf("function measureGround("), src.indexOf("const at = beat.start_sec"));
  assert.match(sel, /!b\.canvas\?\.background\?\.gradient/);
  assert.match(sel, /!b\.canvas\?\.background\?\.paper/);
});
it("the variation it skips is real: beat index 4 is a gradient beat, index 2 a paper beat", () => {
  assert.equal(backgroundOf(4, "TYPE-FULL").gradient, true);
  assert.equal(backgroundOf(2, "TYPE-FULL").paper, true);
  assert.deepEqual(backgroundOf(0, "TYPE-FULL"), { paper: false, rule: false, gradient: false });
});
