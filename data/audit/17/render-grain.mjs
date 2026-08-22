/**
 * data/audit/17/render-grain.mjs — real render evidence for
 * effects/CanvasGrain.jsx (postprocessing's NoiseEffect on the flat
 * canvas background), white-mode and black-mode channels, plus PNGs
 * suitable for feeding straight into scripts/frame-audit.js's extended
 * flatness check.
 *
 * Run: PROBE_CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell node data/audit/17/render-grain.mjs
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
const RUN_IDS = ["grain-white", "grain-black"];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("bundling grain entry...");
  const serveUrl = await bundle({ entryPoint: path.join(__dirname, "_grain-entry.jsx"), publicDir: PUBLIC_DIR, onProgress: () => {} });
  const browser = await openBrowser("chrome", { browserExecutable: CHROME });

  let failures = 0;
  for (const id of RUN_IDS) {
    const out = path.join(OUT_DIR, `${id}.png`);
    try {
      const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, browserExecutable: CHROME });
      await renderStill({ serveUrl, composition, frame: 15, output: out, puppeteerInstance: browser, browserExecutable: CHROME, logLevel: "error", timeoutInMilliseconds: 60000 });
      console.log(`OK ${id} -> ${out}`);
    } catch (err) {
      failures++;
      console.log(`FAIL ${id}: ${err.message}`);
    }
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
