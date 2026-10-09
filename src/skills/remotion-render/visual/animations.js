/**
 * The animation vocabulary (animation rebuild, Fix 2) — pure JS, no React and
 * no Remotion, so the planner (animation-plan.js), the renderer
 * (full-canvas.jsx) and the tests all read the same table and the same
 * evaluators.
 *
 * 41 named animations, each with the ELEMENT it animates and the FAMILY it
 * belongs to (a family is a way of moving, not a name: MASK_SWEEP and
 * SPLIT_REVEAL are both "mask"). The planner's rules run on families:
 *
 *   text entrances (15)  TYPE_IN MASK_SWEEP SLIDE_FROM_L SLIDE_FROM_R DROP_IN
 *                        RISE_FROM_BASE SCALE_UP SCALE_PUNCH FADE_LIFT BLUR_IN
 *                        LETTER_STAGGER WORD_STAGGER SPLIT_REVEAL WHIP_IN CUT_IN
 *   exits (6)            FADE_OUT SLIDE_OUT_L SLIDE_OUT_R SCALE_DOWN MASK_CLOSE CUT_OUT
 *   bar (7)              BAR_GROW BAR_DROP BAR_SPLIT BAR_STACK BAR_PULSE BAR_WAVE BAR_COMPARE
 *   pie (4)              PIE_SWEEP PIE_POP PIE_ROTATE PIE_FROM_TOP
 *   line (3)             LINE_DRAW LINE_DROP LINE_DOT_FIRST
 *   number (6)           COUNT_UP COUNT_DOWN ROLL_DIGIT FLIP_CARD SNAP_IN SCALE_IMPACT
 *
 * The animations the renderer already had are kept, never removed: BAR_GROW,
 * PIE_SWEEP, LINE_DRAW and COUNT_UP are the existing chart / number motions
 * under their names; MASK_SWEEP is the "mask-reveal" headline and SLIDE_FROM_L
 * / SLIDE_FROM_R the successors of "slide-land"; the rest of the old headline
 * set (crop-open, the major beat's flying words) stays as CROP_OPEN and
 * WORD_FLY, which the planner may still choose (LEGACY below).
 *
 * The evaluators return numbers (opacity, offsets, scale, blur, reveal
 * fractions); the renderer turns them into styles. They take the animation's
 * own progress p in [0, 1] and never see a frame number, so a beat's motion is
 * the same at any fps.
 */

// ── the table ─────────────────────────────────────────────────────────
const A = (id, element, family, kind, dur) => Object.freeze({ id, element, family, kind, dur });

