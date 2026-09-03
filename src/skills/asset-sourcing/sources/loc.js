/**
 * Library of Congress — archival photographs, no key.
 * https://www.loc.gov/apis/json-and-yaml/
 *
 * LOC's `rights_advisory` / `access_restricted` fields are free text, not a
 * clean enum — this filters to the small set of phrasings LOC itself uses
 * for genuinely unrestricted items rather than guessing at the rest.
 */
import { fetchJson } from "../http.js";

const SEARCH = "https://www.loc.gov/photos/";
const UNRESTRICTED_PHRASES = [
  "no known restrictions",
  "public domain",
  "not an official mark",
];

export function parseLocItem(item) {
  if (item.access_restricted) return null;
  const advisory = (item.rights_advisory || []).join(" ").toLowerCase();
  const isUnrestricted = advisory === "" || UNRESTRICTED_PHRASES.some((p) => advisory.includes(p));
  if (!isUnrestricted) return null;
  const images = item.image_url || [];
  if (!images.length) return null;
  const largest = images[images.length - 1]; // LOC orders image_url smallest -> largest
  return {
    sourceApi: "loc",
    sourceUrl: item.id || item.url || "",
    downloadUrl: largest,
    title: item.title || "",
    sourceText: { title: item.title || "" },
    license: "PD",
    licenseRaw: item.rights_advisory && item.rights_advisory.length ? item.rights_advisory.join("; ") : "No known restrictions (Library of Congress)",
    attribution: "Library of Congress",
    width: null,
    height: null,
  };
}

export async function search(query, { count = 6 } = {}) {
  const url = `${SEARCH}?q=${encodeURIComponent(query)}&fo=json&c=${count * 2}`;
  const json = await fetchJson(url);
  const results = json.results || [];
  return results.map(parseLocItem).filter(Boolean).slice(0, count);
}
