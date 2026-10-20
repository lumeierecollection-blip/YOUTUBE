// STRICT FRAME RULE — "every frame must have a visual asset. No pure text cards." — THE CHANNELS THAT FAILED ONLY.
//
// Owner, 2026-10-20, after ch-01 kept posting while ch-02 and ch-48 kept being rejected by the frame review:
//
//   ch-2  run 39351979163: TEMPLATE_MONOCULTURE — 57% headline-dominated beats (4/7; beats 1 and 6 both
//         drew the same "Precisely Software Limited, October 14, 2026" plate row with no assets)
//   ch-48 run 39349415234: TEMPLATE_MONOCULTURE — 100% headline-dominated beats (the Max Planck topic;
//         the Wilkhahn topic before it, 75%)
//
// The rule is scoped by config/channels.json "strict_visual" (ch-02, ch-48) — ch-01 and every other
// channel keeps the old behaviour, byte for byte. In render-and-qa.js resolveCanvas, right after
// entityLadder: a beat whose FINAL canvas is typography or asset-less plates is upgraded to a figure its
// own sentence grounds (the same extractors + checkVisual gate the planner uses — nothing is invented);
// a beat whose sentence grounds no figure / date / place / list / comparison / document / money object /
// cause-sequence FAILS the render (no text-only video, and no invented arrow or icon either).
//
// gemini-frame-review.js's headline test is untouched: this fails earlier and louder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { strictVisualEnabled, groundedVisualFor, canvasHasRealVisual, strictVisualAudit, strictUngroundableSentences } from "../strict-visual.mjs";

test("the rule is scoped to the channels that failed (config strict_visual)", () => {
  assert.equal(strictVisualEnabled(2), true);
  assert.equal(strictVisualEnabled(48), true);
  for (const id of [1, 3, 5, 9, 26, 29, 49]) assert.equal(strictVisualEnabled(id), false, `ch-${id} must keep the old behaviour`);
});

test("a sentence that states a figure grounds a COUNTER (ch-2's OVHcloud type beat)", () => {
  const g = groundedVisualFor("The company raised $7 million in March 2024.");
  assert.ok(g, "a stated figure must ground a visual");
  assert.equal(g.visual_type, "COUNTER");
  assert.match(String(g.data.value), /7/);
});

test("two stated figures compared ground a COMPARE; a bare pair grounds a chart", () => {
  const cmp = groundedVisualFor("Revenue was $4 million compared to $2 million the year before.");
  assert.ok(cmp);
  assert.equal(cmp.visual_type, "COMPARE");
  const fromTo = groundedVisualFor("Output rose from 12 units to 40 units.");
  assert.ok(fromTo);
  assert.equal(fromTo.visual_type, "COMPARE"); // from-to is the comparison split's designed case
  const bar = groundedVisualFor("The team shipped 12 units in May and 40 units in June.");
  assert.ok(bar);
  assert.equal(bar.visual_type, "BAR");
  assert.equal(bar.data.bars.length, 2);
});

test("a stated percentage grounds a PIE (and the value is the sentence's own)", () => {
  const g = groundedVisualFor("The tool cut review time by 57% across the team.");
  assert.ok(g);
  assert.ok(["PIE", "GAUGE"].includes(g.visual_type));
  assert.equal(g.data.percent, 57);
});

test("two dated events ground a TIMELINE", () => {
  const g = groundedVisualFor("The law passed in 2019 and was repealed in 2021.");
  assert.ok(g);
  assert.equal(g.visual_type, "TIMELINE");
  assert.equal(g.data.markers.length, 2);
});

test("a named place grounds a MAP (ch-2's Burlington, Massachusetts beats)", () => {
  const g = groundedVisualFor("It shipped from Burlington, Massachusetts on October 14, 2026.");
  assert.ok(g, "a named region must ground a map");
  assert.equal(g.visual_type, "MAP");
  assert.ok(String(g.data.place).length > 0);
});

test("an enumeration grounds a LIST and a stated flow grounds a PROCESS", () => {
  const li = groundedVisualFor("The three tiers are Basic, Pro, and Enterprise.");
  assert.ok(li);
  assert.equal(li.visual_type, "LIST");
  assert.deepEqual(li.data.items, ["Basic", "Pro", "Enterprise"]);
  const pr = groundedVisualFor("Missing checks led to legal repercussions.");
  assert.ok(pr, "a cause -> effect sentence must ground a process");
  assert.equal(pr.visual_type, "PROCESS");
});

test("a stated rise with no figures grounds a TREND", () => {
  const g = groundedVisualFor("Mortgage rates rose sharply last spring.");
  assert.ok(g);
  assert.equal(g.visual_type, "TREND");
});

