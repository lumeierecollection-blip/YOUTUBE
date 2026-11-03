#!/usr/bin/env node
/**
 * contact-sheet.mjs — build a readable contact sheet via ffmpeg `tile`.
 *
 * Usage:
 *   node scripts/video-review/contact-sheet.mjs <video.mp4> <out.jpg> [cols rows]
 *
 * Samples evenly across the video and tiles them into one image.
 *
 * Requires ffmpeg on PATH.
 *
 * Separate from the rendering skill: this only inspects a finished MP4.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const [, , video, out, cols = "4", rows = "3"] = process.argv;
if (!video || !out) {
  console.error("usage: node scripts/video-review/contact-sheet.mjs <video.mp4> <out.jpg> [cols] [rows]");
  process.exit(2);
}
const abs = resolve(process.cwd(), video);
const outAbs = resolve(process.cwd(), out);
try {
  execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", abs], { encoding: "utf8" });
} catch (e) {
  console.error(`contact-sheet: video not readable: ${abs}: ${e.message}`);
  process.exit(1);
}
const interval = Math.max(1, 1 / (Number(cols) * Number(rows)));
execFileSync("ffmpeg", [
  "-y", "-v", "error",
  "-i", abs,
  "-vf", `fps=${(1 / interval).toFixed(6)},scale=270:-1,tile=${cols}x${rows}`,
  "-frames:v", "1", "-q:v", "2",
  outAbs,
], { encoding: "utf8" });
console.log(`contact sheet written: ${outAbs}`);
