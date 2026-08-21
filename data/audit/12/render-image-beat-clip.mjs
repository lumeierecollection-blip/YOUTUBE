/**
 * data/audit/12/render-image-beat-clip.mjs — real video-clip evidence for
 * "where do the sourced photos actually show up." Renders ImageBeat.jsx
 * (beats/ImageBeat.jsx) standalone with a real, already-committed b-roll
 * fixture photo (see _image-beat-entry.jsx's header for why it's a fixture
 * photo and not a fresh Openverse fetch — every asset-sourcing host was
 * unreachable from this sandbox when tested) through the actual Remotion
 * renderer, producing a real .mp4, not a still.
 *
 * Run: PROBE_CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell node data/audit/12/render-image-beat-clip.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, selectComposition } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "..", "..", "..");
const CHROME = process.env.PROBE_CHROME || "/opt/pw-browsers/chromium";
const PUBLIC_DIR = path.join(repo, "src", "skills", "remotion-render", "public");
const OUT = path.join(__dirname, "out", "image-beat-demo.mp4");

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  if (!fs.existsSync(CHROME)) {
    console.error(`No browser at ${CHROME} — set PROBE_CHROME to a real Chromium/Chrome executable.`);
    process.exit(1);
  }

  console.log("bundling ImageBeat entry (real fonts + real fixture photo)...");
  const serveUrl = await bundle({ entryPoint: path.join(__dirname, "_image-beat-entry.jsx"), publicDir: PUBLIC_DIR, onProgress: () => {} });
  const browser = await openBrowser("chrome", { browserExecutable: CHROME });

  const composition = await selectComposition({ serveUrl, id: "image-beat-demo", puppeteerInstance: browser, browserExecutable: CHROME });

  console.log(`rendering ${composition.durationInFrames} frames @ ${composition.fps}fps -> ${OUT}`);
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation: OUT,
    puppeteerInstance: browser,
    browserExecutable: CHROME,
    logLevel: "info",
    concurrency: 1,
    onProgress: ({ renderedFrames, encodedFrames }) => {
      console.log(`progress: rendered ${renderedFrames}/${composition.durationInFrames}, encoded ${encodedFrames}`);
    },
  });

  console.log(`done -> ${OUT}`);
  // Force exit rather than await browser.close() — that call hung
  // indefinitely on a prior run in this sandbox (no new output, file size
  // never changed again) well after renderMedia's promise had already
  // resolved and the file was fully written; forcing exit here is safe
  // since nothing after this point does further work.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
