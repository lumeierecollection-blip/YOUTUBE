#!/usr/bin/env node
/**
 * diagnose-margins.mjs — WHERE do the leaked margin pixels actually live?
 *
 * Runs the EXACT sampling frame-audit.js uses (same MARGINS probes, same
 * step-2 grid, same FG_DIFF=20 against the audit's bg computation) on the
 * Stage-16 pre-fix frames, then additionally produces a per-row / per-column
 * profile of foreground pixels OUTSIDE the safe rect, so we can see which
 * probe y-band carries the leak instead of guessing from geometry.
 *
 * Read-only over data/audit/16/review-oldts/*.png. No writes.
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] || "data/audit/16/review-oldts");
const SAFE = { top: 288, right: 888, bottom: 1248, left: 48 };
const W = 1080, H = 1920;

/* Mirror of frame-audit.js MARGINS. */
const MARGINS = [
  { name: "top-margin",            x: 200, y: 100,  w: 400, h: 120 },
  { name: "right-margin",          x: 940, y: 400,  w: 120, h: 400 },
  { name: "headline-right-margin", x: 940, y: 964,  w: 120, h: 284 },
  { name: "bottom-margin",         x: 200, y: 1600, w: 400, h: 160 },
];
const FG_DIFF = 20;

async function load(file) {
  const buf = await sharp(file).resize(W, H).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = buf;
  const px = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const firstPixel = (m) => px(m.x, m.y);
  const bg = [
    Math.round(MARGINS.reduce((a, m) => a + firstPixel(m)[0], 0) / 4),
    Math.round(MARGINS.reduce((a, m) => a + firstPixel(m)[1], 0) / 4),
    Math.round(MARGINS.reduce((a, m) => a + firstPixel(m)[2], 0) / 4),
  ];
  const isFg = (x, y) => {
    const [r, g, b] = px(x, y);
    return Math.abs(r - bg[0]) > FG_DIFF || Math.abs(g - bg[1]) > FG_DIFF || Math.abs(b - bg[2]) > FG_DIFF;
  };
  return { data, info, bg, isFg };
}

const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

for (const f of manifest.frames) {
  const { bg, isFg } = await load(f.file);
  const tag = f.file.split(/[\\/]/).pop();

  // 1) Per-probe fraction, exact audit sampling (step 2).
  const perProbe = {};
  let fgTotal = 0, sampleTotal = 0;
  for (const m of MARGINS) {
    let fg = 0, n = 0;
    for (let yy = m.y; yy < m.y + m.h; yy += 2)
      for (let xx = m.x; xx < m.x + m.w; xx += 2) {
        n++; if (isFg(xx, yy)) fg++;
      }
    perProbe[m.name] = fg / n;
    fgTotal += fg; sampleTotal += n;
  }

  // 2) Row profile below the safe rect (the "crosses SAFE.bottom" region)
  //    and through each margin band: how many FG columns per y-row (all x,
  //    step 2), split into x-bands so we know if it is full-width geometry.
  const bands = [
    { name: "y1248-1600 (below safe)", y0: 1249, y1: 1600 },
    { name: "y1600-1760 (bottom-margin)", y0: 1600, y1: 1760 },
    { name: "y1760-1920 (canvas foot)", y0: 1760, y1: 1920 },
    { name: "y964-1248 (headline/caption right strip)", y0: 964, y1: 1248 },
  ];
  const xBands = [
    { name: "x0-48", x0: 0, x1: 48 },
    { name: "x48-888 (safe)", x0: 48, x1: 888 },
    { name: "x888-940 (right inset)", x0: 888, x1: 940 },
    { name: "x940-1060 (right margin)", x0: 940, x1: 1060 },
    { name: "x1060-1080 (canvas edge)", x0: 1060, x1: 1080 },
  ];
  const rowStats = bands.map((b) => {
    const rows = [];
    for (let y = b.y0; y <= b.y1; y++) {
      let c = 0;
      const perX = new Array(xBands.length).fill(0);
      for (let x = 0; x < W; x += 2) {
        if (isFg(x, y)) {
          c++;
          for (let bi = 0; bi < xBands.length; bi++) {
            const xb = xBands[bi];
            if (x >= xb.x0 && x < xb.x1) { perX[bi]++; break; }
          }
        }
      }
      if (c > 0) rows.push({ y, c, perX });
    }
    // Compress: report row groups with the same count signature.
    rows.sort((a, b) => b.c - a.c);
    return { band: b.name, fgRows: rows.length, max: rows[0] || null, rows: rows.slice(0, 12) };
  });

  // 3) Which probe carries the leak (top offenders).
  const worst = Object.entries(perProbe).sort((a, b) => b[1] - a[1]);

  console.log(`\n=== ${tag}  bg=rgb(${bg.join(",")})  totalMarginFg=${(fgTotal / sampleTotal * 100).toFixed(3)}%`);
  for (const [name, frac] of worst)
    console.log(`    ${" ".repeat(24 - name.length)}${name}: ${(frac * 100).toFixed(3)}%`);
  for (const s of rowStats) {
    const top = s.rows.slice(0, 5).map(
      (r) => `y${r.y}:${r.c}${r.perX.map((p, i) => (p ? ` ${xBands[i].name.split(" ")[0]}=${p}` : "")).join("")}`
    ).join("  ");
    console.log(`    ${s.band}: ${s.fgRows} fg rows  max=${s.max ? `y${s.max.y} c=${s.max.c}` : "none"}  ${top}`);
  }
}