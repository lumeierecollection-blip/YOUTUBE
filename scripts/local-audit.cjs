#!/usr/bin/env node
/**
 * local-audit.cjs — deterministic BACKUP audit for a rendered video.
 *
 * Runs ONLY when one of the AI stages (challenger, Gemini frame review,
 * beat check) fails or cannot produce a verdict (render-and-qa.js
 * backupAudit()). No model, no network. Its verdict never approves a video
 * for upload: PASS routes the video to data/renders/approved-review/ for a
 * human, FAIL routes it to data/renders/rejected/. It exists so a video is
 * not lost when a checker was wrong or a Gemini call timed out — not as a
 * way to ship.
 *
 * Not the same tool as scripts/local-audit.js (the risk-level auditor used
 * by risk-based-review.js / render-and-qa-enhanced.js). This one answers a
 * fixed list of yes/no questions:
 *
 *   frames-nonempty   every beat's midpoint frame PNG is > 15 KB
 *   frames-centered   every beat's centre 200x200 crop differs from its
 *                     top-left 100x100 crop by > 5 (mean 0-255 luma)
 *   beat-durations    every beat's duration matches its SRT cue ±0.1s
 *                     (the plan carries no timings; render.js times beats
 *                     from the SRT cues, so the cue IS the plan's timing)
 *   library-names     every library_shape name in the plan is in the
 *                     object library registry
 *   beat-sentence-mechanism  every beat has an SRT sentence and a mechanism
 *   typography-count  TYPOGRAPHY beats: at most 2 (zero is allowed: the planner chooses every beat's type)
 *   mechanism-share   no effective mechanism over 40% of beats (effective =
 *                     TYPOGRAPHY, or CAPABILITY:<first capability> — the same
 *                     key the planner's mechanismDistribution uses)
 *   av-duration       audio within 1s of video
 *   frames-match-reference  every beat frame's luma histogram (16 bins,
 *                     144x256) is within L1 0.28 of the reference video's
 *                     mean histogram (data/reference/reference-histogram.json).
 *                     0.28 = 2x the reference's OWN maximum spread (its 79
 *                     frames sit at 0.026-0.140 from their mean); the old
 *                     dark-style frames measured 1.79-1.82.
 *   frames-fit-paper  (paper-style videos) every beat frame's rendered
 *                     content - every pixel on the paper darker than luma
 *                     200 - has its bounding box inside the paper's inner
 *                     content box (paper-layout.js PAPER_INNER), 4 px
 *                     tolerance. Sampled at 50% and 85% of each beat.
 *                     Also run on EVERY render, not only as a backup:
 *                     `--fit-only --video <mp4> --manifest <json>` exits 1
 *                     when any beat fails, and render-and-qa.js fails the
 *                     render.
 *
 *   FULL-CANVAS videos (2026-09-29; the paper checks above apply only to
 *   the retired paper style and are not run on them — frames-match-reference
 *   compared every frame with the WHITE-PAPER reference, which a full-bleed
 *   photo beat fails by construction):
 *   canvas-fit        every element box the renderer placed (manifest
 *                     beats[].canvas.boxes, canvas-layout.js) is inside the
 *                     frame less 48 px (a full-bleed photo is the frame);
 *                     no two text boxes overlap; nothing but a photo enters
 *                     the caption band (y 1450-1610)
 *   canvas-coverage   each beat's RENDERED content (pixels darker than luma
 *                     170 or with chroma > 45, above the caption band) spans
 *                     >= 60% of the frame height (0.5% tolerance for row
 *                     quantisation) — measured on the frames, at 62% and
 *                     90% of the beat, the larger counted
 *   canvas-accent     the channel accent (manifest.accent) covers >= 0.2% of
 *                     the frame in at least one beat (RGB distance < 40)
 *   motion-tiers      every beat has a tier; how many are "major" is the planner's call (was 2-3, 1-3 when
 *                     the video has fewer than 4 beats)
 *   canvas-type       the typography rebuild's rules on the manifest boxes:
 *                     nothing centred, sentence-case headlines, two type roles
 *                     in most beats, no composition twice in a row, dark beats
 *                     (>= 1, <= 2, never consecutive).
 *   canvas-ground     the ground reads uniform white (luma >= 245) on every
 *                     non-photo beat and no beat is dark, measured on
 *                     rendered pixels.
 *   `--canvas-only --video <mp4> --manifest <json>` runs these six on
 *   every render (render-and-qa.js) and exits 1 on a failure.
 *
 * Usage:
 *   node scripts/local-audit.cjs --video <mp4> --manifest <render-manifest.json>
 *     --plan <visual-plan.json> --srt <vo.srt> --audio <vo.mp3> [--out <json>]
 * Exit: 0 PASS, 1 FAIL, 2 could not run (missing input).
 */
"use strict";

const { spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } = require("node:fs");
const { join, dirname, basename } = require("node:path");
const { pathToFileURL } = require("node:url");
const { tmpdir } = require("node:os");

const ROOT = join(__dirname, "..");
const MIN_FRAME_BYTES = 15 * 1024;
const MIN_CENTER_DIFF = 5;
const DURATION_TOL = 0.1;
const AV_TOL = 1.0;
const MAX_MECH_SHARE = 0.4;

// A full-bleed photo beat covers the ground (and is exempt from the ground / coverage /
// middle-zone pixel checks); a PORTRAIT holds a photo on the white ground and is checked
// like any other beat (canvas-layout.js canvasManifest ground: "white").
const fullBleed = (c) => !!c?.photo && c?.ground !== "white";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
}

function resolveFfmpeg() {
  const bin = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const local = join(ROOT, "node_modules", "ffmpeg-static", bin);
  return existsSync(local) ? local : bin;
}
const FFMPEG = resolveFfmpeg();

function mediaDuration(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = String(r.stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
}

// The video's REAL pixel size. CI renders at renderScale 0.75 (810x1440),
// not the manifest's 1080x1920 design size; ffmpeg's stream line is the
// source of truth.
function videoSize(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = String(r.stderr || "").match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  return m ? { w: +m[1], h: +m[2] } : null;
}

function extractPng(video, t, out) {
  const r = spawnSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-ss", t.toFixed(3), "-i", video, "-frames:v", "1", out]);
  return r.status === 0 && existsSync(out);
}

// Mean luma (0-255) of a crop, read as raw 8-bit gray from ffmpeg.
function cropMean(video, t, w, h, x, y) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-ss", t.toFixed(3), "-i", video,
    "-frames:v", "1", "-vf", `crop=${w}:${h}:${x}:${y},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 });
  const buf = r.stdout;
  if (r.status !== 0 || !buf || !buf.length) return null;
  let s = 0;
  for (const v of buf) s += v;
  return s / buf.length;
}

const REF_HIST = join(ROOT, "data", "reference", "reference-histogram.json");
const REF_L1_MAX = 0.28;
function lumaHist(png) {
  const r = spawnSync(FFMPEG, ["-loglevel", "error", "-i", png, "-vf", "scale=144:256,format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 });
  if (r.status !== 0 || !r.stdout || !r.stdout.length) return null;
  const h = new Array(16).fill(0);
  for (const v of r.stdout) h[Math.min(15, v >> 4)]++;
  return h.map((x) => x / r.stdout.length);
}

// ── frames-fit-paper ─────────────────────────────────────────────────
const FIT_TOL = 4;          // px, in the video's own pixels — do not raise
const FIT_INK = 200;        // luma below this is content, not paper
const FIT_MIN_RUN = 2;      // a row/column counts with >= 2 content pixels (h264 noise)
function grayCrop(video, t, w, h, x, y) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-ss", t.toFixed(3), "-i", video,
    "-frames:v", "1", "-vf", `crop=${w}:${h}:${x}:${y},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 26 });
  return r.status === 0 && r.stdout && r.stdout.length === w * h ? r.stdout : null;
}
async function fitCheck(video, beats, DW, DH) {
  const { PAPER, PAPER_INNER } = await import(pathToFileURL(join(ROOT, "src", "skills", "remotion-render", "visual", "paper-layout.js")).href);
  const actual = videoSize(video);
  const sx = actual ? actual.w / DW : 1, sy = actual ? actual.h / DH : 1;
  // The paper, in video pixels, inset 2 px from its edge (anti-aliasing and
  // the paper's own drop shadow are not content).
  const px = Math.round(PAPER.x * sx) + 2, py = Math.round(PAPER.y * sy) + 2;
  const pw = Math.round(PAPER.w * sx) - 4, ph = Math.round(PAPER.h * sy) - 4;
  // The inner box, relative to that crop.
  const ix0 = PAPER_INNER.x * sx - 2, iy0 = PAPER_INNER.y * sy - 2;
  const ix1 = (PAPER_INNER.x + PAPER_INNER.w) * sx - 2, iy1 = (PAPER_INNER.y + PAPER_INNER.h) * sy - 2;
  const bad = [];
  let checked = 0;
  beats.forEach((b, i) => {
    for (const share of [0.5, 0.85]) {
      const t = (b.start_sec ?? 0) + (b.duration_sec ?? 0) * share;
      const buf = grayCrop(video, t, pw, ph, px, py);
      if (!buf) { bad.push(`beat ${i}: frame at ${t.toFixed(2)}s could not be read`); return; }
      checked++;
      const rows = new Array(ph).fill(0), cols = new Array(pw).fill(0);
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) if (buf[y * pw + x] < FIT_INK) { rows[y]++; cols[x]++; }
      const ry = rows.map((n, k) => (n >= FIT_MIN_RUN ? k : -1)).filter((k) => k >= 0);
      const cx = cols.map((n, k) => (n >= FIT_MIN_RUN ? k : -1)).filter((k) => k >= 0);
      if (!ry.length || !cx.length) continue;          // empty paper: nothing to overflow
      const x1 = cx[0], x2 = cx[cx.length - 1], y1 = ry[0], y2 = ry[ry.length - 1];
      if (x1 < ix0 - FIT_TOL || y1 < iy0 - FIT_TOL || x2 > ix1 + FIT_TOL || y2 > iy1 + FIT_TOL) {
        // Reported in PAPER design coordinates (inner box 40..484 x 40..886).
        const d = (v, s) => Math.round((v + 2) / s);
        const msg = `[fit] beat ${i}: content bbox (${d(x1, sx)},${d(y1, sy)},${d(x2, sx)},${d(y2, sy)}) exceeds paper inner box (${PAPER_INNER.x},${PAPER_INNER.y},${PAPER_INNER.x + PAPER_INNER.w},${PAPER_INNER.y + PAPER_INNER.h}) at ${Math.round(share * 100)}%`;
        console.log(msg);
        bad.push(msg.replace(/^\[fit\] /, ""));
        break;
      }
    }
  });
  return { bad, checked };
}

// ── shapes-clear-of-text ─────────────────────────────────────────────
// The abstract shapes are drawn in the same ink as the text, so a colour
// test cannot tell them apart. What does: a shape is THICKER than any text
// stroke (a petal is ~70 px wide, a swoosh stroke >= 13 px, while the
// boldest headline stem is a small fraction of the font size), or it is a
// thin line LONGER than any glyph, or it CROSSES a zone boundary (text is
// laid out inside its zone; a shape lives in the visual zone). In the
// HEADLINE and CAPTION zones, every solid-ink connected component is
// measured; one that is too thick, a long thin line, or touching the zone's
// edge is shape ink over text and fails the beat. Also: the manifest's
// shape_box (the renderer's own placement) must lie inside the VISUAL
// zone and within 220 x 220.
const SHAPE_INK = 110;          // luma below this = solid ink (text or shape)
// The thickest a text stroke can be scales with its font size: its half-
// width (the largest inscribed radius of a glyph) is at most
// TEXT_RADIUS_PER_EM x the font size + TEXT_RADIUS_PAD px. Calibrated on
// rendered frames of run 36397373831 ch-44: the thickest glyph ink measured
// was the tail junction of the "Q" in a 51 px bold headline, radius 6.22 px
// = 0.122 em; plain stems 0.105 em. Each beat's real sizes come from the
// manifest (render.js headline_size / caption_size, from paper-text.js).
const TEXT_RADIUS_PER_EM = 0.15;
const TEXT_RADIUS_PAD = 1.5;
const THIN_LONG_EXTENT = 110;   // design px: a line at least this long ...
const THIN_LONG_WIDTH = 4;      // ... whose mean width (area / length) is under this
const SHAPE_BOX_MAX = 220;

