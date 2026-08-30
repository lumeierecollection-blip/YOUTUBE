#!/usr/bin/env node
/**
 * Stage-16 FRM-01-style contact sheet builder (native-frame variant).
 *
 * FRM-01's register method extracts 1 frame / 15s from a rendered Short.
 * The only rendered Short on disk (data/renders/1/...2026-08-30.mp4) is
 * STALE — it predates the 2026-08-30 palette fix (16:25), the horizon fix
 * (16:39) and the three scene SFRs (17:44), so a sheet of it would certify
 * a pre-fix artifact. A fresh full-length render cannot complete on this
 * machine (renderMedia stalls ~frame 1171; no GPU), so the honest
 * current-tree artifact is this sheet of the 10 native scale-1.0 frames
 * from the SAME production pipeline (render-frame.mjs -> Root.jsx ->
 * MotionGraphicsShorts). The sheet is evidence of the current tree only.
 *
 * Usage:
 *   node data/audit/16/contact-sheet-native.mjs <dir>
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const [dir] = process.argv.slice(2);
if (!dir) {
  console.error("usage: node data/audit/16/contact-sheet-native.mjs <dir>");
  process.exit(1);
}
const f = (name) => join(dir, name);
const frames = Array.from({ length: 10 }, (_, i) => `frame-${String(i).padStart(2, "0")}.png`);

const inputs = [];
for (const name of frames) inputs.push("-i", f(name));

const w = 270, h = 480, cols = 4, rows = 3, n = 10;
const scales = frames.map((_, i) => `[${i}:v]scale=${w}:${h}[v${i}]`).join(";");
const layout = Array.from(
  { length: n },
  (_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`,
).join("|");
const chains = frames.map((_, i) => `[v${i}]`).join("");

execFileSync("ffmpeg", [
  "-y", ...inputs,
  "-filter_complex",
  `${scales};${chains}xstack=inputs=${n}:layout=${layout}`,
  f("contact-sheet.png"),
], { stdio: "inherit" });
console.log(`contact sheet (${cols}x${rows}, ${w}x${h} tiles) -> ${f("contact-sheet.png")}`);