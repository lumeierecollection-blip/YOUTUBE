#!/usr/bin/env node
/**
 * Stage-16 FRM-01/02 evidence builder.
 * Extracts 1 frame / 15 seconds from a rendered Short (FRM-01's method),
 * writes frame-XX.png + manifest.json into a review dir, then (optionally)
 * runs scripts/frame-audit.js over it (FRM-02 safe-rect + COL-23 contrast).
 *
 * Usage:
 *   node data/audit/16/extract-frames.mjs <mp4> <outDir>
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const [mp4, outDirRaw] = process.argv.slice(2);
if (!mp4 || !outDirRaw) {
  console.error("usage: node data/audit/16/extract-frames.mjs <mp4> <outDir>");
  process.exit(1);
}
const outDir = resolve(outDirRaw);
mkdirSync(outDir, { recursive: true });

// ffprobe duration
const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4], { encoding: "utf8" }).trim();
const dur = parseFloat(probe);
const fps = 30; // composition fps (MotionGraphicsShorts = 30)

// 1 frame per 15 seconds (FRM-01), always include t=0 and the final frame.
const times = new Set([0]);
for (let t = 15; t < dur; t += 15) times.add(Math.round(t * 100) / 100);
times.add(Math.round((dur - 0.05) * 100) / 100);
const sorted = [...times].sort((a, b) => a - b);

const frames = [];
for (let i = 0; i < sorted.length; i++) {
  const t = sorted[i];
  const file = join(outDir, `frame-${String(i).padStart(2, "0")}.png`);
  execFileSync("ffmpeg", [
    "-y", "-ss", String(t), "-i", mp4,
    "-frames:v", "1",
    "-vf", `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2`,
    file,
  ]);
  frames.push({ index: i, timeSec: t, file });
  console.log(`frame ${i}: t=${t}s -> ${file}`);
}

const manifest = {
  tool: "stage16-frm-01-02",
  video: mp4,
  durationSec: dur,
  width: 1080,
  height: 1920,
  fps,
  frames,
  contactSheet: join(outDir, "contact-sheet.png"),
  note: "1 frame / 15s per FRM-01; audit with scripts/frame-audit.js per FRM-02/COL-23.",
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest -> ${join(outDir, "manifest.json")}`);

// Contact sheet (FRM-01): tile the frames into one image for sheet review.
const labels = frames.map((f, i) => `t${f.timeSec}s`).join("|");
const inputs = [];
for (const f of frames) inputs.push("-i", f.file);
const n = frames.length;
const cols = Math.ceil(Math.sqrt(n));
const rows = Math.ceil(n / cols);
const w = 270, h = 480;
execFileSync("ffmpeg", [
  "-y", ...inputs,
  "-filter_complex",
  `[0:v]scale=${w}:${h}${frames.length > 1 ? `[v0]` : ""};` +
    frames.slice(1).map((_, i) => `[${i + 1}:v]scale=${w}:${h}[v${i + 1}];`).join("") +
`${frames.map((_, i) => `[v${i}]`).join("")}xstack=inputs=${n}:layout=${Array.from({ length: n }, (_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join("|")}`,
    join(outDir, "contact-sheet.png"),
  ]);
console.log(`contact sheet -> ${join(outDir, "contact-sheet.png")}`);