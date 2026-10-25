// A VERIFIED MARK IS STILL A COLOURED OBJECT.
//
// Board 38380216978 ch-26 beat 0 failed the audit:
//
//   FAIL flat-look — beat 0 (ENTITY-ART plates): 0.97% of the frame is a colour
//   that is neither ink, neutral nor the accent #6B2A6B (max 0.4%) — a palette
//   the reference does not use
//
// The frame shows the cause: the SEC seal in full colour — gold ring, navy field,
// red-and-white stripes — on an ink/neutral/accent frame. The asset is a verified
// public-domain mark, so nothing about it is fake; only its palette was wrong.
//
// The 0.4% limit must NOT be loosened. The source changes instead: a mark drawn
// inside a plates row is drawn in the channel's palette. It is not blanked,
// swapped or faked — it is still the real seal, taken to neutral.
//
// The alternative was dropping to the name in type, which MarkPlate already
// does when there is no usable asset. That was rejected because it would name an
// entity we actually hold a verified mark for, which weakens the two-visual rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../../src/skills/remotion-render/visual/full-canvas.jsx", import.meta.url), "utf8");

test("a mark drawn in a plates row is desaturated into the channel palette", () => {
  assert.ok(/desaturate=\{PLATES_MARK_DESATURATE\}/.test(SRC), "the row does not desaturate its marks");
});

test("desaturation is full, so the mark counts as neutral", () => {
  assert.ok(/const PLATES_MARK_DESATURATE = 1;/.test(SRC), "partial desaturation would leave off-palette colour on the frame");
});

test("MarkPlate applies the filter to the image it draws", () => {
  assert.ok(/filter: desaturate \? `grayscale\(\$\{desaturate\}\)` : undefined/.test(SRC), "the Img does not take the filter");
});

test("the lone-plate path is untouched — no palette is invented for it", () => {
  // Only the ROW desaturates. FLAT is saturate 1 everywhere else, and changing
  // every render path on the strength of one audit failure would be reckless.
  const at = SRC.indexOf("<MarkPlate side={side} name={b.concept || b.name}");
  const concept = SRC.slice(at, SRC.indexOf("</div>", at));
  assert.ok(at > 0, "the concept-visual MarkPlate call is gone");
  assert.ok(!/PLATES_MARK_DESATURATE/.test(concept), "the concept-visual plate must keep its current look");
});

test("the gate itself is not touched", () => {
  // 0.4% stays 0.4%. A fix that moves the number is not a fix.
  const audit = readFileSync(new URL("../lib/flat-look.cjs", import.meta.url), "utf8");
  assert.ok(/flat-look/.test(audit), "the flat-look check is missing from the auditor");
  assert.ok(/OFF_SHARE_MAX = 0\.004/.test(audit), "the flat-look palette limit moved — 0.4% must stay 0.4%");
});