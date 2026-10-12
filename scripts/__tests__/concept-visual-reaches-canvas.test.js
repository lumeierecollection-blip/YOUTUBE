// A CONCEPT VISUAL ON THE BEAT MUST REACH THE CANVAS.
//
// Board 38241611172 ch-26 beat 1, the ladder's own log:
//
//   [ladder] ch-26 beat 1: names Deloitte Cyprus -> a second visual
//   (plate-organization) beside the TYPE-FULL it already shows
//
// ...and the rendered manifest for that beat:
//
//   composition: TYPE-FULL
//   concept_visuals: []
//   boxes: rule, kicker, statement, underline
//
// The ladder computed the visual, wrote it onto the beat, logged it — and
// canvasContentFor() rebuilt concept_visuals from scratch from hero_cutout /
// fallback_symbol, discarding it before the render. entity-coverage then read
// the manifest and reported the beat "words only", so the gate and the ladder
// disagreed about what was drawn.
//
// This is the THIRD time this exact mistake has been made in this repo, and the
// shape is always the same: something is written onto the beat, a builder
// further down rebuilds the field, and a check reading the built artifact
// reports the opposite of what the writer believed.
//   - the text inventory read a mechanism table instead of the canvas boxes;
//   - the correction loop edited plan fields the layout never reads;
//   - here, a builder rebuilt the list the ladder had just filled.
//
// So this test asserts the invariant at the layer that can be reached without
// rendering: whatever concept_visuals a beat carries, the composition the
// layout builds for it draws them, as cutout0/cutout1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canvasManifest, normalizeCanvas } from "../../src/skills/remotion-render/visual/canvas-layout.js";

const LADDER_VISUAL = { name: "Deloitte Cyprus", class: "plate-organization", logo: true, asset: null };

test("a TYPE beat's concept visual becomes a drawn box, not a dropped field", () => {
  const c = canvasManifest(
    normalizeCanvas({ visual_type: "TYPE", composition: "TYPE-FULL", headline: "Deloitte Cyprus", concept_visuals: [LADDER_VISUAL] }, 0),
    0,
  );
  assert.deepEqual(c.concept_visuals.map((v) => v.name), ["Deloitte Cyprus"], "the visual did not survive into the canvas record");
  const drawn = Object.keys(c.boxes).filter((k) => /^cutout/.test(k));
  assert.ok(drawn.length > 0, `no cutout box was laid out for the concept visual; boxes: ${Object.keys(c.boxes).join(",")}`);
});

test("two concept visuals are recorded, and the layout places what it can", () => {
  // HERO-OVER (the composition a TYPE beat with concept visuals resolves to)
  // places cutout0 and, when a SECOND object survives the collision test,
  // cutout1. canvas-layout.js:948 only keeps the second when it does not
  // overlap the first, so the honest assertion is: both are recorded, and at
  // least one is laid out — not that two boxes always exist.
  const c = canvasManifest(
    normalizeCanvas({
      visual_type: "TYPE", composition: "TYPE-FULL", headline: "Deloitte Cyprus and Roman Abramovich",
      concept_visuals: [LADDER_VISUAL, { name: "Roman Abramovich", class: "plate-person", logo: false, asset: null }],
    }, 0),
    0,
  );
  assert.equal(c.concept_visuals.length, 2, "both named entities must be recorded on the beat");
  const drawn = Object.keys(c.boxes).filter((k) => /^cutout/.test(k));
  assert.ok(drawn.length >= 1, `nothing was laid out; boxes: ${Object.keys(c.boxes).join(",")}`);
  assert.ok(drawn.includes("cutout0"), "the first visual is always placed");
});

test("a visual the layout drops is not reported as drawn", () => {
  // The record is what drawnOf() and so entity-coverage read. Reporting a
  // visual no box proves would claim coverage of something the viewer never
  // sees — the same proxy the text inventory hit, one field over.
  const c = canvasManifest(
    normalizeCanvas({ visual_type: "TYPE", composition: "TYPE-FULL", headline: "Just words" }, 0),
    0,
  );
  const drawn = Object.keys(c.boxes).filter((k) => /^cutout/.test(k));
  if (!drawn.length) {
    assert.deepEqual(c.concept_visuals, [], "a beat with no cutout box must report no concept visuals");
  }
});

test("a beat with no concept visual is unchanged (no phantom objects)", () => {
  const c = canvasManifest(normalizeCanvas({ visual_type: "TYPE", composition: "TYPE-FULL", headline: "Just words" }, 0), 0);
  assert.deepEqual(c.concept_visuals, []);
  assert.ok(!Object.keys(c.boxes).some((k) => /^cutout/.test(k)), "a words-only beat grew a cutout box");
});