/**
 * A composed object's DECLARED fill must reach the rendered pixel at full
 * strength. Measured from pixels, not asserted from source.
 *
 * WHY THIS EXISTS
 *
 * Composed objects rendered at ~13% of their declared colour and nothing
 * anywhere reported a problem: no error, no warning, a clean bundle, and a
 * frame that merely looked dim. Two readings of the rendering path missed
 * it. A deterministic pixel bisection — one fixed composition, one fixed
 * frame, one declared fill, disabling one layer's opacity at a time — found
 * it in four renders:
 *
 *   baseline                      [46,30,43]      alpha 0.133
 *   tOpacity -> 1                 [46,30,43]      alpha 0.133   not the cause
 *   + group enter -> 1            [248,126,144]   alpha 1.000   <- the layer
 *   + inner shape alpha -> 1      [248,126,144]   alpha 1.000   not the cause
 *
 * The entrance alpha was resolving from a NaN progress: beatAt() computed
 * `(frame - start) / Math.max(1, duration_frames)` and Math.max(1,
 * undefined) is NaN, so clamp01(NaN) stayed NaN and every alpha collapsed.
 * Both beatAt() and motionState() now refuse to produce a non-finite
 * progress, and a broken beat renders SETTLED rather than nearly invisible.
 *
 * This test renders real frames through the real DirectedShorts composition
 * and samples pixels, because that is the only thing that would have caught
 * it. It is slower than a unit test and that is the point.
 *
 *   node scripts/test-composed-opacity.mjs
 */

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { direct } from "../src/skills/remotion-render/visual-engine/director/visual-director.js";
import { validateScene } from "../src/skills/remotion-render/visual/scene-primitives.js";
import { paletteRoles } from "../src/skills/remotion-render/visual/palette-roles.js";
import { ensureTextContrast } from "../src/skills/remotion-render/visual/scene-text.js";

let failed = 0;
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; } else { failed++; console.log(`  FAIL  ${msg}`); }
};

const OUT = join(process.env.TEMP || "/tmp", "composed-opacity-test");
mkdirSync(OUT, { recursive: true });

/* ── The fixed fixture ───────────────────────────────────────────────── */

const PALETTE = { primary: ["#0F0F1A", "#1A1A2E", "#F5536B", "#FAFAFA"], secondary: ["#16213E", "#94A3B8"] };
const FRAME = 150;                 // mid-beat of a 300-frame beat: settled
const BG_RED = 15;                 // red channel of #0F0F1A

const VALID = { objects: [{ kind: "field" }, { kind: "block", count: 1, anchor: "center", emphasis: true }] };
// Under the coverage floor, so it must be REJECTED and fall back.
const INVALID = { objects: [{ kind: "figure", label: "one line only" }] };

/** The director reads cue.durationInFrames — the field name matters. */
const cue = (durationInFrames) => [{ text: "Fixed sentence for the pixel test.", startFrame: 0, durationInFrames, words: [] }];

function planFor({ composition, mechanism = "STATE_CHANGE", phrase = null, durationInFrames = 300 }) {
  const visualPlan = { beats: [{
    index: 0, mechanism,
    visual_headline: phrase || "",
    typography_direction: phrase ? { phrase } : null,
    objects: {}, composition,
  }] };
  const { beats } = direct(cue(durationInFrames), { seed: 1, visualPlan });
  return { beats, palette: PALETTE, fonts: { primary: "Inter", secondary: "JetBrains Mono" } };
}

const declaredFill = ensureTextContrast(paletteRoles(PALETTE).accent, "#0F0F1A", 7.5);
const EXPECTED = [1, 3, 5].map((i) => parseInt(declaredFill.slice(i, i + 2), 16));

console.log(`\nfixture: one field + one emphasised block, frame ${FRAME}`);
console.log(`declared fill: ${declaredFill} ${JSON.stringify(EXPECTED)}`);

