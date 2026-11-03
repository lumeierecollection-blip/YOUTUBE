#!/usr/bin/env node
/**
 * extract-frames.mjs — extract frames at meaningful timestamps via ffmpeg.
 *
 * Usage:
 *   node scripts/video-review/extract-frames.mjs <video.mp4> <out-dir> [t1 t2 t3 ...]
 *
 * Examples:
 *   node scripts/video-review/extract-frames.mjs data/renders/1/x-coverage.mp4 data/editor/qa/x-frames 0 5 10 15 20 25 30
 *   node scripts/video-review/extract-frames.mjs data/renders/1/x-coverage.mp4 data/editor/qa/x-transitions 10.5 15.5 20.5
 *
 * Requires ffmpeg on PATH. Writes one f<timestamp>.jpg per timestamp.
 *
 * Separate from the rendering skill: this only inspects a finished MP4.
 */
import { execFileSync } from "node:child_process";
import { resolve, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const [, , video, outDir, ...timestamps] = process.argv;
if (!video || !outDir || !timestamps.length) {
  console.error("usage: node scripts/video-review/extract-frames.mjs <video.mp4> <out-dir> <t1> [t2 ...]");
  process.exit(2);
}
const abs = resolve(process.cwd(), video);
const out = resolve(process.cwd(), outDir);
if (!existsSync(abs)) { console.error(`extract-frames: video not found: ${abs}`); process.exit(1); }
mkdirSync(out, { recursive: true });

for (const ts of timestamps) {
  const safe = String(ts).replace(/[^0-9.]/g, "_");
  const outPath = join(out, `f${safe}s.jpg`);
  try {
    execFileSync("ffmpeg", [
      "-y", "-v", "error", "-ss", String(ts), "-i", abs,
      "-frames:v", "1", "-q:v", "2", outPath,
    ], { encoding: "utf8" });
    console.log(`extracted ${ts}s -> ${outPath}`);
  } catch (e) {
    console.error(`extract-frames: failed at ${ts}s: ${e.message}`);
  }
}
