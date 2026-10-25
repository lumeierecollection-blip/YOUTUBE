import test from "node:test";
import assert from "node:assert/strict";
import { entityShape } from "../lib/entity-shape.mjs";

const ok = (n, t, s) => entityShape(n, t, s).ok;

test("the over-reach of board 38054686824: 'Indian' and 'federal jury' are not entities", () => {
  assert.equal(ok("Indian", "place", "Indian students have long chased overseas degrees."), false);
  assert.equal(ok("federal jury", "institution", "A federal jury convicted him of wire fraud."), false);
  assert.equal(ok("Prosecutors", "institution", "Prosecutors said the scheme ran for years."), false);
  assert.equal(ok("officials", "person", "Local officials declined to comment."), false);
});

test("specific named things pass: people, places, organisations, courts, named objects, figures", () => {
  assert.equal(ok("Stanley Kubrick", "person", "Stanley Kubrick framed it as a mystery."), true);
  assert.equal(ok("Constitutional Court", "institution", "Thailand's Constitutional Court removed her."), true);
  assert.equal(ok("International Crisis Group", "institution", "The International Crisis Group warned of escalation."), true);
  assert.equal(ok("Federal Reserve", "institution", "The Federal Reserve held rates."), true);
  assert.equal(ok("Netflix", "company", "Netflix bought the film."), true);
  assert.equal(ok("Interstate 35", "place", "He was stopped on Interstate 35 near Houston."), true);
  assert.equal(ok("NASA", "institution", "The mission, NASA said, slipped."), true);
  assert.equal(ok("$388 million", "number", "It paid $388 million."), true);
  assert.equal(ok("steel plates", "object", "Officers wore steel plates under their vests."), true);
});

test("a title-cased name made of generic words is still a name; the same words in lower case are not", () => {
  assert.equal(ok("Union Bank", "company", "Union Bank said it would close the branch."), true);
  assert.equal(ok("Supreme Court", "institution", "The Supreme Court declined the case."), true);
  assert.equal(ok("federal jury", "institution", "The federal jury deliberated."), false);
});

test("a common noun the sentence writes in lower case is not a name; an abstract noun is not an object", () => {
  assert.equal(ok("police station", "building", "He walked into the police station at dawn."), false);
  assert.equal(ok("inflation", "object", "Inflation hit the poorest hardest."), false);
  assert.equal(ok("Bexar County", "place", "Bexar County paid the settlement."), true);
});
