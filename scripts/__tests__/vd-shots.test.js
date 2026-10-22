// DirectedShots renderer maths (src/skills/remotion-render/shots/) and the render entry's production refusal.
// These test the numbers the composition draws from; the PICTURES are proven only by the CI contact sheet
// (.github/workflows/vd-shots-proof.yml), never by this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  scheduleShots, layoutWorld, resolveCamera, framingToCamera, parseFraming, toScreen, textSlotFor, TEXT_SLOTS, FW, FH,
} from "../../src/skills/remotion-render/shots/geometry.js";
import { mechanismPieces } from "../../src/skills/remotion-render/shots/mechanisms.js";
import { mapSfx } from "../../src/skills/remotion-render/shots/sfx-map.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures", "vd", "shots", "fixture-direction.json");
const direction = JSON.parse(readFileSync(FIX, "utf-8"));
const mats = { a: { w: 1920, h: 1275, focus: { x: 0.5, y: 0.5 } }, b: { w: 1321, h: 1174, focus: { x: 0.5, y: 0.5 } } };
const shotOf = (move, from, to, ids = ["a"], treatment = "full-bleed") => ({
  id: "b0s0", duration_s: 3, camera: { move, from, to, motivation: "test motivation" },
  materials: ids.map((id) => ({ id, kind: "photo", must_show: "xxxxxx", why: "xxxxxx", search: ["x"], treatment })), action: "something happens",
});

test("each beat's shots exactly fill the beat, in order, with no gaps", () => {
  const s = scheduleShots(direction, 30, 1032);
  for (let i = 1; i < s.length; i++) assert.equal(s[i].from, s[i - 1].from + s[i - 1].dur, `gap before ${s[i].shot.id}`);
  assert.equal(s[0].from, 0);
  assert.equal(s.at(-1).from + s.at(-1).dur, 1032);
  const b1 = s.filter((x) => x.beatIndex === 1);
  assert.equal(b1[0].from, Math.round(4.5 * 30));
  assert.equal(b1.at(-1).from + b1.at(-1).dur, Math.round(10 * 30));
});

test("framing words resolve to concrete zoom levels", () => {
  assert.ok(parseFraming("extreme close on the cut edge").zoom > parseFraming("close on the edge").zoom);
  assert.ok(parseFraming("close on the edge").zoom > parseFraming("wide on the whole cloth").zoom);
  assert.ok(parseFraming("very wide, on the ground").zoom < 1);
  assert.equal(parseFraming("close on the left one").fx, 0.28);
});

test("a close framing stays inside the material (no sliver of ground)", () => {
  const r = { x: 0, y: 0, w: 2891, h: 1920 };
  const c = framingToCamera("extreme close on the right edge", r, { x: 0.95, y: 0.5 });
  assert.ok(c.cx + c.w / 2 <= r.w + 1e-6 && c.cx - c.w / 2 >= -1e-6);
  const h = c.w * FH / FW;
  assert.ok(c.cy - h / 2 >= -1e-6 && c.cy + h / 2 <= r.h + 1e-6);
});

test("push-in and pull-out change the framing by at least 1.7x even when from/to say the same thing", () => {
  for (const move of ["push-in", "pull-out"]) {
    const shot = shotOf(move, "medium on it", "medium on it");
    const w = layoutWorld(shot, "reveal", mats);
    const c = resolveCamera(shot, "reveal", w, mats);
    const ratio = Math.max(c.a.w, c.b.w) / Math.min(c.a.w, c.b.w);
    assert.ok(ratio >= 1.69, `${move} ratio ${ratio}`);
    if (move === "push-in") assert.ok(c.b.w < c.a.w); else assert.ok(c.b.w > c.a.w);
  }
});

