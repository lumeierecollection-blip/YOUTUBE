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
 * A PERSON (resolvePerson, 2026-09-30): candidates from the Wikipedia lead
 * image, a Wikipedia search's lead image, then Commons portraits — each must
 * pass the identity check in verify-person-image.cjs (a face, the named
 * person, a portrait) or it is rejected; no candidate passes -> ok:false.
 * Stock photo APIs are never a source for a named person.
 *
 * Places and organizations — three attempts, each checked:
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
const DIR = { person: "people", place: "places", building: "buildings", organization: "orgs" };
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
const NOT_A_PHOTO = /\b(figure|fig|chart|graph|diagram|maps?|locator|logo|seal|flag|coat of arms|emblem|table|infographic|scan|page|pdf|signature|icon|poster|cover|report|trends?|statistics|screenshot|banknote|note|stamp|coin|ceramic|pottery|artifact|artefact|museum|louvre|manuscript|painting|painted|drawing|drawn|sketch|illustration|caricature|cartoon|artwork|engraving|sculpture|statue|wax|figurine|relief|mosaic|mural|graffiti)\b/i;
const BUILDING = /\b(building|headquarters|hq|offices?|tower|campus|exterior|facade|façade|entrance|plaza|cent(?:er|re))\b/i;
// People in the file name: a group or portrait shot is not a photo of an organization or place.
// Run 36509937804 ch-9: "Pakistan Navy" resolved to "US Navy 090820-N-...
// Chief of Naval Operations (CNO) Adm. Gary Roughead, middle, inspects
// Pakistan Navy sailors during a welcoming ceremony" — a US admiral.
const PEOPLE = /\b(group|executives?|team|staff|meeting|portrait|people|ceo|founder|delegation|visits?|with|inspects?|inspection|sailors|soldiers|troops|officers?|officials?|adm|admiral|gen|general|chief|president|minister|secretary|ceremony|welcom\w*|crew|members|students|workers|visitors|audience|crowd|middle|left|right|poses?|posing|shakes?|speaks?|speech|addresses|attends?|during)\b/i;
// A place photo should be OF the place: a skyline, a view, a street.
const SCENIC = /\b(skyline|aerial|downtown|view|panorama|city|cityscape|landscape|coast|harbou?r|port|strait|river|bridge|square|street|night|sunset|beach|mountains?|satellite|from space)\b/i;

