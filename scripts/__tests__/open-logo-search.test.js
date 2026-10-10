import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { openLogoSearchAllowed } = createRequire(import.meta.url)("../entity-assets.cjs");

// Board 38054686824 ch 9: the bare generic name "Treasury" reached an open Commons search and was matched to "The Treasury Discount Store Logo".
test("a generic institution name or a one-word name never reaches the open logo search", () => {
  assert.equal(openLogoSearchAllowed("Treasury"), false);
  assert.equal(openLogoSearchAllowed("the Treasury"), false);
  assert.equal(openLogoSearchAllowed("Police"), false);
  assert.equal(openLogoSearchAllowed("Supreme Court"), false);
  assert.equal(openLogoSearchAllowed("Netflix"), false);
});

test("a name of two or more words that is not generic may search; a qualified name ('Treasury of Russia') may", () => {
  assert.equal(openLogoSearchAllowed("Union Bank"), true);
  assert.equal(openLogoSearchAllowed("United States Department of the Treasury"), true);
  assert.equal(openLogoSearchAllowed("Treasury of Russian Federation"), true);
  assert.equal(openLogoSearchAllowed(""), false);
});
