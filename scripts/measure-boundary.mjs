/**
 * Measure ch-2 beat 5 boundary frames exactly as local-audit.cjs popTransitions does:
 * scale to 270x480, count rows above capRow = floor(1450/1920*480) = 362 that hold >= 3
 * dark (<235 luma) pixels, and fail below 12.
 *
 * Also reports which vertical band holds the ink, so "the headline is late" and "nothing
 * arrived at all" are distinguishable rather than both reading as "empty".
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const mp4 = process.argv[2];
const beatStart = Number(process.argv[3]);
const label = process.argv[4] || "clip";
if (!mp4) { console.error("usage: node measure-boundary.mjs <mp4> <beatStartSec> [label]"); process.exit(2); }
mkdirSync("data/audit/a1-ci/measure", { recursive: true });

const W = 270, H = 480;
const CAPTION_Y0 = 1450;
const capRow = Math.floor((CAPTION_Y0 / 1920) * H);   // 362
// bands, in 480-space (pop-groups.js BANDS)
const topBand = [0, Math.floor((620 / 1920) * H)];
const midBand = [Math.floor((620 / 1920) * H), Math.floor(((CAPTION_Y0 - 10) / 1920) * H)];

console.log(`${label}: beat starts ${beatStart}s, capRow=${capRow}, top=[${topBand}] middle=[${midBand}]\n`);
console.log("frame |  t(s)  | inkRows(>=12 pass) | top-band ink | mid-band ink | png KB");

for (const f of (process.env.FRAMES ? process.env.FRAMES.split(",").map(Number) : [0, 3, 6, 7, 8, 9, 10])) {
  const t = beatStart + f / 30;
  const png = `data/audit/a1-ci/measure/${label}-f${f}.png`;
  execFileSync("ffmpeg", ["-ss", String(t), "-i", mp4, "-frames:v", "1", "-y", png], { stdio: "pipe" });
  const { data, info } = await sharp(png).resize(W, H, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let rows = 0, topInk = 0, midInk = 0;
  for (let y = 0; y < capRow; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) { const o = (y * W + x) * info.channels; if (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2] < 235) n++; }
    if (n >= 3) { rows++; if (y < topBand[1]) topInk++; else if (y >= midBand[0]) midInk++; }
  }
  const kb = Math.round(readFileSync(png).length / 1024);
  console.log(`  f${String(f).padEnd(3)} | ${t.toFixed(2)} | ${String(rows).padEnd(19)} | ${String(topInk).padEnd(12)} | ${String(midInk).padEnd(12)} | ${kb}`);
}
console.log("\ninkRows >= 12 passes pop-transitions; below 12 is the reported 'empty'.");