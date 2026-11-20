#!/usr/bin/env node
/** Automatic picture sourcing (owner, 20 Nov 2026: "everything sourced and made at once", every named thing must be shown, and the pictures must make sense).
 *  Input: a jobs file [{ id, q, desc }] and a target dir. For each item: Openverse search (Flickr, museums, NASA, archives; Wikimedia hits are skipped here),
 *  download up to N candidates from their own hosts, a vision model scores each against `desc` (0-10: is this clearly that person/place/object, sharp, no text clutter),
 *  the best one scoring >= MIN is saved as <dir>/<id>.jpg with its credit in ATTRIBUTIONS.json. Items with no good candidate are listed as MISSING (never faked).
 *  Usage: node auto-source.mjs <jobs.json> <channel-dir under public/lf2>   (needs GEMINI_API_KEY*) */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../.."), [jobsFile, chDir] = process.argv.slice(2);
const jobs = JSON.parse(readFileSync(jobsFile, "utf8")), DIR = join(ROOT, "src/skills/remotion-render/public/lf2", chDir), MIN = 7, N = 6, MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
mkdirSync(DIR, { recursive: true }); const attP = join(DIR, "ATTRIBUTIONS.json"), att = existsSync(attP) ? JSON.parse(readFileSync(attP, "utf8")) : {};
const KEYS = ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].map((k) => process.env[k]).filter(Boolean);
if (!KEYS.length) { console.error("no GEMINI key"); process.exit(2); }
const UA = { "User-Agent": "research-client/1.0" }, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(40000) }); if (!r.ok) throw new Error(r.status); return Buffer.from(await r.arrayBuffer()); };
async function score(buf, desc) {
  const prompt = `Rate this picture 0-10 for use in a documentary video as a literal illustration of: "${desc}". 10 = clearly exactly that (the named person looks like a portrait of them, the place is recognisable), sharp, no big text or watermark.
0-3 = unrelated, a different person/place, a joke, a costume, or confusing. Reply JSON {"score": number, "depicts": "<8 words>"}.`;
  for (let pass = 0; pass < 3; pass++) {
    for (const MODEL of MODELS) for (const key of KEYS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: buf.toString("base64") } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }) });
        if (!res.ok) continue; const r = JSON.parse((await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || "null"); if (r) return r;
      } catch { /* next key */ }
    }
    await sleep(6000 * (pass + 1));
  }
  return null;
}

