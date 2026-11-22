// Renders one composition from a job file, for the channel preview pipeline.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findChrome } from "./find-chrome.js";

const job = JSON.parse(readFileSync(process.argv[2], "utf8"));
const d = process.cwd(), chrome = findChrome();
const browser = { ...(chrome ? { browserExecutable: chrome } : {}), chromiumOptions: { gl: "swangle" }, timeoutInMilliseconds: 180000 };
const serveUrl = await bundle({ entryPoint: join(d, "Root.jsx"), publicDir: join(d, "public"), onProgress: () => {} });
const composition = await selectComposition({ serveUrl, id: job.id, inputProps: job.props, ...browser });
if (job.durationInFrames) composition.durationInFrames = job.durationInFrames;
await renderMedia({ composition, serveUrl, codec: "h264", crf: 18, outputLocation: job.output, inputProps: job.props, concurrency: Number(process.env.RENDER_CONCURRENCY) || 2, ...browser });
console.log("rendered", job.output);
process.exit(0);
