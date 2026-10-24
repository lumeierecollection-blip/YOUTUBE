// The multi-PNG render regression, as far as it can be proven WITHOUT a browser: the synthetic fixture itself, and the
// pure checks scripts/check-multi-png-render.mjs applies to a real render. Each check is shown to PASS a good sequence
// and to REJECT a synthetic fault, so a gate that always says yes cannot hide here. The pixels of the real render are
// judged by the recovery-smoke workflow on GitHub, not by this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { syntheticPng, hslToRgb } from "../lib/synthetic-png.mjs";
import { IMAGES, SUBDIR, buildFixture, writeFixture } from "../lib/multi-png-fixture.mjs";
import {
  sequenceProblems, stillProblems, stillName, assetCollisions, classifyFrame, frameRunProblems, flickerProblems, signatureShare,
} from "../lib/render-sequence.mjs";
import { createUsedImages } from "../lib/used-images.js";

const beat = (i, start, dur = 90, extra = {}) => ({ beat_id: `t${i}`, start_frame: start, duration_frames: dur, ...extra });
const goodBeats = (n) => Array.from({ length: n }, (_, i) => beat(i, i * 90));

// ── the synthetic PNGs ────────────────────────────────────────────────────────────────────────────────────────────────
test("syntheticPng: valid PNG of the asked size, byte-identical for the same spec", async () => {
  const a = syntheticPng({ w: 300, h: 200, hue: 120 });
  const b = syntheticPng({ w: 300, h: 200, hue: 120 });
  assert.ok(a.png.equals(b.png), "same spec, same bytes");
  const m = await sharp(a.png).metadata();
  assert.equal(m.format, "png");
  assert.equal(m.width, 300);
  assert.equal(m.height, 200);
  assert.ok(!syntheticPng({ w: 300, h: 200, hue: 121 }).png.equals(a.png), "a different hue is a different file");
});

test("syntheticPng: an opaque image is opaque everywhere; a disc image is transparent outside, half-transparent on the ring, opaque inside", async () => {
  const opaque = await sharp(syntheticPng({ w: 200, h: 100, hue: 10 }).png).raw().toBuffer({ resolveWithObject: true });
  for (let p = 3; p < opaque.data.length; p += opaque.info.channels) assert.equal(opaque.data[p], 255);

  const w = 900, h = 1100;
  const { data, info } = await sharp(syntheticPng({ w, h, hue: 50, disc: true }).png).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  const alphaAt = (x, y) => data[(y * w + x) * 4 + 3];
  assert.equal(alphaAt(0, 0), 0, "corner is transparent");
  assert.equal(alphaAt(450, 550), 255, "centre is opaque");
  assert.equal(alphaAt(870, 550), 128, "the ring is half transparent");
});

