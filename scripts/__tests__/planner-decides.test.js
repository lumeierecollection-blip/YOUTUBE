import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolveGround, luminance, GROUND } from "../../src/skills/remotion-render/visual/backgrounds.js";
import { normalizeCanvas, canvasManifest, backgroundOf } from "../../src/skills/remotion-render/visual/canvas-layout.js";
import { wantedTypes, nearestComposition, COMPOSITIONS } from "../composition-vocab.js";
import { applyMotionTiers, normalizeGrounds, compositionsUsed } from "../planner-decisions.js";
import { translateScene } from "../scene-translate.js";
import { buildPlanPromptParts } from "../gemini-visual-plan.js";

const require = createRequire(import.meta.url);
const caps = require("../plan-caps.cjs");

describe("1.1 ground: the planner's choice, white by default", () => {
  it("nothing, 'white' and 'transparent' are the house white", () => {
    for (const v of [undefined, null, "", "white", "WHITE", "default", "transparent", "#fff", "#FFFFFF"]) assert.equal(resolveGround(v).hex, null, String(v));
    assert.equal(resolveGround("transparent").source, "transparent");
  });
  it("a hex is a ground; a dark one takes light ink", () => {
    assert.deepEqual([resolveGround("#0E0E10").hex, resolveGround("#0E0E10").dark], ["#0E0E10", true]);
    assert.deepEqual([resolveGround("#F0F0F0").hex, resolveGround("#F0F0F0").dark], ["#F0F0F0", false]);
    assert.equal(resolveGround("#0af").hex, "#00AAFF");
  });
  it("a colour description is read; one that is not stays white and is reported unparsed", () => {
    assert.equal(resolveGround("deep navy").hex, "#0F1B33");
    assert.equal(resolveGround("a warm cream paper").hex, "#F5EFE0");
    assert.equal(resolveGround("something indescribable").source, "unparsed");
    assert.equal(resolveGround("something indescribable").hex, null);
  });
  it("luminance orders black < grey < white", () => {
    assert.ok(luminance("#000000") < luminance("#808080") && luminance("#808080") < luminance(GROUND));
  });
  it("normalizeCanvas derives dark from the ground, never from a stale flag", () => {
    assert.equal(normalizeCanvas({ composition: "TYPE-FULL" }, 0).dark, false);
    assert.equal(normalizeCanvas({ composition: "TYPE-FULL", dark: true }, 0).dark, false, "the retired c.dark flag alone must not draw light ink on white");
    const n = normalizeCanvas({ composition: "TYPE-FULL", ground_color: "#10141C" }, 0);
    assert.equal(n.dark, true);
    assert.equal(n.ground_color, "#10141C");
  });
  it("the manifest records the declared ground and keeps `ground` meaning white|photo", () => {
    const base = { visual_type: "TYPE", headline: "Rates stay high", composition: "TYPE-FULL", motion_tier: "medium" };
    const plain = canvasManifest(base, 0);
    assert.equal(plain.ground, "white");
    assert.equal(plain.ground_color, null);
    assert.equal(plain.dark, false);
    const dark = canvasManifest({ ...base, ground_color: "#10141C" }, 0);
    assert.equal(dark.ground, "white");
    assert.equal(dark.ground_color, "#10141C");
    assert.equal(dark.dark, true);
  });
  it("a declared ground gets no white-only paper/gradient variation; the default keeps it", () => {
    assert.ok(backgroundOf(2, "TYPE-FULL").paper);
    assert.deepEqual(backgroundOf(2, "TYPE-FULL", true), { paper: false, rule: false, gradient: false });
  });
  it("normalizeGrounds writes white or a hex back onto the beats and counts them", () => {
    const beats = [{ ground: "deep navy" }, {}, { ground: "transparent" }, { ground: "zzz" }];
    const counts = normalizeGrounds(beats);
    assert.deepEqual(beats.map((b) => b.ground), ["#0F1B33", "white", "white", "white"]);
    assert.deepEqual(counts, { "#0F1B33": 1, white: 3 });
  });
});

describe("1.2 hook and close: no forced TYPE", () => {
  it("plan-caps no longer forces the hook to TYPOGRAPHY when told not to", () => {
    const mech = ["CAPABILITY:evidence", "CAPABILITY:growth", "CAPABILITY:revelation", "CAPABILITY:contrast", "CAPABILITY:causation"];
    const r = caps.enforceCaps(mech, { hookTypography: false, minTypography: 0 });
    assert.equal(r.mechanisms[0], "CAPABILITY:evidence");
    assert.equal(r.changes.length, 0);
  });
  it("the legacy default is unchanged: the hook is TYPOGRAPHY", () => {
    const r = caps.enforceCaps(["CAPABILITY:a", "CAPABILITY:b", "CAPABILITY:c", "CAPABILITY:d", "CAPABILITY:e"]);
    assert.equal(r.mechanisms[0], "TYPOGRAPHY");
  });
  it("the ceiling of two TYPOGRAPHY beats still holds", () => {
    const mech = ["TYPOGRAPHY", "TYPOGRAPHY", "TYPOGRAPHY", "CAPABILITY:a", "CAPABILITY:b", "CAPABILITY:c", "CAPABILITY:d", "CAPABILITY:e"];
    const r = caps.enforceCaps(mech, { hookTypography: false, minTypography: 0 });
    assert.ok(r.mechanisms.filter((m) => m === "TYPOGRAPHY").length <= 2);
  });
  const sentence = "Jerome Powell said rates will stay high.";
  const ents = [{ type: "person", name: "Jerome Powell" }];
  it("a planner-named type is tried first", () => {
    const c = translateScene({ sentence, scene: "A headline fills the frame.", entities: ents, headline: "Rates stay high", preferTypes: ["PHOTO"] });
    assert.equal(c[0].visual_type, "PHOTO");
    assert.equal(c[0].data.entity, "Jerome Powell");
  });
  it("without a named type the description decides, as before", () => {
    const a = translateScene({ sentence, scene: "A headline fills the frame.", entities: ents, headline: "Rates stay high" });
    assert.notEqual(a[0].visual_type, undefined);
    const b = translateScene({ sentence, scene: "A headline fills the frame.", entities: ents, headline: "Rates stay high", preferTypes: [] });
    assert.deepEqual(a.map((x) => x.visual_type), b.map((x) => x.visual_type));
  });
  it("naming TYPE puts TYPE first, on the hook as on any beat", () => {
    const c = translateScene({ sentence, scene: "A portrait of Powell.", entities: ents, preferTypes: ["TYPE"] });
    assert.equal(c[0].visual_type, "TYPE");
  });
});

