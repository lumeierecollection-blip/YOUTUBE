#!/usr/bin/env node
/**
 * check-multi-png-render.mjs — judges one multi-PNG render (qa-canvas-render.mjs output) on its pixels and plan.
 *
 *   node scripts/check-multi-png-render.mjs --dir out/run1 --meta out/multi-meta.json
 *        --moments 0.05,0.5,0.85,0.95 [--compare out/run2] [--plain out/run3] [--video]
 *
 * Fails (exit 1) unless:
 *   sequence   beat ids and frame starts are contiguous; exactly one still per beat and moment.
 *   assets     every fixture PNG exists and is drawn (>= 6 distinct); each beat's own picture shows up in its stills
 *              (its signature colour is present), so a missing or unresolvable asset cannot pass.
 *   frames     no still is black; none is blank after the first moment.
 *   alpha      on the two cutout (alpha) images the colour hidden under alpha 0 never shows (alpha dropped, or a bleed
 *              halo at the edge) and the half-transparent ring composites to a blend with the ground.
 *   overlays   (needs the manifest written by --video) every beat's headline is in a drawn box inside the frame; the
 *              "Source: ..." line is absent before its fade-in and present after it; with --plain (the same beats
 *              rendered without headline or credit) the headline box gains edge density from the text.
 *   determinism --compare: the second render's stills are pixel-identical, plan.json is equal, and (both with a video)
 *              the decoded video frames agree within tolerance. Byte-identical mp4 is reported, never required: see below.
 *   video      (--video) sampled at 10 fps: no black frame, no long blank run, no one-sample luminance spike, expected duration.
 *
 * Word-by-word captions: not drawn by design (removed from every beat, owner 2026-10-08; CanvasCaption is defined but
 * unused), so there is nothing to test in pixels; scripts/__tests__/render-checks.test.js fails if one is reinstated.
 *
 * Why the mp4 is not compared byte for byte: the render encodes with x264 in chunks (concurrency 2) that are joined, the
 * encoder is multi-threaded, and the container carries timestamps; none of that is controlled by the input. Identical
 * pictures can therefore still give different bytes. The criterion is the decoded frames (mean difference and share of
 * changed pixels per frame). Whether the two files happen to be byte-identical is recorded as a note.
 *
 * Every threshold is in lib/render-checks.mjs THRESHOLDS with its reason and a status; "untuned" means not yet measured
 * on a GitHub render. The report lists each measured value beside its limit. Writes <dir>/multi-png-report.json.
 * No secrets are read.
 */
import sharp from "sharp";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  sequenceProblems, stillProblems, stillName, assetCollisions, classifyFrame, frameRunProblems, flickerProblems, signatureShare,
} from "./lib/render-sequence.mjs";
import {
  THRESHOLDS as T, boxToRect, creditRect, drawnTextProblems, edgeDensity, colourCount, colourShare, blend, parseHex,
  alphaProblems, creditProblems, textGainProblems, creditMoments, frameDiffs, videoDeterminismProblems,
} from "./lib/render-checks.mjs";

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const dir = arg("dir");
const metaPath = arg("meta");
const compare = arg("compare");
const plainDir = arg("plain");
const withVideo = process.argv.includes("--video");
const moments = (arg("moments", "0.05,0.5,0.85,0.95")).split(",").map(Number);
if (!dir || !metaPath) { console.error("usage: check-multi-png-render.mjs --dir <render dir> --meta <fixture meta.json> [--moments a,b] [--compare <dir2>] [--plain <dir3>] [--video]"); process.exit(2); }

const plan = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8"));
const meta = JSON.parse(readFileSync(metaPath, "utf8"));
const PUBLIC = join(import.meta.dirname, "..", "src", "skills", "remotion-render", "public");
const problems = [];
const notes = [];
const skipped = [];
const measured = { alpha: [], credit: [], text: [], video: null };
const fail = (area, msg) => problems.push(`${area}: ${msg}`);

for (const p of sequenceProblems(plan.beats)) fail("sequence", p);
if (plan.beats.length !== meta.beats.length) fail("sequence", `plan has ${plan.beats.length} beats, fixture has ${meta.beats.length}`);
for (const p of stillProblems(readdirSync(dir), plan.beats.length, moments)) fail("stills", p);
if (plainDir) for (const p of stillProblems(readdirSync(plainDir), plan.beats.length, moments)) fail("stills", `plain render: ${p}`);

