// A short all-caps token may be an acronym and may carry a place qualifier
// ("ÉTS Montréal" names the school, not a Montréal branch of an unknown
// "ÉTS"). The qualifier is dropped for the lookup only; the plan's display
// name is unchanged. The accented token is folded for the key ("ÉTS" -> "ETS").
// This is the resolver gap that left ch-48's institution without its real mark
// (board 39332364472 ch-48: "ÉTS Montréal" found in no source).
import test from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
const { expandName } = createRequire(import.meta.url)("../entity-assets.cjs");

test("an accented acronym with a place qualifier expands for the lookup", () => {
  const r = expandName("organization", "ÉTS Montréal");
  assert.strictEqual(r.name, "École de technologie supérieure");
  assert.match(r.note, /ÉTS/);
});

test("the bare accented acronym and the unaccented spelling expand too", () => {
  assert.strictEqual(expandName("organization", "ÉTS").name, "École de technologie supérieure");
  assert.strictEqual(expandName("organization", "ETS Montréal").name, "École de technologie supérieure");
});

test("an unknown token with a qualifier is left alone, not refused", () => {
  assert.deepStrictEqual(expandName("organization", "XYZ Montréal"), { name: "XYZ Montréal" });
});

test("a bare unknown acronym is still refused, as before", () => {
  assert.match(expandName("organization", "XYZ").refuse, /no unambiguous expansion/);
});

test("only organizations are expanded", () => {
  assert.deepStrictEqual(expandName("person", "ÉTS Montréal"), { name: "ÉTS Montréal" });
});