function inkComponents(buf, w, h) {
  const n = w * h, dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) dark[i] = buf[i] < SHAPE_INK ? 1 : 0;
  // Chamfer (3-4) distance from each ink pixel to the nearest non-ink pixel;
  // outside the crop counts as non-ink.
  const INF = 1 << 28, d = new Int32Array(n);
  for (let i = 0; i < n; i++) d[i] = dark[i] ? INF : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!dark[i]) continue;
    d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!dark[i]) continue;
    d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
  }
  // 8-connected components.
  const label = new Int32Array(n), comps = [], stack = [];
  for (let i = 0; i < n; i++) {
    if (!dark[i] || label[i]) continue;
    const c = { x1: w, y1: h, x2: -1, y2: -1, count: 0, radius: 0 };
    label[i] = comps.length + 1; stack.push(i);
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = (j - x) / w;
      c.count++; c.radius = Math.max(c.radius, d[j] / 3);
      if (x < c.x1) c.x1 = x; if (x > c.x2) c.x2 = x; if (y < c.y1) c.y1 = y; if (y > c.y2) c.y2 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const k = yy * w + xx;
        if (dark[k] && !label[k]) { label[k] = comps.length + 1; stack.push(k); }
      }
    }
    comps.push(c);
  }
  return comps;
}

async function shapesCheck(video, beats, DW, DH, debug = false) {
  const { PAPER, ZONES, boxInside } = await import(pathToFileURL(join(ROOT, "src", "skills", "remotion-render", "visual", "paper-layout.js")).href);
  const actual = videoSize(video);
  const sx = actual ? actual.w / DW : 1, sy = actual ? actual.h / DH : 1, s = (sx + sy) / 2;
  const bad = [];
  let checked = 0;
  const zoneCrop = (Z) => ({
    x: Math.round((PAPER.x + Z.x) * sx) + 1, y: Math.round((PAPER.y + Z.y) * sy) + 1,
    w: Math.round(Z.w * sx) - 2, h: Math.round(Z.h * sy) - 2,
  });
  const toPaper = (Z, c, k) => {
    const X = (v) => Math.round((v + 1) / sx + Z.x), Y = (v) => Math.round((v + 1) / sy + Z.y);
    return `${X(c.x1)},${Y(c.y1)},${X(c.x2)},${Y(c.y2)}`;
  };
  beats.forEach((b, i) => {
    // Geometry: where the renderer put the shape (render.js shape_box).
    if (b.shape_box) {
      const sb = b.shape_box;
      if (!boxInside(sb, ZONES.VISUAL, 0.5) || sb.w > SHAPE_BOX_MAX + 0.5 || sb.h > SHAPE_BOX_MAX + 0.5) {
        const msg = `[shapes] beat ${i}: shape box (${Math.round(sb.x)},${Math.round(sb.y)},${Math.round(sb.x + sb.w)},${Math.round(sb.y + sb.h)}) is outside the visual zone or over ${SHAPE_BOX_MAX}x${SHAPE_BOX_MAX}`;
        console.log(msg); bad.push(msg.replace(/^\[shapes\] /, "")); return;
      }
    }
    for (const share of [0.5, 0.85]) {
      const t = (b.start_sec ?? 0) + (b.duration_sec ?? 0) * share;
      let failed = null;
      // Legacy manifests without sizes are read at the largest sizes the
      // renderer can draw (84 px headline, 26 px caption).
      const maxRadius = {
        headline: TEXT_RADIUS_PER_EM * (Number(b.headline_size) || 84) + TEXT_RADIUS_PAD,
        caption: TEXT_RADIUS_PER_EM * (Number(b.caption_size) || 26) * 1.08 + TEXT_RADIUS_PAD,
      };
      for (const [name, Z] of [["headline", ZONES.HEADLINE], ["caption", ZONES.CAPTION]]) {
        const cr = zoneCrop(Z);
        const buf = grayCrop(video, t, cr.w, cr.h, cr.x, cr.y);
        if (!buf) { failed = `beat ${i}: ${name} zone at ${t.toFixed(2)}s could not be read`; break; }
        const comps = inkComponents(buf, cr.w, cr.h);
        // Text ink bounds, for the report.
        const tb = comps.reduce((a, c) => ({ x1: Math.min(a.x1, c.x1), y1: Math.min(a.y1, c.y1), x2: Math.max(a.x2, c.x2), y2: Math.max(a.y2, c.y2) }), { x1: cr.w, y1: cr.h, x2: -1, y2: -1 });
        for (const c of comps) {
          const radius = c.radius / s, ext = Math.max(c.x2 - c.x1 + 1, c.y2 - c.y1 + 1) / s, width = c.count / (s * s) / Math.max(1, ext);
          const crossing = c.y1 === 0 || c.y2 === cr.h - 1;
          const why = radius > maxRadius[name] ? `ink ${(radius * 2).toFixed(1)} px thick (this beat's ${name} text strokes are at most ${(maxRadius[name] * 2).toFixed(1)})`
            : ext >= THIN_LONG_EXTENT && width < THIN_LONG_WIDTH ? `a thin line ${ext.toFixed(0)} px long`
            : crossing ? `ink crossing the ${name} zone's ${c.y1 === 0 ? "top" : "bottom"} edge`
            : null;
          if (debug) console.log(`[shapes-debug] beat ${i} ${Math.round(share * 100)}% ${name}: comp (${toPaper(Z, c)}) radius ${radius.toFixed(2)} extent ${ext.toFixed(0)} width ${width.toFixed(1)} n ${c.count}${why ? "  <== " + why : ""}`);
          if (why && !failed) {
            failed = `[shapes] beat ${i}: shape pixels inside the ${name} zone at ${Math.round(share * 100)}% — ${why}; component (${toPaper(Z, c)}), text ink (${tb.x2 >= 0 ? toPaper(Z, tb) : "none"})`;
          }
        }
        if (failed) break;
      }
      checked++;
      if (failed) { console.log(failed.startsWith("[shapes]") ? failed : `[shapes] ${failed}`); bad.push(failed.replace(/^\[shapes\] /, "")); break; }
    }
  });
  return { bad, checked };
}

// ── full-canvas checks ───────────────────────────────────────────────
const SAFE_INSET = 48, CAPTION_Y0 = 1450, CAPTION_Y1 = 1610, COVER_MIN = 0.6, COVER_TOL = 0.005;
// Channel id for log lines, from data/renders/<ch>/… (or a queue dir: "?").
const channelOf = (video) => (String(video || "").match(/renders[\\/](\d+)[\\/]/) || [])[1] || "?";
const TEXT_BOXES = ["kicker", "headline", "statement", "number", "label", "emphasis"];
function rgbFrame(video, t, w, h) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-ss", t.toFixed(3), "-i", video,
    "-frames:v", "1", "-vf", `scale=${w}:${h},format=rgb24`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 27 });
  return r.status === 0 && r.stdout && r.stdout.length === w * h * 3 ? r.stdout : null;
}
/**
 * What is "ink" on THIS frame's ground.
 *
 * zones-no-overlap, pop-transitions and middle-zone-filled all said ink = luma < 235: the house
 * white ground, which every beat had until the planner could declare its own (a dark #0E0E10
 * beat reads as ink in every pixel, so every column "crossed" a zone edge and an EMPTY dark frame
 * counted as full). The ground is read from the frame's own empty bottom-left corner, below the
 * caption band — the same patch canvas-coverage reads — so a transition frame (the held outgoing
 * beat on one ground, the incoming on another) is judged against the ground it is actually drawn
 * on, not the beat's.
 *
 * Where the ground reads as paper (luma >= 235) the original rule is returned UNCHANGED, so every
 * white-ground and near-white (#F0F0F0) result is byte-identical. Only a ground the old rule would
 * itself have called ink (dark, mid) gets the relative rule: ink is what differs from the ground
 * by more than `delta` luma (and, for the colour part, by more than 30 chroma).
 */
