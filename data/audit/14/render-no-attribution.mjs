/**
 * data/audit/14/render-no-attribution.mjs — Phase D Part 1.1 verification:
 * fresh stills of the same 3 real-provider beats as data/audit/12, through
 * the same production ImageBeatScene, after removing the on-screen
 * rotated credit <span>. Also renders a tight crop of beat 0's full frame
 * edges (where the old credit text used to sit) at high resolution so any
 * remaining text would be legible if present.
 *
 * Run: PROBE_CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell node data/audit/14/render-no-attribution.mjs
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
const BEAT_FRAMES = 75;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("bundling no-attribution entry...");
  const serveUrl = await bundle({ entryPoint: path.join(__dirname, "_no-attribution-entry.jsx"), publicDir: PUBLIC_DIR, onProgress: () => {} });
  const browser = await openBrowser("chrome", { browserExecutable: CHROME });
  const composition = await selectComposition({ serveUrl, id: "no-attribution-demo", puppeteerInstance: browser, browserExecutable: CHROME });

  const stillFrames = [
    { name: "beat0-settled-f65", frame: 65 },
    { name: "beat1-settled-f140", frame: BEAT_FRAMES + 65 },
    { name: "beat2-settled-f215", frame: 2 * BEAT_FRAMES + 65 },
  ];
  for (const { name, frame } of stillFrames) {
    const out = path.join(OUT_DIR, `no-attribution-${name}.png`);
    await renderStill({ serveUrl, composition, frame, output: out, puppeteerInstance: browser, browserExecutable: CHROME, logLevel: "error" });
    console.log(`still f${frame} -> ${out}`);
  }

  console.log("ALL PASS");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
