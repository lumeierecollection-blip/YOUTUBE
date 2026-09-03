#!/usr/bin/env node
/**
 * Render and MEASURE the anchor frame of every staged beat in a script.
 *
 * Usage:
 *   node qa-scripts/inspect-anchors.mjs <script.json> <srt> <channel-id> <out-dir> [--all-states]
 *
 * WHY renderStill AND NOT ffmpeg ON THE MP4
 *
 * The frame that matters is the ANCHOR frame — the one where the beat's key
 * token is actually spoken, from the SRT. Seeking an h264 file lands on a
 * decoded approximation of that frame; `renderStill` renders exactly it,
 * from the same composition and the same props the production CLI uses, so
 * what is measured here is what ships.
 *
 * WHAT IT MEASURES, AND WHY THOSE NUMBERS
 *
 *   ink   — fraction of pixels differing from the frame's own background by
 *           more than a threshold. A pixel audit of the previous renderer
 *           found 15 of 16 scenes under 5% ink: a hairline diagram floating
 *           in a void, which is most of what "looks machine-generated"
 *           actually is at the pixel level.
 *   bbox  — the extent of that ink, as a fraction of the canvas. Ink alone
 *           can be high because one blob is dense; bbox says whether the
 *           composition USES the frame.
 *   cx/cy — centroid of the ink. The same audit found fifteen scenes
 *           centred within a few percent of cx 0.43, which is what a
 *           composition layer is supposed to break up.
 *
 * These are DIAGNOSTICS, not a pass/fail gate. A high number does not make
 * a frame good — a scene could fill the canvas with noise and score well.
 * They exist to make "still looks templated" measurable enough to act on;
 * looking at the PNGs is still the acceptance test.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { buildMgPackage } from "../compositions/mg-package.js";
import { chunkTextClauseAware } from "../compositions/beats.js";
import { paletteFromHues } from "../styles/tokens.js";
import { narrationSections } from "../../../utils/script-narration.js";
import { resolveImageAssets } from "../image-assets.js";
import { findChrome } from "../find-chrome.js";
import { decodePNG } from "../decode-png.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");

const argv = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ALL_STATES = process.argv.includes("--all-states");
const [scriptPath, srtPath, channelId, outDirArg] = argv;
if (!scriptPath || !srtPath || !channelId || !outDirArg) {
  console.error("Usage: node qa-scripts/inspect-anchors.mjs <script.json> <srt> <channel-id> <out-dir> [--all-states]");
  process.exit(1);
}

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

// IMAGES COME FROM THE REAL RESOLVER, exactly as render.js does it.
//
// render-clip.mjs stubs this to `() => null`, which is why IMAGE_EVIDENCE
// had never once been rendered: the strategy has no text detector — it
// fires only when a real sourced asset exists for the section — so a stub
// makes it unreachable by construction. Going through resolveImageAssets
// means a photo appears only if the asset library genuinely has a match,
// with the licence and attribution it was catalogued with. Nothing is
// fabricated to make the strategy fire; if nothing matches, it stays
// uncovered and the report says so.
for (const section of sections) {
  section.bRollFiles = resolveImageAssets(section.bRoll || [], channel.channel_id, script.topic_slug);
}
const withImagery = sections.filter((s) => (s.bRollFiles || []).length > 0).length;
console.log(`imagery: ${withImagery}/${sections.length} sections resolved a real asset`);

const mg = buildMgPackage(srtText, {
  sections,
  hook: script.hook || null,
  channel,
  bRollFiles: sections.flatMap((s) => s.bRollFiles || []),
  imageForSection: (idx) => (sections[idx] && sections[idx].bRollFiles && sections[idx].bRollFiles[0]) || null,
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
  // Production default. Captions on would put narration text over every
  // frame and make the ink numbers meaningless as a measure of the PICTURE.
  showCaptions: channel.captions === "burned-in",
};

const outDir = join(ROOT, outDirArg);
mkdirSync(outDir, { recursive: true });

const staged = mg.beats.filter((b) => b.archetype !== "LIST_ITEM" && b.visualPlan);

/**
 * Which frames to render for one beat.
 *
 * The anchor always. With --all-states, one frame per visual state, taken
 * a third of the way in so a state that has only started is not sampled at
 * its own first frame where it may legitimately be empty.
 */
function framesFor(beat) {
  const out = [{ tag: "anchor", frame: Math.min(beat.anchorFrame, beat.startFrame + beat.durationInFrames - 1) }];
  if (!ALL_STATES) return out;
  for (const st of beat.visualStates || []) {
    // `st.startFrame` is LOCAL to the beat (states.js: "0 = beat start" —
    // it's what the scene sees inside its own <Sequence>). This was being
    // passed straight to renderStill as if it were an absolute frame in
    // the whole composition, so every --all-states frame for any beat
    // that doesn't start at frame 0 sampled a DIFFERENT, earlier beat
    // instead — found by rendering CAUSE_EFFECT's "cause"/"link" states
    // and getting PROCESS's picture back. beat.startFrame is absolute
    // (same field the "anchor" row above already uses correctly).
    out.push({ tag: st.key, frame: Math.min(beat.startFrame + st.startFrame + Math.floor(st.durationInFrames / 3), mg.totalFrames - 1) });
  }
  return out;
}

/**
 * Ink coverage, bounding box and centroid.
 *
 * Background is taken from the frame's own corners rather than assumed to
 * be the channel's `bg`: the mg background draws a dot grid and noise, and
 * a fixed-colour comparison would count that texture as subject ink.
 */
