/**
 * How each concept of the cutout brief is shown (owner's decision, 2026-09-30 —
 * after the first stock-photo runs showed that some concepts are not objects a
 * camera isolates):
 *
 *   CUTOUT      a real photograph of an object, isolated onto a transparent PNG
 *               (public/cutouts/, built by scripts/build-cutout-library.mjs from
 *               Pixabay and Unsplash) — the 28 names in scripts/cutout-specs.json
 *   SYMBOL      never a cutout, always drawn: a large monochrome shape in the
 *               channel accent, no outline, no shadow (visual/symbols/)
 *   SCENE_FULL  never a cutout: a place or a crowd is a full-bleed photograph with
 *               the text over it (the SCENE-FULL composition)
 *
 * scripts/test-cutout-library.mjs checks the three lists are disjoint and that
 * CUTOUT is exactly the spec file's names.
 */
export const SYMBOLS = Object.freeze(["upward-arrow", "downward-arrow", "warning-triangle", "checkmark", "crosshair", "radar", "broken-chain", "dollar-sign"]);
export const SCENE_FULL = Object.freeze(["city-skyline", "factory", "office-tower", "government-building", "group-people"]);

/** "cutout" | "symbol" | "scene-full" for one concept name of the brief. */
export function classOf(name, cutoutNames = []) {
  if (SYMBOLS.includes(name)) return "symbol";
  if (SCENE_FULL.includes(name)) return "scene-full";
  return cutoutNames.includes(name) ? "cutout" : null;
}
