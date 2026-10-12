// A PLATES ROW MUST CARRY EACH ENTRY'S OWN KIND.
//
// Board 38265869072 ch-5 beat 2:
//
//   [canvas] FAIL entity-coverage — beat 2: person "Amit Hadad", person
//   "Yehudit Tirosh" — draws plate-organization + plate-organization, none of
//   it the entity
//
//   [ladder] ch-5 beat 2: names plates "Amit Hadad, Yehudit Tirosh" -> plates
//
// Two PEOPLE drawn, reported as two ORGANISATIONS. drawnOf() hardcoded
// "plate-organization" for every name in a plates row, so coverageOf() — which
// matches a person against plate-person, a portrait or a photo — could never
// match them. The check was reading a field that did not carry the information
// it was being asked about: the kind said what the plate depicted, and for a
// row it said the same wrong thing about every entry.
//
// So the row now carries a `kinds` array, one entry per name, and drawnOf()
// reads it back per entry. The ladder fills it from each entity's own rung.
// Without it the row is still readable (it falls back to plate-organization,
// which is what the row meant before kinds existed), so an older manifest is
// not worse off than before — it is exactly as it was.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ladderAll } from "../entity-ladder.js";
import { drawnOf, coverageOf } from "../entity-coverage.js";

const BEAT = {
  index: 2,
  narration: "Amit Hadad and Yehudit Tirosh were named in the indictment.",
  named_entities: [{ type: "person", name: "Amit Hadad" }, { type: "person", name: "Yehudit Tirosh" }],
  canvas: { composition: "TYPE-FULL" },
};

test("a row of people is recorded with plate-person, not plate-organization", () => {
  const [d] = ladderAll(BEAT);
  assert.ok(d.art, `expected an art directive, got ${JSON.stringify(d)}`);
  assert.equal(d.art.kind, "plates");
  assert.deepEqual(d.art.kinds, ["plate-person", "plate-person"]);
});

test("each named person in the row is matched", () => {
  const [d] = ladderAll(BEAT);
  const c = { composition: "ENTITY-ART", art: { ...d.art, items: d.art.items || d.art.names.map(() => null) } };
  for (const n of ["Amit Hadad", "Yehudit Tirosh"]) {
    assert.ok(coverageOf(c, { type: "person", name: n }).covered, `"${n}" is drawn but not matched`);
  }
});

test("a mixed row keeps each entry's own kind", () => {
  const b = {
    index: 4,
    narration: "Deloitte, Roman Abramovich and Pragueton.",
    named_entities: [{ type: "organization", name: "Deloitte" }, { type: "person", name: "Roman Abramovich" }, { type: "place", name: "Pragueton" }],
    canvas: { composition: "TYPE-FULL" },
  };
  const [d] = ladderAll(b);
  assert.equal(d.art.kind, "plates");
  assert.deepEqual(d.art.kinds, ["plate-organization", "plate-person", "plate-place"]);
  const c = { composition: "ENTITY-ART", art: { ...d.art, items: d.art.names.map(() => null) } };
  assert.ok(coverageOf(c, { type: "organization", name: "Deloitte" }).covered);
  assert.ok(coverageOf(c, { type: "person", name: "Roman Abramovich" }).covered);
  assert.ok(coverageOf(c, { type: "place", name: "Pragueton" }).covered);
});

test("a place WITH a region takes the map, not the row", () => {
  // Not a regression in the row: a mappable place is better answered by a map,
  // and it is directed separately so it is not silently dropped.
  const b = {
    index: 6,
    narration: "Deloitte, Roman Abramovich and Cyprus.",
    named_entities: [{ type: "organization", name: "Deloitte" }, { type: "person", name: "Roman Abramovich" }, { type: "place", name: "Cyprus", region: "country:CYP" }],
    canvas: { composition: "TYPE-FULL" },
  };
  const dirs = ladderAll(b);
  assert.deepEqual(dirs[0].art.kinds, ["plate-organization", "plate-person"]);
  assert.equal(dirs[1].map, "Cyprus", "the mappable place is directed as a map");
});

test("a row with no recorded kinds is read exactly as before, not worse", () => {
  // An older manifest has names and items but no kinds. It must keep the old
  // behaviour rather than crash or silently claim coverage.
  const c = { composition: "ENTITY-ART", art: { kind: "plates", names: ["Acme"], items: [null] } };
  assert.equal(drawnOf(c)[0].kind, "plate-organization", "the pre-kinds fallback changed");
  assert.ok(coverageOf(c, { type: "organization", name: "Acme" }).covered, "an organisation in a kind-less row matched before and must still match");
});

test("a resolved mark still outranks the declared kind", () => {
  const c = { composition: "ENTITY-ART", art: { kind: "plates", names: ["NASA"], kinds: ["plate-organization"], items: [{ name: "NASA", asset: "a.png" }] } };
  assert.equal(drawnOf(c)[0].kind, "logo", "a real mark is reported as the logo it is");
});