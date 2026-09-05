import sharp from "sharp";

// Same piggy-bank asset, same stage box position/size, two render paths:
// audit/12's plain <img> (no treatment) vs audit/13's PhotoTreatment
// (Vignette+Noise+ChromaticAberration+LUT). Crop both to the SAME
// coin-body region (avoiding the transparent margin, which is identical
// zero-signal in both) and compare real pixel statistics, so "the grade is
// applied" is measured, not eyeballed.
const CROP = { left: 330, top: 520, width: 400, height: 260 }; // over the coin body/text, avoiding the shadow ellipse

async function stats(path) {
  const img = sharp(path).extract(CROP);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumSat = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = info.channels === 4 ? data[i + 3] : 255;
    if (a < 10) continue; // skip transparent
    n++;
    sumR += r;
    sumG += g;
    sumB += b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    sumSat += sat;
  }
  return { n, avgR: sumR / n, avgG: sumG / n, avgB: sumB / n, avgSat: sumSat / n };
}

const before = await stats("data/audit/12/out/multi-image-beat-beat0-settled-f65.png");
const after = await stats("data/audit/13/out/pt-piggybank-cutout-f0.png");

console.log("BEFORE (plain <img>, no treatment):", before);
console.log("AFTER  (PhotoTreatment, Vignette+Noise+CA+LUT):", after);
console.log("\nDelta (after - before):");
console.log(`  avgR: ${(after.avgR - before.avgR).toFixed(2)}`);
console.log(`  avgG: ${(after.avgG - before.avgG).toFixed(2)}`);
console.log(`  avgB: ${(after.avgB - before.avgB).toFixed(2)}`);
console.log(`  avgSat: ${(after.avgSat - before.avgSat).toFixed(4)} (${(((after.avgSat - before.avgSat) / before.avgSat) * 100).toFixed(1)}% relative)`);
