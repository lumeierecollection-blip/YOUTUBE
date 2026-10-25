// A RUNG MUST MATCH THE ENTITY'S TYPE, OR THE BEAT READS AS DRAWING NOTHING.
//
// Board 38411644598, one signature across three channels:
//
//   [canvas] FAIL entity-coverage — draws plate-place, none of it the entity
//
//   ch-10 beat 6: organization "IdeaLens"       — draws plate-place
//   ch-44 beat 1: organization "Google Scholar" — draws plate-place
//   ch-8  beat 3: date "June 25"               — draws a figure
//
// The cause was in the ladder's OWN anti-doubling fix (6e36891b). When a beat's
// neighbour already draws a `plates` row, so this beat does not take one either,
// the fallback emitted:
//
//   { art: { kind: "plate-place", name: row[0].name } }
//
// `row[0]` is simply the first uncovered entity. It is often an ORGANISATION, and
// an organisation on a place rung matches nothing: coverageOf() accepts
// logo/photo/plate-organization/cutout for an organization, and map/flag/photo/
// plate-place for a place. So the rung recognised neither, and the beat was
// reported as drawing none of its entity while a plate was plainly on screen.
//
// The check was not reading a proxy here — it was reading a rung that was wrong.
//
// The right rung was already computed, two lines above, as kinds[0].
import { test } from "node:test";
import assert from "node:assert/strict";
import { ladderAll } from "../entity-ladder.js";
import { coverageOf } from "../entity-coverage.js";

const plan = [
  { index: 5, art: { kind: "plates", names: ["A", "B"], kinds: ["plate-organization", "plate-organization"] } },
  { index: 6 },
];

const beatWith = (entities) => ({
  index: 6,
  narration: "IdeaLens and Google Scholar published the review.",
  named_entities: entities,
  canvas: { composition: "TYPE-FULL" },
});

test("ch-10's real case: an organisation beside a row gets a plate-organization", () => {
  const b = beatWith([
    { type: "organization", name: "IdeaLens" },
    { type: "date", name: "October 13, 2026" },
  ]);
  const dirs = ladderAll(b, plan);
  const art = dirs.find((d) => d.art)?.art;
  assert.ok(art, `expected an art directive, got ${JSON.stringify(dirs)}`);
  assert.equal(art.kind, "plate-organization", `an organization drew as "${art.kind}"`);
});

test("ch-44's real case: same shape, same rung", () => {
  const b = beatWith([
    { type: "organization", name: "Google Scholar" },
    { type: "number", name: "5,000,000" },
  ]);
  const art = ladderAll(b, plan).find((d) => d.art)?.art;
  assert.equal(art.kind, "plate-organization");
});

test("coverageOf() matches the rung the ladder chose for a real case", () => {
  // The invariant on the path that was broken, using a case the board produced.
  const b = beatWith([
    { type: "organization", name: "IdeaLens" },
    { type: "date", name: "October 13, 2026" },
  ]);
  const art = ladderAll(b, plan).find((d) => d.art)?.art;
  assert.ok(coverageOf({ composition: "ENTITY-ART", art }, { type: "organization", name: "IdeaLens" }).covered,
    `"IdeaLens" drew as ${art.kind} and coverageOf() could not match it`);
});

test("the neighbour guard still stops two adjacent rows — that fix must survive", () => {
  const b = beatWith([{ type: "organization", name: "IdeaLens" }, { type: "person", name: "Philip Goff" }]);
  const dirs = ladderAll(b, plan);
  const art = dirs.find((d) => d.art)?.art;
  assert.ok(art, "no art directive");
  assert.ok(art.kind !== "plates", "the anti-doubling guard regressed — two adjacent rows are the same frame twice");
});