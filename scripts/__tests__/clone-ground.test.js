// clone-ground: a clone render's ground is judged over the whole video; a corner shape is not a wrong ground, a white or tinted ground is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cloneGroundVerdict, rgbOf } from "../lib/clone-ground.mjs";

const MIST = rgbOf("#E4E4E1"), PAPER = rgbOf("#F3ECDD"), RED = rgbOf("#8B1E1E"), WHITE = [255, 255, 255], PHOTO = [40, 40, 44];
const frame = (a, b, c) => [a, b, c];

test("ch-2 as it was rejected: a stripe in one corner and a photo bleed on some shots still has the ground", () => {
  const frames = [frame(MIST, RED, MIST), frame(MIST, MIST, MIST), frame(PHOTO, PHOTO, PHOTO), frame(MIST, RED, MIST), frame(MIST, MIST, MIST), frame(PHOTO, PHOTO, PHOTO)];
  const v = cloneGroundVerdict(frames, MIST);
  assert.equal(v.ok, true, v.detail);
  assert.equal(v.matching, 4);
});

test("a video drawn on WHITE fails against a paper profile (the check still has teeth)", () => {
  const v = cloneGroundVerdict(Array.from({ length: 8 }, () => frame(WHITE, WHITE, WHITE)), PAPER);
  assert.equal(v.ok, false);
  assert.equal(v.matching, 0);
});

test("a video whose ground is the wrong tint fails", () => {
  const wrong = rgbOf("#DDE6F3");
  assert.equal(cloneGroundVerdict(Array.from({ length: 8 }, () => frame(wrong, wrong, wrong)), PAPER).ok, false);
});

test("a video that is mostly full-bleed picture (under half the frames show the ground) fails", () => {
  const frames = [frame(MIST, MIST, MIST), frame(PHOTO, PHOTO, PHOTO), frame(PHOTO, PHOTO, PHOTO), frame(PHOTO, PHOTO, PHOTO)];
  assert.equal(cloneGroundVerdict(frames, MIST).ok, false);
});

test("a frame needs the ground in at least two corners: one matching corner is not enough", () => {
  const frames = Array.from({ length: 6 }, () => frame(MIST, PHOTO, RED));
  assert.equal(cloneGroundVerdict(frames, MIST).ok, false);
});

test("no frames sampled is a failure, not a pass", () => {
  assert.equal(cloneGroundVerdict([], MIST).ok, false);
});

test("h264 rounding is tolerated (a few levels off)", () => {
  const off = [MIST[0] - 4, MIST[1] + 3, MIST[2] - 5];
  assert.equal(cloneGroundVerdict(Array.from({ length: 5 }, () => frame(off, off, off)), MIST).ok, true);
});