const { collisions, consecutive } = assetCollisions(plan.beats);
for (const c of collisions) fail("assets", `paths collide once case/Unicode form is folded: ${c.join(" | ")}`);
const wantReuse = meta.beats.filter((b) => b.fixture.reuse).length;
if (consecutive.length !== wantReuse) fail("assets", `${consecutive.length} consecutive reuse(s) in the plan, the fixture has ${wantReuse}`);
notes.push(`consecutive reuse carried into the render: ${consecutive.map((c) => `beat ${c.beat}`).join(", ") || "none"}`);

const drawn = new Set();
for (const b of plan.beats) {
  const c = b.scene?.canvas;
  for (const a of [c?.photo?.asset, ...(c?.concept_visuals || []).map((v) => v?.asset)].filter(Boolean)) drawn.add(a);
}
if (drawn.size < 6) fail("assets", `only ${drawn.size} distinct PNGs drawn (need >= 6)`);
for (const im of meta.images) {
  if (!existsSync(join(PUBLIC, im.asset))) fail("assets", `fixture file missing on disk: ${im.asset}`);
  if (!drawn.has(im.asset)) fail("assets", `no beat draws ${im.asset}`);
}

const stats = async (file) => {
  const s = await sharp(file).removeAlpha().stats();
  const mean = s.channels.reduce((a, c) => a + c.mean, 0) / s.channels.length;
  const std = s.channels.reduce((a, c) => a + c.stdev, 0) / s.channels.length;
  return { mean, std };
};
const rawOf = async (file) => {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, channels: info.channels, w: info.width, h: info.height };
};

const manifestPath = arg("manifest", join(dir, "canvas-test-manifest.json"));
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
const ground = parseHex(manifest?.ground) || parseHex(plan.ground);
if (!manifest) skipped.push("overlay manifest checks (no canvas-test-manifest.json: the render was not made with --video)");
if (!ground) skipped.push(`alpha ring-blend check (ground ${JSON.stringify(manifest?.ground ?? plan.ground)} is not a #rrggbb colour)`);

const perBeat = [];
for (let i = 0; i < plan.beats.length; i++) {
  const fx = meta.beats[i]?.fixture;
  const im = meta.images[fx?.image];
  let best = 0, magentaWorst = 0, ringBest = 0;
  const credit = { visible: null, hidden: null };
  const cm = creditMoments(plan.beats[i].duration_frames, moments);
  for (const m of moments) {
    const file = join(dir, stillName(i, m));
    if (!existsSync(file)) continue;
    const st = await stats(file);
    const k = classifyFrame(st);
    if (k === "black") fail("frames", `${stillName(i, m)} is black (mean ${st.mean.toFixed(1)})`);
    if (k === "blank" && m >= 0.5) fail("frames", `${stillName(i, m)} is a flat blank frame at ${Math.round(m * 100)}% of the beat`);
    const raw = await rawOf(file);
    if (im) best = Math.max(best, signatureShare(raw.data, raw.channels, im.signature, T.signatureDistance.value));
    if (im?.alpha) {
      magentaWorst = Math.max(magentaWorst, colourShare(raw.data, raw.channels, raw.w, raw.h, [255, 0, 255], T.magentaDistance.value));
      if (ground) ringBest = Math.max(ringBest, colourShare(raw.data, raw.channels, raw.w, raw.h, blend(im.signature, ground), T.ringBlendTolerance.value));
    }
    if (fx?.source_credit) {
      const n = colourCount(raw.data, raw.channels, raw.w, raw.h, creditRect(raw.w, raw.h), T.creditColour.value, T.creditColourDistance.value);
      if (m === cm.visible) credit.visible = n;
      if (m === cm.hidden) credit.hidden = n;
    }
  }
  perBeat.push({ beat: i, image: im?.file, best_signature_share: Number(best.toFixed(4)) });
  if (im && best < T.signatureShareMin.value) fail("drawn", `beat ${i}: "${im.file}" does not appear in any sampled still (best signature share ${(best * 100).toFixed(3)}%)`);
  if (im?.alpha) {
    measured.alpha.push({ beat: i, image: im.file, magenta_share: Number(magentaWorst.toFixed(5)), ring_blend_share: Number(ringBest.toFixed(5)) });
    for (const p of alphaProblems({ magentaShare: magentaWorst, ringShare: ringBest, groundKnown: !!ground })) fail("alpha", `beat ${i} (${im.file}): ${p}`);
  }
  if (fx?.source_credit) {
    measured.credit.push({ beat: i, visible_pixels: credit.visible, hidden_pixels: credit.hidden, sampled_visible_at: cm.visible, sampled_hidden_at: cm.hidden });
    for (const p of creditProblems(credit.visible, credit.hidden)) fail("overlays", `beat ${i} credit line: ${p}`);
  }
}

