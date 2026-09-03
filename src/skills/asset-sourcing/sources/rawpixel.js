/**
 * Rawpixel — CC0/public-domain tier only (`tags=$publicdomain`), filtered
 * again client-side against the licence URL Rawpixel returns, so premium/
 * "Editorial Use Only" catalogue items (which the plain website mixes in)
 * never pass regardless of the server-side tag.
 *
 * Unlike every other module in this directory, Rawpixel has no public,
 * self-serve REST API — there is no developer-signup docs page. What
 * exists is a partner-key API that Openverse's own ingestion pipeline uses
 * (confirmed via its open-source provider script,
 * openverse-catalog/.../provider_api_scripts/rawpixel.py, and its own
 * "we're missing an API key for the RawPixel provider" issue — even a
 * major, well-resourced project had to separately obtain a key, it isn't
 * self-serve). `RAWPIXEL_API_KEY` is that partner key when one exists;
 * with no key set this module logs a warning and returns no candidates,
 * same as nara.js's already-established "optional key nobody has
 * requested yet" pattern in this directory — it does not fail the build.
 *
 * The request-signing scheme below (HMAC-SHA256 over the URL path + sorted
 * querystring, base64 with `+-`/`/_`/no-padding substitution) is
 * transcribed verbatim from that same open-source provider script's
 * `_get_signature()`, whose own comment says the algorithm was "supplied
 * explicitly by Rawpixel's Node example" — i.e. this is Rawpixel's own
 * documented signing method for partner keys, not a guess. It has NOT
 * been exercised against a real key (none exists yet; this sandbox's
 * egress is also proxy-blocked to rawpixel.com regardless — see
 * SKILL.md). Verify against a real key before trusting this module's
 * output at scale, the same caveat SKILL.md already states for the rest
 * of this directory.
 */
import { createHmac } from "node:crypto";
import { stringify as qsStringify } from "node:querystring";
import { fetchJson } from "../http.js";

const HOST = "https://www.rawpixel.com";
const API_PATH = "/api/v1/search";
const IMAGE_SIZE_TOKEN = "image_1300"; // full_size_option in the reference implementation

function sign(params, apiKey) {
  const ordered = Object.fromEntries(Object.entries(params).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const query = qsStringify(ordered);
  const message = `${API_PATH}?${query}`;
  const digest = createHmac("sha256", apiKey).update(message, "utf8").digest("base64");
  return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toCanonicalLicense(licenseUrl) {
  const url = String(licenseUrl || "").toLowerCase();
  if (url.includes("publicdomain/zero")) return "CC0";
  if (url.includes("publicdomain/mark") || url.includes("publicdomain/1.0")) return "PD";
  return null; // anything else (including no licenceUrl at all) — not trusted
}

export function parseRawpixelItem(item) {
  if (!item) return null;
  const license = toCanonicalLicense(item.metadata && item.metadata.licenseUrl);
  if (!license) return null;
  const styleUri = item.style_uri;
  if (!styleUri) return null;
  const downloadUrl = styleUri.replace("{}", IMAGE_SIZE_TOKEN);
  return {
    sourceApi: "rawpixel",
    sourceUrl: item.url || `${HOST}/image/${item.id}`,
    downloadUrl,
    title: item.metadata && item.metadata.title ? item.metadata.title : "",
    sourceText: { title: item.metadata && item.metadata.title ? item.metadata.title : "" },
    license,
    licenseRaw: (item.metadata && item.metadata.licenseUrl) || "",
    attribution: "Rawpixel (public domain tier)",
    width: item.width || item.display_image_width || null,
    height: item.height || item.display_image_height || null,
  };
}

export async function search(query, { count = 6 } = {}) {
  const key = process.env.RAWPIXEL_API_KEY;
  if (!key) {
    console.warn("[asset-sourcing/rawpixel] no RAWPIXEL_API_KEY set — skipping this source");
    return [];
  }
  const params = { tags: "$publicdomain", page: 1, pagesize: count * 2, q: query };
  const signed = { ...params, s: sign(params, key) };
  const json = await fetchJson(`${HOST}${API_PATH}?${qsStringify(signed)}`);
  const results = json.results || json.data || [];
  return results.map(parseRawpixelItem).filter(Boolean).slice(0, count);
}
