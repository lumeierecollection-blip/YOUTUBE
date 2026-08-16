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
 * Props are passed via `inputProps` to both `selectComposition()` and
 * `renderMedia()` (verified on Remotion 4.0.505). The exact frame count is
 * applied by overriding `durationInFrames` on the selected composition object,
 * so the fixed caps in Root.jsx are never rendered as dead tail.
 *
 * Duration is derived from the measured voiceover length (ffprobe) when the
 * audio file is available, falling back to a word-count estimate otherwise,
 * then clamped to the Short (15–180s) or longform range.
 *
 * For motion-graphics channels the SRT next to the voiceover is the timing
 * source of truth: buildMgPackage() bakes beats/pages/scenes into the `mg`
 * prop and the duration comes from the package (never from the mp3 length).
 */

import { readFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createRequire } from "module";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { resolveImageAssets } from "./image-assets.js";
import { buildMgPackage } from "./compositions/mg-package.js";
import { chunkTextClauseAware } from "./compositions/beats.js";
import { paletteFromHues } from "./styles/tokens.js";
import { narrationSections } from "../../utils/script-narration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");

const require = createRequire(import.meta.url);

// Resolves a ROOT-relative path regardless of whether it was written with
// "/" or "\\" separators (scripts/CI on Linux vs. local dev on Windows).
function resolveRelative(relPath) {
  return join(ROOT, ...relPath.split(/[\/\\]/));
}

function compositorPackageName() {
  if (process.platform === "win32") return "@remotion/compositor-win32-x64-msvc";
  if (process.platform === "darwin") return process.arch === "arm64" ? "@remotion/compositor-darwin-arm64" : "@remotion/compositor-darwin-x64";
  return process.arch === "arm64" ? "@remotion/compositor-linux-arm64-gnu" : "@remotion/compositor-linux-x64-gnu";
}

function findFFprobe() {
  const binName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  try {
    const compositorPkg = require.resolve(`${compositorPackageName()}/package.json`);
    const candidate = join(dirname(compositorPkg), binName);
    if (existsSync(candidate)) return candidate;
  } catch {}
  return "ffprobe";
}

// Finds a usable Chrome/Chromium binary. Explicit env override first, then
// platform-typical install locations, then the sandboxed Playwright cache
// this environment pre-installs Chromium into. Returns undefined (rather
// than a bad path) when nothing is found, so Remotion falls back to
// downloading/managing its own Chrome Headless Shell.
function findChrome() {
  if (process.env.REMOTION_CHROME_PATH && existsSync(process.env.REMOTION_CHROME_PATH)) {
    return process.env.REMOTION_CHROME_PATH;
  }
  if (process.platform === "win32") {
    const p = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    return existsSync(p) ? p : undefined;
  }
  if (process.platform === "darwin") {
    const p = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    return existsSync(p) ? p : undefined;
  }
  const candidates = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const pwBase = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pwBase && existsSync(pwBase)) {
    for (const entry of readdirSync(pwBase)) {
      // Prefer chromium_headless_shell: modern Chrome removed "old headless"
      // mode, which is what Remotion's renderer launches with.
      if (entry.startsWith("chromium_headless_shell-")) {
        const p = join(pwBase, entry, "chrome-linux", "headless_shell");
        if (existsSync(p)) candidates.unshift(p);
      }
      if (entry.startsWith("chromium-")) {
        const p = join(pwBase, entry, "chrome-linux", "chrome");
        if (existsSync(p)) candidates.push(p);
      }
    }
  }
  return candidates.find((p) => existsSync(p));
}

const CHROME = findChrome();
const FFPROBE = findFFprobe();

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

function loadChannel(channelId) {
  const channelsPath = join(ROOT, "config", "channels.json");
  const data = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  const channel = channels.find((c) => c.id === numId || c.channel_id === channelId);
  if (!channel) throw new Error(`Channel "${channelId}" not found`);
  return channel;
}

