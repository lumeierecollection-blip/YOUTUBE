/**
 * Build a persisted editor timeline from a human-readable scene plan.
 *
 * The plan says what the story needs (scene, asset, words, layout, motion);
 * this module turns that into the layer/keyframe/caption form the editor
 * renders. It is deterministic: same plan + same audio metadata = same
 * timeline, which is what the render and the final-MP4 QA both read.
 */
import { CANVAS_W, CANVAS_H, FPS } from "../../src/skills/remotion-render/editor/layer-math.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const frames = (sec, fps) => Math.max(0, Math.round(Number(sec || 0) * fps));

function headlineSize(text) {
  const lines = String(text || "").split("\n");
  const longest = Math.max(1, ...lines.map((l) => l.length));
  if (longest <= 10) return 112;
  if (longest <= 16) return 94;
  if (longest <= 24) return 78;
  if (longest <= 34) return 64;
  return 54;
}

function fadeKeyframes(span, opacity = 1, fade = 12, startOpacity = 0) {
  const a = Math.min(fade, Math.max(3, Math.floor(span / 6)));
  return [
    { f: 0, v: startOpacity, e: "outCubic" },
    { f: a, v: opacity },
    { f: Math.max(a, span - a), v: opacity },
    { f: span, v: 0, e: "inOutCubic" },
  ];
}

function textLayer({ id, text, rect, size, weight = 700, color, align = "left", valign = "top", lineHeight = 1.12, tracking = 0, upper = false, inF, outF, z, opacity = 1, revealFrames = 14, shadow = true, font }) {
  const span = Math.max(1, outF - inF);
  return {
    id,
    type: "text",
    text,
    rect,
    in: inF,
    out: outF,
    z,
    style: {
      font,
      size,
      weight,
      color,
      align,
      valign,
      lineHeight,
      tracking,
      upper,
      shadow,
      pad: 0,
    },
    props: { opacity, reveal: 0 },
    keyframes: {
      opacity: fadeKeyframes(span, opacity, 10),
      reveal: [
        { f: 0, v: 0, e: "outCubic" },
        { f: Math.min(revealFrames, Math.max(4, Math.floor(span / 3))), v: 1, e: "outCubic" },
      ],
    },
  };
}

function imageLayer({ id, assetId, rect, fit, inF, outF, z, scene }) {
  const span = Math.max(1, outF - inF);
  // No slow zoom and no pan: a held picture stays put. Movement comes from the cut itself: every beat lands slightly large and snaps to
  // size in ~9 frames (scene.punch, 0 turns it off), and a second beat on the same photo is a hard cut to a tighter crop (scene.scale).
  const base = Number(scene.scale || 1);
  const props = {
    opacity: 1,
    scale: base,
    fx: scene.fx ?? 0.5,
    fy: scene.fy ?? 0.5,
    sepia: scene.filter?.sepia ?? 0,
    saturate: scene.filter?.saturate ?? 1,
    brightness: scene.filter?.brightness ?? 1,
    blur: scene.filter?.blur ?? 0,
  };
  const fadeF = Math.min(Math.max(0, Math.round(Number(scene.fade || 0))), Math.floor(span / 3));
  const punch = scene.punch === undefined ? 0.06 : Number(scene.punch);
  const settle = Math.min(9, Math.max(2, span - 1));
  const keyframes = {
    opacity: fadeF >= 2 ? [{ f: 0, v: 0, e: "outCubic" }, { f: fadeF, v: 1 }, { f: span, v: 1 }] : [{ f: 0, v: 1 }, { f: span, v: 1 }],
    scale: punch > 0 ? [{ f: 0, v: base + punch, e: "outCubic" }, { f: settle, v: base }, { f: span, v: base }] : [{ f: 0, v: base }, { f: span, v: base }],
  };
  return { id, type: "image", asset_id: assetId, rect, fit, in: inF, out: outF, z, props, keyframes };
}

