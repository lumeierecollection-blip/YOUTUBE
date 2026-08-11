#!/usr/bin/env node
/**
 * video-review.js — extract real frames from a rendered video so the render
 * can be visually reviewed (by a human or a vision-capable agent) before it
 * is ever "confirmed". Never trust "should work": a render is not done until
 * its frames have actually been looked at.
 *
 * Usage:
 *   node scripts/video-review.js <video.mp4> [options]
 *     --frames N   number of frames to extract, evenly spaced (default 8)
 *     --out DIR    output directory (default: <video-dir>/../_review/<basename>)
 *
 * ffmpeg resolution: ffmpeg-static (devDependency) when present, else
 * `ffmpeg` on PATH. Writes frame-XX.png files, a contact-sheet.png, and
 * manifest.json describing exactly where each frame sits in time.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, basename, join, resolve, extname } from 'node:path';

const require = createRequire(import.meta.url);

function resolveFfmpeg() {
  try {
    const p = require('ffmpeg-static');
    if (p && existsSync(p)) return p;
  } catch {
    // fall through to PATH
  }
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
}

function parseArgs(argv) {
  const args = { video: null, frames: 8, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--frames') args.frames = parseInt(argv[++i], 10) || 8;
    else if (a === '--out') args.out = argv[++i];
    else if (!a.startsWith('-')) args.video = a;
  }
  if (!args.video) {
    console.error('Usage: node scripts/video-review.js <video.mp4> [--frames N] [--out DIR]');
    process.exit(2);
  }
  if (!existsSync(args.video)) {
    console.error(`video not found: ${args.video}`);
    process.exit(2);
  }
  return args;
}

function run(ffmpeg, args) {
  const r = spawnSync(ffmpeg, args, { encoding: 'utf8', windowsHide: true });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function probe(ffmpeg, video) {
  // ffmpeg writes probe info to stderr; expect non-zero exit, that is fine.
  const r = run(ffmpeg, ['-hide_banner', '-i', video]);
  const err = r.stderr;
  const durMatch = err.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
  const durSec = durMatch
    ? Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60 + Number(durMatch[3])
    : 0;
  const resMatch = err.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  const w = resMatch ? Number(resMatch[1]) : 0;
  const h = resMatch ? Number(resMatch[2]) : 0;
  const fpsMatch = err.match(/(\d+(?:\.\d+)?)\s*fps/);
  const fps = fpsMatch ? Number(fpsMatch[1]) : 0;
  return { durSec, w, h, fps };
}

function extractFrame(ffmpeg, video, outPng, t) {
  const r = run(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', t.toFixed(3), '-i', video,
    '-frames:v', '1', '-q:v', '2', outPng,
  ]);
  return r.status === 0 && existsSync(outPng);
}

function buildContactSheet(ffmpeg, dir, frames, w, h) {
  const cellW = Math.max(1, Math.floor(w / 4));
  const cellH = Math.max(1, Math.floor(h / 4));
  const cols = Math.max(1, Math.ceil(Math.sqrt(frames.length)));
  const rows = Math.max(1, Math.ceil(frames.length / cols));
  const sheet = join(dir, 'contact-sheet.png');
  const r = run(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', join(dir, 'frame-%02d.png'),
    '-vf', `scale=${cellW}:${cellH},tile=${cols}x${rows}:padding=8:color=black`,
    sheet,
  ]);
  return r.status === 0 ? sheet : null;
}

const args = parseArgs(process.argv.slice(2));
const ffmpeg = resolveFfmpeg();
const video = resolve(args.video);
const meta = probe(ffmpeg, video);

if (!meta.durSec) {
  console.error('probe failed: could not read Duration from ffmpeg output; not a playable video?');
  process.exit(1);
}

const outDir = args.out
  ? resolve(args.out)
  : join(dirname(video), '..', '_review', basename(video, extname(video)));
mkdirSync(outDir, { recursive: true });

const n = Math.max(1, Math.min(24, args.frames));
const frames = [];
for (let i = 0; i < n; i++) {
  const rawT = n === 1 ? 0 : (meta.durSec * i) / (n - 1);
  const t = Math.max(0, Math.min(rawT, meta.durSec - 0.1));
  const name = `frame-${String(i).padStart(2, '0')}.png`;
  const path = join(outDir, name);
  const ok = extractFrame(ffmpeg, video, path, t);
  frames.push({ i, t: Number(t.toFixed(3)), path, ok });
  console.log(`  ${ok ? 'OK ' : 'FAIL'} t=${t.toFixed(3)}s  ${path}`);
}

const failed = frames.filter((f) => !f.ok);
if (failed.length) {
  console.error(`${failed.length}/${n} frames failed to extract — review is incomplete, treat as NOT reviewed.`);
  process.exit(1);
}

let contactSheet = null;
if (n > 1) {
  contactSheet = buildContactSheet(ffmpeg, outDir, frames, meta.w, meta.h);
  if (contactSheet) console.log(`contact sheet: ${contactSheet}`);
}

const manifest = {
  tool: 'video-review',
  video,
  ffmpeg,
  durationSec: meta.durSec,
  width: meta.w,
  height: meta.h,
  fps: meta.fps,
  frames: frames.map((f) => ({ index: f.i, timeSec: f.t, file: f.path })),
  contactSheet,
  note: 'Frames must be viewed (Read the PNGs) before the render is confirmed.',
};
const manifestPath = join(outDir, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`\nvideo     : ${video}`);
console.log(`duration  : ${meta.durSec.toFixed(2)}s  ${meta.w}x${meta.h} @ ${meta.fps}fps`);
console.log(`frames    : ${n} (${outDir})`);
console.log(`manifest  : ${manifestPath}`);
console.log(`\nNext step: actually LOOK at the frames (and contact sheet) before confirming anything.`);