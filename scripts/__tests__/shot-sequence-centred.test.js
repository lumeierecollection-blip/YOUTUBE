// Under the text grid every beat's words are centred on the one axis, so the shot solver must not call two centred beats in a row a problem
// (the audit's canvas-type skips the rule then). Board 38044082797 ch 49: it made every sequence illegal, the solver gave up,
// and a photo card twice / a statement twice in a row reached canvas-type.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEXT_GRID } from "../../src/skills/remotion-render/visual/canvas-layout.js";
import { shotSequenceProblems } from "../render-and-qa.js";

const shot = (key, centred = true) => ({ key, centred, words: "low", phrase: false, typeLed: false, canvas: {} });
const seq = [shot("HERO-OVER"), shot("PHOTO-CARD"), shot("TYPE-FULL")];
const centredProblems = (p) => p.filter((x) => /both centre/.test(x.why));

test("grid on: two centred beats in a row are not a problem", () => {
  TEXT_GRID.on = true;
  assert.equal(centredProblems(shotSequenceProblems(seq)).length, 0);
});

test("grid on: the same composition twice in a row still is", () => {
  TEXT_GRID.on = true;
  const p = shotSequenceProblems([shot("PHOTO-CARD"), shot("PHOTO-CARD"), shot("TYPE-FULL")]);
  assert.ok(p.some((x) => /same composition/.test(x.why)));
});

test("grid off (the pre-grid machinery): the rule is still enforced", () => {
  TEXT_GRID.on = false;
  try { assert.ok(centredProblems(shotSequenceProblems(seq)).length > 0); } finally { TEXT_GRID.on = true; }
});
