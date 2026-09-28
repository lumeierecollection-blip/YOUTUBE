/**
 * Abstract-shape geometry, pure JS (no JSX). abstract-shape.jsx draws from
 * it and render.js records the same box in the render manifest, so the
 * audit (local-audit.cjs shapes-clear-of-text) checks the numbers the
 * renderer actually used.
 *
 * Each shape is defined once for the TOP-LEFT corner, growing toward +x/+y
 * from a local origin; the other corners mirror it. It is placed ONLY in an
 * EMPTY corner of ZONES.VISUAL (paper-layout.js) — never the headline or
 * caption zone — inside a box of at most 220 x 220 paper px. A shape bigger
 * than that is scaled down to fit (aspect kept); if that would take it under
 * 35% of its size it is not drawn at all.
 * A chart / counter / gauge / map beat draws NO shape: its visual spans the
 * whole zone, so it has no empty corner. Run 36405739332 ch-48: the review
 * called the hairlines beside its gauges and counter "meaningless squiggly
 * lines next to the circular gauges".
 */
import { PAPER, ZONES, clampToZone, boxInside } from "./paper-layout.js";

const W = PAPER.w;
export const SHAPE_MAX = 220;
const INSET = 6;
const MIN_SCALE = 0.35;
const DATA_TYPES = ["COUNTER", "BAR", "PIE", "LINE", "GAUGE", "MAP"];

function cubic(p0, p1, p2, p3, n = 64) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}
function quad(p0, p1, p2, n = 64) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return out;
}
// SVG rotate(deg): clockwise on screen (y down).
function rotate([x, y], deg) {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}
function bboxOf(pts, pad = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

// One teardrop petal pointing down the local +y axis (the reference's leaf).
export function petalPath(len, wid) {
  return `M0,0 C${wid},${len * 0.25} ${wid * 0.9},${len * 0.8} 0,${len} C${-wid * 0.9},${len * 0.8} ${-wid},${len * 0.25} 0,0Z`;
}
function petalPoints(len, wid, deg) {
  return [
    ...cubic([0, 0], [wid, len * 0.25], [wid * 0.9, len * 0.8], [0, len]),
    ...cubic([0, len], [-wid * 0.9, len * 0.8], [-wid, len * 0.25], [0, 0]),
  ].map((p) => rotate(p, deg));
}

export function shapeGeometry(variant) {
  const v = String(variant || "").toLowerCase();
  if (v === "petals" || v === "leaf") {
    // Three petals fanned about the corner's diagonal (-45° for top-left).
    const wid = W * 0.07;
    const petals = [-38, 0, 38].map((a, i) => ({ len: W * (i === 1 ? 0.3 : 0.24), wid, rot: -45 + a }));
    return { kind: "petals", petals, bbox: bboxOf(petals.flatMap((p) => petalPoints(p.len, p.wid, p.rot))) };
  }
  if (v === "swoosh" || v === "ribbon") {
    // A thick arc sweeping across the corner; the box includes the stroke's
    // half-width and its round caps.
    const r = W * 0.9, sw = W * 0.055;
    const p0 = [0, r * 0.55], p1 = [r * 0.25, r * 0.2], p2 = [r * 0.62, 0];
    return { kind: "swoosh", p0, p1, p2, sw, bbox: bboxOf(quad(p0, p1, p2), sw / 2) };
  }
  if (v === "hairline") {
    // NOT DRAWN. The reference's hairline is a thin curve CROSSING THE PAGE;
    // confined to a 220 x 220 corner (the zone rule) it became two small
    // squiggles, and the reviews named exactly that as noise: "meaningless
    // squiggly abstract lines" (run 36405739332 ch-48), "random floating
    // black line accents" (run 36411079375 ch-9). A hairline beat has no
    // shape; petals and swoosh still read as the reference's accents.
    return null;
  }
  return null;
}

export function shapeMaxSize(visualType) {
  return DATA_TYPES.includes(String(visualType || "").toUpperCase()) ? 0 : SHAPE_MAX;
}

/**
 * Where a shape goes: a corner of the visual zone, scaled to fit its size
 * limit. A local point (x, y) is drawn at (ax + sx*scale*x, ay + sy*scale*y).
 * `box` is the shape's rendered bounding box in paper coordinates. Returns
 * null when the shape is not drawn ("none", unknown, or too big to shrink).
 */
export function shapeLayout(variant, corner = "tr", visualType = null, zone = ZONES.VISUAL) {
  const g = shapeGeometry(variant);
  if (!g || shapeMaxSize(visualType) <= 0) return null;
  const limit = Math.min(shapeMaxSize(visualType), zone.w - 2 * INSET, zone.h - 2 * INSET);
  const b = g.bbox;
  const scale = Math.min(1, limit / b.w, limit / b.h);
  if (scale < MIN_SCALE) return null;
  const c = ["tl", "tr", "bl", "br"].includes(corner) ? corner : "tr";
  const sx = c[1] === "r" ? -1 : 1, sy = c[0] === "b" ? -1 : 1;
  const w = b.w * scale, h = b.h * scale;
  // The box's outer corner sits on the zone's corner, INSET px in.
  const box = {
    x: sx === 1 ? zone.x + INSET : zone.x + zone.w - INSET - w,
    y: sy === 1 ? zone.y + INSET : zone.y + zone.h - INSET - h,
    w, h,
  };
  const ax = sx === 1 ? box.x - scale * b.x : box.x + w + scale * b.x;
  const ay = sy === 1 ? box.y - scale * b.y : box.y + h + scale * b.y;
  // Belt and braces: clampToZone must leave this box exactly where it is.
  const chk = clampToZone(box, zone, INSET - 0.5);
  if (chk.scale < 1 || Math.abs(chk.dx) > 0.01 || Math.abs(chk.dy) > 0.01 || !boxInside(box, zone)) {
    throw new Error(`shapeLayout: ${variant}/${c} box ${JSON.stringify(box)} is not inside the visual zone`);
  }
  return { geometry: g, corner: c, ax, ay, sx, sy, scale, box };
}
