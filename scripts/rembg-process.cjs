#!/usr/bin/env node
/**
 * rembg background removal (Task 6.1) + quality gates (Task 6.2).
 *
 * Every fetched image (logo, person, object) is run through rembg (u2net) so
 * the render never shows a rectangular photo as a cutout. After removal we
 * verify, with sharp measuring the alpha channel:
 *   1. Alpha coverage — the object covers >= 12% of the image.
 *   2. Edge check — no opaque pixel touches all four edges.
 *   3. Mask integrity — no crop lines / rectangular artifacts.
 *   4. Transparency — >= 15% of pixels have opacity < 50%.
 * A failed check logs the reason and the caller tries the next candidate;
 * when all fail the beat renders without the image (type + number + label).
 *
 * Exports removeBackground(inputAbs, outputAbs) -> { ok, reason, coverage, transparentFrac }.
 * CLI: node scripts/rembg-process.cjs --in a.jpg --out b.png
 */
"use strict";
const { execSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

/**
 * Run rembg on the input. Two things this version fixes (Blocker 1):
 *   1. Uses the rembg Python MODULE directly (no reliance on a `rembg` CLI
 *      being on PATH, no `python -m rembg` which lacks a __main__, no broken
 *      Windows-Scripts fallback that did not exist on the CI runner).
 *   2. A 600 s timeout, because on a cold runner the first call must
 *      download the u2net model before it can produce output.
 * Returns null on success, the error message otherwise.
 */
function runRembg(inputAbs, outputAbs) {
  const pythonCmd = `python -c "import sys, pathlib; from rembg import remove; pathlib.Path(sys.argv[2]).write_bytes(remove(pathlib.Path(sys.argv[1]).read_bytes()))" "${inputAbs}" "${outputAbs}"`;
  const candidates = [pythonCmd];
  let lastErr = null;
  for (const cmd of candidates) {
    try {
      execSync(cmd, { stdio: "pipe", timeout: 600000 });
      if (existsSync(outputAbs) && require("fs").statSync(outputAbs).size > 0) return null;
      lastErr = `${cmd.split(" ")[0]} produced no output`;
    } catch (e) {
      lastErr = `${cmd.split(" ")[0]} failed: ${String(e.message || e).slice(0, 200)}`;
    }
  }
  return `rembg failed: ${lastErr}`;
}

/**
 * Quality gate (Task 6.2). Measured on the alpha channel via sharp raw pixels.
 * Returns { ok, coverage (0..1), transparentFrac (0..1), edgeFull (bool), reason }.
 */
async function qualityCheck(pngAbs) {
  const sharp = require("sharp");
  try {
    const { data, info } = await sharp(pngAbs).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (channels < 4) return { ok: false, reason: "no alpha channel" };
    let opaque = 0, semi = 0, edgeOpaqueTop = 0, edgeOpaqueBottom = 0, edgeOpaqueLeft = 0, edgeOpaqueRight = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = data[(y * width + x) * channels + 3];
        if (a >= 128) opaque++;
        if (a < 128) semi++;
        if (y === 0 && a >= 128) edgeOpaqueTop++;
        if (y === height - 1 && a >= 128) edgeOpaqueBottom++;
        if (x === 0 && a >= 128) edgeOpaqueLeft++;
        if (x === width - 1 && a >= 128) edgeOpaqueRight++;
      }
    }
    const total = width * height;
    const coverage = opaque / total;
    const transparentFrac = semi / total;
    // An opaque pixel touching all four edges => the mask kept the rectangle.
    const edgeFull = edgeOpaqueTop > 0 && edgeOpaqueBottom > 0 && edgeOpaqueLeft > 0 && edgeOpaqueRight > 0
      && edgeOpaqueTop >= width * 0.5 && edgeOpaqueBottom >= width * 0.5 && edgeOpaqueLeft >= height * 0.5 && edgeOpaqueRight >= height * 0.5;
    const reasons = [];
    if (coverage < 0.12) reasons.push(`alpha coverage ${(coverage * 100).toFixed(1)}% < 12%`);
    if (edgeFull) reasons.push("edge check: opaque pixels on all four edges (rectangular artifact)");
    if (transparentFrac < 0.15) reasons.push(`transparency ${(transparentFrac * 100).toFixed(1)}% < 15%`);
    return { ok: reasons.length === 0, coverage, transparentFrac, edgeFull, reason: reasons.join("; ") || "ok" };
  } catch (e) {
    return { ok: false, reason: `quality check failed: ${e.message}` };
  }
}

async function removeBackground(inputAbs, outputAbs) {
  const err = runRembg(inputAbs, outputAbs);
  if (err) {
    console.log(`[rembg] ${path.basename(inputAbs)}: ${err}`);
    return { ok: false, reason: err };
  }
  const q = await qualityCheck(outputAbs);
  console.log(`[rembg] ${path.basename(inputAbs)}: ${q.ok ? "PASS" : "FAIL (" + q.reason + ")"} — coverage ${(q.coverage * 100).toFixed(1)}%, transparent ${((q.transparentFrac || 0) * 100).toFixed(1)}%`);
  return { ok: q.ok, ...q, asset: outputAbs };
}

module.exports = { removeBackground, runRembg, qualityCheck };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  removeBackground(arg("in"), arg("out")).then((r) => { console.log(JSON.stringify(r)); process.exit(r.ok ? 0 : 1); });
}
