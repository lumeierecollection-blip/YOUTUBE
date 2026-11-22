#!/usr/bin/env node
/**
 * transition-sheet.mjs — one contact sheet of beat-boundary stills, a row per boundary, so a
 * transition is judged on rendered pixels instead of read off the code.
 *
 *   node scripts/transition-sheet.mjs <dir with beat-<i>-<pct>.png> [--out sheet.png] [--beat-frames 90]
 *
 * <pct> in the file name is the percent of the beat (qa-canvas-render.mjs names them so); the
 * label shows the frame after the cut it stands for.
 *
 * The stills come from `scripts/qa-canvas-render.mjs --beats ... --moments ...`.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const dir = process.argv[2];
if (!dir) { console.error("usage: node scripts/transition-sheet.mjs <dir> [--out sheet.png]"); process.exit(2); }
const oi = process.argv.indexOf("--out");
const out = oi > -1 ? process.argv[oi + 1] : join(dir, "transition-sheet.png");
const bi = process.argv.indexOf("--beat-frames");
const BEAT = bi > -1 ? Number(process.argv[bi + 1]) : 90;
const files = readdirSync(dir).map((f) => f.match(/^beat-(\d+)-([\d.]+)\.png$/)).filter(Boolean)
  .map((m) => ({ beat: Number(m[1]), pct: Number(m[2]), file: join(dir, m[0]) }));
const beats = [...new Set(files.map((f) => f.beat))].sort((a, b) => a - b);
const cols = Math.max(...beats.map((b) => files.filter((f) => f.beat === b).length));
const TW = 216, TH = 384, GAP = 8, LABEL = 22;
const tiles = [];
for (const [r, b] of beats.entries()) {
  const row = files.filter((f) => f.beat === b).sort((x, y) => x.pct - y.pct);
  for (const [c, f] of row.entries()) {
    const img = await sharp(f.file).resize(TW, TH, { fit: "fill" }).png().toBuffer();
    tiles.push({ input: img, left: c * (TW + GAP) + GAP, top: r * (TH + LABEL + GAP) + GAP + LABEL });
    const label = Buffer.from(`<svg width="${TW}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg"><text x="4" y="16" font-family="Arial" font-size="14" fill="#222">beat ${b}, frame ${Math.round((f.pct * BEAT) / 100)} after the cut</text></svg>`);
    tiles.push({ input: label, left: c * (TW + GAP) + GAP, top: r * (TH + LABEL + GAP) + GAP });
  }
}
await sharp({ create: { width: cols * (TW + GAP) + GAP, height: beats.length * (TH + LABEL + GAP) + GAP, channels: 3, background: "#cfcfcf" } })
  .composite(tiles).png().toFile(out);
console.log(`${out}: ${beats.length} boundary row(s) x ${cols} frames`);
