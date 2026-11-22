/**
 * Hidden Past maps. The country a story happens in is framed, tinted and named, its neighbours are
 * named for orientation, and a small world inset shows where on Earth that is.
 *
 * Geometry: Natural Earth 1:50m (public domain), trimmed to the fields used here by a one-off
 * script, for the detail view; the repo's 1:110m file for the inset. Equirectangular with a
 * latitude correction, so countries keep a recognisable shape at this scale.
 *
 * Where it stops: a place that falls in the sea or in no country polygon gets no tint. The map
 * still draws, framed on the place itself. Maps do not cross the antimeridian.
 */
import { join } from "node:path";
import { ROOT, readJson } from "./lib.mjs";
import { H, W, fit, solid, stroke, text } from "./visual-common.mjs";

export const AREA = { x: 60, y: 300, w: 960, h: 1120 };
const INSET = { x: AREA.x + 18, y: AREA.y + AREA.h - 178, w: 270, h: 160 };
const round = (n) => Math.round(n);
const COAST_TOLERANCE_DEG = 0.6;

let detail, world;
const loadDetail = () => (detail ||= readJson(join(ROOT, "data/geo/ne_50m_countries.min.json")));
const loadWorld = () => (world ||= readJson(join(ROOT, "src/skills/remotion-render/public/geo/ne_110m_admin_0_countries.geojson")));
export const polygonsOf = (f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates);

