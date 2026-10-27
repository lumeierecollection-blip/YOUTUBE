/**
 * Renders a persisted editor timeline (schemas/editor-timeline.json) through
 * the EditorTimeline composition. The timeline file is the single input: what
 * is in it is drawn, what is not in it is not. Called from render.js when
 * EDITOR_TIMELINE_PATH is set.
 */
import os from "os";
import { readFileSync, mkdirSync, existsSync, copyFileSync, writeFileSync } from "fs";
import { join, dirname, basename, isAbsolute, resolve } from "path";
import { fileURLToPath } from "url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { findChrome } from "./find-chrome.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const abs = (p) => (isAbsolute(p) ? p : join(ROOT, p));

/** Copy every asset file into the bundle's public/editor/ and return the timeline with `path` pointing there. */
export function stageTimelineAssets(timeline, publicDirs) {
  const out = { ...timeline, assets: {} };
  for (const [id, a] of Object.entries(timeline.assets || {})) {
    const src = abs(a.file);
    if (!existsSync(src)) throw new Error(`editor asset ${id} missing on disk: ${a.file}`);
    const rel = `editor/${basename(src)}`;
    for (const dir of publicDirs) {
      const dst = join(dir, ...rel.split("/"));
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
    }
    out.assets[id] = { ...a, path: rel };
  }
  return out;
}

export async function renderEditor({ timelinePath, audioPath, outputPath, scale = 1 }) {
  const timeline = JSON.parse(readFileSync(abs(timelinePath), "utf-8"));
  if (!audioPath || !existsSync(abs(audioPath))) {
    throw new Error(`editor render: voiceover not found (${audioPath}). Refusing to render a silent video.`);
  }
  copyFileSync(abs(audioPath), join(__dirname, "vo.mp3"));

  const pubDirs = [join(__dirname, "public")];
  const serveDir = process.env.REMOTION_SERVE_URL;
  if (serveDir && !/^https?:/.test(serveDir) && existsSync(serveDir)) pubDirs.push(join(serveDir, "public"));
  const staged = stageTimelineAssets(timeline, pubDirs);

  const chrome = findChrome();
  const browserOpts = chrome ? { browserExecutable: chrome } : {};
  const serveUrl = serveDir || (await bundle({ entryPoint: join(__dirname, "Root.jsx"), publicDir: join(__dirname, "public"), onProgress: () => {} }));
  const props = { timeline: staged, ttsAudioPath: audioPath };
  const composition = await selectComposition({ serveUrl, id: "EditorTimeline", inputProps: props, ...browserOpts });
  const frames = staged.durationInFrames;

  mkdirSync(dirname(abs(outputPath)), { recursive: true });
  let last = 0;
  await renderMedia({
    composition: { ...composition, durationInFrames: frames, width: staged.width || composition.width, height: staged.height || composition.height },
    serveUrl,
    codec: "h264",
    audioCodec: "aac",
    enforceAudioTrack: true,
    inputProps: props,
    outputLocation: abs(outputPath),
    ...browserOpts,
    imageFormat: "jpeg",
    crf: parseInt(process.env.RENDER_CRF, 10) || 20,
    pixelFormat: "yuv420p",
    concurrency: Math.max(2, Math.min(parseInt(process.env.RENDER_CONCURRENCY, 10) || 8, os.cpus().length)),
    audioBitrate: "192k",
    scale,
    timeoutInMilliseconds: 120000,
    onProgress: ({ renderedFrames }) => {
      if (renderedFrames - last >= 150 || renderedFrames >= frames - 1) {
        last = renderedFrames;
        console.log(`[editor-render] ${renderedFrames}/${frames} frames`);
      }
    },
  });
  console.log(`Rendered: ${outputPath}  (${frames} frames, editor timeline ${timelinePath})`);
  writeFileSync(abs(outputPath).replace(/\.mp4$/, "-render.json"), JSON.stringify({ timeline: timelinePath, frames, output: outputPath }, null, 2));
  return outputPath;
}
