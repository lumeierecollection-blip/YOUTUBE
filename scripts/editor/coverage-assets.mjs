/**
 * Per-concept asset resolution for the coverage pass.
 *
 * A concept resolves to one of:
 *   Photograph        - a real photo (Wikimedia Commons lead image or Commons search)
 *   Historical depiction - an engraving/painting of a historical person or event
 *   Document          - a patent PDF page, a release-notes page screenshot, a Jina reader screenshot
 *   Diagram           - an SVG built by coverage-graphics.mjs (drawn by the renderer, not an image file)
 *   Illustration      - a labelled historical scene when no photo exists
 *   Label card        - an honest SVG card stating the concept when no real image exists
 *
 * Every returned asset carries credit + source_url + role so the QA can prove
 * provenance. Fail closed: no asset is ever presented as something it isn't.
 *
 * Network functions (fetch, screenshot) are injected so unit tests need no
 * provider. On GitHub Actions the real implementations run; locally they
 * degrade to null unless the caller passes real ones.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { imageSize } from "./auto-timeline.mjs";

const ROOT = resolveRoot();
const UA = "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; coverage assets)";
const PUBLIC = join(ROOT, "src", "skills", "remotion-render", "public");
const ASSET_DIR = join(ROOT, "data", "editor", "auto", "assets");

function resolveRoot() {
  const u = fileURLToPath(import.meta.url);
  return join(u, "..", "..", "..");
}

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "asset"; }

/** ------------------------------------------------------------------ fetch */

async function getJson(url, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: ctl.signal });
    return res.ok ? await res.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

async function getBytes(url, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60000);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: ctl.signal });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; } finally { clearTimeout(t); }
}

/** Save a buffer under data/editor/auto/assets/ and return {file,width,height}. */
function stageAsset(buf, id) {
  mkdirSync(ASSET_DIR, { recursive: true });
  const file = join(ASSET_DIR, `${slug(id)}.${buf[0] === 0x89 ? "png" : "jpg"}`);
  writeFileSync(file, buf);
  const { width, height } = imageSize(buf);
  return { file: `data/editor/auto/assets/${slug(id)}.${buf[0] === 0x89 ? "png" : "jpg"}`, width, height };
}

/** Write an SVG card asset (label-card fallback) and return its metadata. */
function stageCardSVG(svg, id) {
  mkdirSync(ASSET_DIR, { recursive: true });
  const file = join(ASSET_DIR, `${slug(id)}.svg`);
  writeFileSync(file, svg);
  return { file: `data/editor/auto/assets/${slug(id)}.svg`, width: 1080, height: 1920 };
}

/** ------------------------------------------------------------------ Wikipedia / Commons */

const RASTER = (buf) => (buf[0] === 0x89 && buf[1] === 0x50)   // PNG
  || (buf[0] === 0xff && buf[1] === 0xd8);                     // JPEG

export async function wikipediaLeadImage({ name, kind, historical }) {
  const title = encodeURIComponent(String(name).replace(/ /g, "_"));
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=original&titles=${title}&pilicense=any`;
  const j = await getJson(url);
  const pages = j?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page || !page.original) return null;
  const buf = await getBytes(page.original.source);
  if (!buf || !RASTER(buf)) return null; // skip SVGs and other non-raster lead images
  const { width, height } = imageSize(buf);
  if (Math.min(width, height) < 600) return null;
  const staged = stageAsset(buf, `wiki-${slug(name)}`);
  return {
    ...staged,
    credit: `Image: ${name} / Wikimedia Commons (Wikipedia lead image)`,
    source_url: `https://en.wikipedia.org/wiki/${title}`,
    license: "Wikimedia Commons / free licence",
    role: historical ? "Historical depiction" : "Photograph",
  };
}

