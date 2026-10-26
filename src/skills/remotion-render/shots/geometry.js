/**
 * shots/geometry.js — the pure maths of the DirectedShots renderer (no React, no Remotion): shot timing, the
 * scene ("world") each shot is laid out in, the virtual camera over that world, framing words -> crop rectangles,
 * and where text may go so it never covers the subject.
 *
 * World: a coordinate space in pixels, larger than the 1080x1920 frame. Each material is a rectangle in it.
 * Camera: a viewport rectangle {cx, cy, w} in world space with the frame's aspect (h = w * 16/9). The frame shows
 * exactly that viewport, so "push-in" = the viewport shrinks around a point, "pan" = it slides, "pull-out" = it
 * grows until the material sits on the channel ground as a physical object.
 *
 * FOCUS POINT (known limit): schemas/scene-direction.json has no focus point on a material, so "close on the detail"
 * frames material.focus when the render entry supplies one (props.materials[id].focus, from --focus or a sidecar)
 * and the CENTRE (0.5, 0.5) otherwise. A close-up on the centre of a photo is not always the detail the director
 * meant; the critic sees that on the contact sheet.
 */
export const FW = 1080;
export const FH = 1920;
export const FPS = 30;
const AR = FH / FW; // 16:9 portrait
export const AR_VIEW = AR;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const clamp01 = (t) => clamp(t, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Cubic bezier easing (same maths as Remotion's Easing.bezier), so this file has no Remotion import. */
export function bezier(x1, y1, x2, y2) {
  const A = (a1, a2) => 1 - 3 * a2 + 3 * a1, B = (a1, a2) => 3 * a2 - 6 * a1, C = (a1) => 3 * a1;
  const calc = (t, a1, a2) => ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  const slope = (t, a1, a2) => 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
  return (x) => {
    x = clamp01(x);
    let t = x;
    for (let i = 0; i < 8; i++) {
      const s = slope(t, x1, x2);
      if (Math.abs(s) < 1e-6) break;
      t -= (calc(t, x1, x2) - x) / s;
    }
    return calc(clamp01(t), y1, y2);
  };
}
// Camera moves are long and deliberate: the move is visible across the whole shot and settles at the end.
export const EASE = {
  camera: bezier(0.45, 0, 0.2, 1),
  reframe: bezier(0.7, 0, 0.3, 1),      // holds, moves decisively, holds
  out: bezier(0.16, 1, 0.3, 1),
  inOut: bezier(0.65, 0, 0.35, 1),
};

/* ── timing ─────────────────────────────────────────────────────────────── */

/**
 * Lay out every shot of every beat on the frame timeline. A beat's shots fill [t_start, t_end] exactly: their
 * duration_s values are scaled by (t_end - t_start) / sum(duration_s). Gaps between beats are absorbed by the
 * previous beat's last shot so the screen is never empty. Returns [{beatIndex, shotIndex, from, dur, shot, beat}].
 */
export function scheduleShots(direction, fps = FPS, totalFrames = null) {
  const beats = [...direction.beats].filter((b) => b.status !== "deleted").sort((a, b) => a.t_start - b.t_start);
  const out = [];
  beats.forEach((beat, bi) => {
    const start = bi === 0 ? 0 : Math.round(beat.t_start * fps);
    const nextStart = bi + 1 < beats.length ? Math.round(beats[bi + 1].t_start * fps) : (totalFrames ?? Math.round(beat.t_end * fps));
    const end = Math.max(start + beat.shots.length, nextStart);
    const span = end - start;
    const sum = beat.shots.reduce((a, s) => a + s.duration_s, 0) || 1;
    let f = start;
    beat.shots.forEach((shot, si) => {
      const last = si === beat.shots.length - 1;
      const dur = last ? end - f : Math.max(1, Math.round((shot.duration_s / sum) * span));
      out.push({ beatIndex: beat.beat_index, shotIndex: si, from: f, dur, shot, beat });
      f += dur;
    });
  });
  return out;
}

/* ── framing words -> zoom / position ───────────────────────────────────── */

/**
 * Read a framing phrase ("extreme close on the cut edge", "wide on the whole cave", "upper left of the map") as
 * {zoom, fx, fy, both}. zoom is relative to the target's COVER framing: 1 = the material fills the frame, >1 closer,
 * <1 the material is smaller than the frame and sits on the ground. fx/fy (0..1, in the material) are only set when
 * the phrase names a side; otherwise the caller uses the material's focus point (close) or its centre (wide).
 */
export function parseFraming(text = "") {
  const t = String(text).toLowerCase();
  let zoom = 1.3, named = false;
  if (/extreme close|macro|extreme detail|ecu\b/.test(t)) zoom = 3.4;
  else if (/close|detail|tight|zoomed in|cu\b/.test(t)) zoom = 2.3;
  else if (/medium|mid[- ]shot|three[- ]quarter/.test(t)) zoom = 1.55;
  else if (/very wide|pulled back|far back|on the (table|ground|desk)|as an object|context|surround/.test(t)) zoom = 0.62;
  else if (/wide|whole|full|entire|establish|all of/.test(t)) zoom = 1.0;
  let fx = null, fy = null;
  if (/\bleft\b/.test(t)) { fx = 0.28; named = true; }
  if (/\bright\b/.test(t)) { fx = 0.72; named = true; }
  if (/\b(top|upper)\b/.test(t)) { fy = 0.25; named = true; }
  if (/\b(bottom|lower)\b/.test(t)) { fy = 0.75; named = true; }
  const both = /\bboth\b|side by side|together|two\b|pair|all three|everything/.test(t);
  return { zoom, fx, fy, named, both };
}

/** The viewport width at which a rect of size w x h exactly covers the 9:16 frame. */
export const coverWidth = (r) => Math.min(r.w, r.h / AR);
/** The viewport width at which a rect fits entirely inside the frame (with margin m, 0..1). */
export const containWidth = (r, m = 0.12) => Math.max(r.w, r.h / AR) * (1 + m);

/**
 * A framing phrase on a target (one material rect, or the union of several) -> a concrete camera viewport
 * {cx, cy, w}. Close framings centre on the focus point and stay INSIDE the material (no ground at the edges);
 * wide-of-context framings centre the material and let the ground show around it.
 */
export function framingToCamera(phrase, target, focus = { x: 0.5, y: 0.5 }) {
  let f = typeof phrase === "string" ? parseFraming(phrase) : phrase;
  // A full-bleed picture never pulls back past "fills the frame": a landscape photo shrunk below cover is a thin
  // strip on an empty ground (CI run 39862567098, b0s1). Only prints / cut-outs sit on the ground as objects.
  if (f.zoom < 1 && !(target.print || target.cutout || target.union)) f = { ...f, zoom: 1 };
  if (f.both && f.zoom >= 1 && f.zoom < 1.5) return { cx: target.x + target.w / 2, cy: target.y + target.h / 2, w: containWidth(target, 0.08) };
  const base = coverWidth(target);
  const close = f.zoom > 1.01;
  const w = f.zoom >= 1 ? base / f.zoom : containWidth(target, 0.12) / Math.max(0.3, f.zoom / 0.62);
  const px = f.fx ?? (close ? focus.x : 0.5);
  const py = f.fy ?? (close ? focus.y : 0.5);
  let cx = target.x + px * target.w, cy = target.y + py * target.h;
  if (f.zoom >= 1) {
    // keep the viewport inside the material: a close-up never shows a sliver of ground
    const h = w * AR;
    cx = clamp(cx, target.x + w / 2, target.x + target.w - w / 2);
    cy = clamp(cy, target.y + h / 2, target.y + target.h - h / 2);
    if (w > target.w) cx = target.x + target.w / 2;
    if (h > target.h) cy = target.y + target.h / 2;
  }
  return { cx, cy, w };
}

/** Interpolate two viewports. Width is interpolated geometrically so a zoom feels uniform (no lurch at the end). */
export function mixCamera(a, b, t) {
  return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), w: Math.exp(lerp(Math.log(a.w), Math.log(b.w), t)) };
}

