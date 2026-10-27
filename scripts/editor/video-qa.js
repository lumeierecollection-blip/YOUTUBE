#!/usr/bin/env node
/**
 * Final-MP4 QA for editor timelines.
 *
 * This is deliberately not a model review: it measures the exported file and
 * compares it with the persisted timeline the renderer was given. It catches
 * the failure modes the old text-only renders shipped with: black stretches,
 * a still/text-only video, missing image scenes, missing credits and captions
 * outside the frame.
 *
 *   node scripts/editor/video-qa.js \
 *     --video data/renders/1/aberfan-...mp4 \
 *     --timeline data/editor/timelines/aberfan.json \
 *     --out data/renders/1/aberfan-...-editor-qa.json \
 *     --contact data/renders/1/aberfan-...-editor-contact.jpg
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  FPS,
  effectMagnitude,
  isVisiblyRendered,
  layersActiveAt,
} from "../../src/skills/remotion-render/editor/layer-math.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, x, i, arr) => {
    if (x.startsWith("--")) a.push([x.slice(2), arr[i + 1]]);
    return a;
  }, []),
);
const need = (k) => {
  if (!args[k]) throw new Error(`missing --${k}`);
  return args[k];
};
const abs = (p) => (p ? resolve(ROOT, p) : null);
const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { encoding: "utf8" });

const videoPath = abs(need("video"));
const timelinePath = abs(need("timeline"));
if (!existsSync(videoPath)) throw new Error(`video not found: ${videoPath}`);
if (!existsSync(timelinePath)) throw new Error(`timeline not found: ${timelinePath}`);

const timeline = JSON.parse(readFileSync(timelinePath, "utf8"));
const fps = Number(timeline.fps) || FPS;
const timelineDuration = timeline.durationInFrames / fps;
const outPath = abs(args.out) || join(ROOT, "data", "editor", "qa", `${timeline.id}-qa.json`);
const contactPath = abs(args.contact) || outPath.replace(/\.json$/, "-contact.jpg");
const framesDir = abs(args.frames) || join(ROOT, "data", "editor", "qa", `${timeline.id}-frames`);
mkdirSync(dirname(outPath), { recursive: true });
mkdirSync(dirname(contactPath), { recursive: true });

const probe = JSON.parse(
  run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size",
    "-show_entries", "stream=codec_name,width,height",
    "-of", "json",
    videoPath,
  ]),
);
const streams = probe.streams || [];
const videoStream = streams.find((s) => s.codec_name === "h264" || s.width);
const audioStream = streams.find((s) => s.codec_name === "aac" || s.codec_type === "audio");
const videoDuration = Number(probe.format?.duration) || 0;
const width = Number(videoStream?.width) || 0;
const height = Number(videoStream?.height) || 0;
const inferredScale = timeline.width ? width / timeline.width : 0;

const failures = [];
const fail = (check, why) => failures.push({ check, why });

if (!videoStream) fail("video-stream", "no video stream");
if (!audioStream) fail("audio-stream", "no audio stream");
if (Math.abs(videoDuration - timelineDuration) > 1.0) {
  fail("duration", `video ${videoDuration.toFixed(3)}s vs timeline ${timelineDuration.toFixed(3)}s (drift > 1.0s)`);
}
if (inferredScale < 0.2 || inferredScale > 1.5) {
  fail("scale", `video is ${width}x${height}; timeline is ${timeline.width}x${timeline.height} (scale ${inferredScale.toFixed(3)})`);
} else {
  const expectedW = Math.round(timeline.width * inferredScale);
  const expectedH = Math.round(timeline.height * inferredScale);
  if (Math.abs(width - expectedW) > 1 || Math.abs(height - expectedH) > 1) {
    fail("aspect", `video ${width}x${height} does not match timeline aspect at scale ${inferredScale.toFixed(3)} (${expectedW}x${expectedH})`);
  }
}

/* ── Timeline coverage ─────────────────────────────────────────── */

