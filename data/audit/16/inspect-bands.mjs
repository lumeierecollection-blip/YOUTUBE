#!/usr/bin/env node
/**
 * Inspect a rendered frame's probe bands to understand exactly what element
 * is tripping COL-23. Reports the darkest/most-fg pixel per row across the
 * headline/caption bands and prints a horizontal signature so we can tell
 * whether the trip is a vertical line, phrase glyphs, an accent stake, etc.
 *
 * usage: node data/audit/16/inspect-bands.mjs <frame.png> <startY> <endY>
 */
import sharp from "../../../node_modules/sharp/dist/index.cjs";

const [framePath, syArg, eyArg] = process.argv.slice(2);
const sy0 = parseInt(syArg, 10) || 0;
const ey0 = parseInt(eyArg, 10) || 1080;

const img = sharp(framePath);
const meta = await img.metadata();
const W = meta.width, H = meta.height;
console.log(`frame ${framePath} ${W}x${H}`);

const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const ch = info.channels;

// For each row, find the darkest pixel and the pixel farthest from white.
function pixel(x, y) {
  const o = (y * W + x) * ch;
  return [data[o], data[o + 1], data[o + 2]];
}
function lum(r, g, b) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(r, g, b) {
  const l = lum(r, g, b);
  const bg = lum(255, 255, 255);
  return Math.round(((bg + 0.05) / (l + 0.05)) * 100) / 100;
}

for (let y = sy0; y <= ey0; y++) {
  let dark = { x: -1, c: [255, 255, 255] };
  let farthest = { x: -1, c: [255, 255, 255], d: 0 };
  let nFg = 0;
  for (let x = 0; x < W; x++) {
    const [r, g, b] = pixel(x, y);
    const d = 255 - (r + g + b) / 3; // distance from white by luminance
    if (d > farthest.d) { farthest = { x, c: [r, g, b], d }; }
    if ((r + g + b) / 3 < 235) nFg++;
    if ((r + g + b) < (dark.c[0] + dark.c[1] + dark.c[2])) dark = { x, c: [r, g, b] };
  }
  const fr = farthest.c[0], fg = farthest.c[1], fb = farthest.c[2];
  console.log(`y=${y} farthest(x=${farthest.x}) rgb(${fr},${fg},${fb}) contrast=${contrast(fr, fg, fb)} darkest(x=${dark.x}) rgb(${dark.c[0]},${dark.c[1]},${dark.c[2]}) nFg=${nFg}`);
}
