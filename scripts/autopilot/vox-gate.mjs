/**
 * VOX inspection of the final MP4. Every measurement is taken from decoded frames of the MP4,
 * compared with the untreated source image where a comparison is meaningful.
 *
 * Stability is not inferred from a low motion score. Four corner blocks of each photo are
 * block-matched across a frame sequence: a zoom moves those corners in opposing directions and a
 * pan moves them together, so all four must sit at zero offset.
 *
 * Where a measurement stops: halftone, grain and grade are statistical evidence that the
 * treatment reached the pixels. They do not judge taste; the frame review does that.
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { ROOT, must, readJson, sha256File, writeJson } from "./lib.mjs";

const require = createRequire(join(ROOT, "package.json"));
const sharp = require("sharp");
const FPS = 30;

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function frameAt(mp4, frame, out) {
  must("vox-gate", "ffmpeg", ["-y", "-v", "error", "-ss", (frame / FPS).toFixed(4), "-i", mp4, "-frames:v", "1", out]);
  return out;
}

async function luma(file, rect) {
  let img = sharp(file);
  if (rect) img = img.extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h });
  const { data, info } = await img.greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Best integer offset of a block between two frames, by mean absolute difference. */
function blockShift(a, b, x, y, size, range) {
  let best = { dx: 0, dy: 0, sad: Infinity }, zero = 0;
  for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) {
    let sad = 0;
    for (let j = 0; j < size; j += 2) for (let i = 0; i < size; i += 2) {
      sad += Math.abs(a.data[(y + j) * a.w + x + i] - b.data[(y + j + dy) * b.w + x + i + dx]);
    }
    if (dx === 0 && dy === 0) zero = sad;
    if (sad < best.sad - 1e-6) best = { dx, dy, sad };
  }
  // A featureless block matches everywhere; only a clearly better offset counts as movement.
  if (zero <= best.sad * 1.05) return { dx: 0, dy: 0 };
  return best;
}

async function stability(mp4, photo, annotationBox, tmp) {
  const rect = photo.rect, margin = 12;
  const inner = { x: rect.x + margin, y: rect.y + margin, w: rect.w - 2 * margin, h: rect.h - 2 * margin };
  const first = photo.in_f + 8, last = photo.out_f - 3;
  const frames = [];
  for (let f = first; f <= last; f += 6) frames.push(f);
  if (frames.at(-1) !== last) frames.push(last);
  const size = Math.min(100, Math.floor(Math.min(inner.w, inner.h) / 4)), range = 14;
  const xs = [range, (inner.w - size) >> 1, inner.w - size - range], ys = [range, (inner.h - size) >> 1, inner.h - size - range];
  const blocks = xs.flatMap((x) => ys.map((y) => [x, y])).filter(([x, y]) => !(x === xs[1] && y === ys[1]))
    .filter(([x, y]) => !annotationBox || !(rect.x + margin + x < annotationBox.x1 && rect.x + margin + x + size > annotationBox.x0 && rect.y + margin + y < annotationBox.y1 && rect.y + margin + y + size > annotationBox.y0));
  const base = await luma(frameAt(mp4, first, join(tmp, "stab-base.png")), inner);
  const moves = [];
  for (const f of frames.slice(1)) {
    const cur = await luma(frameAt(mp4, f, join(tmp, `stab-${f}.png`)), inner);
    const offsets = blocks.map(([x, y]) => blockShift(base, cur, x, y, size, range));
    moves.push({ frame: f, offsets });
  }
  const moved = moves.filter((m) => m.offsets.some((o) => o.dx !== 0 || o.dy !== 0));
  return { pass: blocks.length >= 2 && !moved.length, frames_compared: frames.length, blocks_used: blocks.length, moved_frames: moved.slice(0, 5) };
}

/**
 * The grade changes brightness by tone, so comparing corners with the centre directly mixes the two.
 * The tone curve is learned from the middle of the photo, then used to predict the corners; a real
 * vignette leaves the corners darker than that prediction.
 */
