/**
 * Pure metrics for the editor's own render, computed from the persisted timeline
 * (and, for pixels, from the sampled frame luma passed in by video-qa.js).
 *
 * These are deliberately separate from the pixel extraction so they can be
 * unit-tested without ffmpeg. Every gate fails closed: a missing or non-finite
 * metric is a failure, not a pass.
 */

const DEFAULT_FPS = 30;
const SVG = /\.svg(?:[?#].*)?$/i;
const EPS = 1e-9;

export const LIMITS = Object.freeze({
  firstSceneEndS: 4.0,
  medianSceneMinS: 2.0,
  medianSceneMaxS: 4.0,
  maxSceneS: 7.5,
  posterShare: 0.35,
  maxAssetUses: 3,
  captionSize: 42,
  darkFrameShare: 0.2,
});

const finite = (n) => Number.isFinite(Number(n));
const round = (n, places = 3) => Number(Number(n).toFixed(places));

export function assetKind(timeline, id) {
  const asset = timeline?.assets?.[id];
  if (!asset) return "unknown";
  if (["photo", "figure", "poster", "card"].includes(asset.kind)) return asset.kind;
  return SVG.test(String(asset.file || "")) ? "card" : "photo";
}

/** The visible main image layer of every scene, in timeline order. */
export function sceneWindows(timeline) {
  const fps = Number(timeline?.fps) || DEFAULT_FPS;
  return (timeline?.layers || [])
    .filter((l) => l && l.type === "image" && /^scene-\d+-image$/.test(String(l.id || "")))
    .map((l) => {
      const start = Number(l.in) / fps;
      const end = Number(l.out) / fps;
      return {
        id: l.id,
        asset_id: l.asset_id,
        kind: assetKind(timeline, l.asset_id),
        start,
        end,
        duration: Math.max(0, end - start),
      };
    })
    .filter((w) => finite(w.start) && finite(w.end) && w.end > w.start)
    .sort((a, b) => a.start - b.start);
}

export function timelineMetrics(timeline) {
  const fps = Number(timeline?.fps) || DEFAULT_FPS;
  const duration = Number(timeline?.durationInFrames) / fps;
  const windows = sceneWindows(timeline);
  const durations = windows.map((w) => w.duration).sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  const median = !durations.length ? 0 : durations.length % 2 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2;
  const posterSeconds = windows.filter((w) => w.kind === "poster").reduce((n, w) => n + w.duration, 0);
  const uses = new Map();
  let consecutive = 0;
  for (let i = 0; i < windows.length; i++) {
    uses.set(windows[i].asset_id, (uses.get(windows[i].asset_id) || 0) + 1);
    if (i && windows[i].asset_id === windows[i - 1].asset_id) consecutive++;
  }
  return {
    scene_count: windows.length,
    first_scene_end_s: windows.length ? round(windows[0].end) : 0,
    median_scene_s: round(median),
    max_scene_s: durations.length ? round(durations.at(-1)) : 0,
    poster_seconds: round(posterSeconds),
    poster_share: duration > 0 ? round(posterSeconds / duration) : 0,
    asset_uses: Object.fromEntries(uses),
    max_asset_uses: uses.size ? Math.max(...uses.values()) : 0,
    consecutive_asset_reuse: consecutive,
    caption_size: Number(timeline?.caption_style?.size) || 0,
  };
}

export function frameMetrics(lumas) {
  const values = (lumas || []).map(Number).filter((n) => Number.isFinite(n));
  const dark = values.filter((n) => n < 20).length;
  return {
    frames: values.length,
    mean_luma: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length, 2) : 0,
    dark_frames: dark,
    dark_frame_share: values.length ? round(dark / values.length) : 1,
  };
}

export function gateTimelineMetrics(m = {}) {
  const failures = [];
  const fail = (check, why) => failures.push({ check, why });
  if (!(Number(m.scene_count) > 0)) fail("scenes", "no scene image layers");
  if (!(Number(m.first_scene_end_s) > 0) || Number(m.first_scene_end_s) > LIMITS.firstSceneEndS) {
    fail("first-scene", `first scene ends at ${m.first_scene_end_s ?? "?"}s (limit ${LIMITS.firstSceneEndS}s)`);
  }
  if (!(Number(m.median_scene_s) >= LIMITS.medianSceneMinS) || Number(m.median_scene_s) > LIMITS.medianSceneMaxS) {
    fail("median-scene", `median scene is ${m.median_scene_s ?? "?"}s (want ${LIMITS.medianSceneMinS}-${LIMITS.medianSceneMaxS}s)`);
  }
  if (!(Number(m.max_scene_s) <= LIMITS.maxSceneS)) {
    fail("max-scene", `longest scene is ${m.max_scene_s ?? "?"}s (limit ${LIMITS.maxSceneS}s)`);
  }
  if (!(Number(m.poster_share) <= LIMITS.posterShare)) {
    fail("poster-share", `statement-poster time is ${((Number(m.poster_share) || 0) * 100).toFixed(0)}% (limit ${LIMITS.posterShare * 100}%)`);
  }
  if (!(Number(m.max_asset_uses) <= LIMITS.maxAssetUses)) {
    fail("asset-uses", `an asset is used ${m.max_asset_uses ?? "?"} times (limit ${LIMITS.maxAssetUses})`);
  }
  if (Number(m.consecutive_asset_reuse) !== 0) {
    fail("consecutive-reuse", `${m.consecutive_asset_reuse} scene pair(s) reuse the same asset back to back`);
  }
  if (!(Number(m.caption_size) >= LIMITS.captionSize)) {
    fail("caption-size", `caption size is ${m.caption_size ?? "?"}px (minimum ${LIMITS.captionSize}px)`);
  }
  return failures;
}

export function gateFrameMetrics(m = {}) {
  const failures = [];
  if (!(Number(m.frames) > 0)) failures.push({ check: "frames", why: "no frame luma samples" });
  if (!(Number(m.dark_frame_share) <= LIMITS.darkFrameShare)) {
    failures.push({ check: "dark-share", why: `${((Number(m.dark_frame_share) || 0) * 100).toFixed(0)}% of sampled frames have mean luma below 20 (limit ${LIMITS.darkFrameShare * 100}%)` });
  }
  return failures;
}
