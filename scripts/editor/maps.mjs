/**
 * A drawn map with the place highlighted, for a sentence that names a country, a US state or a located place and has no photo.
 * Data: Natural Earth 1:110m countries and US states (public domain, src/skills/remotion-render/public/geo/). Nothing is invented: a region
 * is highlighted only if the sentence (or the research's named entities) names it; a pin only if a coordinate was looked up for a named place.
 *
 *   matchPlaces(text)   -> the countries / US states the text names
 *   buildMap(...)       -> SVG path strings (land outlines, highlight fills, pin) projected and clipped into a rect
 */
import { readFileSync } from "node:fs";

const GEO_DIR = new URL("../../src/skills/remotion-render/public/geo/", import.meta.url);
let CACHE = null;

export function loadGeo() {
  if (CACHE) return CACHE;
  const read = (f) => JSON.parse(readFileSync(new URL(f, GEO_DIR), "utf8"));
  const countries = read("ne_110m_admin_0_countries.geojson").features.map((f) => normalise(f, "country"));
  let states = [];
  try { states = read("ne_110m_admin_1_states_provinces.geojson").features.filter((f) => f.properties.iso_a2 === "US" || f.properties.ADM0_A3 === "USA" || f.properties.admin === "United States of America").map((f) => normalise(f, "state")); } catch { states = []; }
  CACHE = { countries, states };
  return CACHE;
}

