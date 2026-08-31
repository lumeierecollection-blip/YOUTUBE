#!/usr/bin/env node
/**
 * MOTION metrics over a rendered frame RANGE — the moving counterpart to
 * inspect-anchors.mjs, which measures single anchor frames.
 *
 * WHY THIS EXISTS
 *
 * The `mograph-critic` skill prescribes a deterministic frame check as the
 * first step of every QA loop and names the numbers it wants, but the
 * script it refers to (`scripts/qa_frames.py`) is not shipped with the
 * skill — only SKILL.md is. This is that check, written against what this
 * repo actually has: Remotion `renderFrames` for the frames and the repo's
 * own `decode-png.js` for the pixels, so it needs no Python and no image
 * library, and it reuses inspect-anchors' exact ink definition (corner-
 * sampled background, threshold 26/255) so the two tools' numbers are
 * comparable.
 *
 * WHAT IT MEASURES, AND WHY
 *
 *   velocity_linearity — the skill's headline metric. Velocity UNIFORMITY
 *     of the ink centroid across a moving span: 1.0 means the content
 *     travels at perfectly constant speed, which is the single strongest
 *     "machine-generated" tell. A real ease-out lands ~0.1-0.4. The skill
 *     calls >= 0.80 a hard defect.
 *   holds — runs of frames where nothing changes. A dead hold over 0.5s in
 *     a Short is a defect; something should be settling or breathing.
 *   popcorn — frames where ink jumps abruptly, i.e. several things entering
 *     together instead of staggered.
 *   subject_drift — how far the ink centroid wanders from frame centre. A
 *     camera move that "makes sense" keeps its subject framed; one that
 *     does not lets the subject slide toward an edge while the camera
 *     travels on its own timetable. This is the number that tells the
 *     difference, rather than an opinion about the move.
 *   margin — ink outside the safe area (9% l/r, 10% top, 20% bottom; the
 *     bottom band is large because YouTube's UI covers it).
 *
 * These are DIAGNOSTICS, not a gate. A frame can score well and still look
 * wrong — looking at the PNGs remains the acceptance test. They exist so
 * "it looks robotic" becomes a number that can be moved and shown.
 *
 * Usage:
 *   node qa-scripts/motion-metrics.mjs <script.json> <srt> <channel-id> \
 *        <out-dir> [--from=0] [--to=600] [--scale=0.4] [--every=2]
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderFrames } from "@remotion/renderer";
import { buildMgPackage } from "../compositions/mg-package.js";
import { chunkTextClauseAware } from "../compositions/beats.js";
import { paletteFromHues } from "../styles/tokens.js";
import { narrationSections } from "../../../utils/script-narration.js";
import { findChrome } from "../find-chrome.js";
import { decodePNG } from "../decode-png.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);
const [scriptPath, srtPath, channelId, outDir] = args.filter((a) => !a.startsWith("--"));
if (!scriptPath || !srtPath || !channelId || !outDir) {
  console.error(
    "Usage: node qa-scripts/motion-metrics.mjs <script.json> <srt> <channel-id> <out-dir> [--from=0] [--to=600] [--scale=0.4] [--every=2]"
  );
  process.exit(1);
}
const FROM = parseInt(flags.from ?? "0", 10);
const TO = parseInt(flags.to ?? "600", 10);
const SCALE = parseFloat(flags.scale ?? "0.4");
const EVERY = parseInt(flags.every ?? "2", 10);

const channels = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
const channel = (channels.channels || channels).find(
  (c) => String(c.id) === String(channelId) || c.channel_id === channelId
);
if (!channel) throw new Error(`channel ${channelId} not found`);

const script = JSON.parse(readFileSync(scriptPath, "utf-8"));
const srtText = readFileSync(srtPath, "utf-8");

const sections = narrationSections(script)
  .filter((s) => s.voiceover && s.voiceover.trim())
  .map((s) => ({
    id: s.id,
    timing: s.timing,
    voiceover: s.voiceover,
    content: chunkTextClauseAware(s.voiceover),
    sfxCue: s.sfx_cue || null,
    bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
    beats: Array.isArray(s.beats) ? s.beats : null,
  }));

const mg = buildMgPackage(srtText, {
  sections,
  hook: script.hook || null,
  channel,
  iconMap: channel.icon_map || null,
  bRollFiles: [],
  imageForSection: () => null,
});

const palette =
  typeof channel.thumbnail_spec?.accentHue === "number"
    ? paletteFromHues({ accentHue: channel.thumbnail_spec.accentHue, bgMode: channel.bg_mode })
    : null;

const props = {
  channelId: channel.channel_id,
  style: channel.style,
  format: "shorts",
  sections,
  mg,
  ttsAudioPath: null,
  hasUnderscore: false,
  thumbnailStyle: channel.thumbnail_spec?.style || "dramatic-visual",
  tone: channel.tone,
  font: channel.font || "Inter",
  channelName: channel.channel_name || "",
  palette,
  showCaptions: false,
};

const framesDir = join(outDir, "frames");
mkdirSync(framesDir, { recursive: true });
// Stale frames from a previous run would be silently mixed into the
// measurement, which is the kind of thing that makes a before/after
// comparison quietly meaningless.
for (const f of readdirSync(framesDir)) rmSync(join(framesDir, f));

const CHROME = findChrome();
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
const composition = await selectComposition({
  serveUrl,
  id: "MotionGraphicsShorts",
  inputProps: props,
  ...(CHROME ? { browserExecutable: CHROME } : {}),
});

const to = Math.min(TO, mg.totalFrames - 1);
console.log(`rendering frames ${FROM}-${to} at scale ${SCALE} (every ${EVERY})`);

await renderFrames({
  composition: { ...composition, durationInFrames: mg.totalFrames },
  serveUrl,
  inputProps: props,
  outputDir: framesDir,
  imageFormat: "png",
  frameRange: [FROM, to],
  scale: SCALE,
  concurrency: 2,
  chromiumOptions: { gl: "swangle" },
  timeoutInMilliseconds: 120000,
  onFrameUpdate: () => {},
  onStart: () => {},
  ...(CHROME ? { browserExecutable: CHROME } : {}),
});

// ── measurement ─────────────────────────────────────────────────────────

/** Ink mask stats. Identical definition to qa-scripts/inspect-anchors.mjs. */
function measure(pngPath) {
  const { width, height, data, channels: ch } = decodePNG(pngPath);
  const px = (x, y) => {
    const i = (y * width + x) * ch;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const corners = [px(4, 4), px(width - 5, 4), px(4, height - 5), px(width - 5, height - 5)];
  const bg = [0, 1, 2].map((c) => corners.reduce((a, p) => a + p[c], 0) / corners.length);
  const T = 26;
  let n = 0, sx = 0, sy = 0, outside = 0;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  // Safe area as FRACTIONS, so it holds at any render scale.
  const L = width * 0.09, R = width * 0.91, TOP = height * 0.10, BOT = height * 0.80;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const p = px(x, y);
      const d = Math.max(Math.abs(p[0] - bg[0]), Math.abs(p[1] - bg[1]), Math.abs(p[2] - bg[2]));
      if (d < T) continue;
      n++; sx += x; sy += y;
      if (x < L || x > R || y < TOP || y > BOT) outside++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const sampled = Math.ceil(width / 2) * Math.ceil(height / 2);
  if (n === 0) return { ink: 0, cx: null, cy: null, bboxW: 0, bboxH: 0, outside: 0, empty: true };
  return {
    ink: n / sampled,
    cx: sx / n / width,
    cy: sy / n / height,
    bboxW: (maxX - minX) / width,
    bboxH: (maxY - minY) / height,
    outside: outside / n,
    empty: false,
  };
}

const files = readdirSync(framesDir)
  .filter((f) => f.endsWith(".png"))
  .sort();
const samples = [];
for (let i = 0; i < files.length; i += EVERY) {
  const m = measure(join(framesDir, files[i]));
  samples.push({ frame: FROM + i, ...m });
}

/**
 * Velocity uniformity over spans where the centroid is actually moving.
 *
 * Uniformity = 1 - (stddev(speed) / mean(speed)), clamped to 0..1. Constant
 * speed gives stddev 0 -> 1.0. An ease-out spends most of its distance at
 * high speed and its last frames barely moving, so its speeds vary widely
 * and it scores low, which is the direction this repo wants.
 */
function spans(samples) {
  const speeds = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (a.empty || b.empty) { speeds.push(null); continue; }
    speeds.push(Math.hypot((b.cx - a.cx) * 1080, (b.cy - a.cy) * 1920) / (b.frame - a.frame));
  }
  // A span is a run of consecutive frames with real movement.
  const MOVING = 0.6; // px/frame at full-res scale; below this is a hold
  const out = [];
  let cur = null;
  for (let i = 0; i < speeds.length; i++) {
    const s = speeds[i];
    if (s != null && s > MOVING) {
      if (!cur) cur = { from: samples[i].frame, speeds: [] };
      cur.speeds.push(s);
    } else if (cur) {
      cur.to = samples[i].frame;
      if (cur.speeds.length >= 4) out.push(cur);
      cur = null;
    }
  }
  if (cur && cur.speeds.length >= 4) { cur.to = samples[samples.length - 1].frame; out.push(cur); }
  return out.map((sp) => {
    const mean = sp.speeds.reduce((a, b) => a + b, 0) / sp.speeds.length;
    const sd = Math.sqrt(sp.speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / sp.speeds.length);
    return {
      from: sp.from,
      to: sp.to,
      frames: sp.speeds.length * EVERY,
      mean_speed_px_per_frame: +mean.toFixed(2),
      velocity_linearity: +Math.max(0, Math.min(1, 1 - sd / (mean || 1))).toFixed(3),
    };
  });
}

