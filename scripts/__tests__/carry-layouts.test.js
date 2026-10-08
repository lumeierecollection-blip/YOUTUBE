/**
 * After the challenger's re-plan, an unblocked beat that came back without a layout gets the
 * planner's own first-plan layout (planner-decisions.js carryPlannerLayouts). CI runs 37705693390,
 * 37713312537, 37718157561: first plan 9/9 or 10/10 layouts, re-plan 0/9.
 * MUTATION (run): making carryPlannerLayouts a no-op turns the first test red. Restored.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carryPlannerLayouts } from "../planner-decisions.js";

const lay = (c) => ({ cols: c, rows: 2, slots: [{ id: "headline", col: 0, row: 0 }] });
it("unblocked beats get their first-plan layout back; blocked beats stay as re-planned", () => {
  const first = { beats: [{ index: 0, layout: lay(1) }, { index: 1, layout: lay(2) }, { index: 2, layout: lay(3) }] };
  const re = { beats: [{ index: 0 }, { index: 1 }, { index: 2, layout: lay(4) }] };
  assert.deepEqual(carryPlannerLayouts(first, re, [1]), [0]);
  assert.deepEqual(re.beats[0].layout, lay(1));
  assert.equal(re.beats[1].layout, undefined, "blocked: not carried");
  assert.deepEqual(re.beats[2].layout, lay(4), "a layout the re-plan gave stands");
});
it("nothing to carry when the first plan had none", () => {
  assert.deepEqual(carryPlannerLayouts({ beats: [{ index: 0 }] }, { beats: [{ index: 0 }] }, []), []);
});
it("render-and-qa calls it on the re-plan with the blocked beats", () => {
  assert.match(readFileSync("scripts/render-and-qa.js", "utf8"), /carryPlannerLayouts\(firstPlan, replanned, blocking\.map\(\(x\) => x\.beat_index\)\)/);
});
