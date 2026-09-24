import React from "react";
import { registerObject } from "./registry.js";
import { GEO_REGIONS, resolveRegion, resolveRoute } from "../../visual/geo-regions.js";

/**
 * THE MAP FAMILY — editorial maps built from real borders, built on screen.
 *
 * Spec: docs/MAP-REFERENCE.md. Audit of what this replaces: docs/MAP-AUDIT.md
 * (every earlier map drawing was a hand-made placeholder polygon; the
 * "Venezuela" in the owner's review was an 11-point wobble around an ellipse).
 *
 * GEOGRAPHY. Natural Earth 110m, public domain, simplified to <= 50 points
 * per region by visual/build-geo-regions.mjs. A region that is not in that
 * data cannot be drawn: every drawing here throws on an unresolved region
 * rather than inventing a border (CLAUDE.md hard rule: nothing on screen
 * that did not come from a real source).
 *
 * WHERE THE REGION COMES FROM. The composition object's `label` — the
 * region's name as the narration says it ("Venezuela", "Florida"). No new
 * plan field: validateScene() (scene-primitives.js) checks at plan time that
 * the label resolves, so a plan cannot reach the renderer with a map of
 * nowhere. map-route takes "A → B" (or "A to B"); map-markers takes `count`.
 *
 * ONE FRAME, FIVE LAYERS. ComposedScene lays objects out in separate
 * non-overlapping slots, so five separate objects could not stack on one
 * map. Each drawing is therefore a complete map, named for the layer it
 * leads with; they share one engine and one build order:
 *
 *   map-outline           geography + label
 *   map-region-highlight  geography + region fill + label
 *   map-markers           geography + region fill + N markers + label
 *   map-route             geography (both ends) + route + label
 *   map-label             geography + label, the leader line is the event
 *
 * BUILD ORDER (docs/MAP-REFERENCE.md §3-4), as fractions of the beat `p`:
 *   1 outline draws on, stroke by stroke        0.00-0.15
 *   2 region fill follows a left-to-right sweep 0.12-0.24
 *   3 markers pop in one after another          0.24-0.34
 *   4 route travels origin -> destination       0.24-0.38
 *   5 leader line draws, then the label types   0.34-0.39, 0.39-0.46
 * Everything is complete by 0.46 of the beat. That is deliberate: the
 * per-beat frame check samples the beat MIDPOINT (gemini-frame-review.js
 * --beat-check), and a map still half-built at 0.5 would be judged on a
 * partial frame. On a 4-6 s beat, 0.46 is 1.8-2.8 s, close to the ~2 s
 * build the spec asked for; the drawing contract passes `p`, not seconds.
 *
 * Deterministic: no randomness except a seeded hash, so a re-render is
 * byte-identical.
 */

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export const MAP_DRAWINGS = ["map-outline", "map-region-highlight", "map-markers", "map-route", "map-label"];

function regionOrThrow(name, drawing) {
  const id = resolveRegion(name);
  if (!id) {
    throw new Error(`${drawing}: "${name}" is not a region in the Natural Earth data — no border is invented for it`);
  }
  return id;
}

/* ── Projection ─────────────────────────────────────────────────────────── */

/**
 * Equirectangular with cos(latitude) at the view's centre, fitted into the
 * box. Adequate for one country or a pair: the distortion that matters at
 * world scale does not show at this framing.
 */
