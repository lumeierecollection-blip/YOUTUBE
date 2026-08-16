/**
 * Unsplash — modern objects/product shots, free key.
 * https://unsplash.com/documentation
 * Unsplash License: free for commercial use, no attribution required
 * (attribution recorded anyway — good practice, costs nothing).
 */
import { fetchJson } from "../http.js";

const SEARCH = "https://api.unsplash.com/search/photos";
const TARGET_WIDTH = 2160; // 2x shorts stage width (PART 5 — fetch at 2x stage res minimum)

export function parseUnsplashPhoto(photo) {
  const base = photo.urls && photo.urls.raw;
  if (!base) return null;
  return {
    sourceApi: "unsplash",
    sourceUrl: (photo.links && photo.links.html) || "",
    downloadUrl: `${base}&w=${TARGET_WIDTH}&q=90&fm=jpg`,
    title: photo.alt_description || photo.description || "",
    license: "UNSPLASH",
    licenseRaw: "Unsplash License",
    attribution: photo.user && photo.user.name ? `Photo by ${photo.user.name} on Unsplash` : "Unsplash",
    width: TARGET_WIDTH,
    height: photo.height && photo.width ? Math.round((TARGET_WIDTH * photo.height) / photo.width) : null,
  };
}

export async function search(query, { count = 6 } = {}) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    console.warn("[asset-sourcing/unsplash] no UNSPLASH_ACCESS_KEY set — skipping this source");
    return [];
  }
  const json = await fetchJson(`${SEARCH}?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  return (json.results || []).map(parseUnsplashPhoto).filter(Boolean);
}
