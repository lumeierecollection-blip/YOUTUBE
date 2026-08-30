#!/usr/bin/env node
/**
 * Stage-16 single-frame renderer.
 *
 * The half-scale ch-01 render (render-ch01-half, PID 9980) produced 2193/2194
 * element-*.png frames, with element-0063.png missing, and the compositor's
 * encode stage then hung (remotion.exe at 0 CPU, no ffmpeg child, no mp4,
 * 8h+ with zero progress). Relaunching the full render does not help — the
 * same flaky one-frame drop already happened on the stage-14 half-scale run
 * (element-0113.png missing there).
 *
 * This renders exactly the one dropped frame index through the real
 * production pipeline — same Root.jsx bundle, same selectComposition id
 * (MotionGraphicsShorts), same inputProps object render.js builds
 * (render.js main() lines 481-511), same swangle software GL, same scale —
 * so the resulting PNG is the frame the compositor failed to write. The
 * output mp4 is then assembled from the pipeline's PNG frames with ffmpeg
 * because renderMedia's own mux step is what hangs on this machine.
 *
 * Usage:
 *   node data/audit/16/render-frame.mjs <channel-id> <script-path> <tts-audio-path> <frame-index> <out-png>
 */
import { readFileSync, existsSync, copyFileSync, writeFileSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { bundle } from "../../../src/skills/remotion-render/node_modules/@remotion/bundler/dist/index.js";
import { selectComposition, renderMedia } from "../../../src/skills/remotion-render/node_modules/@remotion/renderer/dist/esm/index.mjs";
import { findChrome } from "../../../src/skills/remotion-render/find-chrome.js";
import { resolveImageAssets } from "../../../src/skills/remotion-render/image-assets.js";
import { buildMgPackage } from "../../../src/skills/remotion-render/compositions/mg-package.js";
import { chunkTextClauseAware } from "../../../src/skills/remotion-render/compositions/beats.js";
import { paletteFromHues } from "../../../src/skills/remotion-render/styles/tokens.js";
import { narrationSections } from "../../../src/utils/script-narration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");
const RENDER_DIR = join(ROOT, "src", "skills", "remotion-render");

const CHROME = findChrome();

function loadChannel(channelId) {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  const channel = channels.find((c) => c.id === numId || c.channel_id === channelId);
  if (!channel) throw new Error(`Channel "${channelId}" not found`);
  return channel;
}

function loadScript(scriptPath) {
  const fullPath = join(ROOT, ...scriptPath.split(/[\/\\]/));
  return JSON.parse(readFileSync(fullPath, "utf-8"));
}

// Mirror of render.js toContentSections() (lines 137-167).
function toContentSections(script) {
  const sections = narrationSections(script);
  if (sections.length === 0) return [];
  return sections
    .filter((s) => s.voiceover && s.voiceover.trim())
    .map((s) => ({
      id: s.id,
      timing: s.timing,
      voiceover: s.voiceover,
      content: chunkTextClauseAware(s.voiceover),
      visualCue: s.visual_cue || null,
      bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
      textOverlay: s.text_overlay || null,
      animationCue: s.animation_cue || null,
      transitionOut: s.transition_out || null,
      beats: Array.isArray(s.beats) ? s.beats : null,
    }));
}

function findSrtPath(ttsAudioPath) {
  const full = join(ROOT, ...ttsAudioPath.split(/[\/\\]/));
  const dir = dirname(full);
  const base = basename(full).replace(/\.[^.]+$/, "");
  const exact = join(dir, `${base}.srt`);
  return existsSync(exact) ? exact : null;
}

