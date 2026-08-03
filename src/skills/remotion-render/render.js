/**
 * Remotion Render — Main entry point for rendering videos.
 *
 * Usage:
 *   node render.js shorts <channel-id> <script-path> <tts-audio-path>
 *   node render.js longform <channel-id> <script-path> <tts-audio-path>
 *
 * script-path may be a JSON script (script-writer output) or a markdown
 * script (## Section (timing) + lines). The voiceover audio is copied to
 * ./vo.mp3 and pulled in via a static import so Remotion bundles it.
 *
 * Props (sections, style flags) are baked into the generated entry file as
 * Composition `defaultProps` because passing input props via --props /
 * inputProps does not reach the component in the installed Remotion 4.0.0.
 *
 * Duration is derived from the measured voiceover length (ffprobe) when the
 * audio file is available, falling back to a word-count estimate otherwise,
 * then clamped to the Short (15–180s) or longform range.
 */

import { readFileSync, mkdirSync, existsSync, copyFileSync, writeFileSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createRequire } from "module";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { resolveBrollFiles } from "./broll.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const require = createRequire(import.meta.url);
const compositorPkg = require.resolve("@remotion/compositor-win32-x64-msvc/package.json");
const FFPROBE = findFFprobe();

function findFFprobe() {
  const candidates = [
    join(dirname(compositorPkg), "ffprobe.exe"),
    join(ROOT, "node_modules", "@remotion", "compositor-win32-x64-msvc", "ffprobe.exe"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "ffprobe";
}

const WPM = {
  "cinematic-documentary": 135,
  minimal: 165,
  "motion-graphics": 155,
};

// Shorts: 15s minimum, 180s maximum (YouTube Shorts ceiling per shorts.js spec).
// Long-form: 2–12 minutes.
const SHORTS_CLAMP = [15 * 30, 180 * 30]; // frames
const LONGFORM_CLAMP = [2 * 30 * 60, 12 * 30 * 60];

// Tail padding added after the voiceover so the final word is never cut.
const AUDIO_TAIL_FRAMES = 12; // 0.4s at 30fps

const COMPONENT_FILES = {
  "cinematic-documentary": "cinematic-documentary.jsx",
  minimal: "minimal.jsx",
  "motion-graphics": "motion-graphics.jsx",
};

function loadChannel(channelId) {
  const channelsPath = join(ROOT, "config", "channels.json");
  const channels = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channel = (channels.channels || channels).find((c) => c.channel_id === channelId);
  if (!channel) throw new Error(`Channel "${channelId}" not found`);
  return channel;
}

function loadScript(scriptPath) {
  const fullPath = join(ROOT, scriptPath.replace(/\//g, "\\"));
  if (extname(fullPath).toLowerCase() === ".json") {
    return JSON.parse(readFileSync(fullPath, "utf-8"));
  }
  return parseMarkdown(readFileSync(fullPath, "utf-8"));
}

function parseMarkdown(content) {
  const sections = [];
  const lines = content.split("\n");
  let current = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*\((.+?)\)/);
    if (m) {
      if (current) sections.push(current);
      current = { id: m[1].toLowerCase().replace(/\s+/g, "_"), timing: m[2], voiceover: "", content: [] };
      continue;
    }
    if (current && line.trim() && !line.startsWith("#")) {
      current.content.push(line.trim());
    }
  }
  if (current) sections.push(current);
  return { sections };
}

function chunkVoiceover(text, maxWords = 7) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

function toContentSections(script) {
  const sections = script.sections || [];
  if (sections.length === 0) return [];
  return sections
    .filter((s) => s.voiceover && s.voiceover.trim())
    .map((s) => ({
      id: s.id,
      timing: s.timing,
      voiceover: s.voiceover,
      content: chunkVoiceover(s.voiceover),
      visualCue: s.visual_cue || null,
      sfxCue: s.sfx_cue || null,
      bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
      textOverlay: s.text_overlay || null,
      transitionOut: s.transition_out || null,
    }));
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function getAudioDurationSeconds(audioPath) {
  const fullPath = join(ROOT, audioPath.replace(/\//g, "\\"));
  if (!existsSync(fullPath)) return null;
  try {
    const out = execSync(
      `"${FFPROBE}" -v error -show_entries format=duration -of csv=p=0 "${fullPath}"`,
      { stdio: "pipe", timeout: 30000 }
    ).toString().trim();
    const secs = parseFloat(out);
    return Number.isFinite(secs) && secs > 0 ? secs : null;
  } catch {
    return null;
  }
}

function computeDurationFrames(script, style, format, audioPath) {
  const clamp = format === "shorts" ? SHORTS_CLAMP : LONGFORM_CLAMP;
  const fps = 30;

  // Prefer the real voiceover length so audio is never truncated.
  const audioSeconds = audioPath ? getAudioDurationSeconds(audioPath) : null;
  let frames = null;
  if (audioSeconds) {
    frames = Math.round(audioSeconds * fps) + AUDIO_TAIL_FRAMES;
    console.log(`Voiceover duration: ${audioSeconds.toFixed(2)}s`);
  }

  // Fallback: estimate from word count if the audio couldn't be measured.
  if (!frames) {
    const voiceover = (script.sections || []).map((s) => s.voiceover || "").join(" ");
    const wpm = WPM[style] || 150;
    const seconds = Math.max((wordCount(voiceover) / wpm) * 60, 10);
    frames = Math.round(seconds * fps);
    console.warn(`Could not measure voiceover audio — estimated ${seconds.toFixed(1)}s from word count.`);
  }

  const clamped = Math.max(clamp[0], Math.min(clamp[1], frames));
  if (clamped < frames) {
    console.warn(
      `WARNING: video clamped from ${(frames / fps).toFixed(1)}s to ${(clamped / fps).toFixed(1)}s ` +
        `(${((frames - clamped) / fps).toFixed(1)}s of the voiceover will be cut)` +
        ` — shorten the script for ${format} to keep the full ending.`
    );
  }
  return clamped;
}

function getCompositionForStyle(style, format) {
  const compositions = {
    "cinematic-documentary": { shorts: "CinematicDocumentaryShorts", longform: "CinematicDocumentaryLongform" },
    minimal: { shorts: "MinimalShorts", longform: "MinimalLongform" },
    "motion-graphics": { shorts: "MotionGraphicsShorts", longform: "MotionGraphicsLongform" },
  };
  return compositions[style]?.[format] || "MinimalLongform";
}

function stageAudio(ttsAudioPath) {
  const target = join(__dirname, "vo.mp3");
  if (!ttsAudioPath) {
    throw new Error(
      "No voiceover audio provided. Refusing to render a silent video — " +
        "run `node src/utils/tts.js <channel-id> <script>` first."
    );
  }
  const src = join(ROOT, ttsAudioPath.replace(/\//g, "\\"));
  if (!existsSync(src)) {
    throw new Error(
      `Voiceover audio not found: ${ttsAudioPath}. Refusing to render a silent video.`
    );
  }
  copyFileSync(src, target);
  return true;
}

function writeRenderEntry(componentId, componentFile, props, frames, format) {
  const isShorts = format === "shorts";
  const entryPath = join(__dirname, "render-entry.jsx");
  const defaults = JSON.stringify(props, null, 2).replace(/</g, "\\u003c");
  const entry = `import React from "react";
import { Composition, registerRoot } from "remotion";
import { ${componentId} } from "./compositions/${componentFile}";

const DEFAULTS = ${defaults};

const Root = () => (
  <Composition
    id="RenderComp"
    component={${componentId}}
    durationInFrames={${frames}}
    fps={30}
    width={${isShorts ? 1080 : 1920}}
    height={${isShorts ? 1920 : 1080}}
    defaultProps={DEFAULTS}
  />
);

registerRoot(Root);
`;
  writeFileSync(entryPath, entry, "utf-8");
  return entryPath;
}

async function renderVideo(entryPath, outputPath, frames) {
  const serveUrl = await bundle({ entryPoint: entryPath, onProgress: () => {} });
  const composition = await selectComposition({
    serveUrl,
    id: "RenderComp",
    browserExecutable: CHROME,
  });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    audioCodec: "aac",
    enforceAudioTrack: true,
    outputLocation: outputPath,
    browserExecutable: CHROME,
    concurrency: 2,
  });
  console.log("Rendered:", outputPath);
}

async function main() {
  const [format, channelId, scriptPath, ttsAudioPath] = process.argv.slice(2);

  if (!format || !channelId || !scriptPath) {
    console.error("Usage: node render.js <shorts|longform> <channel-id> <script-path> [tts-audio-path]");
    process.exit(1);
  }

  const channel = loadChannel(channelId);
  const script = loadScript(scriptPath);
  const sections = toContentSections(script);

  if (sections.length === 0) {
    console.error("Script has no voiceover sections — nothing to render.");
    process.exit(1);
  }

  for (const section of sections) {
    section.bRollFiles = resolveBrollFiles(section.bRoll || [], channelId);
  }
  const withBroll = sections.filter((s) => (s.bRollFiles || []).length > 0).length;
  console.log(`B-roll: ${withBroll}/${sections.length} sections have real imagery`);

  const componentId = getCompositionForStyle(channel.style, format);
  const componentFile = COMPONENT_FILES[channel.style] || "minimal.jsx";
  const staged = stageAudio(ttsAudioPath);
  const frames = computeDurationFrames(script, channel.style, format, ttsAudioPath);

  const outputDir = join(ROOT, "data", "renders", channelId);
  mkdirSync(outputDir, { recursive: true });

  const slug = basename(scriptPath, extname(scriptPath)).replace(/-script$/, "");
  const timestamp = new Date().toISOString().slice(0, 10);
  const outputPath = join(outputDir, `${slug}-${format}-${timestamp}.mp4`);

  const props = {
    channelId: channel.channel_id,
    style: channel.style,
    format: format,
    sections,
    ttsAudioPath: staged,
    thumbnailStyle: channel.thumbnail_spec?.style || "dramatic-visual",
    tone: channel.tone,
    font: channel.font || "Inter",
    palette: channel.thumbnail_spec?.color_palette || null,
  };

  console.log(`Rendering: ${componentId} (${frames} frames)`);
  console.log(`Output: ${outputPath}`);

  const entryPath = writeRenderEntry(componentId, componentFile, props, frames, format);
  await renderVideo(entryPath, outputPath, frames);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
