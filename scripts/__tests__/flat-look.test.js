// FLAT components (owner, 2026-10-09: "they shouldn't look playful — actually that motion graphic"): the reference's drawn parts are
// sharp, ink + one accent, thin-stroked, shadowless and restrained in motion. The pixel measures run on synthetic frames here; the
// real frames go through scripts/local-audit.cjs `flat-look` on CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { barState, pieState, lineState, numberState, ANIMATIONS } from "../../src/skills/remotion-render/visual/animations.js";

const require = createRequire(import.meta.url);
const { offPalette, shadowShare, cornersSharp, OFF_SHARE_MAX } = require("../lib/flat-look.cjs");

const W = 100, H = 100;
const frame = (fill = [255, 255, 255]) => { const b = Buffer.alloc(W * H * 3); for (let i = 0; i < W * H; i++) b.set(fill, i * 3); return b; };
const rect = (b, x0, y0, w, h, rgb) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) b.set(rgb, (y * W + x) * 3); };

test("palette: ink, grey and the accent pass; a candy-coloured series fails", () => {
  const ok = frame();
  rect(ok, 10, 10, 30, 30, [11, 11, 12]); rect(ok, 50, 10, 30, 30, [167, 167, 173]); rect(ok, 10, 50, 30, 30, [30, 58, 95]);
  assert.ok(offPalette(ok, W, H, "#1E3A5F").share <= OFF_SHARE_MAX);
  const candy = frame();
  rect(candy, 10, 10, 20, 20, [255, 90, 160]); rect(candy, 40, 10, 20, 20, [250, 200, 20]); rect(candy, 70, 10, 20, 20, [40, 220, 120]);
  assert.ok(offPalette(candy, W, H, "#1E3A5F").share > OFF_SHARE_MAX);
});

test("palette: a grey accent allows no colour at all", () => {
  const f = frame(); rect(f, 10, 10, 20, 20, [30, 58, 95]);
  assert.ok(offPalette(f, W, H, "#2B2B2B").share > OFF_SHARE_MAX);
});

test("palette: a skipped box (a real flag) is not judged", () => {
  const f = frame(); rect(f, 10, 10, 40, 40, [200, 30, 30]);
  assert.ok(offPalette(f, W, H, "#1E3A5F", { skip: [{ x: 10, y: 10, w: 40, h: 40 }] }).share <= OFF_SHARE_MAX);
});

test("shadow: a soft halo beside the box is found, a hairline-bounded box has none", () => {
  const flat = frame(); rect(flat, 20, 20, 40, 40, [11, 11, 12]);
  assert.ok(shadowShare(flat, W, H, { x: 20, y: 20, w: 40, h: 40 }, 255) < 0.05);
  const shadowed = frame(); rect(shadowed, 20, 20, 40, 40, [11, 11, 12]);
  for (let k = 0; k < 18; k++) rect(shadowed, 60 + k, 24, 1, 40, [255 - Math.round(50 * (1 - k / 18)), 255 - Math.round(50 * (1 - k / 18)), 255 - Math.round(50 * (1 - k / 18))]);
  assert.ok(shadowShare(shadowed, W, H, { x: 20, y: 20, w: 40, h: 40 }, 255) > 0.25);
});

test("corners: a square box is sharp (4), a large-radius box is not", () => {
  const sq = frame(); rect(sq, 20, 20, 50, 50, [11, 11, 12]);
  assert.equal(cornersSharp(sq, W, H, { x: 20, y: 20, w: 50, h: 50 }, 255), 4);
  const rounded = frame(); rect(rounded, 20, 20, 50, 50, [11, 11, 12]);
  const r = 14;   // knock the corners off with a radius
  for (const [cx, cy] of [[20, 20], [70 - r, 20], [20, 70 - r], [70 - r, 70 - r]]) {
    for (let y = 0; y < r; y++) for (let x = 0; x < r; x++) {
      const ox = cx === 20 ? r - x : x + 1, oy = cy === 20 ? r - y : y + 1;
      if (ox * ox + oy * oy > r * r) rounded.set([255, 255, 255], ((cy + y) * W + (cx + x)) * 3);
    }
  }
  assert.ok(cornersSharp(rounded, W, H, { x: 20, y: 20, w: 50, h: 50 }, 255) < 4);
});

const steps = Array.from({ length: 101 }, (_, k) => k / 100);