/** Runs of frames where the picture does not change at all. */
function holds(samples) {
  const out = [];
  let start = null;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    const still =
      !a.empty && !b.empty &&
      Math.abs(a.ink - b.ink) < 0.0004 &&
      Math.hypot((b.cx - a.cx) * 1080, (b.cy - a.cy) * 1920) < 0.6;
    if (still) { if (start == null) start = a.frame; }
    else if (start != null) {
      if (samples[i - 1].frame - start >= 15) out.push({ from: start, to: samples[i - 1].frame });
      start = null;
    }
  }
  if (start != null && samples[samples.length - 1].frame - start >= 15) {
    out.push({ from: start, to: samples[samples.length - 1].frame });
  }
  return out;
}

/** Frames where a lot of ink appears at once — several things entering together. */
function popcorn(samples) {
  const out = [];
  for (let i = 1; i < samples.length; i++) {
    const d = samples[i].ink - samples[i - 1].ink;
    if (d > 0.012) out.push({ frame: samples[i].frame, ink_jump: +d.toFixed(4) });
  }
  return out;
}

const inked = samples.filter((s) => !s.empty);
const moving = spans(samples);
const worst = moving.reduce((a, b) => (b.velocity_linearity > (a?.velocity_linearity ?? -1) ? b : a), null);

