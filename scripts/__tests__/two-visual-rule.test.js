// THE TWO-VISUAL RULE — every entity the sentence names gets something on screen.
//
// A sentence that names two things has to show both: "X moved from A to B" shows
// A, B and the move; a comparison shows both sides; a cause shows both ends.
// The entity ladder answered only `gapOf().primary`, so the second thing the
// voice said had nothing on screen.
//
// Measured on board 38226641642's four renders (29 beats): 9 beats named two or
// more entities, and 1 of them showed two or more. The three beats below are
// verbatim from those renders — the sentence, the named entities, and what the
// frame actually drew.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ladderAll, ladderFor } from "../entity-ladder.js";
import { drawnOf } from "../entity-coverage.js";

// ch-9 beat 4 — drew ONE plate for four named entities.
const CH9_B4 = {
  index: 4,
  narration: "The United Nations Security Council condemned the invasion of Tigray by Ethiopia and Eritrea.",
  named_entities: [
    { type: "place", name: "Ethiopia" },
    { type: "place", name: "Eritrea" },
    { type: "place", name: "Tigray" },
    { type: "organization", name: "United Nations Security Council" },
  ],
  canvas: { composition: "ENTITY-ART", art: { kind: "plate-organization", name: "United Nations Security Council" } },
};

// ch-26 beat 6 — drew a map of Cyprus; Deloitte and Abramovich were on nothing.
const CH26_B6 = {
  index: 6,
  narration: "Deloitte and Roman Abramovich in Cyprus.",
  named_entities: [
    { type: "organization", name: "Deloitte" },
    { type: "person", name: "Roman Abramovich" },
    { type: "place", name: "Cyprus", region: "country:CYP" },
  ],
  canvas: { composition: "MAP-CENTERED", data: { place: "Cyprus" } },
};

// ch-1 beat 3 — a bar chart; Investopedia and You Need a Budget were on nothing.
const CH1_B3 = {
  index: 3,
  narration: "Investopedia rated You Need a Budget 3.7.",
  named_entities: [
    { type: "organization", name: "Investopedia" },
    { type: "organization", name: "You Need a Budget" },
    { type: "number", name: "3.7" },
  ],
  canvas: { composition: "DATA-FULL", visual_type: "BAR" },
};

const named = (b) => ladderAll(b).flatMap((d) => {
  if (d.art?.names) return d.art.names;
  if (d.art?.name) return [d.art.name];
  if (d.map) return [d.map];
  return [];
});

test("ch-9 beat 4: Ethiopia, Eritrea and Tigray all get a visual, not just the UN", () => {
  const got = named(CH9_B4);
  for (const e of ["Ethiopia", "Eritrea", "Tigray"]) {
    assert.ok(got.includes(e), `"${e}" was named by the sentence and got no visual; ladder returned ${JSON.stringify(got)}`);
  }
});

test("ch-26 beat 6: Deloitte and Abramovich are directed, and Cyprus keeps its map", () => {
  const got = named(CH26_B6);
  assert.ok(got.includes("Deloitte") && got.includes("Roman Abramovich"), `got ${JSON.stringify(got)}`);
  // The map the beat already draws is substance and is NOT thrown away: the
  // missing entities are added beside it (alongside), never replacing it.
  const dirs = ladderAll(CH26_B6);
  assert.ok(dirs.every((d) => d.alongside === true), "a beat with substance must add, not replace");
});

test("ch-1 beat 3: both organisations get a plate row", () => {
  const got = named(CH1_B3);
  assert.ok(got.includes("Investopedia") && got.includes("You Need a Budget"), `got ${JSON.stringify(got)}`);
  const plates = ladderAll(CH1_B3).find((d) => d.art?.kind === "plates");
  assert.ok(plates, "two organisations should share one `plates` row, the rung the layout already draws");
  assert.deepEqual(plates.art.names, ["Investopedia", "You Need a Budget"]);
});

test("a beat that already covers everything gets no directive", () => {
  // Never regress into adding a visual the frame does not need.
  const done = {
    index: 0,
    narration: "Adigrat was retaken.",
    named_entities: [{ type: "place", name: "Adigrat" }],
    canvas: { composition: "SCENE-LOW", photo: { entity: "Adigrat", kind: "place" } },
  };
  assert.deepEqual(ladderAll(done), []);
});

test("the single-entity path is unchanged (ladderFor still answers the primary)", () => {
  const one = {
    index: 0,
    narration: "Prague was named.",
    named_entities: [{ type: "place", name: "Prague" }],
    canvas: { composition: "TYPE-FULL" },
  };
  const viaAll = ladderAll(one);
  assert.equal(viaAll.length, 1, "one entity -> one directive");
  assert.equal(viaAll[0].art.name, "Prague");
  assert.ok(ladderFor(one), "ladderFor stays available for its existing callers");
});

test("nothing is ever invented: every directed name is one the sentence named", () => {
  for (const b of [CH9_B4, CH26_B6, CH1_B3]) {
    const allowed = new Set((b.named_entities || []).map((e) => e.name));
    for (const n of named(b)) {
      assert.ok(allowed.has(n), `ladder invented "${n}", which the sentence does not name`);
    }
  }
});

test("the directed names are exactly the ones the frame was missing", () => {
  // A name the frame ALREADY draws must not be directed again — that would put
  // the same entity on two beats, which the no-repeat rule refuses.
  for (const b of [CH9_B4, CH26_B6, CH1_B3]) {
    const already = new Set(drawnOf(b.canvas).map((d) => d.name).filter(Boolean));
    for (const n of named(b)) {
      assert.ok(!already.has(n), `"${n}" is already drawn by the frame and was directed anyway`);
    }
  }
});