function checkFile(info) {
  if (!info) return "no Commons file record (the image is not on Wikimedia Commons)";
  if (NOT_A_PHOTO.test(String(info.title || "").replace(/^File:/, "").replace(/[_-]/g, " "))) return `"${info.title}" is named like a chart / map / logo / document / artwork, not a photo`;
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

// The Commons file name of an upload.wikimedia.org URL. The summary API now
// appends "?utm_source=en.wikipedia.org&utm_campaign=api&..." to image URLs;
// the old split("/").pop() kept that query string in the "file name", so
// EVERY lead-image lookup failed with "no Commons file record" and people
// fell through to the Commons search (found 2026-10-01, Jerome Powell).
function fileNameOf(src) {
  let path;
  try { path = new URL(src).pathname; } catch { path = String(src).split(/[?#]/)[0]; }
  return decodeURIComponent(path.split("/").pop());
}

async function leadImageOf(title, name) {
  const s = await getJson(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`);
  if (s?._status || s?._error) return { why: `no Wikipedia page "${title}" (${s._status || s._error})` };
  if (s.type === "disambiguation") return { why: `"${s.title}" is a disambiguation page` };
  if (!titleMatches(s.title, name)) return { why: `page "${s.title}" does not name "${name}"` };
  const src = s.originalimage?.source;
  if (!src) return { why: `page "${s.title}" has no lead image` };
  const file = fileNameOf(src);
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

/**
 * A named PLACE, BUILDING or ORGANIZATION: candidate photos in source order
 * (owner's scene-resolver spec 2026-10-02, task 2.3), each labelled with its
 * source, for scripts/resolve-scene.cjs to download and verify one by one:
 *   1. "wikipedia summary"  the lead image of the page titled with the name
 *   2. "wikipedia search"   the lead image of the first search hit titled with it
 *   3. "wikipedia page"     the page's own photos named as a view of it (a
 *                           place: a skyline / view; a building or an
 *                           organization: its building)
 *   4. "wikimedia commons"  Commons files whose name holds every name token
 * Every candidate passes checkFile (a JPEG photograph under a free licence,
 * >= 500 px). Pixabay is the resolver's own last step, for places and
 * buildings only.
 */
async function entityCandidates(type, name, context = "", max = 5) {
  const out = [], tried = [], seen = new Set();
  const add = (c, source) => { if (c?.info && !seen.has(c.info.title) && out.length < max) { seen.add(c.info.title); out.push({ ...c, source }); } };
  const clean = (t) => t.replace(/[_-]/g, " ");
  const nt = tokens(name);
  let r = await leadImageOf(name, name);
  if (r.info) add(r, "wikipedia summary"); else tried.push(`wikipedia summary: ${r.why}`);
  const sj = await getJson(`${WIKI}/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=${encodeURIComponent([name, context].filter(Boolean).join(" "))}`);
  const hit = (sj?.query?.search || []).find((h) => titleMatches(h.title, name) && !/\(disambiguation\)/i.test(h.title) && h.title !== r.pageTitle);
  if (hit) { const s = await leadImageOf(hit.title, name); if (s.info) add(s, "wikipedia search"); else tried.push(`wikipedia search: ${s.why}`); }
  else tried.push(`wikipedia search: no result titled with "${name}"`);
  const page = r.pageTitle || hit?.title || name;
  const ij = await getJson(`${WIKI}/w/api.php?action=query&format=json&prop=images&imlimit=50&titles=${encodeURIComponent(page)}&redirects=1`);
  const files = Object.values(ij?.query?.pages || {})[0]?.images?.map((x) => x.title) || [];
  const view = (f) => (type === "place" ? SCENIC.test(clean(f)) : BUILDING.test(clean(f)) || BUILDING_VIEW.test(clean(f)));
  for (const f of files.filter((f) => /\.jpe?g$/i.test(f) && !NOT_A_PHOTO.test(clean(f)) && !PEOPLE.test(clean(f)) && view(f) && nt.some((t) => tokens(f).includes(t))).slice(0, 3)) {
    const info = await fileInfo(f);
    const bad = checkFile(info);
    if (bad) tried.push(`wikipedia page: ${f}: ${bad}`); else add({ info, page: info.descurl, pageTitle: f, description: "" }, "wikipedia page");
  }
  const suffix = type === "organization" ? " headquarters" : "";
  const cj = await getJson(`${COMMONS}?action=query&format=json&list=search&srnamespace=6&srlimit=10&srsearch=${encodeURIComponent(`"${name}"${suffix}`)}`);
  for (const h of cj?.query?.search || []) {
    if (out.length >= max) break;
    const ft = tokens(h.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""));
    if (!nt.every((t) => ft.includes(t))) continue;
    if (PEOPLE.test(clean(h.title))) { tried.push(`wikimedia commons: ${h.title}: a photo of people, not of the ${type}`); continue; }
    const info = await fileInfo(h.title);
    const bad = checkFile(info);
    if (bad) tried.push(`wikimedia commons: ${h.title}: ${bad}`); else add({ info, page: info.descurl, pageTitle: h.title, description: "" }, "wikimedia commons");
  }
  return { candidates: out, tried };
}

/**
 * A named PERSON's candidate photos, in source priority (owner's rule
 * 2026-09-30: Wikipedia is the source; stock photo APIs are never used for a
 * named person):
 *   1. the lead image of the English Wikipedia page titled with the name
 *   2. the lead image of the first Wikipedia search hit titled with the name
 *   3. Wikimedia Commons files named for the person: "<name>" portrait,
 *      "<name>" official photo, "<name>" — files at least 600 px on the
 *      short side first
 * Every candidate passes checkFile (a JPEG photograph under a free licence,
 * >= 500 px on its short side). Returns up to `max` distinct candidates;
 * each still has to pass the identity check (verify-person-image.cjs).
 */
async function personCandidates(name, context, max = 6) {
  const out = [], tried = [], seen = new Set();
  const add = (c, source) => { if (c.info && !seen.has(c.info.title)) { seen.add(c.info.title); out.push({ ...c, source }); } };
  let r = await leadImageOf(name, name);
  if (r.info) add(r, "wikipedia lead image");
  else { tried.push(`wikipedia: ${r.why}`); console.log(`[fetch] ${name}: wikipedia no lead image (${r.why}), trying search / commons`); }
  const q = [name, context].filter(Boolean).join(" ");
  const sj = await getJson(`${WIKI}/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=${encodeURIComponent(q)}`);
  const hit = (sj?.query?.search || []).find((h) => titleMatches(h.title, name) && !/\(disambiguation\)/i.test(h.title) && h.title !== r.pageTitle);
  if (hit) { r = await leadImageOf(hit.title, name); if (r.info) add(r, "wikipedia search lead image"); else tried.push(`wikipedia search: ${r.why}`); }
  const nt = tokens(name);
  const commons = [];
  for (const suffix of [" portrait", " official photo", ""]) {
    if (out.length + commons.length >= max) break;
    const cj = await getJson(`${COMMONS}?action=query&format=json&list=search&srnamespace=6&srlimit=10&srsearch=${encodeURIComponent(`"${name}"${suffix}`)}`);
    for (const h of cj?.query?.search || []) {
      if (seen.has(h.title) || commons.some((c) => c.info.title === h.title)) continue;
      const ft = tokens(h.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""));
      if (!nt.every((t) => ft.includes(t))) continue;
      if (/\b(with|and|meets?|meeting|group)\b/i.test(h.title.replace(/[_-]/g, " "))) { tried.push(`commons: ${h.title}: not a portrait of one person`); continue; }
      const info = await fileInfo(h.title);
      const bad = checkFile(info);
      if (bad) { tried.push(`commons: ${h.title}: ${bad}`); continue; }
      commons.push({ info, page: info.descurl, pageTitle: h.title, description: "" });
      if (out.length + commons.length >= max) break;
    }
  }
  commons.sort((a, b) => (Math.min(b.info.width, b.info.height) >= 600) - (Math.min(a.info.width, a.info.height) >= 600));
  commons.forEach((c) => add(c, "commons"));
  return { candidates: out.slice(0, max), tried };
}

// A bare acronym names different organizations in different places: run
// 36509937804 ch-2 resolved "NHRC" (India's National Human Rights
// Commission in the script) to a photo of QATAR's NHRC building, because the
// Commons file name contained "NHRC". So an acronym is resolved only through
// this table of unambiguous expansions; any other acronym is refused (the
// beat takes another grounded visual). The table is deliberately short:
// only names whose expansion does not depend on the story's country.
const ACRONYMS = {
  SEC: "U.S. Securities and Exchange Commission", DOJ: "United States Department of Justice",
  FBI: "Federal Bureau of Investigation", IRS: "Internal Revenue Service", FTC: "Federal Trade Commission",
  CFTC: "Commodity Futures Trading Commission", FDIC: "Federal Deposit Insurance Corporation",
  NLRB: "National Labor Relations Board", EEOC: "Equal Employment Opportunity Commission",
  CFPB: "Consumer Financial Protection Bureau", FINRA: "Financial Industry Regulatory Authority",
  FDA: "Food and Drug Administration", CDC: "Centers for Disease Control and Prevention",
  NASA: "NASA", FCC: "Federal Communications Commission", FAA: "Federal Aviation Administration",
  DEA: "Drug Enforcement Administration", CIA: "Central Intelligence Agency",
  IMF: "International Monetary Fund", WTO: "World Trade Organization", NATO: "NATO",
  UN: "United Nations", EU: "European Union", ECB: "European Central Bank", OPEC: "OPEC",
  WHO: "World Health Organization", SEBI: "Securities and Exchange Board of India", RBI: "Reserve Bank of India",
};
function expandName(type, name) {
  const bare = String(name || "").trim().replace(/^the\s+/i, "").replace(/\./g, "");
  if (type !== "organization" || !/^[A-Z&]{2,6}s?$/.test(bare)) return { name };
  const full = ACRONYMS[bare.replace(/s$/, "")] || ACRONYMS[bare];
  return full ? { name: full, note: `acronym "${bare}" -> "${full}"` } : { refuse: `"${bare}" is an acronym with no unambiguous expansion (it names different organizations in different countries)` };
}

// Download a candidate's 1400 px rendition and store it as JPEG at `abs`.
async function downloadTo(info, abs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  let buf;
  // One more try on a cut-off transfer ("terminated"), the same file.
  for (let k = 0; k < 2 && !buf; k++) {
    try {
      const res = await fetch(info.thumb, { headers: { "user-agent": UA }, signal: ctl.signal });
      if (!res.ok) { clearTimeout(timer); return `download failed (${res.status})`; }
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) { if (k === 1) { clearTimeout(timer); return `download failed (${e.message})`; } }
  }
  clearTimeout(timer);
  mkdirSync(join(abs, ".."), { recursive: true });
  try {
    const sharp = require("sharp");
    const meta = await sharp(buf).metadata();
    if (Math.min(meta.width || 0, meta.height || 0) < MIN_SIDE) return `downloaded image too small (${meta.width}x${meta.height})`;
    await sharp(buf).rotate().resize({ width: 1400, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(abs);
  } catch (e) { return `image could not be decoded (${e.message})`; }
  return null;
}

/**
 * A named person: the candidates in source priority (personCandidates), each
 * downloaded and put through the identity check (verify-person-image.cjs:
 * a visible face, the named person, a portrait). The first that passes is
 * stored; every rejection is logged. None passes -> ok:false, and the caller
 * draws the beat without a photo. A cached portrait is re-checked against
 * verified.json (same source URL, < 30 days) before it is reused.
 */
async function resolvePerson(key, name, context, man, cached) {
  const { verifyPersonImage } = require("./verify-person-image.cjs");
  const rel = `entities/people/${slug(name)}.jpg`;
  if (cached && existsSync(join(PUBLIC, cached.asset))) {
    const v = await verifyPersonImage(join(PUBLIC, cached.asset), name, { sourceUrl: cached.source_url });
    if (v.verdict === "match") return { ok: true, ...cached, cached: true, verified: v };
    console.log(`[fetch] ${name}: cached portrait failed verification (${v.reason}), refetching`);
    man.entities = (man.entities || []).filter((e) => e.key !== key);
    saveManifest(man);
  }
  const { candidates, tried } = await personCandidates(name, context);
  if (!candidates.length) {
    console.log(`[fetch] ${name}: no Wikipedia lead image and no Commons portrait`);
    return { ok: false, why: `no candidate photo of person "${name}"`, attempts: tried };
  }
  const rejected = [];
  for (const [i, c] of candidates.entries()) {
    console.log(`[fetch] ${name}: ${c.source}${c.source === "commons" ? ` candidate ${i + 1}` : ""} (${c.info.title})`);
    const tmp = join(PUBLIC, "entities", "people", `.candidate-${slug(name)}.jpg`);
    const bad = await downloadTo(c.info, tmp);
    if (bad) { rejected.push(`${c.info.title}: ${bad}`); console.log(`[verify] rejected candidate for ${name}: ${bad}`); continue; }
    const sourceUrl = c.info.descurl || c.info.url;
    const v = await verifyPersonImage(tmp, name, { sourceUrl });
    if (v.verdict !== "match") {
      rejected.push(`${c.info.title}: ${v.reason}`);
      console.log(`[verify] rejected candidate for ${name}: ${v.reason}`);
      try { require("node:fs").unlinkSync(tmp); } catch {}
      continue;
    }
    require("node:fs").renameSync(tmp, join(PUBLIC, rel));
    console.log(`[fetch] ${name}: verified MATCH (${v.provider}), used`);
    const artist = (c.info.artist || "").slice(0, 80);
    const entry = { key, type: "person", entity: name, asset: rel, attempt: i + 1, source: c.source, page_url: c.page, page_title: c.pageTitle, file_title: c.info.title, view: "person", description: c.description || "",
      source_url: sourceUrl, license: c.info.license, attribution: artist, verified_by: v.provider,
      credit: `Photo: ${artist ? `${artist} / ` : ""}Wikimedia Commons, ${c.info.license}`, fetched_at: new Date().toISOString() };
    man.entities = (man.entities || []).filter((e) => e.key !== key);
    man.entities.push(entry);
    saveManifest(man);
    return { ok: true, ...entry, rejected };
  }
  console.log(`[fetch] ${name}: all ${candidates.length} candidate(s) rejected`);
  return { ok: false, why: `no verified portrait of "${name}" (${candidates.length} candidate(s) rejected)`, attempts: [...tried, ...rejected], rejected };
}

async function resolveEntity({ type, name, context = "" }) {
  type = DIR[type] ? type : "organization";
  const key = `${type}:${String(name).trim().toLowerCase()}`;
  const man = loadManifest();
  const cached = (man.entities || []).find((e) => e.key === key);
  // A named person is shown as that person or not at all: every person photo,
  // cached or new, passes the identity check.
  if (type === "person") return resolvePerson(key, String(name).trim(), context, man, cached);
  if (cached && existsSync(join(PUBLIC, cached.asset))) return { ok: true, ...cached, cached: true };
  const ex = expandName(type, name);
  if (ex.refuse) return { ok: false, why: `no verified photo of ${type} "${name}": ${ex.refuse}`, attempts: [] };
  const r = await attempts(type, ex.name, context);
  if (ex.note && r.tried) r.tried.unshift(ex.note);
  if (!r.info) return { ok: false, why: `no verified photo of ${type} "${name}" in 3 attempts`, attempts: r.tried };
  const rel = `entities/${DIR[type]}/${slug(name)}.jpg`;
  const bad = await downloadTo(r.info, join(PUBLIC, rel));
  if (bad) return { ok: false, why: bad, attempts: r.tried };
  const artist = (r.info.artist || "").slice(0, 80);
  const entry = { key, type, entity: name, asset: rel, attempt: r.attempt, page_url: r.page, page_title: r.pageTitle, file_title: r.info.title, view: viewOf(type, r.info.title), description: r.description,
    source_url: r.info.descurl || r.info.url, license: r.info.license, attribution: artist,
    credit: `Photo: ${artist ? `${artist} / ` : ""}Wikimedia Commons, ${r.info.license}`, fetched_at: new Date().toISOString() };
  man.entities = (man.entities || []).filter((e) => e.key !== key);
  man.entities.push(entry);
  saveManifest(man);
  return { ok: true, ...entry };
}

// What a resolved photo SHOWS, decided from its file name (never guessed from
// pixels): "person" (a person's portrait), "building" (an institution's or a
// place's building — drawn as ARCHITECTURE), else "scene". A file whose name
// says nothing stays "scene": the safe reading, drawn as a plain full-bleed photo.
const BUILDING_VIEW = /\b(building|headquarters|hq|offices?|tower|campus|exterior|facade|fa\u00e7ade|entrance|plaza|courthouse|court house|capitol|parliament|palace|hall|cathedral|castle|station|bank|ministry|embassy|library|university|museum|stadium|terminal|airport|bridge|dam|factory|plant|refinery|port)\b/i;
function viewOf(type, fileTitle) {
  if (type === "person") return "person";
  return BUILDING_VIEW.test(String(fileTitle || "").replace(/[_-]/g, " ")) ? "building" : "scene";
}

// ── DOCUMENT: a real scan of a named legal instrument ────────────────
// A Wikipedia page's lead image, or a Commons file whose name carries the
// instrument's name AND reads as a document (act / treaty / page / scan ...),
// as a JPEG / PNG scan or the first-page thumbnail Commons renders for a PDF.
// Not a signing photo, a portrait, a logo or a map. No OCR happens here, so a
// DOCUMENT beat never claims to highlight a passage of the scan: its callout
// highlights the beat's own headline (full-canvas.jsx).
const DOC_LIKE = /\b(act|treaty|constitution|declaration|amendment|charter|convention|agreement|accord|statute|code|ruling|decision|opinion|judgment|indictment|complaint|order|resolution|protocol|contract|memorandum|manuscript|document|page|scan|pdf|text|engrossed|original)\b/i;
const DOC_REJECT = /\b(logo|seal|flag|coat of arms|emblem|map|locator|chart|graph|diagram|infographic|icon|screenshot|portrait|signs|signing|signed by|ceremony|president|speech|meeting|protest|rally|courthouse|building|statue|monument|crowd)\b/i;
function checkDocFile(info) {
  if (!info) return "no Commons file record";
  const t = String(info.title || "").replace(/^File:/, "").replace(/[_-]/g, " ");
  if (DOC_REJECT.test(t)) return `"${info.title}" is named like a portrait / signing / logo / map, not a document scan`;
  if (!DOC_LIKE.test(t)) return `"${info.title}" is not named like a document`;
  if (!/^(image\/(jpe?g|png|tiff)|application\/pdf)$/i.test(info.mime || "")) return `${info.mime} is not a scan`;
  if (/non-?free|fair use/i.test(info.license || "")) return `licence "${info.license}" is not free`;
  if (!info.license) return "no licence recorded";
  if (Math.min(info.width || 0, info.height || 0) < MIN_SIDE) return `too small (${info.width}x${info.height})`;
  return null;
}
async function documentAttempts(name) {
  const tried = [];
  // 1. The instrument's own Wikipedia page: its lead image, if it is a scan.
  const s = await getJson(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}?redirect=true`);
  if (s && !s._status && !s._error && s.type !== "disambiguation" && titleMatches(s.title, name) && s.originalimage?.source) {
    const info = await fileInfo(fileNameOf(s.originalimage.source));
    const bad = checkDocFile(info);
    if (!bad) return { info, page: s.content_urls?.desktop?.page || `${WIKI}/wiki/${encodeURIComponent(s.title)}`, pageTitle: s.title, attempt: 1, tried };
    tried.push(`1: lead image of "${s.title}": ${bad}`);
  } else tried.push(`1: no usable Wikipedia page / lead image for "${name}"`);
  // 2. Commons file search: a scan of it.
  const cj = await getJson(`${COMMONS}?action=query&format=json&list=search&srnamespace=6&srlimit=12&srsearch=${encodeURIComponent(`"${name}"`)}`);
  const nt = tokens(name);
  for (const h of cj?.query?.search || []) {
    const ft = tokens(h.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""));
    if (!nt.every((t) => ft.includes(t))) continue;
    const info = await fileInfo(h.title);
    const bad = checkDocFile(info);
    if (!bad) return { info, page: info.descurl, pageTitle: h.title, attempt: 2, tried };
    tried.push(`2: ${h.title}: ${bad}`);
    if (tried.length > 6) break;
  }
  if (!tried.some((t) => t.startsWith("2:"))) tried.push(`2: no Commons file named for "${name}"`);
  return { tried };
}

// ── MONEY: a real photo of a money object ────────────────────────────
// A Commons photograph (JPEG, free licence, >= 500 px) whose file name is
// about the object searched ("banknotes", "coins", "receipt") and reads as a
// photograph of it, not a specimen scan, a hoard, an ancient coin or a
// counterfeit. The picture illustrates the literal object the sentence names
// (canvas-grounding.js moneyObjectOf): it is not a claim about which notes.
const MONEY_REJECT = /\b(figure|fig|chart|graph|diagram|map|locator|logo|seal|flag|emblem|table|infographic|screenshot|icon|poster|cover|report|museum|louvre|manuscript|painting|drawing|engraving|sculpture|statue|relief|mosaic|ceramic|pottery|artifact|artefact|hoard|ancient|roman|greek|medieval|byzantine|counterfeit|forged|specimen|obverse|reverse|proof|commemorative|design|series|coat of arms|portrait|people|man|woman|crowd)\b/i;
const MONEY_WORD = /\b(banknotes?|bank notes?|notes|bills|cash|currency|money|coins?|receipts?|cheques?|checks?|statement|euros?|dollars?|pounds?|rupees?)\b/i;
function checkMoneyFile(info) {
  if (!info) return "no Commons file record";
  const t = String(info.title || "").replace(/^File:/, "").replace(/[_-]/g, " ");
  if (MONEY_REJECT.test(t)) return `"${info.title}" is named like a specimen / ancient / diagram, not a photo of the object`;
  if (!MONEY_WORD.test(t)) return `"${info.title}" is not named for a money object`;
  if (!/^image\/jpe?g$/i.test(info.mime || "")) return `${info.mime} is not a photograph`;
  if (/non-?free|fair use/i.test(info.license || "")) return `licence "${info.license}" is not free`;
  if (!info.license) return "no licence recorded";
  if (Math.min(info.width || 0, info.height || 0) < MIN_SIDE) return `too small (${info.width}x${info.height})`;
  return null;
}
async function moneyAttempts(query) {
  const tried = [];
  for (const q of [query, `${query} photo`]) {
    const cj = await getJson(`${COMMONS}?action=query&format=json&list=search&srnamespace=6&srlimit=15&srsearch=${encodeURIComponent(q)}`);
    for (const h of cj?.query?.search || []) {
      const info = await fileInfo(h.title);
      const bad = checkMoneyFile(info);
      if (!bad) return { info, page: info.descurl, pageTitle: h.title, attempt: q === query ? 1 : 2, tried };
      tried.push(`${h.title}: ${bad}`);
      if (tried.length > 10) break;
    }
  }
  if (!tried.length) tried.push(`no Commons file for "${query}"`);
  return { tried };
}

// Download, store as JPEG, record in the manifest — shared by the two
// non-entity resolvers (the entity path above keeps its own copy).
async function storeResolved(kind, key, name, r, subdir) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  let buf;
  for (let k = 0; k < 2 && !buf; k++) {
    try {
      const res = await fetch(r.info.thumb, { headers: { "user-agent": UA }, signal: ctl.signal });
      if (!res.ok) { clearTimeout(timer); return { ok: false, why: `download failed (${res.status})`, attempts: r.tried }; }
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) { if (k === 1) { clearTimeout(timer); return { ok: false, why: `download failed (${e.message})`, attempts: r.tried }; } }
  }
  clearTimeout(timer);
  const rel = `entities/${subdir}/${slug(name)}.jpg`;
  mkdirSync(join(PUBLIC, "entities", subdir), { recursive: true });
  try {
    const sharp = require("sharp");
    const meta = await sharp(buf).metadata();
    if (Math.min(meta.width || 0, meta.height || 0) < MIN_SIDE) return { ok: false, why: `downloaded image too small (${meta.width}x${meta.height})`, attempts: r.tried };
    await sharp(buf).rotate().flatten({ background: "#ffffff" }).resize({ width: 1400, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(join(PUBLIC, rel));
  } catch (e) { return { ok: false, why: `image could not be decoded (${e.message})`, attempts: r.tried }; }
  const artist = (r.info.artist || "").slice(0, 80);
  const entry = { key, type: kind, entity: name, asset: rel, attempt: r.attempt, page_url: r.page, page_title: r.pageTitle, file_title: r.info.title, view: kind === "document" ? "document" : "money",
    source_url: r.info.descurl || r.info.url, license: r.info.license, attribution: artist,
    credit: `Photo: ${artist ? `${artist} / ` : ""}Wikimedia Commons, ${r.info.license}`, fetched_at: new Date().toISOString() };
  const man = loadManifest();
  man.entities = (man.entities || []).filter((e) => e.key !== key);
  man.entities.push(entry);
  saveManifest(man);
  return { ok: true, ...entry };
}
/** A real scan of a named legal instrument. -> { ok, asset, view: "document", ... } | { ok: false, why, attempts } */
async function resolveDocument({ name }) {
  const key = `document:${String(name).trim().toLowerCase()}`;
  const cached = (loadManifest().entities || []).find((e) => e.key === key);
  if (cached && existsSync(join(PUBLIC, cached.asset))) return { ok: true, ...cached, cached: true };
  const r = await documentAttempts(String(name).trim());
  if (!r.info) return { ok: false, why: `no real scan of the document "${name}" in 2 attempts`, attempts: r.tried };
  return storeResolved("document", key, name, r, "documents");
}
/** A real photo of a money object (`query` from canvas-grounding.js moneyObjectOf). */
async function resolveMoney({ query }) {
  const key = `money:${String(query).trim().toLowerCase()}`;
  const cached = (loadManifest().entities || []).find((e) => e.key === key);
  if (cached && existsSync(join(PUBLIC, cached.asset))) return { ok: true, ...cached, cached: true };
  const r = await moneyAttempts(String(query).trim());
  if (!r.info) return { ok: false, why: `no real photo of "${query}" on Commons`, attempts: r.tried };
  return storeResolved("money", key, query, r, "money");
}

// Institution names that exist in every country ("Supreme Court",
// "Parliament", "the central bank"): each names a DIFFERENT building per
// country — run 36504143080 ch-2 showed the US Supreme Court for an Indian
// story. qualifyEntity() turns one into "<name> of <country>" when the
// script names exactly one country (the caller passes the countries it
// recognises), else refuses it (null) so the beat is not given some other
// country's photo.
const GENERIC_INSTITUTION = /^(the\s+)?(supreme court|high court|constitutional court|federal court|court of appeals?|parliament|congress|senate|house of (representatives|commons|lords)|national assembly|central bank|reserve bank|treasury|ministry of [a-z ]+|department of [a-z ]+|police|army|navy|air force|government|cabinet|election commission|human rights commission|national human rights commission)$/i;
function qualifyEntity(ent, countries = []) {
  if (!ent?.name || !GENERIC_INSTITUTION.test(String(ent.name).trim())) return { ent, note: null };
  const cs = [...new Set(countries)];
  if (cs.length === 1) {
    const name = `${String(ent.name).trim().replace(/^the\s+/i, "")} of ${cs[0]}`;
    return { ent: { ...ent, name }, note: `"${ent.name}" is a generic institution name — resolving "${name}" (the script's one country)` };
  }
  return { ent: null, note: `"${ent.name}" is a generic institution name and the script names ${cs.length ? `${cs.length} countries (${cs.join(", ")})` : "no country"} — not resolved (it would show some country's ${ent.name})` };
}

module.exports = { resolveEntity, resolveDocument, resolveMoney, personCandidates, entityCandidates, downloadTo, slug, PUBLIC, DIR, titleMatches, checkFile, checkDocFile, checkMoneyFile, viewOf, qualifyEntity, expandName, GENERIC_INSTITUTION };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  resolveEntity({ type: arg("type") || "person", name: arg("name"), context: arg("context") || "" })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); });
}
