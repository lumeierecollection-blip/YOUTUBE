import {Easing, interpolate, spring} from 'remotion';

/**
 * Easing vocabulary measured from the source videos. Every curve here was matched
 * against frame-by-frame position plots of a real motion in /sample (see docs/).
 */
export const ease = {
  linear: Easing.linear,
  /** standard UI settle: fast start, long soft landing (most text/card entrances) */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** symmetric camera moves and morphs */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** gentle in-out for long drifts */
  sine: Easing.bezier(0.37, 0, 0.63, 1),
  /** accelerating exits */
  in: Easing.bezier(0.55, 0, 1, 0.45),
  /** small overshoot (pop-ins, stickers, comic bursts) */
  back: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** heavy expo for zoom-throughs */
  expoInOut: Easing.bezier(0.87, 0, 0.13, 1),
  expoOut: Easing.bezier(0.19, 1, 0.22, 1),
};

export type EaseName = keyof typeof ease;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** progress 0..1 between two frames with an easing */
export const prog = (frame: number, start: number, end: number, e: (t: number) => number = ease.out) =>
  // a scene cut shorter than its motion can make end <= start: degrade to a step instead of throwing
  end <= start ? (frame >= start ? 1 : 0) : interpolate(frame, [start, end], [0, 1], {easing: e, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/** map frame range -> value range, clamped */
export const tween = (
  frame: number,
  [f0, f1]: [number, number],
  [v0, v1]: [number, number],
  e: (t: number) => number = ease.out,
) => (f1 <= f0 ? (frame >= f0 ? v1 : v0) : interpolate(frame, [f0, f1], [v0, v1], {easing: e, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** spring presets (damping/stiffness/mass) matched to the bounce seen in the samples */
export const springs = {
  pop: {damping: 11, stiffness: 160, mass: 0.7},
  soft: {damping: 20, stiffness: 90, mass: 1},
  snappy: {damping: 18, stiffness: 260, mass: 0.6},
  wobble: {damping: 7, stiffness: 120, mass: 0.8},
} as const;

export const springAt = (frame: number, fps: number, start: number, cfg: keyof typeof springs = 'pop') =>
  spring({frame: frame - start, fps, config: springs[cfg]});

/** in/hold/out envelope: 0 -> 1 over `inF`, hold, 1 -> 0 over `outF` before `total` */
export const envelope = (frame: number, total: number, inF = 12, outF = 12) =>
  Math.min(prog(frame, 0, inF, ease.out), 1 - prog(frame, total - outF, total, ease.in));

/** squash & stretch scale pair from vertical velocity (video17 principle 01) */
export const squash = (velocity: number, k = 0.012, max = 0.45) => {
  const s = clamp(Math.abs(velocity) * k, 0, max);
  return {sx: 1 - s * 0.5, sy: 1 + s};
};

/** animate "on twos/threes": hold each drawing for `n` frames (video1 12-fps character timing) */
export const onTwos = (frame: number, n = 2) => Math.floor(frame / n) * n;

/** stepped loop phase 0..1 for cycles of `period` frames */
export const phase = (frame: number, period: number, offset = 0) => (((frame + offset) % period) + period) % period / period;
