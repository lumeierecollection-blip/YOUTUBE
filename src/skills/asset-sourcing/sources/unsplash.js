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
  // urls.full: the full-size original (the cutout library builder wants it; raw + a width crop is what asset-sourcing used before).
  const full = photo.urls && (photo.urls.full || photo.urls.regular || photo.urls.raw);
  if (!full) return null;
  return {
    sourceApi: "unsplash",
    sourceUrl: (photo.links && photo.links.html) || "",
    downloadUrl: full,
    title: photo.alt_description || photo.description || "",
    // Unsplash returns these as two distinct fields; keep them distinct.
    sourceText: { alt: photo.alt_description || "", description: photo.description || "" },
    license: "UNSPLASH",
    licenseRaw: "Unsplash License",
    attribution: photo.user && photo.user.name ? `Photo by ${photo.user.name} on Unsplash` : "Unsplash",
    width: photo.width || null,
    height: photo.height || null,
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
