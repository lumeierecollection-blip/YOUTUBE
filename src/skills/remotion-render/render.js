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

import os from "os";`r`nimport { readFileSync, mkdirSync, existsSync, copyFileSync, writeFileSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createRequire } from "module";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { findChrome } from "./find-chrome.js";
import { resolveImageAssets } from "./image-assets.js";
import { buildMgPackage } from "./compositions/mg-package.js";
import { formatVisualReport } from "./visual/diagnostics.js";
import { chunkTextClauseAware, sectionFrameWindows } from "./compositions/beats.js";
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
// last word of a caption). The `chunkVoiceover` wrapper was deleted on
// 2026-08-30 (stage-15 sweep, DEL-09/TYP-11 PASS). chunkTextClauseAware
// (beats.js) does the same ≤maxWords grouping but repairs any boundary
// that would orphan an article, preposition, conjunction, or a number
// split from its unit.

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
      content: chunkTextClauseAware(s.voiceover),
      visualCue: s.visual_cue || null,
      bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
      textOverlay: s.text_overlay || null,
      animationCue: s.animation_cue || null,
      transitionOut: s.transition_out || null,
      // schemas/script.mg.json sections[].beats[] — the writer's own
      // archetype/anchor_token/data.series per visual idea, gate-script.js
      // (SCR-03/04/05) checked. Forwarded so buildMgPackage can prefer it
      // over its own SRT-text classifier (see beats.js buildAuthoredBeats).
      // Absent for minimal/cinematic-documentary scripts and any legacy
      // script written before this field existed — both fall back exactly
      // as before.
      beats: Array.isArray(s.beats) ? s.beats : null,
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
    concurrency: Math.max(4, os.cpus().length),`r`n    audioBitrate: "192k",
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
  //
  // KEYED BY channel.channel_id, NOT THE CLI ARGUMENT. Both image sources
  // are keyed by the slug form: data/asset-library/index.json stores
  // `"channelId": "ch-01"`, the legacy manifests are
  // b-roll-manifest-ch-01.json, and the files live under
  // public/asset-library/ch-01/ and public/b-roll/ch-01/. The pipeline
  // invokes this CLI with the NUMERIC id — scripts/render-and-qa.js passes
  // String(c.id), and data/renders/1 exists to prove it — so passing the
  // raw argument through made every asset-library lookup compare "1"
  // against "ch-01" and return nothing. Every photo in the library was
  // unreachable in production, which is also why IMAGE_EVIDENCE (the one
  // strategy with no text detector — it fires only when a real asset
  // exists) had never rendered a single frame. loadChannel() already
  // accepts either form, so channel.channel_id is the one spelling both
  // sides agree on.
  for (const section of sections) {
    section.bRollFiles = resolveImageAssets(section.bRoll || [], channel.channel_id, script.topic_slug);
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
      hook: script.hook || null,
      // The visual director reads the channel's own niche to pick its
      // visual vocabulary (visual/channel-grammar.js) — a legal channel
      // reaches for documents, a finance channel for balances (PART 15).
      channel,
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
      `MG package: ${mg.beats.length} beats, ${mg.pages.length} pages, ${mg.totalFrames}f ` +
        `(audio ${mg.audioFrames}f, synthesized=${mg.synthesized}, authoredBeats=${mg.usedAuthoredBeats})`
    );
    if (!mg.usedAuthoredBeats) {
      console.warn(
        "MG: falling back to the SRT-text classifier for beat archetypes — " +
          "script has no sections[].beats, an anchor_token didn't match the real narration, " +
          "or the SRT word count didn't match the script's voiceover word count."
      );
    }
    // Only the platform ceiling is enforced — the package never cuts audio.
    const ceiling = (format === "shorts" ? SHORTS_CLAMP : LONGFORM_CLAMP)[1];
    if (frames > ceiling) {
      console.warn(`WARNING: mg video clamped from ${(frames / 30).toFixed(1)}s to ${(ceiling / 30).toFixed(1)}s — script too long for ${format}.`);
      frames = ceiling;
    }
  } else {
    frames = computeDurationFrames(script, channel.style, format, ttsAudioPath);
  }

  // MOT-01 — minimal/cinematic-documentary used to divide screen time by
  // section COUNT (minimal.jsx) or a hardcoded dramatic-pacing weight that
  // never looked at word count (cinematic-documentary.jsx's computeLayout),
  // either of which can hold a section's visuals on screen for far longer
  // or shorter than its narration actually takes — the same class of bug
  // motion-graphics used to have before the SRT became its timing source.
  // Same fix here: real per-word SRT timing when the same TTS run produced
  // one (findSrtPath isn't MG-specific — it just looks next to the audio),
  // else an honest word-count-proportional split.
  let sectionWindows = null;
  if (channel.style !== "motion-graphics") {
    const srtPath = findSrtPath(ttsAudioPath);
    const srtText = srtPath ? readFileSync(srtPath, "utf-8") : "";
    if (srtPath) console.log(`${channel.style} SRT: ${srtPath}`);
    sectionWindows = sectionFrameWindows(sections, srtText, frames, 30);
  }

  const outputDir = join(ROOT, "data", "renders", channelId);
  mkdirSync(outputDir, { recursive: true });

  const slug = basename(scriptPath, extname(scriptPath)).replace(/-script$/, "");
  const timestamp = new Date().toISOString().slice(0, 10);
  const outputPath = join(outputDir, `${slug}-${format}-${timestamp}.mp4`);

  // ENC-31 — an IMAGE_BEAT that couldn't resolve a real photo (mg-package.js's
  // imageGaps) must be visible in this run's report, not just quietly
  // downgraded to STATEMENT/HERO_NUMBER in the rendered output. Always
  // written, even empty — an absent file is ambiguous ("did this check even
  // run?"), an empty array is not.
  if (mg) {
    const gapsPath = join(outputDir, `${slug}-${format}-image-gaps.json`);
    writeFileSync(gapsPath, JSON.stringify(mg.imageGaps || [], null, 2) + "\n");
    for (const gap of mg.imageGaps || []) {
      console.warn(`::warning::IMAGE_BEAT gap (section ${gap.sectionIndex} -> ${gap.fallbackArchetype}): ${gap.reason} — "${gap.text}"`);
    }
    console.log(`Image gaps: ${(mg.imageGaps || []).length} beat(s) fell back from IMAGE_BEAT -> ${gapsPath}`);

    // PART 19/20 — the visual QA report. Always written, even when clean,
    // for the same reason the image-gaps file is: an absent file is
    // ambiguous ("did this check run?"), an empty one is not. Warnings are
    // echoed as GitHub-Actions annotations so a degraded render is visible
    // in the run that produced it rather than in a later audit.
    const visualPath = join(outputDir, `${slug}-${format}-visual-report.json`);
    writeFileSync(visualPath, JSON.stringify(mg.visual, null, 2) + "\n");
    console.log("\n--- VISUAL REPORT ---");
    console.log(formatVisualReport(mg.visual));
    console.log(`--- visual report -> ${visualPath}\n`);
    for (const w of mg.visual.warnings || []) {
      console.warn(`::warning::${w.id} (${w.severity}): ${w.message}`);
    }
  }

  // Attribution for CC-BY-sourced photos used to live ONLY as on-screen
  // text in ImageBeatScene — real production-value complaint (reads as
  // unfinished scaffolding), but licenses.js's requiresAttribution() exists
  // because SOME assets (Wikimedia/Openverse CC-BY) are only licensed on
  // the condition attribution is given somewhere. Removing on-screen text
  // without another surface would be a real compliance regression, not a
  // cleanup — so this writes the real per-render credit list here, and
  // youtube-publish/run.js's buildMetadata reads it and appends a credits
  // block to the actual video description at upload time. Always written,
  // same "empty file still confirms the check ran" reasoning as the gaps
  // file above.
  const creditSet = new Set();
  for (const section of sections) {
    for (const asset of section.bRollFiles || []) {
      if (asset.credit) creditSet.add(asset.credit);
    }
  }
  const creditsPath = join(outputDir, `${slug}-${format}-image-credits.json`);
  writeFileSync(creditsPath, JSON.stringify([...creditSet], null, 2) + "\n");
  console.log(`Image credits: ${creditSet.size} attribution(s) -> ${creditsPath}`);

  // music-sourcing/SKILL.md's underscore bed — a committed, stable asset
  // (src/skills/music-sourcing/fetch-underscore.mjs's fixed output path),
  // never a static import: unlike vo.mp3 (always present, required), this
  // is optional, so a missing file must not break the webpack bundle or
  // fail the render. hasUnderscore just tells the composition whether to
  // render the <Audio> bed at all; the actual staticFile() resolution
  // happens in motion-graphics.jsx, at render time, inside the bundle.
  const hasUnderscore = existsSync(join(__dirname, "public", "music", "underscore.mp3"));

  const props = {
    channelId: channel.channel_id,
    style: channel.style,
    format: format,
    sections,
    mg,
    sectionWindows,
    // Burned-in narration captions, OFF unless the channel asks for them.
    // The narration is already in the audio track; printing it over the
    // picture turned the video into an animated transcript and let the
    // visuals off the hook. Opt in per channel with
    //   "captions": "burned-in"
    // in config/channels.json (accessibility / sound-off distribution).
    // Any other value, or the field's absence, means no drawn captions.
    // The SRT is unaffected either way — it remains the timing source for
    // beats, anchors and visual states.
    showCaptions: channel.captions === "burned-in",
    ttsAudioPath: staged,
    hasUnderscore,
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
