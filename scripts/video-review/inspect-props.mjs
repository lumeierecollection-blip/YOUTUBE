#!/usr/bin/env node
/**
 * inspect-props.mjs — report duration/codec/resolution of a video via ffprobe.
 *
 * Usage:
 *   node scripts/video-review/inspect-props.mjs data/renders/1/<stem>-coverage.mp4
 *
 * Requires ffprobe on PATH. Emits JSON to stdout (and a short summary).
 *
 * Separate from the rendering skill: this only inspects a finished MP4.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const [, , video] = process.argv;
if (!video) {
  console.error("usage: node scripts/video-review/inspect-props.mjs <video.mp4>");
  process.exit(2);
}
const abs = resolve(process.cwd(), video);

let probe;
try {
  probe = JSON.parse(
    execFileSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration,size,format_name",
      "-show_entries", "stream=index,codec_name,codec_type,width,height,r_frame_rate",
      "-of", "json",
      abs,
    ], { encoding: "utf8" }),
  );
} catch (e) {
  console.error(`inspect-props: ffprobe failed for ${video}: ${e.message}`);
  process.exit(1);
}

const videoStream = (probe.streams || []).find((s) => s.codec_type === "video");
const audioStream = (probe.streams || []).find((s) => s.codec_type === "audio");
const format = probe.format || {};

const report = {
  file: video,
  format: format.format_name,
  duration_s: Number(format.duration) || 0,
  size_bytes: Number(format.size) || 0,
  video: videoStream ? {
    codec: videoStream.codec_name,
    width: Number(videoStream.width) || 0,
    height: Number(videoStream.height) || 0,
    fps: videoStream.r_frame_rate,
  } : null,
  audio: audioStream ? { codec: audioStream.codec_name } : null,
};
console.log(JSON.stringify(report, null, 2));
console.log(
  `\n${video}: ${report.duration_s.toFixed(3)}s, ${report.video?.width}x${report.video?.height}, ` +
  `${report.video?.codec}/${report.audio?.codec}, ${report.format}, ${(report.size_bytes / 1024 / 1024).toFixed(2)} MB`,
);
