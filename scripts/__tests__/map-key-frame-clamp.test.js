// THE MAP KEY MUST STAY INSIDE THE FRAME AFTER THE MAP GROWS.
//
// Board 38369941305 ch-26 beat 0 rendered the key as:
//
//   "s federal court, $91 million"
//
// with "Texa" cut off. The key's label is "Texas federal court, $91 million",
// from the rendered manifest's own canvas.data.labels.
//
// This is the SECOND wrong diagnosis of this bug, and the frame is what settled
// it. The first (0472a56b) assumed the text overflowed its plate and fixed the
// width measurement - the key was still clipped. The second assumed
// bounds.x + 22 put the plate off-frame; bounds.x is 0 on this map
// (manifest: boxes.map = { x: 0, y: 640, w: 1080, h: 470 }), so that clamp would
// have been a no-op.
//
// The real cause: MapCentered wraps the map svg in a scale of up to 1.08 about
// the map's CENTRE (full-canvas.jsx), so a point x lands at cx + (x - cx) * s.
// With cx = 540 and s = 1.08, a key at x = 32 lands at -8.6 — off the frame.
// The plate was never off-frame before the transform; it was moved off-frame by
// the transform.
//
// So the test is not "is the plate inside bounds" — it is "does the plate land
// inside the frame AFTER the scale".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../../src/skills/remotion-render/visual/primitives/map.jsx", import.meta.url), "utf8");

// ch-26 beat 0's real geometry, read from the rendered manifest.
const BOUNDS = { x: 0, y: 640, w: 1080, h: 470 };
const KEY = "Texas federal court, $91 million";
const FRAME_W = 1080, L_EDGE = 48, R_EDGE = 1032;
const GROW_MAX = 1.08;

// The placement as the fix computes it, mirrored from map.jsx.
function keyLeftUnder(boxW, growScale) {
  const cx = BOUNDS.x + BOUNDS.w / 2;
  const s = growScale > 1 ? growScale : 1;
  const leftLimit = cx + (L_EDGE - cx) / s;
  const rightLimit = cx + (R_EDGE - cx) / s;
  return Math.max(leftLimit, Math.min(BOUNDS.x + 22, rightLimit - boxW));
}
// Where that lands once MapCentered's scale is applied.
const afterScale = (x, s) => (BOUNDS.x + BOUNDS.w / 2) + (x - (BOUNDS.x + BOUNDS.w / 2)) * s;

test("the real key is measured, not truncated — the whole name is in the source", () => {
  assert.ok(SRC.includes("measure(name, size"), "the key must measure its name");
  assert.ok(SRC.includes("const name = String(t).trim()"), "the full label must be used, not a slice of it");
  assert.equal(KEY, "Texas federal court, $91 million");
});

test("at rest the key is inside the frame", () => {
  const x = keyLeftUnder(360, 1);
  assert.ok(x >= L_EDGE, `left edge ${x} is outside the safe area at rest`);
});

test("under the map's full grow scale the key is STILL inside the frame", () => {
  // The regression. Before the fix this landed at -8.6 px and lost "Texa".
  for (const boxW of [200, 360, 520, 760]) {
    const x = keyLeftUnder(boxW, GROW_MAX);
    const left = afterScale(x, GROW_MAX);
    assert.ok(left >= L_EDGE, `boxW ${boxW}: left edge lands at ${left.toFixed(1)} under scale ${GROW_MAX}`);
  }
});

test("the key's right edge is inside the frame under scale too", () => {
  for (const boxW of [200, 360, 520, 760]) {
    const x = keyLeftUnder(boxW, GROW_MAX);
    const right = afterScale(x + boxW, GROW_MAX);
    assert.ok(right <= R_EDGE, `boxW ${boxW}: right edge lands at ${right.toFixed(1)}, past ${R_EDGE}`);
  }
});

test("the old placement really did land off-frame — the diagnosis is pinned", () => {
  // If this ever stops being true the test above has stopped testing anything.
  const old = afterScale(BOUNDS.x + 22, GROW_MAX);
  assert.ok(old < 0, `expected the old x to land off-frame, but it lands at ${old.toFixed(1)} — revisit the fix`);
});

test("the fix clamps against the FRAME, not against bounds.x", () => {
  assert.ok(/cx \+ \(KEY_SAFE_L - cx\) \/ s/.test(SRC), "the left limit must be solved through the scale");
  assert.ok(/KEY_SAFE_R/.test(SRC), "the right limit must be solved through the scale too");
});

test("MapCentered passes the live scale in", () => {
  const fc = readFileSync(new URL("../../src/skills/remotion-render/visual/full-canvas.jsx", import.meta.url), "utf8");
  assert.ok(/growScale=\{1 \+ grow\(local, dur, fps, 0\.08\)\}/.test(fc), "CenteredMap is not told how far the map has grown");
});