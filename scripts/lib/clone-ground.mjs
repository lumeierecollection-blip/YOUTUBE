/**
 * clone-ground — does a CLONE render actually have its profile's ground colour?
 *
 * verify-render's ground check (render-and-qa.js measureGround) is the canvas engine's owner rule: three corners of ONE frame must read the uniform white.
 * A clone render has another ground on purpose (config/clone-grammar.json profile `ground`, a paper or a mist; colour overridable per channel in
 * channels.json), and a clone SHOT often puts a picture or an accent stripe in a corner, so one frame's three corners are the wrong probe: ch-2 read
 * "top-right #A75F5E" (the stripe) on board 38752797116.
 *
 * So for a clone render the question is asked of the whole video: over frames sampled across it, most corner patches must read the profile's ground.
 * Still measured on the real pixels, still fails a white ground, a tinted ground or a missing one; it only stops treating a shape in a corner as a
 * ground that is wrong. The canvas engine keeps its single-frame uniform-white check exactly as it was.
 */
export const GROUND_TOL = 6;          // per RGB channel (h264 rounding, a little wider than the canvas check's 4: paper tones sit between quantisation steps)
export const MIN_FRAME_SHARE = 0.5;   // at least this share of the sampled frames must show the ground in at least 2 of their 3 corners
export const MIN_CORNERS = 2;

const near = (c, want, tol) => c.every((v, i) => Math.abs(v - want[i]) <= tol);

/**
 * @param frames  [[ [r,g,b] top-left, [r,g,b] top-right, [r,g,b] bottom-right ], ...] one row per sampled frame (0-255 means over an 80x80 patch)
 * @param want    [r,g,b] the profile's ground
 * @returns { ok, share, frames, matching, detail }
 */
export function cloneGroundVerdict(frames, want, { tol = GROUND_TOL, minShare = MIN_FRAME_SHARE } = {}) {
  const rows = frames || [];
  const matching = rows.filter((f) => f.filter((c) => near(c, want, tol)).length >= MIN_CORNERS).length;
  const share = rows.length ? matching / rows.length : 0;
  const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
  const detail = `${matching}/${rows.length} sampled frames show the ground ${hex(want)} in at least ${MIN_CORNERS} of 3 corners (need ${Math.round(minShare * 100)}%)`;
  return { ok: rows.length > 0 && share >= minShare, share, frames: rows.length, matching, detail };
}

/** "#RRGGBB" -> [r, g, b]. */
export const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