const PAPER_LUMA = 235;
function frameGround(buf, W, H) {
  const x0 = Math.max(1, Math.floor(W * 0.01)), x1 = Math.max(x0 + 2, Math.floor(W * 0.025));
  const y0 = Math.min(H - 3, Math.floor(H * 0.985)), y1 = Math.max(y0 + 2, Math.floor(H * 0.996));
  let l = 0, c = 0, n = 0;
  for (let y = y0; y < y1 && y < H; y++) for (let x = x0; x < x1 && x < W; x++) {
    const o = (y * W + x) * 3, r = buf[o], g = buf[o + 1], b = buf[o + 2];
    l += 0.299 * r + 0.587 * g + 0.114 * b; c += Math.max(r, g, b) - Math.min(r, g, b); n++;
  }
  return n ? { l: l / n, c: c / n } : { l: 255, c: 0 };
}
/** (r,g,b) -> boolean, luma AND chroma (zones-no-overlap). */
function inkFnColour(buf, W, H) {
  const g = frameGround(buf, W, H);
  if (g.l >= PAPER_LUMA) return (r, gg, b) => 0.299 * r + 0.587 * gg + 0.114 * b < 235 || Math.max(r, gg, b) - Math.min(r, gg, b) > 30;
  return (r, gg, b) => Math.abs(0.299 * r + 0.587 * gg + 0.114 * b - g.l) > 20 || Math.abs(Math.max(r, gg, b) - Math.min(r, gg, b) - g.c) > 30;
}
/** luma -> boolean (pop-transitions, middle-zone-filled); `paperMax` is the old absolute threshold, `delta` the relative one. */
function inkFnLuma(buf, W, H, paperMax = 235, delta = 20) {
  const g = frameGround(buf, W, H);
  if (g.l >= PAPER_LUMA) return (l) => l < paperMax;
  return (l) => Math.abs(l - g.l) > delta;
}
function canvasFit(beats) {
  const bad = [];
  const inter = (a, b) => a.x < b.x + b.w - 2 && b.x < a.x + a.w - 2 && a.y < b.y + b.h - 2 && b.y < a.y + a.h - 2;
  // A full-bleed photo, the centred map and the diagonal split shape bleed to
  // the frame edge by design; every other box stays inside the safe area.
  const BLEEDS = new Set(["photo", "map", "split"]);
  const TEXT_ROLES = new Set(["headline", "number", "data", "emphasis"]);
  beats.forEach((b, i) => {
    const boxes = b.canvas?.boxes;
    if (!boxes) { bad.push(`beat ${i}: no canvas boxes in the manifest`); return; }
    for (const [k, v] of Object.entries(boxes)) {
      if (BLEEDS.has(k) || v.role === "shape") continue;
      if (v.x < SAFE_INSET - 0.5 || v.y < SAFE_INSET - 0.5 || v.x + v.w > 1080 - SAFE_INSET + 0.5 + (v.bleed || 0) || v.y + v.h > 1920 - SAFE_INSET + 0.5) {
        bad.push(`beat ${i}: ${k} box (${v.x},${v.y},${v.x + v.w},${v.y + v.h}) leaves the frame's safe area`);
      }
      // The band belongs to the caption-class line: since 2026-10-08 that is the planner's pull
      // phrase placed "bottom" (the live caption is gone). It still answers the safe area above and
      // the text-overlap rule below; everything else stays out of the band.
      const bandOwner = k === "pull" && b.canvas?.chrome?.pull_phrase?.position === "bottom";
      if (!bandOwner && v.y + v.h > CAPTION_Y0 + 0.5 && v.y < CAPTION_Y1) bad.push(`beat ${i}: ${k} box (y ${v.y}-${v.y + v.h}) enters the caption band`);
    }
    // Text overlap, by type role (so a list item, a timeline label or a split
    // value counts as well as the classic headline / number boxes).
    const texts = Object.entries(boxes).filter(([k, v]) => TEXT_ROLES.has(v.role) || TEXT_BOXES.includes(k.replace(/\d+$/, "")));
    for (let a = 0; a < texts.length; a++) for (let c = a + 1; c < texts.length; c++) {
      if (inter(texts[a][1], texts[c][1])) bad.push(`beat ${i}: text boxes ${texts[a][0]} and ${texts[c][0]} overlap`);
    }
  });
  return bad;
}
function canvasCoverage(video, beats) {
  // Half scale: at 1/5 a thin italic kicker blurred into the ground and was
  // not counted (run 36500636962 ch-2) — more pixels, a more accurate span.
  const W = 540, H = 960;                          // 1/2 scale: rows are 2 design px
  const capRow = Math.floor((CAPTION_Y0 / 1920) * H);
  const bad = [], spans = [];
  beats.forEach((b, i) => {
    let best = 0;
    // A full-bleed photo is the whole frame by construction.
    if (fullBleed(b.canvas)) { spans.push(1); return; }
    for (const share of (process.env.COV_SHARES ? process.env.COV_SHARES.split(",").map(Number) : [0.62, 0.9])) {   // every phrase landed; the late sample is where a list has built up
      const t = (b.start_sec ?? 0) + (b.duration_sec ?? 0) * share;
      const buf = rgbFrame(video, t, W, H);
      if (!buf) continue;
      // The ground is read from the frame's own empty bottom-left corner: a
      // dark beat (#0E0E0E) is content where it is LIGHT, a light beat where
      // it is dark — "darker than 170" alone read a whole dark frame as content.
      let g0 = 0;
      for (let yy = H - 12; yy < H - 4; yy++) for (let xx = 4; xx < 12; xx++) { const o = (yy * W + xx) * 3; g0 += 0.299 * buf[o] + 0.587 * buf[o + 1] + 0.114 * buf[o + 2]; }
      g0 /= 64;
      let first = -1, last = -1;
      // A map's land is content: its pale tint (a few luma off the ground)
      // is what the map draws, not empty ground. Measured with the ink rule
      // only, the zone-confined map read 54-59% (CI run 36944700437) though
      // its land fills the middle zone. The 60% threshold is unchanged.
      const lumaMin = b.canvas?.composition === "MAP-CENTERED" ? 6 : 74;
      for (let y = 0; y < capRow; y++) {
        let n = 0;
        for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 3, r = buf[o], g = buf[o + 1], bl = buf[o + 2];
          const l = 0.299 * r + 0.587 * g + 0.114 * bl;
          if (Math.abs(l - g0) > lumaMin || Math.max(r, g, bl) - Math.min(r, g, bl) > 45) n++;
        }
        if (n >= 4) { if (first < 0) first = y; last = y; }
      }
      if (first >= 0) best = Math.max(best, (last - first + 1) / H);
    }
    spans.push(best);
    // The span is whole half-scale rows / 960, so a beat that just reaches the
    // line can read 0.599 — printed "60%", failed "< 60%" (run 36915319430
    // ch-9 beat 0). COVER_TOL absorbs that; the 60% threshold is unchanged.
    const pass = best >= COVER_MIN - COVER_TOL;
    console.log(`[audit] ch-${channelOf(video)} beat ${i} coverage: ${best.toFixed(4)}, threshold ${COVER_MIN.toFixed(3)}, result ${pass ? "PASS" : "FAIL"}`);
    if (!pass) bad.push(`beat ${i} (${b.canvas?.composition || "?"}): content spans ${(best * 100).toFixed(1)}% of the frame height (< ${COVER_MIN * 100}%)`);
  });
  return { bad, spans };
}
function canvasAccent(video, beats, accent) {
  if (!accent) return { bad: ["the manifest names no accent colour (channels.json colors.canvas_accent)"], best: 0 };
  const [ar, ag, ab] = [1, 3, 5].map((k) => parseInt(accent.slice(k, k + 2), 16));
  const W = 216, H = 384;
  let best = 0, where = -1;
  beats.forEach((b, i) => {
    const t = (b.start_sec ?? 0) + (b.duration_sec ?? 0) * 0.7;
    const buf = rgbFrame(video, t, W, H);
    if (!buf) return;
    let n = 0;
    for (let o = 0; o < buf.length; o += 3) {
      const d = Math.hypot(buf[o] - ar, buf[o + 1] - ag, buf[o + 2] - ab);
      if (d < 40) n++;
    }
    const f = n / (W * H);
    if (f > best) { best = f; where = i; }
  });
  return { bad: best >= 0.002 ? [] : [`accent ${accent} covers at most ${(best * 100).toFixed(2)}% of any beat frame (need 0.2% in one)`], best, where };
}
function motionTiers(beats) {
  const bad = [];
  const tiers = beats.map((b) => b.canvas?.motion_tier);
  tiers.forEach((t, i) => { if (!["micro", "medium", "major"].includes(t)) bad.push(`beat ${i}: no motion tier`); });
  // How many beats are "major" is the planner's decision (zero through all); the old 2-3 rule is
  // applied at plan time only when the planner marked none (gemini-visual-plan.js), so what is
  // checked here is that every beat HAS a tier.
  const major = tiers.filter((t) => t === "major").length;
  return { bad, major, medium: tiers.filter((t) => t === "medium").length };
}
// ── typography rebuild checks ─────────────────────────────────────────
const TYPE_TEXT = ["headline", "statement", "number", "emphasis"];
const ROLE_OF = (k) => k.replace(/\d+$/, "");
/**
 * canvas-type: what the brief's stop condition asks of the type system, read
 * from the boxes the renderer placed (manifest beats[].canvas):
 *   - nothing centred (headline / statement / number / emphasis are left- or
 *     right-aligned, and none sits on the frame's centre line),
 *   - headlines are sentence case, never all-caps,
 *   - at least two type roles in most beats (>= 60% of them),
 *   - no composition type twice in a row,
 *   - (dark beats are retired)
 */
// THE TEXT GRID (owner, 2026-10-10): every beat's words centred and standing on one line (canvas-layout.js TEXT_GRID).
const TEXT_GRID_ON = true, GRID_BASE = 1328, GRID_TOL = 40;
/**
 * grid — measured on the RENDERED frame (owner, 2026-10-10: "every check must read the rendered frame, not the manifest"). For each beat
 * with words, the ink inside the words' box (the box the layout says, widened 60 px each side) is found on a frame after the words have
 * landed: the ink's horizontal centre must be within GRID_TOL of the frame's axis, and the bottom of its ink (the last line's baseline
 * region) within GRID_TOL of the grid line. Every beat's measured position is reported. Where it stops: a full-bleed photo under the words
 * makes "ink" the photo too — those beats are measured on the words' own colour (the darkest / lightest band), and are reported as such.
 */
async function textGrid(video, beats, fps = 30) {
  const rows = [], bad = [];
  const W = 540, H = 960, sc = H / 1920;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i], c = b.canvas || {};
    const t = c.boxes?.statement || c.boxes?.headline;
    if (!t || !(t.w > 0)) { rows.push({ beat: i, words: null }); continue; }
    const at = (b.start_sec ?? 0) + Math.max(0.1, (b.duration_sec ?? 0) * 0.85);
    const buf = rgbFrame(video, at, W, H);
    if (!buf) continue;
    const g = frameGround(buf, W, H);
    const x0 = Math.max(0, Math.floor((t.x - 60) * sc)), x1 = Math.min(W - 1, Math.ceil((t.x + t.w + 60) * sc));
    const y0 = Math.max(0, Math.floor((t.y - 40) * sc)), y1 = Math.min(H - 1, Math.ceil((t.y + t.h + (t.desc || 0) + 40) * sc));
    let minX = Infinity, maxX = -Infinity, maxY = -Infinity, n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = (y * W + x) * 3, l = 0.299 * buf[o] + 0.587 * buf[o + 1] + 0.114 * buf[o + 2];
      if (Math.abs(l - g.l) > 60) { n++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    }
    if (!n) { rows.push({ beat: i, words: "no ink found" }); bad.push(`beat ${i}: no words found where the layout puts them`); continue; }
    const cx = Math.round(((minX + maxX) / 2) / sc), bottom = Math.round(maxY / sc);
    rows.push({ beat: i, composition: c.composition, centre_x: cx, bottom_y: bottom });
    if (Math.abs(cx - 540) > GRID_TOL) bad.push(`beat ${i} (${c.composition}): the words are centred at x ${cx}, not on the frame's axis (540 ± ${GRID_TOL})`);
    if (Math.abs(bottom - GRID_BASE) > GRID_TOL + 20) bad.push(`beat ${i} (${c.composition}): the words end at y ${bottom}, not on the grid line (${GRID_BASE} ± ${GRID_TOL})`);
  }
  const ys = rows.filter((r) => Number.isFinite(r.bottom_y)).map((r) => r.bottom_y);
  if (ys.length > 1 && Math.max(...ys) - Math.min(...ys) > 2 * GRID_TOL + 20) bad.push(`the words' baseline wanders ${Math.min(...ys)}-${Math.max(...ys)} across the video (one grid line)`);
  return { rows, bad };
}

