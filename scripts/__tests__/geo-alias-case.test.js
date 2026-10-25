// A short alias (an ISO-3 code, US, UK) resolves only in capitals. Case-
// insensitively "Are" was the UAE: CI run 37795613343 ch-1 drew a UAE map for
// "Are you leaving zero emergency cash behind?" and beat-check failed it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRegion } from "../../src/skills/remotion-render/visual/geo-regions.js";
import { knownPlacesOf } from "../canvas-grounding.js";

test("common words that are ISO-3 codes are not places", () => {
  for (const w of ["Are", "are", "Can", "Per", "Mar", "Ben", "Gin", "Pan", "Fin", "Nor", "Us"]) {
    assert.equal(resolveRegion(w), null, w);
  }
});

test("codes written in capitals and full names still resolve", () => {
  assert.equal(resolveRegion("USA"), "country:USA");
  assert.equal(resolveRegion("US"), "country:USA");
  assert.equal(resolveRegion("UK"), "country:GBR");
  assert.equal(resolveRegion("DRC"), "country:COD");
  assert.equal(resolveRegion("Peru"), "country:PER");
  assert.equal(resolveRegion("the United States"), "country:USA");
  assert.equal(resolveRegion("The Netherlands"), "country:NLD");
});

test("a bare name that is two places resolves to neither", () => {
  // CI run 37810883817 ch-9: "Moscow and Washington ..." drew Washington state.
  assert.equal(resolveRegion("Washington"), null);
  assert.equal(resolveRegion("Georgia"), null);
  assert.equal(resolveRegion("Washington state"), "us:WA");
  assert.deepEqual(knownPlacesOf("Moscow and Washington are planning a return of energy trade."), []);
});

test("a sentence-initial question word grounds no map", () => {
  assert.deepEqual(knownPlacesOf("Are you leaving zero emergency cash behind?"), []);
  assert.deepEqual(knownPlacesOf("Can Turkey and Somalia build a spaceport?"), ["Turkey", "Somalia"]);
});
