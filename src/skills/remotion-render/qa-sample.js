/**
 * QA sample renderer — cheap 6s half-resolution sample for the mograph-critic loop.
 *
 * The style compositions are fully data-driven (no defaultProps): props come from
 * render.js at full render time. This helper bakes real mg data into a small entry
 * and renders ONLY frames 0..179 at 540x960 so qa_frames.py can analyse it.
 *
 * Usage:
 *   node qa-sample.js <channel-id> <srt-path> <out-mp4> [frames]
 *
 * Example:
 *   node qa-sample.js 2 data/tts/2/what-to-say-traffic-stop-script-vo.srt out/qa.mp4
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { buildMgPackage } from "./compositions/mg-package.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");

const CHROME_WIN = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CHROME = existsSync(CHROME_WIN) ? CHROME_WIN : undefined;
const SAMPLE_FRAMES = 180; // 6s at 30fps

function loadChannel(channelId) {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  const channel = channels.find((c) => c.id === numId || c.channel_id === channelId);
  if (!channel) throw new Error(`Channel "${channelId}" not found`);
  return channel;
}

async function main() {
  const [channelId, srtArg, outArg, framesArg] = process.argv.slice(2);
  if (!channelId || !srtArg || !outArg) {
    console.error("Usage: node qa-sample.js <channel-id> <srt-path> <out-mp4> [frames]");
    process.exit(1);
  }

  const channel = loadChannel(channelId);
  const srtPath = join(ROOT, srtArg.replace(/\//g, "\\"));
  if (!existsSync(srtPath)) throw new Error(`SRT not found: ${srtPath}`);
  const srtText = readFileSync(srtPath, "utf-8");

  const mg = buildMgPackage(srtText, { iconMap: channel.icon_map || null });
  const frames = Math.min(parseInt(framesArg, 10) || SAMPLE_FRAMES, mg.totalFrames);

  const entryPath = join(__dirname, "qa-entry.jsx");
  const props = {
    mg,
    font: channel.font || "DM Sans",
    palette: channel.thumbnail_spec?.color_palette || null,
    channelName: channel.channel_name || "",
  };
  const defaults = JSON.stringify(props, null, 2).replace(/</g, "\\u003c");
  const entry = `import React from "react";
import { Composition, registerRoot } from "remotion";
import { MotionGraphicsShorts } from "./compositions/motion-graphics.jsx";

const DEFAULTS = ${defaults};

const Root = () => (
  <Composition
    id="QaComp"
    component={MotionGraphicsShorts}
    durationInFrames={${mg.totalFrames}}
    fps={30}
    width={540}
    height={960}
    defaultProps={DEFAULTS}
  />
);

registerRoot(Root);
`;
  writeFileSync(entryPath, entry, "utf-8");
  console.log(`QA entry written (${mg.beats.length} beats, ${mg.totalFrames}f total, sampling 0-${frames - 1})`);

  const outPath = resolve(outArg);
  mkdirSync(dirname(outPath), { recursive: true });

  const serveUrl = await bundle({ entryPoint: entryPath, onProgress: () => {} });
  const composition = await selectComposition({ serveUrl, id: "QaComp", browserExecutable: CHROME });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    frameRange: [0, frames - 1],
    outputLocation: outPath,
    browserExecutable: CHROME,
    concurrency: 1,
    timeoutInMilliseconds: 120000,
  });
  console.log("QA sample rendered:", outPath);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