function frameLayer({ id, rect, inF, outF, z, accent }) {
  const span = Math.max(1, outF - inF);
  return {
    id,
    type: "svg",
    rect,
    in: inF,
    out: outF,
    z,
    viewBox: [0, 0, rect.w, rect.h],
    paths: [{ d: `M0 0 H${rect.w} V${rect.h} H0 Z`, fill: "none", stroke: accent, strokeWidth: 2 }],
    props: { opacity: 0.55, draw: 0 },
    keyframes: {
      opacity: fadeKeyframes(span, 0.55, 12),
      draw: [{ f: 0, v: 0, e: "outCubic" }, { f: Math.min(24, Math.max(6, Math.floor(span / 4))), v: 1, e: "outCubic" }],
    },
  };
}

function layoutFor(layout) {
  switch (layout) {
    case "center":
      return { kickerY: 510, headlineY: 580, headlineH: 620, subY: 1260 };
    case "upper":
      return { kickerY: 170, headlineY: 235, headlineH: 540, subY: 900 };
    case "object":
      return { kickerY: 145, headlineY: 210, headlineH: 420, subY: 1335 };
    default:
      return { kickerY: 945, headlineY: 1010, headlineH: 390, subY: 1360 };
  }
}

export function buildTimeline(plan, { audioDuration, captions = [], generatedAt = new Date().toISOString() } = {}) {
  const fps = Number(plan.fps) || FPS;
  const duration = Math.max(0.1, Number(audioDuration || plan.duration) || 0.1);
  const durationInFrames = Math.max(1, Math.round(duration * fps));
  const palette = {
    bg: "#08090B",
    text: "#F5EFE6",
    muted: "#B9B0A4",
    accent: "#D4A574",
    accent2: "#7FA6A0",
    ...(plan.palette || {}),
  };
  const fonts = { primary: "Cormorant Garamond", sans: "Inter", ...(plan.fonts || {}) };
  const assets = plan.assets || {};
  const layers = [];
  const scenes = Array.isArray(plan.scenes) ? plan.scenes : [];
  let z = 10;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const prevEnd = i === 0 ? 0 : Number(scenes[i - 1].end);
    const nextStart = i === scenes.length - 1 ? duration : Number(scenes[i + 1].start);
    const start = clamp(Number(scene.start ?? prevEnd), 0, duration);
    const end = clamp(Number(scene.end ?? nextStart), start + 0.08, duration);
    const inF = frames(start, fps);
    const outF = Math.min(durationInFrames, frames(end, fps));
    if (outF <= inF) continue;
    const visualEnd = clamp(Math.max(end, nextStart), start + 0.08, duration);
    const visualOutF = Math.min(durationInFrames, frames(visualEnd, fps));
    const span = outF - inF;
    const asset = scene.asset ? assets[scene.asset] : null;

    if (asset) {
      const isObject = scene.fit === "contain";
      const rect = scene.rect || (isObject ? { x: 130, y: 430, w: 820, h: 900 } : { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H });
      if (isObject) {
        layers.push({
          id: `scene-${i}-backdrop`,
          type: "solid",
          rect: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
          in: inF,
          out: visualOutF,
          z: z++,
          style: { background: scene.backdrop || "radial-gradient(circle at 50% 42%, #1A1D22 0%, #08090B 72%)" },
          props: { opacity: 1 },
          keyframes: {},
        });
      }
      layers.push(imageLayer({ id: `scene-${i}-image`, assetId: scene.asset, rect, fit: scene.fit || "cover", inF, outF: visualOutF, z: z++, scene }));
      if (isObject) {
        layers.push(frameLayer({ id: `scene-${i}-frame`, rect: { x: rect.x - 14, y: rect.y - 14, w: rect.w + 28, h: rect.h + 28 }, inF, outF: visualOutF, z: z++, accent: palette.accent }));
      }
      layers.push({
        id: `scene-${i}-gradient`,
        type: "solid",
        rect: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
        in: inF,
        out: visualOutF,
        z: 100,
        style: {
          background:
            scene.gradient ||
            (isObject
              ? "linear-gradient(to top, rgba(6,7,9,0.96) 0%, rgba(6,7,9,0.62) 30%, rgba(6,7,9,0.04) 62%, rgba(6,7,9,0.72) 100%)"
              : "linear-gradient(to top, rgba(6,7,9,0.94) 0%, rgba(6,7,9,0.70) 28%, rgba(6,7,9,0.08) 64%, rgba(6,7,9,0.60) 100%)"),
        },
        props: { opacity: 1 },
        keyframes: {},
      });
    } else if (scene.background) {
      layers.push({
        id: `scene-${i}-bg`,
        type: "solid",
        rect: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
        in: inF,
        out: visualOutF,
        z: z++,
        style: { background: scene.background },
        props: { opacity: 1 },
        keyframes: {},
      });
    }

    const layout = layoutFor(scene.layout || "lower");
    const align = scene.align || "left";
    const x = scene.text_x ?? 90;
    const w = scene.text_w ?? 900;
    if (scene.kicker) {
      layers.push(textLayer({
        id: `scene-${i}-kicker`, text: scene.kicker, rect: { x, y: scene.kicker_y ?? layout.kickerY, w, h: 64 },
        size: scene.kicker_size || 28, weight: 700, color: scene.kicker_color || palette.accent,
        align, upper: true, tracking: 0.18, inF, outF, z: 200, revealFrames: 10, font: fonts.sans,
      }));
    }
    if (scene.headline) {
      layers.push(textLayer({
        id: `scene-${i}-headline`, text: scene.headline, rect: { x, y: scene.headline_y ?? layout.headlineY, w, h: scene.headline_h ?? layout.headlineH },
        size: scene.headline_size || headlineSize(scene.headline), weight: 700, color: scene.headline_color || palette.text,
        align, lineHeight: 1.02, inF, outF, z: 210, revealFrames: 14,
      }));
    }
    if (scene.sub) {
      layers.push(textLayer({
        id: `scene-${i}-sub`, text: scene.sub, rect: { x, y: scene.sub_y ?? layout.subY, w, h: scene.sub_h ?? 170 },
        size: scene.sub_size || 34, weight: 500, color: scene.sub_color || palette.muted,
        align, lineHeight: 1.25, inF, outF, z: 220, revealFrames: 16, font: fonts.sans,
      }));
    }
    if (scene.stat) {
      layers.push(textLayer({
        id: `scene-${i}-stat`, text: scene.stat, rect: { x, y: scene.stat_y ?? 760, w, h: scene.stat_h ?? 280 },
        size: scene.stat_size || 200, weight: 700, color: scene.stat_color || palette.accent,
        align, lineHeight: 0.95, inF, outF, z: 230, revealFrames: 12,
      }));
    }
    if (asset?.credit) {
      layers.push(textLayer({
        id: `scene-${i}-credit`, text: asset.credit, rect: { x: 60, y: 76, w: 960, h: 40 },
        size: 16, weight: 400, color: palette.muted, align: "left", lineHeight: 1.2,
        inF, outF, z: 240, opacity: 0.72, revealFrames: 8, shadow: false, font: fonts.sans,
      }));
    }
  }

  layers.push({
    id: "progress",
    type: "solid",
    rect: { x: 0, y: 0, w: CANVAS_W, h: 6 },
    in: 0,
    out: durationInFrames,
    z: 8000,
    style: { background: palette.accent },
    props: { opacity: 0.9, clipR: 100 },
    keyframes: { clipR: [{ f: 0, v: 100, e: "linear" }, { f: durationInFrames, v: 0, e: "linear" }] },
  });

  const cues = (captions || []).map((c) => ({
    start_f: frames(c.start, fps),
    end_f: Math.max(frames(c.start, fps) + 1, frames(c.end, fps)),
    text: c.text,
    words: (c.words || []).map((w) => ({ text: w.text, start_f: frames(w.start, fps) })),
  }));

  return {
    version: 1,
    id: plan.id,
    title: plan.title || plan.id,
    width: CANVAS_W,
    height: CANVAS_H,
    fps,
    durationInFrames,
    palette,
    fonts,
    caption_style: plan.caption_style || { x: 80, y: 1540, w: 920, h: 210, size: 38 },
    assets,
    layers,
    captions: cues,
    metadata: {
      generated_at: generatedAt,
      source_script: plan.script || null,
      source_audio: plan.audio || null,
      source_transcript: plan.transcript || null,
      scene_count: scenes.length,
      image_scene_count: scenes.filter((s) => s.asset).length,
      unique_assets: [...new Set(scenes.map((s) => s.asset).filter(Boolean))],
      credits: [...new Set(scenes.map((s) => s.asset).filter(Boolean).map((id) => assets[id]?.credit).filter(Boolean))],
    },
  };
}
