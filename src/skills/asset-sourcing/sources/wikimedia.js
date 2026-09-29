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
      // Commons renders every file (SVG maps, TIFF/PDF scans) to a raster
      // thumbnail at the requested iiurlwidth. Recorded so a consumer that
      // needs JPEG/PNG can use it instead of rejecting the file's format.
      thumbUrl: info.thumburl || null,
      mime: info.mime || null,
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

// Commons rate-limits thumbnails it has to GENERATE: a width outside its standard step list (…, 960, 1280,
// 1920, 3840) is rendered on demand and answers 429 in bursts. Callers that need less than 4000 px pass a
// standard width (the cutout builder asks for 1280).
export async function search(query, { count = 6, thumbWidth = 4000 } = {}) {
  const url =
    `${ENDPOINT}?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6` +
    `&gsrlimit=${count}&prop=imageinfo&iiprop=url|size|extmetadata|mime&iiurlwidth=${thumbWidth}&format=json&origin=*`;
  const json = await fetchJson(url);
  return parseWikimediaResponse(json);
}
