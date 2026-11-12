/** Long-form map data (1920x1080): Natural Earth land and borders (public domain) with coordinates from English Wikipedia, plus the baked relief base
 * (relief.mjs). Returns the plain data the long-form map scene draws: base image, land and country paths, pins, route. Present-day borders only. */
import { AREA, frameMap, pathOf, polygonsOf } from "../../scripts/autopilot/map-vox.mjs";
import { bakedBase } from "./relief.mjs";

const UA = { "User-Agent": "LongformMaps/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; evidence-led history)" };
const FULL = { x: 0, y: 0, w: 1920, h: 1080 };
async function getJson(url) { for (let i = 1; ; i++) { const r = await fetch(url, { headers: UA }); if (r.ok) return r.json(); if (i >= 4) throw new Error(`${url} -> ${r.status}`); await new Promise((res) => setTimeout(res, i * 3000)); } }
export async function coords(title) {
  const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates&redirects=1&titles=${encodeURIComponent(title)}`);
  const c = Object.values(j.query.pages)[0].coordinates?.[0];
  if (!c) throw new Error(`no coordinates for ${title}`);
  return { lat: c.lat, lon: c.lon };
}
/** places: [{ title, name }] (Wikipedia titles). opts.zoom: pad in degrees around the places; opts.territory: tint every country that contains a place. */
export async function mapFor(places, opts = {}) {
  const pts = []; for (const p of places) pts.push({ ...p, ...(await coords(p.title)) });
  const m = frameMap(pts, undefined, { area: FULL, ...(opts.zoom ? { zoom: opts.zoom } : {}) }), focused = new Set(m.focusFeatures);
  const landD = pathOf(m.features.filter((f) => !focused.has(f)).flatMap((f) => polygonsOf(f)), m.project, true, FULL);
  const countryD = pathOf(m.focusFeatures.flatMap((f) => polygonsOf(f)), m.project, true, FULL);
  const pins = pts.map((p) => { const [x, y] = m.project([p.lon, p.lat]); return { name: p.name, x, y, side: x > 1500 ? "left" : "right" }; });
  const base = await bakedBase({ box: m.box, area: FULL, landD: `${landD} ${countryD}`, sea: "#D3DCDC", land: "#F4EEE2", strength: opts.relief || 0.7 });
  return { landD, countryD, labels: [], pins, routeD: opts.noRoute ? "" : "M" + pins.map((p) => `${p.x} ${p.y}`).join(" L"), places: pts, base: base.uri, focus: m.focus };
}
