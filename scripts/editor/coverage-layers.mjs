/**
 * Layer primitives shared by the coverage graphics and the coverage timeline.
 *
 * These are the same layer objects the persisted editor timeline schema
 * accepts; keeping the constructors here means a diagram and a photograph are
 * animated by the same renderer and can be checked by the same QA.
 */
export const FPS = 30;
export const W = 1080;
export const H = 1920;

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const frames = (sec) => Math.max(0, Math.round(Number(sec || 0) * FPS));

export function fade(span, { opacity = 1, fadeIn = 8, fadeOut = 8 } = {}) {
  const len = Math.max(1, span);
  const a = Math.min(fadeIn, Math.max(1, Math.floor(len / 4)));
  const b = Math.max(a, len - Math.min(fadeOut, Math.max(1, Math.floor(len / 4))));
  return [
    { f: 0, v: 0, e: "outCubic" },
    { f: a, v: opacity },
    { f: b, v: opacity },
    { f: len, v: 0, e: "inOutCubic" },
  ];
}

export function reveal(span, { delay = 0, duration = 10 } = {}) {
  const len = Math.max(1, span);
  return [
    { f: 0, v: 0, e: "outCubic" },
    { f: Math.min(len, delay), v: 0 },
    { f: Math.min(len, delay + duration), v: 1, e: "outCubic" },
  ];
}

export function textLayer({
  id, text, rect, size = 48, color = "#F5EFE6", font, weight = 700,
  align = "left", valign = "top", lineHeight = 1.1, tracking = 0, upper = false,
  inF, outF, z, opacity = 1, revealFrames = 12, delay = 0, shadow = true, count,
}) {
  const span = Math.max(1, outF - inF);
  const layer = {
    id,
    type: "text",
    text,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) },
    in: inF,
    out: outF,
    z,
    style: { font, size, weight, color, align, valign, lineHeight, tracking, upper, shadow, pad: 0 },
    props: { opacity },
    keyframes: {
      opacity: fade(span, { opacity, fadeIn: 6, fadeOut: 6 }),
      reveal: reveal(span, { delay, duration: revealFrames }),
    },
  };
  if (count) layer.count = count;
  return layer;
}

export function solidLayer({ id, rect = { x: 0, y: 0, w: W, h: H }, background, inF, outF, z, opacity = 1, keyframes }) {
  const span = Math.max(1, outF - inF);
  return {
    id,
    type: "solid",
    rect,
    in: inF,
    out: outF,
    z,
    style: { background },
    props: { opacity },
    keyframes: {
      ...(keyframes || {}),
      opacity: fade(span, { opacity, fadeIn: 6, fadeOut: 6 }),
    },
  };
}

export function imageLayer({
  id, assetId, rect, fit = "cover", inF, outF, z, scale = 1.04,
  fx = 0.5, fy = 0.5, x = 0, y = 0, sepia = 0, saturate = 1, brightness = 1, blur = 0,
  motion = "settle",
}) {
  const span = Math.max(1, outF - inF);
  const start = Number(scale);
  let scaleKfs;
  let xKfs;
  let yKfs;
  if (motion === "push_in") {
    scaleKfs = [{ f: 0, v: start, e: "inOutSine" }, { f: span, v: start + 0.08 }];
  } else if (motion === "push_out") {
    scaleKfs = [{ f: 0, v: start + 0.08, e: "inOutSine" }, { f: span, v: start }];
  } else if (motion === "pan_left") {
    scaleKfs = [{ f: 0, v: start + 0.05, e: "inOutSine" }, { f: span, v: start + 0.05 }];
    xKfs = [{ f: 0, v: 0.03, e: "inOutSine" }, { f: span, v: -0.03 }];
  } else if (motion === "pan_right") {
    scaleKfs = [{ f: 0, v: start + 0.05, e: "inOutSine" }, { f: span, v: start + 0.05 }];
    xKfs = [{ f: 0, v: -0.03, e: "inOutSine" }, { f: span, v: 0.03 }];
  } else {
    // Continuous slow scale drift for the entire layer duration so nothing sits
    // completely still (prevents near-static runs > 4s in the final QA gate).
    const drift = 0.05;
    scaleKfs = [{ f: 0, v: start, e: "outCubic" }, { f: span, v: start + drift, e: "inOutCubic" }];
  }
  const keyframes = {
    opacity: fade(span, { opacity: 1, fadeIn: 5, fadeOut: 6 }),
    scale: scaleKfs,
  };
  if (xKfs) keyframes.x = xKfs;
  if (y) keyframes.y = [{ f: 0, v: y, e: "inOutSine" }, { f: span, v: -y }];
  return {
    id,
    type: "image",
    asset_id: assetId,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) },
    fit,
    in: inF,
    out: outF,
    z,
    props: { opacity: 1, scale: start, fx, fy, sepia, saturate, brightness, blur },
    keyframes,
  };
}

export function svgLayer({ id, rect, paths, inF, outF, z, drawFrames = 20, opacity = 1, delay = 0 }) {
  const span = Math.max(1, outF - inF);
  return {
    id,
    type: "svg",
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) },
    in: inF,
    out: outF,
    z,
    viewBox: [0, 0, Math.round(rect.w), Math.round(rect.h)],
    paths: paths.map((p) => ({ fill: "none", strokeWidth: 4, ...p })),
    props: { opacity, draw: 0 },
    keyframes: {
      opacity: fade(span, { opacity, fadeIn: 4, fadeOut: 4 }),
      draw: [
        { f: 0, v: 0, e: "outCubic" },
        { f: Math.min(span, delay), v: 0 },
        { f: Math.min(span, delay + drawFrames), v: 1, e: "outCubic" },
      ],
      // A slow, purposeful drift on diagram layers so an information-dense
      // diagram that stays on screen for several seconds never sits completely
      // still (the final static-run QA caps frozen holds at 4.0s). The drift is
      // a translate (not a blanket scale sweep) and only moves the diagram, not
      // the surrounding frame.
      ty: [{ f: 0, v: 0, e: "outCubic" }, { f: span, v: 18, e: "inOutCubic" }],
    },
  };
}

export function hexLuminance(hex) {
  const m = String(hex || "").replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return 0.5;
  const [r, g, b] = m.slice(1).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const onColor = (hex) => (hexLuminance(hex) > 0.45 ? "#101114" : "#FFFFFF");
