/**
 * Paper-style layout — every position MEASURED from the reference video
 * (docs/REFERENCE-STYLE.md, data/reference/style.mp4 at 576x1024, scaled
 * x1.875 to the 1080x1920 canvas). Pure .js so node-side audits can read it.
 * The camera is static in the reference: none of these ever move.
 */
export const CANVAS = { w: 1080, h: 1920 };

// Paper: size measured (x 148-428, 280x494 at 576x1024). Its y is NOT the
// reference's: with the timeline device removed (owner's correction) the
// paper is centred in the 9:16 canvas with equal top/bottom margins
// ((1920 - 926) / 2 = 497).
export const PAPER = { x: 278, y: 497, w: 524, h: 926 };
// Branding rail "MY EDIT": x 114-138, y 293-444 — left of the paper,
// rotated 90deg counter-clockwise (reads bottom to top). Vertically centred
// on the (centred) paper: 497 + (926 - 284) / 2 = 818.
export const RAIL = { x: 214, y: 818, w: 45, h: 284 };

export const INK = "#0A0A0A";           // text / shapes
export const INK_SOFT = "#9A9A9A";      // not-yet-typed words, light words
export const PAPER_FILL = "#FFFFFF";
export const PAPER_EDGE_SHADOW = "#A4A4A5";
export const STUDIO_BG = "#FFFFFF";

// Average reference beat ≈ 2.5 s (16 beats in 39.6 s).
export const REFERENCE_BEAT_SEC = 2.5;

// Deterministic small hash (FNV-1a) for per-beat choices.
export function hash32(s) {
  let h = 0x811c9dc5;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
