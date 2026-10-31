import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITS, assetKind, frameMetrics, gateFrameMetrics, gateTimelineMetrics, sceneWindows, timelineMetrics } from "../editor/qa-metrics.mjs";

const timeline = {
  fps: 30,
  durationInFrames: 360,
  caption_style: { size: 44 },
  assets: {
    a: { file: "a.jpg", width: 100, height: 100, kind: "photo" },
    b: { file: "b.svg", width: 100, height: 100, kind: "poster" },
    c: { file: "c.svg", width: 100, height: 100, kind: "figure" },
    d: { file: "d.svg", width: 100, height: 100 },
  },
  layers: [
    { id: "scene-0-image", type: "image", asset_id: "a", in: 0, out: 90 },
    { id: "scene-1-image", type: "image", asset_id: "b", in: 90, out: 180 },
    { id: "scene-2-image", type: "image", asset_id: "a", in: 180, out: 270 },
    { id: "scene-3-image", type: "image", asset_id: "c", in: 270, out: 360 },
  ],
};

test("scene windows come from the scene image layers, not overlays", () => {
  const w = sceneWindows({ ...timeline, layers: [...timeline.layers, { id: "overlay-0", type: "image", asset_id: "d", in: 0, out: 90 }] });
  assert.equal(w.length, 4);
  assert.equal(w[0].start, 0);
  assert.equal(w.at(-1).end, 12);
});

test("metrics: cadence, poster share, reuse and caption size", () => {
  const m = timelineMetrics(timeline);
  assert.equal(m.scene_count, 4);
  assert.equal(m.first_scene_end_s, 3);
  assert.equal(m.median_scene_s, 3);
  assert.equal(m.max_scene_s, 3);
  assert.equal(m.poster_share, 0.25);
  assert.equal(m.max_asset_uses, 2);
  assert.equal(m.consecutive_asset_reuse, 0);
  assert.equal(m.caption_size, 44);
  assert.deepEqual(gateTimelineMetrics(m), []);
});

test("the provenance kind is used when present; an unlabelled SVG is a card, not a photo", () => {
  assert.equal(assetKind(timeline, "a"), "photo");
  assert.equal(assetKind(timeline, "b"), "poster");
  assert.equal(assetKind(timeline, "d"), "card");
  assert.equal(assetKind(timeline, "missing"), "unknown");
});

test("a deck is rejected: long median, poster-heavy, repeated and back-to-back", () => {
  const deck = {
    ...timeline,
    durationInFrames: 1050,
    layers: [
      { id: "scene-0-image", type: "image", asset_id: "b", in: 0, out: 150 },
      { id: "scene-1-image", type: "image", asset_id: "b", in: 150, out: 300 },
      { id: "scene-2-image", type: "image", asset_id: "b", in: 300, out: 450 },
      { id: "scene-3-image", type: "image", asset_id: "b", in: 450, out: 600 },
      { id: "scene-4-image", type: "image", asset_id: "b", in: 600, out: 750 },
      { id: "scene-5-image", type: "image", asset_id: "b", in: 750, out: 1050 },
    ],
  };
  const m = timelineMetrics(deck);
  const checks = gateTimelineMetrics(m).map((f) => f.check);
  assert.ok(checks.includes("first-scene"));
  assert.ok(checks.includes("median-scene"));
  assert.ok(checks.includes("max-scene"));
  assert.ok(checks.includes("poster-share"));
  assert.ok(checks.includes("asset-uses"));
  assert.ok(checks.includes("consecutive-reuse"));
});

test("dark frames and missing frame samples fail closed", () => {
  const f = frameMetrics([10, 10, 30, 40]);
  assert.equal(f.dark_frame_share, 0.5);
  assert.ok(gateFrameMetrics(f).some((x) => x.check === "dark-share"));
  assert.ok(gateFrameMetrics(frameMetrics([])).some((x) => x.check === "frames"));
});

test("missing timeline metrics never pass", () => {
  const checks = gateTimelineMetrics({}).map((f) => f.check);
  for (const c of ["scenes", "first-scene", "median-scene", "max-scene", "poster-share", "asset-uses", "caption-size"]) assert.ok(checks.includes(c), c);
  assert.equal(LIMITS.maxAssetUses, 3);
});