function vignetteVsToneCurve(treated, source) {
  const W = treated.w, H = treated.h, bins = Array.from({ length: 32 }, () => ({ n: 0, sum: 0 }));
  for (let y = Math.floor(H * 0.3); y < H * 0.7; y += 3) for (let x = Math.floor(W * 0.3); x < W * 0.7; x += 3) {
    const b = bins[source.data[y * W + x] >> 3];
    b.n++; b.sum += treated.data[y * W + x];
  }
  const cw = Math.floor(W / 6), ch = Math.floor(H / 6);
  let actual = 0, expected = 0, covered = 0, total = 0;
  for (const [x0, y0] of [[0, 0], [W - cw, 0], [0, H - ch], [W - cw, H - ch]]) {
    for (let y = y0; y < y0 + ch; y += 3) for (let x = x0; x < x0 + cw; x += 3) {
      total++;
      const b = bins[source.data[y * W + x] >> 3];
      if (b.n < 30) continue;
      covered++; expected += b.sum / b.n; actual += treated.data[y * W + x];
    }
  }
  const coverage = total ? covered / total : 0;
  return { ratio: expected ? Math.round((actual / expected) * 1000) / 1000 : null, coverage: Math.round(coverage * 100) / 100, measurable: coverage >= 0.5 && expected > 0 };
}

/** Power spectrum of a 256x256 luma block (radix-2). */
function spectrum(l) {
  const N = 256, re = new Float64Array(N * N), im = new Float64Array(N * N);
  const ox = Math.max(0, (l.w - N) >> 1), oy = Math.max(0, (l.h - N) >> 1);
  let mean = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { re[y * N + x] = l.data[(oy + y) * l.w + ox + x]; mean += re[y * N + x]; }
  mean /= N * N;
  for (let i = 0; i < re.length; i++) re[i] -= mean;
  const fft = (r, m) => {
    for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [r[i], r[j]] = [r[j], r[i]]; [m[i], m[j]] = [m[j], m[i]]; } }
    for (let len = 2; len <= N; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(ang * k), s = Math.sin(ang * k), a = i + k, b = a + len / 2;
        const tr = r[b] * c - m[b] * s, ti = r[b] * s + m[b] * c;
        r[b] = r[a] - tr; m[b] = m[a] - ti; r[a] += tr; m[a] += ti;
      }
    }
  };
  for (let y = 0; y < N; y++) { const r = re.subarray(y * N, (y + 1) * N), m = im.subarray(y * N, (y + 1) * N); fft(r, m); }
  const cr = new Float64Array(N), ci = new Float64Array(N);
  for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) { cr[y] = re[y * N + x]; ci[y] = im[y * N + x]; } fft(cr, ci); for (let y = 0; y < N; y++) { re[y * N + x] = cr[y]; im[y * N + x] = ci[y]; } }
  return { re, im, N };
}

/** A printed dot screen is a sharp isolated peak at high frequency; grain and photo detail are not. */
function halftonePeak(l) {
  const { re, im, N } = spectrum(l);
  const power = [];
  let peak = 0, at = null;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fy = y < N / 2 ? y : y - N, fx = x < N / 2 ? x : x - N, r = Math.hypot(fx, fy);
    if (r < N * 0.18) continue;
    const p = re[y * N + x] ** 2 + im[y * N + x] ** 2;
    power.push(p);
    if (p > peak) { peak = p; at = { fx, fy, period_px: Math.round((N / r) * 100) / 100 }; }
  }
  power.sort((a, b) => a - b);
  const median = power[power.length >> 1] || 1;
  return { peak_over_median: Math.round(peak / median), at, peak, median };
}

/** Peak power within one bin of a frequency, so a source can be compared at the treatment's own dot frequency. */
function powerAt(l, at) {
  const { re, im, N } = spectrum(l);
  let best = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = (at.fx + dx + N) % N, y = (at.fy + dy + N) % N;
    best = Math.max(best, re[y * N + x] ** 2 + im[y * N + x] ** 2);
  }
  return best;
}

async function colourStats(file, rect) {
  let img = sharp(file);
  if (rect) img = img.extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h });
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sat = 0, n = 0;
  const lumAt = (x, y) => { const i = (y * info.width + x) * info.channels; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
  for (let i = 0; i < data.length; i += info.channels * 3) { const mx = Math.max(data[i], data[i + 1], data[i + 2]), mn = Math.min(data[i], data[i + 1], data[i + 2]); sat += mx ? (mx - mn) / mx : 0; n++; }
  const region = (x0, y0, w, h) => { let s = 0, c = 0; for (let y = y0; y < y0 + h; y += 3) for (let x = x0; x < x0 + w; x += 3) { s += lumAt(x, y); c++; } return s / c; };
  const W = info.width, H = info.height, cw = Math.floor(W / 7), ch = Math.floor(H / 7);
  const corners = (region(4, 4, cw, ch) + region(W - cw - 4, 4, cw, ch) + region(4, H - ch - 4, cw, ch) + region(W - cw - 4, H - ch - 4, cw, ch)) / 4;
  const center = region((W - cw * 2) >> 1, (H - ch * 2) >> 1, cw * 2, ch * 2);
  // Fine detail energy: the difference from a local average, which grain and halftone both raise.
  let hf = 0, hc = 0;
  for (let y = 2; y < H - 2; y += 5) for (let x = 2; x < W - 2; x += 5) { hf += Math.abs(lumAt(x, y) - (lumAt(x - 2, y) + lumAt(x + 2, y) + lumAt(x, y - 2) + lumAt(x, y + 2)) / 4); hc++; }
  return { saturation: Math.round((sat / n) * 1000) / 1000, corners, center, fine_detail: Math.round((hf / hc) * 100) / 100 };
}

