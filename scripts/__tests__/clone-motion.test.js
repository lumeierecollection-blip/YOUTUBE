// MOTION GRAPHICS, NOT PLAYFUL (owner, 2026-10-17: "it shouldn't look playful. It should look like morphing graphics"), timed as the reference videos are
// (studied frame by frame, 2026-10-18). Walked frame by frame: every curve arrives and stops (no spring, bounce or overshoot), the accent shape is ONE object
// that morphs from shot to shot inside a sentence, a new sentence is a hard cut (no reference uses a full-frame wipe), and a key phrase is revealed letter
// by letter, left to right.
import { test } from "node:test";
import assert from "node:assert/strict";
import { easeOut, easeInOut, motionAt, shapeOf, letterAt, letterDelay, MORPH_F, LETTER_RISE_F, LETTERS_MAX_F } from "../../src/skills/remotion-render/clone/clone-motion.js";

const shot = (beat, f0, f1, treatment, shape, shapeAt = 3) => ({ beat, f0, f1, treatment, shape, elements: shape ? [{ kind: "shape", at: f0 + shapeAt }] : [] });

test("the easings arrive and stop: monotone, 0 -> 1, never past 1", () => {
  for (const [name, e] of [["easeOut", easeOut], ["easeInOut", easeInOut]]) {
    let last = -1;
    for (let k = -10; k <= 250; k++) {
      const v = e(k / 200);
      assert.ok(v >= last - 1e-12, `${name} moves backwards at ${k}`);
      assert.ok(v >= 0 && v <= 1, `${name} leaves [0,1] at ${k}: ${v}`);
      last = v;
    }
    assert.equal(e(0), 0);
    assert.equal(e(1), 1);
  }
});

test("within a sentence the shape holds across the cut, then morphs into its new place — one object, never two", () => {
  const shots = [shot(0, 0, 60, "float", "rule"), shot(0, 60, 120, "edge", "bar")];
  const a = shapeOf(shots[0], 0), b = shapeOf(shots[1], 1);
  // after the cut, before its own entrance: the old rule is still where it was
  assert.deepEqual(motionAt(shots, 1, 61).shape, a);
  // the morph: every frame lies between the two rects, and it lands exactly on the new one
  let lastX = a.x;
  for (let f = 63; f <= 63 + MORPH_F; f++) {
    const m = motionAt(shots, 1, f).shape;
    assert.ok(m, `no shape at ${f}`);
    assert.equal(m.kind, "bar");
    const dir = Math.sign(b.x - a.x);
    assert.ok((m.x - lastX) * dir >= -1e-9, `x reverses at frame ${f}`);
    assert.ok(Math.min(a.w, b.w) - 1e-9 <= m.w && m.w <= Math.max(a.w, b.w) + 1e-9, `width leaves the range at ${f}`);
    lastX = m.x;
  }
  assert.deepEqual(motionAt(shots, 1, 63 + MORPH_F).shape, b);
});

test("a new sentence is a hard cut: no panel on any frame, the old shape is gone at the cut, the new one draws out from its own edge", () => {
  const shots = [shot(0, 0, 60, "float", "bar"), shot(1, 60, 120, "edge", "rule"), shot(1, 120, 180, "float", null)];
  for (let f = 0; f < 180; f++) {
    const i = shots.findIndex((s) => f >= s.f0 && f < s.f1);
    const m = motionAt(shots, i, f);
    assert.deepEqual(Object.keys(m), ["shape"], `frame ${f} draws something besides the one shape`);
    if (m.shape) assert.ok(m.shape.w <= 1080 * 0.9 || m.shape.h <= 1920 * 0.5, `frame ${f}: the shape covers the frame`);
  }
  // the previous sentence's bar does not carry over the cut
  assert.equal(motionAt(shots, 1, 60).shape, null);
  assert.equal(motionAt(shots, 1, 62).shape, null);
  // the new rule draws out from zero width, monotone, and lands on its rest rect
  const to = shapeOf(shots[1], 1);
  let lastW = -1;
  for (let f = 63; f <= 63 + MORPH_F; f++) {
    const m = motionAt(shots, 1, f).shape;
    assert.ok(m.w >= lastW - 1e-9, `the rule shrinks while drawing at ${f}`);
    lastW = m.w;
  }
  assert.deepEqual(motionAt(shots, 1, 63 + MORPH_F).shape, to);
  // the next shot of the same sentence has no shape: the rule retracts, it does not vanish
  const r = motionAt(shots, 2, 121).shape;
  assert.ok(r && r.w < to.w && r.w > 0);
  assert.equal(motionAt(shots, 2, 120 + MORPH_F).shape, null);
});

test("a block (the card's second sheet) is cut with its picture: it never travels to a bar", () => {
  const shots = [shot(0, 0, 60, "framed", "block"), shot(0, 60, 120, "edge", "bar")];
  assert.equal(motionAt(shots, 1, 61).shape, null);
  const m = motionAt(shots, 1, 63 + 2).shape;
  assert.ok(m.w < shapeOf(shots[1], 1).w, "the bar draws out from its own edge");
});

test("a key phrase is revealed letter by letter, left to right, each letter arriving and stopping, the whole phrase within ~0.6 s", () => {
  for (const n of [1, 5, 9, 21, 40]) {
    // left to right: letter k never starts before letter k-1
    for (let k = 1; k < n; k++) assert.ok(letterDelay(k, n) >= letterDelay(k - 1, n), `n=${n}: letter ${k} starts before ${k - 1}`);
    // the last letter starts within LETTERS_MAX_F, so a long phrase still lands with its word
    assert.ok(letterDelay(n - 1, n) <= LETTERS_MAX_F + 1e-9, `n=${n}: the last letter starts at ${letterDelay(n - 1, n)}`);
    for (let k = 0; k < n; k++) {
      let last = -1;
      for (let t = -2; t <= LETTERS_MAX_F + LETTER_RISE_F + 2; t += 0.5) {
        const p = letterAt(t, k, n);
        assert.ok(p >= 0 && p <= 1, `n=${n} letter ${k}: ${p} at t=${t}`);
        assert.ok(p >= last - 1e-12, `n=${n} letter ${k} moves backwards at t=${t}`);
        last = p;
      }
      assert.equal(letterAt(LETTERS_MAX_F + LETTER_RISE_F, k, n), 1, `n=${n}: letter ${k} not in place by the end`);
    }
    // at any moment the letters already shown are a prefix: no later letter is further along than an earlier one
    for (let t = 0; t <= LETTERS_MAX_F + LETTER_RISE_F; t++) for (let k = 1; k < n; k++) assert.ok(letterAt(t, k, n) <= letterAt(t, k - 1, n) + 1e-12);
  }
  // the phrase is whole before the cut: with `room` frames left, its last letter is in place at least 2 frames before the cut
  for (const room of [9, 12, 20, 23, 40]) for (const n of [5, 25, 40]) {
    const done = letterDelay(n - 1, n, room) + LETTER_RISE_F;
    assert.ok(done <= room - 2 + 1e-9, `room ${room}, ${n} letters: whole at ${done}`);
    assert.equal(letterAt(room - 2, n - 1, n, room), 1);
  }
  // the first letter is visible on the phrase's first frames (the reference reveal starts at once)
  assert.ok(letterAt(1, 0, 9) > 0.5);
});
