#!/usr/bin/env node
/**
 * Temporary diagnostic: renders isolated still frames of DirectedShorts
 * with a hand-built plan (channel 26's real palette, realistic beat
 * content matching the actual failing production video) to determine
 * whether the near-black rendering defect reported in QA is real and,
 * by rendering isolated stills whose pixels can be inspected directly.
 *
 * Not part of the pipeline. Delete once the defect is understood/fixed.
 *
 * Usage: node scripts/diag-render-frames.mjs
 */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ENTRY = join(ROOT, "src", "skills", "remotion-render", "Root.jsx");
const OUT_DIR = join(ROOT, "data", "audit", "diag-frames");
mkdirSync(OUT_DIR, { recursive: true });

// Channel 26's REAL visual-identity.json palette (config/visual-identity.json, ch-26).
const palette = {
  primary: ["#0A0A1A", "#151530", "#22C55E", "#000000"],
  secondary: ["#1B9A49", "#919198", "#EBEBED"],
};
const fonts = { primary: "JetBrains Mono", secondary: "Inter" };

const FPS = 30;
const BEAT_FRAMES = 150; // 5s/beat, generous and simple — contiguous by construction

// Beat content mirrors the real failing video (channel 26,
// caastle-300m-securities-fraud-sentencing, run 35143999089, attempt 2)
// exactly as logged by gemini-visual-plan.js, hand-converted through the
// same scene.objects shape visual-director.js's PHYSICAL_GROWTH case builds.
const rawBeats = [
  { mechanism: "STATE_CHANGE", text: "5 YEARS IN FEDERAL PRISON" },
  { mechanism: "EVIDENCE_FIGURE", text: "MANHATTAN FEDERAL COURT" },
  { mechanism: "PROPORTIONAL_OBJECTS", text: "$300M FRAUD SCHEME" },
  { mechanism: "PHYSICAL_GROWTH", text: "$100M FAKE REVENUE", figure: "$100M" },
  { mechanism: "EVIDENCE_FIGURE", text: "$283.3M RESTITUTION ORDER", figure: "$283.3M" },
  { mechanism: "ACTION_CONSEQUENCE", text: "CAASTLE LIQUIDATION" },
  // Narrative-typography probes: a good short phrase, and a deliberately
  // over-long one that the renderer must condense onto ONE centred line
  // rather than stacking into two rows.
  { mechanism: "TYPOGRAPHY", text: "Need it — or want it?" },
  { mechanism: "TYPOGRAPHY", text: "Most people don't realize how much money they're losing every single month" },
];

const beats = rawBeats.map((b, i) => ({
  beat_id: `d${i}`,
  start_frame: i * BEAT_FRAMES,
  duration_frames: BEAT_FRAMES,
  text: b.text,
  original_text: b.text,
  treatment: b.mechanism,
  reason: "",
  carries_forward: null,
  scene: {
    mechanism: b.mechanism,
    material: "money",
    subject: "revenue",
    objects: b.mechanism === "PHYSICAL_GROWTH" ? [
      { id: "growing_thing", label: "REVENUE", material: "money", role: "the thing that grows", appearance: "mass" },
      { id: "magnitude", label: b.figure, material: "text", role: "growth amount", appearance: "value_label" },
    ] : [],
    shots: [{ phase: 0, phaseDuration: 1, camera: "hold" }],
    typography: { role: "primary", style: "kinetic", emphasis_words: [] },
  },
}));

const plan = { beats, palette, fonts };

console.log(`Bundling ${ENTRY} ...`);
const serveUrl = await bundle({ entryPoint: ENTRY, onProgress: () => {} });
console.log("Bundled.");

const composition = await selectComposition({
  serveUrl,
  id: "DirectedShorts",
  inputProps: { plan },
});
console.log(`Composition selected: ${composition.width}x${composition.height} @ ${composition.fps}fps`);

// Target frames: start of beat 3 (PHYSICAL_GROWTH), its midpoint, its end,
// and a transition boundary (last frame of beat 2 / first of beat 3).
const growthStart = 3 * BEAT_FRAMES;
const targets = [
  { name: "beat3-start+1", frame: growthStart + 1 },
  { name: "beat3-mid", frame: growthStart + Math.floor(BEAT_FRAMES / 2) },
  { name: "beat3-end-1", frame: growthStart + BEAT_FRAMES - 2 },
  { name: "beat2-3-boundary-before", frame: growthStart - 1 },
  { name: "beat0-start+5", frame: 5 },
  // Narrative typography: short phrase, and the over-long phrase (must be
  // ONE condensed centred line, never two stacked rows).
  { name: "typo-short-mid", frame: 6 * BEAT_FRAMES + Math.floor(BEAT_FRAMES / 2) },
  { name: "typo-overlong-mid", frame: 7 * BEAT_FRAMES + Math.floor(BEAT_FRAMES / 2) },
];

for (const t of targets) {
  const outPath = join(OUT_DIR, `${t.name}.png`);
  console.log(`\n--- rendering frame ${t.frame} (${t.name}) ---`);
  await renderStill({
    composition: { ...composition, durationInFrames: beats.length * BEAT_FRAMES },
    serveUrl,
    output: outPath,
    frame: t.frame,
    inputProps: { plan },
  });
  console.log(`  -> ${outPath}`);
}

console.log("\nDone. Inspect data/audit/diag-frames/*.png.");
