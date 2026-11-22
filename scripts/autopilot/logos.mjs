/**
 * Company logos for AI Tested. A logo appears only when the company is named in that scene's
 * narration, and only when a fetched file's own <title> names that company. Otherwise the scene
 * goes without: no lookalike, no generated mark.
 *
 * Sources: Simple Icons (CC0) and LobeHub icons (MIT). The licences cover the files; the marks
 * remain their owners' trademarks and are used only to identify the company being reported on.
 * Logos are vector layers, so they add no image asset and cost almost nothing to render.
 */
import { fetchWithTimeout, log } from "./lib.mjs";

const SOURCES = [
  { name: "Simple Icons (CC0)", url: (s) => `https://cdn.simpleicons.org/${s}` },
  { name: "LobeHub icons (MIT)", url: (s) => `https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.84.0/icons/${s}.svg` },
];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const firstWord = (s) => String(s).trim().split(/\s+/)[0];

const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];

/** Reads an icon file. Null if it holds anything but plain paths or does not name the company. */
export function parseLogo(svg, company) {
  if (!/^\s*<svg\b/.test(svg) || /<image|<use|<script|url\(/i.test(svg)) return null;
  const root = svg.match(/<svg\b[^>]*>/)[0];
  const title = (svg.match(/<title>([^<]*)<\/title>/) || [])[1];
  if (!title || !norm(title).includes(norm(firstWord(company)))) return null;
  const viewBox = (attr(root, "viewBox") || "").trim().split(/\s+/).map(Number);
  if (viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n))) return null;
  const rootFill = attr(root, "fill"), rootRule = attr(root, "fill-rule");
  const paths = [...svg.matchAll(/<path\b[^>]*>/g)].map(([tag]) => ({ d: attr(tag, "d"), fill: attr(tag, "fill") || rootFill, fillRule: attr(tag, "fill-rule") || rootRule })).filter((p) => p.d);
  return paths.length ? { title, viewBox, paths } : null;
}

const luminance = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

/** A mark in its own colour when that colour reads on a white page; otherwise in the page's ink. */
export function logoColor(fill, ink) {
  return /^#[0-9a-f]{6}$/i.test(fill || "") && luminance(fill) < 0.55 ? fill : ink;
}

function slugs(company) {
  const bare = String(company).replace(/\b(inc|corp|corporation|llc|ltd|technologies|labs?)\b\.?/gi, "").trim();
  return [...new Set([norm(company), norm(bare), norm(firstWord(company))])].filter(Boolean);
}

export async function fetchLogo(company, cache) {
  if (cache.has(company)) return cache.get(company);
  let found = null;
  search: for (const slug of slugs(company)) for (const source of SOURCES) {
    const url = source.url(slug);
    try {
      const r = await fetchWithTimeout(url);
      if (!r.ok) continue;
      const parsed = parseLogo(await r.text(), company);
      if (parsed) { found = { company, source: source.name, url, ...parsed }; break search; }
    } catch (e) { log("logos", `${url}: ${e.message}`); }
  }
  log("logos", `${company}: ${found ? `found at ${found.url}` : "no verified logo; the scene goes without one"}`);
  cache.set(company, found);
  return found;
}

/** Scene index to verified logos. A company counts only if its name is in that scene's narration. */
export async function logosForScenes(planned, scenes, research, cache) {
  const orgs = (research.named_entities || []).filter((e) => /organi[sz]ation|company|corp|org\b/i.test(String(e.type || ""))).map((e) => String(e.name));
  const out = new Map();
  for (const scene of scenes) {
    const said = norm(scene.text);
    const p = planned.find((x) => Number(x.index) === scene.index) || {};
    const names = [...new Set([p.company, ...orgs].filter((n) => n && said.includes(norm(firstWord(n)))))].slice(0, 2);
    const logos = (await Promise.all(names.map((n) => fetchLogo(n, cache)))).filter(Boolean);
    const unique = [...new Map(logos.map((l) => [l.url, l])).values()];
    if (unique.length) out.set(scene.index, unique);
  }
  return out;
}

/** The logos sit in a row in the open band between the channel kicker and the headline. */
export function logoLayers(id, logos, { inF, outF, P, nextZ }) {
  const size = 104, gap = 34, total = logos.length * size + (logos.length - 1) * gap;
  const span = Math.max(1, outF - inF);
  return logos.map((l, i) => ({
    id: `${id}-logo${i}`, type: "svg", rect: { x: Math.round((1080 - total) / 2 + i * (size + gap)), y: 205, w: size, h: size }, in: inF, out: outF, z: nextZ(), viewBox: l.viewBox,
    props: { opacity: 1, draw: 1 }, paths: l.paths.map((p) => ({ d: p.d, fill: logoColor(p.fill, P.text), fillRule: p.fillRule })),
    keyframes: { opacity: [{ f: 0, v: 0, e: "outCubic" }, { f: Math.min(8, span), v: 1 }, { f: span, v: 1 }], ty: [{ f: 0, v: 22, e: "outCubic" }, { f: Math.min(10, span), v: 0 }, { f: span, v: 0 }] },
  }));
}
