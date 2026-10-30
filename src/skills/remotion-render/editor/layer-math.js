/**
 * The editor timeline's maths, pure JS, shared by the Remotion composition
 * (EditorTimeline.jsx) and the final-MP4 QA (scripts/editor/video-qa.js).
 *
 * One definition of "where is this layer, how big, how opaque at frame f" means
 * the QA can compute what the renderer was told to draw and then look for it in
 * the exported frames. If the two ever drift, the QA says so instead of passing.
 */

export const FPS = 30;
export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const EASINGS = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  hold: (t) => (t >= 1 ? 1 : 0),
};

export function ease(name, t) {
  const fn = EASINGS[name] || EASINGS.inOutCubic;
  return fn(clamp(t, 0, 1));
}

/** Defaults for every animatable property of a layer. */
export const PROP_DEFAULTS = {
  opacity: 1,
  scale: 1,
  x: 0,          // pan, as a fraction of the layer rect's width
  y: 0,          // pan, as a fraction of the layer rect's height
  fx: 0.5,       // image focal point (0..1 across the source) — the point kept under the rect centre
  fy: 0.5,
  rotate: 0,
  blur: 0,
  brightness: 1,
  saturate: 1,
  sepia: 0,
  clipL: 0,      // inset clip, percent of the rect
  clipR: 0,
  clipT: 0,
  clipB: 0,
  draw: 1,       // SVG stroke draw-on progress 0..1
  count: 1,      // a text layer with `count`: 0..1 progress of the number counting up
  reveal: 1,     // text reveal progress 0..1
  tx: 0,         // translate in canvas px (slides, parallax)
  ty: 0,
};

/** The value of one property at local frame f from its keyframes (or the static prop / default). */
export function valueAt(layer, prop, f) {
  const kfs = layer.keyframes && layer.keyframes[prop];
  const base = layer.props && layer.props[prop] !== undefined ? layer.props[prop] : PROP_DEFAULTS[prop];
  if (!Array.isArray(kfs) || !kfs.length) return base;
  if (f <= kfs[0].f) return kfs[0].v;
  const last = kfs[kfs.length - 1];
  if (f >= last.f) return last.v;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (f >= a.f && f <= b.f) {
      const span = Math.max(1, b.f - a.f);
      const t = ease(b.e || a.e || "inOutCubic", (f - a.f) / span);
      return a.v + (b.v - a.v) * t;
    }
  }
  return last.v;
}

/** Every animatable property at local frame f. */
export function stateAt(layer, f) {
  const s = {};
  for (const k of Object.keys(PROP_DEFAULTS)) s[k] = valueAt(layer, k, f);
  return s;
}

/**
 * Where the source image is drawn inside its rect, in the rect's own pixels.
 * `cover` fills the rect and clamps the pan so no edge shows; `contain` fits
 * the whole image and lets it move freely.
 */
export function imageBox(layer, state, assetDims) {
  const { w: rw, h: rh } = layer.rect;
  const aw = assetDims.width;
  const ah = assetDims.height;
  const base = layer.fit === "contain" ? Math.min(rw / aw, rh / ah) : Math.max(rw / aw, rh / ah);
  const drawW = aw * base * state.scale;
  const drawH = ah * base * state.scale;
  let left = rw / 2 - state.fx * drawW + state.x * rw;
  let top = rh / 2 - state.fy * drawH + state.y * rh;
  if (layer.fit !== "contain") {
    left = clamp(left, Math.min(0, rw - drawW), 0);
    top = clamp(top, Math.min(0, rh - drawH), 0);
  }
  return { left, top, width: drawW, height: drawH };
}

/** Frames a layer is on screen: [in, out). */
export const layerSpan = (layer) => [layer.in, layer.out];

export function layersActiveAt(timeline, frame) {
  return (timeline.layers || []).filter((l) => frame >= l.in && frame < l.out).sort((a, b) => a.z - b.z);
}

/** Opacity-and-clip of a layer at a global frame, ignoring everything about its content. */
export function layerVisibility(layer, frame) {
  const f = frame - layer.in;
  const s = stateAt(layer, f);
  const w = Math.max(0, 100 - s.clipL - s.clipR);
  const h = Math.max(0, 100 - s.clipT - s.clipB);
  const rectArea = (layer.rect.w * layer.rect.h) / (CANVAS_W * CANVAS_H);
  const x0 = layer.rect.x + s.tx;
  const y0 = layer.rect.y + s.ty;
  const onCanvas =
    Math.max(0, Math.min(CANVAS_W, x0 + layer.rect.w) - Math.max(0, x0)) *
    Math.max(0, Math.min(CANVAS_H, y0 + layer.rect.h) - Math.max(0, y0));
  const visibleArea = (onCanvas / (CANVAS_W * CANVAS_H)) * (w / 100) * (h / 100);
  return { opacity: s.opacity, areaFraction: Math.min(rectArea, visibleArea), state: s };
}

/** A layer counts as "visibly rendered" at a frame only if it is opaque enough and covers enough canvas. */
export function isVisiblyRendered(layer, frame, { minOpacity = 0.35, minArea = 0.02 } = {}) {
  if (frame < layer.in || frame >= layer.out) return false;
  const v = layerVisibility(layer, frame);
  return v.opacity >= minOpacity && v.areaFraction >= minArea;
}

/** The measured size of an effect: largest change of any keyframed property over its span. */
export function effectMagnitude(layer, effect) {
  const out = {};
  for (const prop of Object.keys(effect.to || {})) {
    const a = valueAt(layer, prop, effect.start_f);
    const b = valueAt(layer, prop, effect.end_f);
    out[prop] = Math.abs(b - a);
  }
  return out;
}

/**
 * The text of a counting number at progress t (0..1). spec = { from, to, decimals, prefix, suffix, group }.
 * Used by the composition and by the QA, so both agree on what the frame shows.
 */
export function formatCount(spec, t) {
  const p = Math.max(0, Math.min(1, t));
  const v = spec.from + (spec.to - spec.from) * p;
  const d = Math.max(0, spec.decimals | 0);
  const n = spec.group ? v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : v.toFixed(d);
  return `${spec.prefix || ""}${n}${spec.suffix || ""}`;
}
