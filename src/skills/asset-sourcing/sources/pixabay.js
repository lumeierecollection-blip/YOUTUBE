/**
 * Pixabay — free key (PIXABAY_API_KEY). https://pixabay.com/api/docs/
 * Pixabay Content License: free for commercial use, no attribution required.
 * Search results carry `tags` (the uploader's own keywords) — recorded as
 * the source text, since Pixabay's API returns no title or description.
 */
import { fetchJson } from "../http.js";

const SEARCH = "https://pixabay.com/api/";

export function parsePixabayHit(hit) {
  const url = hit && (hit.largeImageURL || hit.webformatURL);
  if (!url) return null;
  return {
    sourceApi: "pixabay",
    sourceUrl: hit.pageURL || "",
    downloadUrl: url,
    title: hit.tags || "",
    sourceText: { tags: hit.tags || "" },
    license: "PIXABAY",
    licenseRaw: "Pixabay Content License",
    attribution: hit.user ? `Image by ${hit.user} on Pixabay` : "Pixabay",
    width: hit.imageWidth || null,
    height: hit.imageHeight || null,
  };
}

export async function search(query, { count = 6 } = {}) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) {
    console.warn("[asset-sourcing/pixabay] no PIXABAY_API_KEY set — skipping this source");
    return [];
  }
  const json = await fetchJson(`${SEARCH}?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&image_type=photo&safesearch=true&per_page=${Math.max(3, count)}`);
  return (json.hits || []).map(parsePixabayHit).filter(Boolean);
}
