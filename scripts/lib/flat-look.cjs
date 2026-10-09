/**
 * flat-look — do the per-beat components look like the reference, not like a chart library? (owner, 2026-10-09: "they shouldn't
 * look playful — actually that motion graphic": sharp or barely rounded corners, the reference palette only with ONE accent, thin
 * even strokes, no shadows, restrained motion with no spring / bounce / overshoot.)
 *
 * Pure functions on an RGB buffer (W*H*3) so they are unit-tested on synthetic frames; scripts/local-audit.cjs `flat-look` feeds
 * them rendered frames. What each one measures, and where it stops:
 *   offPalette   coloured pixels (chroma > CHROMA) whose hue is not the channel accent's — a candy-coloured series, a rainbow, a
 *                pastel fill. Neutrals (ink, grey, ground) and the accent (and its blends with the ground / ink) pass.
 *   shadowBelow  a soft halo to the RIGHT of a boxed element (flag, plate): the ground darkened by 4–70 luma over a strip 2–20 px
 *                out. A hairline border has none; a CSS drop shadow does.
 *   cornersSharp the four outermost pixels of a boxed element's outline differ from the ground — a rounded corner shows the ground.
 * Motion is not measured on pixels: scripts/__tests__/flat-look.test.js asserts no animation state of the drawn components exceeds
 * its end value (no overshoot) and lints the component source for bounce / shadow / round caps / heavy strokes.
 */
const CHROMA = 45, HUE_TOL = 38, OFF_SHARE_MAX = 0.004;

const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(String(h || "#000000").slice(k, k + 2), 16) || 0);
function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** { off, total, share } — coloured pixels in rows [y0, y1) whose hue is not the accent's; `skip` boxes ({x,y,w,h} in buffer px) are not judged. */
function offPalette(buf, W, H, accent, { y0 = 0, y1 = H, skip = [] } = {}) {
  const [ar, ag, ab] = hexRgb(accent);
  const accentChroma = Math.max(ar, ag, ab) - Math.min(ar, ag, ab), accentHue = hueOf(ar, ag, ab);
  let off = 0, total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      if (skip.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) continue;
      const o = (y * W + x) * 3, r = buf[o], g = buf[o + 1], b = buf[o + 2];
      const ch = Math.max(r, g, b) - Math.min(r, g, b);
      if (ch <= CHROMA) continue;
      total++;
      // The accent, or a blend of it with the ground / ink, keeps its hue; a neutral accent (grey) allows no colour at all.
      if (accentChroma > CHROMA && hueGap(hueOf(r, g, b), accentHue) <= HUE_TOL) continue;
      off++;
    }
  }
  return { off, total, share: off / (W * Math.max(1, y1 - y0)) };
}

const lumaAt = (buf, W, x, y) => { const o = (y * W + x) * 3; return 0.299 * buf[o] + 0.587 * buf[o + 1] + 0.114 * buf[o + 2]; };

/** Share of the strip 2–20 px right of `box` (buffer px) over its middle 60% height that is darker than `groundL` by 4–70 luma. */
function shadowShare(buf, W, H, box, groundL) {
  const xa = Math.round(box.x + box.w) + 2, xb = Math.min(W - 1, Math.round(box.x + box.w) + 20);
  const ya = Math.round(box.y + box.h * 0.2), yb = Math.round(box.y + box.h * 0.8);
  let n = 0, d = 0;
  for (let y = Math.max(0, ya); y < Math.min(H, yb); y++) for (let x = xa; x <= xb; x++) { n++; const dl = groundL - lumaAt(buf, W, x, y); if (dl >= 4 && dl <= 70) d++; }
  return n ? d / n : 0;
}

/**
 * How many of the four corners of an OUTLINED element are sharp. The element settles or pushes in a few pixels either side of its laid-out
 * `box` (buffer px), so each corner is found, not assumed: walk its diagonal from 14 px outside the box to 6 px inside and take the first
 * pixel that differs from the ground — the outline's outermost point there. A sharp corner is where the outline's two edges MEET: the
 * outline is still inked 6 px along both edges from that point. A corner rounded by ~16 px or more at 1080 has already turned away by then
 * (4 = all sharp).
 */
function cornersSharp(buf, W, H, box, groundL) {
  const x0 = Math.round(box.x), x1 = Math.round(box.x + box.w) - 1, y0 = Math.round(box.y), y1 = Math.round(box.y + box.h) - 1;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const differs = (x, y) => { if (!inb(x, y)) return false; const o = (y * W + x) * 3, r = buf[o], g = buf[o + 1], b = buf[o + 2]; return Math.abs(0.299 * r + 0.587 * g + 0.114 * b - groundL) > 25 || Math.max(r, g, b) - Math.min(r, g, b) > 30; };
  return [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].filter(([x, y, sx, sy]) => {
    for (let k = -14; k <= 6; k++) {
      const px = x + k * sx, py = y + k * sy;
      if (differs(px, py)) return differs(px + 6 * sx, py) && differs(px, py + 6 * sy);
    }
    return false;
  }).length;
}

module.exports = { offPalette, shadowShare, cornersSharp, hueOf, hueGap, hexRgb, CHROMA, HUE_TOL, OFF_SHARE_MAX };
