/**
 * data/audit/16/render-cover-fit.mjs — verification for a reported
 * full-bleed letterboxing bug ("photo at its natural size with white bars
 * top and bottom instead of covering the canvas edge-to-edge").
 *
 * FINDING: does not reproduce. Renders below (magenta background + lime
 * outline around the exact production fullbleed stage box, 1080x898, NO
 * scrim — a scrim fading to the channel's bg color could otherwise mask a
 * real letterbox gap as an intentional fade, so it's deliberately excluded
 * here) show zero magenta bleed-through inside the outline for both real
 * fixtures (cave-spider.jpg, aspect 1.125; black-smoker.jpg, aspect 1.333
 * — box aspect is 1.203) AND two synthetic extreme-aspect stress tests
 * (4.5:1 wide, 1:4.5 tall). PhotoTreatment.jsx's Plane cover-fit math
 * (mirrors CSS object-fit: cover) is correct across this whole range.
 * Most likely explanation: the report was made against an earlier render,
 * predating the previous round's FULLBLEED_STAGE_H change (motion-
 * graphics.jsx) that widened/reshaped this box from the old 748px-tall
 * IMAGE_STAGE box to the current 898px-tall one — no code change made
 * here as a result, since there was nothing to fix.
 *
 * Run: PROBE_CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell node data/audit/16/render-cover-fit.mjs
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
const RUN_IDS = ["cover-fit-cavespider", "cover-fit-blacksmoker", "cover-fit-wide", "cover-fit-tall"];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("bundling cover-fit probe entry...");
  const entryPoint = path.join(__dirname, "_cover-fit-probe-entry.jsx");
  const serveUrl = await bundle({ entryPoint, publicDir: PUBLIC_DIR, onProgress: () => {} });
  const browser = await openBrowser("chrome", { browserExecutable: CHROME });

  let failures = 0;
  for (const id of RUN_IDS) {
    const out = path.join(OUT_DIR, `${id}.png`);
    try {
      const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, browserExecutable: CHROME });
      await renderStill({ serveUrl, composition, frame: 20, output: out, puppeteerInstance: browser, browserExecutable: CHROME, logLevel: "error", timeoutInMilliseconds: 60000 });
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