describe("1.3 motion tiers: the planner's own count", () => {
  const mk = (tiers) => tiers.map((t) => ({ motion_tier: t }));
  it("keeps any number of majors, zero excepted", () => {
    for (const tiers of [["major", "medium", "medium", "medium", "medium"], ["major", "major", "major", "major", "major"], ["micro", "major", "micro", "micro", "micro", "micro"]]) {
      const beats = mk(tiers);
      const r = applyMotionTiers(beats);
      assert.deepEqual(beats.map((b) => b.motion_tier), tiers);
      assert.equal(r.defaulted, false);
    }
  });
  it("when the planner marked none, the old 2-3 rule applies so the render still has emphasis", () => {
    const beats = mk(["medium", "medium", "medium", "medium", "medium", "medium"]);
    const r = applyMotionTiers(beats);
    assert.equal(r.defaulted, true);
    assert.deepEqual(r.majors, [0, 5]);
  });
  it("a missing or invalid tier becomes medium", () => {
    const beats = [{}, { motion_tier: "huge" }, { motion_tier: "major" }];
    applyMotionTiers(beats);
    assert.deepEqual(beats.map((b) => b.motion_tier), ["medium", "medium", "major"]);
  });
});

describe("1.4 composition: open vocabulary", () => {
  it("every composition the renderer draws is known", () => {
    assert.equal(COMPOSITIONS.length, 14);
    for (const c of COMPOSITIONS) assert.deepEqual(nearestComposition(c), { composition: c, exact: true, via: "exact" });
  });
  it("an unknown composition is logged as unknown and mapped to the nearest, not failed", () => {
    const w = wantedTypes({ canvas_composition: "big number" });
    assert.equal(w.composition, "NUMBER-FULL");
    assert.deepEqual(w.types, ["COUNTER"]);
    assert.equal(w.unknown[0].mappedTo, "NUMBER-FULL");
    assert.equal(wantedTypes({ canvas_composition: "TYPE-FULLL" }).composition, "TYPE-FULL");
    assert.equal(wantedTypes({ canvas_composition: "FULL-BLEED-MAP" }).composition, "MAP-CENTERED");
  });
  it("a name with nothing near is ignored and reported", () => {
    const w = wantedTypes({ canvas_composition: "xylophone orchestra" });
    assert.equal(w.declared, false);
    assert.equal(w.unknown[0].mappedTo, null);
  });
  it("nothing named = not declared; the caller's default applies", () => {
    assert.equal(wantedTypes({}).declared, false);
    assert.deepEqual(wantedTypes({ visual_type: "MAP" }).types, ["MAP"]);
  });
  it("compositionsUsed counts, and flags one composition over 60% without correcting it", () => {
    const r = compositionsUsed(["TYPE-FULL", "TYPE-FULL", "TYPE-FULL", "TYPE-FULL", "TYPE-FULL", "TYPE-FULL", "TYPE-FULL", "MAP-CENTERED", "TIMELINE", "LIST-BUILD"]);
    assert.equal(r.top, "TYPE-FULL");
    assert.equal(r.templated, true);
    assert.equal(compositionsUsed(["TYPE-FULL", "NUMBER-FULL", "TIMELINE", "TYPE-FULL"]).templated, false);
  });
});

describe("the four mandates are out of the planner prompt", () => {
  const { staticPart } = buildPlanPromptParts([{ start: 0, end: 3, text: "One." }, { start: 3, end: 6, text: "Two." }], null, "5");
  it("the ground is not mandated white; the planner is asked what ground each beat needs", () => {
    assert.doesNotMatch(staticPart, /GROUND IS ALWAYS WHITE/);
    assert.match(staticPart, /what ground does THIS beat need/);
  });
  it("beat 0 and the last beat are not forced to TYPE", () => {
    assert.doesNotMatch(staticPart, /"TYPE" only for beat 0/);
    assert.match(staticPart, /your choice for every beat/);
  });
  it("the major count is not fixed", () => {
    assert.doesNotMatch(staticPart, /EXACTLY 2-3/);
  });
  it("the composition vocabulary is offered, and an unknown name is allowed", () => {
    for (const c of COMPOSITIONS) assert.ok(staticPart.includes(c), c);
    assert.match(staticPart, /mapped to the nearest one/);
    assert.doesNotMatch(staticPart, /Do NOT choose a mechanism, a chart type, a composition or a zone/);
  });
});
