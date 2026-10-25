/**
 * The planner's own choices are not overridden by the variety / rotation / entrance / animation
 * passes; those only fill what the planner left open.
 *
 * Before: composition rotation rewrote a planner-chosen type that repeated its neighbour ("beat 1
 * avoided repeating beat 0 type (NUMBER-FULL -> PROCESS-FULL)", ch-05 run 37687564970), entrance
 * styles were cycled by index, animation families were assigned by code.
 *
 * MUTATION (run, recorded in the commit): removing `if (o.locked?.(k)) return null;` from
 * enforceRotation turns the rotation test red; making assignEntranceStyles ignore the planner's
 * style turns the entrance test red. Restored byte-identical.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enforceRotation } from "../composition-rotation.js";
import { assignEntranceStyles, assignAnimationFamilies } from "../composition-variety.js";

const run = (comps, locked) => {
  const c = [...comps];
  const r = enforceRotation(c.length, {
    compositionOf: (i) => c[i],
    candidates: () => [{ composition: "PROCESS-FULL", visual_type: "PROCESS" }, { composition: "TYPE-SPLIT", visual_type: "TYPE" }],
    accept: () => true,
    apply: (i, alt) => { c[i] = alt.composition; },
    locked,
    log: () => {},
  });
  return { c, r };
};

describe("composition rotation fills, it does not override", () => {
  it("two planner-chosen NUMBER-FULL beats in a row stay NUMBER-FULL", () => {
    const { c, r } = run(["TYPE-FULL", "NUMBER-FULL", "NUMBER-FULL"], () => true);
    assert.deepEqual(c, ["TYPE-FULL", "NUMBER-FULL", "NUMBER-FULL"]);
    assert.equal(r.changes.filter((x) => x.resolved).length, 0);
  });
  it("the same repeat with nothing chosen by the planner is still broken (the default)", () => {
    const { c } = run(["TYPE-FULL", "NUMBER-FULL", "NUMBER-FULL"], () => false);
    assert.notEqual(c[2], c[1]);
  });
  it("only the open beat is rotated when one of the pair is the planner's", () => {
    const { c } = run(["TYPE-FULL", "NUMBER-FULL", "NUMBER-FULL"], (i) => i === 1);
    assert.equal(c[1], "NUMBER-FULL");
    assert.notEqual(c[2], "NUMBER-FULL");
  });
});

describe("entrance styles and animation families", () => {
  it("the planner's entrance styles stand, repeats included", () => {
    assert.deepEqual(assignEntranceStyles(["visual-first", "visual-first", "visual-first"]), ["visual-first", "visual-first", "visual-first"]);
  });
  it("an open beat is filled and differs from its neighbour", () => {
    const s = assignEntranceStyles(["together", null]);
    assert.equal(s[0], "together");
    assert.notEqual(s[1], "together");
  });
  it("the planner's animation family stands", () => {
    assert.deepEqual(assignAnimationFamilies([{ animation_family: "draw-in" }, { animation_family: "draw-in" }]), ["draw-in", "draw-in"]);
  });
});