function normalise(f, kind) {
  const p = f.properties || {};
  const names = new Set([p.NAME, p.NAME_LONG, p.ADMIN, p.NAME_EN, p.GEOUNIT, p.SOVEREIGNT, p.name, p.name_en].filter((n) => typeof n === "string" && n.length >= 4));
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  for (const poly of polys) for (const [x, y] of poly[0]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { kind, name: p.NAME_EN || p.NAME || p.name || "", names: [...names], polys, bbox: [minX, minY, maxX, maxY], area: (maxX - minX) * (maxY - minY) };
}

// short forms the data does not carry
const ALIASES = { "United States of America": ["United States", "U.S.", "US", "USA", "America"], "United Kingdom": ["Britain", "UK", "U.K.", "Great Britain"], "Russia": ["Russian Federation"], "Czechia": ["Czech Republic"], "United Arab Emirates": ["UAE"], "South Korea": ["Republic of Korea"], "North Korea": ["DPRK"], "Democratic Republic of the Congo": ["DR Congo", "DRC"], "Myanmar": ["Burma"] };
// words that are also place names but nearly always mean something else in a news sentence
const AMBIGUOUS = new Set(["Georgia", "Turkey", "Jersey", "Chad", "Guinea", "Niger", "Mali", "Jordan", "Washington", "Cuba Libre"]);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Countries and US states the text names (whole-word, case-sensitive), most specific first, at most `max`. */
export function matchPlaces(text, { max = 3 } = {}) {
  const { countries, states } = loadGeo();
  const t = String(text || "");
  const hits = [];
  const test = (f) => {
    const names = [...f.names, ...(ALIASES[f.name] || [])];
    for (const n of names) {
      if (AMBIGUOUS.has(n) && f.kind === "country") continue;
      if (new RegExp(`(?<![\\p{L}])${esc(n)}(?![\\p{L}])`, "u").test(t)) return n;
    }
    return null;
  };
  for (const f of states) { const n = test(f); if (n) hits.push({ f, matched: n }); }
  for (const f of countries) { const n = test(f); if (n && !hits.some((h) => h.f.name === f.name)) hits.push({ f, matched: n }); }
  // a state named alongside its country: keep the state (more specific) and the country as context only if nothing else
  return hits.sort((a, b) => (a.f.kind === "state" ? 0 : 1) - (b.f.kind === "state" ? 0 : 1) || a.f.area - b.f.area).slice(0, max);
}

/** Sutherland-Hodgman clip of one ring to a lon/lat box. */
export function clipRing(ring, [x0, y0, x1, y1]) {
  const edges = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  let out = ring;
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    if (!input.length) break;
    let prev = input[input.length - 1];
    for (const cur of input) {
      if (inside(cur)) { if (!inside(prev)) out.push(cross(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cross(prev, cur));
      prev = cur;
    }
  }
  return out;
}

/**
 * Project the places into a w x h rect. highlight: [{f}] features to fill; pin: {lon, lat} | null.
 * Returns { land, highlights:[{name, d, cx, cy}], pin:{x,y}|null, view:{lon0,lon1,lat0,lat1} } where every d is an SVG path in rect pixels.
 */
export function buildMap({ highlight, pin = null, w, h, pad = 0.35 }) {
  const { countries, states } = loadGeo();
  const feats = highlight.map((x) => x.f || x);
  let [minX, minY, maxX, maxY] = [180, 90, -180, -90];
  for (const f of feats) { minX = Math.min(minX, f.bbox[0]); minY = Math.min(minY, f.bbox[1]); maxX = Math.max(maxX, f.bbox[2]); maxY = Math.max(maxY, f.bbox[3]); }
  if (pin) { minX = Math.min(minX, pin.lon); maxX = Math.max(maxX, pin.lon); minY = Math.min(minY, pin.lat); maxY = Math.max(maxY, pin.lat); }
  if (minX > maxX) { minX = -30; maxX = 60; minY = -35; maxY = 60; }
  // never wider than the world; at least a regional view so a small country still shows its neighbours
  let spanX = Math.max(maxX - minX, 14), spanY = Math.max(maxY - minY, 9);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const k = Math.cos((cy * Math.PI) / 180) || 1; // east-west shrink at this latitude
  spanX *= 1 + pad * 2; spanY *= 1 + pad * 2;
  // fit the rect's aspect: x pixels per degree = y pixels per degree * k
  const aspect = w / h;
  if (spanX * k / spanY < aspect) spanX = (spanY * aspect) / k; else spanY = (spanX * k) / aspect;
  spanX = Math.min(spanX, 360); spanY = Math.min(spanY, 170);
  const lon0 = Math.max(-180, cx - spanX / 2), lon1 = Math.min(180, lon0 + spanX), lat0 = Math.max(-85, cy - spanY / 2), lat1 = Math.min(85, lat0 + spanY);
  const sx = w / (lon1 - lon0), sy = h / (lat1 - lat0);
  const px = (lon) => ((lon - lon0) * sx);
  const py = (lat) => (h - (lat - lat0) * sy);
  const box = [lon0, lat0, lon1, lat1];
  const path = (polys) => {
    const parts = [];
    for (const poly of polys) {
      const c = clipRing(poly[0], box);
      if (c.length < 3) continue;
      parts.push("M" + c.map(([x, y]) => `${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join(" L") + " Z");
    }
    return parts.join(" ");
  };
  const hl = new Set(feats.map((f) => f.kind + ":" + f.name));
  const intersects = (f) => !(f.bbox[2] < lon0 || f.bbox[0] > lon1 || f.bbox[3] < lat0 || f.bbox[1] > lat1);
  const usHighlighted = feats.some((f) => f.kind === "state");
  const land = [];
  for (const f of countries) if (intersects(f) && !hl.has("country:" + f.name)) land.push(path(f.polys));
  // a highlighted US state is drawn over the United States' own outline, with the other states as context
  if (usHighlighted) for (const f of states) if (intersects(f) && !hl.has("state:" + f.name)) land.push(path(f.polys));
  const highlights = feats.map((f) => {
    const d = path(f.polys);
    const bx0 = Math.max(f.bbox[0], lon0), bx1 = Math.min(f.bbox[2], lon1), by0 = Math.max(f.bbox[1], lat0), by1 = Math.min(f.bbox[3], lat1);
    return { name: f.name, d, cx: px((bx0 + bx1) / 2), cy: py((by0 + by1) / 2) };
  }).filter((x) => x.d);
  return { land: land.filter(Boolean).join(" "), highlights, pin: pin ? { x: px(pin.lon), y: py(pin.lat) } : null, view: { lon0, lon1, lat0, lat1 } };
}
