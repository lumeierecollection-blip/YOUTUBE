/**
 * render-full.mjs — Render the full MWAFullScene (35s) to MP4.
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const ROOT = resolve(__dirname, "..", "..");

const COMPOSITION_ID = "MWAFull";
const ENTRY_POINT = resolve(__dirname, "MWAFullScene.jsx");
const OUTPUT = resolve(ROOT, "render", "mwaa-ai-agent-skills-full.mp4");
const CONTACT_SHEET = resolve(ROOT, "review", "frames", "mwaa-full-contact-sheet.jpg");
const PROBE_JSON = resolve(ROOT, "review", "frames", "mwaa-full-probe.json");

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const DURATION_SEC = 35;
const DURATION_FRAMES = 1050; // 35 seconds

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function main() {
  console.log("[render] Bundling Remotion entry point...");
  const serveUrl = await bundle({
    entryPoint: ENTRY_POINT,
    webpackOverride: (config) => config,
  });
  console.log(`[render] Bundle ready: ${serveUrl}`);

  console.log("[render] Selecting composition...");
  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps: {},
    browserExecutable: CHROME,
  });

  const compositionWithDuration = {
    ...composition,
    durationInFrames: DURATION_FRAMES,
  };

  console.log(`[render] Rendering ${DURATION_FRAMES} frames (${DURATION_SEC}s) at ${WIDTH}x${HEIGHT}...`);
  await renderMedia({
    composition: compositionWithDuration,
    serveUrl,
    codec: "h264",
    audioCodec: "aac",
    encodeOptions: {
      crf: 18,
      preset: "slow",
    },
    inputProps: {},
    outputLocation: OUTPUT,
    imageFormat: "jpeg",
    concurrency: 2,
    timeoutInMilliseconds: 900000,
  });
  console.log(`[render] Render complete: ${OUTPUT}`);

  mkdirSync(resolve(ROOT, "review", "frames"), { recursive: true });

  console.log("[render] Generating contact sheet...");
  execFileSync("ffmpeg", [
    "-loglevel", "error", "-y",
    "-i", OUTPUT,
    "-vf", `fps=5/${DURATION_SEC},scale=320:-1,tile=5x1:padding=8:margin=8:color=white`,
    "-frames:v", "1",
    CONTACT_SHEET,
  ]);
  console.log(`[render] Contact sheet: ${CONTACT_SHEET}`);

  console.log("[render] Generating probe JSON...");
  const probeOutput = execFileSync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_avg_frame_rate,nb_frames",
    "-show_entries", "format=duration,size",
    "-of", "json",
    OUTPUT,
  ], { encoding: "utf8" });
  writeFileSync(PROBE_JSON, probeOutput);
  console.log(`[render] Probe JSON: ${PROBE_JSON}`);
  console.log(probeOutput);
}

main().catch((err) => {
  console.error("[render] ERROR:", err.message);
  process.exit(1);
});
