/**
 * Beat-to-beat transitions — pure, no React (full-canvas.jsx draws them;
 * scripts/test-transitions.mjs tests them).
 *
 * Measured from the reference videos (research/motion-graphics-ref/ref-01, ref-03,
 * research/VID_20261002_003228_944, VID_20261002_003244_575), 2026-10-18: every scene
 * change is a HARD CUT — the ffmpeg scene score spikes on exactly one frame (ref-01
 * 14.73s 0.94, 26.77s 0.98, 46.70s 1.00 ...), no dissolve, no wipe, no shape crossing
 * the frame. The motion is AFTER the cut, inside the new scene:
 *   - the hero PNG cutout flies in from below / bottom-left with motion blur and
 *     settles in ~12 frames (VID_003228 3.0s, VID_003244 8.3s and 33.1s, ref-01 46.7s)
 *   - a full-bleed photo cuts in already filling the frame and settles from a slight
 *     zoom (VID_003228 36.2s)
 *   - text is on screen at the cut and keeps building word by word (ref-01 14.7s)
 *   - the camera never stops: a slow push across the scene
 * The owner rejected two earlier boundaries: the in-place scale crossfade ("morphing",
 * "disappearing") and, on 2026-10-18, swept / pushed / iris / blinds wipes ("look
 * horrible and too much is going on"). Neither is in the references; neither is here.
 *
 *   enterKind(group, boxes)        -> "photo" | "rise" | "cut"
 *   enterState(kind, f, { side })  -> { o, s, tx, ty, blur }   f = frames since arrival
 *   cameraPush(local, dur)         -> scale of the whole scene at this frame
 *
 * Where this stops: the rise moves the WHOLE band that holds the cutout (its name label
 * rides with it); there is no per-object physics, rotation or collage scatter (ref-01
 * 46.7s flies several phones in, rotated — one hero per beat here).
 */
export const W = 1080, H = 1920;
export const ENTER = Object.freeze({
  RISE: 13,          // frames for a cutout to land (refs: 11-15)
  RISE_FROM: 0.42,   // starts this fraction of the frame height below its place
  DIAG: 0.16,        // bottom-left entry: starts this fraction of the width to the left
  ZOOM: 24,          // frames for a full-bleed photo to settle
  ZOOM_FROM: 1.08,
  BLUR_MAX: 28,      // px of motion blur along the travel at the cut, falling with speed
  PUSH: 0.035,       // the camera's push across a beat
});

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const outQuart = (t) => 1 - Math.pow(1 - t, 4);
const outCubic = (t) => 1 - Math.pow(1 - t, 3);
const inOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const HERO_ROLES = new Set(["concept", "portrait"]);

/**
 * How a pop group (pop-groups.js) enters after the cut. boxes: the band's layout boxes
 * as [key, box] pairs (flattenBoxes). A band holding a cutout / portrait rises; the
 * photo zooms; everything else (headline, chart, number, map) is simply there at the
 * cut and builds itself — bars grow, numbers count, words land (their own animation).
 */
export function enterKind(group, boxes = []) {
  if (group.key === "photo") return "photo";
  return boxes.some(([, b]) => b && HERO_ROLES.has(b.role)) ? "rise" : "cut";
}

const HIDDEN = Object.freeze({ o: 0, s: 1, tx: 0, ty: 0, blur: 0 });
const STILL = Object.freeze({ o: 1, s: 1, tx: 0, ty: 0, blur: 0 });

/** side: 0 = straight up from below, -1 = up from the bottom-left. */
export function enterState(kind, f, { side = 0 } = {}) {
  if (f < 0) return HIDDEN;
  if (kind === "cut") return STILL;
  if (kind === "photo") {
    const q = clamp01(f / ENTER.ZOOM);
    return { ...STILL, s: 1 + (ENTER.ZOOM_FROM - 1) * (1 - outCubic(q)) };
  }
  if (kind === "rise") {
    const q = clamp01(f / ENTER.RISE);
    if (q >= 1) return STILL;
    const rest = 1 - outQuart(q);
    return { o: 1, s: 1, tx: side * ENTER.DIAG * W * rest, ty: ENTER.RISE_FROM * H * rest, blur: ENTER.BLUR_MAX * Math.pow(1 - q, 3) };
  }
  throw new Error(`enterState: unknown kind "${kind}"`);
}

export function cameraPush(local, dur) {
  return 1 + ENTER.PUSH * inOutSine(clamp01(local / Math.max(1, dur)));
}
