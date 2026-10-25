/**
 * clone-motion — how the clone family MOVES (owner, 2026-10-17: "it shouldn't look playful. It should look like morphing graphics"). Pure functions,
 * no React, so scripts/__tests__/clone-motion.test.js walks them frame by frame: every curve arrives and stops (no spring, bounce or overshoot), nothing
 * ramps opacity, the accent shape is one object that morphs across the cuts inside a sentence, and a new sentence is a hard cut. Drawn by CloneVideo.jsx.
 */
import { treatmentBoxes } from "./clone-layout.js";

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 4);                                     // quart: quick start, long settle, never past 1
export const easeInOut = (x) => { const t = clamp01(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };   // cubic
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, delay, dur, ease = easeOut) => ease((t - delay) / dur);
// Timings MEASURED frame by frame on the reference videos (research/, 2026-10-18), not chosen: a word rises in 3-5 frames; a key word is revealed letter by
// letter left to right at ~1.5-2 frames a letter ("A / AF / AFT / AFTE / AFTER", "GREATEST VILLAIN", "ALANDO"); a long phrase still lands within ~0.6 s.
export const MORPH_F = 10, RISE_F = 5, LETTER_F = 1.5, LETTER_RISE_F = 4, LETTERS_MAX_F = 18;

// The frame letter k (0-based, counted across the phrase's lines) starts rising, for a phrase of n letters: LETTER_F apart, squeezed so the last starts by
// LETTERS_MAX_F — or sooner when the shot has less room left (`room` = frames from the phrase's arrival to the cut), so the phrase is whole before the cut
// (a three-line phrase was cut off mid-word: ch-44 shot 70-107, "DETAI"). Pure, so the test can check the order and the bounds.
export const letterSpan = (room = Infinity) => Math.max(0, Math.min(LETTERS_MAX_F, room - LETTER_RISE_F - 2));
export const letterDelay = (k, n, room) => k * Math.min(LETTER_F, n > 1 ? letterSpan(room) / (n - 1) : LETTER_F);
// How far letter k has risen at t frames after the phrase arrived: 0 hidden under its mask, 1 in place. Arrives and stops (easeOut), never past 1.
export const letterAt = (t, k, n, room) => prog(t, letterDelay(k, n, room), LETTER_RISE_F);

// The accent shape of a shot at rest: its box, its rotation, its colour, its layer, and the frame it arrives. A narration (kicker) shot draws its rule
// INSIDE its own text column (Card) — at the layout's fixed y it struck through the centred words (board 38976972038 ch-6) — so it has none here.
export function shapeOf(shot, idx) {
  if (!shot || !shot.shape || (shot.kicker && shot.shape === "rule")) return null;
  const b = (treatmentBoxes(shot.treatment, idx).shape || {})[shot.shape];
  if (!b) return null;
  const el = shot.elements.find((e) => e.kind === "shape");
  return { kind: shot.shape, x: b.x, y: b.y, w: b.w, h: shot.shape === "rule" ? 10 : b.h, rot: shot.shape === "stripe" ? -6 : 0, z: shot.shape === "block" ? 0 : 3, at: el ? el.at : shot.f0 };
}
export const lerpRect = (a, b, t) => ({ ...b, x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t), rot: lerp(a.rot || 0, b.rot || 0, t) });

/**
 * Where the ONE accent shape is on this frame (CloneVideo.jsx, MOTION). Pure, so the test can walk a plan frame by frame: { shape: rect | null }.
 *
 * A NEW SENTENCE IS A HARD CUT. Every reference video changes scene with a straight cut on the spoken word — none uses a full-frame colour wipe, crossfade or
 * panel (studied frame by frame, 2026-10-18). A full-frame accent panel wipe was built here on 2026-10-17 and removed: it covered the frame in solid accent for
 * ~4 frames at every sentence, which no reference does. So the shape never carries over a sentence change; the new one draws out from its own edge.
 */
export function motionAt(shots, i, frame) {
  const shot = shots[i], cur = shapeOf(shot, i);
  const newBeat = i > 0 && shot.beat !== shots[i - 1].beat;
  // A BLOCK is the card's second sheet behind the picture: it belongs to its picture, so it never travels to (or from) a bar — it is cut with its shot.
  const prevRaw = i > 0 && !newBeat ? shapeOf(shots[i - 1], i - 1) : null;
  const prev = prevRaw && (prevRaw.kind === "block") === (!!cur && cur.kind === "block") ? prevRaw : prevRaw && !cur && prevRaw.kind !== "block" ? prevRaw : null;
  if (cur) {
    if (frame >= cur.at + MORPH_F) return { shape: cur };
    if (frame >= cur.at) {
      // SHAPE MORPH (within a sentence): from where the previous shot left it, or drawn out from its own leading edge
      const from = prev ? { ...prev, kind: cur.kind } : { ...cur, w: 0, h: cur.kind === "pull" ? 0 : cur.h };
      return { shape: lerpRect(from, cur, easeInOut((frame - cur.at) / MORPH_F)) };
    }
    return { shape: prev };   // until it moves, the previous shot's shape holds where it was
  }
  if (prev && frame < shot.f0 + MORPH_F) return { shape: lerpRect(prev, { ...prev, w: 0 }, easeInOut((frame - shot.f0) / MORPH_F)) };   // retracts
  return { shape: null };
}
