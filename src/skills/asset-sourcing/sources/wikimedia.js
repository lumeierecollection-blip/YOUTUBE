/**
 * Wikimedia Commons — broadest pool, no API key.
 * https://www.mediawiki.org/wiki/API:Search
 */
import { fetchJson } from "../http.js";
import { normalizeLicense } from "../licenses.js";

const ENDPOINT = "https://commons.wikimedia.org/w/api.php";

export function parseWikimediaResponse(json) {
  const pages = (json && json.query && json.query.pages) || {};
  const out = [];
  for (const page of Object.values(pages)) {
    const info = (page.imageinfo && page.imageinfo[0]) || null;
    if (!info || !info.url) continue;
    const meta = info.extmetadata || {};
    const licenseRaw = (meta.LicenseShortName && meta.LicenseShortName.value) || (meta.UsageTerms && meta.UsageTerms.value);
    const license = normalizeLicense(licenseRaw);
    if (!license) continue; // unlicensed / unrecognized -> excluded upstream by isAllowedLicense too, but skip early
    const artist = meta.Artist && meta.Artist.value ? String(meta.Artist.value).replace(/<[^>]+>/g, "").trim() : null;
    out.push({
      sourceApi: "wikimedia",
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || "")}`,
      downloadUrl: info.url,
      title: page.title || "",
      // extmetadata is already requested, so ImageDescription costs nothing
      // extra and is the only real description Commons gives us.
      sourceText: {
        title: page.title || "",
        description: meta.ImageDescription && meta.ImageDescription.value
          ? String(meta.ImageDescription.value).replace(/<[^>]+>/g, "").trim()
          : "",
      },
      license,
      licenseRaw: licenseRaw || null,
      attribution: artist ? `${artist} via Wikimedia Commons` : "Wikimedia Commons",
      width: info.width || null,
      height: info.height || null,
    });
  }
  return out;
}

export async function search(query, { count = 6 } = {}) {
  const url =
    `${ENDPOINT}?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6` +
    `&gsrlimit=${count}&prop=imageinfo&iiprop=url|size|extmetadata|mime&iiurlwidth=4000&format=json&origin=*`;
  const json = await fetchJson(url);
  return parseWikimediaResponse(json);
}