test("a sentence that grounds nothing yields null — never an invented figure", () => {
  assert.equal(groundedVisualFor("The new platform changes how teams work together."), null);
  assert.equal(groundedVisualFor("This approach is simply different."), null);
  assert.equal(groundedVisualFor(""), null);
});

test("canvasHasRealVisual reads the manifest the way the frame review does", () => {
  // The two ch-2 beats that failed (names in type, no asset anywhere).
  assert.equal(canvasHasRealVisual({ composition: "ENTITY-ART", visual_type: "TYPE", art: { kind: "plates", names: ["Precisely Software Limited", "October 14, 2026"], kinds: ["plate-organization", "date"] } }), false);
  assert.equal(canvasHasRealVisual({ composition: "TYPE-FULL", visual_type: "TYPE", name_card: { name: "Precisely" } }), false);
  assert.equal(canvasHasRealVisual({ composition: "TYPE-FULL", visual_type: "TYPE" }), false);
  assert.equal(canvasHasRealVisual({ composition: "ENTITY-ART", visual_type: "TYPE", art: { kind: "date", name: "October 14, 2026" } }), false);
  // A real visual, one per family.
  assert.equal(canvasHasRealVisual({ composition: "ENTITY-ART", visual_type: "TYPE", art: { kind: "figure", name: "2026" } }), true);
  assert.equal(canvasHasRealVisual({ composition: "ENTITY-ART", visual_type: "TYPE", art: { kind: "flag", asset: "public/flags/de.svg" } }), true);
  assert.equal(canvasHasRealVisual({ composition: "ENTITY-ART", visual_type: "TYPE", art: { kind: "plates", names: ["OVHcloud"], kinds: ["plate-organization"], items: [{ asset: "public/logos/ovhcloud.svg" }] } }), true);
  assert.equal(canvasHasRealVisual({ composition: "TYPE-FULL", visual_type: "TYPE", concept_visuals: [{ name: "Flock", logo: true }] }), true);
  assert.equal(canvasHasRealVisual({ composition: "SCENE-FULL", visual_type: "PHOTO", photo: { asset: "public/photos/x.jpg" } }), true);
  assert.equal(canvasHasRealVisual({ composition: "NUMBER-FULL", visual_type: "COUNTER", data: { value: "7" } }), true);
});

test("the audit upgrades a text beat whose sentence grounds a figure, and reports one that grounds nothing", () => {
  const upgradeable = { index: 2, narration: "It cut review time by 57%.", canvas: { composition: "TYPE-FULL", visual_type: "TYPE" }, visual_type: "TYPE", data: null };
  const failing = { index: 3, narration: "The platform simply works better this way.", canvas: { composition: "TYPE-FULL", visual_type: "TYPE" }, visual_type: "TYPE", data: null };
  const visual = { index: 4, narration: "Any words at all.", canvas: { composition: "SCENE-FULL", visual_type: "PHOTO", photo: { asset: "public/photos/y.jpg" } } };
  const { upgrades, failures } = strictVisualAudit([upgradeable, failing, visual]);
  assert.equal(upgrades.length, 1);
  assert.equal(upgrades[0].target, upgradeable);
  assert.ok(["PIE", "GAUGE"].includes(upgrades[0].to), upgrades[0].to);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].beat, 3);
  assert.equal(upgrades.length + failures.length + 1, 3, "the already-visual beat is untouched");
});

test("numbers glued to letters are not figures (3D, A24), and trailing commas are cleaned", () => {
  assert.equal(groundedVisualFor("Generated 3D models fail 3D printing."), null);
  const g = groundedVisualFor("On August 28, 2026, the team published it.");
  assert.ok(g);
  assert.equal(g.visual_type, "COUNTER");
  assert.equal(g.data.value, "2026");
  assert.ok(!/,$/.test(String(g.data.value)), "a value must never keep the extractor's trailing comma");
});

test("MONEY / DOCUMENT cannot be upgraded after the fetch stage — they fail instead of degrading to type", () => {
  const b = { index: 5, narration: "The receipt shows the full amount.", canvas: { composition: "TYPE-FULL", visual_type: "TYPE" }, visual_type: "TYPE", data: null };
  const { upgrades, failures } = strictVisualAudit([b]);
  assert.equal(upgrades.length, 0);
  assert.equal(failures.length, 1);
  assert.match(failures[0].reason, /fetched/);
});

test("the script gate's strict check flags only sentences with no drawable content and no entity", () => {
  const bad = strictUngroundableSentences([
    "Prices rose sharply last spring.",          // TREND
    "It cut review time by 57%.",                // PIE
    "OVHcloud announced the plan.",              // named entity — may resolve to a real logo
    "In 2026 the team shipped it.",              // a figure
    "The platform simply works better this way.",// nothing
    "It keeps going.",                           // nothing
  ]);
  assert.equal(bad.length, 2);
  assert.ok(bad[0].includes("platform") && bad[1].includes("keeps going"));
});
