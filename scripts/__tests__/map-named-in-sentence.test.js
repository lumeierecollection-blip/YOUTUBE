// A MAP beat's place must be named in its own sentence at PLAN time, as the ship-time place gate (M1) requires
// (board 38044082797 ch 5: a map of "Malaysia" was built for a sentence that never says it, then rejected after the render).
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkVisual } from "../gemini-visual-plan.js";
import { placeGate } from "../place-gate.js";

const map = (place) => ({ visual_type: "MAP", data: { place } });

test("a map of a place the sentence names passes", () => {
  const r = checkVisual(map("Malaysia"), "Investigators traced the money out of Malaysia in 2013.");
  assert.equal(r.type, "MAP");
  assert.equal(r.why, undefined);
});

test("a map of a place the sentence does not name is refused (the demonym is not the country)", () => {
  for (const s of ["Malaysian prosecutors filed the charges.", "Prosecutors filed the charges in absentia."]) {
    const r = checkVisual(map("Malaysia"), s);
    assert.ok(r.why, `refused: ${s}`);
    assert.match(r.why, /not named in the sentence/);
  }
});

test("an unknown region is still refused first", () => {
  assert.match(checkVisual(map("Narnia"), "Narnia fell.").why, /not a known region/);
});

test("what the plan accepts, the ship-time gate (M1) accepts", () => {
  const sentence = "Investigators traced the money out of Malaysia in 2013.";
  assert.equal(checkVisual(map("Malaysia"), sentence).type, "MAP");
  const manifest = { beats: [{ canvas: { visual_type: "MAP", data: { place: "Malaysia" }, sentence } }] };
  assert.equal(placeGate(manifest).pass, true);
});