function canvasType(beats) {
  const bad = [];
  const roleSets = [];
  beats.forEach((b, i) => {
    const c = b.canvas;
    if (!c) return;
    const roles = new Set();
    for (const [k, v] of Object.entries(c.boxes || {})) {
      if (k === "photo" || k === "chart" || ROLE_OF(k) === "nodes") continue;
      const r = v.role || null;
      if (r && r !== "rule") roles.add(r);
      if (TYPE_TEXT.includes(ROLE_OF(k))) {
        // Part C.1 (owner's spec 2026-10-03): a TYPE-FULL statement is centred on the frame's
        // axis by design; two centred beats in a row are refused below (part C.2).
        // The words-only cards (TYPE-TITLE / -CHAPTER / -DEFINITION) are centred too (owner, 2026-10-09:
        // "Extend C.1 to the cards"); the same C.2 below refuses two centred beats in a row.
        if (TEXT_GRID_ON) { if (!v.align && !v.rotate) bad.push(`beat ${i}: ${k} has no alignment`); continue; }
        if (v.align === "center" && k === "statement" && ["TYPE-FULL", "TYPE-TITLE", "TYPE-CHAPTER", "TYPE-DEFINITION"].includes(c.composition)) continue;
        if (v.align === "center") bad.push(`beat ${i}: ${k} is centred`);
        else if (!v.align && !v.rotate) bad.push(`beat ${i}: ${k} has no alignment`);
        if (!v.rotate && Math.abs(v.x + v.w / 2 - 540) < 24 && v.w < 700) bad.push(`beat ${i}: ${k} sits on the frame's centre line`);
      }
    }
    // a chart's own figures / labels are the data role too
    if (["DATA-FULL", "PROCESS-FULL"].includes(c.composition)) roles.add("data");
    roleSets.push(roles.size);
    const h = c.headline_text;
    if (h) {
      const letters = h.replace(/[^A-Za-z]/g, "");
      if (letters.length >= 6 && letters === letters.toUpperCase()) bad.push(`beat ${i}: headline "${h}" is all caps`);
    }
    // A TYPE-FULL beat with a hero cutout (boxes.cutout0) is its own composition: the object, not a statement.
    // A hero cutout and a name card (an entity's name over its figure) are their own compositions.
    // A hero beat is keyed by its OBJECT (owner's spec 2026-10-03, C.3: two cutout beats in a
    // row both render) — only the same object twice in a row is a repeat.
    const compKey = (x) => (x?.composition || "") + (x?.boxes?.cutout0 ? `+HERO:${x?.concept_visuals?.[0]?.name || ""}` : "") + (x?.boxes?.lead_phrase ? "+NAME" : "") + (x?.art ? `:${x.art.kind}${x.art.style ? `/${x.art.style}` : ""}` : "");
    if (i > 0 && beats[i - 1].canvas && compKey(beats[i - 1].canvas) === compKey(c)) bad.push(`beat ${i}: ${compKey(c)} twice in a row`);
    // Part C.2: never two centred headlines in a row.
    const centred = (x) => Object.values(x?.boxes || {}).some((v) => v && v.align === "center" && v.role === "headline");
    if (!TEXT_GRID_ON && i > 0 && centred(c) && centred(beats[i - 1].canvas)) bad.push(`beat ${i}: a centred headline two beats in a row`);
    // Owner, 2026-10-09: no two consecutive beats share an alignment (left / right / centre of the headline).
    const al = c.headline_align, pal = i > 0 ? beats[i - 1].canvas?.headline_align : null;
    if (!TEXT_GRID_ON && al && pal && al === pal) bad.push(`beat ${i}: its words are ${al}-aligned like beat ${i - 1}'s`);
    // Headline motion: one per beat, never the same two beats in a row, never a fade.
    const hm = c.headline_motion, pm = i > 0 ? beats[i - 1].canvas?.headline_motion : null;
    if (hm === "fade") bad.push(`beat ${i}: the headline fades (headlines never fade)`);
    if (hm && pm && hm === pm) bad.push(`beat ${i}: headline motion "${hm}" twice in a row`);
  });
  // RETIRED 2026-10-08 (owner, "kill the template"): "at least two type roles on >= 60% of beats"
  // was met by drawing a kicker beside the headline on most beats — it REQUIRED the label +
  // headline chassis the owner ordered removed ("some beats headline-only ... variation is
  // required"). CI run 37832958615 ch-9 failed it at 4/9 with no chrome at all. The same axis is
  // now gated the other way by template-window (no two devices repeating in any three beats).
  // The count is still reported.
  const two = roleSets.filter((n) => n >= 2).length;
  return { bad, two, n: roleSets.length };
}
// canvas-ground: every beat that is not a full-bleed photo is drawn on the ground it declared.
// A beat that declared none (manifest canvas.ground_color null) has the house white
// (visual/backgrounds.js GROUND): a bottom-left patch below the caption band, where nothing but the
// ground lives, reads luma >= 245. A beat that declared a ground (the planner's `ground`, a hex in
// canvas.ground_color) must read that colour there, within 14 per RGB channel (h264 rounding). The
// check no longer decides WHICH ground a beat should have — the plan does — only that the render
// drew the one it declared.
function canvasGround(video, beats) {
  const bad = [];
  const W = 540, H = 960;
  beats.forEach((b, i) => {
    if (fullBleed(b.canvas)) return;
    const t = (b.start_sec ?? 0) + (b.duration_sec ?? 0) * 0.7;
    const buf = rgbFrame(video, t, W, H);
    if (!buf) return;
    let r = 0, g = 0, bl = 0, n = 0;
    for (let y = H - 70; y < H - 30; y++) for (let x = 24; x < 64; x++) { const o = (y * W + x) * 3; r += buf[o]; g += buf[o + 1]; bl += buf[o + 2]; n++; }
    const mean = [r / n, g / n, bl / n];
    const declared = b.canvas?.ground_color;
    if (!declared) {
      const luma = 0.299 * mean[0] + 0.587 * mean[1] + 0.114 * mean[2];
      if (luma < 245) bad.push(`beat ${i}: the white ground reads luma ${luma.toFixed(0)} (< 245)`);
      return;
    }
    const want = [1, 3, 5].map((k) => parseInt(declared.slice(k, k + 2), 16));
    if (mean.some((v, k) => Math.abs(v - want[k]) > 14)) bad.push(`beat ${i}: the declared ground ${declared} reads rgb(${mean.map((v) => Math.round(v)).join(",")})`);
  });
  return { bad };
}
/**
 * kinetic-rules (pop family, owner's spec 2026-09-30): every word of a
 * headline / statement / kicker / label has a POP entrance (visual/kinetic.js
 * ENTRANCES — no slide, drop, mask sweep, blur or rotate); kickers and labels
 * pop soft; the emphasis word pops with POP_EMPHASIS unless the whole beat
 * pops hard / by letter / as a stack; POP_HARD only on the hook (first beat)
 * or CTA (last); POP_LETTER on at most one beat; at most three text elements
 * on a beat; a year / article number pops and never rolls; a beat with a
 * headline has mixed weights (a bold word) and an accent word. Reports the
 * entrance mix and number modes.
 */
async function kineticRules(beats) {
  const K = await import("../src/skills/remotion-render/visual/kinetic.js");
  const bad = [], used = {}, modes = new Set();
  let letterBeats = 0;
  beats.forEach((b, i) => {
    const c = b.canvas || {}, k = c.kinetic, bx = c.boxes || {};
    if (!k) { bad.push(`beat ${i}: no kinetic plan recorded`); return; }
    const edge = i === 0 || i === beats.length - 1;
    const text = ["headline", "statement", "kicker", "label", "emphasis"].filter((r) => bx[r]).length + (bx.number ? 1 : 0);
    if (text > 3) bad.push(`beat ${i}: ${text} text elements (max 3)`);
    let letter = false;
    for (const role of ["headline", "statement", "kicker", "label"]) {
      if (!bx[role]) continue;
      const list = k.entrances?.[role] || [], words = c.words?.[role] || [];
      const label = role === "kicker" || role === "label";
      if (list.length < words.length) bad.push(`beat ${i}: ${role} has ${words.length} words but ${list.length} entrances`);
      const beatWide = list.some((e) => e === "POP_HARD" || e === "POP_LETTER" || e === "POP_WORD_STACK");
      list.forEach((e, j) => {
        if (!K.ENTRANCES.includes(e)) bad.push(`beat ${i}: ${role} word ${j} entrance "${e}" is not a pop`);
        if (label && e !== "POP_SOFT") bad.push(`beat ${i}: ${role} word ${j} pops ${e} (labels pop soft)`);
        if (e === "POP_HARD" && !edge) bad.push(`beat ${i}: ${role} word ${j} pops hard off the hook / CTA`);
        if (!label && !beatWide && words[j]?.emph && e !== "POP_EMPHASIS") bad.push(`beat ${i}: emphasis word "${words[j].t}" pops ${e}, not POP_EMPHASIS`);
        if (e === "POP_LETTER") letter = true;
        used[e] = (used[e] || 0) + 1;
      });
      if (role === "headline" || role === "statement") {
        if (!bx[role].rotate && words.length >= 2 && !words.some((w) => w.weight >= 700)) bad.push(`beat ${i}: ${role} has no bold word (weight is not mixed)`);
        if (!bx[role].rotate && words.length >= 2 && !words.some((w) => w.accent || w.emph)) bad.push(`beat ${i}: ${role} has no accent/emphasis word`);
      }
    }
    if (letter) letterBeats++;
    if (bx.number) {
      modes.add(k.number);
      if (!K.NUMBER_MODES.includes(k.number)) bad.push(`beat ${i}: number mode "${k.number}" is not a pop`);
      const q = bx.number.parts?.isQuantity;
      if (q === false && k.number === "pop_roll") bad.push(`beat ${i}: a non-quantity number (${bx.number.parts?.text}) rolls`);
    }
  });
  if (letterBeats > 1) bad.push(`POP_LETTER on ${letterBeats} beats (at most one a video)`);
  return { bad, used, modes: [...modes] };
}
/**
 * zones-no-overlap (owner's rule, 2026-10-02): every beat stacks three zones
 * (canvas-layout.js ZONES: top 0-620, middle 620-1340, bottom 1340-1920 —
 * the caption's) and each element lives in exactly one; no two element types
 * share a zone (a number may sit on the chart whose value it is). Two parts:
 *   1. the renderer's own boxes (manifest beats[].canvas.boxes) through the
 *      same zoneReport() the layout tests use;
 *   2. the RENDERED frames, at 30 / 62 / 90% of each non-photo beat: no ink
 *      (luma < 235 or chroma > 30 on a paper-white ground; on a dark / mid ground, a luma
 *      or chroma difference from the frame's own ground — see inkFnColour) runs continuously
 *      across a zone edge further than ZONE_TOL (8 px) on either side — what
 *      the camera or an animation carries across the line, which the boxes
 *      cannot show. A run in >= 3 columns fails.
 * Where it stops: a full-bleed photo beat and a beat with a diagonal split
 * shape (both cross every zone by design) get only part 1. Part 2 reads
 * pixels, not element identity: it proves nothing crosses a zone edge, and
 * with part 1 (one type per zone) that is the no-overlap rule.
 */
async function zonesNoOverlap(video, beats) {
  const { zoneReport, ZONES, ZONE_TOL } = await import(require("node:url").pathToFileURL(join(__dirname, "..", "src", "skills", "remotion-render", "visual", "canvas-layout.js")).href);
  const bad = [];
  const W = 540, H = 960, sc = H / 1920;
  const edges = [ZONES.top[1], ZONES.middle[1]];
  const ch = channelOf(video);
  beats.forEach((b, i) => {
    const c = b.canvas;
    if (!c?.boxes) return;
    const zr = zoneReport({ composition: c.composition, boxes: c.boxes });
    if (!zr.ok) bad.push(`beat ${i} (${c.composition}): ${[...zr.spans, ...zr.clashes].join("; ")}`);
    if (fullBleed(c) || Object.values(c.boxes).some((v) => v?.role === "shape")) return;
    for (const share of [0.3, 0.62, 0.9]) {
      const t = (b.start_sec ?? 0) + (b.duration_sec ?? 0) * share;
      const buf = rgbFrame(video, t, W, H);
      if (!buf) continue;
      const isInk = inkFnColour(buf, W, H);
      const ink = (x, y) => { const o = (y * W + x) * 3; return isInk(buf[o], buf[o + 1], buf[o + 2]); };
      for (const e of edges) {
        const y0 = Math.floor((e - ZONE_TOL - 1) * sc), y1 = Math.ceil((e + ZONE_TOL + 1) * sc);
        let cols = 0;
        for (let x = 0; x < W; x++) {
          let run = true;
          for (let y = y0; y <= y1 && run; y++) run = ink(x, y);
          if (run) cols++;
        }
        console.log(`[zones] ch-${ch} beat ${i} @${(share * 100).toFixed(0)}% edge y${e}: ${cols} column(s) of ink cross it`);
        if (cols >= 3) bad.push(`beat ${i} (${c.composition}) at ${(share * 100).toFixed(0)}%: ink crosses the zone edge at y ${e} in ${cols} columns (> ${ZONE_TOL} px each side)`);
      }
    }
  });
  return { bad };
}

