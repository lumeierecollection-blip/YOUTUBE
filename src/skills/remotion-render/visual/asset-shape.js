/**
 * ONE definition of "what asset does this beat actually have", shared by the
 * scene that draws it and the test that guards it.
 *
 * It exists because the two disagreed silently. director.js writes a bare path
 * STRING into `plan.payload.asset` (ctx.asset is the section's resolved b-roll
 * path). ImageEvidenceScene was written for an OBJECT and did
 * `asset.path`, which is `undefined` on a string, so its guard early-returned
 * null and the beat rendered an empty stage. run-visual-tests.js could not see
 * it: its check was `!(plan.payload && plan.payload.asset)`, and a non-empty
 * string is truthy, so the assertion passed on exactly the value that broke the
 * render. Twenty-one of the ch-fixture script's thirty-two beats drew nothing.
 *
 * Both callers now go through here, so a future shape change breaks the test
 * instead of the picture.
 */

/**
 * @returns {{path: string, role?: string, treatment?: string, credit?: string}|null}
 *   null means there is genuinely nothing to draw.
 */
export function resolveSceneAsset(plan, beat) {
  const raw =
    (plan && plan.payload && plan.payload.asset) ||
    (beat && beat.scene && beat.scene.image) ||
    null;
  if (!raw) return null;
  if (typeof raw === "string") return raw.trim() ? { path: raw } : null;
  if (typeof raw === "object" && typeof raw.path === "string" && raw.path.trim()) return raw;
  return null;
}