function makeView(frames, box, pad = 0.38) {
  let [x0, y0, x1, y1] = frames.reduce(
    (a, f) => [Math.min(a[0], f[0]), Math.min(a[1], f[1]), Math.max(a[2], f[2]), Math.max(a[3], f[3])],
    [Infinity, Infinity, -Infinity, -Infinity]
  );
  const midLat = (y0 + y1) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  let w = (x1 - x0) * k, h = y1 - y0;
  w = Math.max(w, 0.5); h = Math.max(h, 0.5);
  const cxw = ((x0 + x1) / 2) * k, cyw = (y0 + y1) / 2;
  w *= 1 + pad * 2; h *= 1 + pad * 2;
  const boxAspect = box.w / box.h;
  if (w / h < boxAspect) w = h * boxAspect; else h = w / boxAspect;
  const s = box.w / w;
  const project = ([lon, lat]) => [
    box.x + box.w / 2 + (lon * k - cxw) * s,
    box.y + box.h / 2 - (lat - cyw) * s,
  ];
  const lonSpan = w / k / 2, latSpan = h / 2;
  const viewBounds = [cxw / k - lonSpan, cyw - latSpan, cxw / k + lonSpan, cyw + latSpan];
  return { project, viewBounds };
}

const ringPath = (ring, project) =>
  ring.map((pt, i) => { const [x, y] = project(pt); return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ") + " Z";

function regionBounds(r) {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of r.rings) for (const [x, y] of ring) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
  return b;
}
const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Deterministic points inside a region's main ring (seeded lattice walk). */
function interiorPoints(region, n, seed) {
  const ring = region.rings[0];
  const [x0, y0, x1, y1] = region.frame;
  const pts = [];
  for (let i = 0; pts.length < n && i < n * 400; i++) {
    const h1 = ((seed + i * 2654435761) >>> 0) % 10007 / 10007;
    const h2 = ((seed * 7 + i * 40503) >>> 0) % 10009 / 10009;
    const pt = [x0 + (x1 - x0) * (0.08 + 0.84 * h1), y0 + (y1 - y0) * (0.08 + 0.84 * h2)];
    if (!inRing(pt, ring)) continue;
    // keep markers apart so N reads as N
    const minD = Math.min(x1 - x0, y1 - y0) / (Math.sqrt(n) * 2.4);
    if (pts.some((q) => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < minD)) continue;
    pts.push(pt);
  }
  return pts;
}

/** A point to hang the label on: the main ring's interior point nearest its bbox centre. */
function anchorOf(region) {
  const [x0, y0, x1, y1] = region.frame;
  const c = [(x0 + x1) / 2, (y0 + y1) / 2];
  if (inRing(c, region.rings[0])) return c;
  const cands = interiorPoints(region, 12, 97);
  cands.sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1]));
  return cands[0] || c;
}

/* ── The engine ─────────────────────────────────────────────────────────── */