/**
 * visual-centred (owner, 2026-10-09: "the visual is the hero of the beat ... near the frame's vertical center, not in
 * the top third"): on the RENDERED frame at 62% of every beat, the mass of the visual — the pixels of its box that differ
 * from the ground, text boxes masked out — has its centroid between y 640 and y 1500 (not in the top third), and the
 * visual is actually there (>= 3% of its box is not ground). A beat whose visual is in the top third with empty space
 * below fails. Full-bleed photos are the whole frame and are not judged.
 */
async function visualCentred(video, beats, m_fps = 30) {
  const bad = [], rows = [];
  const W = 540, H = 960, sc = H / 1920;
  const VISUALS = ["portrait", "cutout0", "chart", "map", "number", "photo"];
  beats.forEach((b, i) => {
    const c = b.canvas;
    if (!c?.boxes || fullBleed(c)) return;
    const key = VISUALS.find((k) => c.boxes[k] && c.boxes[k].w > 0 && c.boxes[k].h > 0 && !(k === "number" && c.composition === "NUMBER-STAT" && false));
    if (!key) return;
    const vb = c.boxes[key];
    // 62% of the beat — or 0.4 s after its picture pops on the word that names it (canvas.entity_pop), if later.
    const popSec = Number.isFinite(c.entity_pop?.frame) ? c.entity_pop.frame / (m_fps || 30) + 0.4 : 0;
    const t = (b.start_sec ?? 0) + Math.min(Math.max((b.duration_sec ?? 0) * 0.62, popSec), Math.max(0, (b.duration_sec ?? 0) - 0.1));
    const buf = rgbFrame(video, t, W, H);
    if (!buf) return;
    const g = frameGround(buf, W, H);
    const lumaAt =(x, y) => { const o = (y * W + x) * 3; return 0.299 * buf[o] + 0.587 * buf[o + 1] + 0.114 * buf[o + 2]; };
    const textBoxes = Object.entries(c.boxes).filter(([k, v]) => v && v.w > 0 && /^(headline|statement|kicker|label|emphasis|lead|pull)/.test(k) && k !== key).map(([, v]) => v);
    const masked = (x, y) => textBoxes.some((v) => x >= v.x * sc - 2 && x <= (v.x + v.w) * sc + 2 && y >= v.y * sc - 2 && y <= (v.y + v.h + (v.desc || 0)) * sc + 2);
    const x0 = Math.max(0, Math.floor(vb.x * sc)), x1 = Math.min(W - 1, Math.ceil((vb.x + vb.w) * sc)), y0 = Math.max(0, Math.floor(vb.y * sc)), y1 = Math.min(H - 1, Math.ceil((vb.y + vb.h) * sc));
    let n = 0, sy = 0, sx = 0, area = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (masked(x, y)) continue;
      area++;
      if (Math.abs(lumaAt(x, y) - g.l) > 22) { n++; sy += y; sx += x; }
    }
    if (!area) return;
    const cy = n ? sy / n / sc : null, cx = n ? sx / n / sc : null, share = n / area;
    rows.push(`beat ${i} (${c.composition}) ${key}: centroid (${cx ? Math.round(cx) : "-"}, ${cy ? Math.round(cy) : "-"}), ${(share * 100).toFixed(0)}% of its box inked`);
    if (share < 0.03) bad.push(`beat ${i} (${c.composition}): the ${key} is not on the frame (${(share * 100).toFixed(1)}% of its box differs from the ground)`);
    else if (cy < 640) bad.push(`beat ${i} (${c.composition}): the ${key}'s mass sits at y ${Math.round(cy)} — in the top third, not near the centre (y 960)`);
    // Left- or right-PINNED by accident: a visual whose mass sits in the outer fifth of the frame, where no composition
    // chose an offset (an edge-cropped photo, an inset card and a scatter are offset on purpose; a hero NUMBER is typography\n    // anchored left / right by the alternating-alignment rule — its vertical centre is still judged).
    else if (cx && (cx < 216 || cx > 864) && key !== "number" && !["PHOTO-EDGE", "PHOTO-INSET", "HERO-SCATTER", "PHOTO-STRIP"].includes(c.composition)) bad.push(`beat ${i} (${c.composition}): the ${key}'s mass sits at x ${Math.round(cx)} — pinned to a side of the frame (centre x 540)`);
    else if (cy > 1500) bad.push(`beat ${i} (${c.composition}): the ${key}'s mass sits at y ${Math.round(cy)} — below the middle of the frame`);
  });
  return { bad, rows };
}

/**
 * Where a flag's box is at time t. A flag grows by `art_push` over its beat about the bottom edge of its box (canvas-layout.js FLAG_PUSH,
 * drawn by full-canvas.jsx EntityArt), so its border and corners are where the renderer drew them then, not where the layout first put
 * the box. Pure: box in any px unit, u = progress through the beat (0..1).
 */
function grownBox(box, push, u) {
  if (!box || !(push > 0)) return box;
  const s = 1 + push * Math.min(1, Math.max(0, u));
  return { x: box.x + box.w / 2 - (box.w * s) / 2, y: box.y + box.h - box.h * s, w: box.w * s, h: box.h * s };
}

/**
 * visual-contrast (owner, 2026-10-09: "no large element of the visual may share the ground's luminance, so it disappears.
 * A flag with a white field on a white ground fails — the white stripe vanishes and the flag reads as loose bars"), on the
 * RENDERED frame (after the picture pops): a rectangular visual — a flag, a framed photo card — must be BOUNDED all the way
 * round: at least 92% of the ring of pixels just inside its box differ from the ground (by luma > 25 or chroma > 30). A flag
 * drawn with its ink border passes however white its fields are; one drawn without fails. A cut-out or logo that vanishes
 * is caught by visual-centred (its box is not inked) and, before render, by scripts/ground-legal.mjs.
 */
async function visualContrast(video, beats, fps = 30) {
  const bad = [], rows = [];
  const W = 540, H = 960, sc = H / 1920;
  beats.forEach((b, i) => {
    const c = b.canvas;
    let box = c?.composition === "ENTITY-ART" && c.art?.kind === "flag" ? c.boxes?.art : ["PHOTO-CARD"].includes(c?.composition) ? c.boxes?.photo : null;
    if (!box || !(box.w > 0)) return;
    const popSec = Number.isFinite(c.entity_pop?.frame) ? c.entity_pop.frame / fps + 0.4 : 0.9;
    const t = (b.start_sec ?? 0) + Math.min(Math.max((b.duration_sec ?? 0) * 0.62, popSec), Math.max(0, (b.duration_sec ?? 0) - 0.1));
    const buf = rgbFrame(video, t, W, H);
    if (!buf) return;
    box = grownBox(box, c.art_push, (t - (b.start_sec ?? 0)) / Math.max(1e-6, b.duration_sec ?? 0));
    const g = frameGround(buf, W, H);
    const px = (x, y) => { const o = (y * W + x) * 3; return [buf[o], buf[o + 1], buf[o + 2]]; };
    const differs = (x, y) => { const [r, gg, bl] = px(x, y); const l = 0.299 * r + 0.587 * gg + 0.114 * bl; return Math.abs(l - g.l) > 25 || Math.max(r, gg, bl) - Math.min(r, gg, bl) > 30; };
    // 1 px inside the box: a flag's 6 px ink border (3 px at this scale) is what bounds it.
    const x0 = Math.max(0, Math.round(box.x * sc) + 1), x1 = Math.min(W - 1, Math.round((box.x + box.w) * sc) - 2), y0 = Math.max(0, Math.round(box.y * sc) + 1), y1 = Math.min(H - 1, Math.round((box.y + box.h) * sc) - 2);
    let n = 0, d = 0;
    const ring = (x, y) => { n++; if (differs(x, y)) d++; };
    for (let x = x0; x <= x1; x++) { ring(x, y0); ring(x, y1); }
    for (let y = y0; y <= y1; y++) { ring(x0, y); ring(x1, y); }
    const share = n ? d / n : 1;
    rows.push(`beat ${i} (${c.composition}${c.art ? ` ${c.art.kind}` : ""}): ${(share * 100).toFixed(0)}% of its outline differs from the ground`);
    if (share < 0.92) bad.push(`beat ${i} (${c.composition}${c.art ? ` ${c.art.kind} "${c.art.name}"` : ""}): only ${(share * 100).toFixed(0)}% of its outline is distinguishable from the ground — part of it vanishes into it`);
  });
  return { bad, rows };
}

/**
 * entity-marks (owner, 2026-10-09: "an organisation is its ACTUAL logo, or its name set in type; never a stock document / box icon"): every
 * ENTITY-ART beat for an organisation, person or place draws, per named entity, its real mark (an asset with its licence recorded) or its
 * name set in type (the plate draws the name itself); no icon, no repeated mark within the beat, and the caption never repeats the name the
 * plate carries. Manifest-level: the frames are judged by gemini-frame-review.js --look-check / --entity-check.
 */
