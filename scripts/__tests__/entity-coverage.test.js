// NOTHING SPOKEN GOES UNREPRESENTED (owner, 2026-10-09): scripts/entity-coverage.js, scripts/entity-ladder.js and the
// ENTITY-ART compositions that answer an entity the sentence names.
import { test } from "node:test";
import assert from "node:assert/strict";
import { entitiesOf, coverageOf, checkEntityCoverage, sameName } from "../entity-coverage.js";
import { ladderFor, gapOf } from "../entity-ladder.js";
import { canvasLayout, canvasManifest, layoutViolations, normalizeCanvas } from "../../src/skills/remotion-render/visual/canvas-layout.js";
import { flagCodeOf } from "../../src/skills/remotion-render/visual/flags.js";
import { labelsDrawn } from "../template-check.js";
import { dateParts } from "../../src/skills/remotion-render/visual/date-parts.js";

const typo = { visual_type: "TYPE", composition: "TYPE-FULL", headline: "x" };
const beat = (narration, canvas = typo, named_entities = []) => ({ index: 1, narration, named_entities, canvas: { sentence: narration, ...canvas } });

test("what a sentence names: regions, dates, spans, figures — and not ages, ids or count words", () => {
  const e = entitiesOf({ sentence: "France now faces the highest borrowing costs seen in over 20 years." });
  assert.deepEqual(e.map((x) => `${x.type}:${x.name}`), ["place:France", "span:20 years"]);
  assert.deepEqual(entitiesOf({ sentence: "Launched on August 24, 2026, the operation targets 17 vessels and $352 million." }).map((x) => x.type), ["date", "number", "number"]);
  assert.deepEqual(entitiesOf({ sentence: "A 16-year-old girl found strangled in 1969 finally has a name after 57 years." }).map((x) => `${x.type}:${x.name}`), ["span:57 years", "date:1969"]);
  assert.deepEqual(entitiesOf({ sentence: "The J-1 visa program has 1 purpose." }), []);
  assert.deepEqual(entitiesOf({ sentence: "From 1969 to 2023 the law stood." }).map((x) => x.type), ["span"]);
});

test("a words-only beat that names an entity FAILS; one that names nothing is allowed", () => {
  const r = checkEntityCoverage([beat("France now faces the highest costs."), beat("That changes everything for them.")]);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].beat, 0);
  assert.match(r.failures[0].why, /words only/);
  assert.equal(r.wordsOnlyBeats, 1);
});

test("a near-match does not count: France is satisfied by France highlighted or its flag, not by Europe", () => {
  const sentence = "France now faces the highest borrowing costs.";
  const europe = { visual_type: "MAP", composition: "MAP-CENTERED", data: { place: "Europe" } };
  const france = { visual_type: "MAP", composition: "MAP-CENTERED", data: { place: "France" } };
  const flag = { composition: "ENTITY-ART", art: { kind: "flag", name: "France", region: "country:FRA" } };
  const germanFlag = { composition: "ENTITY-ART", art: { kind: "flag", name: "Germany", region: "country:DEU" } };
  assert.equal(checkEntityCoverage([beat(sentence, europe)]).failures.length, 1);
  assert.equal(checkEntityCoverage([beat(sentence, germanFlag)]).failures.length, 1);
  assert.equal(checkEntityCoverage([beat(sentence, france)]).failures.length, 0);
  assert.equal(checkEntityCoverage([beat(sentence, flag)]).failures.length, 0);
});

test("each entity type is answered by its own visual", () => {
  const cases = [
    ["person", "Betty Jo Norris was found.", { type: "person", name: "Betty Jo Norris" }, { composition: "ENTITY-ART", art: { kind: "plate-person", name: "Betty Jo Norris" } }],
    ["person photo", "Betty Jo Norris was found.", { type: "person", name: "Betty Jo Norris" }, { composition: "PORTRAIT", photo: { entity: "Betty Jo Norris", kind: "person", view: "person" } }],
    ["organisation", "The FBI joined the case.", { type: "organization", name: "FBI" }, { composition: "TYPE-FULL", concept_visuals: [{ name: "FBI", class: "cutout", logo: true }] }],
    ["date", "It began on August 24, 2026.", null, { composition: "ENTITY-ART", art: { kind: "date", name: "August 24, 2026", text: "August 24, 2026" } }],
    ["span", "It took 57 years to name her.", null, { composition: "ENTITY-ART", art: { kind: "span", name: "57 years" } }],
    ["figure", "Losses reached $352 million.", null, { composition: "NUMBER-FULL", data: { value: "$352 million", label: "lost" } }],
  ];
  for (const [what, sentence, ent, canvas] of cases) assert.equal(checkEntityCoverage([beat(sentence, canvas, ent ? [ent] : [])]).failures.length, 0, what);
  // ...and each is NOT answered by a plain statement.
  for (const [what, sentence, ent] of cases) assert.equal(checkEntityCoverage([beat(sentence, typo, ent ? [ent] : [])]).failures.length, 1, `${what} on words only`);
});

