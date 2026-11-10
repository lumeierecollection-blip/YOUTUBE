/**
 * Real photographs from Wikimedia Commons, with the licence, author and subject read from the Commons API and recorded in an asset
 * manifest. Only licences that allow reuse with credit are accepted; NonCommercial, NoDerivatives and unknown licences are refused.
 * Nothing here generates an image: if no usable authentic image exists, the caller must use an honest alternative.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UA = "YouTubeAutomationPreview/1.0 (preview render; Wikimedia Commons images with their licences recorded)";
const ALLOWED = /^(CC BY(-SA)? [0-9.]+( [a-z]{2,3})?|CC0.*|Public domain|PD[- ].*|Attribution|No restrictions)$/i;
const strip = (v) => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

let lastCall = 0;
/** Wikimedia asks automated clients to go gently: at least 1.5 s between calls, and a patient retry on 429 or 5xx. */
async function polite(url) {
  for (let attempt = 1; ; attempt++) {
    const wait = Math.max(0, lastCall + 1500 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.status !== 429 && r.status < 500) return r;
    if (attempt >= 5) return r;
    const ra = Number(r.headers.get("retry-after")) || 0;
    await new Promise((res) => setTimeout(res, Math.max(ra * 1000, attempt * 12000)));
  }
}

export async function commonsMeta(title) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [k, v] of Object.entries({ action: "query", titles: title, prop: "imageinfo", iiprop: "url|extmetadata|size|mime", iiurlwidth: "1600", format: "json" })) u.searchParams.set(k, v);
  const r = await polite(u);
  if (!r.ok) throw new Error(`Commons API ${r.status} for ${title}`);
  const page = Object.values((await r.json()).query.pages)[0];
  const i = page.imageinfo?.[0];
  if (!i) throw new Error(`Commons has no image "${title}"`);
  const m = i.extmetadata || {};
  const licence = strip(m.LicenseShortName?.value);
  if (!ALLOWED.test(licence)) throw new Error(`"${title}" has licence "${licence}", which is not allowed for reuse`);
  return {
    title, page: i.descriptionurl, original_url: i.url, url: i.width > 1600 ? i.thumburl : i.url, width: i.width, height: i.height, mime: i.mime,
    licence, licence_url: strip(m.LicenseUrl?.value), author: strip(m.Artist?.value).replace(/https?:[^ ]*/g, "").replace(/ at[ ]*$/, "").replace(/[ ]+/g, " ").trim().slice(0, 70), credit: strip(m.Credit?.value), description: strip(m.ImageDescription?.value),
    date: strip(m.DateTimeOriginal?.value) || strip(m.DateTime?.value), attribution_required: strip(m.AttributionRequired?.value) === "true",
  };
}

/** Downloads one asset and returns its manifest entry. `claim` says which story claim it illustrates; `kind` is authentic | illustrative. */
export async function commonsAsset({ title, dir, id, claim = "", role = "", kind = "authentic" }) {
  const meta = await commonsMeta(title);
  const r = await polite(meta.url);
  if (!r.ok) throw new Error(`download failed ${r.status} for ${title}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 8000) throw new Error(`${title} is implausibly small (${buf.length} bytes)`);
  mkdirSync(dir, { recursive: true });
  const ext = meta.mime === "image/png" ? "png" : "jpg";
  const file = join(dir, `${id}.${ext}`);
  writeFileSync(file, buf);
  return { file, entry: { id, description: meta.description || title, role, source: "Wikimedia Commons", source_url: meta.page, licence: meta.licence, licence_url: meta.licence_url, author: meta.author, original_credit: meta.credit, date_taken: meta.date, retrieved: new Date().toISOString().slice(0, 10), claim, authenticity: kind, size_px: `${meta.width}x${meta.height}`, credit_line: `${meta.author || "Unknown author"}, ${meta.licence}, via Wikimedia Commons`, bytes: buf.length } };
}

export const dataUri = async (file) => { const { readFileSync } = await import("node:fs"); const ext = file.endsWith(".png") ? "png" : "jpeg"; return `data:image/${ext};base64,${readFileSync(file).toString("base64")}`; };
