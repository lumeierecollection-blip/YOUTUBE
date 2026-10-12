// TWO SUBJECTS ARE DRAWN ONCE, AND A PHOTO OF THE WRONG PLACE YIELDS.
//
// Board 38307081974:
//
//   ch-2  beat 5: organization "Law360", number "360" — draws figure, none of
//         it the entity
//   ch-2  beat 2: organization "Code of Federal Regulations" — draws photo,
//         none of it the entity
//   ch-49 beat 5: person "Jessica Chastain", number "$27.5 million" — draws
//         figure, none of it the entity
//
// Two causes, both in what the ladder puts on the beat.
//
// 1. THE SAME NUMBER TWICE. "Law360 is cited 360 times" yields the figure twice:
//    once as "360" (the entity extractor) and once as "360 times"
//    (quantitiesOf). The row deduped by NAME, so two entries went on screen
//    for one number — the repetition the no-repeat rule exists to refuse, and
//    the count the gate read. The row now dedupes numbers by their DIGITS as
//    well as by name.
//
// 2. A PHOTO OF THE WRONG SUBJECT KEEPS THE BEAT. yieldsTo already had the
//    rule for a map — "a map of somewhere the sentence does not name is wrong,
//    not just unhelpful" — but not for a photo. ch-2 beat 2 is about the Code
//    of Federal Regulations and the frame showed the Capitol, read as "draws
//    photo, none of it the entity". It could not be fixed by adding a plate
//    beside it: no photo composition lays out a second object (measured with
//    canvasManifest — SCENE-LOW, PHOTO-BAND, DOCUMENT, ENTITY-ART and
//    ARCHITECTURE lay out no cutout box), so an alongside visual would have been
//    dropped silently. So a photo of a subject the sentence does not name
//    yields, exactly as a map does, and the entity takes the beat.
//
// A photo OF the right subject stays: the rule only fires when nothing the
// sentence names is answered by it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ladderAll, yieldsTo, gapOf } from "../entity-ladder.js";
import { coverageOf } from "../entity-coverage.js";

test("a figure named two ways is drawn once", () => {
  const b = {
    index: 5,
    narration: "Law360 is cited 360 times.",
    named_entities: [{ type: "organization", name: "Law360" }, { type: "number", name: "360" }],
    canvas: { composition: "NUMBER-FULL", data: { value: "360", label: "times cited" }, sentence: "Law360 is cited 360 times." },
  };
  const [d] = ladderAll(b);
  assert.ok(d.art, `expected a row, got ${JSON.stringify(d)}`);
  // Count the FIGURE entries by their declared kind — an organisation called
  // "Law360" contains digits but is not a figure.
  const figures = d.art.names.filter((_, i) => d.art.kinds[i] === "figure");
  assert.equal(figures.length, 1, `the same figure went on the beat twice: ${JSON.stringify(d.art.names)}`);
  assert.deepEqual(d.art.kinds, ["plate-organization", "figure"]);
});

test("two DIFFERENT figures are both drawn", () => {
  const b = {
    index: 5,
    narration: "Jessica Chastain received $27.5 million.",
    named_entities: [{ type: "person", name: "Jessica Chastain" }, { type: "number", name: "$27.5 million" }],
    canvas: { composition: "NUMBER-FULL", data: { value: "27.5", label: "million" }, sentence: "Jessica Chastain received $27.5 million." },
  };
  const [d] = ladderAll(b);
  assert.deepEqual(d.art.names, ["Jessica Chastain", "$27.5 million"]);
  assert.deepEqual(d.art.kinds, ["plate-person", "figure"]);
});

test("a photo of somewhere the sentence does not name yields, like a map", () => {
  const b = {
    index: 2,
    narration: "The Code of Federal Regulations was amended.",
    named_entities: [{ type: "organization", name: "Code of Federal Regulations" }],
    canvas: { composition: "SCENE-LOW", photo: { entity: "Capitol", kind: "building" }, sentence: "The Code of Federal Regulations was amended." },
  };
  assert.equal(yieldsTo(b, gapOf(b)), true, "a photo of the Capitol does not answer a sentence about the CFR");
  // and so the entity REPLACES it, rather than riding beside a composition
  // that has no slot for a second object
  const [d] = ladderAll(b);
  assert.equal(d.alongside, false, "a photo composition lays out no second object; alongside would be dropped silently");
  assert.equal(d.art.name, "Code of Federal Regulations");
});

test("a photo OF the entity stays", () => {
  const b = {
    index: 2,
    narration: "Police gathered at the Capitol.",
    named_entities: [{ type: "place", name: "Capitol", region: "country:USA" }],
    canvas: { composition: "SCENE-LOW", photo: { entity: "Capitol", kind: "building" }, sentence: "Police gathered at the Capitol." },
  };
  assert.equal(yieldsTo(b, gapOf(b)), false, "a photo OF the place the sentence names must not be discarded");
});

test("the replacement covers what the photo failed to", () => {
  const b = {
    index: 2,
    narration: "The Code of Federal Regulations was amended.",
    named_entities: [{ type: "organization", name: "Code of Federal Regulations" }],
    canvas: { composition: "TYPE-FULL", sentence: "The Code of Federal Regulations was amended." },
  };
  const [d] = ladderAll(b);
  const c = { composition: "ENTITY-ART", art: { kind: d.art.kind, name: d.art.name, names: [d.art.name], kinds: [d.art.kind], items: [null] } };
  assert.ok(coverageOf(c, { type: "organization", name: "Code of Federal Regulations" }).covered);
});