export const TEXT_ENTRANCES = Object.freeze([
  A("TYPE_IN", "text", "stagger", "in", 0.7),
  A("MASK_SWEEP", "text", "mask", "in", 0.5),
  A("SLIDE_FROM_L", "text", "slide", "in", 0.45),
  A("SLIDE_FROM_R", "text", "slide", "in", 0.45),
  A("DROP_IN", "text", "drop", "in", 0.55),
  A("RISE_FROM_BASE", "text", "drop", "in", 0.5),
  A("SCALE_UP", "text", "scale", "in", 0.45),
  A("SCALE_PUNCH", "text", "scale", "in", 0.4),
  A("FADE_LIFT", "text", "fade", "in", 0.5),
  A("BLUR_IN", "text", "fade", "in", 0.55),
  A("LETTER_STAGGER", "text", "stagger", "in", 0.3),
  A("WORD_STAGGER", "text", "stagger", "in", 0.4),
  A("SPLIT_REVEAL", "text", "mask", "in", 0.55),
  A("WHIP_IN", "text", "slide", "in", 0.25),
  A("CUT_IN", "text", "cut", "in", 0),
]);
export const EXITS = Object.freeze([
  A("FADE_OUT", "text", "fade", "out", 0.3),
  A("SLIDE_OUT_L", "text", "slide", "out", 0.3),
  A("SLIDE_OUT_R", "text", "slide", "out", 0.3),
  A("SCALE_DOWN", "text", "scale", "out", 0.3),
  A("MASK_CLOSE", "text", "mask", "out", 0.3),
  A("CUT_OUT", "text", "cut", "out", 0),
]);
export const BAR = Object.freeze([
  A("BAR_GROW", "bar", "bar-grow", "in", 0.9),
  A("BAR_DROP", "bar", "bar-drop", "in", 0.9),
  A("BAR_SPLIT", "bar", "bar-split", "in", 0.9),
  A("BAR_STACK", "bar", "bar-stack", "in", 1.2),
  A("BAR_PULSE", "bar", "bar-pulse", "in", 0.9),
  A("BAR_WAVE", "bar", "bar-wave", "in", 1.1),
  A("BAR_COMPARE", "bar", "bar-compare", "in", 1.2),
]);
export const PIE = Object.freeze([
  A("PIE_SWEEP", "pie", "pie-sweep", "in", 1),
  A("PIE_POP", "pie", "pie-pop", "in", 1),
  A("PIE_ROTATE", "pie", "pie-rotate", "in", 1),
  A("PIE_FROM_TOP", "pie", "pie-top", "in", 1.1),
]);
export const LINE = Object.freeze([
  A("LINE_DRAW", "line", "line-draw", "in", 1),
  A("LINE_DROP", "line", "line-drop", "in", 1.1),
  A("LINE_DOT_FIRST", "line", "line-dots", "in", 1.1),
]);
export const NUMBER = Object.freeze([
  A("COUNT_UP", "number", "count", "in", 1.4),
  A("COUNT_DOWN", "number", "count", "in", 1.4),
  A("ROLL_DIGIT", "number", "roll", "in", 1),
  A("FLIP_CARD", "number", "flip", "in", 0.6),
  A("SNAP_IN", "number", "snap", "in", 0.15),
  A("SCALE_IMPACT", "number", "impact", "in", 0.5),
]);
// Kept from before the rebuild (not part of the 41): the crop-open headline,
// the major beat's flying words, the old slide-land, the emphasis word's pulse.
export const LEGACY = Object.freeze([
  A("CROP_OPEN", "text", "crop", "in", 0.6),
  A("WORD_FLY", "text", "fly", "in", 0.9),
  A("SLIDE_LAND", "text", "slide", "in", 0.45),
  A("EMPHASIS_SCALE", "text", "emphasis", "in", 1.1),
]);

export const ANIMATIONS = Object.freeze([...TEXT_ENTRANCES, ...EXITS, ...BAR, ...PIE, ...LINE, ...NUMBER, ...LEGACY]);
export const NAMED_COUNT = TEXT_ENTRANCES.length + EXITS.length + BAR.length + PIE.length + LINE.length + NUMBER.length;
const BY_ID = new Map(ANIMATIONS.map((a) => [a.id, a]));
export const animationById = (id) => BY_ID.get(id) || null;
export const familyOf = (id) => BY_ID.get(id)?.family || null;
export const isAnimation = (id) => BY_ID.has(id);

