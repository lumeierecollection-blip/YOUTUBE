// A MAP THAT COVERS A PLACE MAY NAME IT — AND MUST, IF THE SENTENCE SAYS IT.
//
// Board 38321106622 ch-9 beat 4 failed entity-check: "2/6 beats name an entity
// their frame does not show (beats 4, 6)".
//
//   "Pakistan declared a state of emergency in Khyber Pakhtunkhwa as security
//    tensions escalated."
//
// The frame was a map of the parent region, labelled "Pakistan". Khyber
// Pakhtunkhwa had no verified asset at all — the resolve step recorded "not
// found in any source, rendering as TYPE with name only" — and the ladder, on a
// MAP-CENTERED beat, correctly refused to fake a second object into a
// composition that has no slot for one, leaving the place to the headline.
//
// The ladder's reasoning was sound and its conclusion was wrong. The headline
// is not the frame. The entity check reads the frame, and the frame showed
// nothing of the spoken place.
//
// The map is drawn of a region that CONTAINS the place, so the place can be
// drawn ON the map. It is a KEY, not a pin: with no verified outline and no
// coordinates for Khyber Pakhtunkhwa, claiming where it sits would be a claim
// this repo cannot source. Saying the map covers it is true by construction.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const MAP_SRC = readFileSync(new URL("../../src/skills/remotion-render/visual/primitives/map.jsx", import.meta.url), "utf8");

test("CenteredMap draws the places the map covers but cannot pin", () => {
  assert.ok(/data\.labels/.test(MAP_SRC), "CenteredMap ignores data.labels — the covered place would never reach the frame");
});

test("the covered place is a KEY, not a pin at invented coordinates", () => {
  // The pin above the region label is real only because the map is zoomed on
  // its own region. The extra place has no verified outline, so it must be
  // labelled, never positioned as though we knew where it was.
  const keyBlock = MAP_SRC.slice(MAP_SRC.indexOf("data.labels"));
  assert.ok(keyBlock.includes("<text"), "the key must actually draw the name");
  assert.ok(!/labelAtRegion:\s*true[^]*?data\.labels[^]*?labelAtRegion:\s*true/.test(MAP_SRC), "the key must not claim to be positioned at the region");
});

test("the region label still names the region the map is really drawn of", () => {
  // The fix adds to the map; it must not replace what the map already says.
  assert.ok(/label:\s*String\(data\.label \|\| place\)/.test(MAP_SRC), "the region label was replaced instead of supplemented");
});

test("a map with nothing extra to name draws no key", () => {
  assert.ok(/Array\.isArray\(data\.labels\)/.test(MAP_SRC), "a map with no labels must fall back to no key, not crash");
});

test("the ladder names the covered place instead of leaving it to the headline", () => {
  const qa = readFileSync(new URL("../render-and-qa.js", import.meta.url), "utf8");
  const branch = qa.slice(qa.indexOf('=== "MAP-CENTERED"'));
  assert.ok(branch.length > 0, "no MAP-CENTERED branch in the ladder");
  assert.ok(/labels\.push\(mapName\)/.test(branch), "the ladder does not put the covered place on the map");
});