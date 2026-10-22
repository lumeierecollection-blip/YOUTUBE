import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isPlaceDescription } = require("../resolve-scene.cjs");

// Run 39611317543 ch-1 beat 1: "Richmond" typed as a company, Wikidata Q43421.
test("a Wikidata city description is a place", () => {
  assert.equal(isPlaceDescription("independent city in and capital of the U.S. state of Virginia"), true);
  assert.equal(isPlaceDescription("U.S. state"), true);
  assert.equal(isPlaceDescription("town in Kent, England"), true);
  assert.equal(isPlaceDescription("sovereign state in Europe"), true);
});

test("a body that sits in a place is not a place", () => {
  for (const d of [
    "state agency of California",
    "city council of Chicago",
    "school district in Texas",
    "American multinational technology company",
    "federal executive department of the United States",
    "public research university in Utah",
    "county court in England",
    "",
    null,
  ]) assert.equal(isPlaceDescription(d), false, String(d));
});
