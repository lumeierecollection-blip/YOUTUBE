/**
 * data/audit/13/render-photo-treatment.mjs — real render evidence for
 * PhotoTreatment.jsx (Three.js + postprocessing vignette/grain/chromatic-
 * aberration/LUT), on 3 real photos from different providers.
 *
 * Run: PROBE_CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell node data/audit/13/render-photo-treatment.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "..", "..", "..");
const CHROME = process.env.PROBE_CHROME || "/opt/pw-browsers/chromium";
const PUBLIC_DIR = path.join(repo, "src", "skills", "remotion-render", "public");
const OUT_DIR = path.join(__dirname, "out");
const RUN_IDS = ["pt-piggybank-cutout", "pt-cavespider-cutout", "pt-blacksmoker-fullbleed"];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(CHROME)) {
    console.error(`No browser at ${CHROME} — set PROBE_CHROME to a real Chromium/Chrome executable.`);
    process.exit(1);
  }

  console.log("bundling PhotoTreatment entry...");
  const serveUrl = await bundle({ entryPoint: path.join(__dirname, "_photo-treatment-entry.jsx"), publicDir: PUBLIC_DIR, onProgress: () => {} });
  const browser = await openBrowser("chrome", { browserExecutable: CHROME });

  // Render frame 0 AND frame 20 for each composition: ThreeCanvas's own
  // sync code (@remotion/three ThreeCanvasInternals) special-cases local
  // frame 0 — `if (!isRendering || frame === 0) return;` skips registering
  // the per-frame "Waiting for R3F to render frame N" delayRender that
  // frame > 0 gets. At frame 0, the only thing gating capture is
  // SuspenseLoader's fallback-based delay, which continueRender()s from a
  // useLayoutEffect cleanup (synchronous) while the real repaint (with the
  // now-loaded texture/LUT) happens in ManualFrameRenderer's plain
  // useEffect (deferred, passive-effect phase) — a real ordering gap where
  // Remotion can screenshot before the loaded-content advance() has run.
  // Rendering both frames side by side proves/disproves this directly
  // instead of guessing.
  let failures = 0;
  const DEBUG_ONE = process.env.DEBUG_ONE === "1";
  const runs = DEBUG_ONE ? [["pt-piggybank-cutout", 0]] : RUN_IDS.flatMap((id) => [0, 20].map((f) => [id, f]));
  for (const [id, frame] of runs) {
    const out = path.join(OUT_DIR, `${id}-f${frame}.png`);
    try {
      const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, browserExecutable: CHROME });
      await renderStill({
        serveUrl,
        composition,
        frame,
        output: out,
        puppeteerInstance: browser,
        browserExecutable: CHROME,
        logLevel: DEBUG_ONE ? "verbose" : "error",
        timeoutInMilliseconds: DEBUG_ONE ? 15000 : 60000,
      });
      console.log(`OK ${id} frame ${frame} -> ${out}`);
    } catch (err) {
      failures++;
      console.log(`FAIL ${id} frame ${frame}: ${err.message}`);
    }
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
