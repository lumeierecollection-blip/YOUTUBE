// Renders individual frames (stills) of compositions from a job file; no timeline is ever rendered. For the long-form visual approval gate:
// the owner approves screenshots of the real production components before any full video is made.
// Job: { outDir, shots: [{ name, id, props, frame, durationInFrames?, scale? }] }. One bundle and one browser for every shot.
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findChrome } from "./find-chrome.js";

const job = JSON.parse(readFileSync(process.argv[2], "utf8"));
const d = process.cwd(), chrome = findChrome();
const opts = { ...(chrome ? { browserExecutable: chrome } : {}), chromiumOptions: { gl: "swangle" }, timeoutInMilliseconds: 180000 };
mkdirSync(job.outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: join(d, "Root.jsx"), publicDir: join(d, "public"), onProgress: () => {} });
const puppeteerInstance = await openBrowser("chrome", { ...(chrome ? { browserExecutable: chrome } : {}), chromiumOptions: { gl: "swangle" } });
for (const s of job.shots) {
  const composition = await selectComposition({ serveUrl, id: s.id, inputProps: s.props, puppeteerInstance, ...opts });
  if (s.durationInFrames) composition.durationInFrames = s.durationInFrames;
  await renderStill({ composition, serveUrl, frame: Math.min(s.frame || 0, composition.durationInFrames - 1), output: join(job.outDir, `${s.name}.png`), inputProps: s.props, scale: s.scale || 1, puppeteerInstance, ...opts });
  console.log("still", s.name, "frame", s.frame);
}
await puppeteerInstance.close({ silent: true });
process.exit(0);