// ── the fixture ───────────────────────────────────────────────────────────────────────────────────────────────────────
test("fixture: >= 6 distinct PNGs, varied aspect ratios, two with alpha, awkward file names", () => {
  assert.ok(IMAGES.length >= 6);
  assert.equal(new Set(IMAGES.map((i) => i.file)).size, IMAGES.length, "distinct names");
  const ratios = new Set(IMAGES.map((i) => (i.w / i.h).toFixed(2)));
  assert.ok(ratios.size >= 5, `aspect ratios: ${[...ratios].join(", ")}`);
  assert.ok(ratios.has("1.00") && [...ratios].some((r) => Number(r) > 1.7) && [...ratios].some((r) => Number(r) < 0.7), "square, wide and tall are all present");
  assert.ok(IMAGES.filter((i) => i.disc).length >= 2, "at least two images with transparency");
  const names = IMAGES.map((i) => i.file).join("\n");
  for (const [what, re] of [["a space", / /], ["parentheses", /[()]/], ["#", /#/], ["&", /&/], ["%", /%/], ["non-ASCII", /[^\x00-\x7f]/]]) assert.match(names, re, `a file name with ${what}`);
});

test("fixture: signature colours are far enough apart that one picture cannot stand in for another", () => {
  const sigs = IMAGES.map((i) => hslToRgb(i.hue, 0.75, 0.45));
  for (let a = 0; a < sigs.length; a++) for (let b = a + 1; b < sigs.length; b++) {
    const d = Math.hypot(...sigs[a].map((v, k) => v - sigs[b][k]));
    assert.ok(d > 60, `${IMAGES[a].file} vs ${IMAGES[b].file}: distance ${d.toFixed(1)}`);
  }
});

test("fixture: composition never repeats on consecutive beats; exactly one consecutive reuse; every image is drawn", () => {
  const { beats, images } = buildFixture();
  for (let i = 1; i < beats.length; i++) assert.notEqual(beats[i].c.composition, beats[i - 1].c.composition, `beats ${i - 1} and ${i}`);
  assert.equal(beats.filter((b) => b.fixture.reuse).length, 1);
  assert.deepEqual([...new Set(beats.map((b) => b.fixture.image))].sort(), images.map((_, k) => k));
  for (const b of beats) {
    const asset = b.c.photo?.asset ?? b.c.concept_visuals[0].asset;
    assert.ok(asset.startsWith(`${SUBDIR}/`));
    assert.equal(images[b.fixture.image].asset, asset);
  }
});

test("fixture: every PNG is written, with its exact awkward name, into a directory whose own path has spaces and symbols", async () => {
  const root = mkdtempSync(join(tmpdir(), "public dir (x) & y "));
  const fx = writeFixture(root);
  const onDisk = readdirSync(join(root, SUBDIR)).sort();
  assert.deepEqual(onDisk, IMAGES.map((i) => i.file).sort());
  for (const im of fx.images) {
    assert.ok(existsSync(join(root, im.asset)));
    const m = await sharp(readFileSync(join(root, im.asset))).metadata();
    assert.equal(m.width, im.w);
    assert.equal(m.height, im.h);
    assert.equal(m.hasAlpha, true, "every fixture file is RGBA; the disc ones use the channel (see the pixel test above)");
    assert.equal(im.signature.length, 3);
  }
});

// ── sequence numbering ────────────────────────────────────────────────────────────────────────────────────────────────
test("sequenceProblems: contiguous t0..tN with abutting frame ranges is clean", () => {
  assert.deepEqual(sequenceProblems(goodBeats(9)), []);
});

test("sequenceProblems: a skipped scene number is caught", () => {
  const b = goodBeats(4);
  b[2].beat_id = "t3";
  assert.ok(sequenceProblems(b).some((p) => /beat 2: id "t3" where "t2"/.test(p)));
});

test("sequenceProblems: a duplicate scene number is caught", () => {
  const b = goodBeats(4);
  b[3].beat_id = "t2";
  assert.ok(sequenceProblems(b).some((p) => /duplicate id "t2"/.test(p)));
});

test("sequenceProblems: a gap or an overlap between beats is caught", () => {
  const gap = goodBeats(3);
  gap[2].start_frame = 200;
  assert.ok(sequenceProblems(gap).some((p) => /beat 2: starts at frame 200, previous beat ended at 180/.test(p)));
  const overlap = goodBeats(3);
  overlap[1].start_frame = 60;
  assert.ok(sequenceProblems(overlap).some((p) => /beat 1: starts at frame 60/.test(p)));
});

test("sequenceProblems: a zero or negative duration is caught", () => {
  const b = goodBeats(2);
  b[1].duration_frames = 0;
  assert.ok(sequenceProblems(b).some((p) => /duration 0/.test(p)));
});

test("retry continuity: a retry that restarts at t0 on top of the first attempt's beats is a duplicate-id fault, a clean re-render is not", () => {
  const first = goodBeats(3);
  const spliced = [...first, beat(0, 270), beat(1, 360), beat(2, 450)];
  assert.ok(sequenceProblems(spliced).length > 0, "attempt 1's beats followed by attempt 2's are not one sequence");
  assert.deepEqual(sequenceProblems(goodBeats(3)), [], "the second attempt on its own is a whole, correctly numbered sequence");
});

test("resume continuity: resuming from t3 without t0..t2 is a fault, resuming with the full list is not", () => {
  const resumed = [beat(3, 270), beat(4, 360)];
  assert.ok(sequenceProblems(resumed).length > 0);
  assert.deepEqual(sequenceProblems(goodBeats(5)), []);
});

test("different attempts never share an output still name: the name is fixed by beat and moment, so a retry overwrites rather than adds", () => {
  assert.equal(stillName(3, 0.85), "beat-3-85.png");
  assert.equal(stillName(12, 0.05), "beat-12-5.png");
  const run = [];
  for (const attempt of [1, 2]) for (let i = 0; i < 2; i++) for (const m of [0.5, 0.85]) run.push(stillName(i, m));
  const files = [...new Set(run)];
  assert.deepEqual(stillProblems(files, 2, [0.5, 0.85]), [], "two attempts leave exactly one still per beat and moment");
});

test("stillProblems: a missing, an unexpected and a duplicated still are all reported", () => {
  const moments = [0.5, 0.85];
  const full = [0, 1, 2].flatMap((i) => moments.map((m) => stillName(i, m)));
  assert.deepEqual(stillProblems(full, 3, moments), []);
  assert.ok(stillProblems(full.filter((f) => f !== "beat-1-85.png"), 3, moments).includes("missing still beat-1-85.png"));
  assert.ok(stillProblems([...full, "beat-7-50.png"], 3, moments).includes("unexpected still beat-7-50.png"));
  assert.ok(stillProblems([...full, "beat-0-50.png"], 3, moments).some((p) => /listed 2 times/.test(p)));
  assert.deepEqual(stillProblems([...full, "notes.txt", "plan.json"], 3, moments), [], "files that are not stills are ignored");
});

// ── asset collisions and reuse ───────────────────────────────────────────────────────────────────────────────────────
const withAsset = (asset) => ({ scene: { canvas: { photo: { asset } } } });

test("assetCollisions: two paths that differ only by case or by Unicode form are a collision; distinct names are not", () => {
  const composed = "qa-synth/café.png", decomposed = "qa-synth/café.png";
  assert.deepEqual(assetCollisions([withAsset("qa-synth/Square Card.png"), withAsset("qa-synth/square card.png")]).collisions, [["qa-synth/Square Card.png", "qa-synth/square card.png"]]);
  assert.equal(assetCollisions([withAsset(composed), withAsset(decomposed)]).collisions.length, 1);
  assert.deepEqual(assetCollisions([withAsset("qa-synth/a.png"), withAsset("qa-synth/b.png")]).collisions, []);
});

test("assetCollisions: the same picture on adjacent beats is reported with its beat number; one beat apart is not adjacent", () => {
  assert.deepEqual(assetCollisions([withAsset("a.png"), withAsset("a.png")]).consecutive, [{ beat: 1, asset: "a.png" }]);
  assert.deepEqual(assetCollisions([withAsset("a.png"), withAsset("b.png"), withAsset("a.png")]).consecutive, []);
});

test("assetCollisions on the real fixture: no collisions, one consecutive reuse", () => {
  const { beats } = buildFixture();
  const r = assetCollisions(beats);
  assert.deepEqual(r.collisions, []);
  assert.equal(r.consecutive.length, 1);
});

test("consecutive-scene reuse is REFUSED by the resolver's used-images set (paths with spaces and symbols included)", () => {
  const used = createUsedImages();
  const v = { asset: "qa-synth/100% real 3x2.png", kind: "place" };
  assert.equal(used.keep([v], "beat 7").length, 1, "first use is kept");
  assert.equal(used.keep([{ ...v }], "beat 8").length, 0, "the next scene may not show it again");
  assert.equal(used.keep([{ asset: "qa-synth/panorama 3x1.png" }], "beat 9").length, 1, "a different picture is fine");
});

// ── frame checks ─────────────────────────────────────────────────────────────────────────────────────────────────────
test("classifyFrame: black and flat-blank are named, an ordinary frame is ok", () => {
  assert.equal(classifyFrame({ mean: 3, std: 1 }), "black");
  assert.equal(classifyFrame({ mean: 255, std: 0 }), "blank");
  assert.equal(classifyFrame({ mean: 250, std: 30 }), "ok");
  assert.equal(classifyFrame({ mean: 120, std: 40 }), "ok");
});

test("frameRunProblems: any black sample fails; a short blank lead-in passes; a blank run longer than the limit fails once", () => {
  const ok = { mean: 200, std: 40 }, blank = { mean: 255, std: 0 }, black = { mean: 2, std: 0 };
  assert.deepEqual(frameRunProblems(Array(20).fill(ok), 10), []);
  assert.deepEqual(frameRunProblems([...Array(5).fill(blank), ...Array(15).fill(ok)], 10), [], "half a second of white ground before the picture lands");
  const longBlank = frameRunProblems([...Array(15).fill(blank), ...Array(5).fill(ok)], 10);
  assert.equal(longBlank.length, 1);
  assert.match(longBlank[0], /flat blank frame/);
  const blk = frameRunProblems([ok, ok, black, ok], 10);
  assert.equal(blk.length, 1);
  assert.match(blk[0], /sample 2 .*black/);
});

test("flickerProblems: a one-sample spike is flagged; a hard cut to a new level and a slow fade are not", () => {
  const steady = Array(10).fill(240);
  const spike = [...steady]; spike[5] = 120;
  assert.equal(flickerProblems(spike).length, 1);
  assert.match(flickerProblems(spike)[0], /sample 5/);
  assert.deepEqual(flickerProblems([...Array(5).fill(240), ...Array(5).fill(120)]), [], "a cut is a step, not a spike");
  assert.deepEqual(flickerProblems([240, 220, 200, 180, 160, 140]), [], "a fade");
  assert.deepEqual(flickerProblems([]), []);
  assert.deepEqual(flickerProblems([240, 100]), []);
});

test("signatureShare: counts only pixels near the colour, and a missing picture scores zero", () => {
  const sig = [200, 30, 30];
  const px = (n, c) => Buffer.from(Array(n).fill(c).flat());
  const frame = Buffer.concat([px(25, sig), px(75, [255, 255, 255])]);
  assert.equal(signatureShare(frame, 3, sig), 0.25);
  assert.equal(signatureShare(px(100, [255, 255, 255]), 3, sig), 0);
  assert.equal(signatureShare(Buffer.alloc(0), 3, sig), 0);
  assert.equal(signatureShare(px(10, [190, 40, 40]), 3, sig), 1, "inside the tolerance");
  assert.equal(signatureShare(px(10, [120, 30, 30]), 3, sig), 0, "outside it");
});
