#!/usr/bin/env node
/**
 * Prove every procedural object draws inside the box it was given.
 *
 *   node qa-scripts/audit-object-bounds.mjs
 *   node qa-scripts/audit-object-bounds.mjs --palette dark
 *
 * Renders the ObjectAudit composition once — every registered object in its own
 * cell with a `pad` gap around it — and reports any object whose ink reaches
 * into that gap.
 *
 * WHY THIS EXISTS. `template-scene.jsx` sizes and anchors objects against the
 * rect that survives the plan's own camera, and PLN-05 calls that safe. It is
 * only safe if a drawing honours its box. Four did not: ch-09's border line drew
 * at 1.24x (measured: a frame 16px below the safe rect), the film reel at 1.22x,
 * the gear train at 1.05x, and the exhibit tag hung 20% past the right edge.
 * Three of those four had never rendered outside the safe rect yet — they were
 * waiting for a template that anchored them near a margin.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { findChrome } from "../find-chrome.js";
import { decodePNG } from "../decode-png.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const dark = process.argv.includes("--palette") && process.argv[process.argv.indexOf("--palette") + 1] === "dark";

/** Matches the audit composition's own AUDIT constant. Kept in step by hand. */
const COLS = 8, CW = 270, CH = 262, PAD = 34;
/** Same ink threshold as frame-bounds.mjs, so the two agree on what a mark is. */
const INK_DELTA = 26;
/** Antialiasing puts a pixel or two of fringe on a stroke that sits on the edge. */
const TOLERANCE = 3;

const colors = dark
  ? { ground: "#000000", paper: "#E8E8EC", ink: "#000000", onGround: "#E8E8EC", accent: "#F5536B" }
  : { ground: "#FFFFFF", paper: "#FFFFFF", ink: "#0F172A", onGround: "#0F172A", accent: "#22C55E" };

const CHROME = findChrome();
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
const composition = await selectComposition({
  serveUrl, id: "ObjectAudit", inputProps: { colors },
  ...(CHROME ? { browserExecutable: CHROME } : {}),
});
const out = join(ROOT, "data/renders/audit", `objects-${dark ? "dark" : "light"}.png`);
mkdirSync(dirname(out), { recursive: true });
await renderStill({
  composition, serveUrl, inputProps: { colors }, chromiumOptions: { gl: "swangle" },
  timeoutInMilliseconds: 240000, logLevel: "error",
  ...(CHROME ? { browserExecutable: CHROME } : {}),
  output: out, imageFormat: "png", frame: 0,
});

/**
 * The object list, read from the two source files rather than imported.
 *
 * Node cannot import the .jsx drawing files, and importing registry.js alone
 * gives an empty map — the first run of this script reported "0 object(s)" and
 * a clean pass, which is the worst possible failure mode for a checker. Both
 * files are scanned and the names sorted exactly as knownObjects() sorts them,
 * so this list is the same order the composition drew in.
 */
const names = [...new Set(
  ["index.jsx", "library.jsx"].flatMap((f) =>
    [...readFileSync(join(RENDER_DIR, "compositions", "objects", f), "utf-8")
      .matchAll(/registerObject\("([^"]+)"/g)].map((m) => m[1]))
)].sort();
if (!names.length) { console.error("no registerObject calls found — the scan is broken, not the objects"); process.exit(2); }

const png = decodePNG(out);
const { width, height, channels, data } = png;
const at = (x, y) => { const i = (y * width + x) * channels; return [data[i], data[i + 1], data[i + 2]]; };
const bg = at(2, 2);
const isInk = (x, y) => {
  const [r, g, b] = at(x, y);
  return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) >= INK_DELTA;
};

const bad = [];
names.forEach((name, i) => {
  const cx = (i % COLS) * CW, cy = Math.floor(i / COLS) * CH;
  const bx0 = cx + PAD, by0 = cy + PAD, bx1 = cx + CW - PAD, by1 = cy + CH - PAD;
  let over = 0;
  for (let y = cy; y < Math.min(cy + CH, height); y++) {
    for (let x = cx; x < Math.min(cx + CW, width); x++) {
      const inside = x >= bx0 - TOLERANCE && x < bx1 + TOLERANCE && y >= by0 - TOLERANCE && y < by1 + TOLERANCE;
      if (inside || !isInk(x, y)) continue;
      over = Math.max(over, Math.max(bx0 - x, x - bx1, by0 - y, y - by1));
    }
  }
  if (over > 0) bad.push([name, over]);
});

console.log(`object bounds audit (${dark ? "dark" : "light"} palette): ${names.length} object(s)`);
for (const [name, over] of bad) console.log(`  OUT OF BOX  ${name.padEnd(30)} ${over}px past its own box`);
console.log(bad.length ? `\n${bad.length} object(s) draw outside their box. The box is the contract.` : "\nEvery object stays inside its box.");
console.log(`sheet: ${out.replace(ROOT + "/", "")}`);
process.exit(bad.length ? 1 : 0);