if (manifest) {
  const lateMoment = [...moments].reverse().find((m) => m >= 0.5 && m <= 0.9) ?? moments[moments.length - 1];
  for (let i = 0; i < plan.beats.length; i++) {
    const fx = meta.beats[i]?.fixture;
    const canvas = manifest.beats?.[i]?.canvas;
    if (!canvas) { fail("overlays", `beat ${i}: no canvas entry in the manifest`); continue; }
    for (const p of drawnTextProblems(canvas, { headline: fx?.headline, source_credit: fx?.source_credit })) fail("overlays", `beat ${i}: ${p}`);
    const box = canvas.boxes?.headline || canvas.boxes?.statement;
    if (plainDir && fx?.headline && box) {
      const a = join(dir, stillName(i, lateMoment)), b = join(plainDir, stillName(i, lateMoment));
      if (!existsSync(a) || !existsSync(b)) continue;
      const [ra, rb] = [await rawOf(a), await rawOf(b)];
      const rect = boxToRect(box, ra.w, ra.h);
      const [withText, without] = [edgeDensity(ra.data, ra.channels, ra.w, ra.h, rect), edgeDensity(rb.data, rb.channels, rb.w, rb.h, rect)];
      measured.text.push({ beat: i, moment: lateMoment, box_rect: rect, edge_density_with: Number(withText.toFixed(4)), edge_density_without: Number(without.toFixed(4)) });
      for (const p of textGainProblems(withText, without)) fail("overlays", `beat ${i}: ${p}`);
    }
  }
  if (!plainDir) skipped.push("headline pixel check (no --plain render to compare against)");
}

const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const decodeGray = (mp4, w, h, fps) => {
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-i", mp4, "-vf", `fps=${fps},scale=${w}:${h},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 29 });
  return r.status === 0 && r.stdout?.length ? r.stdout : null;
};

if (compare) {
  let same = 0, differ = 0;
  for (let i = 0; i < plan.beats.length; i++) for (const m of moments) {
    const a = join(dir, stillName(i, m)), b = join(compare, stillName(i, m));
    if (!existsSync(a) || !existsSync(b)) { fail("determinism", `${stillName(i, m)} missing from one of the two renders`); continue; }
    const [ra, rb] = [await rawOf(a), await rawOf(b)];
    if (ra.w === rb.w && ra.h === rb.h && ra.data.equals(rb.data)) same++;
    else { differ++; fail("determinism", `${stillName(i, m)} differs between the two renders`); }
  }
  const planB = JSON.parse(readFileSync(join(compare, "plan.json"), "utf8"));
  if (JSON.stringify(plan) !== JSON.stringify(planB)) fail("determinism", "plan.json differs between the two renders");
  notes.push(`determinism: ${same} identical, ${differ} different stills`);

  const [va, vb] = [join(dir, "canvas-test.mp4"), join(compare, "canvas-test.mp4")];
  if (withVideo) {
    if (!existsSync(vb)) fail("determinism", "the second render has no canvas-test.mp4, so the video cannot be compared");
    else if (existsSync(va)) {
      const W = 270, H = 480, FPS = 10;
      const [fa, fb] = [decodeGray(va, W, H, FPS), decodeGray(vb, W, H, FPS)];
      if (!fa || !fb) fail("determinism", "ffmpeg could not decode one of the two videos");
      else {
        const diffs = frameDiffs(fa, fb, W * H);
        const [na, nb] = [Math.floor(fa.length / (W * H)), Math.floor(fb.length / (W * H))];
        for (const p of videoDeterminismProblems(diffs, na, nb)) fail("determinism", p);
        measured.video = { frames: diffs.length, worst_mean_diff: Number(Math.max(0, ...diffs.map((d) => d.mean)).toFixed(4)), worst_changed_share: Number(Math.max(0, ...diffs.map((d) => d.changed)).toFixed(5)), mp4_byte_identical: sha(va) === sha(vb) };
        notes.push(`video determinism (decoded frames at ${FPS} fps, ${W}x${H}): ${diffs.length} compared, worst mean diff ${measured.video.worst_mean_diff}, worst changed share ${(measured.video.worst_changed_share * 100).toFixed(3)}%; mp4 byte-identical: ${measured.video.mp4_byte_identical} (informational, not a criterion)`);
      }
    }
  }
}

