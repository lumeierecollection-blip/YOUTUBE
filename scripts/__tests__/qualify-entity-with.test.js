// A generic institution name is qualified with the script's one country only when that cannot be wrong (board 38044082797 ch 9:
// the US "Department of the Treasury" in a script about sanctions on Iran was looked up as "Department of the Treasury of Iran").
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { qualifyEntityWith } = createRequire(import.meta.url)("../entity-assets.cjs");

const treasury = { type: "institution", name: "Department of the Treasury" };
const us = async () => ({ type: "standard", title: "United States Department of the Treasury", description: "Executive department of the US government" });

test("the plain name's primary article names another country: it is used, Iran is not forced onto it", async () => {
  const q = await qualifyEntityWith(treasury, ["Iran"], us);
  assert.equal(q.ent.name, "Department of the Treasury");
  assert.match(q.note, /primary article/);
});

test("the primary article IS of the script's country: the qualified name stands, as before", async () => {
  const q = await qualifyEntityWith(treasury, ["United States"], us);
  assert.equal(q.ent.name, "Department of the Treasury of United States");
});

test("a disambiguation page, no article or an article naming no country: qualified as before", async () => {
  for (const s of [async () => null, async () => ({ type: "disambiguation", title: "Treasury" }), async () => ({ type: "standard", title: "Treasury", description: "State department" }), async () => { throw new Error("offline"); }]) {
    assert.equal((await qualifyEntityWith(treasury, ["Iran"], s)).ent.name, "Department of the Treasury of Iran");
  }
});

test("not a generic name, or more than one country: untouched / refused exactly as qualifyEntity", async () => {
  const fbi = { type: "organization", name: "Federal Bureau of Investigation" };
  assert.equal((await qualifyEntityWith(fbi, ["Iran"], us)).ent, fbi);
  assert.equal((await qualifyEntityWith(treasury, ["Iran", "Russia"], us)).ent, null);
});
