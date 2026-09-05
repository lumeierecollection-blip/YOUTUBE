#!/usr/bin/env node
/**
 * Render a SHORT CLIP of one beat's visual, for looking at.
 *
 * Usage:
 *   node qa-scripts/render-clip.mjs <script.json> <srt> <channel-id> [strategy] [scale]
 *
 * Renders only the frame range covering the first beat that planned the
 * named strategy (default: the first beat of the video), instead of the
 * whole video. A full Short is 1000-1700 frames and takes 10-15 minutes;
 * one beat is usually 100-300 frames and takes a couple.
 *
 * Lives inside src/skills/remotion-render/ for the same reason
 * qa-render-motion.mjs does: its bare `@remotion/*` imports must resolve
 * against THIS subpackage's node_modules, not the repo root's.
 *
 * Uses the real buildMgPackage + the real MotionGraphicsShorts composition,
 * so what comes out is genuine production output, just trimmed.
 */
import { mkdirSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { buildMgPackage } from "../compositions/mg-package.js";
import { chunkTextClauseAware } from "../compositions/beats.js";
import { paletteFromHues } from "../styles/tokens.js";
import { narrationSections } from "../../../utils/script-narration.js";
import { findChrome } from "../find-chrome.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");

const argv = process.argv.filter((a) => a !== "--captions");
const [, , scriptPath, srtPath, channelId, wantStrategy, scaleArg] = argv;
if (!scriptPath || !srtPath || !channelId) {
  console.error("Usage: node qa-scripts/render-clip.mjs <script.json> <srt> <channel-id> [strategy] [scale] [--captions]");
  process.exit(1);
}
const scale = scaleArg ? parseFloat(scaleArg) : 0.5;

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
  bRollFiles: [],
  imageForSection: () => null,
});

// Fixed-length demo clip: first ~20s of the render (600 frames @ 30fps),
// spanning several beats back to back, instead of a single isolated beat.
const from = 0;
const to = Math.min(600, mg.totalFrames - 1);
const staged = mg.beats.filter((b) => b.archetype !== "LIST_ITEM" && b.startFrame < to);

console.log(`clip: demo  frames ${from}-${to}  (${((to - from) / 30).toFixed(1)}s)`);
console.log(`beats: ${staged.map((b) => b.visualPlan && b.visualPlan.strategy).join(" > ")}`);

const palette =
  typeof channel.thumbnail_spec?.accentHue === "number"
    ? paletteFromHues({ accentHue: channel.thumbnail_spec.accentHue, bgMode: channel.bg_mode, accent: (channel.colors || {}).accent })
    : null;

const props = {
  channelId: channel.channel_id,
  style: channel.style,
  format: "shorts",
  sections,
  mg,
  // No <Audio> in a clip: the VO track is a whole-video asset and this is a
  // slice of it, so playing it would desync. Silent by design.
  ttsAudioPath: null,
  hasUnderscore: false,
  thumbnailStyle: channel.thumbnail_spec?.style || "dramatic-visual",
  tone: channel.tone,
  font: channel.font || "Inter",
  channelName: channel.channel_name || "",
  palette,
  // Narration captions are off in production unless a channel opts in
  // (render.js: channel.captions === "burned-in"). `--captions` forces them
  // on here so the preserved accessibility path can actually be rendered and
  // looked at, rather than only asserted to still exist.
  showCaptions: process.argv.includes("--captions") || channel.captions === "burned-in",
};

const OUT_DIR = join(ROOT, "data", "renders", "clips");
mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(
  OUT_DIR,
  `${script.topic_slug || "clip"}-demo20s${process.argv.includes("--captions") ? "-captions" : ""}.mp4`
);

const CHROME = findChrome();
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
const composition = await selectComposition({
  serveUrl,
  id: "MotionGraphicsShorts",
  inputProps: props,
  ...(CHROME ? { browserExecutable: CHROME } : {}),
});

await renderMedia({
  composition: { ...composition, durationInFrames: mg.totalFrames },
  serveUrl,
  codec: "h264",
  inputProps: props,
  outputLocation: outPath,
  frameRange: [from, to],
  imageFormat: "png",
  crf: 20,
  pixelFormat: "yuv420p",
  chromiumOptions: { gl: "swangle" },
  concurrency: 2,
  scale,
  timeoutInMilliseconds: 120000,
  ...(CHROME ? { browserExecutable: CHROME } : {}),
});

console.log("Rendered clip:", outPath);
