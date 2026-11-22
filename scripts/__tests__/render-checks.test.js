// Overlay, alpha, thresholds and video-determinism checks (scripts/lib/render-checks.mjs). Each check is shown to PASS a
// good input and to REJECT a synthetic fault, so a check that always says yes cannot hide here. Whether the real render
// passes them is decided by the recovery-smoke workflow on GitHub, not by this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { syntheticPng, MAGENTA } from "../lib/synthetic-png.mjs";
import { buildFixture, plainBeats, SOURCE_CREDIT } from "../lib/multi-png-fixture.mjs";
import { classifyFrame, flickerProblems } from "../lib/render-sequence.mjs";
import {
  THRESHOLDS, boxToRect, creditRect, boxProblems, drawnTextProblems, edgeDensity, colourCount, colourShare, blend, parseHex,
  alphaProblems, creditProblems, textGainProblems, creditMoments, frameDiffs, videoDeterminismProblems,
} from "../lib/render-checks.mjs";

// ── thresholds ─────────────────────────────────────────────────────────────────
test("every threshold names its reason and says whether it has been measured", () => {
  for (const [k, t] of Object.entries(THRESHOLDS)) {
    assert.ok(["untuned", "fixed"].includes(t.status), `${k}: status ${t.status}`);
    assert.ok(typeof t.why === "string" && t.why.length > 20, `${k}: needs a reason`);
    assert.ok(t.value !== undefined, `${k}: needs a value`);
  }
});

test("the thresholds that duplicate render-sequence.mjs defaults agree with them", () => {
  assert.equal(classifyFrame({ mean: THRESHOLDS.blackMean.value - 0.1, std: 50 }), "black");
  assert.equal(classifyFrame({ mean: THRESHOLDS.blackMean.value, std: 50 }), "ok");
  assert.equal(classifyFrame({ mean: THRESHOLDS.blankMeanAbove.value + 1, std: 1 }), "blank");
  const j = THRESHOLDS.flickerJump.value;
  assert.equal(flickerProblems([100, 100 + j + 1, 100]).length, 1);
  assert.equal(flickerProblems([100, 100 + j - 1, 100]).length, 0);
});

test("the credit timing thresholds match what full-canvas.jsx draws", () => {
  const src = readFileSync(new URL("../../src/skills/remotion-render/visual/full-canvas.jsx", import.meta.url), "utf8");
  assert.match(src, /opacity: Math\.max\(0, Math\.min\(1, \(local - 40\) \/ 8\)\)[^>]*>Source: \{c\.source_credit\}/, "fade-in is frames 40-48");
  assert.match(src, /color: "#888888"/);
  assert.ok(THRESHOLDS.creditHiddenUntilFrame.value <= 40);
  assert.ok(THRESHOLDS.creditVisibleFromFrame.value >= 48);
  assert.deepEqual(THRESHOLDS.creditColour.value, parseHex("#888888"));
});

// ── captions ───────────────────────────────────────────────────────────────────
test("word captions are not drawn: CanvasCaption is defined and never used, so there is nothing to render-test", () => {
  const src = readFileSync(new URL("../../src/skills/remotion-render/visual/full-canvas.jsx", import.meta.url), "utf8");
  const code = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  assert.equal([...code.matchAll(/<CanvasCaption\b/g)].length, 0,
    "CanvasCaption is used again: add caption coverage (words, timing, placement) to the multi-PNG smoke before keeping this change");
});