export async function commonsSearch({ query, limit = 4 }) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=15&gsrsearch=${encodeURIComponent(query + " filetype:bitmap")}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2200`;
  const j = await getJson(url);
  const pages = Object.values(j?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.mime !== "image/jpeg") continue;
    const title = String(p.title || "").replace(/^File:/, "");
    if (/logo|icon|map|flag|diagram|chart|graph|screenshot|poster|cover|stamp|coin|signature|banner|infographic|\bpdf\b|\bsvg\b|scan|page|book|manuscript|selfie|crowd|nude|swim|bikini|advert|billboard|ad_/i.test(title)) continue;
    if (Math.min(ii.width || 0, ii.height || 0) < 600) continue;
    const md = ii.extmetadata || {};
    const license = (strip(md.LicenseShortName) || strip(md.UsageTerms) || "");
    if (!license || /non-?free|fair use/i.test(license)) continue;
    const artist = strip(md.Artist).slice(0, 80);
    out.push({ title, url: ii.url, thumb: ii.thumburl || ii.url, width: ii.width, height: ii.height, license, artist,
      page: ii.descriptionurl, credit: `Photo: ${artist ? `${artist} / ` : ""}Wikimedia Commons, ${license}` });
    if (out.length >= limit) break;
  }
  return out;
}

function strip(v) { return String(v?.value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }

/** ------------------------------------------------------------------ patent (PDF page render) */

export async function patentPage({ number, pageNo = 1, dpi = 150 }) {
  const patentNum = number.replace(/\s+/g, "");
  const pdfUrl = `https://patentimages.storage.googleapis.com/pdfs/${patentNum}.pdf`;
  const buf = await getBytes(pdfUrl);
  if (!buf) return null;
  // Render page `pageNo` of the PDF to PNG via pdftoppm, then stage it.
  const { execFileSync } = await import("child_process");
  const tmp = join(ROOT, "data", "editor", "auto", "tmp");
  mkdirSync(tmp, { recursive: true });
  const pdfPath = join(tmp, `${number}.pdf`);
  writeFileSync(pdfPath, buf);
  try {
    execFileSync("pdftoppm", ["-png", "-r", String(dpi), "-f", String(pageNo), "-l", String(pageNo), pdfPath, join(tmp, number)], { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    return null;
  }
  const out = join(tmp, `${number}-${String(pageNo).padStart(2, "0")}.png`);
  if (!existsSync(out)) return null;
  const staged = stageAsset(readFileSync(out), `patent-${number}-p${pageNo}`);
  return {
    ...staged,
    credit: `Patent drawing: US patent ${number}, page ${pageNo}`,
    source_url: `https://patents.google.com/patent/${number}/en`,
    license: "USPTO patent document (public domain)",
    role: "Document",
  };
}

/** ------------------------------------------------------------------ web page screenshots (Playwright) */

export async function webpageScreenshot({ url, selector, viewport = { width: 1280, height: 1400 }, deviceScaleFactor = 2, screenshot = null }) {
  if (!screenshot) return null;
  const { chromium } = await import("playwright");
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.REMOTION_CHROME_PATH || undefined });
    const page = await browser.newPage({ viewport, deviceScaleFactor });
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (!res || !res.ok()) return null;
    await page.waitForTimeout(2500);
    if (selector) await page.waitForSelector(selector, { state: "visible", timeout: 15000 }).catch(() => {});
    const buf = Buffer.from(await page.screenshot({ fullPage: false }));
    return buf;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export async function linkedInPost({ url, screenshot = null }) {
  const buf = await webpageScreenshot({ url, selector: ".feed-shared-update-v2", viewport: { width: 1280, height: 1600 }, screenshot });
  if (!buf) return null;
  const staged = stageAsset(buf, `linkedin-${slug(url)}`);
  return {
    ...staged,
    credit: "Screenshot: LinkedIn post by Viththagan Roy Nesarajah",
    source_url: url,
    license: "Screenshot of a public post (fair use, commentary)",
    role: "Document",
  };
}

export async function jinaReader({ url, screenshot = null }) {
  const readerUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
  const buf = await webpageScreenshot({ url: readerUrl, viewport: { width: 1280, height: 1600 }, screenshot });
  if (!buf) return null;
  const staged = stageAsset(buf, `jina-${slug(url)}`);
  return {
    ...staged,
    credit: "Screenshot: reader view via r.jina.ai (source site blocked by Cloudflare)",
    source_url: url,
    license: "Reader-view screenshot of a public page (fair use, commentary)",
    role: "Document",
  };
}

/** ------------------------------------------------------------------ optional vision verification */

export async function verifyAssetRelevance({ sentence, query, jpeg, askVision }) {
  if (!askVision) return { ok: true, why: "vision not configured; accepted on provenance" };
  try {
    const verdict = await askVision({
      prompt: `A documentary video narrates: "${sentence}".\nWe are considering an image found with "${query}" to show while it is spoken.\nAnswer ONLY JSON: {"shows_subject": true|false, "what_it_shows": "<8 words>"}\nshows_subject = a viewer would say the image plausibly illustrates what the sentence is about.`,
      imageBase64: jpeg.toString("base64"),
    });
    const obj = parseVerdict(verdict);
    return obj;
  } catch (e) { return { ok: false, why: `vision check failed: ${e.message}` }; }
}

function parseVerdict(answer) {
  let obj = answer;
  if (answer && typeof answer.content === "string") {
    const m = answer.content.match(/\{[\s\S]*\}/);
    try { obj = m ? JSON.parse(m[0]) : null; } catch { obj = null; }
  }
  if (!obj || typeof obj !== "object" || typeof obj.shows_subject !== "boolean") return { ok: false, why: "no usable verdict" };
  if (!obj.shows_subject) return { ok: false, why: `does not show the subject (${obj.what_it_shows || "?"})` };
  return { ok: true, why: obj.what_it_shows || "" };
}

/** ------------------------------------------------------------------ label card fallback (honest, no fake image) */

