// The reference shot grammar (docs/REFERENCE-SHOT-GRAMMAR.md) as compositions the renderer draws.
// Boxes only: the frames themselves are rendered and audited on CI (.github/workflows/layout-proof.yml
// render-shots: Layer 1 on the pixels of scripts/fixtures/shot-proof/beats.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canvasLayout, canvasManifest, layoutViolations, normalizeCanvas, shotComposition, shotName,
  SHOTS, SHOT_COMPOSITIONS, FRAMED_PHOTO_COMPS, TEXT_AT,
} from "../../src/skills/remotion-render/visual/canvas-layout.js";
import { popGroups } from "../../src/skills/remotion-render/visual/pop-groups.js";
import { labelsDrawn } from "../template-check.js";
import { applyShot } from "../render-and-qa.js";

const photo = (view, w, h) => ({ asset: "entities/x.jpg", entity: "Jessica Chastain", view, kind: view, w, h });
const PHOTOS = [["person", 800, 1000, "PORTRAIT", "PHOTO"], ["place", 1600, 1000, "SCENE-FULL", "PHOTO"], ["document", 900, 1200, "DOCUMENT", "DOCUMENT"]];
const CUT = { name: "gold-bar", class: "cutout", asset: "cutouts-live/1/0-gold-bar.png", w: 800, h: 520 };
const CUT2 = { name: "piggy-bank", class: "cutout", asset: "cutouts-live/1/2-piggy-bank.png", w: 600, h: 600 };
const SYMBOL = { name: "warning-triangle", class: "symbol", w: 1, h: 1 };
const HEADS = ["Gold", "Chastain signs a three film deal", "A much longer headline that wraps onto three full lines of serif type"];
const laid = (c, shot, base) => {
  const sc = shotComposition(base, shot, c);
  return { sc, L: canvasLayout(normalizeCanvas({ ...c, composition: sc.composition }, 0)) };
};

test("every photo shot, on every photo kind, both sides, any headline, with or without a label: legal by Layer 1's own box rules", () => {
  for (const [view, w, h, base, vt] of PHOTOS) for (const shot of ["PHOTO-BAND", "PHOTO-EDGE", "PHOTO-CARD", "PHOTO-INSET", "PHOTO-STRIP", "SCENE-LOW", "SCENE-FULL", "PORTRAIT"])
    for (const variant of [0, 1]) for (const headline of HEADS) for (const lead_in of [null, "October 8"]) {
      const { sc, L } = laid({ visual_type: vt, headline, photo: photo(view, w, h), variant, lead_in }, shot, base);
      assert.equal(sc.used, true, `${view} ${shot}`);
      assert.deepEqual(layoutViolations(L), [], `${view} ${shot} v${variant} "${headline}" label=${lead_in}`);
    }
});

test("every object shot with a cutout, two cutouts or a drawn symbol: legal", () => {
  for (const cv of [[CUT], [CUT, CUT2], [SYMBOL]]) for (const shot of ["HERO-STACK", "HERO-LOW", "HERO-SCATTER", "HERO-OVER"]) for (const variant of [0, 1]) for (const headline of HEADS) {
    const { sc, L } = laid({ visual_type: "TYPE", headline, concept_visuals: cv, variant }, shot, "TYPE-FULL");
    assert.equal(sc.used, true);
    assert.deepEqual(layoutViolations(L), [], `${cv.map((v) => v.name)} ${shot} v${variant} "${headline}"`);
    assert.ok(L.boxes.cutout0, `${shot}: the object is drawn`);
  }
});

test("the shots are distinct compositions: a video of photo beats no longer repeats one frame", () => {
  const c = { visual_type: "PHOTO", headline: "Chastain signs", photo: photo("place", 1600, 1000) };
  const comps = ["PHOTO-BAND", "PHOTO-EDGE", "PHOTO-CARD", "PHOTO-INSET", "PHOTO-STRIP", "SCENE-LOW", "SCENE-FULL", "PORTRAIT"].map((s) => shotComposition("SCENE-FULL", s, c).composition);
  assert.equal(new Set(comps).size, comps.length);
  // Distinct by geometry, not just by name: the photo box differs on every one.
  const boxes = comps.map((comp) => JSON.stringify(canvasLayout(normalizeCanvas({ ...c, composition: comp }, 0)).boxes.photo || canvasLayout(normalizeCanvas({ ...c, composition: comp }, 0)).boxes.portrait));
  assert.equal(new Set(boxes).size, boxes.length);
});

