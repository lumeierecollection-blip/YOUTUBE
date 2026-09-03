/**
 * NASA Image and Video Library — PD (US government work), no key.
 * https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf
 *
 * A `copyright` field on an item means a non-NASA rights holder supplied
 * it (e.g. a partner institution's telescope image) — those are excluded
 * even though the search API mixes them in with genuine PD NASA imagery.
 */
import { fetchJson } from "../http.js";

const SEARCH = "https://images-api.nasa.gov/search";

export function parseNasaItem(item) {
  const data = (item.data && item.data[0]) || {};
  if (data.copyright) return null; // not a NASA PD work
  const links = item.links || [];
  const preview = links.find((l) => l.rel === "preview");
  if (!preview) return null;
  return {
    sourceApi: "nasa",
    sourceUrl: `https://images.nasa.gov/details-${data.nasa_id}`,
    downloadUrl: preview.href, // upgraded to ~orig via the collection manifest in fetchOriginal()
    title: data.title || "",
    sourceText: { title: data.title || "" },
    license: "PD",
    licenseRaw: "NASA Image and Video Library (US Government work)",
    attribution: `NASA${data.center ? ` / ${data.center}` : ""}`,
    width: null,
    height: null,
    _nasaId: data.nasa_id,
  };
}

// The search endpoint only returns a small preview JPEG. The full-resolution
// original lives in a per-item "collection.json" manifest, fetched lazily so
// a batch search doesn't pay for N extra requests before licence filtering.
export async function fetchOriginal(nasaId) {
  const manifest = await fetchJson(`https://images-api.nasa.gov/asset/${nasaId}`);
  const items = (manifest.collection && manifest.collection.items) || [];
  const orig = items.map((i) => i.href).find((h) => /~orig\.(jpg|png|tif)$/i.test(h || ""));
  return orig || items.map((i) => i.href).pop() || null;
}

export async function search(query, { count = 6 } = {}) {
  const json = await fetchJson(`${SEARCH}?q=${encodeURIComponent(query)}&media_type=image`);
  const items = (json.collection && json.collection.items) || [];
  return items.map(parseNasaItem).filter(Boolean).slice(0, count);
}
