#!/usr/bin/env node
/**
 * One-off verification render for the PhotoTreatment->ImageEvidenceScene
 * port (CHECK-REGISTER §3.12.12): proves the LIVE IMAGE_EVIDENCE path
 * actually renders a real sourced photo through the WebGL treatment
 * pipeline (vignette/grain/chromatic-aberration/LUT), not just that the
 * code compiles. PhotoTreatment.jsx's own header documents two real past
 * failure modes that rendered a blank white frame with no crash — this
 * script exists so that class of failure gets caught by a real render,
 * not assumed away. Throwaway QA script, not part of the pipeline.
 *
 * Drives the REAL buildMgPackage()/planVisual() pipeline (render.js's own
 * pattern) with one section whose bRollFiles points at the one real,
 * non-fixture photo currently in this repo's asset library, so
 * IMAGE_EVIDENCE is selected exactly the way director.js selects it in
 * production (visual/director.js:206-214: "decided by whether a real
 * sourced asset exists for this section").
 */
import { readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";
import { buildMgPackage } from "../compositions/mg-package.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const OUT_DIR = join(ROOT, "qa", "image-evidence-verify");
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

const REAL_ASSET = {
  path: "asset-library/ch-01/piggy-bank-savings-all-of-our-savings-to-the-homeland-0.png",
  treatment: "fullbleed",
  credit: "test fixture — real asset-library photo, not fabricated evidence",
};
const localPath = join(RENDER_DIR, "public", REAL_ASSET.path);
if (!existsSync(localPath)) {
  console.error("Expected real asset missing:", localPath);
  process.exit(1);
}

const sections = [
  { voiceover: "Every small deposit added up in the piggy bank over the year." },
];
const srtText =
  "1\n00:00:00,000 --> 00:00:04,500\nEvery small deposit added up in the piggy bank over the year.\n";

const channel = { id: "1", niche: "finance", icon_map: null, script_template: {}, sfx_profile: {} };

const mg = buildMgPackage(srtText, {
  sections,
  hook: null,
  channel,
  iconMap: null,
  bRollFiles: [],
  imageForSection: (idx) => (idx === 0 ? REAL_ASSET : null),
  totalMs: 5000,
});

console.log("beats:", mg.beats.map((b) => ({ archetype: b.archetype, strategy: b.visualPlan && b.visualPlan.strategy })));

const imageBeat = mg.beats.find((b) => b.visualPlan && b.visualPlan.strategy === "IMAGE_EVIDENCE");
if (!imageBeat) {
  console.error("director.js did not select IMAGE_EVIDENCE for this fixture — cannot verify the render.");
  console.error("Chosen strategies:", mg.beats.map((b) => b.visualPlan && b.visualPlan.strategy));
  process.exit(1);
}
console.log("IMAGE_EVIDENCE beat anchor frame:", imageBeat.anchorFrame, "start:", imageBeat.startFrame, "dur:", imageBeat.durationInFrames);

const props = {
  channelId: "1",
  style: "motion-graphics",
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

const midFrame = imageBeat.startFrame + Math.round(imageBeat.durationInFrames / 2);
for (const frame of [imageBeat.startFrame + 3, midFrame]) {
  const out = join(OUT_DIR, `frame-${frame}.png`);
  await renderStill({
    composition: { ...composition, durationInFrames: mg.totalFrames },
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
