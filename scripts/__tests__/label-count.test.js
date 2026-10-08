// The label counter measures what RENDERS (owner, 2026-10-09). The fixture is a real render:
// CI run 37837731824 (board) ch-26 — its manifest, the canvases render.js received, and the top
// 620 px of each beat's rendered frame. The run's own log and manifest said 0 labels; the frames
// draw top-of-frame text on 7 of 9 beats (0, 2, 3, 4, 5, 6, 8 — beats 1 and 7 show only the
// hairline rule). The count is checked against the PIXELS, beat by beat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePNG, sampleAt } from "../../src/skills/remotion-render/decode-png.js";
import { canvasManifest } from "../../src/skills/remotion-render/visual/canvas-layout.js";
import { devicesOf, labelCount, templateCheck } from "../template-check.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "label-count");
const manifest = JSON.parse(readFileSync(join(FIX, "manifest.json"), "utf8"));
const { canvases } = JSON.parse(readFileSync(join(FIX, "resolved-canvases.json"), "utf8"));

// Text is drawn in the top band of a frame when >= 4 pixel rows (quarter scale, ~16 layout px)
// carry ink against the frame's own ground. The hairline rule is 1-2 rows and is not text.
function textDrawnAtTop(png) {
  const ground = sampleAt(png, 2, 2);
  let rows = 0;
  for (let y = 0; y < png.height; y++) {
    let ink = 0;
    for (let x = 0; x < png.width; x++) {
      const p = sampleAt(png, x, y);
      if (Math.abs(p[0] - ground[0]) + Math.abs(p[1] - ground[1]) + Math.abs(p[2] - ground[2]) > 150) ink++;
    }
    if (ink >= 2) rows++;
  }
  return rows >= 4;
}
const drawn = manifest.beats.map((b, i) => textDrawnAtTop(decodePNG(join(FIX, `beat${i}-top.png`))));

test("the pixels: 7 of 9 rendered frames draw text at the top (beats 1 and 7: the rule only)", () => {
  assert.deepEqual(drawn, [true, false, true, true, true, true, true, false, true]);
});

test("the label counter on the rendered manifest matches what is drawn, beat by beat", () => {
  manifest.beats.forEach((b, i) => assert.equal(devicesOf(b).label, drawn[i], `beat ${i}: counter ${devicesOf(b).label}, frame ${drawn[i]}`));
  assert.equal(labelCount(manifest), drawn.filter(Boolean).length);
  assert.equal(labelCount(manifest), 7);
});

test("canvasManifest records a drawn top-of-frame text as the label, whatever the layout calls it", () => {
  const rebuilt = { beats: canvases.map((c, i) => ({ canvas: canvasManifest(c, i) })) };
  rebuilt.beats.forEach((b, i) => assert.equal(!!b.canvas.chrome.label, drawn[i], `beat ${i}: chrome.label ${JSON.stringify(b.canvas.chrome.label)}, frame ${drawn[i]}`));
  assert.equal(labelCount(rebuilt), 7);
});

test("measured that way, this video fails the template window (beats 2-6: a label five beats running)", () => {
  const r = templateCheck(manifest);
  assert.equal(r.pass, false);
  assert.ok(r.windows.some((w) => w.run.includes("label")));
});