test("pan travels at least 45% of the frame width", () => {
  const shot = shotOf("pan", "close on the tunnel", "close on the tunnel");
  const w = layoutWorld(shot, "flow", mats);
  const c = resolveCamera(shot, "flow", w, mats);
  assert.ok(Math.abs(c.b.cx - c.a.cx) >= c.a.w * 0.45, `pan ${Math.abs(c.b.cx - c.a.cx)} vs ${c.a.w}`);
});

test("comparison lays two materials side by side and reframes from A to both", () => {
  const shot = shotOf("reframe", "close on the left one", "both side by side", ["a", "b"]);
  const w = layoutWorld(shot, "comparative-transformation", mats);
  assert.ok(w.rects.b.y > w.rects.a.y + w.rects.a.h, "B is stacked below A (portrait frame)");
  const c = resolveCamera(shot, "comparative-transformation", w, mats);
  assert.ok(c.b.w > c.a.w * 1.5, "the end framing holds both");
  const sa = toScreen(w.rects.a, c.b), sb = toScreen(w.rects.b, c.b);
  assert.ok(sa.y > -5 && sb.y + sb.h < FH + 5 && sa.x > -5 && sa.x + sa.w < FW + 5, "both on screen at the end");
  assert.ok(sa.w > FW * 0.6, `each print is still big on a phone (${sa.w.toFixed(0)} px)`);
});

test("text goes to the slot away from the subject", () => {
  assert.equal(textSlotFor({ x: 540, y: 400 }), "low");
  assert.equal(textSlotFor({ x: 540, y: 1300 }), "top");
  assert.ok(TEXT_SLOTS.low.y + TEXT_SLOTS.low.h < 1390, "the low slot stays above the caption band");
});

test("mechanisms move the materials: separation splits, erosion eats, accumulation stacks", () => {
  const rects = { a: { x: 0, y: 0, w: 1000, h: 1000 }, b: { x: 1200, y: 0, w: 1000, h: 1000 } };
  const f = () => ({ x: 0.5, y: 0.5 });
  const sep = mechanismPieces("separation", 0.9, ["a"], rects, f).pieces.a;
  assert.equal(sep.length, 2);
  assert.ok(sep[1].dx - sep[0].dx > 200, "halves pulled apart");
  assert.match(mechanismPieces("erosion", 0.8, ["a"], rects, f).pieces.a[0].clip, /^polygon/);
  const acc0 = mechanismPieces("accumulation", 0.05, ["a"], rects, f).pieces.a.length;
  const acc1 = mechanismPieces("accumulation", 0.95, ["a"], rects, f).pieces.a.length;
  assert.ok(acc1 > acc0 + 3, `stack grows ${acc0} -> ${acc1}`);
  const sub = mechanismPieces("substitution", 0.95, ["a", "b"], rects, f).pieces.b[0].clip;
  assert.match(sub, /inset\(0 0\.00% 0 0\)/, "B fully replaces A by the end, behind a hard edge");
});

test("sfx cues map to committed files or stay unmapped", () => {
  assert.ok(mapSfx("heavy thud").file);
  assert.equal(mapSfx("paper slide"), null);
});

test("render entry refuses an unverified material in production, accepts it in proof mode", () => {
  const out = mkdtempSync(join(tmpdir(), "vd-shots-"));
  const entry = join(HERE, "..", "visual-director", "render-direction.mjs");
  const prod = spawnSync(process.execPath, [entry, "--direction", FIX, "--out", join(out, "p.mp4"), "--frames-only"], { encoding: "utf-8" });
  assert.equal(prod.status, 2, prod.stderr);
  const proof = spawnSync(process.execPath, [entry, "--direction", FIX, "--out", join(out, "q.mp4"), "--frames-only", "--proof"], { encoding: "utf-8" });
  assert.equal(proof.status, 0, proof.stderr);
  const props = JSON.parse(readFileSync(join(out, "q.props.json"), "utf-8"));
  assert.equal(props.materials.sulfur.status, "unverified");
  assert.match(props.channel.palette.accent, /^#/);
});
