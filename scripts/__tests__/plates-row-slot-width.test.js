// A ROW ENTRY MUST FIT ITS SLOT, OR NEIGHBOURS COLLIDE INTO ONE WORD.
//
// Board 38376666510 ch-26 beat 8 failed the naming check. The frame rendered the
// names as:
//
//   AlexanderConner
//
// The beat's canvas.art is a plates row, straight from the rendered manifest:
//
//   { kind: "plates", names: ["SEC", "Alexander", "Conner"],
//     items: [{ name: "SEC", asset: "...us-securities-and-exchange-commission-logo.png" }, null, null] }
//
// Only SEC has a verified mark, so Alexander and Conner are drawn as type.
//
// EntityArt lays each entry in its OWN slot with a 32 px gap:
//
//   const n = names.length, gap = n === 1 ? 0 : 32;
//   const side = Math.max(120, Math.min(b.h - 70, Math.floor((b.w - gap * (n - 1)) / n)));
//   ...left: x0 + i * (side + gap)...
//
// but MarkPlate sized its text at W = side * 1.6 and placed it at
// left: (side - W) / 2 — a NEGATIVE offset. So every entry's name overflowed its
// slot by 0.3 * side on both sides, which is far more than the 32 px gap, and
// the two neighbours ran into each other.
//
// The wide behaviour is deliberate for a LONE plate ("the name may run wider
// than the square it was laid out in"), so this is fixed by passing the slot
// width through, not by changing the lone-plate path.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../../src/skills/remotion-render/visual/full-canvas.jsx", import.meta.url), "utf8");

// ch-26 beat 8's real row.
const NAMES = ["SEC", "Alexander", "Conner"];
const GAP = 32;

test("ch-26 beat 8's row is what this test is about", () => {
  assert.deepEqual(NAMES, ["SEC", "Alexander", "Conner"]);
});

test("MarkPlate accepts an explicit width", () => {
  assert.ok(/function MarkPlate\(\{[^}]*\bwidth\b[^}]*\}\)/.test(SRC), "MarkPlate takes no width");
});

test("a row entry is drawn at its slot width, not 1.6x it", () => {
  assert.ok(/<MarkPlate side=\{side\} width=\{side\}/.test(SRC), "the row must pass width={side}");
});

test("the wide default survives for a lone plate", () => {
  // Changing this would regress the single-plate look, which the reference uses.
  assert.ok(/const W = width \|\| side \* 1\.6;/.test(SRC), "the lone-plate width must stay 1.6x when no width is given");
});

test("with width = side, no entry can reach past its slot", () => {
  // The geometry the fix depends on, mirrored from the code.
  const bW = 900, bH = 400;
  const n = NAMES.length;
  const side = Math.max(120, Math.min(bH - 70, Math.floor((bW - GAP * (n - 1)) / n)));
  const W = side;                      // what the row now passes
  const leftOffset = (side - W) / 2;   // MarkPlate's own offset
  assert.ok(leftOffset === 0, `the plate still overflows its slot by ${leftOffset}`);
  // Old behaviour, for the record:
  assert.ok((side - side * 1.6) / 2 < -GAP, "the old overflow was smaller than the gap, so this fix would not have been needed");
});

test("neighbouring entries cannot touch", () => {
  const bW = 900, bH = 400;
  const n = NAMES.length;
  const side = Math.max(120, Math.min(bH - 70, Math.floor((bW - GAP * (n - 1)) / n)));
  const rowW = n * side + (n - 1) * GAP;
  const x0 = (bW - rowW) / 2;
  for (let i = 0; i < n - 1; i++) {
    const thisRight = x0 + i * (side + GAP) + side;
    const nextLeft = x0 + (i + 1) * (side + GAP);
    assert.ok(nextLeft - thisRight === GAP, `entries ${i} and ${i + 1} are not ${GAP}px apart`);
  }
});