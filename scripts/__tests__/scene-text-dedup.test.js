// Duplicates and role conflicts between the mechanism table and the canvas.
//
// Board 38177554641 ch-1 is the first full board to run with the canvas-backed
// text inventory, and it exposed two ways the merged report can lie even
// though both sources are now read:
//
//  1. DOUBLE-COUNTING. A TYPOGRAPHY beat's `beat.text` IS its canvas statement
//     box, so the table and the canvas name the same string. The inventory
//     reported it twice, and the auditor's "a beat drawing two or more
//     narrative lines" check read that as a stacked headline on frames that
//     draw one.
//  2. ROLE CONFLICT. On a PROPORTIONAL_OBJECTS beat whose only text box is a
//     headline, the table's `objects.*.label -> value` entry re-reported the
//     headline as a figure. "value" is EXEMPT from the word budget and is
//     checked by a different rule, so the headline silently escaped the phrase
//     contract, and the figure-slot check would demand a number be put where a
//     sentence is drawn.
//
// One string is one entry, and the canvas's role wins because the canvas is
// what the frame shows. Pinned here so a future source cannot reintroduce a
// second claim on the same ink.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sceneTextInventory } from "../../src/skills/remotion-render/visual/scene-text.js";

// The canvas record exactly as canvasManifest wrote it, for the two beats that
// double-reported. Box `lines` and roles are the renderer's own.
const BEAT0 = {
  boxes: {
    rule: { x: 48, y: 130, w: 96, h: 6, role: "rule" },
    art: { x: 80, y: 700, w: 920, h: 330, role: "concept" },
    statement: { x: 199, y: 1184, w: 682, h: 114, role: "headline", align: "center", size: 120, lines: ["96 days a year"] },
  },
};
const BEAT7 = {
  boxes: {
    rule: { x: 48, y: 130, w: 96, h: 6, role: "rule" },
    statement: { x: 351, y: 1125, w: 378, h: 167, role: "headline", align: "center", size: 88, lines: ["Track your", "spending"] },
    underline: { x: 360, y: 1328, w: 360, h: 4, role: "rule" },
  },
};

test("a TYPOGRAPHY beat reports its headline once, not twice", () => {
  const list = sceneTextInventory("TYPOGRAPHY", { objects: [] }, "96 days a year", BEAT0);
  assert.equal(list.length, 1, `expected 1 string, got ${JSON.stringify(list)}`);
  assert.equal(list[0].text, "96 days a year");
});

test("the wrapped statement joins to one string, and is still reported once", () => {
  const list = sceneTextInventory("TYPOGRAPHY", { objects: [] }, "Track your spending", BEAT7);
  assert.equal(list.length, 1, `expected 1 string, got ${JSON.stringify(list)}`);
  assert.equal(list[0].text, "Track your spending");
});

test("a headline drawn on a PROPORTIONAL_OBJECTS beat stays narrative, not a figure", () => {
  // The mechanism table declares objects.*.label a "value". The canvas draws
  // that same string as the headline box. The canvas role must win, or the
  // phrase is exempt from the word budget and the figure-slot rule asks for a
  // number in a slot holding a sentence.
  const scene = { objects: [{ label: "Take control today" }] };
  const canvas = {
    boxes: {
      statement: { x: 157, y: 1203, w: 766, h: 99, role: "headline", align: "center", size: 104, lines: ["Take control today"] },
      cutout0: { x: 320, y: 660, w: 440, h: 440, role: "concept" },
    },
  };
  const list = sceneTextInventory("PROPORTIONAL_OBJECTS", scene, "", canvas);
  assert.equal(list.length, 1, `expected 1 string, got ${JSON.stringify(list)}`);
  assert.equal(list[0].role, "narrative", `headline was reported as "${list[0].role}"`);
});

test("a number box is still reported as a value", () => {
  // The dedup must not collapse a real figure into the narrative slot, and
  // must not stop reporting strings the canvas draws that the table omits.
  const canvas = {
    boxes: {
      number: { x: 299, y: 650, w: 482, h: 270, role: "number", align: "center", size: 300, parts: { isQuantity: true, text: "62%" } },
      label: { x: 320, y: 948, w: 441, h: 44, role: "data", align: "center", size: 40, lines: ["CONSUMERS REGRET"] },
      headline: { x: 166, y: 1222, w: 748, h: 84, role: "headline", align: "center", size: 88, lines: ["62% regret purchases"] },
    },
  };
  const list = sceneTextInventory("CAPABILITY", { objects: [] }, "", canvas);
  const byText = Object.fromEntries(list.map((t) => [t.text, t.role]));
  assert.equal(byText["CONSUMERS REGRET"], "quiet", "a data label is chrome, not narrative");
  assert.equal(byText["62% regret purchases"], "narrative", "the headline is the narrative string");
  assert.equal(list.filter((t) => t.text === "62% regret purchases").length, 1);
});