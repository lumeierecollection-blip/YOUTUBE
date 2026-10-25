/**
 * frame-motion — how far did the PICTURE move between two frames of one beat?
 *
 * Owner, 2026-10-09: photos and graphs move by 8% or more. Gemini's fake-pan check (gemini-frame-review.js
 * --camera-check) judges two frames by eye, and an eye (or a model) misses a 10% push on a dark photograph.
 * This measures it: the best similarity transform (uniform scale about the frame centre + a shift) taking
 * frame A to frame B, by grayscale error on a downsampled copy, and reports the error with and without it.
 * `moved` = the transform explains the change (error drops by at least `GAIN`) AND the scale is >= 1 + minMove
 * or the shift is >= minMove of the frame width.
 *
 *   node scripts/lib/frame-motion.mjs a.png b.png
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const W = 135, H = 240;
export const GAIN = 0.25;

async function load(file) {
  const { data } = await sharp(file).greyscale().resize(W, H, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  return data;
}
const sample = (img, x, y) => {
  if (x < 0 || y < 0 || x > W - 1 || y > H - 1) return null;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
  return (img[y0 * W + x0] * (1 - fx) + img[y0 * W + x1] * fx) * (1 - fy) + (img[y1 * W + x0] * (1 - fx) + img[y1 * W + x1] * fx) * fy;
};

/** { identity_mse, best_mse, scale, shift: [dx, dy] as fractions of the frame width/height } */
export async function estimateMotion(a, b, { minMove = 0.04 } = {}) {
  const A = await load(a), B = await load(b);
  const err = (s, tx, ty) => {
    let sse = 0, n = 0;
    for (let y = 10; y < H - 10; y += 2) for (let x = 6; x < W - 6; x += 2) {
      const v = sample(A, (x - W / 2 - tx) / s + W / 2, (y - H / 2 - ty) / s + H / 2);
      if (v == null) continue;
      sse += (v - B[y * W + x]) ** 2; n++;
    }
    return n > 500 ? sse / n : Infinity;
  };
  const identity = err(1, 0, 0);
  let best = { mse: identity, s: 1, tx: 0, ty: 0 };
  // Coarse (shift step 2), then refined by one step around the best.
  for (let s = 0.9; s <= 1.2001; s += 0.01) for (let tx = -14; tx <= 14; tx += 2) for (let ty = -14; ty <= 14; ty += 2) {
    const e = err(s, tx, ty);
    if (e < best.mse) best = { mse: e, s, tx, ty };
  }
  const c = { ...best };
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const e = err(c.s, c.tx + dx, c.ty + dy);
    if (e < best.mse) best = { mse: e, s: c.s, tx: c.tx + dx, ty: c.ty + dy };
  }
  const scale = Math.round(best.s * 1000) / 1000, shift = [Math.round((best.tx / W) * 1000) / 1000, Math.round((best.ty / H) * 1000) / 1000];
  const explained = identity > 0 && (identity - best.mse) / identity >= GAIN;
  const big = Math.abs(scale - 1) >= minMove || Math.abs(shift[0]) >= minMove || Math.abs(shift[1]) >= minMove;
  return { identity_mse: Math.round(identity), best_mse: Math.round(best.mse), scale, shift, moved: explained && big };
}

/**
 * A chart's own axis: the longest straight horizontal run of ink (against the ground, either polarity) in the
 * chart bands (y 120-1340) of a 540x960 copy of the frame, in pixels. A chart that grows about its floor widens its axis by
 * the same factor, while its line, dot and bars are still animating (which defeats estimateMotion). null when
 * the chart draws no axis (a donut / gauge).
 */
export async function axisWidth(file) {
  const { data } = await sharp(file).greyscale().resize(540, 960, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const y0 = 60, y1 = 670;   // the middle band and, for a chart in the top band, the top one
  const lum = []; for (let y = y0; y < y1; y += 7) for (let x = 0; x < 540; x += 7) lum.push(data[y * 540 + x]);
  lum.sort((a, b) => a - b);
  const ground = lum[lum.length >> 1], dark = ground > 128;
  let best = 0;
  for (let y = y0; y < y1; y++) {
    let run = 0;
    for (let x = 0; x < 540; x++) {
      const v = data[y * 540 + x], ink = dark ? v < ground - 90 : v > ground + 90;
      run = ink ? run + 1 : 0;
      if (run > best) best = run;
    }
  }
  return best >= 120 ? best : null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [a, b] = process.argv.slice(2);
  console.log(JSON.stringify(await estimateMotion(a, b)));
}
