/**
 * National Archives (NARA) Catalog — archival, federal records are PD.
 * https://catalog.archives.gov/api/v2
 *
 * NARA's v2 catalog API has, at various points, required a free API key
 * (`x-api-key` header, requested at https://catalog.archives.gov/api-key-signup)
 * and at other points allowed unauthenticated read access — this module
 * sends the key when NARA_API_KEY is set and omits the header otherwise,
 * rather than asserting either way from stale documentation. If NARA has
 * started hard-requiring it, fetchLibrary.js's per-source try/catch logs
 * the 401/403 and continues with the other seven sources; it does not fail
 * the whole build over one source needing a key nobody has requested yet.
 */
import { fetchJson } from "../http.js";

const SEARCH = "https://catalog.archives.gov/api/v2/records/search";

export function parseNaraRecord(record) {
  const r = record && record.record;
  if (!r) return null;
  const digitalObjects = r.digitalObjects || [];
  const image = digitalObjects.find((d) => /\.(jpg|jpeg|png|tif)$/i.test(d.objectUrl || ""));
  if (!image) return null;
  // NARA-described federal records are US government works (PD) unless the
  // record explicitly flags a non-federal donor with restrictions.
  if (r.copyrightStatusArray && r.copyrightStatusArray.some((c) => /copyright/i.test(c) && !/public domain/i.test(c))) {
    return null;
  }
  return {
    sourceApi: "nara",
    sourceUrl: `https://catalog.archives.gov/id/${r.naId}`,
    downloadUrl: image.objectUrl,
    title: r.title || "",
    license: "PD",
    licenseRaw: "US federal record (National Archives)",
    attribution: "National Archives and Records Administration (NARA)",
    width: null,
    height: null,
  };
}

export async function search(query, { count = 6 } = {}) {
  const headers = process.env.NARA_API_KEY ? { "x-api-key": process.env.NARA_API_KEY } : {};
  const url = `${SEARCH}?q=${encodeURIComponent(query)}&limit=${count * 2}&dataSource=digitalObjects`;
  const json = await fetchJson(url, { headers });
  const hits = (json.body && json.body.hits && json.body.hits.hits) || [];
  return hits.map(parseNaraRecord).filter(Boolean).slice(0, count);
}
