// A SENTENCE WITH TWO FIGURES MUST NOT SHOW ONLY ONE.
//
// Board 38256573651 ch-26 beat 0:
//
//   [canvas] FAIL entity-coverage — beat 0: number "$672 million", number
//   "1,000" — draws figure, none of it the entity
//
// The sentence states two numbers; the frame drew one. The ladder found "1,000"
// missing and asked for it ALONGSIDE the figure already there — but NUMBER-FULL
// lays out one stat card and no cutout slot, so "alongside" was dropped and the
// gate was right to fail.
//
// A lone missing figure therefore takes the stat card itself, replacing the one
// already drawn: across the beat both numbers are shown, and neither is left on
// nothing. Replacing is not losing coverage — it is the only way a composition
// that holds one figure can show the figure the sentence is about.
//
// Pinned from the real ch-26 sentence and the real rendered canvas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ladderAll } from "../entity-ladder.js";
import { coverageOf } from "../entity-coverage.js";

const BEAT = {
  index: 0,
  narration: "Deloitte helped launder $672 million through more than 1,000 corporate papers.",
  named_entities: [{ type: "number", name: "$672 million" }, { type: "number", name: "1,000" }],
  canvas: { composition: "NUMBER-FULL", data: { value: "$672", label: "million" } },
};

test("the beat as rendered is exactly what the board failed", () => {
  // one figure drawn, the other number on nothing
  assert.ok(coverageOf(BEAT.canvas, { type: "number", name: "$672 million" }).covered);
  assert.equal(coverageOf(BEAT.canvas, { type: "number", name: "1,000" }).covered, false);
});

test("the missing figure is directed as a stat card, not as a second object", () => {
  const dirs = ladderAll(BEAT);
  assert.equal(dirs.length, 1, `expected one directive, got ${JSON.stringify(dirs)}`);
  assert.ok(dirs[0].figure, `expected a figure directive, got ${JSON.stringify(dirs[0])}`);
  assert.equal(dirs[0].figure.value, "1,000");
});

test("it replaces rather than riding alongside — NUMBER-FULL has no second slot", () => {
  const [d] = ladderAll(BEAT);
  assert.equal(d.replaces, true, "alongside would be silently dropped by a composition with no cutout box");
  assert.equal(d.alongside, false);
});

test("a figure already on the beat is not directed again", () => {
  const names = ladderAll(BEAT).flatMap((d) => (d.figure ? [d.figure.value] : []));
  assert.ok(!names.includes("$672"), "the figure already drawn was directed a second time");
});

test("a number in a plates row is a figure, and is matched as one", () => {
  // Board 38276419111 ch-26 beat 0: both numbers went into the row, a number
  // that fell through to the default was recorded as plate-organization, and
  // coverageOf() matches a number against a figure or a chart — never a plate.
  // Two numbers on screen read as "two organisations, none of it the entity".
  const b = {
    index: 0,
    narration: "Deloitte laundered $672 million through more than 1,000 corporate papers.",
    named_entities: [{ type: "number", name: "$672 million" }, { type: "number", name: "1,000" }],
    canvas: { composition: "TYPE-FULL" },
  };
  const [d] = ladderAll(b);
  assert.deepEqual(d.art.kinds, ["figure", "figure"], "a number was recorded as a plate");
  const c = { composition: "ENTITY-ART", art: { ...d.art, items: d.art.names.map(() => null) } };
  for (const n of ["$672 million", "1,000"]) {
    assert.ok(coverageOf(c, { type: "number", name: n }).covered, `"${n}" is drawn as a figure but read as uncovered`);
  }
});