/** World rect -> screen rect under a camera viewport. */
export function toScreen(r, cam) {
  const s = FW / cam.w;
  const x0 = cam.cx - cam.w / 2, y0 = cam.cy - (cam.w * AR) / 2;
  return { x: (r.x - x0) * s, y: (r.y - y0) * s, w: r.w * s, h: r.h * s, s };
}

export function unionRect(rs) {
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
  const x2 = Math.max(...rs.map((r) => r.x + r.w)), y2 = Math.max(...rs.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y, union: rs.length > 1 };
}

/* ── world layout per shot ──────────────────────────────────────────────── */

/** A material at its natural aspect, scaled so it covers a frame-sized box (the full-bleed size). */
function coverRect(m, cx = FW / 2, cy = FH / 2, scale = 1) {
  const ar = (m.w || 1) / (m.h || 1);
  let w = FW, h = FW / ar;
  if (h < FH) { h = FH; w = FH * ar; }
  w *= scale; h *= scale;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
/** A material at its natural aspect, fitted inside a box of width bw / height bh. */
function fitRect(m, cx, cy, bw, bh) {
  const ar = (m.w || 1) / (m.h || 1);
  let w = bw, h = bw / ar;
  if (h > bh) { h = bh; w = bh * ar; }
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * Place a shot's materials in the world. family = the beat's mechanism family; treatment per material.
 * Two or more picture materials are laid side by side (comparison / transfer / rack / substitution keep them in
 * the SAME place, so the change happens in matched position). Returns {rects: {id: rect}, ground: bool}.
 */
export function layoutWorld(shot, family, mats) {
  const pics = shot.materials.filter((m) => m.kind !== "data" && mats[m.id]);
  const rects = {};
  const samePlace = /^(substitution|transformation|temporal-transformation)$/.test(family) && shot.camera.move !== "rack";
  const sideBySide = !samePlace && pics.length >= 2 && /compar|transfer|flow|cause|separation|feedback|leak|blockage|constraint|context|rack|reframe/.test(family + " " + shot.camera.move);
  const split = pics.length >= 2 && pics.some((m) => m.treatment === "split");
  const horizontal = /blockage|constraint/.test(family);
  if (split) {
    pics.slice(0, 2).forEach((m, i) => { rects[m.id] = { ...coverBox(mats[m.id], FW / 2, FH / 4 + i * (FH / 2), FW, FH / 2) }; });
    pics.slice(2).forEach((m) => { rects[m.id] = fitRect(mats[m.id], FW / 2, FH / 2, FW * 0.5, FH * 0.3); });
    return { rects };
  }
  if (shot.camera.move === "rack" && pics.length >= 2) {
    // RACK: two subjects at different depths in ONE frame, overlapping (B behind, below-right of A), so the
    // reframe never crosses empty ground (CI run 39862567098: b2s2 mid-move was a black frame)
    pics.forEach((m, i) => {
      const r = fitRect(mats[m.id], FW / 2 + (i ? 110 : -110), FH * 0.36 + i * FH * 0.36, FW * 0.92, FH * 0.5);
      rects[m.id] = { ...r, print: true };
    });
    return { rects, sideBySide: true, samePlace: false, horizontal: false };
  }
  pics.forEach((m, i) => {
    const mm = mats[m.id];
    const t = m.treatment || "full-bleed";
    if (t === "inset-detail" && i > 0) {
      rects[m.id] = fitRect(mm, FW * 0.7, FH * 0.3, FW * 0.5, FH * 0.3); // laid over the main picture, upper right
      rects[m.id].inset = true;
    } else if (t === "cutout") {
      const gap = sideBySide ? i * FW * 1.15 : 0;
      rects[m.id] = fitRect(mm, FW / 2 + gap, FH / 2, FW * 0.82, FH * 0.62);
      rects[m.id].cutout = true;
    } else if (sideBySide) {
      // prints on the ground. The frame is portrait, so materials are STACKED (A above B) — "both" then fills the
      // frame instead of two thumbnails; blockage/constraint keep a horizontal line so A can travel into B.
      rects[m.id] = horizontal
        ? fitRect(mm, FW / 2 + i * FW * 1.18, FH / 2, FW * 0.94, FH * 0.8)
        : fitRect(mm, FW / 2, FH * 0.5 + i * FH * 0.62, FW * 0.9, FH * 0.56);
      rects[m.id].print = true;
    } else {
      rects[m.id] = coverRect(mm);
    }
    if (t === "mask") rects[m.id].mask = true;
  });
  return { rects, sideBySide, samePlace, horizontal };
}
function coverBox(m, cx, cy, bw, bh) {
  const ar = (m.w || 1) / (m.h || 1);
  let w = bw, h = bw / ar;
  if (h < bh) { h = bh; w = bh * ar; }
  return { x: cx - w / 2, y: cy - h / 2, w, h, clip: { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh } };
}

/* ── camera per move ───────────────────────────────────────────────────── */

const ZOOM_MIN_RATIO = 1.7; // a push/pull must at least change the framing by this factor, or it reads as a creep

/**
 * Resolve the shot's camera into start and end viewports + the easing, from camera.move/from/to. Moves that
 * name the same framing at both ends are widened so the motion reads on a phone.
 */
export function resolveCamera(shot, family, world, mats) {
  const cam = shot.camera;
  const ids = Object.keys(world.rects).filter((id) => !world.rects[id].inset);
  const first = world.rects[ids[0]] || { x: 0, y: 0, w: FW, h: FH };
  const last = world.rects[ids[ids.length - 1]] || first;
  const all = ids.length ? unionRect(ids.map((id) => world.rects[id])) : first;
  const focusOf = (id) => (mats[id] && mats[id].focus) || { x: 0.5, y: 0.5 };
  const fp = parseFraming(cam.from), tp = parseFraming(cam.to);
  const tgtFrom = fp.both ? all : first;
  let tgtTo = tp.both ? all : (ids.length > 1 && /reframe|rack|pan|track|match/.test(cam.move) ? last : first);
  if (world.samePlace) tgtTo = tp.both ? all : first;
  let a = framingToCamera(fp, tgtFrom, focusOf(ids[0]));
  let b = framingToCamera(tp, tgtTo, focusOf(ids[ids.length - 1]));
  let ease = EASE.camera;
  const ratio = () => Math.max(a.w, b.w) / Math.min(a.w, b.w);
  switch (cam.move) {
    case "hold":
      b = a;
      break;
    case "push-in":
      if (a.w < b.w) [a, b] = [b, a];
      if (ratio() < ZOOM_MIN_RATIO) b = { ...framingToCamera({ ...tp, zoom: Math.max(tp.zoom, 2.3) }, tgtTo, focusOf(ids[0])) };
      if (ratio() < ZOOM_MIN_RATIO) a = { ...a, w: b.w * ZOOM_MIN_RATIO };
      break;
    case "pull-out":
      if (a.w > b.w) [a, b] = [b, a];
      if (ratio() < ZOOM_MIN_RATIO) a = framingToCamera({ ...fp, zoom: Math.max(fp.zoom, 2.6) }, tgtFrom, focusOf(ids[0]));
      if (ratio() < ZOOM_MIN_RATIO) b = { ...b, w: a.w * ZOOM_MIN_RATIO };
      break;
    case "pan":
    case "track": {
      // a lateral move needs room: frame at least medium-close and travel at least 45% of the frame width
      const zw = Math.min(a.w, b.w, coverWidth(first) / 1.5);
      a = { ...a, w: zw }; b = { ...b, w: cam.move === "track" ? zw / 1.25 : zw };
      if (Math.abs(b.cx - a.cx) < zw * 0.45 && ids.length < 2) {
        const left = first.x + zw / 2, right = first.x + first.w - zw / 2;
        const dir = /left/.test(String(cam.to).toLowerCase()) ? -1 : 1;
        a.cx = dir > 0 ? left : right; b.cx = dir > 0 ? right : left;
        if (right - left < zw * 0.45) { a.w = b.w = zw / 1.4; a.cx = first.x + a.w / 2; b.cx = first.x + first.w - b.w / 2; }
      }
      a.cy = b.cy = clamp(first.y + first.h * focusOf(ids[0]).y, first.y + (zw * AR) / 2, first.y + first.h - (zw * AR) / 2);
      break;
    }
    case "tilt": {
      const zw = Math.min(a.w, b.w, coverWidth(first) / 1.3);
      a = { ...a, w: zw, cx: first.x + first.w * focusOf(ids[0]).x }; b = { ...b, w: zw, cx: a.cx };
      const top = first.y + (zw * AR) / 2, bot = first.y + first.h - (zw * AR) / 2;
      const up = /top|upper|up\b|sky/.test(String(cam.to).toLowerCase());
      a.cy = up ? bot : top; b.cy = up ? top : bot;
      a.cx = b.cx = clamp(a.cx, first.x + zw / 2, first.x + first.w - zw / 2);
      break;
    }
    case "reframe":
    case "rack":
      ease = EASE.reframe;
      break;
    case "match-cut":
      // within the shot the camera settles onto the matched framing: a short push toward the focus
      if (ratio() < 1.3) b = { ...a, w: a.w / 1.35 };
      break;
    default:
      break;
  }
  return { a, b, ease };
}

// screen px per source px. Past this the photo goes visibly soft (b2s1, run 39862567098). KNOWN LIMIT: a 1920 px
// landscape photo full-bleed in a portrait frame is ALREADY ~1.5x at "fills the frame", so a push into it can only
// reach ~1.45x before this cap; the move is then smaller than ZOOM_MIN_RATIO and the shots sidecar records it.
const MAX_UPSCALE = 2.2;

/** Widen a viewport so the material under it is never magnified past MAX_UPSCALE of its own pixels. */
export function capMagnification(cam, rect, native) {
  if (!native || !native.w) return cam;
  const minW = (FW * rect.w) / (MAX_UPSCALE * native.w);
  if (cam.w >= minW) return cam;
  const c = { ...cam, w: minW };
  const h = minW * AR;
  if (minW <= rect.w) c.cx = clamp(c.cx, rect.x + minW / 2, rect.x + rect.w - minW / 2);
  if (h <= rect.h) c.cy = clamp(c.cy, rect.y + h / 2, rect.y + rect.h - h / 2);
  return c;
}

/**
 * Final pass over a resolved camera: cap magnification on both ends, then make sure a push/pull still changes the
 * framing by ZOOM_MIN_RATIO by widening the WIDE end (never by magnifying past the cap). Sets res.ratio.
 */
export function finishCamera(res, move, rect, native, fixedStart = false) {
  res.a = capMagnification(res.a, rect, native);
  res.b = capMagnification(res.b, rect, native);
  if (fixedStart && (move === "push-in" || move === "pull-out" || move === "match-cut")) {
    // the start is held by a match cut: move the END far enough instead (and cap it)
    const ratio = Math.max(res.a.w, res.b.w) / Math.min(res.a.w, res.b.w);
    if (ratio < ZOOM_MIN_RATIO) res.b = capMagnification({ ...res.b, w: move === "pull-out" ? res.a.w * ZOOM_MIN_RATIO : res.a.w / ZOOM_MIN_RATIO }, rect, native);
  } else if (move === "push-in" || move === "pull-out" || move === "match-cut") {
    const [wide, close] = res.a.w >= res.b.w ? ["a", "b"] : ["b", "a"];
    if (res[wide].w / res[close].w < ZOOM_MIN_RATIO) {
      // widen the wide end — but a full-bleed picture never past "fills the frame" (no strip on an empty ground)
      const maxWide = rect.print || rect.cutout || rect.union ? Infinity : coverWidth(rect);
      const w = Math.max(res[wide].w, Math.min(res[close].w * ZOOM_MIN_RATIO, maxWide));
      res[wide] = capMagnification({ ...res[wide], w, cx: lerp(res[wide].cx, rect.x + rect.w / 2, 0.5), cy: lerp(res[wide].cy, rect.y + rect.h / 2, 0.5) }, rect, native);
      if (!(rect.print || rect.cutout || rect.union)) res[wide] = framingClamp(res[wide], rect);
    }
    if (move === "push-in" && res.a.w < res.b.w) [res.a, res.b] = [res.b, res.a];
    if (move === "pull-out" && res.a.w > res.b.w) [res.a, res.b] = [res.b, res.a];
  }
  res.ratio = Math.max(res.a.w, res.b.w) / Math.min(res.a.w, res.b.w);
  return res;
}

/** Keep a viewport inside a rect (when it fits) so a full-bleed picture never shows the ground at an edge. */
export function framingClamp(cam, rect) {
  const h = cam.w * AR, c = { ...cam };
  c.cx = cam.w <= rect.w ? clamp(c.cx, rect.x + cam.w / 2, rect.x + rect.w - cam.w / 2) : rect.x + rect.w / 2;
  c.cy = h <= rect.h ? clamp(c.cy, rect.y + h / 2, rect.y + rect.h - h / 2) : rect.y + rect.h / 2;
  return c;
}

/** The camera at progress p (0..1) through the shot. */
export function cameraAt(resolved, p) {
  return mixCamera(resolved.a, resolved.b, resolved.ease(clamp01(p)));
}

/* ── text placement ─────────────────────────────────────────────────────── */

// Text slots, clear of the platform UI (Shorts safe area) and of the caption band (1380..1560).
export const TEXT_SLOTS = {
  top: { x: 90, y: 250, w: 900, h: 360 },
  low: { x: 90, y: 1000, w: 900, h: 340 },
};
export const CAPTION_BAND = { x: 90, y: 1390, w: 900, h: 180 };

/** Choose the text slot farthest from the subject's on-screen position (sx, sy in px). */
export function textSlotFor(subject) {
  const d = (s) => Math.hypot(subject.x - (s.x + s.w / 2), subject.y - (s.y + s.h / 2));
  return d(TEXT_SLOTS.top) >= d(TEXT_SLOTS.low) ? "top" : "low";
}

/** The subject's screen point under a camera: the focus point of the shot's first picture material. */
export function subjectOnScreen(rect, focus, cam) {
  const s = toScreen(rect, cam);
  return { x: s.x + (focus?.x ?? 0.5) * s.w, y: s.y + (focus?.y ?? 0.5) * s.h };
}

/* ── words ──────────────────────────────────────────────────────────────── */

const norm = (w) => String(w || "").toLowerCase().replace(/[^a-z0-9%$£€.]/g, "").replace(/\.$/, "");

/**
 * The frame the shot's text lands on: the first spoken occurrence of text.sync_word inside the beat's window
 * (word timings, seconds). Falls back to 20% into the shot when the word is not in the timings.
 */
export function syncFrame(shotSched, words, fps = FPS) {
  const text = shotSched.shot.text;
  const fallback = shotSched.from + Math.round(shotSched.dur * 0.2);
  if (!text || !text.sync_word || !Array.isArray(words)) return { frame: fallback, matched: false };
  const want = norm(text.sync_word.split(/\s+/)[0]);
  const t0 = shotSched.beat.t_start - 0.05, t1 = shotSched.beat.t_end + 0.05;
  const hit = words.find((w) => w.start >= t0 && w.start <= t1 && norm(w.word) === want)
    || words.find((w) => w.start >= t0 && w.start <= t1 && norm(w.word).startsWith(want));
  if (!hit) return { frame: fallback, matched: false };
  const f = Math.round(hit.start * fps);
  // spoken outside this shot's window: the text would flash for a few frames at the edge; land it early instead
  if (f < shotSched.from || f > shotSched.from + shotSched.dur - 20) return { frame: fallback, matched: false, outside: true };
  return { frame: f, matched: true };
}
