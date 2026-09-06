#!/usr/bin/env node
/**
 * Measure where the ink actually is in a rendered template still, against the
 * Shorts safe rect.
 *
 *   node qa-scripts/measure-template-bounds.mjs data/renders/sweep
 *
 * PLN-05 says content is fitted inside the rect that survives the plan's own
 * camera. That is a claim about geometry, and geometry claims have been wrong
 * here before — CHECK-REGISTER 3.12.26 and 3.16 are both cases where the maths
 * was right and the pixels were not. This reads the pixels.
 *
 * A pixel counts as ink when it differs from the frame's own background by more
 * than INK_DELTA. The background is taken as the modal corner colour rather than
 * assumed, because half these channels render on white and half on black.
 */
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePNG } from "../decode-png.js";
import { SAFE_SHORTS } from "../layout/slots.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..", "..");
const dir = join(ROOT, process.argv[2] || "data/renders/sweep");

/** Matches frame-bounds.mjs so the two gates agree on what a mark is. */
const INK_DELTA = 26;

function bounds(png) {
  // decode-png.js returns 3 channels for colorType 2 and 4 for colorType 6, and
  // says which in `channels`. Hard-coding 4 read every frame as almost entirely
  // ink -- the first run of this script reported all twelve frames 670px outside
  // the safe rect, which was the stride, not the layout.
  const { width, height, channels, data } = png;
  const at = (x, y) => { const i = (y * width + x) * channels; return [data[i], data[i + 1], data[i + 2]]; };
  const bg = at(4, 4);
  let l = width, r = -1, t = height, b = -1, n = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const [pr, pg, pb] = at(x, y);
      if (Math.abs(pr - bg[0]) + Math.abs(pg - bg[1]) + Math.abs(pb - bg[2]) < INK_DELTA) continue;
      n++;
      if (x < l) l = x; if (x > r) r = x;
      if (y < t) t = y; if (y > b) b = y;
    }
  }
  return { l, r, t, b, n, bg };
}

const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
const S = SAFE_SHORTS;
let worst = 0, empty = 0, bad = [];
for (const f of files) {
  const png = decodePNG(join(dir, f));
  const m = bounds(png);
  if (m.n === 0) { empty++; console.log(`EMPTY  ${f}`); continue; }
  const over = Math.max(S.left - m.l, m.r - S.right, S.top - m.t, m.b - S.bottom, 0);
  const fill = (m.n * 4) / (png.width * png.height); // sampled every 2nd px in both axes
  if (over > 0) { bad.push([f, over]); worst = Math.max(worst, over); }
  console.log(
    `${over > 0 ? "OVER " : "ok   "} ${f.padEnd(34)} x[${m.l},${m.r}] y[${m.t},${m.b}]` +
    ` ink ${(fill * 100).toFixed(1)}%${over > 0 ? `  ${over}px past safe` : ""}`
  );
}
console.log(`\n${files.length} frame(s): ${bad.length} outside the safe rect (worst ${worst}px), ${empty} empty.`);
process.exit(bad.length || empty ? 1 : 0);
