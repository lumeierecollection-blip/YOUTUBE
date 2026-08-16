#!/usr/bin/env node
/**
 * PART 7/10 verification — full video render (not renderStill: @remotion/media's
 * <Audio> inside Sfx components throws under renderStill once an SFX
 * Sequence actually mounts — a pre-existing renderStill-only limitation,
 * unrelated to this rebuild's changes; renderMedia is what render.js/the
 * real pipeline uses anyway) covering a full 20s breathing cycle plus a
 * HERO_NUMBER beat, then frame-extracted and pixel-audited exactly like a
 * real pipeline render. Throwaway QA script, not part of the pipeline.
 */
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";

// Deliberately lives inside src/skills/remotion-render/ (not repo-root
// scripts/) so its bare `@remotion/*` imports resolve against THIS
// subpackage's node_modules — it pins @remotion/media 4.0.507 while root's
// package.json resolves to 4.0.505ish. Running this from repo root instead
// mixes a renderer built for one remotion core version against a bundle
// built for another, and throws deep inside React's context internals
// ("Cannot read properties of undefined (reading '_currentValue')") the
// moment any <Audio> (Sfx or the VO track) actually mounts — confirmed by
// reproducing it from repo-root scripts/ before moving this file here.
const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const OUT_DIR = join(ROOT, "qa", "motion-verify");
mkdirSync(OUT_DIR, { recursive: true });

function findChrome() {
  const pwBase = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pwBase && existsSync(pwBase)) {
    for (const entry of readdirSync(pwBase)) {
      if (entry.startsWith("chromium_headless_shell-")) {
        const p = join(pwBase, entry, "chrome-linux", "headless_shell");
        if (existsSync(p)) return p;
      }
    }
  }
  return undefined;
}
const CHROME = findChrome();

const beat = {
  archetype: "HERO_NUMBER",
  startFrame: 0,
  durationInFrames: 90,
  anchorFrame: 4,
  sectionIndex: 0,
  text: "the fee jumped to 1980 dollars",
  scene: { value: 1980, unit: "", headline: null, isReveal: true },
};
const beat2 = { ...beat, startFrame: 90, anchorFrame: 94, scene: { ...beat.scene, isReveal: false } };

const mg = {
  beats: [beat, beat2],
  pages: [],
  transitions: [null, null],
  sectionRanges: { 0: { from: 0, to: 630 } },
  totalFrames: 630,
  audioFrames: 630,
};

const props = {
  channelId: "ch-verify", style: "verify", format: "shorts", mg,
  font: "DM Sans", palette: { accentHue: 149, bgMode: "white" },
  channelName: "QA Fixture", ttsAudioPath: null,
};

const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
const browserOpts = CHROME ? { browserExecutable: CHROME } : {};
const composition = await selectComposition({ serveUrl, id: "MotionGraphicsShorts", inputProps: props, ...browserOpts });

const outputPath = join(OUT_DIR, "motion-verify.mp4");
console.log("Rendering", mg.totalFrames, "frames...");
await renderMedia({
  composition: { ...composition, durationInFrames: mg.totalFrames },
  serveUrl,
  codec: "h264",
  audioCodec: "aac",
  enforceAudioTrack: true,
  inputProps: props,
  outputLocation: outputPath,
  ...browserOpts,
  imageFormat: "jpeg",
  jpegQuality: 80,
  pixelFormat: "yuv420p",
  chromiumOptions: { gl: "swangle" },
  concurrency: 2,
  scale: 0.5,
  timeoutInMilliseconds: 120000,
});
console.log("Rendered:", outputPath);
