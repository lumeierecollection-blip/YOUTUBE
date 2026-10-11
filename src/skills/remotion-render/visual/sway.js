// The universal pace layer's motion, shared by the renderer (full-canvas.jsx draws it) and the rendered-frame
// audit (scripts/local-audit.cjs, visual-contrast, measures the framed card where the sway has put it).
// pace-check.mjs fails a beat still for more than 1.0 s. One movement event per beat cannot meet that on any beat
// longer than ~2 s, so every beat sways, whatever its composition: a triangle wave at constant speed (no ease, so no
// still moment at the turn), ±30 px across and ±12 px down on a 6 s cycle, the down-sway a quarter cycle behind.
// Known limit: a beat with almost no edges (a flat ground, one dot) changes too few pixels for the check and can
// still fail. That is a composition problem to fix in the composition, not a reason to change the threshold.
export const SWAY_X = { amp: 30, period: 6, offset: 0 };
export const SWAY_Y = { amp: 12, period: 6, offset: 0.25 };

/** One axis of the sway, in canvas px (1080x1920), `seconds` after the beat starts. */
export function sway(seconds, { amp, period, offset }) {
  const ph = (seconds / period + offset) % 1;
  return ph < 0.5 ? amp * (4 * ph - 1) : amp * (3 - 4 * ph);
}

/** The whole beat's offset at `seconds` after it starts: { x, y } in canvas px. */
export function swayOffset(seconds) {
  return { x: sway(seconds, SWAY_X), y: sway(seconds, SWAY_Y) };
}
