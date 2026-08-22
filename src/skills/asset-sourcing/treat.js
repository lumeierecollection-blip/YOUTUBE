/**
 * Asset treatment — PART 6 of the motion-graphics rebuild.
 *
 * "No raw photo reaches a frame." Every sourced photo passes through here
 * before it is allowed into a manifest a composition can read.
 *
 * Pipeline:
 *   1. Background removal via rembg (U^2-Net / ISNet, semantic segmentation)
 *      — NOT color-keying. Color-keying was tried during this rebuild and
 *      confirmed to fail on textured/low-contrast source photos (the
 *      cave-spider.jpg fixture: border rgb ~140,140,144 vs subject rgb
 *      ~99,117,148, only ~25 luma apart — physically unseparable by color
 *      distance). rembg is real semantic segmentation and was verified on
 *      that exact fixture: 93.5% of the frame came back near-fully
 *      transparent, subject genuinely isolated (see
 *      qa/rembg-verify-cave-spider-cutout.png and PART 10's report).
 *   2. Classification — not every photo suits a cutout. A cheap, measured
 *      heuristic (not a guess): after segmentation, if the "foreground"
 *      alpha covers most of the canvas OR touches 3+ of the 4 edges, the
 *      photo is texture/landscape filling the frame, not an isolated
 *      object — route to full-bleed treatment on the ORIGINAL photo
 *      instead of forcing a segmentation that has nothing to cut around.
 *   3. Tone normalization so assets from different source APIs match.
 *   4. Cutout mode only: contact shadow (fixed light direction, shared
 *      across every asset so a video never mixes lighting directions),
 *      tight crop to the subject's bounding box + padding.
 *
 * Runs OFFLINE, as part of building the asset library — never at render
 * time (CHECK AST-13's "no network / no heavy compute on the render path"
 * extends here: rembg is CPU-slow, so its output is cached to disk and the
 * manifest just points at the treated PNG).
 */
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");

// Dedicated venv (not the system/CI Python) so rembg's fairly heavy deps
// (onnxruntime, scikit-image, numba) never leak into the main pipeline's
// Python environment. Built by: python3 -m venv .venv-rembg && \
//   .venv-rembg/bin/pip install "rembg[cpu]" — a one-time setup step,
// documented in this skill's SKILL.md, cached via actions/cache in CI
// (daily-pipeline.yml's asset-library build job) keyed on rembg's version.
const REMBG_PYTHON =
  process.env.ASSET_SOURCING_PYTHON || join(ROOT, ".venv-rembg", "bin", "python3");
const REMBG_HELPER = join(__dirname, "rembg_remove.py");

// PART 6 — "consistent light direction across every asset in a video."
// A single fixed convention (light from upper-left) so shadows never
// contradict each other when two treated assets appear in the same video.
const SHADOW_OFFSET_X_FRAC = 0.06; // shadow falls slightly right of subject
const SHADOW_OFFSET_Y_FRAC = 0.10; // and below it
const SHADOW_BLUR_FRAC = 0.035;
const SHADOW_OPACITY = 0.32;

// Classification thresholds (measured, not guessed — see module doc).
const FULLBLEED_COVERAGE_MAX = 0.55; // opaque+midtone fraction above this = "fills the frame"
const FULLBLEED_EDGE_TOUCH_MIN = 3; // opaque mask touching this many of 4 edges = "texture/landscape"
const EDGE_TOUCH_ALPHA = 40; // alpha value counted as "present" for edge-touch scan
const OPAQUE_ALPHA = 200; // alpha value counted as "opaque" for bbox/coverage

function runRembg(inputPath, outputPath, { matting = false } = {}) {
  if (!existsSync(REMBG_PYTHON)) {
    throw new Error(
      `rembg venv not found at ${REMBG_PYTHON}. Set up with:\n` +
        `  python3 -m venv .venv-rembg && .venv-rembg/bin/pip install "rembg[cpu]"`
    );
  }
  const args = [REMBG_HELPER, inputPath, outputPath];
  if (matting) args.push("--matting");
  const r = spawnSync(REMBG_PYTHON, args, { encoding: "utf-8" });
  if (r.status !== 0) {
    throw new Error(`rembg failed on ${inputPath}:\n${r.stderr || r.stdout}`);
  }
  return outputPath;
}

