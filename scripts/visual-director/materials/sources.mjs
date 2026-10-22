/**
 * sources.mjs — the material resolver's search + download, wrapping the asset-sourcing skill's
 * existing source clients. Nothing here is a new API client:
 *
 *   Wikimedia Commons   src/skills/asset-sourcing/sources/wikimedia.js  search()  (licence allowlist applied there)
 *   Wikipedia lead img  scripts/entity-assets.cjs getJson() + fileNameOf() + fileInfo()  (the article's own lead image)
 *   archives / museums  met, loc, nara, smithsonian, nasa, openverse  (same modules fetch-library.js uses)
 *   stock               pexels, pixabay, unsplash  — ONLY for kinds that are not a specific historical
 *                       record (photo, object-cutout). A stock site never has "the Bayeux Tapestry".
 *   licences            src/skills/asset-sourcing/licenses.js normalizeLicense()  — PD / CC0 / CC-BY / stock
 *                       licences only; CC-BY-SA and NC are refused (licenses.js says why)
 *   download            src/skills/asset-sourcing/http.js downloadFile()
 *
 * fetch-library.js itself is not imported: it runs its CLI main() on import.
 *
 * Every candidate comes back in one shape:
 *   { source, title, source_url, download_url, license, credit, description }
 * A candidate whose licence is not on the allowlist is returned with license: null and is refused by
 * the resolver before download (logged, never used).
 *
 * Where this stops: these are live HTTP clients; they are exercised in CI (visual-director-proof),
 * never by the unit tests, which inject their own search/download.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);

const ARCHIVE = ["met", "loc", "nara", "smithsonian", "nasa", "openverse"];
const STOCK = ["pexels", "pixabay", "unsplash"];
// Kinds whose must_show can be a generic, real thing (a stock photo of a gavel is a gavel).
// Every other kind is a specific record and is searched in Commons / Wikipedia / archives only.
const STOCK_KINDS = new Set(["photo", "object-cutout"]);

/** Source names, in the order they are asked, for one material kind. Commons always first. Pure. */
export function sourceOrder(kind) {
  return ["wikimedia", "wikipedia-lead", ...ARCHIVE, ...(STOCK_KINDS.has(kind) ? STOCK : [])];
}

let _mods = null;
async function mods() {
  if (_mods) return _mods;
  const base = "../../../src/skills/asset-sourcing";
  const names = ["wikimedia", ...ARCHIVE, ...STOCK];
  const loaded = await Promise.all(names.map((n) => import(`${base}/sources/${n}.js`)));
  _mods = Object.fromEntries(names.map((n, i) => [n, loaded[i]]));
  _mods.licenses = await import(`${base}/licenses.js`);
  _mods.http = await import(`${base}/http.js`);
  return _mods;
}

function fromSkill(c) {
  return {
    source: c.sourceApi,
    title: c.title || "",
    source_url: c.sourceUrl || null,
    // Commons renders TIFF/SVG/PDF scans to a raster thumbnail; prefer it (the renderer needs a raster)
    download_url: c.thumbUrl || c.downloadUrl,
    license: c.license || null,
    credit: c.attribution || null,
    description: (c.sourceText && (c.sourceText.description || c.sourceText.title || c.sourceText.tags)) || "",
  };
}

/** The lead image of the English Wikipedia article a search for `query` lands on (entity-assets.cjs helpers). */
async function wikipediaLead(query) {
  const ea = require("../../entity-assets.cjs");
  const { normalizeLicense } = (await mods()).licenses;
  const s = await ea.getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=${encodeURIComponent(query)}`);
  const title = s?.query?.search?.[0]?.title;
  if (!title) return [];
  const sum = await ea.getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`);
  const src = sum?.originalimage?.source;
  if (!src || sum.type === "disambiguation") return [];
  const info = await ea.fileInfo(ea.fileNameOf(src));
  if (!info) return [];
  return [{
    source: "wikipedia-lead",
    title: info.title,
    source_url: info.descurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(info.title)}`,
    download_url: info.thumb || info.url,
    license: normalizeLicense(info.license),
    credit: info.artist ? `${info.artist} via Wikimedia Commons` : "Wikimedia Commons",
    description: `lead image of the Wikipedia article "${sum.title}"`,
  }];
}

/** search(source, query, { count }) -> candidates[] in the shape above. Throws on network error (the resolver logs it). */
export async function searchSource(source, query, { count = 6 } = {}) {
  if (source === "wikipedia-lead") return wikipediaLead(query);
  const m = await mods();
  const mod = m[source];
  if (!mod) throw new Error(`unknown source ${source}`);
  // Commons: a standard thumbnail step (1280) — a non-standard width is generated on demand and 429s (wikimedia.js)
  const opts = source === "wikimedia" ? { count, thumbWidth: 1280 } : { count };
  const out = await mod.search(query, opts);
  // licence allowlist re-applied on the way out, whatever the source module did
  return (out || []).filter(Boolean).map(fromSkill).map((c) => ({ ...c, license: m.licenses.normalizeLicense(c.license) }));
}

/** download(url, dest) -> { bytes } (http.js downloadFile). */
export async function download(url, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  return (await mods()).http.downloadFile(url, dest, { timeoutMs: 45000 });
}
