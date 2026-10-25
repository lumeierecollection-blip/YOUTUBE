// A SECOND VISUAL MUST BE A KIND THE COVERAGE CHECK RECOGNISES.
//
// Board 38238545250 rejected ch-1 and ch-26 with the visual visibly on screen:
//
//   [canvas] FAIL entity-coverage — beat 1: organization "Deloitte Cyprus",
//   person "Roman Abramovich", place "Cyprus" — words only, but the sentence
//   names an entity
//
// "Words only" while a plate was drawn. The ladder's `alongside` branch wrote
// `concept_visuals: [{ class: "plate" }]` — a kind drawnOf() reported but that
// NO branch of coverageOf() matches. coverageOf() recognises "logo", "photo",
// "plate-organization", "plate-person", "plate-place", "cutout", "map", "flag".
// So the check was reading a vocabulary that did not exist: the gate and the
// renderer disagreed about what a plate is, and the render lost.
//
// This is the same class of bug as the text inventory reading a mechanism table
// instead of the canvas — a check matching a label the render never produces.
// The test is about the VOCABULARY, so it holds whatever the ladder decides.
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawnOf, coverageOf } from "../entity-coverage.js";

// Every kind the alongside branch is allowed to write, with the entity type it
// answers. Kept in step with render-and-qa.js's entityLadder.
const ALONGSIDE_CLASSES = {
  organization: "plate-organization",
  person: "plate-person",
  place: "plate-place",
};

test("the class written for each entity type is one coverageOf() recognises", () => {
  for (const [type, cls] of Object.entries(ALONGSIDE_CLASSES)) {
    const c = { composition: "TYPE-FULL", concept_visuals: [{ name: "Acme", class: cls, logo: cls === "plate-organization", asset: null }] };
    const r = coverageOf(c, { type, name: "Acme" });
    assert.ok(r.covered, `a ${cls} visual did not answer a ${type} — coverageOf returned ${JSON.stringify(r)}`);
  }
});

test('the bug: a kind of "plate" is drawn but answers nothing', () => {
  // Pinned so the vocabulary cannot quietly drift back: if someone reintroduces
  // a class outside this set, the beat goes back to reading as words-only.
  const c = { composition: "TYPE-FULL", concept_visuals: [{ name: "Acme", class: "plate", asset: null }] };
  assert.equal(drawnOf(c).length, 1, "drawnOf does report it — that is why the gate and the frame disagreed");
  assert.equal(coverageOf(c, { type: "organization", name: "Acme" }).covered, false);
});

test("an organisation's alongside visual carries its real mark when one resolved", () => {
  const c = { composition: "TYPE-FULL", concept_visuals: [{ name: "Acme", class: "plate-organization", logo: true, asset: "marks/acme.png", license: "Public domain" }] };
  const drawn = drawnOf(c);
  assert.equal(drawn[0].kind, "logo", "a resolved mark is reported as the logo it is");
  assert.ok(coverageOf(c, { type: "organization", name: "Acme" }).covered);
});

test("a second visual never displaces the first — two names, two entries", () => {
  const c = {
    composition: "HERO-OVER",
    concept_visuals: [
      { name: "National Bank of Czechoslovakia", class: "cutout", logo: true, asset: "a.png" },
      { name: "Czechoslovakia", class: "plate-place", logo: false, asset: null },
    ],
  };
  const ents = [{ type: "organization", name: "National Bank of Czechoslovakia" }, { type: "place", name: "Czechoslovakia" }];
  const misses = ents.filter((e) => !coverageOf(c, e).covered);
  assert.deepEqual(misses, [], "both ends of the sentence are on screen at once");
});