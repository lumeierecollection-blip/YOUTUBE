#!/usr/bin/env node
/**
 * frame-audit.js — pixel-level audit of review frames against the style
 * manual's measurable rules. This is the "watching" a text-only model can
 * do: it converts visual properties into measured facts. It does NOT replace
 * a human (or vision-capable model) looking at the frames — it complements
 * them. Rules come from MOTION-GRAPHICS-MANUAL.md:
 *   A1.2/A1.3  SAFE rect {top:288, right:888, bottom:1248, left:48} and zones
 *   A2.1       bg is flat, never gradient (across ALL styles)
 *
 * Usage:
 *   node scripts/frame-audit.js <review-dir>   (dir with manifest.json + frame-XX.png)
 *
 * Exit 1 if any check FAILS. Evidence goes to audit-report.json in the dir.
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SAFE = { top: 288, right: 888, bottom: 1248, left: 48 }; // manual A1.3
const W = 1080;
const H = 1920;
const ZONES = {
  kicker:   { x: 48,  y: 288,  w: 840, h: 72  },
  stage:    { x: 48,  y: 392,  w: 840, h: 548 },
  headline: { x: 48,  y: 964,  w: 840, h: 176 },
  caption:  { x: 48,  y: 1152, w: 840, h: 96  },
  rail:     { x: 44,  y: 288,  w: 12,  h: 960 },  // 4px rule + tolerance
};

// Regions that must be pure background (outside SAFE rect).
const MARGINS = [
  { name: 'top-margin',    x: 200, y: 100, w: 400, h: 120 },
  { name: 'right-margin',  x: 940, y: 400, w: 120, h: 400 },
  { name: 'bottom-margin', x: 200, y: 1600, w: 400, h: 160 },
];

const FG_DIFF = 20;    // max per-channel distance from bg to count as foreground
const FLAT_MAX = 14;   // max channel stddev in a pure-bg region (encoder noise)
const MARGIN_FG_MAX = 0.001;  // max foreground fraction inside margins
const CAPTION_FG_MIN = 0.0005; // min foreground fraction in caption zone
const RAIL_FG_MIN = 0.05;      // min foreground fraction in rail strip

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

async function region(buf, meta, r) {
  return sharp(buf, { raw: { width: meta.width, height: meta.height, channels: 3 } })
    .extract({ left: r.x, top: r.y, width: r.w, height: r.h })
    .raw()
    .toBuffer();
}

async function auditFrame(file) {
  const buf = await sharp(file).resize(W, H).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = buf;
  const px = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // Background = median of the three margin samples.
  const bgSamples = [];
  const marginStats = {};
  for (const m of MARGINS) {
    const r = await region(data, info, m);
    marginStats[m.name] = stats(r, r.length);
    bgSamples.push([r[0], r[1], r[2]]);
  }
  const bg = [
    Math.round(bgSamples.map((s) => s[0]).reduce((a, b) => a + b, 0) / bgSamples.length),
    Math.round(bgSamples.map((s) => s[1]).reduce((a, b) => a + b, 0) / bgSamples.length),
    Math.round(bgSamples.map((s) => s[2]).reduce((a, b) => a + b, 0) / bgSamples.length),
  ];

  const isFg = (x, y) => {
    const [r, g, b] = px(x, y);
    return Math.abs(r - bg[0]) > FG_DIFF || Math.abs(g - bg[1]) > FG_DIFF || Math.abs(b - bg[2]) > FG_DIFF;
  };

  const violations = [];

  // 1) Flatness: every margin region must be near-uniform (no gradient).
  for (const m of MARGINS) {
    const s = marginStats[m.name];
    if (s.stddev > FLAT_MAX) {
      violations.push(`bg not flat in ${m.name} (stddev ${s.stddev.toFixed(1)} > ${FLAT_MAX})`);
    }
  }

  // 2) Margins must be empty of content.
  let fgPixels = 0;
  for (const m of MARGINS) {
    const step = 2;
    for (let yy = m.y; yy < m.y + m.h; yy += step) {
      for (let xx = m.x; xx < m.x + m.w; xx += step) {
        if (isFg(xx, yy)) fgPixels++;
      }
    }
  }
  const totalSample = MARGINS.reduce((a, m) => a + (m.w / 2) * (m.h / 2), 0);
  const marginFg = fgPixels / totalSample;
  if (marginFg > MARGIN_FG_MAX) {
    violations.push(`content leaking into margins (${(marginFg * 100).toFixed(2)}% > ${MARGIN_FG_MAX * 100}%)`);
  }

  // 3) Caption zone must contain text on every frame (persistent per A1.3).
  const cap = await region(data, info, ZONES.caption);
  let capFg = 0;
  for (let i = 0; i < cap.length; i += 3) {
    if (Math.abs(cap[i] - bg[0]) > FG_DIFF || Math.abs(cap[i + 1] - bg[1]) > FG_DIFF || Math.abs(cap[i + 2] - bg[2]) > FG_DIFF) capFg++;
  }
  const capFraction = capFg / (cap.length / 3);
  if (capFraction < CAPTION_FG_MIN) {
    violations.push(`caption zone empty (${(capFraction * 100).toFixed(3)}% fg < ${CAPTION_FG_MIN * 100}%)`);
  }

  // 4) Rail must be present (persistent progress rule).
  const rail = await region(data, info, ZONES.rail);
  let railFg = 0;
  for (let i = 0; i < rail.length; i += 3) {
    if (Math.abs(rail[i] - bg[0]) > FG_DIFF || Math.abs(rail[i + 1] - bg[1]) > FG_DIFF || Math.abs(rail[i + 2] - bg[2]) > FG_DIFF) railFg++;
  }
  const railFraction = railFg / (rail.length / 3);
  if (railFraction < RAIL_FG_MIN) {
    violations.push(`rail missing (${(railFraction * 100).toFixed(2)}% fg < ${RAIL_FG_MIN * 100}%)`);
  }

  return {
    file,
    bg: `rgb(${bg.join(',')})`,
    flatness: Math.max(...Object.values(marginStats).map((s) => s.stddev)),
    marginForegroundFraction: marginFg,
    captionForegroundFraction: capFraction,
    railForegroundFraction: railFraction,
    pass: violations.length === 0,
    violations,
  };
}

const dir = resolve(process.argv[2] || '.');
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const results = [];
for (const f of manifest.frames) {
  const res = await auditFrame(f.file);
  results.push(res);
  const tag = res.pass ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${f.file.split(/[\\/]/).pop()}  bg=${res.bg}  flat=${res.flatness.toFixed(1)}  ` +
    `marginFg=${(res.marginForegroundFraction * 100).toFixed(3)}%  capFg=${(res.captionForegroundFraction * 100).toFixed(3)}%  ` +
    `railFg=${(res.railForegroundFraction * 100).toFixed(2)}%`);
  for (const v of res.violations) console.log(`     VIOLATION: ${v}`);
}

const fails = results.filter((r) => !r.pass);
writeFileSync(join(dir, 'audit-report.json'), JSON.stringify({ generatedBy: 'frame-audit', rules: 'MOTION-GRAPHICS-MANUAL A1.3/A2.1', results }, null, 2) + '\n');
console.log(`\nframe-audit: ${results.length - fails.length}/${results.length} frames passed. Report: ${join(dir, 'audit-report.json')}`);
if (fails.length) {
  console.error('frame-audit FAILED — do NOT confirm this render.');
  process.exit(1);
}