/**
 * Shared bits for the on-paper data-viz primitives (counter, bar, pie,
 * line, gauge). Colours are the paper's own: ink and a mid-grey — the
 * reference paper carries no accent colour.
 */
import { Easing } from "remotion";

export const INK = "#0A0A0A";
export const MID = "#9A9A9A";
export const LIGHT = "#D9D9D9";
export const SERIF = "'Playfair Display', Georgia, serif";
export const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
// Progress of a build that runs over the first `share` of the beat.
export const buildT = (local, dur, share, delayFrames = 0) =>
  easeOut(clamp01((local - delayFrames) / Math.max(1, dur * share)));
