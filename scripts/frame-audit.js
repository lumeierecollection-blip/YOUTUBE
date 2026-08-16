#!/usr/bin/env node
/**
 * frame-audit.js — pixel-level audit of review frames against the style
 * manual's measurable rules. This is the "watching" a text-only model can
 * do: it converts visual properties into measured facts. It does NOT replace
 * a human (or vision-capable model) looking at the frames — it complements
 * them. Rules come from MOTION-GRAPHICS-MANUAL.md:
 *   A1.2/A1.3  SAFE rect {top:288, right:888, bottom:1248, left:48} and zones
 *   A2.1       bg is flat, never gradient (across ALL styles)
 *   PART 4.6   (motion-graphics-rebuild-v2) — text/background WCAG contrast
 *              must be >=4.5:1, measured the same way a real shipped defect
 *              was found (glyph rgb 191,191,191 on white, 1.84:1): sample the
 *              caption/headline zones, estimate the glyph colour as the pixel
 *              most different from the local background, compute WCAG
 *              contrast. This is CHECK-REGISTER.md COL-23.
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
  // Text-contrast sampling only: same y/h as headline/caption but inset past
  // the rail's x:44-56 column, which runs the full 288-1248 height (through
  // BOTH zones) at low opacity — without this inset, estimateForeground()
  // picks up the rail line itself instead of real glyph pixels whenever a
  // frame has no headline text (headline is null for several archetypes).
  headlineText: { x: 64, y: 964,  w: 824, h: 176 },
  captionText:  { x: 64, y: 1152, w: 824, h: 96  },
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
const MIN_TEXT_CONTRAST = 4.5; // WCAG AA — COL-23

// WCAG relative luminance / contrast ratio, mirroring
// src/skills/remotion-render/styles/tokens.js (kept standalone here: this
// script runs over exported PNGs, not the render bundle).
function relLuminance([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function wcagContrast(a, b) {
  const la = relLuminance(a), lb = relLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
// The glyph colour is estimated as the pixel most different from the local
// background — anti-aliased edge pixels sit between the two colours, so the
// single most-different pixel is the best available sample of pure glyph
// fill, which is exactly the pixel WCAG contrast should be measured against.
function estimateForeground(buf, bg) {
  let best = null, bestDist = -1;
  for (let i = 0; i < buf.length; i += 3) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    const dist = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
    if (dist > bestDist) {
      bestDist = dist;
      best = [r, g, b];
    }
  }
  return best;
}

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

  // 3b) COL-23 — caption text contrast. Sampled from captionText (inset past
  // the rail column — see ZONES note) so the persistent rail line is never
  // mistaken for the glyph. Gated on foreground presence WITHIN that same
  // inset region, not the wider capFraction above — the wide zone's rail
  // pixels can clear CAPTION_FG_MIN on their own even when the inset region
  // (excluding the rail) has no real text, which previously produced a false
  // "glyph" reading from plain encoder noise a few units off pure bg.
  let captionContrast = null;
  const capText = await region(data, info, ZONES.captionText);
  let capTextFg = 0;
  for (let i = 0; i < capText.length; i += 3) {
    if (Math.abs(capText[i] - bg[0]) > FG_DIFF || Math.abs(capText[i + 1] - bg[1]) > FG_DIFF || Math.abs(capText[i + 2] - bg[2]) > FG_DIFF) capTextFg++;
  }
  const capTextFraction = capTextFg / (capText.length / 3);
  if (capTextFraction >= CAPTION_FG_MIN) {
    const capFgColor = estimateForeground(capText, bg);
    captionContrast = wcagContrast(capFgColor, bg);
    if (captionContrast < MIN_TEXT_CONTRAST) {
      violations.push(
        `caption contrast ${captionContrast.toFixed(2)}:1 < ${MIN_TEXT_CONTRAST}:1 (glyph rgb(${capFgColor.join(",")}) on bg rgb(${bg.join(",")}))`
      );
    }
  }

  // 3c) COL-23 — headline text contrast, same method, when the headline
  // zone actually has foreground content (it isn't persistent like caption).
  let headlineContrast = null;
  const headlineText = await region(data, info, ZONES.headlineText);
  let headlineFg = 0;
  for (let i = 0; i < headlineText.length; i += 3) {
    if (Math.abs(headlineText[i] - bg[0]) > FG_DIFF || Math.abs(headlineText[i + 1] - bg[1]) > FG_DIFF || Math.abs(headlineText[i + 2] - bg[2]) > FG_DIFF) headlineFg++;
  }
  const headlineFraction = headlineFg / (headlineText.length / 3);
  if (headlineFraction >= CAPTION_FG_MIN) {
    const headlineFgColor = estimateForeground(headlineText, bg);
    headlineContrast = wcagContrast(headlineFgColor, bg);
    if (headlineContrast < MIN_TEXT_CONTRAST) {
      violations.push(
        `headline contrast ${headlineContrast.toFixed(2)}:1 < ${MIN_TEXT_CONTRAST}:1 (glyph rgb(${headlineFgColor.join(",")}) on bg rgb(${bg.join(",")}))`
      );
    }
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
    captionContrast,
    headlineContrast,
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
    `railFg=${(res.railForegroundFraction * 100).toFixed(2)}%  ` +
    `capContrast=${res.captionContrast ? res.captionContrast.toFixed(2) + ':1' : 'n/a'}  ` +
    `headlineContrast=${res.headlineContrast ? res.headlineContrast.toFixed(2) + ':1' : 'n/a'}`);
  for (const v of res.violations) console.log(`     VIOLATION: ${v}`);
}

const fails = results.filter((r) => !r.pass);
writeFileSync(join(dir, 'audit-report.json'), JSON.stringify({ generatedBy: 'frame-audit', rules: 'MOTION-GRAPHICS-MANUAL A1.3/A2.1, CHECK-REGISTER COL-23 (text contrast)', results }, null, 2) + '\n');
console.log(`\nframe-audit: ${results.length - fails.length}/${results.length} frames passed. Report: ${join(dir, 'audit-report.json')}`);
if (fails.length) {
  console.error('frame-audit FAILED — do NOT confirm this render.');
  process.exit(1);
}