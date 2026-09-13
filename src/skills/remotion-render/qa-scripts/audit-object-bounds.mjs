#!/usr/bin/env node
/**
 * Prove every procedural object draws inside the box it was given.
 *
 *   node qa-scripts/audit-object-bounds.mjs
 *   node qa-scripts/audit-object-bounds.mjs --palette dark
 *
 * Renders the ObjectAudit composition at several points on the animation clock
 * — every registered object in its own cell with a `pad` gap around it — and
 * reports any object whose ink reaches into that gap at any of them.
 *
 * WHY THIS EXISTS. `template-scene.jsx` sizes and anchors objects against the
 * rect that survives the plan's own camera, and PLN-05 calls that safe. It is
 * only safe if a drawing honours its box. Four did not: ch-09's border line drew
 * at 1.24x (measured: a frame 16px below the safe rect), the film reel at 1.22x,
 * the gear train at 1.05x, and the exhibit tag hung 20% past the right edge.
 * Three of those four had never rendered outside the safe rect yet — they were
 * waiting for a template that anchored them near a margin.
 *
 * A SINGLE PHASE IS NOT A CHECK. This ran at p = 0.85 only and passed all 109.
 * The springtail draws its furcula at `sin(p * 2PI)`, which is zero at 0.85 and
 * full at 0.25, and at full extension it reaches 3.6% of the box width past the
 * left edge — measured as 48px outside the safe rect once the renderer began
 * sweeping p. The sweep below is why that is now caught here instead of in a
 * finished frame.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
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
/**
 * Phases of the animation clock to audit.
 *
 * Chosen to hit the extremes of the trigonometry the drawings actually use:
 * sin(p*2PI) peaks at 0.25 and troughs at 0.75, and a 0->1 build is widest at
 * the end. 0.85 is kept because it is what every earlier run measured.
 */
const PHASES = [0.02, 0.25, 0.5, 0.75, 0.85, 0.99];
mkdirSync(join(ROOT, "data/renders/audit"), { recursive: true });
const sheets = [];
for (const phase of PHASES) {
  const out = join(ROOT, "data/renders/audit", `objects-${dark ? "dark" : "light"}-p${String(Math.round(phase * 100)).padStart(2, "0")}.png`);
  // The composition is re-selected for every phase. Selecting once and varying
  // only renderStill's inputProps produced six sheets with two distinct md5s
  // across six values of p — the prop did not reach the drawings — and the
  // audit then reported a clean pass on a springtail measured 49px outside its
  // box in a finished frame. A checker that silently ignores its own input is
  // worse than no checker.
  const composition = await selectComposition({
    serveUrl, id: "ObjectAudit", inputProps: { colors, p: phase },
    ...(CHROME ? { browserExecutable: CHROME } : {}),
  });
  await renderStill({
    composition, serveUrl, inputProps: { colors, p: phase }, chromiumOptions: { gl: "swangle" },
    timeoutInMilliseconds: 240000, logLevel: "error",
    ...(CHROME ? { browserExecutable: CHROME } : {}),
    output: out, imageFormat: "png", frame: 0,
  });
  sheets.push([phase, out]);
}

// Every sheet must be distinct, or p is not reaching the drawings and the
// sweep is theatre. Two identical sheets at different phases is a broken
// checker, not a set of static drawings: 89 of the 100 reference p.
{
  const seen = new Map();
  for (const [phase, sheet] of sheets) {
    const key = createHash("md5").update(readFileSync(sheet)).digest("hex");
    if (seen.has(key)) {
      console.error(`p is not reaching the drawings: the sheet at p=${phase} is byte-identical to the one at p=${seen.get(key)}`);
      process.exit(2);
    }
    seen.set(key, phase);
  }
}

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
  ["index.jsx", "library.jsx", "nature.jsx"].flatMap((f) =>
    [...readFileSync(join(RENDER_DIR, "compositions", "objects", f), "utf-8")
      .matchAll(/registerObject\("([^"]+)"/g)].map((m) => m[1]))
)].sort();
if (!names.length) { console.error("no registerObject calls found — the scan is broken, not the objects"); process.exit(2); }

/** name -> [worst overshoot in px, the phase it happened at] */
const worst = new Map();
for (const [phase, sheet] of sheets) {
  const png = decodePNG(sheet);
  const { width, height, channels, data } = png;
  const at = (x, y) => { const i = (y * width + x) * channels; return [data[i], data[i + 1], data[i + 2]]; };
  const bg = at(2, 2);
  const isInk = (x, y) => {
    const [r, g, b] = at(x, y);
    return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) >= INK_DELTA;
  };
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
    if (over > 0 && over > (worst.get(name)?.[0] ?? 0)) worst.set(name, [over, phase]);
  });
}

const bad = [...worst.entries()].sort((a, b) => b[1][0] - a[1][0]);
console.log(`object bounds audit (${dark ? "dark" : "light"} palette): ${names.length} object(s) x ${PHASES.length} phase(s)`);
for (const [name, [over, phase]] of bad) console.log(`  OUT OF BOX  ${name.padEnd(30)} ${over}px past its own box at p=${phase}`);
console.log(bad.length ? `\n${bad.length} object(s) draw outside their box. The box is the contract.` : "\nEvery object stays inside its box at every phase.");
for (const [phase, sheet] of sheets) console.log(`sheet p=${phase}: ${sheet.replace(ROOT + "/", "")}`);
process.exit(bad.length ? 1 : 0);