function MapBuild({ box, colors, p, uid, font, target, fill, markers, route, labelText }) {
  const P = Number.isFinite(p) ? p : 1;
  const region = GEO_REGIONS[target];
  const routeRegions = route ? route.map((id) => GEO_REGIONS[id]) : null;
  const frames = routeRegions ? routeRegions.map((r) => r.frame) : [region.frame];
  const { project, viewBounds } = makeView(frames, box);

  const tOutline = easeOut(seg(P, 0.0, 0.15));
  const tFill = easeOut(seg(P, 0.12, 0.24));
  const tRoute = easeOut(seg(P, 0.24, 0.38));
  const tLeader = easeOut(seg(P, 0.34, 0.39));
  const tType = seg(P, 0.39, 0.46);

  const focusIds = route || [target];
  // Context around the focus. For a country: other countries. For a US
  // state: other states plus foreign countries — never the USA outline,
  // which would sit on top of the states.
  const usFocus = focusIds.some((id) => id.startsWith("us:"));
  const neighbours = Object.entries(GEO_REGIONS).filter(([id, r]) =>
    !focusIds.includes(id) &&
    (usFocus ? id !== "country:USA" : id.startsWith("country:")) &&
    overlaps(regionBounds(r), viewBounds)
  );

  const clipId = `mapclip-${uid}`;
  const sweepId = `mapsweep-${uid}`;
  const parts = [];

  // 1. Geography: neighbours as quiet context, the focus region(s) strong.
  neighbours.forEach(([id, r]) =>
    r.rings.forEach((ring, i) =>
      parts.push(
        <path key={`n-${id}-${i}`} d={ringPath(ring, project)} pathLength={1}
          fill={colors.onGround} fillOpacity={0.05 * tOutline}
          stroke={colors.onGround} strokeOpacity={0.3} strokeWidth={1.5} strokeLinejoin="round"
          strokeDasharray={1} strokeDashoffset={1 - tOutline} />
      )
    )
  );

  const focusPaths = focusIds.flatMap((id) => GEO_REGIONS[id].rings.map((ring, i) => ({ id, i, d: ringPath(ring, project) })));

  // 2. Region fill, revealed by a mask sweeping left to right.
  if (fill) {
    const [fx0] = project([regionBounds(region)[0], 0]);
    const [fx1] = project([regionBounds(region)[2], 0]);
    parts.push(
      <clipPath key="sweep" id={sweepId}>
        <rect x={Math.min(fx0, fx1) - 4} y={box.y} width={(Math.abs(fx1 - fx0) + 8) * tFill} height={box.h} />
      </clipPath>
    );
    GEO_REGIONS[target].rings.forEach((ring, i) =>
      parts.push(
        <path key={`f-${i}`} d={ringPath(ring, project)} clipPath={`url(#${sweepId})`}
          fill={colors.accent} fillOpacity={0.38} stroke="none" />
      )
    );
  }

  focusPaths.forEach(({ id, i, d }) =>
    parts.push(
      <path key={`o-${id}-${i}`} d={d} pathLength={1} fill="none"
        stroke={id === target && fill ? colors.accent : colors.onGround} strokeWidth={3.2}
        strokeLinejoin="round" strokeLinecap="round"
        strokeDasharray={1} strokeDashoffset={1 - tOutline} />
    )
  );

  // 3. Markers, one after another.
  if (markers) {
    const pts = interiorPoints(region, markers, 31);
    const r = Math.max(5, Math.min(box.w, box.h) * 0.018);
    pts.forEach((pt, i) => {
      const t0 = 0.24 + (0.1 * i) / Math.max(1, pts.length);
      const a = easeOut(seg(P, t0, t0 + 0.03));
      if (a <= 0) return;
      const [x, y] = project(pt);
      parts.push(
        <g key={`m-${i}`}>
          <circle cx={x} cy={y} r={r * (1 + 1.4 * (1 - a))} fill="none" stroke={colors.accent} strokeWidth={2} opacity={0.6 * (1 - a)} />
          <circle cx={x} cy={y} r={r * a} fill={colors.accent} stroke={colors.ground} strokeWidth={2} />
        </g>
      );
    });
  }

  // 4. Route, origin -> destination, arched, drawing itself.
  let routeEnd = null;
  if (routeRegions) {
    const [a, b] = routeRegions.map((r) => project(anchorOf(r)));
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.max(1, Math.hypot(dx, dy));
    // Arc to the side of the chord that points up the frame.
    let nx = -dy / len, ny = dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const lift = len * 0.28;
    const c = [mx + nx * lift, my + ny * lift];
    const d = `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
    parts.push(<circle key="r-a" cx={a[0]} cy={a[1]} r={7} fill={colors.onGround} opacity={tOutline} />);
    parts.push(
      <path key="r-path" d={d} pathLength={1} fill="none" stroke={colors.accent} strokeWidth={4}
        strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - tRoute} />
    );
    if (tRoute >= 1) parts.push(<circle key="r-b" cx={b[0]} cy={b[1]} r={9} fill={colors.accent} />);
    routeEnd = b;
  }

  // 5. Leader line, then the label types on.
  if (labelText) {
    const anchorPt = routeEnd || project(anchorOf(region));
    const fontSize = Math.max(28, Math.min(56, box.w * 0.075));
    const above = anchorPt[1] - box.y > box.h / 2;
    const ly = above ? box.y + fontSize * 1.1 : box.y + box.h - fontSize * 0.4;
    const leftHalf = anchorPt[0] < box.x + box.w / 2;
    const lx = leftHalf ? Math.max(box.x + 8, anchorPt[0] - box.w * 0.08) : Math.min(box.x + box.w - 8, anchorPt[0] + box.w * 0.08);
    const elbowY = above ? ly + fontSize * 0.35 : ly - fontSize * 1.15;
    const shown = labelText.slice(0, Math.round(labelText.length * tType));
    parts.push(
      <path key="leader" d={`M${anchorPt[0].toFixed(1)},${anchorPt[1].toFixed(1)} L${lx.toFixed(1)},${elbowY.toFixed(1)}`}
        pathLength={1} fill="none" stroke={colors.onGround} strokeWidth={2} strokeOpacity={0.8}
        strokeDasharray={1} strokeDashoffset={1 - tLeader} />
    );
    if (tLeader > 0) parts.push(<circle key="leader-dot" cx={anchorPt[0]} cy={anchorPt[1]} r={5} fill={colors.onGround} />);
    if (shown) {
      parts.push(
        <text key="label" x={lx} y={ly} textAnchor={leftHalf ? "start" : "end"}
          fill={colors.onGround} fontFamily={`${font || "sans-serif"}, sans-serif`} fontWeight={700} fontSize={fontSize}>
          {shown}
        </text>
      );
    }
  }

  return (
    <g>
      <clipPath id={clipId}><rect x={box.x} y={box.y} width={box.w} height={box.h} /></clipPath>
      <g clipPath={`url(#${clipId})`}>{parts}</g>
    </g>
  );
}

/* ── The five drawings ──────────────────────────────────────────────────── */

const regionDrawing = (name, opts) => ({ box, colors, p, uid, label, font }) => {
  const target = regionOrThrow(label, name);
  return <MapBuild box={box} colors={colors} p={p} uid={uid} font={font}
    target={target} labelText={String(label).trim()} {...opts} />;
};

registerObject("map-outline", regionDrawing("map-outline", { fill: false }));
registerObject("map-region-highlight", regionDrawing("map-region-highlight", { fill: true }));
registerObject("map-label", regionDrawing("map-label", { fill: false }));

registerObject("map-markers", ({ box, colors, p, uid, label, font, count }) => {
  const target = regionOrThrow(label, "map-markers");
  const n = Math.max(1, Math.min(30, Number.isInteger(count) ? count : 1));
  return <MapBuild box={box} colors={colors} p={p} uid={uid} font={font}
    target={target} fill markers={n} labelText={String(label).trim()} />;
});

registerObject("map-route", ({ box, colors, p, uid, label, font }) => {
  const route = resolveRoute(label);
  if (!route) {
    throw new Error(`map-route: "${label}" is not "<region> → <region>" with both ends in the Natural Earth data`);
  }
  const dest = String(label).split(/\s*(?:→|->|—>|\bto\b)\s*/i).filter(Boolean)[1].trim();
  return <MapBuild box={box} colors={colors} p={p} uid={uid} font={font}
    target={route[1]} route={route} labelText={dest} />;
});

/**
 * Legacy map names. Given a real region (through ComposedScene, where the
 * label is validated), they draw with the map engine. Called WITHOUT a region
 * — the older template-scene path, which passes no label — they return null
 * and the caller draws its original placeholder; see index.jsx/library.jsx.
 */
export function legacyMap(name, props) {
  if (!props.label) return null;
  if (name === "supply route") {
    const route = resolveRoute(props.label);
    if (!route) throw new Error(`supply route: "${props.label}" is not "<region> → <region>" in the Natural Earth data`);
    return <MapBuild {...props} target={route[1]} route={route}
      labelText={String(props.label).split(/\s*(?:→|->|—>|\bto\b)\s*/i).filter(Boolean)[1].trim()} />;
  }
  const target = regionOrThrow(props.label, name);
  return <MapBuild {...props} target={target} fill={name !== "national border line"} labelText={String(props.label).trim()} />;
}
