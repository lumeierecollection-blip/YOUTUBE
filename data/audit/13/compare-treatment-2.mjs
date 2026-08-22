import sharp from "sharp";

// Same approach as compare-treatment.mjs, generalized to work across
// different stage-box pixel sizes between probes: crop the CENTER 50% of
// each image (by percentage, not hardcoded pixels) so both the untreated
// (audit/14, plain <img>, real ImageBeatScene) and treated (audit/13,
// PhotoTreatment) renders sample the same relative region regardless of
// their absolute stage-box dimensions.
async function stats(path) {
  const meta = await sharp(path).metadata();
  const cropW = Math.round(meta.width * 0.5);
  const cropH = Math.round(meta.height * 0.5);
  const left = Math.round((meta.width - cropW) / 2);
  const top = Math.round((meta.height - cropH) / 2);
  const { data, info } = await sharp(path)
    .extract({ left, top, width: cropW, height: cropH })
    .raw()
    .toBuffer({ resolveWithObject: true });
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
    if (a < 10) continue;
    n++;
    sumR += r;
    sumG += g;
    sumB += b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    sumSat += max === 0 ? 0 : (max - min) / max;
  }
  return { n, avgR: sumR / n, avgG: sumG / n, avgB: sumB / n, avgSat: sumSat / n };
}

const pairs = [
  {
    name: "cave-spider (fullbleed)",
    before: "data/audit/14/out/no-attribution-beat1-settled-f140.png",
    after: "data/audit/13/out/pt-cavespider-cutout-f20.png",
  },
  {
    name: "black-smoker (fullbleed)",
    before: "data/audit/14/out/no-attribution-beat2-settled-f215.png",
    after: "data/audit/13/out/pt-blacksmoker-fullbleed-f20.png",
  },
];

for (const { name, before, after } of pairs) {
  const b = await stats(before);
  const a = await stats(after);
  console.log(`\n=== ${name} ===`);
  console.log("BEFORE:", b);
  console.log("AFTER: ", a);
  const dSat = a.avgSat - b.avgSat;
  console.log(`  avgSat delta: ${dSat.toFixed(4)} (${((dSat / b.avgSat) * 100).toFixed(1)}% relative)`);
  console.log(`  avgR/G/B delta: ${(a.avgR - b.avgR).toFixed(1)} / ${(a.avgG - b.avgG).toFixed(1)} / ${(a.avgB - b.avgB).toFixed(1)}`);
}