async function main() {
  const [channelId, scriptPath, ttsAudioPath, frameArg, outPng, scaleArg] = process.argv.slice(2);
  if (!channelId || !scriptPath || !ttsAudioPath || !frameArg || !outPng) {
    console.error("usage: node data/audit/16/render-frame.mjs <channel-id> <script> <tts-audio> <frame-index> <out-png> [scale]");
    process.exit(1);
  }
  const frameIndex = parseInt(frameArg, 10);
  const scale = scaleArg ? parseFloat(scaleArg) : 0.5;

  const channel = loadChannel(channelId);
  const script = loadScript(scriptPath);
  const sections = toContentSections(script);

  // Same b-roll resolution render.js main() does (keyed by channel.channel_id).
  for (const section of sections) {
    section.bRollFiles = resolveImageAssets(section.bRoll || [], channel.channel_id, script.topic_slug);
  }

  // Mirror render.js: stage audio to vo.mp3, build the mg package with the
  // exact same options (render.js main() lines 349-397).
  copyFileSync(join(ROOT, ...ttsAudioPath.split(/[\/\\]/)), join(RENDER_DIR, "vo.mp3"));
  const srtPath = findSrtPath(ttsAudioPath);
  const srtText = srtPath ? readFileSync(srtPath, "utf-8") : "";
  const audioSecs = (() => {
    const full = join(ROOT, ...ttsAudioPath.split(/[\/\\]/));
    try {
      const out = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${full}"`, { stdio: "pipe", timeout: 30000 }).toString().trim();
      const secs = parseFloat(out);
      return Number.isFinite(secs) && secs > 0 ? secs : null;
    } catch {
      return null;
    }
  })();
  const mg = buildMgPackage(srtText, {
    sections,
    hook: script.hook || null,
    channel,
    iconMap: channel.icon_map || null,
    bRollFiles: sections.flatMap((s) => s.bRollFiles || []),
    imageForSection: (idx) => (sections[idx] && sections[idx].bRollFiles && sections[idx].bRollFiles[0]) || null,
    totalMs: audioSecs ? audioSecs * 1000 : undefined,
    revealPlacement: channel.script_template && channel.script_template.reveal_placement,
    silenceTechnique: channel.sfx_profile && channel.sfx_profile.silence_technique,
  });

  // Mirror render.js props construction (lines 481-511).
  const hasUnderscore = existsSync(join(RENDER_DIR, "public", "music", "underscore.mp3"));
  const props = {
    channelId: channel.channel_id,
    style: channel.style,
    format: "shorts",
    sections,
    mg,
    sectionWindows: null,
    showCaptions: channel.captions === "burned-in",
    ttsAudioPath: true, // stageAudio() returned true in render.js
    hasUnderscore,
    thumbnailStyle: channel.thumbnail_spec?.style || "dramatic-visual",
    tone: channel.tone,
    font: channel.font || "Inter",
    channelName: channel.channel_name || "",
    palette:
      typeof channel.thumbnail_spec?.accentHue === "number"
        ? paletteFromHues({ accentHue: channel.thumbnail_spec.accentHue, bgMode: channel.bg_mode })
        : null,
  };

  const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
  const composition = await selectComposition({
    serveUrl,
    id: "MotionGraphicsShorts",
    inputProps: props,
    ...(CHROME ? { browserExecutable: CHROME } : {}),
  });

  // codec "png" is not a renderMedia codec in 4.0.x — render the single
  // frame as a 1-frame h264 mp4 (qa-sample.js's proven path) and extract.
  const tmpMp4 = outPng.replace(/\.png$/i, ".tmp.mp4");
  // Mirror render.js: override durationInFrames with the package total so a
  // frame at any index (incl. past the composition's default 1800) evaluates
  // in the same timing context as the real render.
  await renderMedia({
    composition: { ...composition, durationInFrames: mg.totalFrames },
    serveUrl,
    codec: "h264",
    crf: 12,
    imageFormat: "png",
    pixelFormat: "yuv420p",
    inputProps: props,
    frameRange: [frameIndex, frameIndex],
    outputLocation: tmpMp4,
    scale,
    chromiumOptions: { gl: "swangle" },
    concurrency: 1,
    timeoutInMilliseconds: 120000,
    ...(CHROME ? { browserExecutable: CHROME } : {}),
  });
  execSync(`ffmpeg -y -i "${tmpMp4}" -frames:v 1 "${outPng}"`, { stdio: "pipe" });

  console.log(`Frame ${frameIndex} -> ${outPng}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});