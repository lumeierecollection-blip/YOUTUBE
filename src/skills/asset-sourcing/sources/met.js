/**
 * Met Museum Open Access — CC0, no key. https://metmuseum.github.io/
 * Two-step API: search for objectIDs, then fetch each object for its image
 * and isPublicDomain flag (search results alone don't carry the licence).
 */
import { fetchJson } from "../http.js";

const SEARCH = "https://collectionapi.metmuseum.org/public/collection/v1/search";
const OBJECT = "https://collectionapi.metmuseum.org/public/collection/v1/objects";

export function parseMetObject(obj) {
  if (!obj || !obj.isPublicDomain) return null;
  const url = obj.primaryImage || obj.primaryImageSmall;
  if (!url) return null;
  return {
    sourceApi: "met",
    sourceUrl: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
    downloadUrl: url,
    title: obj.title || "",
    license: "CC0",
    licenseRaw: "Met Museum Open Access (CC0)",
    attribution: obj.creditLine || obj.artistDisplayName || "The Metropolitan Museum of Art",
    width: null, // Met API doesn't expose pixel dimensions; verified after download
    height: null,
  };
}

export async function search(query, { count = 6 } = {}) {
  const searchJson = await fetchJson(`${SEARCH}?hasImages=true&q=${encodeURIComponent(query)}`);
  const ids = (searchJson.objectIDs || []).slice(0, count * 2); // over-fetch: not every hit is PD with an image
  const out = [];
  for (const id of ids) {
    if (out.length >= count) break;
    try {
      const obj = await fetchJson(`${OBJECT}/${id}`);
      const parsed = parseMetObject(obj);
      if (parsed) out.push(parsed);
    } catch {
      // one bad object shouldn't sink the whole search
    }
  }
  return out;
}
