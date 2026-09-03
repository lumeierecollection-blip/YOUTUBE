/**
 * Openverse — meta-search over 50+ providers (Flickr, Wikimedia, Europeana,
 * Smithsonian, NASA, museums, and more), used here as a commercial-filtered
 * DISCOVERY layer on top of the dedicated per-provider modules, not as a
 * replacement for them. No API key for anonymous access.
 * https://api.openverse.org/v1/images/ / https://docs.openverse.org
 *
 * `license_type=commercial,modification` restricts the server-side result
 * set to licenses with neither the NC (non-commercial) nor ND
 * (no-derivatives) restriction — ND matters here specifically because
 * treat.js crops/cuts out every asset it touches, which is itself a
 * "derivative work." That filter still lets CC-BY-SA through (share-alike
 * is compatible with modification), so toCanonicalLicense() below excludes
 * it client-side to match this repo's existing licenses.js philosophy
 * (CC-BY-SA's copyleft "infects" the whole video under most reasonable
 * readings — see licenses.js's header comment).
 *
 * Openverse's own docs are explicit that it "cannot make any claims about
 * the accuracy of license information" and that callers should always
 * verify the license of a particular work before using it — this module
 * only narrows the search, it doesn't replace that verification. sourceUrl
 * below always points to the work's page at its ORIGINAL provider (not an
 * openverse.org URL) for exactly that reason.
 */
import { fetchJson } from "../http.js";

const SEARCH = "https://api.openverse.org/v1/images/";

// Openverse's license slugs -> this repo's licenses.js canonical strings.
// Anything not mapped here (by-sa, by-nc, by-nc-sa, by-nd, by-nc-nd, or an
// unrecognized slug) returns null and the candidate is dropped — never
// guessed into an allowed bucket.
function toCanonicalLicense(license, version) {
  const key = String(license || "").toLowerCase();
  if (key === "cc0") return "CC0";
  if (key === "pdm") return "PD"; // Public Domain Mark
  if (key === "by") {
    const v = String(version || "");
    if (v === "4.0" || v === "3.0" || v === "2.0") return `CC-BY-${v}`;
    return "CC-BY"; // unspecified/unknown point version — still the plain-BY family
  }
  return null;
}

export function parseOpenverseResult(item) {
  if (!item || !item.url) return null;
  const license = toCanonicalLicense(item.license, item.license_version);
  if (!license) return null;
  const provider = item.provider || item.source || "unknown provider";
  return {
    sourceApi: "openverse",
    sourceUrl: item.foreign_landing_url || item.url,
    downloadUrl: item.url,
    title: item.title || "",
    sourceText: { title: item.title || "" },
    license,
    licenseRaw: item.license_version ? `${item.license} ${item.license_version}` : item.license,
    attribution: item.creator ? `${item.creator} via Openverse (${provider})` : `Openverse (${provider})`,
    width: item.width || null,
    height: item.height || null,
  };
}

export async function search(query, { count = 6 } = {}) {
  const url = `${SEARCH}?q=${encodeURIComponent(query)}&license_type=commercial,modification&page_size=${count * 2}`;
  const json = await fetchJson(url);
  const results = json.results || [];
  return results.map(parseOpenverseResult).filter(Boolean).slice(0, count);
}
