/**
 * Pixel checks on the finished MP4 for the white-background and variety requirements.
 * The inventory says what was planned; this measures what actually reached the frames.
 *
 * Where the measurement stops: layout_change compares where ink sits on a coarse grid. Two
 * different charts can occupy similar cells, so a pass means "not the same layout", not "good".
 */
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT, must, writeJson } from "./lib.mjs";

const require = createRequire(join(ROOT, "package.json"));
const sharp = require("sharp");
const SW = 108, SH = 192, COLS = 9, ROWS = 16;

export const LIMITS = { min_background_share_median: 0.3, min_background_share_any: 0.15, max_purple_share: 0.02, max_dark_share: 0.6, min_layout_change: 0.06 };

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Measures one decoded frame against the palette background. Exported for the unit test. */
export function frameStats(rgb, bg) {
  const n = rgb.length / 3, cells = new Array(COLS * ROWS).fill(0);
  let onBg = 0, purple = 0, dark = 0;
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    const isBg = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) < 60;
    if (isBg) onBg++;
    else cells[Math.floor((i % SW) / (SW / COLS)) + COLS * Math.floor(Math.floor(i / SW) / (SH / ROWS))]++;
    if (0.299 * r + 0.587 * g + 0.114 * b < 50) dark++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 60 && (mx - mn) / mx > 0.25 && b === mx && r > g * 1.15) purple++;
  }
  const perCell = (SW / COLS) * (SH / ROWS);
  return { background_share: onBg / n, purple_share: purple / n, dark_share: dark / n, grid: cells.map((c) => (c / perCell > 0.2 ? 1 : 0)) };
}

export const layoutChange = (a, b) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0) / a.length;

export async function visualGate({ mp4, inventory, palette, dir }) {
  const tmp = join(dir, "visual-gate"); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  const bg = hexRgb(palette.bg), failures = [], frames = [];
  for (const row of inventory) {
    // Late in the scene: every staged element has arrived and any chapter card has gone.
    const t = row.start_s + 0.78 * (row.end_s - row.start_s);
    const file = join(tmp, `scene-${row.scene}.png`);
    must("visual-gate", "ffmpeg", ["-y", "-v", "error", "-ss", t.toFixed(3), "-i", mp4, "-frames:v", "1", file]);
    const { data } = await sharp(file).resize(SW, SH, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    frames.push({ scene: row.scene, composition: row.composition, at_s: Number(t.toFixed(2)), ...frameStats(data, bg), repeat_reason: row.repeat_reason });
  }
  const shares = frames.map((f) => f.background_share).sort((a, b) => a - b);
  const median = shares[shares.length >> 1] ?? 0;
  if (median < LIMITS.min_background_share_median) failures.push(`background covers only ${(median * 100).toFixed(0)}% of a typical scene`);
  for (const f of frames) {
    if (f.background_share < LIMITS.min_background_share_any) failures.push(`scene ${f.scene}: background covers ${(f.background_share * 100).toFixed(0)}%`);
    if (f.purple_share > LIMITS.max_purple_share) failures.push(`scene ${f.scene}: purple covers ${(f.purple_share * 100).toFixed(1)}%`);
    if (f.dark_share > LIMITS.max_dark_share) failures.push(`scene ${f.scene}: ${(f.dark_share * 100).toFixed(0)}% of the frame is dark`);
  }
  const adjacent = [];
  for (let i = 1; i < frames.length; i++) {
    const change = layoutChange(frames[i - 1].grid, frames[i].grid);
    adjacent.push({ scenes: [frames[i - 1].scene, frames[i].scene], layout_change: Number(change.toFixed(3)) });
    if (change < LIMITS.min_layout_change && !frames[i].repeat_reason) failures.push(`scenes ${frames[i - 1].scene} and ${frames[i].scene} look alike (layout change ${change.toFixed(3)})`);
  }
  const report = { pass: failures.length === 0, failures, limits: LIMITS, median_background_share: Number(median.toFixed(3)), frames: frames.map(({ grid, ...f }) => ({ ...f, background_share: Number(f.background_share.toFixed(3)), purple_share: Number(f.purple_share.toFixed(4)), dark_share: Number(f.dark_share.toFixed(3)) })), adjacent };
  writeJson(join(dir, "visual-gate.json"), report);
  return report;
}
