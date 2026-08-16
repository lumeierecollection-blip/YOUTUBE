#!/usr/bin/env node
/**
 * One-off verification render for PART 6/10 of the motion-graphics rebuild
 * — proves ImageBeatScene's new "cutout" treatment path (motion-graphics.jsx)
 * actually renders a rembg-treated PNG with object-fit:contain + baked-in
 * shadow, not just that the code compiles. Not part of the pipeline; a
 * throwaway QA script, kept for anyone re-verifying this change later.
 */
import { readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";

// See qa-render-motion.mjs's header — this lives inside
// src/skills/remotion-render/ deliberately, for the same node_modules
// version-consistency reason.
const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const OUT_DIR = join(ROOT, "qa", "image-beat-verify");
mkdirSync(OUT_DIR, { recursive: true });

function findChrome() {
  const candidates = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const pwBase = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pwBase && existsSync(pwBase)) {
    for (const entry of readdirSync(pwBase)) {
      if (entry.startsWith("chromium_headless_shell-")) {
        const p = join(pwBase, entry, "chrome-linux", "headless_shell");
        if (existsSync(p)) candidates.unshift(p);
      }
    }
  }
  return candidates.find((p) => existsSync(p));
}
const CHROME = findChrome();
console.log("Chrome:", CHROME || "(letting Remotion manage its own)");

// A single synthetic beat exercising IMAGE_BEAT with the new cutout
// treatment. anchorFrame/startFrame/durationInFrames are picked by hand
// (no real SRT needed for this isolated check).
const beat = {
  archetype: "IMAGE_BEAT",
  startFrame: 0,
  durationInFrames: 90,
  anchorFrame: 6,
  sectionIndex: 0,
  text: "a cave spider found deep underground",
  scene: {
    image: "asset-library/ch-fixture/cave-spider-cutout.png",
    imageTreatment: "cutout",
    credit: "Photo via Wikimedia Commons (test fixture)",
    headline: "CAVE SPIDER",
  },
};
const beatFullbleed = {
  ...beat,
  startFrame: 90,
  scene: {
    image: "b-roll/ch-fixture/cave-spider.jpg",
    imageTreatment: "fullbleed",
    credit: null,
    headline: "RAW PHOTO (unchanged path)",
  },
};

const mg = {
  beats: [beat, beatFullbleed],
  pages: [],
  transitions: [null, null],
  sectionRanges: { 0: { from: 0, to: 180 } },
  totalFrames: 180,
  audioFrames: 180,
};

const props = {
  channelId: "ch-verify",
  style: "verify",
  format: "shorts",
  mg,
  font: "DM Sans",
  palette: { baseHue: 220, accentHue: 15, bgMode: "white" },
  channelName: "QA Fixture",
  ttsAudioPath: null,
};

const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
const browserOpts = CHROME ? { browserExecutable: CHROME } : {};
const browserInstance = await openBrowser("chrome", { ...browserOpts, chromiumOptions: { gl: "swangle" } });

const composition = await selectComposition({
  serveUrl,
  id: "MotionGraphicsShorts",
  puppeteerInstance: browserInstance,
  inputProps: props,
  ...browserOpts,
});

for (const frame of [10, 100]) {
  const out = join(OUT_DIR, `frame-${frame}.png`);
  await renderStill({
    composition: { ...composition, durationInFrames: 180 },
    serveUrl,
    output: out,
    frame,
    puppeteerInstance: browserInstance,
    inputProps: props,
    ...browserOpts,
  });
  console.log("rendered:", out);
}

await browserInstance.close({ silent: true });
console.log("DONE");
