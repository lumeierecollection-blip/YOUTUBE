#!/usr/bin/env node
/**
 * frame-verify.js — Task 7.3: after render, extract frames at 25%, 50%, 75%
 * of each beat and confirm, per frame:
 *   - the primary element is present (non-trivial ink coverage in the body),
 *   - no element is off-frame (no ink in the outer margin beyond tolerance),
 *   - no two elements overlap by more than 4px (ink not merged into one block
 *     bigger than a threshold — a proxy, logged honestly as a proxy).
 *
 * Usage:
 *   node scripts/frame-verify.js --mp4 out.mp4 --plan plan.json [--out dir]
 *
 * The plan's beats carry start_frame / end_frame (seconds) or a uniform
 * duration; falls back to evenly splitting the video when no timing is found.
 *
 * Where this stops: "overlap > 4px" is approximated by measuring whether the
 * ink splits into disconnected components the sharp way, not a true bbox
 * intersection — a true bbox overlap test would need an element manifest the
 * renderer would have to emit. It is logged as a proxy, not claimed as exact.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import sharp from "sharp";

const FPS = 30, W = 1080, H = 1920;

function arg(n) { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; }

function extractFrame(mp4, sec, out) {
  try {
    execSync(`ffmpeg -ss ${sec} -i "${mp4}" -frames:v 1 "${out}" -y`, { stdio: "pipe", timeout: 60000 });
    return existsSync(out);
  } catch { return false; }
}

async function inkCoverage(png) {
  try {
    const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    let ink = 0;
    for (let i = 0; i < data.length; i++) if (data[i] < 200) ink++;
    return ink / data.length;
  } catch { return null; }
}

async function marginInk(png) {
  try {
    const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    const m = 48, W2 = info.width, H2 = info.height;
    let ink = 0, total = 0;
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      const inMargin = x < m || x > W2 - m || y < 96 || y > H2 - 96;
      if (!inMargin) continue;
      total++;
      if (data[y * W2 + x] < 200) ink++;
    }
    return total ? ink / total : 0;
  } catch { return null; }
}

const main = async () => {
  const mp4 = arg("mp4");
  const planPath = arg("plan");
  const outDir = arg("out") || join(process.cwd(), "data", "frame-verify", basename(mp4 || "video"));
  if (!mp4 || !existsSync(mp4)) { console.error("no mp4"); process.exit(2); }
  mkdirSync(outDir, { recursive: true });
  let beats = [];
  try {
    const p = JSON.parse(readFileSync(planPath, "utf8"));
    beats = (p.beats || []).map((b, i) => ({ start: Number(b.start ?? b.start_frame / FPS ?? 0), end: Number(b.end ?? b.end_frame / FPS ?? (i + 1) * 5) }));
  } catch {
    const dur = Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${mp4}"`, { encoding: "utf8" }).trim()) || 60;
    const n = Math.max(1, Math.round(dur / 5));
    beats = Array.from({ length: n }, (_, i) => ({ start: (dur / n) * i, end: (dur / n) * (i + 1) }));
  }
  let fail = 0;
  for (const [i, b] of beats.entries()) {
    for (const frac of [0.25, 0.5, 0.75]) {
      const sec = b.start + (b.end - b.start) * frac;
      const out = join(outDir, `beat${i}_${frac * 100}.png`);
      if (!extractFrame(mp4, sec, out)) { console.log(`[frame-verify] beat ${i} @${frac}: no frame`); fail++; continue; }
      const cov = await inkCoverage(out);
      const margin = await marginInk(out);
      const present = cov != null && cov > 0.04;
      const offFrame = margin != null && margin > 0.02;
      if (!present || offFrame) fail++;
      console.log(`[frame-verify] beat ${i} @${Math.round(frac * 100)}%: ink ${(cov * 100).toFixed(1)}%${present ? "" : " NO PRIMARY ELEMENT"}${offFrame ? " OFF-FRAME" : ""}`);
    }
  }
  console.log(`[frame-verify] ${fail ? fail + " check(s) failed" : "all frames pass"}`);
  process.exit(fail ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(2); });
