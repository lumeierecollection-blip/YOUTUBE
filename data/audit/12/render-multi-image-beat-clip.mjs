/**
 * data/audit/12/render-multi-image-beat-clip.mjs — real video-clip evidence
 * for three real, CI-fetched photos (build-asset-library.yml run
 * 32541446166) composited through the ACTUAL production ImageBeatScene
 * (motion-graphics.jsx, exported for this probe), one Sequence per beat, to
 * verify the shadow+push-in pairing and multiple-consecutive-beats
 * behaviour with real pixels rather than assumed from reading the code.
 *
 * Run: PROBE_CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell node data/audit/12/render-multi-image-beat-clip.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "..", "..", "..");
const CHROME = process.env.PROBE_CHROME || "/opt/pw-browsers/chromium";
const PUBLIC_DIR = path.join(repo, "src", "skills", "remotion-render", "public");
const OUT_DIR = path.join(__dirname, "out");
const OUT_MP4 = path.join(OUT_DIR, "multi-image-beat-demo.mp4");
const BEAT_FRAMES = 75;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(CHROME)) {
    console.error(`No browser at ${CHROME} — set PROBE_CHROME to a real Chromium/Chrome executable.`);
    process.exit(1);
  }

  console.log("bundling multi-image-beat entry (real fonts + 3 real CI-fetched photos)...");
  const serveUrl = await bundle({ entryPoint: path.join(__dirname, "_multi-image-beat-entry.jsx"), publicDir: PUBLIC_DIR, onProgress: () => {} });
  const browser = await openBrowser("chrome", { browserExecutable: CHROME });

  const composition = await selectComposition({ serveUrl, id: "multi-image-beat-demo", puppeteerInstance: browser, browserExecutable: CHROME });

  // Stills first — one settled frame per beat (mid-hold, well past the
  // push-in's D.push=60f settle) plus one EARLY frame (frame 5) of beat 0
  // to capture the push-in still visibly in motion (scale > 1), so the
  // motion itself has evidence, not just the rest state.
  const stillFrames = [
    { name: "beat0-early-f5", frame: 5 },
    { name: "beat0-settled-f65", frame: 65 },
    { name: "beat1-settled-f140", frame: BEAT_FRAMES + 65 },
    { name: "beat2-settled-f215", frame: 2 * BEAT_FRAMES + 65 },
  ];
  for (const { name, frame } of stillFrames) {
    const out = path.join(OUT_DIR, `multi-image-beat-${name}.png`);
    await renderStill({ serveUrl, composition, frame, output: out, puppeteerInstance: browser, browserExecutable: CHROME, logLevel: "error" });
    console.log(`still f${frame} -> ${out}`);
  }

  console.log(`rendering ${composition.durationInFrames} frames @ ${composition.fps}fps -> ${OUT_MP4}`);
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation: OUT_MP4,
    puppeteerInstance: browser,
    browserExecutable: CHROME,
    logLevel: "info",
    concurrency: 1,
    onProgress: ({ renderedFrames, encodedFrames }) => {
      console.log(`progress: rendered ${renderedFrames}/${composition.durationInFrames}, encoded ${encodedFrames}`);
    },
  });

  console.log(`done -> ${OUT_MP4}`);
  // See render-image-beat-clip.mjs's identical comment: browser.close()
  // hung indefinitely on a prior run well after all real work had already
  // finished and the file was fully written — force exit instead.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
