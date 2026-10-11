// THE TEXT INVENTORY MUST READ THE CANVAS, NOT THE MECHANISM TABLE.
//
// Fixture is a real render: CI run 38102260955, ch-9 (borderlines),
// supreme-court-india-sri-lanka-katchatheevu-challenge-shorts. Its manifest
// reported `draws_text: false` and `on_screen_text: []` on 5 of its 7 beats,
// because every one of those beats was CAPABILITY and CAPABILITY is not a key
// in scene-text.js's TEXT_SURFACES — which describes the legacy per-mechanism
// SVG scenes, not the full-canvas layout this render path uses.
//
// The frames from that run show a 104px headline on ALL SEVEN beats, and the
// manifest's own `canvas.headline_text` names every one of them. So the strings
// were available the whole time; the inventory was reading the wrong source,
// and every check downstream of `on_screen_text` / `narrative_text` (engine
// vocabulary, phrase length, figure slots, headline-likeness, text-beat share)
// was blind to the majority of the video's text. That is the recurring failure
// in this repo — a measurement standing in for the artifact — so it is pinned
// here against the run that exposed it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { canvasManifest } from "../../src/skills/remotion-render/visual/canvas-layout.js";
import { sceneTextInventory } from "../../src/skills/remotion-render/visual/scene-text.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "ch9-canvas-text");
const manifest = JSON.parse(readFileSync(join(FIX, "manifest.json"), "utf8"));
// The RAW canvases render.js was handed, not the flattened records it wrote
// back out — the same split label-count.test.js keeps, for the same reason:
// the inventory is fed canvasManifest()'s output, so the input has to be what
// the renderer actually resolved.
const { canvases } = JSON.parse(readFileSync(join(FIX, "resolved-canvases.json"), "utf8"));

// The headline read off the rendered frames of that run, one per beat, in
// order. Every one of these is visible ink in the video.
const FRAME_HEADLINES = [
  "Reclaiming a ceded island",
  "Supreme Court reviews challenge",
  "Could this deal be overturned?",
  "Government rules out reopening pacts",
  "Modi criticizes Congress party",
  "Petitioner replaced in Court case",
  "Weighing fishermen's sensitization",
];

test("every beat that paints a headline reports it, whatever its mechanism", () => {
  const reported = manifest.beats.map((b, i) => {
    const canvas = canvasManifest(canvases[i], i);
    return sceneTextInventory(b.mechanism, { objects: [] }, b.text, canvas);
  });

  for (const [i, list] of reported.entries()) {
    assert.ok(
      list.some((t) => t.text === FRAME_HEADLINES[i]),
      `beat ${i} (${manifest.beats[i].mechanism}) did not report the headline its frame draws: "${FRAME_HEADLINES[i]}"; got ${JSON.stringify(list)}`,
    );
    assert.ok(list.length > 0, `beat ${i} reported no on-screen text at all`);
  }
});

test("the headline is reported as narrative, so the phrase contract applies to it", () => {
  // Role is what routes the string to the right rule. A headline must be
  // "narrative" (it owes the one-line phrase budget), not "quiet" — a quiet
  // role would exempt exactly the largest text in the video from the checks.
  const canvas = canvasManifest(canvases[0], 0);
  const list = sceneTextInventory(manifest.beats[0].mechanism, { objects: [] }, manifest.beats[0].text, canvas);
  const headline = list.find((t) => t.text === FRAME_HEADLINES[0]);
  assert.equal(headline.role, "narrative");
});

test("the canvas manifest carries the drawn lines, not just the box geometry", () => {
  // sceneTextInventory can only report what the manifest records. If `lines`
  // is dropped here again, the inventory silently returns [] for every beat and
  // every assertion above fails at once — which is the point of pinning it.
  const canvas = canvasManifest(canvases[2], 2);
  const withText = Object.values(canvas.boxes).filter((b) => b && b.lines && b.lines.length);
  assert.ok(withText.length > 0, "canvas boxes recorded no drawn lines");
});

test("the monoculture check would see five compositions, not two labels", () => {
  // The monoculture check counts composition, not the mechanism label: all 7
  // beats of this run are CAPABILITY or TYPOGRAPHY, which reads as "2 distinct
  // mechanisms" for a video drawn as 5 visibly different frames. The key also
  // carries the capability, which is what lifts the count to 6 — MAP-CENTERED
  // appears twice (beats 0 and 5) but as different capabilities.
  const comps = manifest.beats.map((b) => b.canvas.composition);
  assert.equal(new Set(comps).size, 5, `expected 5 distinct compositions, got ${JSON.stringify(comps)}`);
  assert.equal(new Set(manifest.beats.map((b) => b.mechanism)).size, 2, "fixture no longer reproduces the 2-label collapse");

  // And the run-length that triggered `maxRun > 3` was the run of CAPABILITY
  // labels (beats 3,4,5). Under the composition key those three are three
  // different frames, so the run that failed the gate is gone.
  const keys = manifest.beats.map((b, i) => `${b.mechanism}:${b.canvas.composition}:${(manifest.beats[i].capabilities || []).join("+")}`);
  let maxRun = 1, run = 1;
  for (let i = 1; i < keys.length; i++) { if (keys[i] === keys[i - 1]) { run++; maxRun = Math.max(maxRun, run); } else run = 1; }
  assert.ok(maxRun <= 3, `expected no run of identical frames longer than 3, got ${maxRun}`);
});