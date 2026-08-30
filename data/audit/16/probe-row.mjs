#!/usr/bin/env node
/**
 * Probe precise horizontal structure + text detection for the headline band
 * of a rendered frame, to classify grey bands as glyphs vs solid regions.
 * usage: node data/audit/16/probe-row.mjs <frame.png> <yStart> <yEnd>
 */
import sharp from "../../../node_modules/sharp/dist/index.cjs";

const [framePath, syArg, eyArg] = process.argv.slice(2);
const sy0 = parseInt(syArg, 10) || 0;
const ey0 = parseInt(eyArg, 10) || 1080;

const img = sharp(framePath);
const meta = await img.metadata();
const W = meta.width, H = meta.height;
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const ch = info.channels;

function px(x, y) {
  const o = (y * W + x) * ch;
  return [data[o], data[o + 1], data[o + 2]];
}

// compression-like: report runs of foreground on a middle row
for (const y of [962, 964, 972, 980, 990, 1022, 1035, 1050, 1060]) {
  if (y < sy0 || y > ey0) continue;
  const runs = [];
  let inRun = false, runStart = 0;
  for (let x = 0; x < W; x++) {
    const [r, g, b] = px(x, y);
    const v = (r + g + b) / 3;
    const fg = v < 235;
    if (fg && !inRun) { inRun = true; runStart = x; }
    if (!fg && inRun) { inRun = false; runs.push([runStart, x - 1]); }
  }
  if (inRun) runs.push([runStart, W - 1]);
  const sampleRuns = runs.slice(0, 12);
  const details = sampleRuns.map(([a, b]) => {
    // darkest pixel in this run
    let d = [255, 255, 255];
    for (let x = a; x <= b; x++) {
      const [r, g, bl] = px(x, y);
      if (r + g + bl < d[0] + d[1] + d[2]) d = [r, g, bl];
    }
    // is this a glyph stroke or a wide solid?
    const width = b - a + 1;
    return `x${a}-${b}(w${width},dark(${d[0]},${d[1]},${d[2]}))`;
  });
  console.log(`y=${y} runs=${runs.length} ${details.join(" ")}`);
}
