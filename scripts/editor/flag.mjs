/**
 * A country's national flag, for a sentence that names the country: the flag is the country's own symbol and is shown on a plate the same
 * way an organisation's mark is (auto-plan.mjs step 0). Source: the flag file on Wikimedia Commons titled "Flag of <Country>" (SVG or PNG),
 * taken only when its licence is free (public domain or a Creative Commons licence). Nothing is drawn or redrawn here: the flag is rasterised
 * as published, with its transparency kept.
 */
import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const UA = "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; flags)";
const FREE = /^(cc0|cc[- ]by|cc[- ]by[- ]sa|public domain|pd|ogl|gfdl|attribution)/i;

const strip = (v) => String(v?.value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Commons files titled "Flag of <country>" (exact title start), free-licensed SVG or PNG, best first. */
export async function findFlagFiles(country, fetchJson) {
  const q = `Flag of ${country}`;
  const u = `${COMMONS}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=${encodeURIComponent(`intitle:"${q}"`)}&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1024`;
  const j = await fetchJson(u);
  const pages = Object.values(j?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = [];
  for (const p of pages) {
    const title = String(p.title || "").replace(/^File:/, "");
    const ii = p.imageinfo?.[0];
    if (!ii || !new RegExp(`^Flag of ${country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?![\\p{L}])`, "iu").test(title)) continue;
    if (/\b(map|locator|coat|emblem|historical|former|1\d{3}|2\d{3}|variant|alternative|old|proposed|imperial|royal|naval|military|president|governor)\b/i.test(title)) continue;
    if (!/^image\/(svg\+xml|png)$/i.test(ii.mime || "")) continue;
    const md = ii.extmetadata || {};
    const license = strip(md.LicenseShortName) || strip(md.UsageTerms);
    if (!license || /non-?free|fair use/i.test(license) || !FREE.test(license)) continue;
    out.push({ title, url: ii.url, thumb: ii.thumburl || ii.url, mime: ii.mime, license, page: ii.descriptionurl,
      credit: `Flag: ${country}, ${license}, Wikimedia Commons` });
  }
  return out;
}

async function getJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: ctl.signal });
    return res.ok ? await res.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

/** Rasterise a flag to a PNG (transparency kept), returns { file (relative to the repo), width, height, dark_mark }. */
export async function saveFlagPng(rec, country, { fetch: doFetch = fetch } = {}) {
  const sharp = require("sharp");
  const res = await doFetch(rec.url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`flag download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const svg = /svg/i.test(rec.mime || "");
  const img = svg ? sharp(buf, { density: 240 }) : sharp(buf);
  const png = await img.resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: !svg }).ensureAlpha().png().toBuffer();
  const slug = country.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const abs = join(ROOT, "data", "editor", "auto", "flags", `${slug}.png`);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, png);
  const meta = await sharp(png).metadata();
  return { file: abs.slice(ROOT.length + 1).split("\\").join("/"), width: meta.width, height: meta.height, abs };
}

/** The flag finder the planner calls: { ok, file, width, height, credit, source_url, license, dark_mark } | { ok:false, why }. */
export function flagFinder({ fetchJson = getJson, isDark } = {}) {
  const cache = new Map();
  return async ({ country }) => {
    if (cache.has(country)) return cache.get(country);
    let out = { ok: false, why: "no free-licence flag on Wikimedia Commons" };
    for (const rec of (await findFlagFiles(country, fetchJson)).slice(0, 3)) {
      try {
        const saved = await saveFlagPng(rec, country);
        out = { ok: true, file: saved.file, width: saved.width, height: saved.height, credit: rec.credit, source_url: rec.page, license: rec.license, dark_mark: isDark ? await isDark(saved.abs) : false };
        break;
      } catch (e) { out = { ok: false, why: e.message }; }
    }
    cache.set(country, out);
    return out;
  };
}