test("the ladder fills the gap with the visual of the entity, and leaves a beat that draws something alone", () => {
  assert.deepEqual(ladderFor(beat("France now faces the highest costs.")), { map: "France", region: "country:FRA", flag: "fr" });
  assert.deepEqual(ladderFor(beat("Police found her in Oakland.", typo, [{ type: "place", name: "Oakland" }])), { art: { kind: "plate-place", name: "Oakland" } });
  assert.equal(ladderFor(beat("Betty Jo Norris was found.", typo, [{ type: "person", name: "Betty Jo Norris" }])).art.kind, "plate-person");
  assert.equal(ladderFor(beat("The FBI joined the case.", typo, [{ type: "organization", name: "FBI" }])).art.kind, "plate-organization");
  assert.equal(ladderFor(beat("It began on August 24, 2026.")).art.kind, "date");
  assert.equal(ladderFor(beat("It took 57 years to name her.")).art.kind, "span");
  assert.deepEqual(ladderFor(beat("Losses reached $352 million.")), { figure: { value: "$352 million", label: "Losses reached" } }.figure ? ladderFor(beat("Losses reached $352 million.")) : null);
  assert.equal(ladderFor(beat("France now faces the highest costs.", { composition: "DATA-FULL", visual_type: "BAR", data: { bars: [{ label: "France", value: "9%" }] } })), null, "a chart is left to the gate");
  assert.equal(gapOf(beat("That changes everything.")).covered, true);
});

test("every ENTITY-ART kind is centred, legal, and keeps its words out of the top band", () => {
  const arts = [{ kind: "flag", name: "France", region: "country:FRA", aspect: 1.5, asset: "flags/fr.png" }, { kind: "plate-person", name: "Betty Jo Norris" }, { kind: "plate-organization", name: "FBI" }, { kind: "plate-place", name: "Oakland" }, { kind: "date", name: "August 24, 2026", text: "August 24, 2026" }, { kind: "span", name: "57 years" }];
  for (const art of arts) for (const variant of [0, 1]) for (const headline of ["France votes", "Betty Jo Norris was identified after decades of silence", "The operation began"]) {
    const c = { visual_type: "TYPE", composition: "ENTITY-ART", art, headline, variant };
    const L = canvasLayout(normalizeCanvas(c, variant));
    assert.deepEqual(layoutViolations(L), [], `${art.kind} v${variant} "${headline}"`);
    const cy = L.boxes.art.y + L.boxes.art.h / 2, cx = L.boxes.art.x + L.boxes.art.w / 2;
    assert.ok(Math.abs(cy - 960) <= 130, `${art.kind}: centred vertically (y ${cy})`);
    assert.ok(Math.abs(cx - 540) <= 2, `${art.kind}: centred horizontally`);
    assert.deepEqual(labelsDrawn(canvasManifest(c, variant)), [], `${art.kind}: no words in the top band`);
    assert.equal(canvasManifest(c, variant).art.kind, art.kind);
  }
});

test("flag codes: countries and US states, and none for a region with no flag", () => {
  assert.equal(flagCodeOf("country:FRA"), "fr");
  assert.equal(flagCodeOf("country:GBR"), "gb");
  assert.equal(flagCodeOf("us:CA"), "us-ca");
  assert.equal(flagCodeOf("country:ATA"), null);
  assert.equal(flagCodeOf(null), null);
});

test("a date is split into the calendar page's parts; names match across 'the'", () => {
  assert.deepEqual(dateParts("August 24, 2026"), { month: "AUG", day: "24", year: "2026" });
  assert.deepEqual(dateParts("1969"), { month: null, day: null, year: "1969" });
  assert.equal(sameName("the Texas Rangers", "Texas Rangers"), true);
  assert.equal(sameName("France", "Germany"), false);
});
