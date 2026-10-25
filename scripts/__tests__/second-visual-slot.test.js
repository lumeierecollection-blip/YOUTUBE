// A SECOND VISUAL GOES ONLY WHERE THERE IS A SLOT FOR IT.
//
// Board 38247946148 ch-1 beat 3:
//
//   [ladder] ch-1 beat 3: names You Need a Budget -> a second visual
//   (plate-organization) beside the DATA-FULL it already shows
//   [canvas] FAIL entity-coverage — beat 3: organization "You Need a Budget"
//   — draws chart, none of it the entity
//
// The ladder did its job and the composition had nowhere to put the result.
// Measured across the compositions in canvas-layout.js, only the TYPE and
// NUMBER ones lay out a cutout box for a second object:
//
//   TYPE-FULL -> HERO-OVER, TYPE-SPLIT -> TYPE-FULL,
//   NUMBER-FULL, NUMBER-STAT                      : place a cutout box
//   DATA-FULL, MAP-CENTERED, ENTITY-ART,
//   PROCESS-FULL, LIST-BUILD, TIMELINE,
//   COMPARISON-SPLIT, DOCUMENT, SCENE-FULL       : place none
//
// So a visual offered to a chart/map/timeline is a visual nobody sees. The
// manifest used to record it anyway (claiming coverage of nothing), and the
// audit then read the frame and disagreed — the same proxy, one field over.
//
// Two rules, pinned here: the ladder does not offer a second object to a
// composition that has no slot, and the manifest records a visual only when a
// box proves it was placed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canvasManifest, normalizeCanvas } from "../../src/skills/remotion-render/visual/canvas-layout.js";

// Kept in step with the COMPOSITION_TAKES_SECOND set in render-and-qa.js.
const TAKES_SECOND = ["TYPE-FULL", "TYPE-SPLIT", "NUMBER-FULL", "NUMBER-STAT", "HERO-OVER"];
const NO_SLOT = ["DATA-FULL", "MAP-CENTERED", "ENTITY-ART", "PROCESS-FULL", "LIST-BUILD", "TIMELINE", "COMPARISON-SPLIT", "DOCUMENT", "SCENE-FULL"];

const CV = [{ name: "You Need a Budget", class: "plate-organization", logo: false, asset: null }];
const layout = (composition) => canvasManifest(normalizeCanvas({ visual_type: "TYPE", composition, headline: "Rated 3.7", concept_visuals: CV }, 0), 0);

test("only TYPE and NUMBER compositions lay out a slot for a second object", () => {
  for (const c of TAKES_SECOND) {
    const m = layout(c);
    assert.ok(
      Object.keys(m.boxes).some((k) => /^cutout/.test(k)),
      `${c} is listed as taking a second visual but lays out no cutout box (boxes: ${Object.keys(m.boxes).join(",")})`,
    );
  }
  for (const c of NO_SLOT) {
    const m = layout(c);
    assert.ok(
      !Object.keys(m.boxes).some((k) => /^cutout/.test(k)),
      `${c} now lays out a cutout box — it can take a second visual, so it belongs in TAKES_SECOND`,
    );
  }
});

test("a visual on a composition with no slot is not reported as drawn", () => {
  for (const c of NO_SLOT) {
    const m = layout(c);
    assert.deepEqual(m.concept_visuals, [], `${c} recorded a visual it never placed — drawnOf() would claim coverage of nothing`);
  }
});

test("a visual on a composition with a slot is reported, with its kind", () => {
  const m = layout("TYPE-FULL");
  assert.equal(m.concept_visuals.length, 1);
  assert.equal(m.concept_visuals[0].name, "You Need a Budget");
  assert.equal(m.concept_visuals[0].class, "plate-organization");
});

test("the two lists partition the compositions that were measured", () => {
  const overlap = TAKES_SECOND.filter((c) => NO_SLOT.includes(c));
  assert.deepEqual(overlap, [], `a composition is in both lists: ${overlap.join(", ")}`);
});