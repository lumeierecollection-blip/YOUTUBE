/**
 * Smithsonian Open Access — CC0, needs a free api.data.gov key.
 * https://www.si.edu/openaccess / https://api.data.gov/signup
 */
import { fetchJson } from "../http.js";

const SEARCH = "https://api.si.edu/openaccess/api/v1.0/search";

export function parseSmithsonianRow(row) {
  const content = row.content || {};
  const descriptive = content.descriptiveNonRepeating || {};
  const media = (descriptive.online_media && descriptive.online_media.media) || [];
  const image = media.find((m) => m.type === "Images" && m.usage && m.usage.access === "CC0");
  if (!image) return null;
  const resources = image.resources || [];
  const largest = resources.find((r) => r.label === "High-resolution image") || resources[resources.length - 1];
  if (!largest) return null;
  return {
    sourceApi: "smithsonian",
    sourceUrl: descriptive.guid || descriptive.record_link || "",
    downloadUrl: largest.url,
    title: (content.freetext && content.freetext.name && content.freetext.name[0] && content.freetext.name[0].content) || row.title || "",
    sourceText: { title: (content.freetext && content.freetext.name && content.freetext.name[0] && content.freetext.name[0].content) || row.title || "" },
    license: "CC0",
    licenseRaw: "Smithsonian Open Access (CC0)",
    attribution: descriptive.unit_code ? `Smithsonian ${descriptive.unit_code}` : "Smithsonian Institution",
    width: null,
    height: null,
  };
}

export async function search(query, { count = 6 } = {}) {
  const key = process.env.SMITHSONIAN_API_KEY || process.env.DATA_GOV_API_KEY;
  if (!key) {
    console.warn("[asset-sourcing/smithsonian] no SMITHSONIAN_API_KEY / DATA_GOV_API_KEY set — skipping this source");
    return [];
  }
  const url = `${SEARCH}?q=${encodeURIComponent(query)}&rows=${count * 2}&api_key=${encodeURIComponent(key)}`;
  const json = await fetchJson(url);
  const rows = (json.response && json.response.rows) || [];
  return rows.map(parseSmithsonianRow).filter(Boolean).slice(0, count);
}
