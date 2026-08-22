/**
 * data/audit/15/verify-gate.mjs — direct verification of treat.js's real
 * classify()/analyseAlpha() gate logic (imported, not reimplemented).
 *
 * rembg itself isn't runnable in this sandbox (no .venv-rembg here, and
 * installing it would pull onnxruntime + download a model through the
 * same proxy that blocked other asset downloads earlier this session) —
 * so this constructs two REALISTIC synthetic alpha masks standing in for
 * rembg's own output shape, and calls the REAL gate function against each:
 *   1. "texture/landscape" case — opaque coverage over most of the frame,
 *      touching all 4 edges (what rembg produces when there's no isolated
 *      subject to cut around, e.g. the actual cave-spider/black-smoker
 *      texture-fills-the-frame photos this session already used fullbleed).
 *   2. "clean subject" case — a small opaque blob centered in a
 *      transparent field, touching no edges (what rembg produces for a
 *      genuinely isolated subject, e.g. this repo's own real piggy-bank
 *      cutout, or cave-spider.jpg per PART 10's qa/rembg-verify-cave-
 *      spider-cutout.png finding this session's summary already cites).
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyseAlpha, classify } from "../../../src/skills/asset-sourcing/treat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "out");
mkdirSync(OUT_DIR, { recursive: true });

const W = 800;
const H = 600;

async function buildTextureFillsFrameMask() {
  // Fully opaque edge-to-edge, exactly what rembg returns when it can't
  // isolate anything (no transparent region at all — "coverage" ~1.0,
  // touches all 4 edges).
  const path = join(OUT_DIR, "synthetic-texture-mask.png");
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 120, g: 110, b: 100, alpha: 255 } } }).png().toFile(path);
  return path;
}

async function buildCleanSubjectMask() {
  // Small opaque circle centered in an otherwise-transparent frame —
  // classic isolated-subject cutout shape.
  const path = join(OUT_DIR, "synthetic-subject-mask.png");
  const r = Math.round(Math.min(W, H) * 0.18);
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${W / 2}" cy="${H / 2}" r="${r}" fill="black" />
  </svg>`;
  await sharp(Buffer.from(svg)).ensureAlpha().png().toFile(path);
  return path;
}

async function main() {
  const texturePath = await buildTextureFillsFrameMask();
  const subjectPath = await buildCleanSubjectMask();

  const textureInfo = await analyseAlpha(texturePath);
  const textureDecision = classify(textureInfo);

  const subjectInfo = await analyseAlpha(subjectPath);
  const subjectDecision = classify(subjectInfo);

  console.log("=== Texture/landscape mask (no isolated subject) ===");
  console.log(`  coverage=${textureInfo.coverage.toFixed(3)} edgesTouched=${textureInfo.edgesTouched}`);
  console.log(`  classify() -> "${textureDecision}"`);
  console.log(textureDecision === "fullbleed" ? "  PASS: gate correctly routes to full-bleed, not discarded" : "  FAIL: expected fullbleed");

  console.log("\n=== Clean isolated-subject mask ===");
  console.log(`  coverage=${subjectInfo.coverage.toFixed(3)} edgesTouched=${subjectInfo.edgesTouched}`);
  console.log(`  classify() -> "${subjectDecision}"`);
  console.log(subjectDecision === "cutout" ? "  PASS: gate correctly routes to cutout" : "  FAIL: expected cutout");

  const ok = textureDecision === "fullbleed" && subjectDecision === "cutout";
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
