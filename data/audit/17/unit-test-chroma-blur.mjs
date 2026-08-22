/**
 * data/audit/17/unit-test-chroma-blur.mjs — direct unit test of the
 * blurredStddev/chromaStddev discriminating logic added to
 * scripts/frame-audit.js, against controlled synthetic buffers (pure
 * random noise vs. a pure smooth gradient vs. a pure hue-drift tint).
 *
 * frame-audit.js has top-level CLI code that runs on import (reads
 * process.argv, a manifest.json off disk) — safe to run as a script, not
 * safe to import as a module from another script. So this copies the
 * exact formulas verbatim (chromaStddev char-for-char; the blur step via
 * sharp directly, matching blurredRegion's real call) rather than
 * importing them, to test the ACTUAL algorithm without triggering the
 * unrelated CLI path. Any future edit to those formulas in frame-audit.js
 * should be mirrored here.
 */
import sharp from "sharp";

const W = 400;
const H = 120;
const GRAIN_BLUR_SIGMA = 6;
const FLAT_MAX = 14;

// Verbatim from scripts/frame-audit.js
function stats(buf, len) {
  let min = 255, max = 0, sum = 0;
  for (let i = 0; i < len; i++) {
    const v = buf[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const mean = sum / len;
  let sq = 0;
  for (let i = 0; i < len; i++) sq += (buf[i] - mean) * (buf[i] - mean);
  return { min, max, mean, stddev: Math.sqrt(sq / len) };
}

// Verbatim from scripts/frame-audit.js
function chromaStddev(buf, len) {
  const n = len / 3;
  const rg = new Float64Array(n);
  const gb = new Float64Array(n);
  let sumRg = 0;
  let sumGb = 0;
  for (let i = 0, p = 0; i < len; i += 3, p++) {
    const d1 = buf[i] - buf[i + 1];
    const d2 = buf[i + 1] - buf[i + 2];
    rg[p] = d1;
    gb[p] = d2;
    sumRg += d1;
    sumGb += d2;
  }
  const meanRg = sumRg / n;
  const meanGb = sumGb / n;
  let sq = 0;
  for (let p = 0; p < n; p++) {
    sq += (rg[p] - meanRg) * (rg[p] - meanRg);
    sq += (gb[p] - meanGb) * (gb[p] - meanGb);
  }
  return Math.sqrt(sq / (2 * n));
}

async function blurred(buf) {
  return sharp(buf, { raw: { width: W, height: H, channels: 3 } }).blur(GRAIN_BLUR_SIGMA).raw().toBuffer();
}

// Case 1: pure achromatic noise (same delta added to r/g/b at each pixel)
// — models NoiseEffect's real vec3(rand()) broadcast exactly.
function buildNoiseBuffer(amplitude) {
  const buf = Buffer.alloc(W * H * 3);
  for (let p = 0; p < W * H; p++) {
    const n = Math.round((Math.random() - 0.5) * amplitude);
    const v = Math.max(0, Math.min(255, 255 + n));
    buf[p * 3] = v;
    buf[p * 3 + 1] = v;
    buf[p * 3 + 2] = v;
  }
  return buf;
}

// Case 2: pure smooth gradient, left to right, white -> light gray.
function buildGradientBuffer(range) {
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = Math.round(255 - (x / W) * range);
      const p = (y * W + x) * 3;
      buf[p] = v;
      buf[p + 1] = v;
      buf[p + 2] = v;
    }
  }
  return buf;
}

// Case 3: pure hue-drift tint, left to right, white -> pink (R,B up, G flat).
function buildTintBuffer(range) {
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = x / W;
      const p = (y * W + x) * 3;
      buf[p] = 255;
      buf[p + 1] = Math.round(255 - t * range);
      buf[p + 2] = 255;
    }
  }
  return buf;
}

async function report(name, buf) {
  const raw = stats(buf, buf.length).stddev;
  const bl = stats(await blurred(buf), buf.length).stddev;
  const chroma = chromaStddev(buf, buf.length);
  const wouldPass = bl <= FLAT_MAX && chroma <= FLAT_MAX;
  console.log(`${name.padEnd(28)} raw=${raw.toFixed(2).padStart(6)}  blurred=${bl.toFixed(2).padStart(6)}  chroma=${chroma.toFixed(2).padStart(6)}  -> ${wouldPass ? "ALLOWED (grain-like)" : "REJECTED (structural)"}`);
}

async function main() {
  console.log(`FLAT_MAX=${FLAT_MAX}\n`);
  await report("pure noise (amp=40)", buildNoiseBuffer(40));
  await report("pure noise (amp=80)", buildNoiseBuffer(80));
  await report("pure noise (amp=150)", buildNoiseBuffer(150));
  await report("smooth gradient (range=15)", buildGradientBuffer(15));
  await report("smooth gradient (range=70)", buildGradientBuffer(70));
  await report("smooth gradient (range=100)", buildGradientBuffer(100));
  await report("hue-drift tint (range=15)", buildTintBuffer(15));
  await report("hue-drift tint (range=70)", buildTintBuffer(70));
  await report("hue-drift tint (range=100)", buildTintBuffer(100));
}

main();