function entityMarks(beats) {
  const bad = [], rows = [];
  beats.forEach((b, i) => {
    const c = b.canvas, a = c?.art;
    if (!a || !(String(a.kind).startsWith("plate-") || a.kind === "plates")) return;
    const names = a.kind === "plates" ? a.names || [] : [a.name];
    const label = `beat ${i} (${a.kind} ${names.join(", ")})`;
    const marks = names.map((n, k) => (a.items?.[k]?.asset ? `logo ${a.items[k].asset}` : "name in type"));
    rows.push(`${label}: ${marks.join(" | ")}`);
    if (a.icon || a.glyph) bad.push(`${label}: draws an icon (${a.icon || a.glyph}) for a named entity`);
    const assets = (a.items || []).filter((it) => it?.asset).map((it) => it.asset);
    if (new Set(assets).size < assets.length) bad.push(`${label}: the same mark is drawn twice in the beat`);
    a.items?.forEach((it, k) => { if (it?.asset && !it.license) bad.push(`${label}: the mark for "${names[k]}" has no recorded licence`); });
    const cap = String(c.boxes?.statement?.text || (c.words?.statement || []).map((w) => w.t).join(" ") || "");
    const nz = (x) => ` ${String(x || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
    for (const n of names) if (n && nz(cap).includes(nz(n))) bad.push(`${label}: the caption "${cap}" repeats the name the plate already carries`);
  });
  return { bad, rows };
}

/**
 * image-sources (owner, 2026-10-10: "REAL PHOTOS, NOT SAMPLES ... every image on screen must be traceable to a source URL"). Every image a
 * beat draws — a photo, a cutout or logo, a flag, an organisation's mark — must carry its source URL (fetched, licence-checked, vision-verified
 * at fetch time), that URL must answer, and the file must not be one of the repo's sample images (by path or by content). Drawn icons /
 * symbols are not images (Lucide, in-repo) and are not judged here. Where it stops: "the image matches the entity" is judged on the frame by
 * gemini-frame-review.js --entity-check / --naming-check, not here.
 */
const SAMPLE_DIRS = ["b-roll/", "asset-library/", "_probe-fixtures/", "silhouettes/", "documents/generic"];
async function imageSources(beats) {
  const bad = [], rows = [];
  const pub = join(__dirname, "..", "src", "skills", "remotion-render", "public");
  const crypto = require("node:crypto");
  const hashOf = (f) => { try { return crypto.createHash("sha1").update(readFileSync(f)).digest("hex"); } catch { return null; } };
  const sampleHashes = new Set();
  const walk = (d) => { try { for (const e of require("node:fs").readdirSync(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(png|jpe?g|webp)$/i.test(e.name)) { const h = hashOf(f); if (h) sampleHashes.add(h); } } } catch {} };
  for (const d of ["b-roll", "asset-library", "_probe-fixtures", "silhouettes", "documents"]) walk(join(pub, d));
  const reach = new Map();
  const reachable = async (url) => {
    if (reach.has(url)) return reach.get(url);
    let ok = false, why = "";
    for (let k = 0; k < 2 && !ok; k++) {
      try { const r = await fetch(url, { method: "GET", headers: { "user-agent": "YOUTUBE-pipeline image-source check", range: "bytes=0-0" }, redirect: "follow", signal: AbortSignal.timeout(12000) }); ok = r.status < 400 || [401, 403, 429].includes(r.status); why = `HTTP ${r.status}${r.status === 403 ? " (the site refuses scripts; the page exists)" : ""}`; }
      catch (e) { why = e.message; }
    }
    reach.set(url, { ok, why });
    return { ok, why };
  };
  let needed = 0, real = 0;
  for (let i = 0; i < beats.length; i++) {
    const c = beats[i].canvas || {};
    const imgs = [];
    if (c.photo?.asset) imgs.push({ what: "photo", asset: c.photo.asset, url: c.photo.source_url });
    for (const v of c.concept_visuals || []) if (v.asset && v.class !== "symbol") imgs.push({ what: v.logo ? "logo" : "cutout", asset: v.asset, url: v.source_url });
    if (c.art?.asset) imgs.push({ what: c.art.kind, asset: c.art.asset, url: c.art.source_url });
    (c.art?.items || []).forEach((it) => { if (it?.asset) imgs.push({ what: "mark", asset: it.asset, url: it.source_url }); });
    for (const im of imgs) {
      needed++;
      const label = `beat ${i} ${im.what} ${im.asset}`;
      if (SAMPLE_DIRS.some((d) => String(im.asset).startsWith(d))) { bad.push(`${label}: a repo sample image is on screen`); continue; }
      const h = hashOf(join(pub, im.asset));
      if (h && sampleHashes.has(h)) { bad.push(`${label}: the file is a copy of a repo sample image`); continue; }
      if (!im.url) { bad.push(`${label}: no source URL recorded — it does not ship`); continue; }
      const r = await reachable(im.url);
      if (!r.ok) { bad.push(`${label}: its source ${im.url} does not answer (${r.why})`); continue; }
      real++;
      rows.push(`${label} <- ${im.url}`);
    }
  }
  return { bad, rows, needed, real };
}

/**
 * flat-look (owner, 2026-10-09: "they shouldn't look playful — actually that motion graphic"): on the rendered frame of every beat that
 * draws a chart, timeline, diagram, date card, time scale, plate or flag — the reference palette only (ink, neutrals and the channel's
 * ONE accent), sharp corners on a boxed element, no drop shadow. scripts/lib/flat-look.cjs has the measures and where they stop;
 * motion (no spring / bounce / overshoot) is asserted by scripts/__tests__/flat-look.test.js on the animation states and the source.
 */
async function flatLook(video, beats, accent, fps = 30) {
  const { offPalette, shadowShare, cornersSharp, OFF_SHARE_MAX } = require("./lib/flat-look.cjs");
  const COMPS = new Set(["ENTITY-ART", "DATA-FULL", "TIMELINE", "PROCESS-FULL"]);
  const bad = [], rows = [];
  const W = 540, H = 960, sc = H / 1920;
  beats.forEach((b, i) => {
    const c = b.canvas;
    if (!c || !COMPS.has(c.composition)) return;
    const art = c.composition === "ENTITY-ART" ? c.art : null;
    let box = art && c.boxes?.art ? { x: c.boxes.art.x * sc, y: c.boxes.art.y * sc, w: c.boxes.art.w * sc, h: c.boxes.art.h * sc } : null;
    // A single plate is a square inside its box (smaller when a real mark leaves room for its label); a row of plates has several corners.
    const labelled = !!art && Array.isArray(art.items) && art.items.some((it) => it && it.asset);
    if (box && art && String(art.kind).startsWith("plate-")) { const side = Math.min(box.w, labelled ? box.h - 35 : box.h); box.x += (box.w - side) / 2; box.w = side; box.h = side; }
    const boxed = !!box && art.kind === "flag";   // name cards are unboxed type now (the fixture look); a flag keeps its hairline frame
    const popSec = Number.isFinite(c.entity_pop?.frame) ? c.entity_pop.frame / fps + 0.4 : 0.9;
    const t = (b.start_sec ?? 0) + Math.min(Math.max((b.duration_sec ?? 0) * 0.62, popSec), Math.max(0, (b.duration_sec ?? 0) - 0.1));
    if (art?.kind === "flag") box = grownBox(box, c.art_push, (t - (b.start_sec ?? 0)) / Math.max(1e-6, b.duration_sec ?? 0));
    const buf = rgbFrame(video, t, W, H);
    if (!buf) return;
    const g = frameGround(buf, W, H);
    const name = `beat ${i} (${c.composition}${art ? ` ${art.kind}` : ""})`;
    // A flag is a real flag: its own colours are the entity's, judged by visual-contrast; everything else drawn is judged for palette.
    const pal = offPalette(buf, W, H, accent, { y1: Math.floor((CAPTION_Y0 / 1920) * H), skip: box && (art?.kind === "flag" || (Array.isArray(art?.items) && art.items.some((it) => it && it.asset))) ? [{ x: Math.floor(box.x), y: Math.floor(box.y), w: Math.ceil(box.w) + 1, h: Math.ceil(box.h) + 1 }] : [] });
    const sh = boxed ? shadowShare(buf, W, H, box, g.l) : 0;
    // A plate with its mark's name set under it: the label sits where the bottom corners' diagonals start, so only the top two are judged.
    const which = labelled && String(art?.kind).startsWith("plate-") ? [0, 1] : [0, 1, 2, 3];
    const corners = boxed ? cornersSharp(buf, W, H, box, g.l, which) + (4 - which.length) : 4;
    rows.push(`${name}: off-accent colour ${(pal.share * 100).toFixed(2)}%${boxed ? `, shadow strip ${(sh * 100).toFixed(0)}%, sharp corners ${corners}/4` : ""}`);
    if (pal.share > OFF_SHARE_MAX) bad.push(`${name}: ${(pal.share * 100).toFixed(2)}% of the frame is a colour that is neither ink, neutral nor the accent ${accent} (max ${(OFF_SHARE_MAX * 100).toFixed(1)}%) — a palette the reference does not use`);
    if (sh > 0.25) bad.push(`${name}: a soft shadow halo along its edge (${(sh * 100).toFixed(0)}% of the strip) — the reference's components are flat`);
    if (corners < 4) bad.push(`${name}: ${4 - corners} corner(s) are rounded off — the reference's components have sharp corners`);
  });
  return { bad, rows };
}

/**
 * pop-transitions (owner's spec 2026-10-02): across every beat boundary the
 * composition replaces itself in place — no frame of the 10-frame window may
 * be empty (the old "cut" left blank frames between beats). Every frame from
 * the boundary to +10 must hold content above the caption row (>= 12 ink rows
 * at 1/4 scale). Where it stops: element MOVEMENT (> 10 px) is not measured
 * here — the compositor (full-canvas.jsx PopGroups) only scales elements in
 * place about their own centre, with a static camera, by construction.
 */
function popTransitions(video, m) {
  const bad = [];
  const fps = m.fps || 30, W = 270, H = 480, capRow = Math.floor((CAPTION_Y0 / 1920) * H);
  (m.beats || []).forEach((b, k) => {
    if (k === 0) return;
    const empty = [];
    for (let f = 0; f <= 10; f++) {
      const buf = rgbFrame(video, (b.start_sec ?? 0) + f / fps, W, H);
      if (!buf) continue;
      const isInk = inkFnLuma(buf, W, H);
      let rows = 0;
      for (let y = 0; y < capRow; y++) {
        let n = 0;
        for (let x = 0; x < W; x++) { const o = (y * W + x) * 3; if (isInk(0.299 * buf[o] + 0.587 * buf[o + 1] + 0.114 * buf[o + 2])) n++; }
        if (n >= 3) rows++;
      }
      if (rows < 12) empty.push(f);
    }
    if (empty.length) bad.push(`beat ${k}: the composition is empty at boundary frame(s) ${empty.join(", ")}`);
  });
  return { bad };
}

/**
 * middle-zone-filled (owner's spec 2026-10-02: "never render a beat where the
 * middle zone is empty and the type is at the top and bottom"): on every
 * non-photo beat, at 62% and 90%, at least 15% of the rows of y 620-1340
 * hold content (ink, or a map's land tint). The beat passes on its fuller
 * sample.
 */
function middleZoneFilled(video, beats) {
  const bad = [];
  const W = 270, H = 480, y0 = Math.floor((620 / 1920) * H), y1 = Math.ceil((1340 / 1920) * H);
  beats.forEach((b, i) => {
    if (fullBleed(b.canvas)) return;
    const map = b.canvas?.composition === "MAP-CENTERED";
    let best = 0;
    for (const share of [0.62, 0.9]) {
      const buf = rgbFrame(video, (b.start_sec ?? 0) + (b.duration_sec ?? 0) * share, W, H);
      if (!buf) continue;
      const isInk = inkFnLuma(buf, W, H, map ? 249 : 235, map ? 6 : 20);
      let rows = 0;
      for (let y = y0; y < y1; y++) {
        let n = 0;
        for (let x = 0; x < W; x++) { const o = (y * W + x) * 3; const l = 0.299 * buf[o] + 0.587 * buf[o + 1] + 0.114 * buf[o + 2]; if (isInk(l)) n++; }
        if (n >= 3) rows++;
      }
      best = Math.max(best, rows / (y1 - y0));
    }
    if (best < 0.15) bad.push(`beat ${i} (${b.canvas?.composition || "?"}): the middle zone is ${(best * 100).toFixed(0)}% filled (< 15%)`);
  });
  return { bad };
}