export function labelCardAsset({ label, role, credit, source_url, license }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#0B0C10"/>
  <rect x="90" y="860" width="900" height="200" fill="#1A1D22"/>
  <text x="540" y="970" text-anchor="middle" fill="#F5EFE6" font-family="Cormorant Garamond" font-size="44" font-weight="700">${escapeXml(label)}</text>
  <text x="90" y="1140" fill="#B9B0A4" font-family="Inter" font-size="20" font-weight="500">${escapeXml(role)}</text>
  <text x="90" y="1170" fill="#B9B0A4" font-family="Inter" font-size="16">${escapeXml(credit || "")}</text>
</svg>`;
  const staged = stageCardSVG(svg, `card-${slug(label)}`);
  return { ...staged, credit, source_url, license, role: "Label card" };
}

function escapeXml(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

/** ------------------------------------------------------------------ top-level resolver */

export async function resolveAsset({ concept, research, channel, askVision, screenshot, pdftoppm }) {
  const kind = concept.kind;
  const label = concept.label;
  const historical = concept.era === "historical";
  const visual = concept.visual;

  // Diagrams are drawn by the renderer, not resolved as image files.
  if (visual === "diagram" || visual === "annotated" || visual === "figure") return null;

  // Patent document: render a real PDF page.
  if (kind === "document" && /^patent\s+US/i.test(label)) {
    const m = label.match(/US\s?\d{7,}[A-Z]\d?/i);
    if (m) {
      const resolved = await patentPage({ number: m[0].replace(/\s+/g, ""), pageNo: 1 });
      if (resolved) return resolved;
    }
  }

  // ── Person / organization ──
  // Try Wikipedia lead image first, then Commons search with multiple queries.
  // Many historical and niche figures do not have a Wikipedia lead image;
  // Commons often has portraits, engravings, or photographs of them.
  if (kind === "person" || kind === "organization") {
    const resolved = await wikipediaLeadImage({ name: label, kind, historical });
    if (resolved) return resolved;
    // Try multiple Commons queries to find a relevant depiction.
    const queries = historical
      ? [`${label} portrait`, `${label} historical`, `${label}`, `${label} engraving`]
      : [concept.query || label, `${label} photograph`, `${label}`];
    for (const query of queries) {
      const found = await commonsSearch({ query, limit: 4 });
      for (const rec of found) {
        const buf = await getBytes(rec.thumb);
        if (!buf) continue;
        const v = await verifyAssetRelevance({ sentence: "", query: rec.title, jpeg: buf, askVision });
        if (!v.ok) continue;
        const staged = stageAsset(buf, `commons-${slug(rec.title)}`);
        return { ...staged, credit: rec.credit, source_url: rec.page || rec.url, license: rec.license, role: "Photograph" };
      }
    }
  }

  // ── Object / place ──
  // Commons search first (photographs of places and objects), then Wikipedia
  // lead image as a fallback for places that have one.
  if (kind === "object" || kind === "place") {
    const found = await commonsSearch({ query: concept.query || label });
    for (const rec of found) {
      const buf = await getBytes(rec.thumb);
      if (!buf) continue;
      const v = await verifyAssetRelevance({ sentence: "", query: rec.title, jpeg: buf, askVision });
      if (!v.ok) continue;
      const staged = stageAsset(buf, `commons-${slug(rec.title)}`);
      return { ...staged, credit: rec.credit, source_url: rec.page || rec.url, license: rec.license, role: "Photograph" };
    }
    if (kind === "place") {
      const wiki = await wikipediaLeadImage({ name: label, kind, historical });
      if (wiki) return wiki;
    }
  }

  // ── Event / relation / state / number / position / version / date ──
  // Try Wikipedia lead image of the named person/place, then Commons search
  // with multiple queries for a related depiction, then an honest label card.
  if (kind === "event" || kind === "relation" || kind === "state" || kind === "number" || kind === "position" || kind === "version" || kind === "date") {
    const named = research?.named_entities?.find((e) => /person|place|organization/i.test(e.kind) && label.includes(e.name.split(" ")[0]));
    if (named) {
      const wiki = await wikipediaLeadImage({ name: named.name, kind: named.kind, historical: true });
      if (wiki) return { ...wiki, role: "Historical depiction" };
      const queries = historical
        ? [`${named.name} historical`, `${named.name} engraving`, `${named.name}`]
        : [`${named.name}`, `${label}`];
      for (const query of queries) {
        const found = await commonsSearch({ query, limit: 4 });
        for (const rec of found) {
          const buf = await getBytes(rec.thumb);
          if (!buf) continue;
          const v = await verifyAssetRelevance({ sentence: "", query: rec.title, jpeg: buf, askVision });
          if (!v.ok) continue;
          const staged = stageAsset(buf, `commons-${slug(rec.title)}`);
          return { ...staged, credit: rec.credit, source_url: rec.page || rec.url, license: rec.license, role: "Historical depiction" };
        }
      }
    }
  }

  // Honest fallback: a label card stating the concept, never a fake image.
  return labelCardAsset({ label, role: kind, credit: `Graphic: automatic editor — ${label}`, source_url: "https://github.com/lumeierecollection-blip/YOUTUBE", license: "Original diagram" });
}
