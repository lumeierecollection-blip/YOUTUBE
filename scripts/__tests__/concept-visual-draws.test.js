// A LAID-OUT BOX MUST ACTUALLY DRAW SOMETHING.
//
// Board 38244309098 failed ch-1, ch-8 and ch-26 on the pixel audit:
//
//   [canvas] FAIL visual-centred — beat 1 (HERO-OVER): the cutout0 is not on
//   the frame (0.0% of its box differs from the ground)
//
// The manifest was right that the box existed; the box was just empty. The
// entity ladder's `alongside` branch writes a concept visual with class
// plate-organization / plate-person / plate-place, and full-canvas.jsx's
// ConceptVisual handled `cutout` and `symbol` — and then `return null` for
// anything else. So rung 2 of the visual ladder (an honest non-identifying
// treatment) and rung 3 (the name in type) had a layout but no drawing code.
//
// This is the same shape as every other proxy in this repo's history: the
// manifest recorded what was PLACED, the audit read the pixels, and the two
// disagreed. Here the fix is in the renderer, and this test pins which classes
// a concept visual may carry and must draw for.
//
// The rendering itself is exercised on CI by the pixel audit (visual-centred
// measures the real frame). What is pinned here is the decision that made the
// frame blank: an unhandled class must not be a silent no-op.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = readFileSync(join(ROOT, "src", "skills", "remotion-render", "visual", "full-canvas.jsx"), "utf8");

// The classes ConceptVisual must draw. `cutout` and `symbol` were already
// handled; the three plate classes are what the ladder writes.
const MUST_DRAW = ["cutout", "symbol", "plate-organization", "plate-person", "plate-place"];

function conceptVisualBody() {
  const start = SRC.indexOf("function ConceptVisual(");
  assert.ok(start > 0, "ConceptVisual not found in full-canvas.jsx");
  const end = SRC.indexOf("\nfunction ", start + 10);
  return SRC.slice(start, end > 0 ? end : start + 6000);
}

test("ConceptVisual draws every class the entity ladder can write", () => {
  const body = conceptVisualBody();
  for (const cls of MUST_DRAW) {
    assert.ok(
      body.includes(`"${cls}"`) || body.includes(`plate-`),
      `no branch draws a "${cls}" concept visual — the frame would be blank in its box`,
    );
  }
});

test("the plate branch reaches MarkPlate, not a null return", () => {
  const body = conceptVisualBody();
  const plateBranch = body.slice(body.indexOf('b.class === "plate-organization"'));
  assert.ok(plateBranch.length > 0, "no plate branch");
  assert.ok(plateBranch.includes("MarkPlate"), "the plate branch must draw the mark or the name, not nothing");
  assert.ok(!/plateBranch[\s\S]*?\n\s*return null;\s*\n\}/.test(body), "a plate must not fall through to `return null`");
});

test("the theme hook is read before any early return", () => {
  // A hook called after an early return runs on some frames and not others.
  const body = conceptVisualBody();
  const hook = body.indexOf("useTheme()");
  const firstReturn = body.indexOf("return (");
  assert.ok(hook > -1, "the plate branch needs the theme");
  assert.ok(hook < firstReturn, `useTheme() is called at ${hook}, after the first return at ${firstReturn} — a hooks-order violation`);
});