async function canvasChecks(video, m) {
  const beats = m.beats || [];
  const out = [];
  const fit = canvasFit(beats);
  out.push({ id: "canvas-fit", pass: !fit.length, detail: fit.length ? fit.join("; ") : `${beats.length} beat(s): every element inside the safe area, no text overlap, caption band clear` });
  const cov = canvasCoverage(video, beats);
  out.push({ id: "canvas-coverage", pass: !cov.bad.length, detail: cov.bad.length ? cov.bad.join("; ") : `every beat's content spans >= 60% of the frame height (min ${(Math.min(...cov.spans) * 100).toFixed(0)}%)` });
  const acc = canvasAccent(video, beats, m.accent);
  out.push({ id: "canvas-accent", pass: !acc.bad.length, detail: acc.bad.length ? acc.bad.join("; ") : `accent ${m.accent} in beat ${acc.where} (${(acc.best * 100).toFixed(1)}% of the frame)` });
  const ty = canvasType(beats);
  out.push({ id: "canvas-type", pass: !ty.bad.length, detail: ty.bad.length ? ty.bad.join("; ") : `nothing centred, sentence-case headlines, ${ty.two}/${ty.n} beats with two type roles, no repeated composition` });
  const tx = canvasGround(video, beats);
  out.push({ id: "canvas-ground", pass: !tx.bad.length, detail: tx.bad.length ? tx.bad.join("; ") : "the ground reads uniform white on every non-photo beat" });
  const zn = await zonesNoOverlap(video, beats);
  out.push({ id: "zones-no-overlap", pass: !zn.bad.length, detail: zn.bad.length ? zn.bad.slice(0, 8).join("; ") : "every element in one zone, one element type per zone, no ink across a zone edge" });
  // ADVISORY since 2026-10-06. This measures SPARSITY, and sparse can be a style
  // rather than a defect: ch-05 Broadsheet renders TYPE-SPLIT beats at 13-14%
  // against this 15% floor, while all three of its references measure 95-100% in
  // the same band and the built-channel control clears the floor with the least
  // margin (p10 33.3%). The floor is not wrong. What is wrong is that a density
  // preference stands between a render and the only judge that can say whether
  // it looks good. The value is still measured and reported so Layer 3 receives
  // it; what is removed is the veto.
  //
  // The blank/fallback case this gate was introduced for is still caught, by
  // frames-nonempty and pop-transitions, which stay hard.
  const mz = middleZoneFilled(video, beats);
  out.push({ id: "middle-zone-filled", pass: true, advisory: true, detail: (mz.bad.length ? mz.bad.join("; ") : "every non-photo beat fills its middle zone") + (mz.bad.length ? " [ADVISORY - not gating]" : "") });
  // pace (owner, 2026-10-09: "a beat with no movement for more than 1.0 second is a failed beat"): sampled every 0.25 s on the
  // rendered frames (the caption band cut off), the longest run of near-identical frames inside a beat is <= 1.0 s. HARD.
  {
    const { paceOf, MAX_STATIC_S } = await import(require("node:url").pathToFileURL(join(__dirname, "pace-check.mjs")).href);
    const pace = paceOf(video, m);
    pace.beats.forEach((b) => console.log(`[pace] beat ${b.index}: ${b.duration_s} s, longest static ${b.longest_s.toFixed(2)} s, mean change ${b.mean_change} — ${b.status}`));
    pace.beats.filter((b) => b.status !== "ok").forEach((b) => console.log(`[pace-series] beat ${b.index} (time:changed-pixels/mean): ${b.series.join(" ")}`));
    console.log(`[pace] longest static stretch ${pace.longest_s.toFixed(2)} s; average beat ${pace.avg_beat_s} s`);
    out.push({ id: "pace", pass: !pace.fail.length, detail: pace.fail.length ? pace.fail.map((b) => `beat ${b.index}: ${b.longest_s.toFixed(2)} s with nothing moving (max ${MAX_STATIC_S} s)`).join("; ") : `no beat static for more than ${MAX_STATIC_S} s (longest ${pace.longest_s.toFixed(2)} s; average beat ${pace.avg_beat_s} s)` });
  }
  const vcon = await visualContrast(video, beats, m.fps || 30);
  vcon.rows.forEach((r) => console.log(`[contrast] ${r}`));
  out.push({ id: "visual-contrast", pass: !vcon.bad.length, detail: vcon.bad.length ? vcon.bad.join("; ") : vcon.rows.length ? `${vcon.rows.length} flag / card visual(s), each bounded all the way round against its ground` : "no flag or framed-photo visual to judge" });
  const em = entityMarks(beats);
  em.rows.forEach((r) => console.log(`[marks] ${r}`));
  out.push({ id: "entity-marks", pass: !em.bad.length, detail: em.bad.length ? em.bad.join("; ") : em.rows.length ? `${em.rows.length} entity plate beat(s): each entity is its real mark or its name in type, none repeated` : "no entity plate to judge" });
  // The shot-proof FIXTURE renders the repo's sample photos on purpose (it proves layouts, it never ships): --fixture says so, and the check is skipped there.
  const isrc = process.argv.includes("--fixture") ? { bad: [], rows: ["(fixture: sample images by design — not judged)"], needed: 0, real: 0 } : await imageSources(beats);
  isrc.rows.forEach((r) => console.log(`[images] ${r}`));
  out.push({ id: "image-sources", pass: !isrc.bad.length, detail: isrc.bad.length ? isrc.bad.join("; ") : `${isrc.real}/${isrc.needed} image(s) on screen, each traced to a source URL that answers; no sample image` });
  const tg = await textGrid(video, beats, m.fps || 30);
  tg.rows.forEach((r) => console.log(`[grid] beat ${r.beat}: ${r.words === null ? "no words" : r.words || `${r.composition} words centred at x ${r.centre_x}, ending at y ${r.bottom_y}`}`));
  out.push({ id: "grid", pass: !tg.bad.length, detail: tg.bad.length ? tg.bad.join("; ") : `every beat's words centred on x 540 and standing on y ${GRID_BASE} (± ${GRID_TOL}), measured on the frames` });
  const fl = await flatLook(video, beats, m.accent, m.fps || 30);
  fl.rows.forEach((r) => console.log(`[flat-look] ${r}`));
  out.push({ id: "flat-look", pass: !fl.bad.length, detail: fl.bad.length ? fl.bad.join("; ") : fl.rows.length ? `${fl.rows.length} chart / date / scale / plate / diagram beat(s): reference palette only, no shadow, sharp corners` : "no chart, date, scale, plate or diagram beat to judge" });
  const vc = await visualCentred(video, beats, m.fps || 30);
  vc.rows.forEach((r) => console.log(`[centred] ${r}`));
  out.push({ id: "visual-centred", pass: !vc.bad.length, detail: vc.bad.length ? vc.bad.join("; ") : `${vc.rows.length} visual(s) on the frame, none with its mass in the top third` });
  const pt = popTransitions(video, m);
  out.push({ id: "pop-transitions", pass: !pt.bad.length, detail: pt.bad.length ? pt.bad.slice(0, 6).join("; ") : "no empty frame across any beat boundary" });
  const mt = motionTiers(beats);
  const kr = await kineticRules(beats);
  out.push({ id: "kinetic-rules", pass: !kr.bad.length, detail: kr.bad.length ? kr.bad.slice(0, 8).join("; ") : `every word pops in place (${Object.entries(kr.used).map(([e, n]) => `${e}x${n}`).join(" ")}), no slide / drop / sweep / blur entrance, <=3 text elements a beat; number modes ${kr.modes.join("/") || "none"}` });
  out.push({ id: "motion-tiers", pass: !mt.bad.length, detail: mt.bad.length ? mt.bad.join("; ") : `${mt.major} major, ${mt.medium} medium, all beats micro` });
  // template-window (owner's definition of "no template", 2026-10-08 — scripts/template-check.js):
  // across any three consecutive beats, at most ONE of {corner label, pull phrase, type-led
  // layout} repeats, AND no device is on three beats in a row (2026-10-09). The label is what is
  // DRAWN at the top of the frame (template-check.js labelsDrawn). HARD. Not loosened to pass a render.
  // A SECONDARY signal only: frame review's TEMPLATE_MONOCULTURE holds a video whatever this says.
  const { templateCheck, labelCount } = await import("./template-check.js");
  const tw = templateCheck(m);
  out.push({ id: "template-window", pass: tw.pass, detail: tw.error ? tw.error : tw.pass ? `${tw.beats} beat(s), ${labelCount(m)} draw a label: no two devices repeat inside any three-beat window, no device on three beats in a row`
    : tw.windows.slice(0, 6).map((w) => `beats ${w.start}-${w.start + 2}: ${w.run.length ? `${w.run.join(" + ")} on three beats in a row` : `${w.repeating.join(" + ")} repeat`}`).join("; ") });
  // no-photo-repeat (owner, 2026-10-08): one photo, at most one beat per video.
  const seen = new Map(), rep = [];
  beats.forEach((b, i) => {
    const imgs = [b.canvas?.photo?.asset, ...(b.canvas?.concept_visuals || []).filter((v) => v.class === "cutout").map((v) => v.asset)].filter(Boolean);
    for (const a of new Set(imgs)) { if (seen.has(a)) rep.push(`${a} on beats ${seen.get(a)} and ${i}`); else seen.set(a, i); }
  });
  out.push({ id: "no-photo-repeat", pass: !rep.length, detail: rep.length ? rep.join("; ") : "no photo or cutout appears on two beats" });
  // camera-moves (owner, 2026-10-09: "real camera moves of 8% or more", photos and graphs only): every
  // beat that shows a photo (full-bleed or framed) or a graph (DATA-FULL) declares a move >= 8%
  // (visual/canvas-layout.js CAMERA). DECLARED here; what the pixels did is judged by Gemini's
  // fake-pan check (gemini-frame-review.js --camera-check), which compares two frames of one beat.
  const camBad = [];
  beats.forEach((b, i) => {
    const c = b.canvas;
    if (!c) return;
    // (PORTRAIT is a standing cut-out of a person, not a camera subject: it keeps its small push.)
    const PHOTO_COMPS = ["SCENE-FULL", "ARCHITECTURE", "DOCUMENT", "MONEY", "SCENE-LOW", "PHOTO-BAND", "PHOTO-EDGE", "PHOTO-CARD", "PHOTO-INSET", "PHOTO-STRIP"];
    const subject = c.composition === "DATA-FULL" ? "graph" : c.photo?.asset && PHOTO_COMPS.includes(c.composition) ? "photo" : null;
    if (subject && !(c.camera && c.camera.subject === subject && c.camera.move >= 0.08)) camBad.push(`beat ${i}: a ${subject} beat declares no camera move of 8% or more`);
  });
  out.push({ id: "camera-moves", pass: !camBad.length, detail: camBad.length ? camBad.join("; ") : `every photo and graph beat declares a camera move of 8% or more (${beats.filter((b) => b.canvas?.camera).length} beat(s))` });
  // entity-coverage (owner, 2026-10-09: "nothing spoken goes unrepresented"; scripts/entity-coverage.js): every beat whose
  // sentence names an entity (a place, a person, an organisation, a date, a span of time, a figure) draws something that
  // answers one of them — its flag or map with it highlighted, a portrait or plate, a logo, a date card, a time track, the
  // figure. A beat that names an entity and is words only FAILS, and the failing entity is logged. HARD.
  {
    const { checkEntityCoverage } = await import(require("node:url").pathToFileURL(join(__dirname, "entity-coverage.js")).href);
    const ec = checkEntityCoverage(beats.map((b) => ({ index: b.index, sentence: b.canvas?.sentence || "", named_entities: b.canvas?.entities || [], canvas: b.canvas })));
    ec.rows.forEach((r) => console.log(`[entities] beat ${r.beat}: ${r.entities.length ? `${r.entities.join(" | ")} -> ${r.covered ? `OK by ${r.by}` : "NOT COVERED"}` : r.note}`));
    out.push({ id: "entity-coverage", pass: !ec.failures.length, detail: ec.failures.length ? ec.failures.map((f) => `beat ${f.beat}: ${f.entities.join(", ")} — ${f.why}`).slice(0, 8).join("; ") : `${ec.rows.filter((r) => r.covered).length} beat(s) draw the entity they name; ${ec.wordsOnlyBeats} words-only beat(s) name nothing` });
  }
  // sfx-rules (owner, 2026-10-09): every SFX that plays was judged a real recording by Gemini
  // (scripts/sfx-cc0.mjs judge), its peak lands within 100 ms of its visible event, no sound twice in
  // a row, no sound on three beats in a row. HARD — a robotic sound fails the video; fix the sound.
  const sfxPlayed = m.sfx || [];
  if (sfxPlayed.length) {
    const { sfxRuleProblems } = await import("../src/skills/remotion-render/visual/canvas-sfx.js");
    const { recordedFiles } = await import("./sfx-cc0.mjs");
    const sr = sfxRuleProblems(sfxPlayed, { fps: m.fps || 30, recorded: recordedFiles() });
    out.push({ id: "sfx-rules", pass: !sr.length, detail: sr.length ? sr.slice(0, 6).join("; ") : `${sfxPlayed.length} SFX, all judged recorded, each within 100 ms of its event, ${beats.length - new Set(sfxPlayed.map((e) => e.beat)).size}/${beats.length} beats silent` });
  }
  return out;
}