function loadScript(scriptPath) {
  const fullPath = join(ROOT, ...scriptPath.split(/[\/\\]/));
  const content = readFileSync(fullPath, "utf-8");
  if (scriptPath.endsWith(".json")) {
    try {
      return JSON.parse(content);
    } catch {
      return parseMarkdown(content);
    }
  }
  return parseMarkdown(content);
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

// PART 4.2 of the motion-graphics rebuild: this used to be a blind
// word-count split (DEL-09 / TYP-11 in CHECK-REGISTER.md — a real shipped
// defect: "...found: 1,980 meters below the" stranded an article as the
// last word of a caption). chunkTextClauseAware (beats.js) does the same
// ≤maxWords grouping but repairs any boundary that would orphan an
// article, preposition, conjunction, or a number split from its unit.
function chunkVoiceover(text, maxWords = 7) {
  return chunkTextClauseAware(text, maxWords);
}

function toContentSections(script) {
  // narrationSections() folds the top-level `hook` into section one, matching
  // what tts.js actually narrates. This has to happen here, not just in TTS:
  // motion-graphics section windows are proportional to section word counts
  // (proportionalWindows in compositions/mg-package.js) against the measured
  // audio length, so hook audio that no section accounts for would drift
  // every section's visuals behind its narration for the whole video.
  const sections = narrationSections(script);
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
      animationCue: s.animation_cue || null,
      transitionOut: s.transition_out || null,
    }));
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function getAudioDurationSeconds(audioPath) {
  const fullPath = resolveRelative(audioPath);
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
  const src = resolveRelative(ttsAudioPath);
  if (!existsSync(src)) {
    throw new Error(
      `Voiceover audio not found: ${ttsAudioPath}. Refusing to render a silent video.`
    );
  }
  copyFileSync(src, target);
  return true;
}

/**
 * Motion-graphics — the caption stream is the timing source of truth, so the
 * SRT is found next to the voiceover audio (same dir, same base name, `.srt`).
 * Falls back to the first `.srt` in that directory.
 */
function findSrtPath(ttsAudioPath) {
  if (!ttsAudioPath) return null;
  const dir = dirname(resolveRelative(ttsAudioPath));
  const base = basename(ttsAudioPath).replace(/\.[^.]+$/, "");
  const exact = join(dir, `${base}.srt`);
  // Only ever return the exact match for this audio file. A channel's TTS
  // directory holds SRTs for every topic it has ever narrated — grabbing
  // "any .srt in the folder" would silently attach a different video's
  // captions to this narration. No exact match means no SRT: the caller
  // falls back to synthesizing captions from the script sections instead.
  return existsSync(exact) ? exact : null;
}

async function renderVideo(componentId, outputPath, frames, props, scale) {
  const browserOpts = CHROME ? { browserExecutable: CHROME } : {};
  const serveUrl = await bundle({ entryPoint: join(__dirname, "Root.jsx"), onProgress: () => {} });
  const composition = await selectComposition({
    serveUrl,
    id: componentId,
    inputProps: props,
    ...browserOpts,
  });
  await renderMedia({
    composition: { ...composition, durationInFrames: frames },
    serveUrl,
    codec: "h264",
    audioCodec: "aac",
    enforceAudioTrack: true,
    inputProps: props,
    outputLocation: outputPath,
    ...browserOpts,
    // §5.6 — explicit encoder settings: remotion.config.js is inert on the
    // SSR path, so every quality option must be passed here. gl: "swangle"
    // (--use-gl=angle --use-angle=swiftshader) is the software WebGL2
    // backend Remotion docs prescribe for GPU-less machines - GitHub
    // Actions runners have no GPU, and plain "angle" (hardware) fails there
    // with "Failed to acquire WebGL2 context" on canvas effects, even
    // though it works on local dev machines with a real GPU.
    imageFormat: "png",                 // lossless intermediates
    crf: 16,                            // below the h264 default
    pixelFormat: "yuv420p",             // required for wide playback
    chromiumOptions: { gl: "swangle" }, // software WebGL2 - NOT via the config file
    concurrency: 2,
    scale,
    // Cold-start font fetch (21 families / 42 woff2 over the local static
    // server) can exceed the 28s default delayRender timeout.
    timeoutInMilliseconds: 120000,
  });
  console.log("Rendered:", outputPath);
}