// Analyse a cutout PNG's alpha channel: coverage fraction (opaque + midtone,
// i.e. anything not fully transparent) and how many of the 4 edges the
// opaque region touches. Mirrors frame-audit.js's raw-buffer style.
export async function analyseAlpha(pngPath) {
  const img = sharp(pngPath);
  const { width, height } = await img.metadata();
  const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let nonTransparent = 0;
  const total = width * height;
  const edgeTouch = { top: false, bottom: false, left: false, right: false };
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 10) nonTransparent++;
      if (a > OPAQUE_ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (a > EDGE_TOUCH_ALPHA) {
        if (y === 0) edgeTouch.top = true;
        if (y === height - 1) edgeTouch.bottom = true;
        if (x === 0) edgeTouch.left = true;
        if (x === width - 1) edgeTouch.right = true;
      }
    }
  }
  const edgesTouched = Object.values(edgeTouch).filter(Boolean).length;
  const hasSubject = maxX >= minX && maxY >= minY;
  return {
    width,
    height,
    coverage: nonTransparent / total,
    edgesTouched,
    bbox: hasSubject ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
  };
}

export function classify(alphaInfo) {
  if (!alphaInfo.bbox) return "fullbleed"; // segmentation found nothing at all
  if (alphaInfo.coverage > FULLBLEED_COVERAGE_MAX) return "fullbleed";
  if (alphaInfo.edgesTouched >= FULLBLEED_EDGE_TOUCH_MIN) return "fullbleed";
  return "cutout";
}

// Tone normalization: stretch contrast and pin the black point so assets
// pulled from different source APIs (which each expose the subject
// differently) read consistently once composited together.
function normalizeTone(pipeline, { bw }) {
  let p = pipeline.normalise({ lower: 1, upper: 99 }); // percentile clip, not min/max (outlier-safe)
  if (bw) {
    p = p.greyscale().linear(1.15, -12); // high-contrast editorial: push contrast, deepen blacks
  } else {
    p = p.modulate({ saturation: 1.05 }).linear(1.05, -6);
  }
  return p;
}