// ── easing (pure) ─────────────────────────────────────────────────────
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
export const lerp = (a, b, t) => a + (b - a) * t;
/** cubic-bezier(x1, y1, x2, y2) as a function of progress (Newton + bisection, as CSS does). */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    x = clamp01(x);
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) { const v = X(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return Y(t);
  };
}
export const easeOut = bezier(0.16, 1, 0.3, 1);
export const easeInOut = bezier(0.65, 0, 0.35, 1);
export const easeIn = bezier(0.5, 0, 0.9, 0.4);
/** Overshoots (~10%) then settles. */
export const backOut = (p) => { p = clamp01(p); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
/** A ball dropped on the floor: 1 at the end, with two bounces. */
export function bounceOut(p) {
  p = clamp01(p);
  const n1 = 7.5625, d1 = 2.75;
  if (p < 1 / d1) return n1 * p * p;
  if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75;
  if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375;
  return n1 * (p -= 2.625 / d1) * p + 0.984375;
}
/** Decaying oscillation around 1 that ends exactly on 1. */
export const elasticOut = (p) => { p = clamp01(p); return p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -9 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1; };

// ── text entrances ────────────────────────────────────────────────────
/**
 * The state of a text element (a whole block, a line, a word or a letter) at
 * progress p of its entrance `id`.
 *   o      opacity 0..1           dx, dy   px offsets (+dx right, +dy down)
 *   s      scale                  rot      degrees          blur  px
 *   rx     revealed fraction of its width from the anchored side (1 = all)
 *   ry     revealed fraction from the baseline up (1 = all)
 * `side` is +1 when the text is left-anchored, -1 when right-anchored (motion
 * comes from the anchored side's OPPOSITE for slides, so a right-anchored
 * headline slides in from the right, as "slide-land" always did).
 */
export function entrance(id, p, { side = 1 } = {}) {
  p = clamp01(p);
  const rest = { o: 1, dx: 0, dy: 0, s: 1, rot: 0, blur: 0, rx: 1, ry: 1 };
  if (p >= 1) return rest;
  switch (id) {
    case "CUT_IN": return { ...rest, o: p > 0 ? 1 : 0 };
    case "FADE_LIFT": { const e = easeOut(p); return { ...rest, o: e, dy: 30 * (1 - e) }; }
    case "BLUR_IN": { const e = easeOut(p); return { ...rest, o: e, blur: 26 * (1 - e), s: 1.04 - 0.04 * e }; }
    case "SLIDE_FROM_L": { const e = easeOut(p); return { ...rest, o: clamp01(e * 2), dx: -180 * (1 - e) }; }
    case "SLIDE_FROM_R": { const e = easeOut(p); return { ...rest, o: clamp01(e * 2), dx: 180 * (1 - e) }; }
    case "SLIDE_LAND": { const e = easeOut(p); return { ...rest, o: e, dx: -side * 60 * (1 - e) }; }
    case "WHIP_IN": { const e = bezier(0.05, 0.9, 0.1, 1)(p); return { ...rest, o: clamp01(p * 6), dx: (side > 0 ? -1 : 1) * 900 * (1 - e), blur: 16 * (1 - e), rot: (side > 0 ? -1 : 1) * 2.2 * (1 - e) }; }
    case "DROP_IN": { const e = bounceOut(p); return { ...rest, o: clamp01(p * 5), dy: -240 * (1 - e) }; }
    case "RISE_FROM_BASE": { const e = easeOut(p); return { ...rest, dy: 0, ry: e, o: 1, rise: 1 - e }; }
    case "SCALE_UP": { const e = easeOut(p); return { ...rest, o: clamp01(e * 1.6), s: lerp(0.6, 1, e) }; }
    case "SCALE_PUNCH": { const e = backOut(p); return { ...rest, o: clamp01(p * 6), s: lerp(1.5, 1, e) }; }
    case "MASK_SWEEP": case "SPLIT_REVEAL": case "TYPE_IN": case "LETTER_STAGGER": case "WORD_STAGGER":
      // Revealed by the renderer per line / half / character / word; the whole-block value is the sweep itself.
      return { ...rest, rx: easeInOut(p) };
    case "CROP_OPEN": return { ...rest, ry: easeInOut(p) };
    default: return { ...rest, o: easeOut(p) };
  }
}

/** The exit at progress p (0 = fully shown, 1 = gone). Same fields as entrance(). */
export function exitState(id, p, { side = 1 } = {}) {
  p = clamp01(p);
  const rest = { o: 1, dx: 0, dy: 0, s: 1, rot: 0, blur: 0, rx: 1, ry: 1 };
  if (p <= 0) return rest;
  switch (id) {
    case "FADE_OUT": return { ...rest, o: 1 - easeInOut(p) };
    case "SLIDE_OUT_L": { const e = easeIn(p); return { ...rest, o: 1 - e, dx: -260 * e }; }
    case "SLIDE_OUT_R": { const e = easeIn(p); return { ...rest, o: 1 - e, dx: 260 * e }; }
    case "SCALE_DOWN": { const e = easeInOut(p); return { ...rest, o: 1 - e, s: lerp(1, 0.7, e) }; }
    case "MASK_CLOSE": return { ...rest, rx: 1 - easeInOut(p) };
    case "CUT_OUT": return { ...rest, o: 0 };
    default: return { ...rest, o: 1 - p };
  }
}

/** Stagger offsets (seconds) per unit for the staggered entrances; 0 for the block ones. */
export const STAGGER = Object.freeze({ LETTER_STAGGER: 0.04, WORD_STAGGER: 0.08, TYPE_IN: 0.03 });
/** The unit a staggered entrance runs on ("letter" | "word" | "line" | "block"). */
export function unitOf(id) {
  if (id === "LETTER_STAGGER" || id === "TYPE_IN") return "letter";
  if (id === "WORD_STAGGER") return "word";
  if (id === "MASK_SWEEP" || id === "RISE_FROM_BASE" || id === "SPLIT_REVEAL") return "line";
  return "block";
}
/** Seconds the whole entrance of a text of `n` units takes (units staggered). */
export function entranceSeconds(id, n = 1) {
  const a = BY_ID.get(id);
  if (!a) return 0.5;
  const st = STAGGER[id] || (unitOf(id) === "line" ? 0.07 : 0);
  return a.dur + st * Math.max(0, n - 1);
}

// ── bars ──────────────────────────────────────────────────────────────
/**
 * One bar's state at build progress t (0..1 over the chart's build) and its
 * index i of n bars; `primary` is the index of the tallest.
 *   grow   fraction of the final size (may overshoot for BAR_WAVE)
 *   dy     px above / below its final place (BAR_DROP)
 *   from   "base" (grows from the axis) | "center" (BAR_SPLIT)
 *   pulse  extra scale on top of the landed bar (BAR_PULSE), given the seconds `sec` since landing
 *   ref    0..1, the reference line BAR_COMPARE draws across from the tallest bar
 *   o      opacity
 */
export function barState(id, t, i, n, { primary = 0, sec = 0 } = {}) {
  t = clamp01(t);
  const base = { grow: 1, dy: 0, from: "base", pulse: 1, ref: 0, o: 1 };
  switch (id) {
    case "BAR_DROP": { const p = clamp01((t - i * 0.12) / 0.5); return { ...base, grow: 1, dy: -240 * (1 - easeInOut(p)), o: clamp01(p * 6) }; }   // flat: a short ease-in-out settle, no fall, no bounce
    case "BAR_SPLIT": { const p = clamp01((t - i * 0.08) / 0.6); return { ...base, grow: easeOut(p), from: "center", o: clamp01(p * 8) }; }
    case "BAR_STACK": { const p = clamp01((t - i * 0.28) / 0.4); return { ...base, grow: easeOut(p), dy: 60 * (1 - easeOut(p)), o: clamp01(p * 5) }; }
    case "BAR_PULSE": {
      const p = easeOut(clamp01((t - i * 0.05) / 0.6));
      const landed = t >= 0.95 ? 1 : 0;
      return { ...base, grow: p, pulse: 1 };   // flat: no landed-bar pulse (the beat's ambient settle keeps the frame alive)
    }
    case "BAR_WAVE": { const p = clamp01((t - i * 0.09) / 0.7); return { ...base, grow: easeOut(p), o: clamp01(p * 8) }; }   // flat: grows once, ease-out, no ringing
    case "BAR_COMPARE": {
      // The tallest first; a reference line runs across from its top; the others grow to (and under) it.
      if (i === primary) return { ...base, grow: easeOut(clamp01(t / 0.35)), ref: easeInOut(clamp01((t - 0.35) / 0.2)) };
      const rank = i < primary ? i : i - 1;
      return { ...base, grow: easeOut(clamp01((t - 0.5 - rank * 0.1) / 0.4)), ref: easeInOut(clamp01((t - 0.35) / 0.2)) };
    }
    default: { const p = easeOut(clamp01((t - i * 0.05) / 0.7)); return { ...base, grow: p }; }     // BAR_GROW
  }
}

// ── pies / gauges ─────────────────────────────────────────────────────
/**
 * The ring at build progress t (0..1) and count progress c (0..1, the number's
 * own count):
 *   arc      fraction of the final arc drawn        ringScale  scale of the whole ring
 *   rot      degrees the ring is turned             dy         px above its place
 *   explode  px the value's arc is pushed out along its bisector
 */
export function pieState(id, t, c) {
  t = clamp01(t);
  const base = { arc: c, ringScale: 1, rot: 0, dy: 0, explode: 0, o: 1 };
  switch (id) {
    case "PIE_POP": return { ...base, arc: easeOut(clamp01((t - 0.3) / 0.3)), ringScale: lerp(0.9, 1, easeInOut(clamp01(t / 0.5))), o: clamp01(t * 8), explode: 0 };   // flat: no overshoot, the arc is not pushed out
    case "PIE_ROTATE": return { ...base, arc: easeInOut(clamp01(t / 0.9)), rot: -200 * (1 - easeOut(clamp01(t / 0.9))), o: clamp01(t * 6) };
    case "PIE_FROM_TOP": return { ...base, arc: easeOut(clamp01((t - 0.45) / 0.5)), dy: -160 * (1 - easeInOut(clamp01(t / 0.5))), o: clamp01(t * 6) };
    default: return base;       // PIE_SWEEP: the arc is the number's count
  }
}

// ── lines ─────────────────────────────────────────────────────────────
/**
 * A line chart at build progress t: `draw` = fraction of the polyline drawn,
 * and per point i of n: `dot` 0..1 (scale / opacity) and `dropY` px above its place.
 */
export function lineState(id, t, i, n) {
  t = clamp01(t);
  switch (id) {
    case "LINE_DROP": { const p = clamp01((t - i * 0.16) / 0.3); return { draw: easeInOut(clamp01((t - 0.5) / 0.45)), dot: clamp01(p * 6), dropY: -120 * (1 - easeInOut(p)) }; }
    case "LINE_DOT_FIRST": { const p = clamp01((t - i * 0.12) / 0.2); return { draw: easeInOut(clamp01((t - 0.5) / 0.5)), dot: easeOut(p), dropY: 0 }; }
    default: { const draw = easeOut(t); return { draw, dot: clamp01(draw * (n - 1) - i + 1), dropY: 0 }; }        // LINE_DRAW
  }
}

// ── numbers ───────────────────────────────────────────────────────────
/** The largest number with the same digits as `num` at `dec` decimals: what COUNT_DOWN starts from. */
export function countDownStart(num, dec = 0) {
  const intDigits = Math.max(1, String(Math.floor(Math.abs(num))).length);
  const nines = Number("9".repeat(intDigits) + (dec ? "." + "9".repeat(dec) : ""));
  return Math.max(num, nines);
}
/** The value a counting number shows at count progress c (eased 0..1): COUNT_UP rises from 0, COUNT_DOWN falls from countDownStart. */
export function countValue(id, num, dec, c) {
  c = clamp01(c);
  if (id === "COUNT_DOWN") { const s = countDownStart(num, dec); return s + (num - s) * c; }
  return num * c;
}
/** A number that does not count: its state at progress p of `id` (FLIP_CARD, SNAP_IN, SCALE_IMPACT). */
export function numberState(id, p) {
  p = clamp01(p);
  const rest = { o: 1, s: 1, rotX: 0, dx: 0, dy: 0, blur: 0 };
  if (p >= 1) return rest;
  switch (id) {
    case "FLIP_CARD": { const e = easeOut(p); return { ...rest, o: clamp01(p * 5), rotX: -90 * (1 - e) }; }
    case "SNAP_IN": return { ...rest, o: easeOut(p), s: lerp(0.92, 1, easeOut(p)) };
    case "SCALE_IMPACT": {
      // Slams down from 2.4x, hits at p = 0.35, rings for the rest.
      const hit = clamp01(p / 0.35), after = clamp01((p - 0.35) / 0.65);
      const s = p < 0.35 ? lerp(1.5, 1, easeIn(hit)) : 1;   // flat: lands once, no ringing
      return { ...rest, o: clamp01(p * 10), s, blur: p < 0.35 ? 8 * (1 - hit) : 0, dy: 0 };
    }
    default: return rest;
  }
}
/** ROLL_DIGIT: the odometer strip offset (in digit heights) for a digit slot at progress p; `k` = slot index from the right. */
export function rollOffset(p, k = 0, target = 0) {
  const e = easeOut(clamp01((p - k * 0.08) / 0.75));
  // Scrolls through (10 + target) digits down to the target; 0 at rest.
  return (1 - e) * (10 + target);
}