function measure(pngPath) {
  const { width, height, data, channels } = decodePNG(pngPath);
  const px = (x, y) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const corners = [px(4, 4), px(width - 5, 4), px(4, height - 5), px(width - 5, height - 5)];
  const bg = [0, 1, 2].map((c) => corners.reduce((a, p) => a + p[c], 0) / corners.length);

  // 26/255 ~= 10%. Below this the mg background's own dot grid and noise
  // register as ink; the threshold was set by measuring an empty frame.
  const T = 26;
  let n = 0, sx = 0, sy = 0;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  // Every 2nd pixel: 4x faster, and the numbers are fractions, not counts.
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const p = px(x, y);
      const d = Math.max(Math.abs(p[0] - bg[0]), Math.abs(p[1] - bg[1]), Math.abs(p[2] - bg[2]));
      if (d < T) continue;
      n++; sx += x; sy += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const sampled = Math.ceil(width / 2) * Math.ceil(height / 2);
  if (n === 0) return { ink: 0, bboxW: 0, bboxH: 0, cx: null, cy: null, empty: true };
  return {
    ink: n / sampled,
    bboxW: (maxX - minX) / width,
    bboxH: (maxY - minY) / height,
    cx: sx / n / width,
    cy: sy / n / height,
    empty: false,
  };
}

const CHROME = findChrome();
console.log("bundling…");
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
const composition = await selectComposition({
  serveUrl,
  id: "MotionGraphicsShorts",
  inputProps: props,
  ...(CHROME ? { browserExecutable: CHROME } : {}),
});

const slug = script.topic_slug || "script";
const rows = [];
for (const beat of staged) {
  const plan = beat.visualPlan;
  const shot = plan.shot || {};
  for (const { tag, frame } of framesFor(beat)) {
    const name = `${slug}-${plan.strategy}-v${plan.variant ?? 0}-${tag}-f${frame}.png`;
    const file = join(outDir, name);
    await renderStill({
      composition: { ...composition, durationInFrames: mg.totalFrames },
      serveUrl,
      output: file,
      frame,
      inputProps: props,
      imageFormat: "png",
      chromiumOptions: { gl: "swangle" },
      timeoutInMilliseconds: 120000,
      overwrite: true,
      ...(CHROME ? { browserExecutable: CHROME } : {}),
    });
    const m = measure(file);
    rows.push({
      strategy: plan.strategy,
      variant: plan.variant ?? 0,
      tag,
      frame,
      material: shot.material || null,
      framing: shot.framing ? shot.framing.id : null,
      camera: shot.camera ? shot.camera.id : null,
      depth: shot.depth ? shot.depth.id : null,
      file: name,
      ...m,
    });
    console.log(
      `${plan.strategy.padEnd(21)} v${plan.variant ?? 0} ${tag.padEnd(10)} f${String(frame).padStart(4)}  ` +
        `ink ${(m.ink * 100).toFixed(1).padStart(5)}%  bbox ${(m.bboxW * 100).toFixed(0).padStart(3)}x${(m.bboxH * 100).toFixed(0).padStart(3)}%  ` +
        `centroid ${m.cx == null ? " —  " : m.cx.toFixed(2)},${m.cy == null ? " — " : m.cy.toFixed(2)}` +
        (m.empty ? "   *** EMPTY FRAME ***" : "")
    );
  }
}

/**
 * THE ANCHOR FRAME MUST NOT BE EMPTY.
 *
 * Not a style preference — a correctness rule about the one frame anyone
 * checks. Two scenes shipped violating it and neither could be caught by
 * reading code:
 *
 *   DATA_CHART      anchored its `bars` state, so the frame of the
 *                   narration saying "ninety" was an empty axis with four
 *                   figures reading 0.
 *   CINEMATIC_STATEMENT
 *                   anchored its `subject` state, and since that phrase is
 *                   the entire content of the terminal fallback, the anchor
 *                   frame came back blank at 0.1% ink.
 *
 * The floor is deliberately low. It is not a quality bar — a frame at 1.2%
 * ink can still be a thin diagram in a void, and this says nothing about
 * that. It only catches "the picture had not arrived yet when the word was
 * spoken", which is a different and worse defect.
 */
const ANCHOR_INK_FLOOR = 0.004; // 0.4% of sampled pixels

const anchorRows = rows.filter((r) => r.tag === "anchor");
const empty = anchorRows.filter((r) => r.ink < ANCHOR_INK_FLOOR);

const reportPath = join(outDir, `${slug}-anchor-metrics.json`);
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      script: slug,
      channel: channel.id,
      anchorInkFloor: ANCHOR_INK_FLOOR,
      emptyAtAnchor: empty.map((r) => ({ strategy: r.strategy, variant: r.variant, frame: r.frame, ink: r.ink })),
      frames: rows,
    },
    null,
    2
  )
);
console.log(`\n${rows.length} frames -> ${outDir}`);
console.log(`metrics -> ${reportPath}`);
if (empty.length) {
  console.log(`\nEMPTY AT THE ANCHOR (< ${(ANCHOR_INK_FLOOR * 100).toFixed(1)}% ink) — the frame the key word lands on has no picture:`);
  for (const r of empty) console.log(`  ${r.strategy} v${r.variant} f${r.frame}: ${(r.ink * 100).toFixed(2)}%`);
  process.exitCode = 1;
}