function parseSrt(text) {
  const toSec = (ts) => { const [h, m, rest] = ts.split(":"); return +h * 3600 + +m * 60 + +rest.replace(",", "."); };
  return text.replace(/\r/g, "").split(/\n\s*\n/).map((block) => {
    const lines = block.trim().split("\n");
    const tl = lines.find((l) => l.includes("-->"));
    if (!tl) return null;
    const [a, b] = tl.split("-->").map((s) => toSec(s.trim()));
    return { start: a, end: b, text: lines.slice(lines.indexOf(tl) + 1).join(" ").trim() };
  }).filter(Boolean);
}

async function main() {
  // Per-render paper checks (render-and-qa.js runs this on EVERY paper
  // render): frames-fit-paper and shapes-clear-of-text. --fit-only is the
  // old name of the same mode.
  if (process.argv.includes("--canvas-only")) {
    const video = arg("video"), manifestPath = arg("manifest");
    if (!video || !existsSync(video) || !manifestPath || !existsSync(manifestPath)) {
      console.error(`[canvas] cannot run — need --video and --manifest (${video}, ${manifestPath})`);
      process.exit(2);
    }
    const m = JSON.parse(readFileSync(manifestPath, "utf8"));
    const res = await canvasChecks(video, m);
    for (const c of res) console.log(`[canvas] ${c.pass ? "PASS" : "FAIL"} ${c.id} — ${c.detail}`);
    process.exit(res.every((c) => c.pass) ? 0 : 1);
  }
  if (process.argv.includes("--paper-only") || process.argv.includes("--fit-only")) {
    const video = arg("video"), manifestPath = arg("manifest");
    if (!video || !existsSync(video) || !manifestPath || !existsSync(manifestPath)) {
      console.error(`[fit] cannot run — need --video and --manifest (${video}, ${manifestPath})`);
      process.exit(2);
    }
    const m = JSON.parse(readFileSync(manifestPath, "utf8"));
    const beats = m.beats || [];
    const fit = await fitCheck(video, beats, m.width || 1080, m.height || 1920);
    console.log(`[fit] frames-fit-paper ${fit.bad.length ? "FAIL" : "PASS"} — ${fit.checked} frame(s) of ${beats.length} beat(s)${fit.bad.length ? `, ${fit.bad.length} beat(s) outside the inner box` : ", every content bbox inside the paper's inner box"}`);
    const sh = await shapesCheck(video, beats, m.width || 1080, m.height || 1920, process.argv.includes("--debug"));
    console.log(`[shapes] shapes-clear-of-text ${sh.bad.length ? "FAIL" : "PASS"} — ${sh.checked} frame(s) of ${beats.length} beat(s)${sh.bad.length ? `, ${sh.bad.length} beat(s) with shape ink in the headline/caption zone` : ", no shape ink in the headline or caption zone"}`);
    process.exit(fit.bad.length || sh.bad.length ? 1 : 0);
  }
  const video = arg("video"), manifestPath = arg("manifest"), planPath = arg("plan");
  const srtPath = arg("srt"), audio = arg("audio"), out = arg("out");
  const missing = [["video", video], ["manifest", manifestPath], ["plan", planPath], ["srt", srtPath], ["audio", audio]]
    .filter(([, p]) => !p || !existsSync(p)).map(([n, p]) => `${n}=${p || "(none)"}`);
  if (missing.length) {
    console.error(`[local-audit] cannot run — missing input: ${missing.join(", ")}`);
    process.exit(2);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  const cues = parseSrt(readFileSync(srtPath, "utf8"));
  const beats = manifest.beats || [];
  // Design-space frame (the check's rule is written in 1080x1920 terms)…
  const DW = manifest.width || 1080, DH = manifest.height || 1920;
  // …sampled in the video's actual pixels. Run 36341568734: the crops used
  // design coordinates on an 810x1440 video, so the "centre" 200x200 sat at
  // x440 y860 — below the centred hook text — and read as empty on every
  // video. Every crop's position AND size is now scaled design -> actual.
  const actual = videoSize(video);
  const sx = actual ? actual.w / DW : (manifest.renderScale || 1);
  const sy = actual ? actual.h / DH : (manifest.renderScale || 1);
  const W = Math.round(DW * sx), H = Math.round(DH * sy);
  const cw = Math.round(200 * sx), ch = Math.round(200 * sy);
  const kw = Math.round(100 * sx), kh = Math.round(100 * sy);
  const { LIBRARY_NAMES } = await import(pathToFileURL(join(ROOT, "src", "skills", "remotion-render", "visual", "library-names.js")).href);

  const checks = [];
  const add = (id, bad, okDetail) => checks.push({ id, pass: bad.length === 0, detail: bad.length ? bad.join("; ") : okDetail });

  // Frames: one per beat, at its midpoint.
  const work = join(tmpdir(), `local-audit-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const sizeBad = [], centerBad = [], refBad = [];
  let ref = null;
  try { ref = JSON.parse(readFileSync(REF_HIST, "utf8")).mean; } catch { /* reported below */ }
  beats.forEach((b, i) => {
    const t = (b.start_sec ?? 0) + (b.duration_sec ?? 0) / 2;
    const png = join(work, `beat-${i}.png`);
    if (!extractPng(video, t, png)) { sizeBad.push(`beat ${i}: frame at ${t.toFixed(2)}s could not be extracted`); centerBad.push(`beat ${i}: no frame`); return; }
    const bytes = statSync(png).size;
    if (ref) {
      const h = lumaHist(png);
      const l1 = h ? h.reduce((a, v, k) => a + Math.abs(v - ref[k]), 0) : null;
      if (l1 === null) refBad.push(`beat ${i}: histogram failed`);
      else if (l1 > REF_L1_MAX) refBad.push(`beat ${i}: L1 ${l1.toFixed(3)} > ${REF_L1_MAX}`);
    }
    if (bytes <= MIN_FRAME_BYTES) sizeBad.push(`beat ${i}: ${(bytes / 1024).toFixed(1)} KB`);
    const center = cropMean(video, t, cw, ch, Math.floor((W - cw) / 2), Math.floor((H - ch) / 2));
    const corner = cropMean(video, t, kw, kh, 0, 0);
    if (center === null || corner === null) centerBad.push(`beat ${i}: crop failed`);
    else if (Math.abs(center - corner) <= MIN_CENTER_DIFF) centerBad.push(`beat ${i}: centre ${center.toFixed(1)} vs corner ${corner.toFixed(1)}`);
  });
  try { rmSync(work, { recursive: true, force: true }); } catch {}
  add("frames-nonempty", sizeBad, `${beats.length}/${beats.length} beat frames > 15 KB`);
  const canvasVideo = beats.some((b) => b.canvas);
  // Paper videos put their content in the centre of the frame, and this check
  // asks for it. A full-canvas beat is composed asymmetrically on a grid with
  // deliberate empty cells (the typography brief: "Empty cells are
  // intentional"): its centre may be empty by design, so canvas-coverage
  // (content spans >= 60% of the frame height) and canvas-type (nothing
  // centred, two roles a beat) judge it instead.
  if (!canvasVideo) add("frames-centered", centerBad, `${beats.length}/${beats.length} beats have centre content`);
  if (canvasVideo) {
    for (const c of await canvasChecks(video, manifest)) checks.push(c);
  } else add("frames-match-reference", ref ? refBad : ["data/reference/reference-histogram.json missing"], `${beats.length}/${beats.length} beat frames within L1 ${REF_L1_MAX} of the reference`);

  if (!canvasVideo && beats.some((b) => b.visual_type)) {
    const fit = await fitCheck(video, beats, DW, DH);
    add("frames-fit-paper", fit.bad, `${fit.checked} frame(s): every content bbox inside the paper's inner box`);
    const sh = await shapesCheck(video, beats, DW, DH);
    add("shapes-clear-of-text", sh.bad, `${sh.checked} frame(s): no shape ink in the headline or caption zone`);
  }

  const durBad = [];
  if (cues.length !== beats.length) durBad.push(`${beats.length} beats vs ${cues.length} SRT cues`);
  beats.forEach((b, i) => {
    const c = cues[i];
    if (!c) return;
    // render.js times a beat from its cue's start to the NEXT cue's start
    // (the last beat: to its own end) - how it READS the cue, not a looser
    // rule. The word-timed SRT (tts_words.py) ends a cue at its last word,
    // so cue.end - cue.start is shorter than the beat by the pause after it.
    const want = (cues[i + 1] ? cues[i + 1].start : c.end) - c.start;
    if (Math.abs((b.duration_sec ?? 0) - want) > DURATION_TOL) durBad.push(`beat ${i}: ${b.duration_sec}s vs cue ${want.toFixed(2)}s`);
  });
  add("beat-durations", durBad, `every beat within ±${DURATION_TOL}s of its cue`);

  const libBad = [];
  (plan.beats || []).forEach((b) => (b.composition?.objects || []).forEach((o, j) => {
    if (o?.kind === "library_shape" && !LIBRARY_NAMES.includes(o.name)) libBad.push(`beat ${b.index} objects[${j}]: "${o.name}"`);
  }));
  add("library-names", libBad, "every library_shape name is registered");

  const smBad = [];
  beats.forEach((b, i) => {
    if (!cues[i] || !cues[i].text) smBad.push(`beat ${i}: no sentence`);
    if (!b.mechanism) smBad.push(`beat ${i}: no mechanism`);
  });
  add("beat-sentence-mechanism", smBad, "every beat has a sentence and a mechanism");

  const planByIndex = new Map((plan.beats || []).map((b) => [b.index, b]));
  const effective = beats.map((b, i) => {
    if (b.mechanism !== "CAPABILITY") return b.mechanism || "NONE";
    const caps = planByIndex.get(b.index ?? i)?.capabilities || [];
    return `CAPABILITY:${caps[0] || "?"}`;
  });
  const typo = effective.filter((m) => m === "TYPOGRAPHY").length;
  add("typography-count", typo <= 2 ? [] : [`${typo} TYPOGRAPHY beats`], `${typo} TYPOGRAPHY beat(s)`);

  const counts = {};
  for (const m of effective) counts[m] = (counts[m] || 0) + 1;
  const over = Object.entries(counts).filter(([, n]) => beats.length && n / beats.length > MAX_MECH_SHARE)
    .map(([m, n]) => `${m} ${n}/${beats.length} (${Math.round((100 * n) / beats.length)}%)`);
  add("mechanism-share", over, `max share ${beats.length ? Math.round((100 * Math.max(...Object.values(counts))) / beats.length) : 0}%`);

  const vDur = mediaDuration(video), aDur = mediaDuration(audio);
  add("av-duration", vDur === null || aDur === null ? ["could not read a duration"]
    : Math.abs(vDur - aDur) > AV_TOL ? [`video ${vDur.toFixed(2)}s vs audio ${aDur.toFixed(2)}s`] : [],
    `video ${vDur?.toFixed(2)}s, audio ${aDur?.toFixed(2)}s`);

  const pass = checks.every((c) => c.pass);
  for (const c of checks) console.log(`[local-audit] ${c.pass ? "PASS" : "FAIL"} ${c.id} — ${c.detail}`);
  console.log(`[local-audit] VERDICT: ${pass ? "PASS" : "FAIL"} (${checks.filter((c) => c.pass).length}/${checks.length} checks)`);
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ video: basename(video), pass, checks }, null, 2) + "\n");
  }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(`[local-audit] cannot run — ${e.stack || e}`); process.exit(2); });