if (withVideo) {
  const mp4 = join(dir, "canvas-test.mp4");
  if (!existsSync(mp4)) fail("video", "canvas-test.mp4 was not produced");
  else {
    const FPS = 10, W = 54, H = 96;
    const raw = decodeGray(mp4, W, H, FPS);
    if (!raw) fail("video", "ffmpeg could not decode the video");
    else {
      const size = W * H, n = Math.floor(raw.length / size), series = [];
      for (let f = 0; f < n; f++) {
        let sum = 0, sq = 0;
        for (let p = 0; p < size; p++) { const v = raw[f * size + p]; sum += v; sq += v * v; }
        const mean = sum / size;
        series.push({ mean, std: Math.sqrt(Math.max(0, sq / size - mean * mean)) });
      }
      for (const p of frameRunProblems(series, FPS)) fail("video", p);
      for (const p of flickerProblems(series.map((s) => s.mean))) fail("video", `flicker at ${p}`);
      const last = plan.beats[plan.beats.length - 1];
      const expect = ((last.start_frame + last.duration_frames) / 30) * FPS;
      if (Math.abs(n - expect) > 3) fail("video", `${n} samples at ${FPS} fps, expected about ${Math.round(expect)}`);
      notes.push(`video: ${n} samples at ${FPS} fps (expected about ${Math.round(expect)})`);
    }
  }
}

notes.push("word captions: not drawn by design (owner 2026-10-08); nothing to check in pixels");
const report = { pass: problems.length === 0, beats: plan.beats.length, moments, distinct_pngs_drawn: drawn.size, per_beat: perBeat, measured, thresholds: T, notes, skipped, problems };
writeFileSync(join(dir, "multi-png-report.json"), JSON.stringify(report, null, 2) + "\n");
for (const n of notes) console.log(`[multi-png] ${n}`);
for (const s of skipped) console.log(`[multi-png] NOT CHECKED: ${s}`);
for (const b of perBeat) console.log(`[multi-png] beat ${b.beat}: ${b.image} signature share ${(b.best_signature_share * 100).toFixed(2)}%`);
for (const a of measured.alpha) console.log(`[multi-png] alpha beat ${a.beat}: magenta ${(a.magenta_share * 100).toFixed(3)}% (max ${(T.magentaShareMax.value * 100).toFixed(2)}%), ring blend ${(a.ring_blend_share * 100).toFixed(3)}% (min ${(T.ringBlendShareMin.value * 100).toFixed(3)}%)`);
for (const c of measured.credit) console.log(`[multi-png] credit beat ${c.beat}: visible ${c.visible_pixels} px (min ${T.creditPixelsMin.value}), hidden ${c.hidden_pixels} px (max ${T.creditPixelsMaxWhenHidden.value})`);
for (const t of measured.text) console.log(`[multi-png] headline beat ${t.beat}: edge density ${t.edge_density_with} with text, ${t.edge_density_without} without (gain needed ${T.textEdgeGain.value})`);
if (problems.length) { for (const p of problems) console.error(`[multi-png] FAIL ${p}`); process.exit(1); }
console.log(`[multi-png] PASS: ${plan.beats.length} beats, ${drawn.size} distinct PNGs, ${moments.length} moments each${skipped.length ? ` (${skipped.length} check group(s) not run, see above)` : ""}`);
