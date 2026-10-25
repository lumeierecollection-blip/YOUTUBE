// A BOX IS NOT A PICTURE, AND THE SAME FRAME TWICE IS NOT A SEQUENCE.
//
// Board 38321106622 failed ch-2 and ch-5 on the canvas gate, from two DIFFERENT
// causes — both of them regressions from the entity ladder's own rungs:
//
//   ch-2 beat 4  FAIL visual-centred — "the cutout0 is not on the frame (0.0% of
//                its box differs from the ground)". The ladder put a DATE on the
//                beat as a second visual ([ladder] ch-2 beat 4: names October 7,
//                2026 -> a second visual (date)), entityLadder copied the rung
//                kind straight into the concept visual's `class`, and
//                ConceptVisual handled cutout, symbol, plate-* and figure —
//                then `return null`. A box was laid out and nothing was drawn.
//
//   ch-5 beats 4 AND 5  FAIL canvas-type — "ENTITY-ART:plates twice in a row".
//                Both adjacent beats took a `plates` row from the ladder, which
//                is the same frame twice: the same rule the map rung has always
//                had ("a map beside a map is the same frame twice").
//
// Neither gate is loosened here. The first is fixed by drawing the date/span;
// the second by not producing two identical neighbours.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ladderAll } from "../entity-ladder.js";

const CANVAS_SRC = readFileSync(new URL("../../src/skills/remotion-render/visual/full-canvas.jsx", import.meta.url), "utf8");

test("every rung kind the ladder can emit is actually drawable", () => {
  // The invariant that would have caught ch-2 at authoring time. directiveFor()
  // returns these kinds; entityLadder copies the kind into the concept visual's
  // `class`; ConceptVisual is what draws it. A rung with no branch in
  // ConceptVisual is a box with nothing in it.
  const drawable = new Set([...CANVAS_SRC.matchAll(/b\.class === "([a-z-]+)"/g)].map((m) => m[1]));
  const ladderSrc = readFileSync(new URL("../entity-ladder.js", import.meta.url), "utf8");
  const rungs = new Set([...ladderSrc.matchAll(/kind: "([a-z-]+)"/g)].map((m) => m[1]));
  // `plates` is a ROW kind: entityLadder collapses it to a plate-* class before
  // it reaches ConceptVisual, so it is never a concept visual's class.
  rungs.delete("plates");
  const undrawable = [...rungs].filter((k) => !drawable.has(k));
  assert.deepEqual(undrawable, [], `the ladder can emit a concept visual class that ConceptVisual never draws: ${undrawable.join(", ")}`);
});

test("a date rung is drawn, not left as an empty box", () => {
  assert.ok(/b\.class === "date"/.test(CANVAS_SRC), "ConceptVisual has no date branch — that is exactly the ch-2 blank box");
  const b = {
    index: 4,
    narration: "The measure was withdrawn on October 7, 2026.",
    named_entities: [{ type: "date", name: "October 7, 2026" }],
    canvas: { composition: "TYPE-FULL" },
  };
  const [d] = ladderAll(b);
  assert.equal(d.art.kind, "date");
});

test("a span rung is drawn too", () => {
  assert.ok(/b\.class === "span"/.test(CANVAS_SRC), "ConceptVisual has no span branch");
});

const rowBeat = (index) => ({
  index,
  narration: "Meritservus and the British Virgin Islands appear in the filings.",
  named_entities: [{ type: "organization", name: "Meritservus" }, { type: "place", name: "British Virgin Islands" }],
  canvas: { composition: "TYPE-FULL" },
});

test("two adjacent beats do not both become a plates row", () => {
  // ch-5: beats 4 and 5 each took a row. entityLadder applies directives in
  // place as it walks the plan, so by the time beat 5 is reached beat 4's art
  // is already on it — the neighbour is read from applied state, not predicted.
  const b4 = rowBeat(4);
  const [d4] = ladderAll(b4);
  assert.equal(d4.art.kind, "plates", "the first beat of a run keeps the row");

  b4.art = d4.art;
  const b5 = rowBeat(5);
  const [d5] = ladderAll(b5, { beats: [b4, b5] });
  assert.notEqual(d5.art.kind, "plates", `beat 5 drew a second row: ${JSON.stringify(d5.art)}`);
  assert.match(d5.art.kind, /^plate-/, "the beat keeps a plate, just not another identical row");
});

test("the neighbour check does not suppress a row when the neighbour has none", () => {
  const b4 = rowBeat(4);
  const b6 = rowBeat(6);
  const [d6] = ladderAll(b6, { beats: [b4, b6] });   // b4 has no applied art at all
  assert.equal(d6.art.kind, "plates");
});

test("without the plan the beat still takes a row rather than failing", () => {
  const [d] = ladderAll(rowBeat(5));
  assert.equal(d.art.kind, "plates", "ladderAll(b) with no plan must not throw or silently drop the beat");
});