test("a shot frames only its content: no photo shot on a chart, no object shot without an object", () => {
  assert.equal(shotComposition("DATA-FULL", "PHOTO-CARD", { visual_type: "BAR" }).used, false);
  assert.equal(shotComposition("TYPE-FULL", "HERO-LOW", { visual_type: "TYPE" }).used, false);
  assert.equal(shotComposition("MONEY", "PHOTO-STRIP", { visual_type: "MONEY", photo: photo("money", 1, 1) }).used, false);   // its figure is drawn over the photo
  assert.equal(shotComposition("NUMBER-FULL", "FIGURE", {}).composition, "NUMBER-FULL");
  assert.equal(shotName("photo card"), "PHOTO-CARD");
  assert.equal(shotName("xylophone"), null);
  for (const s of SHOTS) assert.ok(shotName(s));
});

test("applyShot draws the planner's shot, and only falls back on a Layer 1 rule — never to another shot", () => {
  const log = [];
  const c1 = { visual_type: "PHOTO", headline: "Chastain signs", photo: photo("place", 1600, 1000), composition: "SCENE-FULL" };
  assert.equal(applyShot(c1, { index: 3, shot: "PHOTO-INSET" }, (m) => log.push(m)).drawn, true);
  assert.equal(c1.composition, "PHOTO-INSET");
  // A wide logo cannot fill the top band of HERO-OVER (span under 60%): its own frame is drawn, and the reason is logged.
  const logo = { name: "Blumhouse", class: "cutout", asset: "l.png", w: 900, h: 300, logo: true };
  const c2 = { visual_type: "TYPE", headline: "Blumhouse wins", concept_visuals: [logo], composition: "TYPE-FULL" };
  assert.equal(applyShot(c2, { index: 4, shot: "HERO-OVER" }, (m) => log.push(m)).drawn, false);
  assert.equal(c2.composition, "TYPE-FULL");
  assert.match(log.at(-1), /HERO-OVER NOT drawn — span/);
  // Re-applied once the object is known (attachConceptVisuals), the same canvas takes its HERO shot.
  const c3 = { visual_type: "TYPE", headline: "Gold hits a record", composition: "TYPE-FULL" };
  applyShot(c3, { index: 5, shot: "HERO-SCATTER" }, () => {});
  assert.equal(c3.composition, "TYPE-FULL");
  c3.concept_visuals = [CUT];
  applyShot(c3, { index: 5, shot: "HERO-SCATTER" }, () => {});
  assert.equal(c3.composition, "HERO-SCATTER");
});

test("where the words sit (TEXT_AT, told to the planner) is what the template rule measures (labelsDrawn)", () => {
  for (const headline of HEADS) {
    for (const shot of ["PHOTO-BAND", "PHOTO-EDGE", "PHOTO-CARD", "PHOTO-INSET", "PHOTO-STRIP", "SCENE-LOW", "SCENE-FULL", "PORTRAIT"]) for (const lead_in of [null, "Reuters"]) {
      const c = { visual_type: "PHOTO", headline, photo: photo("place", 1600, 1000), lead_in };
      const m = canvasManifest({ ...c, composition: shotComposition("SCENE-FULL", shot, c).composition }, 0);
      // A label on a [top] shot is top text anyway; on a [low] shot it rides with the words.
      assert.equal(labelsDrawn(m).length ? "top" : "low", TEXT_AT[shot], `${shot} "${headline}" label=${lead_in}`);
    }
    for (const shot of ["HERO-STACK", "HERO-LOW", "HERO-SCATTER", "HERO-OVER"]) {
      const c = { visual_type: "TYPE", headline, concept_visuals: [CUT] };
      const m = canvasManifest({ ...c, composition: shotComposition("TYPE-FULL", shot, c).composition }, 0);
      assert.equal(labelsDrawn(m).length ? "top" : "low", TEXT_AT[shot], `${shot} "${headline}"`);
    }
  }
});

test("a framed photo leaves the ground showing, so canvas-ground and the pixel zone checks still run on it", () => {
  const c = { visual_type: "PHOTO", headline: "Chastain signs", photo: photo("place", 1600, 1000) };
  for (const comp of FRAMED_PHOTO_COMPS) assert.equal(canvasManifest({ ...c, composition: comp }, 0).ground, "white", comp);
  assert.equal(canvasManifest({ ...c, composition: "SCENE-LOW" }, 0).ground, "photo");
  assert.equal(canvasManifest({ ...c, composition: "SCENE-LOW", shot: "SCENE-LOW" }, 0).shot, "SCENE-LOW");
});