test("motion: no chart state ever overshoots its end value (no spring, bounce or elastic)", () => {
  for (const a of ANIMATIONS.filter((x) => String(x.family).startsWith("bar"))) {
    for (let i = 0; i < 4; i++) {
      let prev = null;
      for (const t of steps) {
        const s = barState(a.id, t, i, 4, { primary: 0, sec: t });
        assert.ok(s.grow <= 1 + 1e-9, `${a.id}: grow ${s.grow} at t=${t}`);
        assert.equal(s.pulse, 1, `${a.id}: pulse`);
        if (prev != null) assert.ok(Math.abs(s.dy) <= Math.abs(prev) + 1e-9, `${a.id}: dy bounces at t=${t}`);
        prev = s.dy;
      }
    }
  }
  for (const a of ANIMATIONS.filter((x) => String(x.family).startsWith("pie"))) {
    let prev = null;
    for (const t of steps) {
      const s = pieState(a.id, t, t);
      assert.ok(s.ringScale <= 1 + 1e-9 && s.explode === 0, `${a.id}: ring ${s.ringScale} explode ${s.explode} at t=${t}`);
      if (prev != null) assert.ok(Math.abs(s.dy) <= Math.abs(prev) + 1e-9, `${a.id}: dy bounces at t=${t}`);
      prev = s.dy;
    }
  }
  for (const a of ANIMATIONS.filter((x) => String(x.family).startsWith("line"))) {
    for (let i = 0; i < 4; i++) {
      let prev = null;
      for (const t of steps) {
        const s = lineState(a.id, t, i, 4);
        assert.ok(s.dot <= 1 + 1e-9, `${a.id}: dot ${s.dot}`);
        if (prev != null) assert.ok(Math.abs(s.dropY) <= Math.abs(prev) + 1e-9, `${a.id}: dropY bounces at t=${t}`);
        prev = s.dropY;
      }
    }
  }
  for (const id of ["FLIP_CARD", "SNAP_IN", "SCALE_IMPACT"]) {
    let prevRot = -Infinity;
    for (const t of steps) {
      const s = numberState(id, t);
      assert.ok(s.rotX <= 1e-9 && s.rotX >= prevRot - 1e-9, `${id}: rotX overshoots`);
      assert.ok(s.s >= 1 - 0.1 - 1e-9 && Math.abs(s.dy) < 1e-9, `${id}: ringing`);
      prevRot = s.rotX;
    }
    assert.equal(numberState(id, 1).s, 1);
  }
});

// The drawn components' source: no shadow, no rounded corners, no round caps, no heavy strokes, no spring easing.
const SRC = readFileSync(new URL("../../src/skills/remotion-render/visual/full-canvas.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const section = (from, to) => { const a = SRC.indexOf(from), b = SRC.indexOf(to, a + 1); assert.ok(a >= 0 && b > a, `section ${from}`); return SRC.slice(a, b); };
const COMPONENTS = {
  DataFull: section("function DataFull(", "// ── SCENE-FULL"),
  EntityArt: section("function EntityArt(", "// ── SHOT FRAMES"),
  ProcessFull: section("function ProcessFull(", "// ── MAP-CENTERED"),
  MapCentered: section("function MapCentered(", "function appearTimes("),
  Timeline: section("function Timeline(", "// ── COMPARISON-SPLIT"),
};

for (const [name, code] of Object.entries(COMPONENTS)) {
  test(`${name}: flat — no shadow, no rounded corners, no round caps, thin strokes, no spring easing`, () => {
    assert.ok(!/boxShadow|dropShadow|drop-shadow/.test(code), "a shadow");
    assert.ok(!/borderRadius|\brx=/.test(code), "rounded corners");
    assert.ok(!/strokeLinecap="round"|strokeLinejoin="round"/.test(code.replace(/\{\.\.\.line\}/g, "")), "round caps / joins");
    assert.ok(!/backOut|bounceOut|elasticOut/.test(code), "spring easing");
    for (const m of code.matchAll(/strokeWidth=\{?"?(\d+(?:\.\d+)?)/g)) assert.ok(Number(m[1]) <= 10, `a ${m[1]} px stroke`);
    for (const m of code.matchAll(/\bsw = (\d+)/g)) assert.ok(Number(m[1]) <= 40, `a ${m[1]} px ring`);
  });
}

test("the date card is typographic, not a wall calendar", () => {
  assert.ok(!/binder|calendar/i.test(COMPONENTS.EntityArt.replace(/\/\/.*$/gm, "").replace(/not a wall calendar/g, "")), "a calendar drawn");
});
