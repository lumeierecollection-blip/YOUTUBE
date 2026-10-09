// A hero object must be legible on its beat's ground (scripts/ground-legal.mjs) — ch-2's dark green
// Flock logo on #101010, board 37901614633.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { legaliseGrounds, legibility, inkLumas, contrast, luma } from "../ground-legal.mjs";

async function logo(dir, name, rgb) {
  // A 100x40 mark of one colour on a transparent 200x100 canvas.
  await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: 100, height: 40, channels: 4, background: { ...rgb, alpha: 1 } } }, left: 50, top: 30 }]).png().toFile(join(dir, name));
  return name;
}
const beat = (index, asset, ground_color = null) => ({ index, canvas: { ground_color, concept_visuals: [{ name: asset, class: "cutout", asset }] } });

test("contrast and luma are WCAG's", () => {
  assert.ok(Math.abs(contrast(luma(255, 255, 255), luma(0, 0, 0)) - 21) < 0.01);
  assert.ok(contrast(luma(0x1d, 0x4d, 0x3b), luma(0x10, 0x10, 0x10)) < 2.5, "dark green on near-black is illegible");
});

test("a dark logo on a near-black ground goes to white; the planner's other beats are untouched", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gl-"));
  const flock = await logo(dir, "flock.png", { r: 0x1d, g: 0x4d, b: 0x3b });
  const beats = [beat(0, flock, null), beat(1, flock, "#101010"), { index: 2, canvas: { ground_color: "#101010", concept_visuals: [] } }];
  const r = await legaliseGrounds(beats, dir, { join, existsSync });
  assert.deepEqual(r.changed.map((c) => [c.beat, c.was, c.now]), [[1, "#101010", "white"]]);
  assert.equal(beats[1].canvas.ground_color, null);
  assert.equal(beats[2].canvas.ground_color, "#101010");
});

test("a light logo on white goes to a dark ground the video already uses; none to use -> left alone and reported", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gl-"));
  const white = await logo(dir, "white.png", { r: 250, g: 250, b: 250 });
  const used = [beat(0, white, null), { index: 1, canvas: { ground_color: "#241C18", concept_visuals: [] } }];
  const r = await legaliseGrounds(used, dir, { join, existsSync });
  assert.equal(used[0].canvas.ground_color, "#241C18");
  assert.equal(r.changed.length, 1);
  const alone = [beat(0, white, null)];
  const r2 = await legaliseGrounds(alone, dir, { join, existsSync });
  assert.equal(alone[0].canvas.ground_color, null, "no dark ground in the video: not invented");
  assert.equal(r2.stuck.length, 1);
});

test("a legible object keeps the planner's ground", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gl-"));
  const red = await logo(dir, "red.png", { r: 200, g: 30, b: 30 });
  const b = [beat(0, red, "#101010")];
  assert.ok(legibility(await inkLumas(join(dir, red)), "#101010") >= 0.6);
  const r = await legaliseGrounds(b, dir, { join, existsSync });
  assert.equal(r.changed.length, 0);
  assert.equal(b[0].canvas.ground_color, "#101010");
});