test("a framed photo pops with the band it sits in (it is never left out of every group)", () => {
  const c = normalizeCanvas({ visual_type: "PHOTO", headline: "Chastain signs", photo: photo("place", 1600, 1000) }, 0);
  for (const comp of FRAMED_PHOTO_COMPS) {
    const L = canvasLayout({ ...c, composition: comp });
    const groups = popGroups({ ...c, composition: comp }, L);
    const pb = L.boxes.photo, cy = pb.y + pb.h / 2;
    const band = cy < 620 ? "top" : "middle";
    assert.ok(groups.some((g) => g.key === band), `${comp}: a ${band} group draws the photo`);
    assert.ok(!groups.some((g) => g.key === "photo"), `${comp}: not a full-bleed photo group`);
  }
  assert.ok(SHOT_COMPOSITIONS.length >= 9);
});

test("the planner prompt offers every shot, per beat, with where its words sit — and no longer forbids the reference's cards", async () => {
  const { buildPlanPromptParts } = await import("../gemini-visual-plan.js");
  const { staticPart } = buildPlanPromptParts([{ start: 0, end: 2, text: "Gold hit a record." }], null, "26");
  for (const s of SHOTS) assert.ok(staticPart.includes(`"${s}"`), `the prompt names ${s}`);
  assert.match(staticPart, /"shot": how THIS beat's frame is divided/);
  assert.match(staticPart, /never the same shot on two beats in a row/);
  assert.match(staticPart, /never the words in the TOP band on three beats in a row/);
  assert.doesNotMatch(staticPart, /no cards or panels/);
  assert.doesNotMatch(staticPart, /Vox, Bloomberg and NYT/);
});

// ── Render-time choice (render-and-qa.js chooseShots): Gemini picks from what each RESOLVED beat can
// draw; code measures and checks. Board 37859862716: the plan-time sequence was "legal" and four
// channels still lost to template-window, because resolution changed the beats under it.
import { shotMenu, chooseShots, shotSequenceProblems } from "../render-and-qa.js";

const PLACE = { asset: "entities/places/x.jpg", entity: "Strait of Hormuz", kind: "place", view: "place", w: 1600, h: 1000 };
const mk = (index, narration, c) => ({ index, narration, canvas: { visual_type: "TYPE", headline: narration.split(" ").slice(0, 4).join(" "), sentence: narration, ...c } });
const resolvedPlan = () => ({ beats: [
  mk(0, "Iran threatened the strait on Monday.", { visual_type: "MAP", composition: "MAP-CENTERED", data: { place: "Iran" } }),
  mk(1, "Tankers crossed the Strait of Hormuz.", { visual_type: "PHOTO", composition: "SCENE-FULL", photo: PLACE, headline: "Tankers crossed the strait" }),
  mk(2, "The risk is rising for every shipper.", { composition: "TYPE-FULL" }),
  mk(3, "Ships slowed in the Gulf.", { visual_type: "MAP", composition: "MAP-CENTERED", data: { place: "Qatar" } }),
  mk(4, "Insurers answered quickly.", { composition: "TYPE-FULL" }),
] });

test("a resolved beat's menu: only what it can draw, its own frame always, a symbol only when the sentence states one", () => {
  const p = resolvedPlan();
  const ids = (i) => shotMenu(p.beats[i].canvas, p.beats[i]).map((o) => o.shot);
  assert.ok(ids(0).includes("FIGURE")); assert.ok(ids(2).length >= 2);
  assert.ok(!ids(0).some((s) => s.startsWith("PHOTO-")), "no photo shot on a map");
  assert.ok(["PHOTO-CARD", "PHOTO-STRIP", "SCENE-LOW", "PHOTO-BAND"].every((s) => ids(1).includes(s)));
  assert.ok(!ids(2).includes("FIGURE"), "FIGURE frames a figure, not words");
  assert.ok(ids(2).includes("STATEMENT"));
  assert.ok(ids(2).includes("HERO-LOW:warning-triangle"), "'risk' is stated: its symbol is offered");
  assert.ok(!ids(4).some((s) => s.includes(":")), "no symbol the sentence does not state");
});

test("chooseShots: an illegal resolved sequence goes to Gemini; a legal answer is drawn as given", async () => {
  const p = resolvedPlan();
  // As resolved: MAP[top], photo SCENE-FULL[top], plain statement..., MAP[top]...
  p.beats[1].canvas.shot = "PHOTO-CARD"; p.beats[1].canvas.shot_drawn = false;   // a planned shot that did not fit
  const prompts = [];
  const answer = { beats: [{ index: 0, shot: "FIGURE" }, { index: 1, shot: "SCENE-LOW" }, { index: 2, shot: "HERO-LOW:warning-triangle" }, { index: 3, shot: "FIGURE" }, { index: 4, shot: "STATEMENT" }] };
  const r = await chooseShots(p, "t", async (prompt) => { prompts.push(prompt); return answer; });
  assert.equal(r.asked, 1);
  assert.deepEqual(r.problems, []);
  assert.equal(p.beats[1].canvas.composition, "SCENE-LOW");
  assert.equal(p.beats[2].canvas.composition, "HERO-LOW");
  assert.equal(p.beats[2].fallback_symbol, "warning-triangle");
  assert.match(prompts[0], /options: .*SCENE-LOW \[low\]/);
});

test("chooseShots: an answer that still breaks a rule goes back ONCE with the problems; no answer leaves the beats as resolved", async () => {
  const p = resolvedPlan();
  p.beats[1].canvas.shot = "PHOTO-CARD"; p.beats[1].canvas.shot_drawn = false;
  const bad = { beats: [{ index: 0, shot: "FIGURE" }, { index: 1, shot: "PHOTO-CARD" }, { index: 2, shot: "STATEMENT-SPLIT" }, { index: 3, shot: "FIGURE" }, { index: 4, shot: "STATEMENT" }] };
  const prompts = [];
  const r = await chooseShots(p, "t", async (prompt) => { prompts.push(prompt); return bad; });
  assert.equal(r.asked, 2);
  assert.match(prompts[1], /breaks: .*three beats in a row/);
  assert.ok(r.problems.length > 0, "the problem stays on record; the render's gates judge it");
  const q = resolvedPlan();
  q.beats[1].canvas.shot = "PHOTO-CARD"; q.beats[1].canvas.shot_drawn = false;
  const before = JSON.stringify(q.beats.map((b) => b.canvas.composition));
  await chooseShots(q, "t", async () => ({ error: "quota_exhausted" }));
  assert.equal(JSON.stringify(q.beats.map((b) => b.canvas.composition)), before);
});

test("chooseShots: a legal sequence whose planned shots all drew is not re-asked", async () => {
  const p = resolvedPlan();
  p.beats[1].canvas.composition = "SCENE-LOW";
  p.beats[2].canvas = { ...p.beats[2].canvas, concept_visuals: [{ name: "warning-triangle", class: "symbol", w: 1, h: 1 }], composition: "HERO-OVER" };
  let asked = 0;
  const r = await chooseShots(p, "t", async () => { asked++; return { beats: [] }; });
  assert.deepEqual(shotSequenceProblems(r.choice), []);
  assert.equal(asked, 0);
});

test("MAP-BAND: the map across the top band, its headline low — legal, and [low] by the template measure", () => {
  for (const variant of [0, 1]) for (const lead_in of [null, "Tuesday"]) {
    const c = normalizeCanvas({ visual_type: "MAP", composition: "MAP-CENTERED", data: { place: "Iran" }, headline: "Iran closes the strait", map_band: true, variant, lead_in }, 0);
    const L = canvasLayout(c);
    assert.deepEqual(layoutViolations(L), [], `v${variant} label=${lead_in}`);
    assert.equal(L.boxes.map.y, 0);
    assert.equal(labelsDrawn(canvasManifest(c, 0)).length, 0, "no words in the top band");
  }
});

test("chooseShots names each beat's current frame as its menu does (board 37862697531: undrawn planned names were echoed back and matched nothing)", async () => {
  const p = resolvedPlan();
  p.beats[1].canvas.shot = "PHOTO-CARD"; p.beats[1].canvas.shot_drawn = false;   // drawn as SCENE-FULL
  const prompts = [];
  await chooseShots(p, "t", async (prompt) => { prompts.push(prompt); return { error: "stub" }; });
  assert.match(prompts[0], /\[1\][^\n]*now: SCENE-FULL\[/);
  assert.match(prompts[0], /\[0\][^\n]*options: [^\n]*MAP-BAND \[low\]/);
});
