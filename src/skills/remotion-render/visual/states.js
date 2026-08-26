/**
 * Visual states — deterministic timing (PART 11 / PART 24).
 *
 * PURE module.
 *
 *   VISUAL PLAN + real SRT beat window  ->  [ states.js ]  ->  timed states
 *
 * THE DIVISION OF LABOUR THIS FILE ENFORCES
 *
 *   the writer / director decides   WHAT should happen
 *   this file decides               WHEN it happens
 *   the scene component decides     HOW it looks
 *
 * No model is ever asked for a frame number, an interpolation, or a
 * duration. Strategies declare states as relative weights
 * (strategies.js); this normalizes them across whatever real window the
 * beat actually occupies, so the same concept plays correctly whether the
 * narrator spent 2s or 14s on it.
 *
 * ANCHOR SYNC
 *
 * Exactly one state per strategy is `anchored`. That state is pinned to the
 * beat's anchorFrame — the frame where the key word is genuinely spoken,
 * derived from real per-word SRT timing upstream. The states before it are
 * compressed or stretched to land there, and the ones after divide the
 * remainder. That is why the "150 METERS" label resolves exactly as the
 * narrator says it, rather than at a proportional guess.
 *
 * DENSIFICATION (PART 12)
 *
 * beats.js used to DISCARD an authored beat whose window exceeded 8s and
 * fall back to the fragment classifier for that whole section — the writer's
 * idea was thrown away precisely when it was most developed. Instead, a long
 * window now gets MORE STATES OF THE SAME CONCEPT: the state list is
 * repeated in a "second pass" of sustaining beats (re-emphasis, reframe)
 * rather than cut to a different scene. One concept, more visual progression
 * — never six unrelated scenes.
 */

import { getStrategy } from "./strategies.js";

export const FPS = 30;

/** Above this, a single state would sit visually still too long. */
export const MAX_STATE_FRAMES = Math.round(3.2 * FPS);

/** A state shorter than this can't be read; neighbours absorb it. */
export const MIN_STATE_FRAMES = 8;

/**
 * Sustaining states appended when a concept has more time than its base
 * timeline needs. These re-read the SAME concept — they never introduce a
 * different subject.
 */
const SUSTAIN_CYCLE = [
  { key: "reframe", action: "camera reframes the whole relationship", weight: 1.6 },
  { key: "detail", action: "a supporting detail of the same concept resolves", weight: 1.4 },
  { key: "settle", action: "the composition settles, emphasis held", weight: 1.5 },
];

/**
 * Build timed states for one beat.
 *
 * window: { startFrame, durationInFrames, anchorFrame }  (absolute frames)
 * returns states with LOCAL frame offsets (0 = beat start), which is what
 * the scene components see inside their own <Sequence>.
 */
export function buildStates(plan, window, opts = {}) {
  const fps = opts.fps || FPS;
  const def = getStrategy(plan && plan.strategy);
  const total = Math.max(1, Math.round(window.durationInFrames || 0));
  if (!def) return [];

  const spec = def.states.map((s) => ({ ...s }));

  const anchorIdx = Math.max(spec.findIndex((s) => s.anchored), 0);
  const localAnchor = clamp(
    Math.round((window.anchorFrame ?? window.startFrame) - window.startFrame),
    0,
    Math.max(total - 1, 0)
  );

  // Split at the anchored state so it STARTS exactly on the anchor frame.
  const before = spec.slice(0, anchorIdx);
  const fromAnchor = spec.slice(anchorIdx);

  // ── densify PER SEGMENT, not just overall ──────────────────────────────
  //
  // Densifying only on total duration was not enough, and a real render
  // proved it: a beat whose anchor token falls late leaves a large
  // pre-anchor budget split between few states, so one of them held for
  // 9.4s while the whole beat was "only" 10s and never tripped a
  // total-duration check. Each side of the anchor now gets sustaining
  // states until its own per-state share is readable, which is what
  // actually removes the stall.
  densify(before, localAnchor, "pre");
  densify(fromAnchor, Math.max(total - localAnchor, 1), "post");

  const beforeFrames = distribute(before, localAnchor);
  const afterFrames = distribute(fromAnchor, Math.max(total - localAnchor, fromAnchor.length));

  const timed = [];
  let cursor = 0;
  before.forEach((s, i) => {
    timed.push(makeState(s, cursor, beforeFrames[i]));
    cursor += beforeFrames[i];
  });
  cursor = localAnchor;
  fromAnchor.forEach((s, i) => {
    timed.push(makeState(s, cursor, afterFrames[i]));
    cursor += afterFrames[i];
  });

  // Absorb unreadably-short states into their neighbour rather than
  // rendering a flicker.
  const merged = [];
  for (const st of timed) {
    const prev = merged[merged.length - 1];
    if (prev && st.durationInFrames < MIN_STATE_FRAMES) {
      prev.durationInFrames += st.durationInFrames;
      prev.endFrame = prev.startFrame + prev.durationInFrames;
      continue;
    }
    merged.push(st);
  }

  // Clamp the tail to the real window — the SRT is the authority, always.
  if (merged.length) {
    const last = merged[merged.length - 1];
    last.endFrame = total;
    last.durationInFrames = Math.max(total - last.startFrame, 1);
  }

  return merged.map((s, i) => ({
    ...s,
    index: i,
    count: merged.length,
    progressAt: (frame) => clamp((frame - s.startFrame) / Math.max(s.durationInFrames, 1), 0, 1),
  }));
}

