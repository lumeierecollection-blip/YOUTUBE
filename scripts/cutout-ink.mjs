// The ink outline of a cutout PNG: the pixels a frame actually shows of it
// (alpha >= 64), as extreme points in image fractions. canvas-layout.js sizes,
// centres and tilts the hero cutout from these, not from the PNG's rectangle:
// a PNG's transparent margin made a tilted banknote's ink stop 94 px above its
// box (local QA render, 2026-10-02), and the frame checks measure ink.
//
// Per column band: the topmost and bottommost ink pixel; per row band: the
// leftmost and rightmost. Rotating these points gives the ink's bounding box at
// any tilt to within one band.
import sharp from "sharp";

export async function inkOf(file, bins = 24) {
  let data, info;
  try { ({ data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })); } catch { return null; }
  const { width: W, height: H, channels: C } = info;
  const top = [], bot = [], left = [], right = [];
  for (let y = 0; y < H; y++) {
    const rb = Math.min(bins - 1, Math.floor((y * bins) / H));
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * C + 3] < 64) continue;   // soft edges count: at 128 a fringe ran 14 px past the safe area
      const cb = Math.min(bins - 1, Math.floor((x * bins) / W));
      if (!top[cb] || y < top[cb][1]) top[cb] = [x, y];
      if (!bot[cb] || y > bot[cb][1]) bot[cb] = [x, y];
      if (!left[rb] || x < left[rb][0]) left[rb] = [x, y];
      if (!right[rb] || x > right[rb][0]) right[rb] = [x, y];
    }
  }
  const raw = [...top, ...bot, ...left, ...right].filter(Boolean);
  if (!raw.length) return null;
  const f = (v, n) => Math.round((v / n) * 1000) / 1000;
  const pts = [...new Map(raw.map(([x, y]) => [`${x},${y}`, [f(x + 0.5, W), f(y + 0.5, H)]])).values()];
  return { pts };
}
