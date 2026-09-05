/**
 * Renders one real clip per remocn component into data/renders/remocn/.
 * Lives inside src/skills/remotion-render/ so bare @remotion/* imports
 * resolve against this subpackage's node_modules, same as the qa-scripts.
 */
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { findChrome } from "../find-chrome.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..", "..");
const OUT = join(ROOT, "data", "renders", "remocn");
mkdirSync(OUT, { recursive: true });

const IDS = [
  "LineByLineSlide", "SoftBlurIn", "MicroScaleFade",
  "InlineHighlight", "MarkerHighlight",
  "SlotMachineRoll", "MatrixDecode", "NumberWheel", "RollingNumber",
];

console.log("bundling...");
const serveUrl = await bundle({ entryPoint: join(__dirname, "index.ts") });
const browserExecutable = findChrome();
console.log("chrome:", browserExecutable || "(remotion-managed)");

const results = [];
for (const id of IDS) {
  try {
    const composition = await selectComposition({ serveUrl, id, ...(browserExecutable ? { browserExecutable } : {}) });
    const outputLocation = join(OUT, `${id}.mp4`);
    await renderMedia({
      composition, serveUrl, codec: "h264", outputLocation,
      imageFormat: "png", crf: 20, pixelFormat: "yuv420p",
      chromiumOptions: { gl: "swangle" }, concurrency: 2,
      timeoutInMilliseconds: 120000, logLevel: "error",
      ...(browserExecutable ? { browserExecutable } : {}),
    });
    console.log(`OK   ${id} -> ${outputLocation}`);
    results.push([id, "OK", outputLocation]);
  } catch (err) {
    console.log(`FAIL ${id}: ${err.message.split("\n")[0]}`);
    results.push([id, "FAIL", err.message.split("\n")[0]]);
  }
}
console.log("\n=== SUMMARY ===");
for (const [id, status, info] of results) console.log(`${status.padEnd(5)} ${id.padEnd(18)} ${info}`);