// ── the synthetic PNG's hidden colour ──────────────────────────────────────────
function firstPixel(png) {
  let o = 8, idat = [];
  while (o < png.length) {
    const len = png.readUInt32BE(o), type = png.toString("ascii", o + 4, o + 8);
    if (type === "IDAT") idat.push(png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  return [...raw.subarray(1, 5)];
}

test("a cutout PNG hides magenta under alpha 0; an opaque one has no transparent pixel", () => {
  assert.deepEqual(firstPixel(syntheticPng({ w: 200, h: 200, hue: 50, disc: true }).png), [...MAGENTA, 0]);
  const opaque = firstPixel(syntheticPng({ w: 200, h: 200, hue: 50 }).png);
  assert.equal(opaque[3], 255);
  assert.notDeepEqual(opaque.slice(0, 3), MAGENTA);
});

test("no fixture signature colour is near the magenta hidden under alpha, so magenta is unambiguous", () => {
  for (const hue of [10, 50, 90, 130, 170, 210, 250, 290]) {
    const s = syntheticPng({ w: 64, h: 64, hue }).signature;
    assert.ok(Math.hypot(s[0] - 255, s[1], s[2] - 255) > THRESHOLDS.magentaDistance.value * 1.5, `hue ${hue}`);
  }
});

// ── fixture overlays ───────────────────────────────────────────────────────────
test("fixture: three beats carry a source credit, every beat a headline, and plainBeats strips the headline, the credit and the photo entity name", () => {
  const { beats } = buildFixture();
  assert.equal(beats.filter((b) => b.c.source_credit === SOURCE_CREDIT).length, 3);
  assert.ok(beats.every((b) => b.fixture.headline && b.fixture.headline === b.c.headline));
  assert.ok(beats.some((b) => b.fixture.source_credit) && beats.some((b) => !b.fixture.source_credit), "both with and without a credit");
  const plain = plainBeats(beats);
  assert.equal(plain.length, beats.length);
  plain.forEach((p, i) => {
    assert.equal(p.text, beats[i].text);
    assert.equal(p.c.headline, undefined);
    assert.equal(p.c.source_credit, undefined);
    const { headline, source_credit, ...rest } = beats[i].c;
    if (rest.photo) {
      assert.equal(p.c.photo.entity, undefined, "the entity name is drawn as the headline, so the baseline drops it");
      const { entity, ...photo } = rest.photo;
      rest.photo = photo;
    }
    assert.deepEqual(p.c, rest);
  });
  assert.ok(beats.every((b) => b.c.headline), "plainBeats did not mutate its input");
  assert.ok(beats.filter((b) => b.c.photo).every((b) => b.c.photo.entity), "plainBeats did not mutate the photo");
});

// ── geometry and manifest text ─────────────────────────────────────────────────
test("boxToRect scales a 1080x1920 box to the still and clamps to it", () => {
  assert.deepEqual(boxToRect({ x: 100, y: 200, w: 400, h: 300 }, 540, 960, 0), { x: 50, y: 100, w: 200, h: 150 });
  const r = boxToRect({ x: 1000, y: 1900, w: 200, h: 100 }, 540, 960, 4);
  assert.ok(r.x + r.w <= 540 && r.y + r.h <= 960);
});

test("boxProblems: a box inside the frame passes; empty and off-frame boxes fail", () => {
  assert.deepEqual(boxProblems({ x: 50, y: 60, w: 900, h: 300 }), []);
  assert.equal(boxProblems({ x: 50, y: 60, w: 0, h: 300 }).length, 1);
  assert.equal(boxProblems({ x: 500, y: 60, w: 900, h: 300 }).length, 1);
  assert.deepEqual(boxProblems(null), ["no box"]);
});

test("drawnTextProblems: the headline must be in a drawn, in-frame box; the credit must match", () => {
  const good = { boxes: { headline: { x: 60, y: 100, w: 900, h: 200, lines: ["Synthetic image", "1"] } }, source_credit: SOURCE_CREDIT };
  assert.deepEqual(drawnTextProblems(good, { headline: "Synthetic image 1", source_credit: SOURCE_CREDIT }), []);
  assert.equal(drawnTextProblems({ boxes: {} }, { headline: "Synthetic image 1" }).length, 2, "no text and no box");
  assert.equal(drawnTextProblems({ boxes: { headline: { x: 60, y: 100, w: 900, h: 200, lines: ["Something else"] } } }, { headline: "Synthetic image 1" }).length, 1);
  assert.equal(drawnTextProblems(good, { headline: "Synthetic image 1", source_credit: "Other" }).length, 1, "wrong credit");
  assert.equal(drawnTextProblems({ ...good, source_credit: "Stray" }, { headline: "Synthetic image 1", source_credit: null }).length, 1, "credit on a beat that has none");
  assert.deepEqual(drawnTextProblems({ boxes: { statement: { x: 60, y: 100, w: 900, h: 200, lines: ["Synthetic image 1"] } } }, { headline: "synthetic IMAGE 1" }), [], "statement boxes and case do not matter");
});

// ── pixels ─────────────────────────────────────────────────────────────────────
const rgb = (w, h, fn) => { const b = Buffer.alloc(w * h * 3); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.set(fn(x, y), (y * w + x) * 3); return b; };

test("edgeDensity: flat is 0, vertical stripes (text-like strokes) are high, and the rect limits the area", () => {
  const flat = rgb(40, 20, () => [255, 255, 255]);
  const stripes = rgb(40, 20, (x) => (x % 2 ? [0, 0, 0] : [255, 255, 255]));
  assert.equal(edgeDensity(flat, 3, 40, 20, null), 0);
  assert.ok(edgeDensity(stripes, 3, 40, 20, null) > 0.9);
  const half = rgb(40, 20, (x) => (x >= 20 && x % 2 ? [0, 0, 0] : [255, 255, 255]));
  assert.equal(edgeDensity(half, 3, 40, 20, { x: 0, y: 0, w: 15, h: 20 }), 0);
  assert.ok(edgeDensity(half, 3, 40, 20, { x: 20, y: 0, w: 20, h: 20 }) > 0.9);
});

test("textGainProblems: a box that gained strokes passes; a box that did not fails", () => {
  assert.deepEqual(textGainProblems(0.12, 0.01), []);
  assert.equal(textGainProblems(0.012, 0.01).length, 1);
  assert.equal(textGainProblems(0.0, 0.05).length, 1, "text made it calmer: still a failure");
});

test("colourCount / colourShare find a colour inside a rect only", () => {
  const img = rgb(20, 10, (x, y) => (x >= 10 && y < 5 ? [136, 136, 136] : [255, 255, 255]));
  assert.equal(colourCount(img, 3, 20, 10, null, [136, 136, 136], 10), 50);
  assert.equal(colourCount(img, 3, 20, 10, { x: 0, y: 0, w: 10, h: 10 }, [136, 136, 136], 10), 0);
  assert.equal(colourShare(img, 3, 20, 10, [136, 136, 136], 10), 0.25);
});

test("alphaProblems: clean cutout and a visible ring pass; magenta and a missing ring fail with distinct messages", () => {
  assert.deepEqual(alphaProblems({ magentaShare: 0, ringShare: 0.004, groundKnown: true }), []);
  const ignored = alphaProblems({ magentaShare: 0.15, ringShare: 0.004, groundKnown: true });
  assert.equal(ignored.length, 1);
  assert.match(ignored[0], /ignored/);
  const halo = alphaProblems({ magentaShare: 0.003, ringShare: 0.004, groundKnown: true });
  assert.match(halo[0], /bleed halo/);
  assert.match(alphaProblems({ magentaShare: 0, ringShare: 0, groundKnown: true })[0], /not composited/);
  assert.deepEqual(alphaProblems({ magentaShare: 0, ringShare: 0, groundKnown: false }), [], "the ring check is skipped (and reported as skipped) when the ground is unknown");
});

test("blend and parseHex: alpha 128 over white, and hex parsing", () => {
  assert.deepEqual(blend([0, 0, 0], [255, 255, 255]), [127, 127, 127]);
  assert.deepEqual(parseHex("#FFFFFF"), [255, 255, 255]);
  assert.equal(parseHex("white"), null);
  assert.equal(parseHex(null), null);
});

test("creditMoments picks a sampled moment after the fade-in and one before it, from the beat length", () => {
  assert.deepEqual(creditMoments(90, [0.05, 0.5, 0.85, 0.95]), { visible: 0.85, hidden: 0.05 });
  assert.equal(creditMoments(60, [0.05, 0.5, 0.85]).visible, null, "60 frames: 0.85 is frame 51, before the line is fully on");
  assert.equal(creditMoments(90, [0.5, 0.85]).hidden, null, "frame 45 is already fading in");
});

test("creditProblems: visible late and absent early passes; each fault fails", () => {
  assert.deepEqual(creditProblems(60, 0), []);
  assert.equal(creditProblems(2, 0).length, 1, "never appeared");
  assert.equal(creditProblems(60, 40).length, 1, "present before its fade-in");
  assert.equal(creditProblems(null, 0).length, 1, "no moment late enough to judge");
  assert.deepEqual(creditProblems(60, null), []);
});

// ── video, frame level ─────────────────────────────────────────────────────────
test("frameDiffs / videoDeterminismProblems: identical and noise-level videos pass; a shifted or truncated one fails", () => {
  const size = 100, frames = 5;
  const a = Buffer.alloc(size * frames);
  for (let i = 0; i < a.length; i++) a[i] = (i * 7) % 251;
  assert.deepEqual(videoDeterminismProblems(frameDiffs(a, Buffer.from(a), size), 5, 5), []);
  const noisy = Buffer.from(a);
  for (let i = 0; i < noisy.length; i += 50) noisy[i] = Math.min(255, noisy[i] + 1);
  assert.deepEqual(videoDeterminismProblems(frameDiffs(a, noisy, size), 5, 5), [], "off-by-one noise is encoder noise");
  const moved = Buffer.from(a);
  for (let p = 0; p < size; p++) moved[2 * size + p] = 255 - moved[2 * size + p];
  const bad = videoDeterminismProblems(frameDiffs(a, moved, size), 5, 5);
  assert.ok(bad.length >= 1 && bad.every((m) => m.startsWith("sample 2")));
  assert.match(videoDeterminismProblems(frameDiffs(a, a.subarray(0, 4 * size), size), 5, 4)[0], /5 and 4 frames/);
  assert.match(videoDeterminismProblems([], 0, 0).join(), /no frames/);
});

// ── the workflow runs what the checker needs ───────────────────────────────────
test("recovery-smoke renders the video twice and a plain third render, and hands all three to the checker", () => {
  const text = readFileSync(new URL("../../.github/workflows/recovery-smoke.yml", import.meta.url), "utf8");
  const code = text.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  const renders = [...code.matchAll(/qa-canvas-render\.mjs --out (out\/run\d)([^\n]*)/g)];
  assert.deepEqual(renders.map((m) => m[1]), ["out/run1", "out/run2", "out/run3"]);
  assert.match(renders[0][2], /--video/);
  assert.match(renders[1][2], /--video/, "determinism is compared on the video too");
  assert.doesNotMatch(renders[2][2], /--video/);
  assert.match(renders[2][2], /multi-beats-plain\.json/);
  const check = code.match(/check-multi-png-render\.mjs ([^\n]*)/)[1];
  for (const f of ["--compare out/run2", "--plain out/run3", "--video"]) assert.ok(check.includes(f), `checker gets ${f}`);
});