async function accentPixels(file, box, rgb) {
  const left = Math.max(0, box.x0), top = Math.max(0, box.y0), width = Math.min(1080 - left, box.x1 - box.x0), height = Math.min(1920 - top, box.y1 - box.y0);
  const { data, info } = await sharp(file).extract({ left, top, width, height }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let hits = 0;
  for (let i = 0; i < data.length; i += info.channels) if (Math.abs(data[i] - rgb[0]) + Math.abs(data[i + 1] - rgb[1]) + Math.abs(data[i + 2] - rgb[2]) < 75) hits++;
  return hits;
}

export async function voxGate({ mp4, dir, outDir, productionId }) {
  const plan = readJson(join(dir, "vox-plan.json"));
  const tmp = join(dir, "vox-gate"); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  const accent = hexRgb(plan.accent);
  const scenes = [], failures = [];
  const fail = (scene, check, why) => failures.push({ scene, check, why });

  for (const s of plan.scenes) {
    const r = { scene: s.scene, start_s: s.start_s, end_s: s.end_s, treatments: s.treatments, exceptions: s.exceptions, measured: {} };
    const midFrame = Math.round(((s.photo?.in_f ?? s.start_s * FPS) + (s.photo?.out_f ?? s.end_s * FPS)) / 2);
    r.frame_file = frameAt(mp4, midFrame, join(outDir, `scene-${String(s.scene).padStart(2, "0")}.png`));
    const annotation = s.treatments.find((t) => t.type === "annotation");
    if (s.photo) {
      const box = annotation ? { x0: annotation.screen.cx - annotation.screen.rx - 14, x1: annotation.screen.cx + annotation.screen.rx + 14, y0: annotation.screen.cy - annotation.screen.ry - 14, y1: annotation.screen.cy + annotation.screen.ry + 14 } : null;
      r.measured.stability = await stability(mp4, s.photo, box, tmp);
      if (!r.measured.stability.pass) fail(s.scene, "photo-stability", `photo moved or could not be measured: ${JSON.stringify(r.measured.stability.moved_frames).slice(0, 200)}`);

      const rect = s.photo.rect;
      // Measured away from any annotation stroke, on the frame just before the annotation draws.
      const cleanFrame = annotation ? Math.max(s.photo.in_f + 8, annotation.draw_start_f - 1) : midFrame;
      const fileClean = frameAt(mp4, cleanFrame, join(tmp, `clean-${s.scene}.png`));
      const treated = await colourStats(fileClean, rect);
      const srcResized = join(tmp, `src-${s.scene}.png`);
      must("vox-gate", "ffmpeg", ["-y", "-v", "error", "-i", join(ROOT, s.photo.source_file), "-vf", `scale=${rect.w}:${rect.h}`, srcResized]);
      const source = await colourStats(srcResized, null);
      const treatedLuma = await luma(fileClean, rect);
      const sourceLuma = await luma(srcResized);
      const htTreated = halftonePeak(treatedLuma), htSource = halftonePeak(sourceLuma);
      const vignette = vignetteVsToneCurve(treatedLuma, sourceLuma);
      r.measured.vignette = vignette;
      r.measured.grade = { treated: treated.saturation, source: source.saturation };
      r.measured.halftone = { treated: htTreated, source: htSource };
      r.measured.grain = { treated: treated.fine_detail, source: source.fine_detail };
      if (source.saturation > 0.12 && treated.saturation > source.saturation * 0.92) fail(s.scene, "grade", `saturation ${treated.saturation} not reduced from ${source.saturation}`);
      if (vignette.measurable && vignette.ratio > 0.96) fail(s.scene, "vignette", `corners are ${vignette.ratio} of the brightness the tone curve predicts`);
      // Old prints carry their own dot pattern elsewhere in the spectrum, so the source is read at the treatment's frequency.
      const sourceAtDots = htTreated.at ? powerAt(sourceLuma, htTreated.at) : Infinity;
      r.measured.halftone.treated_over_source_at_dot_frequency = Math.round((htTreated.peak / Math.max(1, sourceAtDots)) * 10) / 10;
      if (htTreated.peak_over_median < 40 || htTreated.peak < sourceAtDots * 3) fail(s.scene, "halftone", `dot screen ${htTreated.peak_over_median}x median, ${r.measured.halftone.treated_over_source_at_dot_frequency}x the source at that frequency`);
      // Grain cannot be separated from content on a source already full of fine detail, such as an engraving.
      r.measured.grain.measurable = source.fine_detail < 15;
      if (source.fine_detail < 15 && treated.fine_detail < source.fine_detail * 1.05) fail(s.scene, "grain", `fine detail ${treated.fine_detail} vs source ${source.fine_detail}`);
      if (annotation) {
        const zone = { x0: annotation.screen.cx - annotation.screen.rx - 24, x1: annotation.screen.cx + annotation.screen.rx + 24, y0: annotation.screen.cy - annotation.screen.ry - 24, y1: annotation.screen.cy + annotation.screen.ry + 24 };
        const zoneI = Object.fromEntries(Object.entries(zone).map(([k, v]) => [k, Math.max(0, Math.round(v))]));
        const before = await accentPixels(fileClean, zoneI, accent);
        const mid = await accentPixels(frameAt(mp4, Math.round((annotation.draw_start_f + annotation.draw_end_f) / 2), join(tmp, `ann-mid-${s.scene}.png`)), zoneI, accent);
        const after = await accentPixels(frameAt(mp4, Math.min(annotation.draw_end_f + 3, s.photo.out_f - 1), join(tmp, `ann-end-${s.scene}.png`)), zoneI, accent);
        r.measured.annotation = { accent_pixels_before: before, mid_draw: mid, after: after };
        if (!(after > before + 400 && after > mid && mid > before)) fail(s.scene, "annotation-draw-on", `stroke did not draw on in accent colour: ${before}/${mid}/${after}`);
      }
    }
    const route = s.treatments.find((t) => t.type === "map_route");
    if (route) {
      const zone = { x0: 60, x1: 1020, y0: 300, y1: 1420 };
      const a = await accentPixels(frameAt(mp4, route.in_f + 2, join(tmp, `map0-${s.scene}.png`)), zone, accent);
      const b = await accentPixels(frameAt(mp4, route.end_f, join(tmp, `map1-${s.scene}.png`)), zone, accent);
      r.measured.map_route = { accent_pixels_start: a, end: b };
      if (b < a + 500) fail(s.scene, "map-route-draw-on", `route did not draw on: ${a} -> ${b}`);
      r.map_frame = frameAt(mp4, route.end_f, join(outDir, `map-${s.scene}.png`));
    }
    const chapter = s.treatments.find((t) => t.type === "chapter_opener");
    if (chapter) {
      const f0 = join(tmp, `ch0-${s.scene}.png`), f1 = join(tmp, `ch1-${s.scene}.png`);
      frameAt(mp4, chapter.in_f + 2, f0); frameAt(mp4, chapter.in_f + 22, f1);
      const a = await luma(f0, { x: 60, y: 620, w: 960, h: 400 }), b = await luma(f1, { x: 60, y: 620, w: 960, h: 400 });
      let d = 0; for (let i = 0; i < a.data.length; i++) d += Math.abs(a.data[i] - b.data[i]);
      r.measured.chapter_motion = Math.round((d / a.data.length) * 100) / 100;
      if (r.measured.chapter_motion < 1) fail(s.scene, "chapter-opener", `no typography movement measured (${r.measured.chapter_motion})`);
      r.chapter_frame = frameAt(mp4, chapter.in_f + 24, join(outDir, `chapter-${chapter.number}.png`));
    }
    scenes.push(r);
  }
  const need = (type, n, name) => { const c = scenes.flatMap((s) => s.treatments).filter((t) => t.type === type).length; if (c < n) fail(null, name, `found ${c}, need ${n}`); return c; };
  const counts = { photos: need("photo_treatment", 2, "photo-count"), annotations: need("annotation", 1, "annotation-count"), chapter_openers: need("chapter_opener", 1, "chapter-count") };

  const report = { production_id: productionId, mp4: mp4.slice(ROOT.length + 1).replace(/\\/g, "/"), mp4_sha256: sha256File(mp4), pass: failures.length === 0, accent: plan.accent, recipe_source: plan.recipe_source, counts, scenes, failures, generated_at: new Date().toISOString() };
  writeJson(join(outDir, "vox-compliance-report.json"), report);
  return report;
}

export const reportExists = (p) => existsSync(p);
