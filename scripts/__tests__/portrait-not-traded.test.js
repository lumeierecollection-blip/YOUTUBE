// A VERIFIED PORTRAIT IS NOT TRADED FOR A STAT CARD.
//
// Board 38313573278 ch-49 beat 5. The planner fetched and vision-verified a
// portrait of Jessica Chastain (gemini MATCH, face 28%) and the frame drew it.
// The sentence also states "$27.5 million", and the ladder replaced the portrait
// with a stat card to get the number in:
//
//   [canvas] FAIL entity-coverage — beat 5: person "Jessica Chastain", number
//   "$27.5 million" — draws figure, none of it the entity
//
// So the person the sentence is ABOUT went back on nothing to satisfy a number
// the beat already states in its headline — the exact defect the ladder exists
// to prevent, caused by the ladder itself.
//
// The distinction that matters is not which composition the beat uses. A plate
// row and a map can take a second name and are built to (ch-9 beat 4 drew one
// plate for four named places and now draws them all; ch-26 beat 6 draws a map
// of Cyprus and now directs Deloitte and Abramovich beside it). A PORTRAIT or a
// PHOTO is the whole frame: there is nowhere to put a second thing.
//
// Keying this on composition instead broke both of those cases, which is why the
// rule is keyed on what the beat DRAWS — a single portrait or photo — and both
// shapes are pinned here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ladderAll } from "../entity-ladder.js";
import { coverageOf } from "../entity-coverage.js";

const CH49_BEAT5 = {
  index: 5,
  narration: "Jessica Chastain starred in that rival feature to capture $27.5 million.",
  named_entities: [{ type: "person", name: "Jessica Chastain" }, { type: "number", name: "$27.5 million" }],
  visual_type: "PHOTO",
  data: { entity: "Jessica Chastain", entity_type: "person" },
  canvas: { composition: "PORTRAIT", photo: { entity: "Jessica Chastain", view: "person" }, sentence: "Jessica Chastain starred in that rival feature to capture $27.5 million." },
};

test("the verified portrait is kept; nothing is forced into the beat", () => {
  assert.deepEqual(ladderAll(CH49_BEAT5), [], "the ladder still wants to replace the portrait");
});

test("the portrait is what the sentence is about, and it is on the frame", () => {
  assert.ok(coverageOf(CH49_BEAT5.canvas, { type: "person", name: "Jessica Chastain" }).covered);
});

test("without the portrait, BOTH names are directed", () => {
  // The same sentence on a beat that draws neither: the row carries the person
  // and the figure together, which is the two-visual rule.
  const b = { ...CH49_BEAT5, visual_type: "COUNTER", data: null, canvas: { composition: "NUMBER-STAT", data: { value: "$27.5", label: "million" }, sentence: CH49_BEAT5.narration } };
  const [d] = ladderAll(b);
  assert.deepEqual(d.art.names, ["Jessica Chastain", "$27.5 million"]);
  assert.deepEqual(d.art.kinds, ["plate-person", "figure"]);
});

test("a plate row still takes the extra names beside it", () => {
  // The regression this rule could have caused: ch-9 beat 4.
  const b = {
    index: 4,
    narration: "The United Nations Security Council condemned the invasion of Tigray by Ethiopia and Eritrea.",
    named_entities: [
      { type: "place", name: "Ethiopia", region: "country:ETH" },
      { type: "place", name: "Eritrea", region: "country:ERI" },
      { type: "place", name: "Tigray" },
      { type: "organization", name: "United Nations Security Council" },
    ],
    canvas: { composition: "ENTITY-ART", art: { kind: "plate-organization", name: "United Nations Security Council" }, sentence: "The UN Security Council condemned the invasion of Tigray by Ethiopia and Eritrea." },
  };
  const dirs = ladderAll(b);
  assert.ok(dirs.length >= 2, `a plate row must still take the other names: ${JSON.stringify(dirs)}`);
  const named = dirs.flatMap((d) => (d.art?.name ? [d.art.name] : d.map ? [d.map] : []));
  for (const n of ["Ethiopia", "Eritrea", "Tigray"]) assert.ok(named.includes(n), `${n} got no visual`);
  assert.ok(dirs.every((d) => d.alongside === true), "the plate row already draws; the extras are added, not substituted");
});

test("a map still takes the extra names beside it", () => {
  // And ch-26 beat 6.
  const b = {
    index: 6,
    narration: "Deloitte and Roman Abramovich in Cyprus.",
    named_entities: [
      { type: "organization", name: "Deloitte" },
      { type: "person", name: "Roman Abramovich" },
      { type: "place", name: "Cyprus", region: "country:CYP" },
    ],
    canvas: { composition: "MAP-CENTERED", data: { place: "Cyprus" }, sentence: "Deloitte and Roman Abramovich in Cyprus." },
  };
  const dirs = ladderAll(b);
  assert.ok(dirs.length > 0, "a map must still take the names beside it");
  const named = dirs.flatMap((d) => (d.art?.names || []).concat(d.map ? [d.map] : []));
  assert.ok(named.includes("Deloitte") && named.includes("Roman Abramovich"), `got ${JSON.stringify(named)}`);
});