const imageLayers = (timeline.layers || []).filter((l) => l.type === "image" && l.asset_id);
const sceneImages = imageLayers.filter((l) => /^scene-\d+-image$/.test(l.id));
const referencedAssets = [...new Set(imageLayers.map((l) => l.asset_id))];
const missingAssets = referencedAssets.filter((id) => !timeline.assets?.[id]?.file || !existsSync(abs(timeline.assets[id].file)));
if (missingAssets.length) fail("assets", `missing timeline asset files: ${missingAssets.join(", ")}`);
const missingCredits = referencedAssets.filter((id) => !timeline.assets?.[id]?.credit);
if (missingCredits.length) fail("credits", `assets without credit: ${missingCredits.join(", ")}`);
const missingSources = referencedAssets.filter((id) => !timeline.assets?.[id]?.source_url);
if (missingSources.length) fail("sources", `assets without source_url: ${missingSources.join(", ")}`);

const invisibleScenes = [];
for (const layer of sceneImages) {
  const mid = layer.in + Math.floor((layer.out - layer.in) / 2);
  if (!isVisiblyRendered(layer, mid)) invisibleScenes.push(layer.id);
}
if (invisibleScenes.length) fail("image-coverage", `image scene layer(s) not visibly rendered at midpoint: ${invisibleScenes.join(", ")}`);

const movingLayers = imageLayers.filter((layer) => {
  const m = effectMagnitude(layer, {
    start_f: 0,
    end_f: Math.max(1, layer.out - layer.in),
    to: { scale: 1, x: 1, y: 1 },
  });
  return Math.max(m.scale || 0, m.x || 0, m.y || 0) > 0.005;
});
const motionShare = imageLayers.length ? movingLayers.length / imageLayers.length : 0;
if (motionShare < 0.8) fail("motion-keyframes", `only ${(motionShare * 100).toFixed(0)}% of image layers have scale/pan motion`);

const wholeSeconds = Math.max(1, Math.floor(timelineDuration));
let imageSeconds = 0;
let textOnlySeconds = 0;
for (let sec = 0; sec < wholeSeconds; sec++) {
  const frame = sec * fps;
  const active = layersActiveAt(timeline, frame);
  const hasImage = active.some((l) => (l.type === "image" || l.type === "svg") && isVisiblyRendered(l, frame));
  if (hasImage) imageSeconds++;
  else if (active.some((l) => l.type === "text")) textOnlySeconds++;
}
const imageShare = imageSeconds / wholeSeconds;
if (imageShare < 0.8) fail("image-seconds", `only ${(imageShare * 100).toFixed(0)}% of seconds have a visible image/SVG`);
if (textOnlySeconds > 1) fail("text-only", `${textOnlySeconds} second(s) are text-only`);

const cues = timeline.captions || [];
if (!cues.length) fail("captions", "no caption cues");
const badCues = cues.filter((c) => c.start_f < 0 || c.end_f > timeline.durationInFrames + 1 || c.end_f <= c.start_f);
if (badCues.length) fail("captions", `${badCues.length} caption cue(s) outside the timeline`);
const st = timeline.caption_style || {};
if ((st.x || 0) + (st.w || 0) > timeline.width + 1 || (st.y || 0) + (st.h || 0) > timeline.height + 1) {
  fail("caption-box", `caption box ${st.x},${st.y} ${st.w}x${st.h} is outside ${timeline.width}x${timeline.height}`);
}
if (cues.some((c) => !Array.isArray(c.words) || c.words.length === 0)) {
  fail("caption-words", "a caption cue has no word timings");
}

/* ── Final-pixel checks ─────────────────────────────────────────── */

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
run("ffmpeg", [
  "-y", "-v", "error",
  "-i", videoPath,
  "-vf", "fps=2,scale=270:-1",
  "-start_number", "0",
  "-q:v", "2",
  join(framesDir, "f%05d.jpg"),
]);
const frameFiles = readdirSync(framesDir).filter((f) => /^f\d+\.jpg$/.test(f)).sort();
if (frameFiles.length < 2) fail("frames", "could not extract frames from the video");

