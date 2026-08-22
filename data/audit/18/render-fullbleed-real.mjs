#!/usr/bin/env node
/**
 * data/audit/18/render-fullbleed-real.mjs — real PRODUCTION-PATH render of
 * a fullbleed beat, to check the task's reported "magenta blocks + green
 * line" regression against an actual video frame.
 *
 * WHY THIS EXISTS, DISTINCT FROM data/audit/16: audit/16's probe
 * deliberately rendered PhotoTreatment against a magenta AbsoluteFill with
 * a lime stage-box outline — magenta was chosen BECAUSE it's a jarring,
 * impossible color, specifically so any bleed-through would be obvious;
 * lime marked the box boundary being tested. That was correct methodology
 * for THAT check (confirming zero letterboxing), but it is not, and was
 * never wired into, the real render pipeline — see below for the grep/
 * Root.jsx proof. This script instead bundles the REAL Root.jsx (same
 * entry render.js itself uses — see render.js's own `bundle({ entryPoint:
 * join(__dirname, "Root.jsx") })` call) and renders through the actual
 * MotionGraphicsShorts -> ImageBeatScene -> PhotoTreatment path with a
 * real channel palette (white and black modes, no magenta/lime anywhere
 * in the setup), following qa-render-image-beat.mjs's established
 * pattern (same beat-object shape, same Root.jsx bundle target).
 *
 * Run: PROBE_CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell node data/audit/18/render-fullbleed-real.mjs
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "..", "..", "..");
const RENDER_DIR = path.join(repo, "src", "skills", "remotion-render");
const CHROME = process.env.PROBE_CHROME || "/opt/pw-browsers/chromium";
const OUT_DIR = path.join(__dirname, "out");
mkdirSync(OUT_DIR, { recursive: true });

// Same beat shape as qa-render-image-beat.mjs, swapped to the "deep-sea
// vent" photo (black-smoker.jpg) the task names, imageTreatment:"fullbleed"
// — the exact real code path (ImageBeatScene -> PhotoTreatment, treatment
// "fullbleed" -> object-fit:cover) the report is about.
const beatFullbleed = {
  archetype: "IMAGE_BEAT",
  startFrame: 0,
  durationInFrames: 90,
  anchorFrame: 6,
  sectionIndex: 0,
  text: "a black smoker hydrothermal vent on the ocean floor",
  scene: {
    image: "b-roll/ch-fixture/black-smoker.jpg",
    imageTreatment: "fullbleed",
    credit: "Photo (test fixture)",
    headline: "DEEP-SEA VENT",
  },
};
const mg = {
  beats: [beatFullbleed],
  pages: [],
  transitions: [null],
  sectionRanges: { 0: { from: 0, to: 90 } },
  totalFrames: 90,
  audioFrames: 90,
};

const PALETTES = {
  white: { baseHue: 220, accentHue: 15, bgMode: "white" },
  black: { baseHue: 220, accentHue: 15, bgMode: "black" },
};

async function main() {
  console.log("bundling REAL Root.jsx (same entry render.js uses)...");
  const serveUrl = await bundle({ entryPoint: path.join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
  const browser = await openBrowser("chrome", { browserExecutable: CHROME, chromiumOptions: { gl: "swangle" } });

  let failures = 0;
  for (const [mode, palette] of Object.entries(PALETTES)) {
    const props = {
      channelId: "ch-verify",
      style: "verify",
      format: "shorts",
      mg,
      font: "DM Sans",
      palette,
      channelName: "QA Fixture",
      ttsAudioPath: null,
    };
    const out = path.join(OUT_DIR, `fullbleed-real-${mode}.png`);
    try {
      const composition = await selectComposition({ serveUrl, id: "MotionGraphicsShorts", puppeteerInstance: browser, inputProps: props, browserExecutable: CHROME });
      await renderStill({
        composition: { ...composition, durationInFrames: 90 },
        serveUrl,
        output: out,
        frame: 20,
        puppeteerInstance: browser,
        inputProps: props,
        browserExecutable: CHROME,
        logLevel: "error",
        timeoutInMilliseconds: 60000,
      });
      console.log(`OK ${mode} -> ${out}`);
    } catch (err) {
      failures++;
      console.log(`FAIL ${mode}: ${err.message}`);
    }
  }

  await browser.close({ silent: true });
  console.log(failures === 0 ? "\nALL RENDERS OK" : `\n${failures} RENDER FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
