#!/usr/bin/env node
/**
 * data/audit/16/diagnose-col23.mjs — locality diagnostic for the Stage-16
 * COL-23 failures. For each frame in review-oldts, this locates WHERE the
 * foreground pixels are inside the probe zones (row bands), what colours they
 * are, and which margin regions are leaking foreground. Pure measurement;
 * no gate logic duplicated, no constants loosened.
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve(process.argv[2] || 'data/audit/16/review-oldts');
const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));

const ZONES = {
  stage:    { x: 48,  y: 392,  w: 840, h: 548 },
  headline: { x: 48,  y: 964,  w: 840, h: 176 },
  caption:  { x: 48,  y: 1152, w: 840, h: 96  },
  headlineText: { x: 64, y: 964,  w: 824, h: 176 },
  captionText:  { x: 64, y: 1152, w: 824, h: 96  },
};
const MARGINS = [
  { name: 'top-margin',            x: 200, y: 100,  w: 400, h: 120 },
  { name: 'right-margin',          x: 940, y: 400,  w: 120, h: 400 },
  { name: 'headline-right-margin', x: 940, y: 964,  w: 120, h: 284 },
  { name: 'bottom-margin',         x: 200, y: 1600, w: 400, h: 160 },
];
const FG_DIFF = 20;
const W = 1080, H = 1920;

function rowsOf(buf, meta, r, bg) {
  // bucket foreground pixels by (y - r.y); return the row bands that have fg
  const buckets = new Map();
  for (let y = 0; y < r.h; y++) {
    const row = [];
    for (let x = 0; x < r.w; x++) {
      const i = (y * r.w + x) * 3;
      const rr = buf[i], g = buf[i + 1], b = buf[i + 2];
      if (Math.abs(rr - bg[0]) > FG_DIFF || Math.abs(g - bg[1]) > FG_DIFF || Math.abs(b - bg[2]) > FG_DIFF) {
        row.push([x, rr, g, b]);
      }
    }
    if (row.length) buckets.set(y, row);
  }
  const bands = [];
  let cur = null;
  for (const [y, row] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    if (cur && y === cur.end + 1) cur.end = y;
    else {
      if (cur) bands.push(cur);
      cur = { start: y, end: y, rows: [] };
    }
    cur.rows.push(row);
  }
  if (cur) bands.push(cur);
  return bands.map((b) => ({
    absY: `${r.y + b.start}-${r.y + b.end}`,
    n: b.rows.reduce((a, r) => a + r.length, 0),
    // most-common fg colour in the band + min/max dist
    sample: sampleColours(b.rows, bg),
  }));
}

function sampleColours(rows, bg) {
  // most-common exact fg rgb in the band, plus the extremes (closest/farthest from bg)
  const freq = new Map();
  for (const row of rows) {
    for (const px of row) {
      const key = `${px[1]},${px[2]},${px[3]}`;
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  let mode = null, modeN = 0;
  let best = null, bestDist = -1;
  for (const [key, n] of freq) {
    const [r, g, b] = key.split(',').map(Number);
    const d = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
    if (n > modeN) { modeN = n; mode = key; }
    if (d > bestDist) { bestDist = d; best = key; }
  }
  return { mode: `rgb(${mode})`, modeCount: modeN, farthestFromBg: `rgb(${best})`, farthestDist: bestDist };
}

function marginFg(buf, meta, m, bg) {
  const extract = (x0, y0, w, h) => {
    const out = [];
    for (let y = y0; y < y0 + h; y += 2) {
      for (let x = x0; x < x0 + w; x += 2) {
        const i = (y * meta.width + x) * meta.channels;
        const rr = buf[i], g = buf[i + 1], b = buf[i + 2];
        if (Math.abs(rr - bg[0]) > FG_DIFF || Math.abs(g - bg[1]) > FG_DIFF || Math.abs(b - bg[2]) > FG_DIFF) {
          out.push({ x, y, rgb: [rr, g, b] });
        }
      }
    }
    return out;
  };
  const hits = extract(m.x, m.y, m.w, m.h);
  // cluster by y band to say WHERE the leak is
  const ys = hits.map((h) => h.y);
  const yMin = ys.length ? Math.min(...ys) : null;
  const yMax = ys.length ? Math.max(...ys) : null;
  return { n: hits.length, yRange: yMin !== null ? `${yMin}-${yMax}` : null, count: ys.length };
}

async function main() {
  // Compute region means exactly like frame-audit, but STATIC probe regions
  // for headline/caption zones need per-frame bg. Reuse margin median.
  for (const f of manifest.frames) {
    const file = f.file.replace(/\\\\/g, '\\');
    const buf = await sharp(file).resize(W, H).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data, info } = buf;
    const px = (x, y) => {
      const i = (y * info.width + x) * info.channels;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const bgSamples = [];
    for (const m of MARGINS) {
      bgSamples.push(px(m.x, m.y));
    }
    const bg = [
      Math.round(bgSamples.map((s) => s[0]).reduce((a, b) => a + b, 0) / bgSamples.length),
      Math.round(bgSamples.map((s) => s[1]).reduce((a, b) => a + b, 0) / bgSamples.length),
      Math.round(bgSamples.map((s) => s[2]).reduce((a, b) => a + b, 0) / bgSamples.length),
    ];
    const out = { frame: f.file.split(/[\\/]/).pop(), timeSec: f.timeSec, bg };
    for (const [zoneName, r] of Object.entries(ZONES)) {
      const region = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
        .extract({ left: r.x, top: r.y, width: r.w, height: r.h }).raw().toBuffer();
      const bands = rowsOf(region, { width: r.w, height: r.h }, r, bg);
      out[zoneName] = bands;
    }
    for (const m of MARGINS) {
      out[m.name] = marginFg(data, info, m, bg);
    }
    console.log(`=== ${out.frame} t=${out.timeSec} bg=rgb(${bg.join(',')})`);
    for (const zoneName of ['headlineText', 'captionText']) {
      console.log(`  ${zoneName}:`);
      for (const b of out[zoneName] || []) {
        console.log(`    y=${b.absY} n=${b.n} mode=${b.sample.mode} far=${b.sample.farthestFromBg} (d=${b.sample.farthestDist})`);
      }
    }
    for (const m of MARGINS) {
      const r = out[m.name];
      if (r.n) console.log(`  LEAK ${m.name}: ${r.n} samples, y ${r.yRange}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });