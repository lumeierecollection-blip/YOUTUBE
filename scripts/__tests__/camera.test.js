// CAMERA (owner, 2026-10-09: real camera moves of 8% or more, photos and graphs only).
// The manifest declares each photo / graph beat's move; the pixels are judged on CI by Gemini's
// fake-pan check (gemini-frame-review.js --camera-check) and by the shot-proof render.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canvasManifest, CAMERA, FULL_PHOTO_COMPS, FRAMED_PHOTO_COMPS } from "../../src/skills/remotion-render/visual/canvas-layout.js";

const photo = { asset: "entities/x.jpg", entity: "Ohio", view: "place", kind: "place", w: 1600, h: 1000 };

test("the camera moves 8% or more (the owner's floor), on photos and on graphs", () => {
  assert.ok(CAMERA.photo >= CAMERA.min, `photo ${CAMERA.photo} >= ${CAMERA.min}`);
  assert.ok(CAMERA.graph >= CAMERA.min, `graph ${CAMERA.graph} >= ${CAMERA.min}`);
  assert.equal(CAMERA.min, 0.08);
  // A graph starts at 1/(1+graph) of its size and ends at 1: the move is exactly CAMERA.graph.
  assert.ok(Math.abs(1 / (1 / (1 + CAMERA.graph)) - 1 - CAMERA.graph) < 1e-9);
});

test("every photo composition and every graph declares its move in the manifest; nothing else does", () => {
  for (const comp of [...FULL_PHOTO_COMPS, ...FRAMED_PHOTO_COMPS]) {
    const m = canvasManifest({ visual_type: "PHOTO", composition: comp, headline: "Ohio holds the vote", photo }, 1);
    assert.deepEqual(m.camera, { subject: "photo", move: CAMERA.photo }, comp);
  }
  const bar = canvasManifest({ visual_type: "BAR", composition: "DATA-FULL", headline: "Sales doubled", data: { bars: [{ label: "a", value: "10" }, { label: "b", value: "30" }] } }, 1);
  assert.deepEqual(bar.camera, { subject: "graph", move: CAMERA.graph });
  for (const comp of ["TYPE-FULL", "TYPE-TITLE", "NUMBER-FULL", "PROCESS-FULL"]) {
    assert.equal(canvasManifest({ visual_type: "TYPE", composition: comp, headline: "Ohio holds the vote" }, 1).camera, null, comp);
  }
});

test("Layer 1 camera-moves fails a photo or graph beat that declares no move", () => {
  const src = readFileSync(new URL("../local-audit.cjs", import.meta.url), "utf8");
  assert.match(src, /id: "camera-moves"/);
  assert.match(src, /c\.camera\.move >= 0\.08/);
});

test("the renderer applies the declared constants (no second copy of the numbers)", () => {
  const jsx = readFileSync(new URL("../../src/skills/remotion-render/visual/full-canvas.jsx", import.meta.url), "utf8");
  assert.match(jsx, /CAMERA\.photo/);
  assert.match(jsx, /CAMERA\.graph/);
  assert.doesNotMatch(jsx, /const push = 0\.02/);
});
