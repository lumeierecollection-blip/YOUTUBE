/**
 * What arrival times does popGroups actually produce for ch-2 beat 5?
 *
 * The manifest's canvas is the real thing the compositor consumed, so this reproduces the
 * exact `at` values full-canvas.jsx:1287 feeds to popInState(local - POP.START - at).
 * No rendering involved.
 */
import { readFileSync } from "node:fs";
import { normalizeCanvas, canvasLayout } from "../src/skills/remotion-render/visual/canvas-layout.js";
import { popGroups, POP } from "../src/skills/remotion-render/visual/pop-groups.js";

const MF = "data/audit/a1-ci/r2/data/renders/2/avalonbay-40m-rent-overcharge-lawsuit-2026-shorts-shorts-2026-10-05-manifest.json";
const m = JSON.parse(readFileSync(MF, "utf8"));

console.log("beat contiguity from the manifest (start_sec + duration_sec vs next start_sec):");
for (let i = 0; i < m.beats.length - 1; i++) {
  const a = m.beats[i], b = m.beats[i + 1];
  const end = a.start_sec + a.duration_sec;
  const gap = +(b.start_sec - end).toFixed(4);
  console.log(`  beat ${a.index}->${b.index}: end=${end.toFixed(3)}  next start=${b.start_sec.toFixed(3)}  gap=${gap}s (${(gap * 30).toFixed(1)} frames)` + (Math.abs(gap) > 0.001 ? "   <== NOT CONTIGUOUS" : ""));
}

console.log(`\nPOP = ${JSON.stringify(POP)}`);
for (const idx of [4, 5]) {
  const b = m.beats.find((x) => x.index === idx);
  const c = normalizeCanvas(b.canvas, idx);
  const L = canvasLayout(c);
  const gs = popGroups(c, L);
  console.log(`\nbeat ${idx} (${b.canvas.composition}) entrance_style=${b.canvas.entrance_style}  groups:`);
  for (const g of gs) {
    // full-canvas.jsx:1287 -> popInState(local - POP.START - g.at)
    const firstInk = POP.START + g.at + 1;          // popInState f>0
    const fullAt = POP.START + g.at + POP.IN;       // popInState f>=POP.IN
    console.log(`  key=${String(g.key).padEnd(7)} major=${String(!!g.major).padEnd(5)} at=${String(g.at).padEnd(3)} -> first ink at local frame ${firstInk}, fully in at ${fullAt}`);
  }
}