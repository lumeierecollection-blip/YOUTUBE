#!/usr/bin/env node
/**
 * Stage-16 RND-14 probe — "No frame is >92% a single colour" (CHECK-REGISTER
 * §3.x, row RND-14, gate at stage 16). Method: contact sheet; here computed
 * exactly from the native scale-1.0 frames in the review dir, same byte
 * source frame-audit.js gates (sharp).
 *
 * Measures the fraction of pixels equal to the most-common RGB triple per
 * frame (exact 24-bit match, not a bucket). RND-14 fails if any frame is
 * >92% a single colour.
 *
 * Usage:
 *   node data/audit/16/probe-rnd14.mjs <review-dir>
 */
import sharp from "sharp";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [dir] = process.argv.slice(2);
if (!dir) {
  console.error("usage: node data/audit/16/probe-rnd14.mjs <review-dir>");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const LIMIT = 0.92;

let worst = { file: "", frac: 0, rgb: null };
let fails = 0;
for (const f of manifest.frames) {
  const { data, info } = await sharp(f.file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bestKey = null, bestCount = 0;
  for (const [k, c] of counts) {
    if (c > bestCount) { bestCount = c; bestKey = k; }
  }
  const frac = bestCount / (info.width * info.height);
  const r = (bestKey >> 16) & 255, g = (bestKey >> 8) & 255, b = bestKey & 255;
  const ok = frac <= LIMIT;
  if (!ok) fails++;
  if (frac > worst.frac) worst = { file: f.file, frac, rgb: `rgb(${r},${g},${b})`, unique: counts.size };
  console.log(`${ok ? "PASS" : "FAIL"} ${f.file.split(/[\\/]/).pop()} dominant=${frac.toFixed(4)} rgb(${r},${g},${b}) unique=${counts.size}`);
}

console.log(`\nRND-14: ${fails === 0 ? "PASS" : "FAIL"} ${manifest.frames.length} frames, worst=${worst.file} at ${(worst.frac * 100).toFixed(2)}% (${worst.rgb}, ${worst.unique} unique colours)`);
process.exit(fails === 0 ? 0 : 1);