let lumaSum = 0;
let blackFrames = 0;
let maxStaticRun = 0;
let staticRun = 0;
let motionSum = 0;
let motionCount = 0;
let previous = null;
for (const file of frameFiles) {
  const path = join(framesDir, file);
  const { data, info } = await sharp(path).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (data[i] > max) max = data[i];
  }
  const mean = sum / data.length;
  lumaSum += mean;
  if (mean < 5 && max < 30) blackFrames++;
  if (previous && previous.length === data.length) {
    let diff = 0;
    for (let i = 0; i < data.length; i++) diff += Math.abs(data[i] - previous[i]);
    const motion = diff / data.length;
    motionSum += motion;
    motionCount++;
    if (motion < 0.2) {
      staticRun += 0.5;
      if (staticRun > maxStaticRun) maxStaticRun = staticRun;
    } else {
      staticRun = 0;
    }
  }
  previous = data;
}
const meanLuma = frameFiles.length ? lumaSum / frameFiles.length : 0;
const meanMotion = motionCount ? motionSum / motionCount : 0;
if (blackFrames > 0) fail("black-frames", `${blackFrames} black frame(s) in the export`);
if (maxStaticRun > 4.0) fail("static-run", `longest near-static run is ${maxStaticRun.toFixed(1)}s (limit 4.0s)`);
if (meanMotion < 0.05) fail("motion", `mean frame motion is ${meanMotion.toFixed(3)} (limit 0.05)`);

/* ── Contact sheet ──────────────────────────────────────────────── */

const cols = 4;
const rows = 3;
const interval = Math.max(1, timelineDuration / (cols * rows));
run("ffmpeg", [
  "-y", "-v", "error",
  "-i", videoPath,
  "-vf", `fps=${(1 / interval).toFixed(6)},scale=270:-1,tile=${cols}x${rows}`,
  "-frames:v", "1",
  "-q:v", "2",
  contactPath,
]);
if (!existsSync(contactPath)) fail("contact-sheet", "contact sheet was not written");

const report = {
  editor_timeline: true,
  pass: failures.length === 0,
  generated_at: new Date().toISOString(),
  id: timeline.id,
  video: videoPath,
  timeline: timelinePath,
  duration_s: Number(videoDuration.toFixed(3)),
  timeline_duration_s: Number(timelineDuration.toFixed(3)),
  width,
  height,
  scale: Number(inferredScale.toFixed(3)),
  checks: {
    video_stream: !!videoStream,
    audio_stream: !!audioStream,
    duration_drift_s: Number(Math.abs(videoDuration - timelineDuration).toFixed(3)),
    black_frames: blackFrames,
    mean_luma: Number(meanLuma.toFixed(2)),
    mean_motion: Number(meanMotion.toFixed(3)),
    longest_static_run_s: Number(maxStaticRun.toFixed(1)),
    image_seconds: imageSeconds,
    image_seconds_share: Number(imageShare.toFixed(3)),
    text_only_seconds: textOnlySeconds,
    image_layers: imageLayers.length,
    scene_image_layers: sceneImages.length,
    motion_layers: movingLayers.length,
    unique_assets: referencedAssets.length,
    caption_cues: cues.length,
    credits: referencedAssets.length - missingCredits.length,
    contact_sheet: contactPath,
    frames_dir: framesDir,
  },
  failures,
};
writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
console.log(
  `[editor-qa] ${report.pass ? "PASS" : "FAIL"} ${timeline.id}: ${videoDuration.toFixed(2)}s, ${imageSeconds}/${wholeSeconds}s image coverage, ` +
    `${referencedAssets.length} assets, ${cues.length} caption cues, ${blackFrames} black frames, ${maxStaticRun.toFixed(1)}s max static`,
);
for (const f of failures) console.error(`[editor-qa] ${f.check}: ${f.why}`);
console.log(`[editor-qa] report: ${outPath}`);
console.log(`[editor-qa] contact: ${contactPath}`);
process.exit(report.pass ? 0 : 1);