async function buildContactShadow(bboxW, bboxH) {
  const w = Math.round(bboxW * (1 + SHADOW_OFFSET_X_FRAC * 2 + SHADOW_BLUR_FRAC * 4));
  const h = Math.round(bboxH * 0.4 + bboxW * SHADOW_BLUR_FRAC * 4);
  const ellipseW = bboxW * 0.8;
  const ellipseH = Math.max(bboxH * 0.12, 10);
  const blur = Math.max(bboxW * SHADOW_BLUR_FRAC, 4);
  const cx = w / 2;
  const cy = h * 0.4;
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="b" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="${blur}" />
      </filter>
    </defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${ellipseW / 2}" ry="${ellipseH / 2}"
      fill="black" opacity="${SHADOW_OPACITY}" filter="url(#b)" />
  </svg>`;
  return { buffer: Buffer.from(svg), width: w, height: h, cx, cy };
}

/**
 * Treat one sourced image. Returns metadata describing what was produced;
 * never throws on a classification decision (fullbleed is a valid, honest
 * outcome, not a failure) — only throws on actual I/O / rembg errors.
 *
 * @param {object} opts
 * @param {string} opts.inputPath - raw sourced image (2x stage resolution)
 * @param {string} opts.outputDir - directory to write the treated PNG into
 * @param {string} opts.slug - filename stem
 * @param {"bw"|"color"} opts.mode - editorial B&W vs full-color-on-white
 * @param {boolean} [opts.keepScratch] - keep the intermediate rembg pass (debug)
 */
export async function treatAsset({ inputPath, outputDir, slug, mode, keepScratch = false }) {
  if (!existsSync(inputPath)) throw new Error(`asset not found: ${inputPath}`);
  if (mode !== "bw" && mode !== "color") throw new Error(`treatAsset: mode must be "bw" or "color", got ${mode}`);
  mkdirSync(outputDir, { recursive: true });

  const scratch = join(outputDir, `.${slug}.scratch.png`);
  runRembg(inputPath, scratch, { matting: false });
  const probe = await analyseAlpha(scratch);
  const treatment = classify(probe);

  if (treatment === "fullbleed") {
    if (!keepScratch) rmSync(scratch, { force: true });
    const outPath = join(outputDir, `${slug}-fullbleed.jpg`);
    await normalizeTone(sharp(inputPath), { bw: mode === "bw" })
      .jpeg({ quality: 90 })
      .toFile(outPath);
    return {
      treatment: "fullbleed",
      path: outPath,
      mode,
      coverage: probe.coverage,
      edgesTouched: probe.edgesTouched,
    };
  }

  // Re-run WITH alpha matting for a genuinely isolated subject — the extra
  // cost (roughly 2x) is worth it only once we know there IS a clean
  // subject to matte, which the fast probe pass above just confirmed.
  const matted = join(outputDir, `.${slug}.matted.png`);
  runRembg(inputPath, matted, { matting: true });
  const info = await analyseAlpha(matted);
  if (!info.bbox) {
    // Matting occasionally loses the subject entirely on a marginal case;
    // fall back to the non-matted (already-verified-present) cutout rather
    // than silently producing an empty frame.
    if (!keepScratch) rmSync(matted, { force: true });
    return treatCutout(scratch, probe, outputDir, slug, mode, keepScratch);
  }
  if (!keepScratch) rmSync(scratch, { force: true });
  return treatCutout(matted, info, outputDir, slug, mode, keepScratch);
}

async function treatCutout(cutoutPath, info, outputDir, slug, mode, keepScratch) {
  const pad = Math.round(Math.max(info.bbox.w, info.bbox.h) * 0.08);
  const cropX = Math.max(0, info.bbox.x - pad);
  const cropY = Math.max(0, info.bbox.y - pad);
  const cropW = Math.min(info.width - cropX, info.bbox.w + pad * 2);
  const cropH = Math.min(info.height - cropY, info.bbox.h + pad * 2);

  const cropped = sharp(cutoutPath).extract({ left: cropX, top: cropY, width: cropW, height: cropH });
  const toneRgb = await normalizeTone(cropped.clone().removeAlpha(), { bw: mode === "bw" }).raw().toBuffer({ resolveWithObject: true });
  const alphaBuf = await cropped.clone().extractChannel(3).raw().toBuffer();
  const toned = sharp(toneRgb.data, {
    raw: { width: toneRgb.info.width, height: toneRgb.info.height, channels: toneRgb.info.channels },
  }).joinChannel(alphaBuf, { raw: { width: toneRgb.info.width, height: toneRgb.info.height, channels: 1 } });

  const shadow = await buildContactShadow(cropW, cropH);
  const canvasW = Math.max(cropW, shadow.width);
  const canvasH = cropH + shadow.height * 0.5;
  const subjectX = Math.round((canvasW - cropW) / 2 + cropW * SHADOW_OFFSET_X_FRAC * -0.3);
  const subjectY = 0;
  const shadowX = Math.round((canvasW - shadow.width) / 2 + cropW * SHADOW_OFFSET_X_FRAC);
  const shadowY = Math.round(cropH - shadow.height * 0.35 + cropH * SHADOW_OFFSET_Y_FRAC * 0.3);

  const outPath = join(outputDir, `${slug}-cutout.png`);
  await sharp({ create: { width: Math.round(canvasW), height: Math.round(canvasH), channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: shadow.buffer, left: Math.max(0, shadowX), top: Math.max(0, shadowY) },
      { input: await toned.png().toBuffer(), left: Math.max(0, subjectX), top: subjectY },
    ])
    .png()
    .toFile(outPath);

  if (!keepScratch) rmSync(cutoutPath, { force: true });

  return {
    treatment: "cutout",
    path: outPath,
    mode,
    coverage: info.coverage,
    edgesTouched: info.edgesTouched,
    width: Math.round(canvasW),
    height: Math.round(canvasH),
  };
}
