#!/usr/bin/env node
/**
 * Generate visual/geo-regions.js from Natural Earth 110m boundaries.
 *
 *   node src/skills/remotion-render/visual/build-geo-regions.mjs          # write
 *   node src/skills/remotion-render/visual/build-geo-regions.mjs --check  # exit 1 if stale
 *
 * Source (public domain, see public/geo/LICENSE-natural-earth.md):
 *   public/geo/ne_110m_admin_0_countries.geojson          177 countries
 *   public/geo/ne_110m_admin_1_states_provinces.geojson    51 US states + DC
 * both from github.com/nvkelso/natural-earth-vector @ master (ca96624a56bd).
 *
 * Borders are REAL, never drawn by hand (docs/MAP-REFERENCE.md §1). Each
 * region is simplified for a video frame, not for cartography:
 *   - rings smaller than 4% of the region's largest ring are dropped
 *     (tiny islands are invisible at this scale and cost points)
 *   - at most 3 rings are kept, largest first
 *   - Visvalingam-Whyatt removes the least-significant vertex until the
 *     region has at most MAX_POINTS points in total (min 4 per ring)
 * A ring spanning the antimeridian is unwrapped so its longitudes are
 * continuous (Russia, Fiji).
 *
 * Output is plain .js (no JSX) so the planner/validator (node) and the
 * Remotion bundle import the same data.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GEO = join(HERE, "..", "public", "geo");
const OUT = join(HERE, "geo-regions.js");
const MAX_POINTS = 50;
const MIN_RING_SHARE = 0.04;
const MAX_RINGS = 3;

const area = (r) => {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
};

function unwrap(ring) {
  const out = [ring[0].slice()];
  for (let i = 1; i < ring.length; i++) {
    let [x, y] = ring[i];
    const px = out[i - 1][0];
    while (x - px > 180) x -= 360;
    while (px - x > 180) x += 360;
    out.push([x, y]);
  }
  return out;
}

/** Visvalingam-Whyatt: drop the vertex whose triangle is smallest. */
function triArea(a, b, c) {
  return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
}
function simplify(rings, maxPts) {
  const rs = rings.map((r) => r.slice());
  const total = () => rs.reduce((s, r) => s + r.length, 0);
  while (total() > maxPts) {
    let best = null;
    rs.forEach((r, ri) => {
      if (r.length <= 4) return;
      for (let i = 0; i < r.length; i++) {
        const a = triArea(r[(i - 1 + r.length) % r.length], r[i], r[(i + 1) % r.length]);
        if (!best || a < best.a) best = { a, ri, i };
      }
    });
    if (!best) break;
    rs[best.ri].splice(best.i, 1);
  }
  return rs;
}

function ringsOf(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  // outer rings only; holes (lakes) are not drawn at this scale
  return polys.map((p) => {
    const r = p[0];
    const closed = r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1];
    return unwrap(closed ? r.slice(0, -1) : r);
  });
}

function build(feature) {
  let rings = ringsOf(feature.geometry).sort((a, b) => area(b) - area(a));
  const big = area(rings[0]);
  rings = rings.filter((r) => area(r) >= big * MIN_RING_SHARE).slice(0, MAX_RINGS);
  rings = simplify(rings, MAX_POINTS).map((r) => r.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]));
  const main = rings[0];
  const xs = main.map((p) => p[0]), ys = main.map((p) => p[1]);
  return { rings, frame: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

const norm = (s) => String(s || "").toLowerCase().replace(/^the\s+/, "").replace(/[.]/g, "").replace(/\s+/g, " ").trim();

const regions = {};
const aliases = {};
const addAlias = (a, id) => {
  const k = norm(a);
  if (!k || k === "-99") return;
  // A country wins a clash with a US state ("georgia"); the state stays
  // reachable as "<name> state" and by its postal code with "us-" prefix.
  if (aliases[k] && aliases[k].startsWith("country:") && id.startsWith("us:")) return;
  aliases[k] = id;
};

const countries = JSON.parse(readFileSync(join(GEO, "ne_110m_admin_0_countries.geojson"), "utf-8")).features;
for (const f of countries) {
  const p = f.properties;
  const code = p.ADM0_A3;
  const id = `country:${code}`;
  regions[id] = { name: p.NAME, ...build(f) };
  for (const a of [p.NAME, p.NAME_LONG, p.ADMIN, p.ISO_A3, p.ADM0_A3]) addAlias(a, id);
}
// Common short forms in narration. Only names that denote the same
// territory Natural Earth draws — "England" is NOT an alias for the UK.
const EXTRA = {
  "country:USA": ["USA", "US", "U.S.", "United States", "America"],
  "country:GBR": ["UK", "U.K.", "Britain", "Great Britain"],
  "country:RUS": ["Russian Federation"],
  "country:COD": ["DRC", "DR Congo", "Congo-Kinshasa"],
  "country:KOR": ["South Korea"],
  "country:PRK": ["North Korea"],
  "country:SAH": ["Western Sahara"],
  "country:CZE": ["Czech Republic"],
};
for (const [id, list] of Object.entries(EXTRA)) {
  if (!regions[id]) throw new Error(`alias target ${id} not in source data`);
  for (const a of list) addAlias(a, id);
}

const states = JSON.parse(readFileSync(join(GEO, "ne_110m_admin_1_states_provinces.geojson"), "utf-8")).features;
for (const f of states) {
  const p = f.properties;
  const id = `us:${p.postal}`;
  regions[id] = { name: p.name, ...build(f) };
  addAlias(p.name, id);
  addAlias(`${p.name} state`, id);
  addAlias(`us-${p.postal}`, id);
}

const total = Object.values(regions).reduce((s, r) => s + r.rings.reduce((t, x) => t + x.length, 0), 0);
const src = `/**
 * GENERATED by build-geo-regions.mjs from Natural Earth 110m (public domain)
 * — do not edit. ${Object.keys(regions).length} regions, ${total} points, <= ${MAX_POINTS} points each.
 * rings: [[lon, lat], ...] outer rings, largest first. frame: lon/lat bbox
 * of the largest ring (what a map of this region is framed on).
 */
export const GEO_REGIONS = ${JSON.stringify(regions)};

export const GEO_ALIASES = ${JSON.stringify(aliases)};

/** Region id for a place name, or null. Exact alias match, case-insensitive. */
export function resolveRegion(name) {
  const k = String(name || "").toLowerCase().replace(/^the\\s+/, "").replace(/[.]/g, "").replace(/\\s+/g, " ").trim();
  return GEO_ALIASES[k] || null;
}

/**
 * Split a route label "A → B" / "A -> B" / "A to B" into two region ids,
 * or null if either end does not resolve.
 */
export function resolveRoute(label) {
  const parts = String(label || "").split(/\\s*(?:→|->|—>|\\bto\\b)\\s*/i).filter(Boolean);
  if (parts.length !== 2) return null;
  const a = resolveRegion(parts[0]), b = resolveRegion(parts[1]);
  return a && b && a !== b ? [a, b] : null;
}
`;

if (process.argv.includes("--check")) {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf-8") : "";
  if (cur !== src) { console.error("geo-regions.js is stale — run build-geo-regions.mjs"); process.exit(1); }
  console.log(`geo-regions.js up to date (${Object.keys(regions).length} regions)`);
} else {
  writeFileSync(OUT, src);
  console.log(`wrote ${OUT} (${Object.keys(regions).length} regions, ${total} points, ${(src.length / 1024).toFixed(0)} KB)`);
}
