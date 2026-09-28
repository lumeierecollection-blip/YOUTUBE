#!/usr/bin/env node
/**
 * entity-assets.cjs — a named person / place / organization -> a REAL photo
 * of that entity, from Wikimedia (owner's rebuild, Fix 2, 2026-09-29).
 *
 *   resolveEntity({ type: "person"|"place"|"organization", name, context })
 *     -> { ok: true, asset: "entities/people/<slug>.jpg", entity, kind, attempt,
 *          source_url, page_url, license, attribution, credit }
 *      | { ok: false, why, attempts: [...] }
 *
 * Three attempts, each verified:
 *   1. the English Wikipedia page whose title IS the name (redirects
 *      followed, disambiguation pages refused): its lead image
 *   2. a Wikipedia search for the name (+ context words), first result whose
 *      title contains every name token: its lead image
 *   3. a Wikimedia Commons file search ("<name> portrait" / "<name>" /
 *      "<name> headquarters"): the first JPEG whose FILE NAME contains the
 *      name's tokens (a person: the surname and one more token)
 * Every candidate must be a JPEG photograph on Commons (SVG/PNG/GIF are
 * logos, flags, maps and locator images — refused; "an organization prefers
 * a photo of its building over its logo" follows from that) under a free
 * licence (no "non-free" / "fair use"), at least 500 px on its short side.
 *
 * HARD RULE (CLAUDE.md): real, verified photos only for named people and
 * places. When all three attempts fail, the result is ok:false and the
 * caller draws the beat as typography — it never substitutes a generic photo
 * of "a courthouse" for "the Miami courthouse", or anyone for a named person.
 * (The owner's brief allowed a generic photo of the entity type as a
 * fallback; for a NAMED entity that would present a stand-in as the real
 * thing, which the hard rule forbids. Logged as a fallback to type.)
 *
 * Cache: public/entities/<people|places|orgs>/<slug>.jpg + manifest.json;
 * a cached entity is not fetched again.
 *
 * CLI: node scripts/entity-assets.cjs --type person --name "David Einhorn" [--context "hedge fund"]
 */
"use strict";
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "src", "skills", "remotion-render", "public");
const DIR = { person: "people", place: "places", organization: "orgs" };
const MANIFEST = join(PUBLIC, "entities", "manifest.json");
const UA = "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; entity photos)";
const WIKI = "https://en.wikipedia.org";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const MIN_SIDE = 500;

const slug = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
const STOP = new Set(["the", "of", "and", "inc", "inc.", "co", "corp", "llc", "ltd", "plc", "group", "company", "a", "an"]);
const tokens = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t && !STOP.has(t));

async function getJson(url, timeoutMs = 15000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctl.signal });
    if (!r.ok) return { _status: r.status };
    return await r.json();
  } catch (e) {
    return { _error: String(e.message || e) };
  } finally { clearTimeout(timer); }
}