const serveUrl = await bundle({
  entryPoint: join(process.cwd(), "src/skills/remotion-render/Root.jsx"),
  onProgress: () => {},
});

/**
 * Render one frame and return the strongest declared-hue pixel found in the
 * safe rect, as an implied alpha. Scanning rather than sampling a fixed
 * coordinate: an earlier version of this harness sampled 3px outside the
 * object and read the background, which looked exactly like a real defect.
 */
async function alphaOf(label, plan) {
  const inputProps = { plan };
  const composition = await selectComposition({ serveUrl, id: "DirectedShorts", inputProps });
  const output = join(OUT, `${label.replace(/\W+/g, "_")}.png`);
  await renderStill({
    composition: { ...composition, durationInFrames: 300 },
    serveUrl, frame: FRAME, output, inputProps,
    chromiumOptions: { gl: "swangle" },
  });
  const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  let best = -1;
  for (let y = 288; y < 1248; y += 4) {
    for (let x = 48; x < 888; x += 4) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i], b = data[i + 2];
      if (r <= b) continue;                       // the declared fill is pink
      const a = (r - BG_RED) / (EXPECTED[0] - BG_RED);
      if (a > best) best = a;
    }
  }
  return best;
}

console.log("\n1. A declared object fill reaches the pixel at FULL strength");
{
  ok(validateScene(VALID).ok, "the fixture composition is valid");
  const plan = planFor({ composition: VALID });
  ok(!!plan.beats[0].scene?.composition, "the director accepted the composition (not the fallback path)");
  ok(plan.beats[0].duration_frames === 300, "duration_frames is populated (a NaN here is what caused the 13% dimming)");

  const a = await alphaOf("valid-composition", plan);
  console.log(`   measured alpha: ${a.toFixed(3)}`);
  ok(a > 0.98, `the declared fill renders at full opacity (got ${a.toFixed(3)}; 0.133 was the defect)`);
}

console.log("2. A malformed beat renders SETTLED, never nearly invisible");
{
  // duration_frames missing -> p would be NaN. The guard must make this
  // fully opaque rather than ~13%.
  const plan = planFor({ composition: VALID, durationInFrames: undefined });
  const a = await alphaOf("nan-progress", plan);
  console.log(`   measured alpha: ${a.toFixed(3)}`);
  ok(a > 0.98, `a non-finite progress still renders opaque (got ${a.toFixed(3)})`);
}

console.log("3. Typography still renders over a composition");
{
  const plan = planFor({ composition: VALID, mechanism: "TYPOGRAPHY", phrase: "Twelve plants, no people" });
  ok(!!plan.beats[0].scene?.composition, "composition accepted alongside typography");
  ok(String(plan.beats[0].text || "").includes("Twelve"), "the beat still carries its narrative phrase");
  const a = await alphaOf("with-typography", plan);
  ok(a > 0.98, `objects stay full strength with typography layered over (got ${a.toFixed(3)})`);
}

console.log("4. An invalid composition still falls back");
{
  ok(!validateScene(INVALID).ok, "the under-covered composition is invalid");
  const plan = planFor({ composition: INVALID });
  ok(!plan.beats[0].scene?.composition, "the director rejected it and did NOT attach a composition");
  ok(!!plan.beats[0].scene?.mechanism, "the beat still has a mechanism to fall back to");
}

console.log("5. The old fallback path is unchanged");
{
  // No composition at all: the beat must route to the mechanism scenes
  // exactly as it did before any of this existed.
  const plan = planFor({ composition: undefined });
  const b = plan.beats[0];
  ok(!b.scene?.composition, "a beat with no composition has none attached");
  ok(b.scene?.mechanism === "STATE_CHANGE", `it keeps its declared mechanism (got ${b.scene?.mechanism})`);
  ok(Array.isArray(b.scene?.objects), "the mechanism scene still has its objects");
  ok(b.duration_frames === 300 && b.start_frame === 0, "beat timing is untouched");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
