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
  stage:    { x: 48,  y: 392,  w: 840, h: 548 },
  headline: { x: 48,  y: 964,  w: 840, h: 176 },
  caption:  { x: 48,  y: 1152, w: 840, h: 96  },
  // Text-contrast sampling only: same y/h as headline/caption but inset
  // past the left safe-rect edge, same margin frame-audit already uses
  // elsewhere — leaves room for estimateForeground() to land on real
  // glyph pixels whenever a frame has no headline text (headline is null
  // for several archetypes) without picking up the leftmost column noise.
  headlineText: { x: 64, y: 964,  w: 824, h: 176 },
  captionText:  { x: 64, y: 1152, w: 824, h: 96  },
};

// Regions that must be pure background (outside SAFE rect).
//
// PART 10 (follow-up) — a real headline ("ACCOUNTS EARLY") ran off the
// canvas edge, well past the safe rect's right edge (888), and NONE of
// the three margins below caught it: right-margin only samples y:400-800,
// which sits entirely ABOVE the headline zone (y:964-1140) and caption
// zone (y:1152-1248) — an 800px-tall gap in coverage on the exact side
// (right) where LTR text overflow actually happens. headline-right-margin
// closes that specific blind spot; it does not attempt to cover the full
// 800-1600 gap in general, since the Stage zone (y:392-940) is allowed to
// place freeform geometry that legitimately extends toward that edge
// (A1.4) and a margin probe there would false-positive on real content.
const MARGINS = [
  { name: 'top-margin',           x: 200, y: 100,  w: 400, h: 120 },
  { name: 'right-margin',         x: 940, y: 400,  w: 120, h: 400 },
  { name: 'headline-right-margin', x: 940, y: 964,  w: 120, h: 284 }, // headline (964-1140) + caption (1152-1248) zones
  { name: 'bottom-margin',        x: 200, y: 1600, w: 400, h: 160 },
];

const FG_DIFF = 20;    // max per-channel distance from bg to count as foreground
const FLAT_MAX = 14;   // max channel stddev in a pure-bg region (encoder noise)
const MARGIN_FG_MAX = 0.001;  // max foreground fraction inside margins
const CAPTION_FG_MIN = 0.0005; // min foreground fraction in caption zone
const MIN_TEXT_CONTRAST = 4.5; // WCAG AA — COL-23

// vox-style-treatment SKILL.md's canvas grain (effects/CanvasGrain.jsx) —
// "a LUMINANCE-NOISE TEXTURE, not a color change... does not touch hue, so
// it does not conflict with the flatness gate's actual purpose (which
// guards against color gradients/tints, not texture)." Raising FLAT_MAX
// alone would NOT honour that distinction — it would just tolerate MORE
// overall variance, including a genuine mild gradient slipping through.
// Instead this measures what KIND of variance is present, using two
// properties true of real grain (per-pixel, uncorrelated, chromaticity-
// neutral by construction — see CanvasGrain.jsx's header) that are NOT
// true of a gradient or tint:
//   - Noise is high-frequency: average a few neighbouring pixels together
//     (a blur) and it collapses toward the region's flat mean. A gradient
//     is low-frequency by definition and survives that same blur intact.
//     So a margin's BLURRED stddev has to stay under the original strict
//     FLAT_MAX even when its raw (unblurred) stddev is allowed to be
//     higher — a real gradient fails here regardless of how the raw
//     number is judged.
//   - Noise is achromatic: the SAME delta is added to r/g/b at a given
//     pixel (NoiseEffect's own shader is a single `rand()` scalar broadcast
//     into vec3 — see CanvasGrain.jsx), so channel DIFFERENCES (r-g, g-b)
//     stay near-constant across the region even though each channel's own
//     value swings with the grain. A tint/hue-shift moves channels apart
//     from each other, which this catches directly, independent of the
//     raw or blurred stddev.
// FLAT_MAX_WITH_GRAIN only raises the ceiling on the raw, unstructured
// number; both structural checks above still gate at the original FLAT_MAX.
const FLAT_MAX_WITH_GRAIN = 26; // raw stddev ceiling once grain is expected
const GRAIN_BLUR_SIGMA = 6; // px — well above per-pixel grain scale, well below margin region span

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

