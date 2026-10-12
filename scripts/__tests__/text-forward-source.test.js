// TEXT-FORWARD IS A PROPERTY OF THE FRAME, NOT OF THE MECHANISM NAME.
//
// Board 38226641642 measured the same question twice on the same videos, from
// the same manifest, and got answers 78 points apart:
//
//   ch-2   textFwd=22%   (counted from b.mechanism)
//          typography: 9/9 text beats (100%)   (counted from on_screen_text)
//   ch-6   textFwd=22%   (counted from b.mechanism)
//          typography: 7/9 text beats (78%)    (counted from on_screen_text)
//
// The mechanism count only recognises TYPOGRAPHY and EVIDENCE_FIGURE. This
// render path declares nearly every beat CAPABILITY while painting a headline
// box on it, so the measure the monoculture gate ran on said 22% and never
// fired, while the typography audit kept reporting the same frames at 100%.
// `distinct` and `maxRun` were moved off the mechanism name in 128bb604; this
// is the last count in the file still reading the label.
//
// The fixture is ch-9 run 38102260955's manifest: five CAPABILITY beats and two
// TYPOGRAPHY, all seven drawing a headline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { auditPlanCompliance } from "../local-visual-auditor.js";
import { sceneTextInventory } from "../../src/skills/remotion-render/visual/scene-text.js";
import { canvasManifest } from "../../src/skills/remotion-render/visual/canvas-layout.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "ch9-canvas-text");
const real = JSON.parse(readFileSync(join(FIX, "manifest.json"), "utf8"));
// The RAW canvases render.js received. The manifest above was captured before
// canvasManifest recorded a box's drawn `lines`, so its flattened boxes carry
// geometry only — reading the text back out of them would prove nothing. This
// walks the real path instead: raw canvas -> canvasManifest -> inventory, the
// exact chain render.js runs before auditPlanCompliance sees the beat.
const { canvases } = JSON.parse(readFileSync(join(FIX, "resolved-canvases.json"), "utf8"));

const withText = {
  beats: real.beats.map((b, i) => {
    const on_screen_text = sceneTextInventory(b.mechanism, { objects: [] }, Array.isArray(b.text) ? b.text[0] : b.text, canvasManifest(canvases[i], i));
    return {
      mechanism: b.mechanism,
      on_screen_text,
      narrative_text: on_screen_text.filter((t) => t.role === "narrative").map((t) => t.text),
      canvas: { composition: b.canvas?.composition || null },
    };
  }),
};
const plan = { beats: real.beats.map((b, i) => ({ index: i, capabilities: [] })) };
const noTextField = (m) => ({
  beats: m.beats.map((b) => ({ mechanism: b.mechanism, canvas: { composition: b.canvas?.composition || null } })),
});

test("the fixture reproduces the split: CAPABILITY beats that draw headlines", () => {
  const drawn = withText.beats.filter((b) => b.on_screen_text.length > 0);
  assert.equal(drawn.length, real.beats.length, "every beat of this run draws a headline");
  assert.ok(
    drawn.some((b) => b.mechanism === "CAPABILITY"),
    "fixture needs CAPABILITY beats, the mechanism the old measure could not see",
  );
});

test("text-forward is counted from the drawn text, and the source is reported", () => {
  const r = auditPlanCompliance(plan, withText);
  assert.equal(r.textForwardSource, "drawn");
  assert.equal(r.textForwardPct, 100, `expected 100% text-forward, got ${r.textForwardPct}%`);
});

test("the measure agrees with the typography audit on the same manifest", () => {
  // The whole point: one question, one answer. auditTypography counts a text
  // beat by its narrative strings; auditPlanCompliance must not disagree.
  const r = auditPlanCompliance(plan, withText);
  const byTypography = withText.beats.filter((b) => b.narrative_text.length > 0).length;
  const byPlanCompliance = Math.round((r.textForwardPct / 100) * real.beats.length);
  assert.equal(byPlanCompliance, byTypography);
});

test("a manifest with no text inventory falls back to the mechanism name", () => {
  // An old manifest must degrade to the old measure, never to "nothing is
  // text-forward" — that would silently clear the gate on missing data.
  const r = auditPlanCompliance(plan, noTextField(real));
  assert.equal(r.textForwardSource, "mechanism");
  assert.equal(r.textForwardPct, Math.round((2 / real.beats.length) * 100));
});