function inRing([lon, lat], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const ringBox = (ring) => ring.reduce((b, [x, y]) => ({ w: Math.min(b.w, x), e: Math.max(b.e, x), s: Math.min(b.s, y), n: Math.max(b.n, y) }), { w: 180, e: -180, s: 90, n: -90 });

/** Finds each place's country and a view that fits those countries, shaped to the map panel. */
/** opts.zoom: frame on the places themselves instead of the whole country (the country is still tinted and named in the locator). */
export function frameMap(points, features = loadDetail().features, opts = {}) {
  const focus = new Map();
  const parts = [];
  for (const p of points) {
    let hit = null, nearest = null, best = COAST_TOLERANCE_DEG;
    for (const f of features) for (const poly of polygonsOf(f)) {
      if (inRing([p.lon, p.lat], poly[0])) hit = { f, poly };
      for (const [x, y] of poly[0]) { const d = Math.hypot(x - p.lon, y - p.lat); if (d < best) { best = d; nearest = { f, poly }; } }
    }
    // Harbours and coastal cities can sit just outside a simplified coastline.
    const found = hit || nearest;
    if (found) { focus.set(found.f.properties.NAME, found.f); if (!opts.zoom) parts.push(ringBox(found.poly[0])); }
  }
  for (const p of points) parts.push({ w: p.lon, e: p.lon, s: p.lat, n: p.lat });
  let box = parts.reduce((a, b) => ({ w: Math.min(a.w, b.w), e: Math.max(a.e, b.e), s: Math.min(a.s, b.s), n: Math.max(a.n, b.n) }));
  const pad = opts.zoom ? (typeof opts.zoom === "number" ? opts.zoom : 3.2) : Math.max(1.5, 0.22 * Math.max(box.e - box.w, box.n - box.s));
  box = { w: box.w - pad, e: box.e + pad, s: box.s - pad, n: box.n + pad };
  const cos = Math.max(0.35, Math.cos((((box.s + box.n) / 2) * Math.PI) / 180));
  // Widen whichever side is short, so the view fills the panel without stretching the land.
  // opts.area: the panel to fill (long-form 16:9 passes its own); Shorts keep the default AREA.
  const A = opts.area || AREA;
  const target = A.w / A.h, wide = (box.e - box.w) * cos, tall = box.n - box.s;
  if (wide / tall < target) { const need = (tall * target) / cos, mid = (box.w + box.e) / 2; box.w = mid - need / 2; box.e = mid + need / 2; }
  else { const need = wide / target, mid = (box.s + box.n) / 2; box.s = mid - need / 2; box.n = mid + need / 2; }
  const k = A.h / (box.n - box.s);
  const project = ([lon, lat]) => [round(A.x + (lon - box.w) * cos * k), round(A.y + (box.n - lat) * k)];
  return { box, project, focus: [...focus.keys()], focusFeatures: [...focus.values()], features };
}

/** Sutherland-Hodgman: keeps the part of a ring inside the window, so a zoomed view never carries coordinates thousands of pixels off screen. */
function clipRing(ring, b) {
  const sides = [
    [(p) => p[0] >= b.x0, (p, q) => [b.x0, p[1] + ((q[1] - p[1]) * (b.x0 - p[0])) / (q[0] - p[0])]],
    [(p) => p[0] <= b.x1, (p, q) => [b.x1, p[1] + ((q[1] - p[1]) * (b.x1 - p[0])) / (q[0] - p[0])]],
    [(p) => p[1] >= b.y0, (p, q) => [p[0] + ((q[0] - p[0]) * (b.y0 - p[1])) / (q[1] - p[1]), b.y0]],
    [(p) => p[1] <= b.y1, (p, q) => [p[0] + ((q[0] - p[0]) * (b.y1 - p[1])) / (q[1] - p[1]), b.y1]],
  ];
  let pts = ring;
  for (const [inside, cross] of sides) {
    const next = [];
    pts.forEach((cur, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (inside(cur)) { if (!inside(prev)) next.push(cross(prev, cur)); next.push(cur); }
      else if (inside(prev)) next.push(cross(prev, cur));
    });
    pts = next;
    if (!pts.length) break;
  }
  return pts.map(([x, y]) => [round(x), round(y)]);
}
const CLIP_WINDOW = { x0: AREA.x - 300, x1: AREA.x + AREA.w + 300, y0: AREA.y - 300, y1: AREA.y + AREA.h + 300 };

export function pathOf(polys, project, clip = false, area = AREA) {
  const win = area === AREA ? CLIP_WINDOW : { x0: area.x - 300, x1: area.x + area.w + 300, y0: area.y - 300, y1: area.y + area.h + 300 };
  const out = [];
  for (const poly of polys) {
    let ring = poly[0].map(project);
    if (clip) ring = clipRing(ring, win);
    const pts = [];
    for (const c of ring) { const q = c.join(" "); if (pts.at(-1) !== q) pts.push(q); }
    if (pts.length > 2) out.push("M" + pts.join(" L") + " Z");
  }
  return out.join(" ");
}

const overlaps = (b, list) => list.some((o) => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1);
const insideMap = (b) => b.x0 >= AREA.x + 14 && b.x1 <= AREA.x + AREA.w - 14 && b.y0 >= AREA.y + 14 && b.y1 <= AREA.y + AREA.h - 14;

/** Draws the whole map into `layers`. Returns the located places and tinted countries for the record. */
export function buildMapLayers({ id, inF, outF, points, P, font, nextZ, layers, handCircle, zoom = false, avoidRoute = false }) {
  const span = outF - inF, m = frameMap(points, undefined, { zoom }), { box, project } = m;
  const canvas = { rect: { x: 0, y: 0, w: W, h: H }, in: inF, out: outF, type: "svg", viewBox: [0, 0, W, H] };
  const clip = { clipT: (AREA.y / H) * 100, clipB: ((H - AREA.y - AREA.h) / H) * 100, clipL: (AREA.x / W) * 100, clipR: ((W - AREA.x - AREA.w) / W) * 100 };
  layers.push(solid(`${id}-sea`, { ...AREA, background: P.sea, boxShadow: P.shadow, inF, outF, z: nextZ() }));

  const visible = (poly) => { const b = ringBox(poly[0]); return b.w < box.e && b.e > box.w && b.s < box.n && b.n > box.s; };
  const focused = new Set(m.focusFeatures);
  const others = m.features.filter((f) => !focused.has(f)).flatMap((f) => polygonsOf(f).filter(visible));
  layers.push({ ...canvas, id: `${id}-land`, z: nextZ(), props: { opacity: 1, draw: 1, ...clip }, paths: [{ d: pathOf(others, project, !!zoom), fill: P.land, stroke: P.stroke, strokeWidth: 2 }] });
  if (m.focusFeatures.length) {
    const polys = m.focusFeatures.flatMap((f) => polygonsOf(f).filter(visible));
    layers.push({ ...canvas, id: `${id}-country`, z: nextZ(), props: { opacity: 1, draw: 0, ...clip }, paths: [{ d: pathOf(polys, project, !!zoom), fill: P.focus, stroke: P.stroke, strokeWidth: 5 }], keyframes: { draw: [{ f: 0, v: 0, e: "linear" }, { f: 4, v: 0 }, { f: Math.min(22, span), v: 1, e: "inOutCubic" }, { f: span, v: 1 }] } });
  }

  const pts = points.map((c) => ({ ...c, xy: project([c.lon, c.lat]) }));
  const routeFrames = Math.min(45, span - 16);
  if (pts.length >= 2) layers.push(stroke(`${id}-route`, "M" + pts.map((q) => q.xy.join(" ")).join(" L"), { color: P.accent, width: 7, inF, outF, z: nextZ(), delay: 8, drawFrames: routeFrames }));

  const placed = [{ x0: INSET.x, x1: INSET.x + INSET.w, y0: INSET.y, y1: INSET.y + INSET.h }];
  // Optional: keep place names off the drawn route (boxes along each leg), so a line never strikes through a label.
  if (avoidRoute) for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1].xy, [bx, by] = pts[i].xy, n = Math.ceil(Math.hypot(bx - ax, by - ay) / 16); for (let k = 0; k <= n; k++) { const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n; placed.push({ x0: x - 12, x1: x + 12, y0: y - 12, y1: y + 12 }); } }
  pts.forEach((q, i) => {
    const [x, y] = q.xy, r = 14, at = inF + 8 + i * 14;
    layers.push(stroke(`${id}-pin${i}`, `M${x} ${y - r} A${r} ${r} 0 1 1 ${x} ${y + r} A${r} ${r} 0 1 1 ${x} ${y - r} Z`, { color: P.accent, width: 5, fill: P.accent, inF: at, outF, z: nextZ(), drawFrames: 8 }));
    layers.push(stroke(`${id}-ring${i}`, handCircle(x, y, 44, 44, i * 37 + 19), { color: P.accent, width: 5, inF: at, outF, z: nextZ(), delay: 10, drawFrames: 16 }));
    placed.push({ x0: x - 50, x1: x + 50, y0: y - 50, y1: y + 50 });
    const lf = fit(q.name, { maxW: 340, maxLines: 1, max: 40, min: 28 });
    if (!lf) return;
    for (const [lx, ly, align] of [[x + 56, y - 22, "left"], [x - 416, y - 22, "right"], [x - 180, y - 104, "center"], [x - 180, y + 58, "center"]]) {
      const label = text(`${id}-place${i}`, lf.text, { x: round(lx), w: 360, y: round(ly), size: lf.size, weight: 700, align, color: P.text, inF: at, outF, z: 0, font, slideX: -30, slide: 0 });
      if (insideMap(label.box) && !overlaps(label.box, placed)) { label.z = nextZ(); layers.push(label); placed.push(label.box); break; }
    }
  });

  // The tinted country is named first, large; neighbours take whatever room is left.
  const inView = ([lon, lat]) => lon > box.w && lon < box.e && lat > box.s && lat < box.n;
  const labelPoint = (f) => [f.properties.LABEL_X, f.properties.LABEL_Y];
  const nameLabel = (name, at, { size, weight, color, tracking }, n, offsets) => {
    const f = fit(name.toUpperCase(), { maxW: 620, maxLines: 1, max: size, min: Math.round(size * 0.6), tracking });
    if (!f) return false;
    const [x, y] = project(at);
    for (const dy of offsets) {
      const label = text(`${id}-country${n}`, f.text, { x: x - 330, w: 660, y: y + dy, size: f.size, weight, color, inF: inF + 12, outF, z: 0, font, slide: 12, tracking });
      if (insideMap(label.box) && !overlaps(label.box, placed)) { label.z = nextZ(); layers.push(label); placed.push(label.box); return true; }
    }
    return false;
  };
  let n = 0;
  const alreadyNamed = (f) => pts.some((q) => q.name.toLowerCase() === f.properties.NAME.toLowerCase());
  for (const f of m.focusFeatures) if (inView(labelPoint(f)) && !alreadyNamed(f)) nameLabel(f.properties.NAME, labelPoint(f), { size: 64, weight: 700, color: P.text, tracking: 0.06 }, n++, [-34, 40, -110, 110, -180, 180]);
  const neighbours = m.features.filter((f) => !focused.has(f) && inView(labelPoint(f)) && f.properties.LABELRANK <= 5).sort((a, b) => a.properties.LABELRANK - b.properties.LABELRANK).slice(0, 7);
  for (const f of neighbours) nameLabel(f.properties.NAME, labelPoint(f), { size: 32, weight: 600, color: P.muted, tracking: 0.08 }, n++, [-18, 22]);

  // Where on Earth: a small whole-world locator with the same country tinted and the view boxed.
  const insetProject = ([lon, lat]) => [round(INSET.x + (lon + 180) * (INSET.w / 360)), round(INSET.y + INSET.h / 2 + 10 - (lat - 12) * (INSET.w / 360))];
  const insetIn = inF + 14;
  layers.push(solid(`${id}-inset`, { ...INSET, background: P.panel, boxShadow: P.shadow, inF: insetIn, outF, z: nextZ() }));
  const worldPolys = loadWorld().features.flatMap((f) => polygonsOf(f));
  const focusPolys = loadWorld().features.filter((f) => m.focus.includes(f.properties.NAME)).flatMap((f) => polygonsOf(f));
  layers.push({ ...canvas, id: `${id}-world`, in: insetIn, z: nextZ(), props: { opacity: 1, draw: 1 }, paths: [{ d: pathOf(worldPolys, insetProject), fill: P.surface, stroke: P.stroke, strokeWidth: 1 }, ...(focusPolys.length ? [{ d: pathOf(focusPolys, insetProject), fill: P.accent, stroke: P.accent, strokeWidth: 1 }] : [])] });
  const [ax, ay] = insetProject([box.w, box.n]), [bx, by] = insetProject([box.e, box.s]);
  layers.push(stroke(`${id}-viewbox`, `M${ax} ${ay} L${bx} ${ay} L${bx} ${by} L${ax} ${by} Z`, { color: P.accent, width: 3, inF: insetIn, outF, z: nextZ(), delay: 8, drawFrames: 12 }));
  return { pts, focus: m.focus, route: pts.length >= 2 ? { in_f: inF + 8, end_f: inF + 8 + routeFrames } : null };
}
