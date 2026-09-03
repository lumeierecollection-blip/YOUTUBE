/**
 * Pexels — modern objects/product shots, free key.
 * https://www.pexels.com/api/documentation/
 * Pexels License: free for commercial use, no attribution required.
 */
import { fetchJson } from "../http.js";

const SEARCH = "https://api.pexels.com/v1/search";

export function parsePexelsPhoto(photo) {
  const url = photo.src && (photo.src.large2x || photo.src.original);
  if (!url) return null;
  return {
    sourceApi: "pexels",
    sourceUrl: photo.url || "",
    downloadUrl: url,
    title: photo.alt || "",
    // Pexels returns alt-text, not a title. Recorded as alt.
    sourceText: { alt: photo.alt || "" },
    license: "PEXELS",
    licenseRaw: "Pexels License",
    attribution: photo.photographer ? `Photo by ${photo.photographer} on Pexels` : "Pexels",
    width: photo.width || null,
    height: photo.height || null,
  };
}

export async function search(query, { count = 6 } = {}) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    console.warn("[asset-sourcing/pexels] no PEXELS_API_KEY set — skipping this source");
    return [];
  }
  const json = await fetchJson(`${SEARCH}?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`, {
    headers: { Authorization: key },
  });
  return (json.photos || []).map(parsePexelsPhoto).filter(Boolean);
}