/**
 * Append sustaining states to ONE segment until its per-state share is
 * readable. Mutates `segment` in place.
 *
 * Sustaining states re-read the same concept (reframe / detail / settle) —
 * they never introduce a different subject, which is the line PART 12 draws
 * between "one concept, more visual states" and "six unrelated scenes".
 */
function densify(segment, budget, tag) {
  if (segment.length === 0 || budget <= 0) return;
  // Test against the HEAVIEST state's projected duration, not the average.
  // Averaging looked right and wasn't: state weights are deliberately
  // uneven (an `expand` is worth more screen time than an `origin`), so a
  // segment could sit comfortably under the average cap while its heaviest
  // state ran 107 frames — a 3.6s hold the average never saw.
  const heaviest = () => {
    const total = segment.reduce((a, s) => a + (s.weight || 1), 0) || 1;
    const max = Math.max(...segment.map((s) => s.weight || 1));
    return (max / total) * budget;
  };
  let guard = 0;
  while (heaviest() > MAX_STATE_FRAMES && guard < 20) {
    const cycle = SUSTAIN_CYCLE[guard % SUSTAIN_CYCLE.length];
    segment.push({
      ...cycle,
      key: `${cycle.key}_${tag}${guard + 1}`,
      anchored: false,
      sustaining: true,
    });
    guard += 1;
  }
}

function makeState(spec, startFrame, durationInFrames) {
  return {
    key: spec.key,
    action: spec.action,
    anchored: !!spec.anchored,
    sustaining: !!spec.sustaining,
    startFrame,
    durationInFrames: Math.max(durationInFrames, 1),
    endFrame: startFrame + Math.max(durationInFrames, 1),
  };
}

/** Integer frame split proportional to weight, summing exactly to budget. */
function distribute(specs, budget) {
  if (specs.length === 0) return [];
  const totalWeight = specs.reduce((a, s) => a + (s.weight || 1), 0) || 1;
  const raw = specs.map((s) => ((s.weight || 1) / totalWeight) * budget);
  const floored = raw.map((v) => Math.max(Math.floor(v), 1));
  let remainder = budget - floored.reduce((a, b) => a + b, 0);
  // Hand out the rounding remainder to the heaviest states first.
  const order = specs
    .map((s, i) => ({ i, w: s.weight || 1 }))
    .sort((a, b) => b.w - a.w)
    .map((o) => o.i);
  let k = 0;
  while (remainder > 0 && order.length) {
    floored[order[k % order.length]] += 1;
    remainder -= 1;
    k += 1;
  }
  while (remainder < 0) {
    // Budget smaller than the 1-frame floor per state: shrink the largest.
    const idx = floored.indexOf(Math.max(...floored));
    if (floored[idx] <= 1) break;
    floored[idx] -= 1;
    remainder += 1;
  }
  return floored;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Which state is on screen at a local frame, plus eased progress through
 * it. Scenes call this instead of doing their own frame arithmetic, so
 * every scene shares one definition of "where are we in this concept".
 */
export function stateAt(states, frame) {
  if (!states || states.length === 0) return null;
  for (const s of states) {
    if (frame < s.endFrame) return s;
  }
  return states[states.length - 1];
}

/** Has the named state begun by this frame? */
export function reached(states, key, frame) {
  const s = (states || []).find((x) => x.key === key);
  return s ? frame >= s.startFrame : false;
}

/** 0..1 progress through the named state (0 before it, 1 after). */
export function progressOf(states, key, frame) {
  const s = (states || []).find((x) => x.key === key);
  if (!s) return 0;
  return clamp((frame - s.startFrame) / Math.max(s.durationInFrames, 1), 0, 1);
}

/**
 * Longest stretch with no state change, in frames — the raw signal behind
 * the "static visual > 5s" warning in the render report (PART 20).
 */
export function longestStaticRun(states) {
  if (!states || !states.length) return 0;
  return states.reduce((max, s) => Math.max(max, s.durationInFrames), 0);
}
