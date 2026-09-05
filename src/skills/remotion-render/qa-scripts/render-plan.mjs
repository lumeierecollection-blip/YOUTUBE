#!/usr/bin/env node
/**
 * Render one structured plan through the TemplatePlanShorts composition.
 *
 *   node qa-scripts/render-plan.mjs --plan data/plans/ch-01-accumulation.plan.json --still
 *   node qa-scripts/render-plan.mjs --plan ... --out data/renders/plan/ch-01.mp4
 *
 * The renderer takes the plan and nothing else, so this passes the plan and
 * nothing else. No channel id reaches the composition.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, renderMedia } from "@remotion/renderer";
import { findChrome } from "../find-chrome.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const planPath = arg("plan");
if (!planPath) { console.error("--plan required"); process.exit(1); }
const plan = JSON.parse(readFileSync(join(ROOT, planPath), "utf-8"));
const still = process.argv.includes("--still");
const out = join(ROOT, arg("out", `data/renders/plan/${plan.template}.${still ? "png" : "mp4"}`));
mkdirSync(dirname(out), { recursive: true });

const CHROME = findChrome();
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
const composition = await selectComposition({
  serveUrl, id: "TemplatePlanShorts", inputProps: { plan },
  ...(CHROME ? { browserExecutable: CHROME } : {}),
});
const total = plan.beat.startFrame + plan.beat.durationInFrames;
const common = {
  composition: { ...composition, durationInFrames: total },
  serveUrl, inputProps: { plan }, chromiumOptions: { gl: "swangle" },
  timeoutInMilliseconds: 180000, logLevel: "error",
  ...(CHROME ? { browserExecutable: CHROME } : {}),
};
if (still) {
  await renderStill({ ...common, output: out, imageFormat: "png", frame: Math.round(total * 0.8) });
} else {
  await renderMedia({ ...common, outputLocation: out, codec: "h264", crf: 20 });
}
console.log("wrote", out.replace(ROOT + "/", ""));