const J = async (u) => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(r.status); return r.json(); };
async function openverse(q) { return ((await J("https://api.openverse.org/v1/images/?" + new URLSearchParams({ q, page_size: "20" }))).results || []).filter((r) => !/wikimedia\.org|wikipedia\.org/.test(r.url || "")).map((r) => ({ url: r.url, page: r.foreign_landing_url, source: "openverse/" + r.source, license: `${r.license} ${r.license_version || ""}`.trim(), author: r.creator || "" })); }
async function commons(q) { for (let t = 0; t < 2; t++) { const r = await fetch("https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ action: "query", generator: "search", gsrsearch: q + " filetype:bitmap", gsrnamespace: "6", gsrlimit: "10", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1600", format: "json" }), { headers: UA, signal: AbortSignal.timeout(30000) }); if (r.status === 429) { await sleep(8000); continue; } if (!r.ok) throw new Error(r.status); const pages = Object.values((await r.json()).query?.pages || {}); return pages.map((p) => { const i = p.imageinfo?.[0]; return i && { url: i.thumburl || i.url, page: i.descriptionurl, source: "commons", license: i.extmetadata?.LicenseShortName?.value || "see page", author: String(i.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").slice(0, 80) }; }).filter(Boolean); } return []; }
async function europeana(q) { return ((await J("https://api.europeana.eu/record/v2/search.json?" + new URLSearchParams({ wskey: "api2demo", query: q, media: "true", thumbnail: "true", reusability: "open", rows: "10" }))).items || []).filter((i) => i.edmIsShownBy?.[0]).map((i) => ({ url: i.edmIsShownBy[0], page: i.guid, source: "europeana", license: String(i.rights?.[0] || "open").split("/").slice(-3, -1).join(" "), author: i.dataProvider?.[0] || "" })); }
async function nasa(q) { return ((await J("https://images-api.nasa.gov/search?" + new URLSearchParams({ q, media_type: "image" }))).collection?.items || []).slice(0, 10).map((i) => ({ url: i.links?.[0]?.href, page: "https://images.nasa.gov/details/" + i.data?.[0]?.nasa_id, source: "nasa", license: "public domain (NASA)", author: i.data?.[0]?.photographer || i.data?.[0]?.center || "NASA" })).filter((c) => c.url); }
async function archive(q) { const d = (await J("https://archive.org/advancedsearch.php?" + new URLSearchParams({ q: `${q} AND mediatype:image AND licenseurl:*`, fl: "identifier,creator,licenseurl", rows: "8", output: "json" }))).response?.docs || []; return d.map((x) => ({ url: `https://archive.org/services/img/${x.identifier}`, page: "https://archive.org/details/" + x.identifier, source: "archive.org", license: String(x.licenseurl || "").replace(/^https?:\/\/(creativecommons\.org\/(licenses|publicdomain)\/)?/, ""), author: [].concat(x.creator || "")[0] || "" })); }
async function pixabay(q) { if (!process.env.PIXABAY_API_KEY) return []; return ((await J("https://pixabay.com/api/?" + new URLSearchParams({ key: process.env.PIXABAY_API_KEY, q, image_type: "photo", per_page: "10", safesearch: "true" }))).hits || []).map((h) => ({ url: h.largeImageURL, page: h.pageURL, source: "pixabay", license: "Pixabay licence", author: h.user })); }
const SOURCES = [openverse, commons, europeana, nasa, archive, pixabay];
const missing = [];
for (const j of jobs) {
  if (att[j.id] && existsSync(join(DIR, att[j.id].file))) { console.log("have", j.id); continue; }
  let best = null;
  // several independent sources, each wrapped so one being down/rate-limited never stops the others; candidates are interleaved so every source gets scored
  const cands = (await Promise.all(SOURCES.map((f) => f(j.q).catch((e) => { console.log(`  ${f.name} failed: ${String(e).slice(0, 50)}`); return []; })))).map((l) => l.slice(0, 8));
  const order = []; for (let i = 0; i < 8; i++) for (const l of cands) if (l[i]) order.push(l[i]);
  let tried = 0;
  for (const c of order) {
    if (tried >= N + 4) break;
    try {
      const buf = await get(c.url); if (buf.length < 30000 || buf.length > 8e6) continue; tried++;
      const s = await score(buf, j.desc || j.q); console.log(`  ${j.id} [${c.source}] cand ${tried}: ${s?.score ?? "?"} ${s?.depicts || ""}`);
      if (s && s.score >= MIN && (!best || s.score > best.s)) { best = { s: s.score, buf, r: { source: c.source, foreign_landing_url: c.page, license: c.license, license_version: "", creator: c.author }, depicts: s.depicts }; if (s.score >= 9) break; }
    } catch { /* next candidate */ }
  }
  if (!best) { missing.push(j.id); console.log("MISSING", j.id); continue; }
  writeFileSync(join(DIR, j.id + ".jpg"), best.buf);
  att[j.id] = { id: j.id, file: j.id + ".jpg", description: j.desc || j.q, depicts: best.depicts, score: best.s, source: best.r.source, source_url: best.r.foreign_landing_url, licence: `${best.r.license} ${best.r.license_version || ""}`.trim(), author: best.r.creator || "", credit_line: `${best.r.creator || "Unknown"}, ${String(best.r.license || "").toUpperCase()}, via ${best.r.source}`, authenticity: "authentic" };
  writeFileSync(attP, JSON.stringify(att, null, 1)); console.log("OK", j.id, best.s);
  await sleep(1500);
}
writeFileSync(join(DIR, "_missing.json"), JSON.stringify(missing)); console.log("missing:", missing.join(", ") || "none");