async function main() {
  const [format, channelId, scriptPath, ttsAudioPath, scaleArg] = process.argv.slice(2);
  const scale = scaleArg ? parseFloat(scaleArg) : 1.0;

  if (!format || !channelId || !scriptPath) {
    console.error("Usage: node render.js <shorts|longform> <channel-id> <script-path> [tts-audio-path] [scale]");
    process.exit(1);
  }

  const channel = loadChannel(channelId);
  const script = loadScript(scriptPath);
  const sections = toContentSections(script);

  if (sections.length === 0) {
    console.error("Script has no voiceover sections — nothing to render.");
    process.exit(1);
  }

  // PART 0 of the motion-graphics rebuild — a b-roll manifest is keyed by
  // channel slot, but channels get reused across topics over time (that's
  // exactly how a stale movile-cave manifest under ch-01 nearly leaked
  // deep-sea imagery into a Money Mind budgeting render). Only trust a
  // manifest whose own topic_slug matches the script actually being
  // rendered — see broll.js's loadManifest.
  for (const section of sections) {
    section.bRollFiles = resolveImageAssets(section.bRoll || [], channelId, script.topic_slug);
  }
  const withBroll = sections.filter((s) => (s.bRollFiles || []).length > 0).length;
  console.log(`B-roll: ${withBroll}/${sections.length} sections have real imagery`);

  const componentId = getCompositionForStyle(channel.style, format);
  const staged = stageAudio(ttsAudioPath);

  let mg = null;
  let frames;
  if (channel.style === "motion-graphics") {
    // Timing comes from the SRT caption stream, never from the mp3 duration.
    const srtPath = findSrtPath(ttsAudioPath);
    const srtText = srtPath ? readFileSync(srtPath, "utf-8") : "";
    if (srtPath) console.log("MG SRT:", srtPath);
    else console.warn("MG: no SRT next to voiceover — synthesizing caption stream from sections.");
    const audioSecs = getAudioDurationSeconds(ttsAudioPath);
    mg = buildMgPackage(srtText, {
      sections,
      iconMap: channel.icon_map || null,
      bRollFiles: sections.flatMap((s) => s.bRollFiles || []),
      imageForSection: (idx) => (sections[idx] && sections[idx].bRollFiles && sections[idx].bRollFiles[0]) || null,
      totalMs: audioSecs ? audioSecs * 1000 : undefined,
      // PART 7 — "largest visual move lands at reveal_placement" / "respect
      // sfx_profile.silence_technique". Both are channel-config free text;
      // see markReveal/computeSilenceWindow in mg-package.js for the parse.
      revealPlacement: channel.script_template && channel.script_template.reveal_placement,
      silenceTechnique: channel.sfx_profile && channel.sfx_profile.silence_technique,
    });
    frames = mg.totalFrames;
    console.log(
      `MG package: ${mg.beats.length} beats, ${mg.pages.length} pages, ${mg.totalFrames}f (audio ${mg.audioFrames}f, synthesized=${mg.synthesized})`
    );
    // Only the platform ceiling is enforced — the package never cuts audio.
    const ceiling = (format === "shorts" ? SHORTS_CLAMP : LONGFORM_CLAMP)[1];
    if (frames > ceiling) {
      console.warn(`WARNING: mg video clamped from ${(frames / 30).toFixed(1)}s to ${(ceiling / 30).toFixed(1)}s — script too long for ${format}.`);
      frames = ceiling;
    }
  } else {
    frames = computeDurationFrames(script, channel.style, format, ttsAudioPath);
  }

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
    mg,
    ttsAudioPath: staged,
    thumbnailStyle: channel.thumbnail_spec?.style || "dramatic-visual",
    tone: channel.tone,
    font: channel.font || "Inter",
    channelName: channel.channel_name || "",
    palette:
      typeof channel.thumbnail_spec?.accentHue === "number"
        ? paletteFromHues({
            accentHue: channel.thumbnail_spec.accentHue,
            bgMode: channel.bg_mode,
          })
        : null,
  };

  console.log(`Rendering: ${componentId} (${frames} frames)`);
  console.log(`Output: ${outputPath}`);

  await renderVideo(componentId, outputPath, frames, props, scale);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
