// The planner's label / pull phrase is chrome the code may REMOVE to make a shot sequence legal (never add).
// Board 37919459134 ch-26 beat 5: a photo whose every shot read "words in the top band" only because its
// planner label sat top-right — no legal sequence existed. shotMenu now carries a label-free twin of an option
// whose devices change without the label; Gemini is not offered it, legalSequences may use it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEXT_GRID } from "../../src/skills/remotion-render/visual/canvas-layout.js";
// Pre-grid shot grammar (the chart / photo twins and the top-band variants); production draws on the text grid (text-grid.test.js).
TEXT_GRID.on = false;
import { shotMenu, legalSequences, shotSequenceProblems } from "../render-and-qa.js";

const photo = (i) => ({ asset: `entities/p${i}.jpg`, entity: `Place ${i}`, view: "place", kind: "place", w: 1600, h: 1000 });
const beat = (i, label) => ({
  index: i, narration: `Beat ${i} names Place ${i} and its 40 percent.`,
  canvas: { visual_type: "PHOTO", composition: "SCENE-FULL", headline: `Place ${i} holds the vote`, photo: photo(i), label, variant: i, beat_index: i, beat_total: 6 },
});

test("a label-free twin exists exactly where dropping the label changes the devices, and is never the first choice", () => {
  const b = beat(0, { text: "Dallas", position: "top-right" });
  const menu = shotMenu(b.canvas, b);
  const plain = menu.filter((o) => !o.nochrome), twins = menu.filter((o) => o.nochrome);
  assert.ok(plain.every((o) => o.words === "top"), "with the label, every photo shot reads words-at-top");
  assert.ok(twins.length > 0 && twins.every((o) => o.words === "low" || o.phrase === false));
  assert.ok(menu.indexOf(twins[0]) > menu.indexOf(plain[plain.length - 1]), "twins come after every real option");
  assert.ok(twins.every((o) => !o.canvas.label), "the twin draws no label");
  // No label, no twin.
  const bare = beat(1, null);
  assert.equal(shotMenu(bare.canvas, bare).filter((o) => o.nochrome).length, 0);
});

test("six labelled photo beats have no legal sequence without twins and a legal one with them", () => {
  const beats = Array.from({ length: 6 }, (_, i) => beat(i, { text: `Label ${i}`, position: "top-right" }));
  const idx = beats.map((b) => b.index);
  const menus = beats.map((b) => shotMenu(b.canvas, b));
  const withoutTwins = menus.map((m) => m.filter((o) => !o.nochrome));
  assert.equal(legalSequences(withoutTwins, idx, [], 1).length, 0);
  const seqs = legalSequences(menus, idx, [], 1);
  assert.equal(seqs.length, 1);
  assert.deepEqual(shotSequenceProblems(seqs[0], idx), []);
  assert.ok(seqs[0].some((o) => o.nochrome), "the legal sequence leaves at least one label out");
});