function loadManifest() { try { return JSON.parse(readFileSync(MANIFEST, "utf8")); } catch { return { version: 1, entities: [] }; } }
function saveManifest(m) { mkdirSync(join(PUBLIC, "entities"), { recursive: true }); writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n"); }

// Commons metadata for one file: url, size, mime, licence, author.
async function fileInfo(fileTitle) {
  const t = fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`;
  const u = `${COMMONS}?action=query&format=json&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1400&titles=${encodeURIComponent(t)}`;
  const j = await getJson(u);
  const page = Object.values(j?.query?.pages || {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  const md = ii.extmetadata || {};
  const strip = (v) => String(v?.value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return { title: page.title, url: ii.url, thumb: ii.thumburl || ii.url, width: ii.width, height: ii.height, mime: ii.mime,
    license: strip(md.LicenseShortName) || strip(md.UsageTerms), artist: strip(md.Artist), descurl: ii.descriptionurl };
}

// A file NAMED like a chart, map, logo, document scan or page is not a
// photograph of the entity (run 2026-09-29 test: "Federal Reserve" matched
// "Figure 4 Trends in Federal Reserve Bank Head Office Directors ... .jpg").
const NOT_A_PHOTO = /\b(figure|fig|chart|graph|diagram|maps?|locator|logo|seal|flag|coat of arms|emblem|table|infographic|scan|page|pdf|signature|icon|poster|cover|report|trends?|statistics|screenshot|banknote|note|stamp|coin|ceramic|pottery|artifact|artefact|museum|louvre|manuscript|painting|drawing|engraving|sculpture|statue|relief|mosaic)\b/i;
const BUILDING = /\b(building|headquarters|hq|offices?|tower|campus|exterior|facade|façade|entrance|plaza|cent(?:er|re))\b/i;
// People in the file name: a group or portrait shot is not a photo of an organization or place.
const PEOPLE = /\b(group|executives?|team|staff|meeting|portrait|people|ceo|founder|delegation|visit|with)\b/i;
// A place photo should be OF the place: a skyline, a view, a street.
const SCENIC = /\b(skyline|aerial|downtown|view|panorama|city|cityscape|landscape|coast|harbou?r|port|strait|river|bridge|square|street|night|sunset|beach|mountains?|satellite|from space)\b/i;

function checkFile(info) {
  if (!info) return "no Commons file record (the image is not on Wikimedia Commons)";
  if (NOT_A_PHOTO.test(String(info.title || "").replace(/^File:/, "").replace(/[_-]/g, " "))) return `"${info.title}" is named like a chart / map / logo / document, not a photo`;
  if (!/^image\/jpe?g$/i.test(info.mime || "")) return `${info.mime} is not a photograph (SVG/PNG/GIF are logos, flags, maps)`;
  if (/non-?free|fair use/i.test(info.license || "")) return `licence "${info.license}" is not free`;
  if (!info.license) return "no licence recorded";
  if (Math.min(info.width || 0, info.height || 0) < MIN_SIDE) return `too small (${info.width}x${info.height})`;
  return null;
}

// Every name token in the title (a person: all of them).
function titleMatches(title, name) {
  const tt = tokens(title), nt = tokens(name);
  return nt.length > 0 && nt.every((t) => tt.includes(t));
}

async function leadImageOf(title, name) {
  const s = await getJson(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`);
  if (s?._status || s?._error) return { why: `no Wikipedia page "${title}" (${s._status || s._error})` };
  if (s.type === "disambiguation") return { why: `"${s.title}" is a disambiguation page` };
  if (!titleMatches(s.title, name)) return { why: `page "${s.title}" does not name "${name}"` };
  const src = s.originalimage?.source;
  if (!src) return { why: `page "${s.title}" has no lead image` };
  const file = decodeURIComponent(src.split("/").pop());
  const info = await fileInfo(file);
  const bad = checkFile(info);
  if (bad) return { why: `lead image of "${s.title}": ${bad}` };
  return { info, page: s.content_urls?.desktop?.page || `${WIKI}/wiki/${encodeURIComponent(s.title)}`, pageTitle: s.title, description: s.description || "" };
}

async function attempts(type, name, context) {
  const tried = [];
  // 1. The page titled with the name.
  let r = await leadImageOf(name, name);
  if (r.info) return { ...r, attempt: 1, tried };
  tried.push(`1: ${r.why}`);
  // 2. Search.
  const q = [name, context].filter(Boolean).join(" ");
  const sj = await getJson(`${WIKI}/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=${encodeURIComponent(q)}`);
  const hit = (sj?.query?.search || []).find((h) => titleMatches(h.title, name) && !/\(disambiguation\)/i.test(h.title));
  if (hit) {
    r = await leadImageOf(hit.title, name);
    if (r.info) return { ...r, attempt: 2, tried };
    tried.push(`2: ${r.why}`);
  } else tried.push(`2: no search result titled with "${name}"`);
  // 2b. An organization or place whose lead image is a logo / seal / map:
  // the page's own photos — for an organization, one named as its building.
  if (type !== "person") {
    const page = hit?.title || name;
    const ij = await getJson(`${WIKI}/w/api.php?action=query&format=json&prop=images&imlimit=50&titles=${encodeURIComponent(page)}&redirects=1`);
    const files = Object.values(ij?.query?.pages || {})[0]?.images?.map((x) => x.title) || [];
    const nt = tokens(name);
    const cands = files.filter((f) => /\.jpe?g$/i.test(f) && !NOT_A_PHOTO.test(f.replace(/[_-]/g, " ")))
      .filter((f) => !PEOPLE.test(f.replace(/[_-]/g, " ")))
      .filter((f) => (type === "organization" ? BUILDING.test(f.replace(/[_-]/g, " ")) && nt.some((t) => tokens(f).includes(t))
        : SCENIC.test(f.replace(/[_-]/g, " ")) && nt.every((t) => tokens(f).includes(t))));
    for (const f of cands.slice(0, 4)) {
      const info = await fileInfo(f);
      const bad = checkFile(info);
      if (!bad) return { info, page: info.descurl, pageTitle: f, description: "", attempt: 2, tried };
      tried.push(`2b: ${f}: ${bad}`);
    }
    if (!cands.length) tried.push(`2b: no ${type === "organization" ? "building photo" : "photo"} named for "${name}" on its page`);
  }
  // 3. Commons file search.
  const suffix = type === "person" ? " portrait" : type === "organization" ? " headquarters" : "";
  const cj = await getJson(`${COMMONS}?action=query&format=json&list=search&srnamespace=6&srlimit=10&srsearch=${encodeURIComponent(`"${name}"${suffix}`)}`);
  const nt = tokens(name);
  const need = type === "person" ? nt : nt;
  for (const h of cj?.query?.search || []) {
    const ft = tokens(h.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""));
    if (!need.every((t) => ft.includes(t))) continue;
    // A person's file may show them with others ("... with the President");
    // an organization's or place's must not be a shot of people.
    if (type !== "person" && PEOPLE.test(h.title.replace(/[_-]/g, " "))) { tried.push(`3: ${h.title}: a photo of people, not of the ${type}`); continue; }
    // A place: the file must be named as a view OF it ("Shahbanu of Iran.jpg"
    // is a portrait that merely contains the place's name).
    if (type === "place" && !SCENIC.test(h.title.replace(/[_-]/g, " "))) { tried.push(`3: ${h.title}: not named as a view of the place`); continue; }
    if (type === "organization" && !BUILDING.test(h.title.replace(/[_-]/g, " "))) { tried.push(`3: ${h.title}: not named as the organization's building`); continue; }
    if (type === "person" && /\b(with|and|meets?|meeting|group)\b/i.test(h.title.replace(/[_-]/g, " "))) { tried.push(`3: ${h.title}: not a portrait of one person`); continue; }
    const info = await fileInfo(h.title);
    const bad = checkFile(info);
    if (!bad) return { info, page: info.descurl, pageTitle: h.title, description: "", attempt: 3, tried };
    tried.push(`3: ${h.title}: ${bad}`);
    if (tried.length > 8) break;
  }
  if (!tried.some((t) => t.startsWith("3:"))) tried.push(`3: no Commons file named for "${name}"`);
  return { tried };
}

