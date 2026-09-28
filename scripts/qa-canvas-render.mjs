#!/usr/bin/env node
/**
 * qa-canvas-render.mjs — renders the full-canvas renderer (visual/full-canvas.jsx)
 * from a hand-built plan that exercises every composition, all three motion
 * tiers, a camera focus, a match cut and a persisted element — so a change to
 * the renderer is checked on REAL rendered frames, not by reading code.
 *
 *   node scripts/qa-canvas-render.mjs --out <dir> [--video] [--accent "#1B7A4D"] [--photo entities/people/x.jpg]
 *
 * Writes <dir>/beat-<i>-<pct>.png stills (and <dir>/canvas-test.mp4 with
 * --video, at 0.5 scale) plus <dir>/plan.json. Captions use made-up word
 * timings (a test plan has no voiceover); everything else is the real path.
 */
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, renderMedia } from "@remotion/renderer";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RR = join(ROOT, "src", "skills", "remotion-render");
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const out = arg("out", join(ROOT, "data", "qa", "canvas"));
const accent = arg("accent", "#1B7A4D");
const photo = arg("photo", "entities/people/jerome-powell.jpg");
mkdirSync(out, { recursive: true });

const FPS = 30, D = 90;
const beatsSpec = [
  { text: "Why does the fifty thirty twenty rule break now?", c: { visual_type: "TYPE", headline: "Why the 50/30/20 rule breaks", lead_in: "a budget rule", motion_tier: "major" } },
  { text: "The fraud cost investors one hundred five million dollars.", c: { visual_type: "COUNTER", data: { value: "$105M", label: "lost by investors" }, headline: "investor losses", motion_tier: "medium" } },
  { text: "Needs take fifty percent, wants thirty, savings twenty.", c: { visual_type: "BAR", data: { bars: [{ label: "needs", value: "50%" }, { label: "wants", value: "30%" }, { label: "savings", value: "20%" }] }, headline: "where the money goes", lead_in: "the split", motion_tier: "medium" } },
  { text: "Housing alone is thirty four percent of income.", c: { visual_type: "PIE", data: { percent: 34, label: "of income on housing" }, headline: "housing share", motion_tier: "medium", camera_focus: [{ at_percent: 0.45, target: "number" }] } },
  { text: "Forty five percent of renters are cost burdened.", c: { visual_type: "GAUGE", data: { percent: 45, label: "renters cost-burdened" }, headline: "cost burden", motion_tier: "medium", persists_from: 3 } },
  { text: "Rates went from two to four point five percent.", c: { visual_type: "LINE", data: { points: [{ label: "2022", value: "2%" }, { label: "2024", value: "3.5%" }, { label: "2026", value: "4.5%" }] }, headline: "the rate climb", motion_tier: "medium", camera_focus: [{ at_percent: 0.35, target: "chart" }, { at_percent: 0.75, target: "full" }] } },
  { text: "Jerome Powell said the Fed would hold rates.", c: { visual_type: "PHOTO", data: { entity: "Jerome Powell" }, photo: { asset: photo, entity: "Jerome Powell", kind: "person", credit: "Photo: Wikimedia Commons, Public domain" }, headline: "the Fed holds", motion_tier: "major" } },
  { text: "Higher rates raise rent, and rent cuts savings.", c: { visual_type: "PROCESS", data: { nodes: ["higher rates", "rent", "savings"] }, headline: "the chain", motion_tier: "major" } },
  { text: "In Iran, prices rose again.", c: { visual_type: "MAP", data: { place: "Iran" }, headline: "prices rose", motion_tier: "micro" } },
  { text: "Two rules now matter most.", c: { visual_type: "PROCESS", data: { nodes: ["save first", "then spend"] }, headline: "the fix", motion_tier: "medium", match_cut_prev: true } },
];
const { compositionFor } = await import("../src/skills/remotion-render/visual/canvas-layout.js");
const beats = beatsSpec.map((b, i) => {
  const words = b.text.split(" ");
  const per = (D - 20) / words.length;
  const c = { ...b.c };
  c.composition = compositionFor(c.visual_type, !!c.photo);
  return {
    beat_id: `t${i}`, start_frame: i * D, duration_frames: D, text: b.text, original_text: b.text,
    scene: { mechanism: "TYPOGRAPHY", canvas: c },
    spoken: words.map((w, k) => ({ text: w, from: Math.round(6 + k * per), to: Math.round(6 + (k + 1) * per) })),
    words: [],
  };
});
const plan = { canvas: true, accent, beats, palette: { primary: ["#0F172A", "#1E293B", "#22C55E", "#FAFAFA"], secondary: [] }, fonts: { primary: "Inter", secondary: "Inter" } };
writeFileSync(join(out, "plan.json"), JSON.stringify(plan, null, 2));

console.log("bundling...");
const serveUrl = await bundle({ entryPoint: join(RR, "Root.jsx"), publicDir: join(RR, "public"), onProgress: () => {} });
const props = { plan, ttsAudioPath: null };
const composition = await selectComposition({ serveUrl, id: "DirectedShorts", inputProps: props });
composition.durationInFrames = beats.length * D;
const shots = [];
beats.forEach((b, i) => { for (const pct of [0.08, 0.3, 0.65, 0.95]) shots.push([i, pct, b.start_frame + Math.round(b.duration_frames * pct)]); });
for (const [i, pct, frame] of shots) {
  const file = join(out, `beat-${i}-${Math.round(pct * 100)}.png`);
  await renderStill({ serveUrl, composition, frame, output: file, inputProps: props, scale: 0.5 });
}
console.log(`stills: ${shots.length} in ${out}`);
if (process.argv.includes("--video")) {
  await renderMedia({ serveUrl, composition, codec: "h264", outputLocation: join(out, "canvas-test.mp4"), inputProps: props, scale: 0.5, concurrency: 4 });
  console.log(`video: ${join(out, "canvas-test.mp4")}`);
  // The same canvas fields render.js records, so local-audit.cjs --canvas-only can run on it.
  const { canvasLayout, contentBounds } = await import("../src/skills/remotion-render/visual/canvas-layout.js");
  const manifest = { video: "canvas-test.mp4", fps: FPS, width: 1080, height: 1920, accent, beats: beats.map((b, i) => {
    const L = canvasLayout(b.scene.canvas), flat = {};
    for (const [k, v] of Object.entries(L.boxes)) { if (k === "bottom") continue; if (Array.isArray(v)) v.forEach((n, j) => { flat[`${k}${j}`] = { x: n.x, y: n.y, w: n.w, h: n.h }; }); else if (v && "x" in v) flat[k] = { x: v.x, y: v.y, w: v.w, h: v.h }; }
    return { index: i, start_sec: b.start_frame / FPS, duration_sec: b.duration_frames / FPS, visual_type: b.scene.canvas.visual_type,
      canvas: { composition: L.composition, hero: L.hero, boxes: flat, content: contentBounds(L), motion_tier: b.scene.canvas.motion_tier } };
  }) };
  writeFileSync(join(out, "canvas-test-manifest.json"), JSON.stringify(manifest, null, 2));
}
