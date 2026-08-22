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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("bundling minimal entry...");
  const entryPoint = path.join(repo, "src", "skills", "remotion-render", "effects", "_minimal-probe-entry.jsx");
  const serveUrl = await bundle({ entryPoint, publicDir: PUBLIC_DIR, onProgress: () => {} });
  const browser = await openBrowser("chrome", { browserExecutable: CHROME });
  for (const id of ["minimal-vignette-noise-ca", "minimal-lut-only"]) {
    const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, browserExecutable: CHROME });
    for (const frame of [15]) {
      const out = path.join(OUT_DIR, `${id}-f${frame}.png`);
      await renderStill({ serveUrl, composition, frame, output: out, puppeteerInstance: browser, browserExecutable: CHROME, logLevel: "error", timeoutInMilliseconds: 60000 });
      console.log(`OK ${id} frame ${frame} -> ${out}`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