async function resolveEntity({ type, name, context = "" }) {
  type = DIR[type] ? type : "organization";
  const key = `${type}:${String(name).trim().toLowerCase()}`;
  const man = loadManifest();
  const cached = (man.entities || []).find((e) => e.key === key);
  if (cached && existsSync(join(PUBLIC, cached.asset))) return { ok: true, ...cached, cached: true };
  const r = await attempts(type, name, context);
  if (!r.info) return { ok: false, why: `no verified photo of ${type} "${name}" in 3 attempts`, attempts: r.tried };
  // Download the 1400 px rendition and store it as JPEG.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  let buf;
  // One more try on a cut-off transfer ("terminated"), the same file.
  for (let k = 0; k < 2 && !buf; k++) {
    try {
      const res = await fetch(r.info.thumb, { headers: { "user-agent": UA }, signal: ctl.signal });
      if (!res.ok) { clearTimeout(timer); return { ok: false, why: `download failed (${res.status})`, attempts: r.tried }; }
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) { if (k === 1) { clearTimeout(timer); return { ok: false, why: `download failed (${e.message})`, attempts: r.tried }; } }
  }
  clearTimeout(timer);
  const rel = `entities/${DIR[type]}/${slug(name)}.jpg`;
  mkdirSync(join(PUBLIC, "entities", DIR[type]), { recursive: true });
  try {
    const sharp = require("sharp");
    const meta = await sharp(buf).metadata();
    if (Math.min(meta.width || 0, meta.height || 0) < MIN_SIDE) return { ok: false, why: `downloaded image too small (${meta.width}x${meta.height})`, attempts: r.tried };
    await sharp(buf).rotate().resize({ width: 1400, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(join(PUBLIC, rel));
  } catch (e) { return { ok: false, why: `image could not be decoded (${e.message})`, attempts: r.tried }; }
  const artist = (r.info.artist || "").slice(0, 80);
  const entry = { key, type, entity: name, asset: rel, attempt: r.attempt, page_url: r.page, page_title: r.pageTitle, description: r.description,
    source_url: r.info.descurl || r.info.url, license: r.info.license, attribution: artist,
    credit: `Photo: ${artist ? `${artist} / ` : ""}Wikimedia Commons, ${r.info.license}`, fetched_at: new Date().toISOString() };
  man.entities = (man.entities || []).filter((e) => e.key !== key);
  man.entities.push(entry);
  saveManifest(man);
  return { ok: true, ...entry };
}

module.exports = { resolveEntity, titleMatches, checkFile };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  resolveEntity({ type: arg("type") || "person", name: arg("name"), context: arg("context") || "" })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); });
}
