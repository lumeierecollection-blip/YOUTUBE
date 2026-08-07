// audit-render Stage 1 fixture — RND-04: inputProps reaches the component.
// Minimal render: bundles the REAL Root.jsx, selects MotionGraphicsShorts, and
// renders frame 0 twice with two different `palette` inputProps. The two PNGs
// must differ — the palette prop is consumed by MotionGraphicsShorts
// (motion-graphics.jsx:1218 rolesFromPalette → backgroundColor).
// Mirrors render.js's exact flow: bundle → selectComposition({inputProps}) →
// render({inputProps}).
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";
import { createHash } from "crypto";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(here, "..", "..", "..", "src", "skills", "remotion-render");
const OUT = join(here, "out");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

mkdirSync(OUT, { recursive: true });

const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
console.log("bundled:", serveUrl);

const browserInstance = await openBrowser({ browserExecutable: CHROME, chromiumOptions: { gl: "angle" } });

const base = {
  channelId: "fixture",
  style: "motion-graphics",
  format: "shorts",
  sections: [],
  ttsAudioPath: null,
  thumbnailStyle: "dramatic-visual",
  tone: "neutral",
  font: "Inter",
  channelName: "Fixture",
};
const propsA = { ...base, palette: ["#1A1A2E", "#F5536B", "#FFFFFF"] };
const propsB = { ...base, palette: ["#0F3D2E", "#F5C542", "#FFFFFF"] };

const renderStillSafe = async (label, inputProps) => {
  const composition = await selectComposition({
    serveUrl,
    id: "MotionGraphicsShorts",
    browserExecutable: CHROME,
    puppeteerInstance: browserInstance,
    inputProps,
    timeoutInMilliseconds: 120000,
  });
  const out = join(OUT, `${label}.png`);
  await renderStill({
    composition,
    serveUrl,
    output: out,
    frame: 0,
    browserExecutable: CHROME,
    puppeteerInstance: browserInstance,
    inputProps,
    timeoutInMilliseconds: 120000,
  });
  return out;
};

const outA = await renderStillSafe("palette-a", propsA);
const outB = await renderStillSafe("palette-b", propsB);
await browserInstance.close({ silent: true });

const h = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const hA = h(outA);
const hB = h(outB);
console.log("palette-a sha256:", hA);
console.log("palette-b sha256:", hB);
if (hA === hB) {
  console.error("FAIL: two different palette inputProps produced identical frames — inputProps did NOT reach the component");
  process.exit(1);
}
console.log("PASS: distinct inputProps produced distinct frames — inputProps reaches the component");
