#!/usr/bin/env node
/**
 * layout-proof.mjs — does the plan's `layout` change what is RENDERED? (CI: .github/workflows/layout-proof.yml)
 *
 * The same beat (scripts/fixtures/layout-proof/{a,b}.json — one NUMBER-FULL beat, ch-05's accent)
 * is rendered twice by the real renderer (scripts/qa-canvas-render.mjs -> Remotion -> full-canvas.jsx)
 * with two different planner layouts: A, a 2-column grid with the headline right and the figure
 * bottom-left; B, a 4-column grid with the headline left and the figure bottom-right.
 *
 *   node scripts/layout-proof.mjs <stillA.png> <stillB.png>
 *
 * Exits 1 unless (1) both layouts are legal and USED by canvasLayout (not the table fallback), and
 * (2) the rendered PIXELS put the ink on opposite sides: the middle zone's ink centroid (the figure)
 * left of the frame's centre in A and right of it in B, the top zone's (the headline) the other way.
 * If the hardwired table still decided the render, both stills would be the same arrangement.
 */
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { canvasLayout, normalizeCanvas } from "../src/skills/remotion-render/visual/canvas-layout.js";

const [stillA, stillB] = process.argv.slice(2);
if (!stillA || !stillB) { console.error("usage: node scripts/layout-proof.mjs <stillA.png> <stillB.png>"); process.exit(2); }
let bad = 0;
const fail = (m) => { console.log(`FAIL ${m}`); bad++; };
const ok = (m) => console.log(`ok   ${m}`);

const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/layout-proof/${n}.json`, import.meta.url), "utf8"))[0].c;
for (const n of ["a", "b"]) {
  const L = canvasLayout(normalizeCanvas(fx(n), 20));
  if (L.layout?.used) ok(`layout ${n.toUpperCase()} (${L.layout.cols}x${L.layout.rows}) is used — placed ${L.layout.placed.map((p) => `${p.id}@${p.x},${p.y}`).join(", ")}`);
  else fail(`layout ${n.toUpperCase()} fell back to the table: ${(L.layout?.rejected || []).join("; ")}`);
}

/** Ink centroid x (0..1) of a band of the still: pixels darker than luma 200 on the white ground. */
async function centroid(file, y0, y1) {
  const { data, info } = await sharp(file).resize(270, 480, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const r0 = Math.floor((y0 / 1920) * info.height), r1 = Math.floor((y1 / 1920) * info.height);
  let sx = 0, n = 0;
  for (let y = r0; y < r1; y++) for (let x = 0; x < info.width; x++) {
    const o = (y * info.width + x) * 3;
    if (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2] < 200) { sx += x; n++; }
  }
  return n ? { x: sx / n / info.width, n } : { x: null, n: 0 };
}
const zones = { top: [130, 620], middle: [620, 1340] };
const c = {};
for (const [name, f] of [["A", stillA], ["B", stillB]]) {
  c[name] = { top: await centroid(f, ...zones.top), middle: await centroid(f, ...zones.middle) };
  console.log(`     ${name}: top-zone ink centroid x ${c[name].top.x?.toFixed(3)} (${c[name].top.n} px), middle-zone ${c[name].middle.x?.toFixed(3)} (${c[name].middle.n} px)`);
}
c.A.middle.x !== null && c.A.middle.x < 0.5 ? ok("A: the figure is drawn left of centre") : fail(`A: the figure is not left of centre (${c.A.middle.x})`);
c.B.middle.x !== null && c.B.middle.x > 0.5 ? ok("B: the figure is drawn right of centre") : fail(`B: the figure is not right of centre (${c.B.middle.x})`);
c.A.top.x !== null && c.B.top.x !== null && c.A.top.x > c.B.top.x ? ok("the headline sits further right in A than in B") : fail(`headline: A ${c.A.top.x} vs B ${c.B.top.x}`);
console.log(bad ? `${bad} FAILED — the two layouts did not render as two arrangements` : "all pass — two layouts, two rendered arrangements");
process.exit(bad ? 1 : 0);