const report = {
  script: script.topic_slug || "clip",
  channel: channel.channel_id,
  range: [FROM, to],
  scale: SCALE,
  frames_sampled: samples.length,
  ink: {
    mean: +(inked.reduce((a, s) => a + s.ink, 0) / (inked.length || 1)).toFixed(4),
    min: +Math.min(...inked.map((s) => s.ink)).toFixed(4),
    max: +Math.max(...inked.map((s) => s.ink)).toFixed(4),
    // The audit line this repo already uses: under 5% is a hairline
    // diagram floating in a void.
    frames_under_5pct: inked.filter((s) => s.ink < 0.05).length,
  },
  empty_frames: samples.filter((s) => s.empty).length,
  centroid: {
    mean_cx: +(inked.reduce((a, s) => a + s.cx, 0) / (inked.length || 1)).toFixed(3),
    mean_cy: +(inked.reduce((a, s) => a + s.cy, 0) / (inked.length || 1)).toFixed(3),
    // How far the subject wanders from centre — the camera-follows-subject
    // number. Large values mean the frame travelled somewhere its content
    // did not.
    max_abs_dx: +Math.max(...inked.map((s) => Math.abs(s.cx - 0.5))).toFixed(3),
    max_abs_dy: +Math.max(...inked.map((s) => Math.abs(s.cy - 0.5))).toFixed(3),
  },
  margin: {
    mean_ink_outside_safe: +(inked.reduce((a, s) => a + s.outside, 0) / (inked.length || 1)).toFixed(4),
    frames_over_2pct_outside: inked.filter((s) => s.outside > 0.02).length,
  },
  motion: {
    moving_spans: moving.length,
    worst_velocity_linearity: worst ? worst.velocity_linearity : null,
    hard_defects_over_0_80: moving.filter((m) => m.velocity_linearity >= 0.8).length,
    spans: moving,
  },
  holds: holds(samples),
  popcorn: popcorn(samples),
};

mkdirSync(outDir, { recursive: true });
const reportPath = join(outDir, "motion-report.json");
writeFileSync(reportPath, JSON.stringify({ ...report, samples }, null, 2));

console.log("");
console.log(`ink        mean ${(report.ink.mean * 100).toFixed(1)}%  min ${(report.ink.min * 100).toFixed(1)}%  max ${(report.ink.max * 100).toFixed(1)}%   under-5%: ${report.ink.frames_under_5pct}/${inked.length} frames`);
console.log(`centroid   cx ${report.centroid.mean_cx}  cy ${report.centroid.mean_cy}   max drift dx ${report.centroid.max_abs_dx} dy ${report.centroid.max_abs_dy}`);
console.log(`margin     ${(report.margin.mean_ink_outside_safe * 100).toFixed(2)}% of ink outside safe area, ${report.margin.frames_over_2pct_outside} frames over 2%`);
console.log(`motion     ${report.motion.moving_spans} moving spans, worst velocity_linearity ${report.motion.worst_velocity_linearity}, hard defects (>=0.80): ${report.motion.hard_defects_over_0_80}`);
for (const s of moving) {
  const flag = s.velocity_linearity >= 0.8 ? "  <-- HARD DEFECT" : "";
  console.log(`           f${s.from}-${s.to} (${s.frames}f) speed ${s.mean_speed_px_per_frame}px/f  linearity ${s.velocity_linearity}${flag}`);
}
console.log(`holds      ${report.holds.length} dead holds >0.5s ${report.holds.map((h) => `f${h.from}-${h.to}`).join(" ")}`);
console.log(`popcorn    ${report.popcorn.length} simultaneous-entry frames`);
console.log("");
console.log(`report -> ${reportPath}`);