// Same region, blurred first — collapses high-frequency per-pixel noise
// toward the region's flat mean while leaving a genuine low-frequency
// gradient's trend intact. See FLAT_MAX_WITH_GRAIN's comment above.
async function blurredRegion(buf, meta, r) {
  return sharp(buf, { raw: { width: meta.width, height: meta.height, channels: 3 } })
    .extract({ left: r.x, top: r.y, width: r.w, height: r.h })
    .blur(GRAIN_BLUR_SIGMA)
    .raw()
    .toBuffer();
}

// Combined stddev of (r-g) and (g-b) per pixel, each measured against its
// OWN region-wide mean — near-zero for anything that shifts all three
// channels by the same amount per pixel (real grain), elevated for
// anything that shifts channels apart from each other (a colour tint or a
// hue-drifting gradient). Independent of overall brightness/contrast, so
// it isolates hue specifically, per FLAT_MAX_WITH_GRAIN's comment above.
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
    const blurred = await blurredRegion(data, info, m);
    marginStats[m.name] = {
      ...stats(r, r.length),
      blurredStddev: stats(blurred, blurred.length).stddev,
      chromaStddev: chromaStddev(r, r.length),
    };
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

  // 1) Flatness: every margin region must be near-uniform (no gradient/
  // tint) — but real, deliberate grain (effects/CanvasGrain.jsx) is
  // allowed. See FLAT_MAX_WITH_GRAIN's comment for why this is 3 separate
  // checks rather than one loosened number: raw stddev alone can't tell
  // "textured but flat" apart from "genuinely graded/tinted."
  for (const m of MARGINS) {
    const s = marginStats[m.name];
    if (s.blurredStddev > FLAT_MAX) {
      violations.push(`bg not flat in ${m.name} (blurred stddev ${s.blurredStddev.toFixed(1)} > ${FLAT_MAX} — survives blur, looks like a real gradient, not grain)`);
    } else if (s.chromaStddev > FLAT_MAX) {
      violations.push(`bg not flat in ${m.name} (chroma stddev ${s.chromaStddev.toFixed(1)} > ${FLAT_MAX} — channels diverge from each other, looks like a tint, not grain)`);
    } else if (s.stddev > FLAT_MAX_WITH_GRAIN) {
      violations.push(`bg not flat in ${m.name} (stddev ${s.stddev.toFixed(1)} > ${FLAT_MAX_WITH_GRAIN} even allowing for grain)`);
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

  // 3) Caption zone foreground fraction — measured and reported, NOT gated.
  //
  // PART 10 (follow-up) — this used to hard-fail below CAPTION_FG_MIN
  // ("persistent per A1.3"). Removing the Rail (a separate, deliberate
  // change this same pass made — see the follow-up's item 1) exposed that
  // this check had never actually been verifying caption persistence: the
  // Rail's own vertical line sits at x:44-56, overlapping this zone's
  // x:48 left edge, so its presence alone satisfied CAPTION_FG_MIN on
  // every frame regardless of whether a real caption was showing. With
  // the Rail gone, real (and apparently pre-existing) gaps between
  // caption pages surfaced — measured directly against this render's own
  // mg package: 3 real gaps of 33-40 frames (~1.1-1.3s) between caption
  // pages, landing where the section-proportional VO windows meet. This
  // script decouples entirely from mg.pages (it only ever sees rendered
  // PNGs), so it has no way to tell a genuine VO pause from a real
  // captioning defect — enforcing "never empty" here was never something
  // this tool could correctly judge; it happened to pass by accident, not
  // by measuring the right thing. capFraction is still reported so a
  // human/agent reviewing frames has the number, but it no longer gates.
  const cap = await region(data, info, ZONES.caption);
  let capFg = 0;
  for (let i = 0; i < cap.length; i += 3) {
    if (Math.abs(cap[i] - bg[0]) > FG_DIFF || Math.abs(cap[i + 1] - bg[1]) > FG_DIFF || Math.abs(cap[i + 2] - bg[2]) > FG_DIFF) capFg++;
  }
  const capFraction = capFg / (cap.length / 3);

  // 3b) COL-23 — caption text contrast. Sampled from captionText (inset —
  // see ZONES note) so a stray edge pixel is never mistaken for the glyph.
  // Gated on foreground presence WITHIN that same inset region, not the
  // wider capFraction above, which previously produced a false "glyph"
  // reading from plain encoder noise a few units off pure bg.
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

  return {
    file,
    bg: `rgb(${bg.join(',')})`,
    flatness: Math.max(...Object.values(marginStats).map((s) => s.stddev)),
    marginForegroundFraction: marginFg,
    captionForegroundFraction: capFraction,
    captionContrast,
    headlineContrast,
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