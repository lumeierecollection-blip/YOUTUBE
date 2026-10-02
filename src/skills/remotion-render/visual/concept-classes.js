/**
 * How each concept is shown (owner's rules 2026-09-30 / 2026-10-02):
 *
 *   CUTOUT  a real photograph of an object isolated onto a transparent PNG
 *           (public/cutouts/<name>.png, built by scripts/build-cutout-library.mjs
 *           from Pixabay / Unsplash, content-verified, listed in index.json)
 *   SYMBOL  never a cutout, always drawn: a large monochrome shape in the
 *           channel accent (visual/symbols/) — the eight that cannot be
 *           photographed
 *   SCENE   never a cutout: a place or a crowd is a full-bleed photograph
 *           (SCENE-FULL). There is no generic scene-photo source in the
 *           pipeline yet, so a SCENE concept draws nothing on its own — it is
 *           reported, never replaced by a cutout or a drawing.
 */
export const SYMBOLS = Object.freeze(["upward-arrow", "downward-arrow", "warning-triangle", "checkmark", "crosshair", "radar", "broken-chain", "dollar-sign"]);
export const SCENES = Object.freeze(["city-skyline", "factory", "office-tower", "government-building", "group-people"]);

/** "symbol" | "scene" | "cutout" | null — a cutout only when the library holds that name. */
export function classOf(name, cutoutNames = []) {
  if (SYMBOLS.includes(name)) return "symbol";
  if (SCENES.includes(name)) return "scene";
  return cutoutNames.includes(name) ? "cutout" : null;
}
