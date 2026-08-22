#!/usr/bin/env node
/**
 * Generates public/luts/editorial-grade.cube — a standard 3D LUT, applied
 * at render time through Three.js's real LUTCubeLoader + postprocessing's
 * real LUT3DEffect (@react-three/postprocessing's <LUT> component). Never
 * loaded as "hand-tuned color math" at render time — this script is the
 * only place the transform's parameters live, and it emits a plain,
 * standard .cube file the real LUT machinery just samples from.
 *
 * Why generated instead of a found file: the most promising real candidate
 * researched for this (github.com/YahiaAngelo/Film-Luts, MIT-licensed
 * wrapper code) carries its own disclaimer that the LUT DATA itself "might
 * be subject to copyrights and trademarks of their respective owners...
 * it is the responsibility of the users to ensure compliance" — i.e. the
 * repo's own maintainer does not claim clean provenance for the actual
 * grade data, only for the surrounding tooling. That fails this session's
 * bar for "verified", not just "found". A LUT authored here, from a
 * documented formula, with no third-party grade data, has no such gap.
 *
 * The transform (deliberately simple, no artistic "eyeballing"):
 *   1. Partial desaturation: mix 35% toward the pixel's own luma (Rec.709
 *      weights) — a documented, standard desaturation technique, not a
 *      stylized/undocumented one.
 *   2. Gentle S-curve contrast (a single smoothstep pass) — the "editorial"
 *      part of the grade: keeps midtones readable, avoids crushing shadows
 *      to black or blowing highlights on top of a real photo that's
 *      already been through treat.js's own tone normalization.
 *   3. Split-tone matching the vox-style-treatment SKILL.md's own named
 *      "cream/navy/gray family": shadows nudged warm (toward a soft cream,
 *      RGB bias +R+G/-B), highlights nudged cool (toward a soft navy,
 *      RGB bias -R/+B), both very mild (documented constants below) so the
 *      effect reads as grade, not a color cast.
 *
 * Run: node effects/generate-editorial-lut.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "luts");
const OUT_PATH = join(OUT_DIR, "editorial-grade.cube");

const SIZE = 17; // standard LUT size (17^3 = 4913 entries) — enough
// resolution for a smooth grade, small enough (~110KB as plain text) to
// commit and load quickly.

const DESATURATE_MIX = 0.35; // 0 = no change, 1 = fully grayscale
const CONTRAST_S_STRENGTH = 0.12; // smoothstep blend amount, mild
const SHADOW_WARM = { r: 0.03, g: 0.015, b: -0.03 }; // cream bias in shadows
const HIGHLIGHT_COOL = { r: -0.02, g: -0.005, b: 0.03 }; // navy bias in highlights

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const luma709 = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
// Single smoothstep contrast curve: pulls values slightly away from 0.5.
const sCurve = (v, strength) => {
  const smoothed = v * v * (3 - 2 * v); // classic smoothstep(0,1,v)
  return v + (smoothed - v) * strength;
};

function gradePixel(r, g, b) {
  const l = luma709(r, g, b);
  let rr = r + (l - r) * DESATURATE_MIX;
  let gg = g + (l - g) * DESATURATE_MIX;
  let bb = b + (l - b) * DESATURATE_MIX;

  rr = sCurve(rr, CONTRAST_S_STRENGTH);
  gg = sCurve(gg, CONTRAST_S_STRENGTH);
  bb = sCurve(bb, CONTRAST_S_STRENGTH);

  // Split-tone: blend shadow-warm and highlight-cool biases by luma weight.
  const shadowWeight = 1 - l; // stronger in shadows
  const highlightWeight = l; // stronger in highlights
  rr += SHADOW_WARM.r * shadowWeight + HIGHLIGHT_COOL.r * highlightWeight;
  gg += SHADOW_WARM.g * shadowWeight + HIGHLIGHT_COOL.g * highlightWeight;
  bb += SHADOW_WARM.b * shadowWeight + HIGHLIGHT_COOL.b * highlightWeight;

  return [clamp01(rr), clamp01(gg), clamp01(bb)];
}

function buildCube() {
  const lines = [];
  lines.push(`TITLE "editorial-grade (generated, see effects/generate-editorial-lut.mjs)"`);
  lines.push(`LUT_3D_SIZE ${SIZE}`);
  lines.push(`DOMAIN_MIN 0.0 0.0 0.0`);
  lines.push(`DOMAIN_MAX 1.0 1.0 1.0`);
  // .cube ordering: red index varies fastest, then green, then blue.
  for (let bIdx = 0; bIdx < SIZE; bIdx++) {
    for (let gIdx = 0; gIdx < SIZE; gIdx++) {
      for (let rIdx = 0; rIdx < SIZE; rIdx++) {
        const r = rIdx / (SIZE - 1);
        const g = gIdx / (SIZE - 1);
        const b = bIdx / (SIZE - 1);
        const [or, og, ob] = gradePixel(r, g, b);
        lines.push(`${or.toFixed(6)} ${og.toFixed(6)} ${ob.toFixed(6)}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, buildCube());
console.log(`Wrote ${OUT_PATH} (${SIZE}^3 = ${SIZE ** 3} entries)`);
