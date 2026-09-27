#!/usr/bin/env node
/**
 * fetch-assets.cjs — fetch real images for a plan's VISUAL beat concepts,
 * at plan time, into the Remotion public dir, and record each in
 * public/asset-library/manifest.json. Called by scripts/render-and-qa.js
 * before rendering (render.js itself never touches the network — AST-13).
 *
 *   node scripts/fetch-assets.cjs --in <concepts.json> --out <result.json> [--topic finance]
 *     concepts.json: [{ "beat": 1, "concept": "...", "asset_query": "..." }]
 *
 * Sources, in order: Pexels -> Wikimedia -> Unsplash -> Pixabay -> Openverse
 * (the per-source adapters in src/skills/asset-sourcing/sources/). A source
 * with no API key configured is skipped and says so on every concept; it is
 * never silently dropped.
 *
 * Licenses: Pexels, Unsplash, Pixabay, CC0, CC-BY, public domain only
 * (src/skills/asset-sourcing/licenses.js). CC-BY-SA, NC, ND and unknown are
 * rejected — the adapters return null for them.
 *
 * VERIFIED, not just found (CLAUDE.md: real, verified photos only for named
 * people/places). A candidate is accepted only when the SOURCE'S OWN TEXT
 * (title / description / alt / tags) contains at least half of the query's
 * key terms AND every proper name in the concept ("Boeing", "Madrid"). The
 * source text is the only admissible evidence that a picture shows what the
 * line says (scripts/verify-source-text.mjs). Where this stops: a keyword
 * match on the source's own caption is evidence, not proof — a mis-captioned
 * upload would pass.
 *
 * Budget: 30 search requests per invocation. Every request is logged
 * `[fetch] <source> <concept> → <hit|miss>`. HTTP 401/403 from any source
 * exits 1 with the source and the error (a revoked or wrong key must be
 * fixed, not skipped).
 */
"use strict";

const { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } = require("node:fs");
const { join, dirname } = require("node:path");
const { pathToFileURL } = require("node:url");
const { createHash } = require("node:crypto");

const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "src", "skills", "remotion-render", "public");
const MANIFEST = join(PUBLIC, "asset-library", "manifest.json");
const SOURCES_DIR = join(ROOT, "src", "skills", "asset-sourcing", "sources");
const ORDER = [
  { name: "pexels", key: "PEXELS_API_KEY" },
  { name: "wikimedia", key: null },
  { name: "unsplash", key: "UNSPLASH_ACCESS_KEY" },
  { name: "pixabay", key: "PIXABAY_API_KEY" },
  { name: "openverse", key: null },
];
const MAX_REQUESTS = 30;
const MIN_WIDTH = 800;
const OUT_MAX_W = 1440;
const OK_EXT = /\.(jpe?g|png|webp)(\?|$)/i;
const STOP = new Set(["photo", "photograph", "image", "picture", "showing", "shows", "with", "from", "into", "that", "this",
  "their", "there", "about", "using", "person", "people", "someone", "close", "view", "shot", "stock", "real"]);

function arg(n) { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; }
const stem = (w) => w.toLowerCase().slice(0, 5);
function keyTerms(q) {
  return [...new Set(String(q || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)))];
}
// Proper names: capitalised tokens in the concept that are not its first
// word (sentence case) — "Boeing", "Dreamliner", "Madrid", "YNAB".
function properNames(concept) {
  const toks = String(concept || "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  return [...new Set(toks.slice(1).filter((t) => /^[A-Z][A-Za-z0-9]{2,}$/.test(t) && !STOP.has(t.toLowerCase())))];
}
function sourceTextOf(c) {
  const t = c.sourceText || {};
  return [c.title, t.title, t.description, t.alt, t.tags].filter(Boolean).join(" ").toLowerCase();
}
function verify(c, concept, query) {
  const text = sourceTextOf(c);
  if (!text.trim()) return { ok: false, why: "source returned no text to verify against" };
  const terms = keyTerms(query);
  const hits = terms.filter((t) => text.includes(stem(t)));
  const need = Math.max(1, Math.ceil(terms.length / 2));
  if (hits.length < need) return { ok: false, why: `source text matches ${hits.length}/${terms.length} query terms (need ${need})` };
  const missing = properNames(concept).filter((n) => !text.includes(stem(n)));
  if (missing.length) return { ok: false, why: `source text lacks the name(s) ${missing.join(", ")}` };
  return { ok: true, why: `matches ${hits.join(", ")}` };
}

// Query back-off. Openverse (and often Commons) require EVERY term to match,
// so a 5-word query returns nothing: run 36355665493 missed every generic
// concept on Openverse — probed live, "lease renewal rent increase notice"
// -> 0 results, "rent increase notice" -> 7. Shorter forms are tried ONLY
// when a search returns zero results, and a candidate is verified against
// the query that actually found it.
function queriesFor(query) {
  const words = String(query || "").split(/\s+/).filter(Boolean);
  const key = words.filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));
  const out = [words.join(" ")];
  if (key.length > 3) out.push(key.slice(0, 3).join(" "));
  if (key.length > 2) out.push(key.slice(0, 2).join(" "));
  return [...new Set(out.filter(Boolean))];
}

function loadManifest() {
  try { return JSON.parse(readFileSync(MANIFEST, "utf8")); } catch { return { version: 1, assets: [] }; }
}

async function main() {
  const inPath = arg("in"), outPath = arg("out"), topic = arg("topic") || null;
  if (!inPath || !outPath) { console.error("usage: fetch-assets.cjs --in <concepts.json> --out <result.json> [--topic t]"); process.exit(2); }
  const wanted = JSON.parse(readFileSync(inPath, "utf8"));
  const sharp = require("sharp");
  const mods = {};
  for (const s of ORDER) mods[s.name] = await import(pathToFileURL(join(SOURCES_DIR, `${s.name}.js`)).href);
  const http = await import(pathToFileURL(join(ROOT, "src", "skills", "asset-sourcing", "http.js")).href);

  const manifest = loadManifest();
  let requests = 0;
  const resolved = [], unresolved = [];

  for (const w of wanted) {
    const concept = String(w.concept || "").trim(), query = String(w.asset_query || w.concept || "").trim();
    if (!concept) continue;
    const reasons = [];
    let done = false;
    for (const s of ORDER) {
      if (done) break;
      if (s.key && !process.env[s.key]) { reasons.push(`${s.name}: ${s.key} not set`); console.log(`[fetch] ${s.name} "${concept}" → skip (${s.key} not set)`); continue; }
      if (requests >= MAX_REQUESTS) { reasons.push(`request budget (${MAX_REQUESTS}) spent`); console.log(`[fetch] ${s.name} "${concept}" → skip (budget of ${MAX_REQUESTS} requests spent)`); continue; }
      let cands = [], usedQuery = query, failed = false;
      for (const q of queriesFor(query)) {
        if (requests >= MAX_REQUESTS) break;
        requests++;
        usedQuery = q;
        console.log(`[fetch] ${s.name} query "${q}"`);
        try {
          cands = await mods[s.name].search(q, { count: 6 });
        } catch (e) {
          const msg = String(e && e.message || e);
          if (/HTTP (401|403)\b/.test(msg)) {
            console.error(`::error::[fetch] ${s.name} rejected the request (${msg}) — fix the ${s.key || "source"} credential; not skipping`);
            process.exit(1);
          }
          reasons.push(`${s.name}: ${msg.slice(0, 120)}`);
          console.log(`[fetch] ${s.name} "${concept}" → miss (error: ${msg.slice(0, 120)})`);
          failed = true;
          break;
        }
        if ((cands || []).length) break;          // results: evaluate them; else back off
      }
      if (failed) continue;
      const why = [];
      for (let c of cands || []) {
        if (!c || !c.license) continue;               // adapters null out disallowed licenses
        // Wikimedia originals are often SVG/TIFF/PDF; Commons' raster
        // thumbnail of the SAME file is used then (run 36354137756: every
        // Wikimedia candidate on 4 channels was "miss (format)").
        if (!OK_EXT.test(c.downloadUrl || "") && c.thumbUrl && OK_EXT.test(c.thumbUrl)) c = { ...c, downloadUrl: c.thumbUrl };
        if (!OK_EXT.test(c.downloadUrl || "")) { why.push("format"); continue; }
        if (c.width && c.width < MIN_WIDTH) { why.push("too small"); continue; }
        const v = verify(c, concept, usedQuery);
        if (!v.ok) { why.push(v.why); continue; }
        const hash = createHash("sha1").update(c.downloadUrl).digest("hex").slice(0, 10);
        const id = `${s.name}-${hash}`;
        const rel = `asset-library/${s.name}/${hash}.jpg`;
        const abs = join(PUBLIC, rel);
        try {
          if (!existsSync(abs)) {
            const tmp = abs + ".download";
            await http.downloadFile(c.downloadUrl, tmp);
            mkdirSync(dirname(abs), { recursive: true });
            await sharp(tmp).rotate().resize({ width: OUT_MAX_W, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(abs);
            require("node:fs").rmSync(tmp, { force: true });
          }
        } catch (e) { why.push(`download failed: ${String(e.message || e).slice(0, 80)}`); continue; }
        const meta = await sharp(abs).metadata();
        let entry = manifest.assets.find((a) => a.id === id);
        if (!entry) {
          entry = {
            id, source: s.name, source_url: c.sourceUrl, download_url: c.downloadUrl, local_path: rel,
            license: c.licenseRaw || c.license, attribution: c.attribution,
            topics: topic ? [topic] : [], concepts: [], asset_queries: [],
            description: (c.sourceText && (c.sourceText.description || c.sourceText.alt || c.sourceText.tags || c.sourceText.title)) || c.title || "",
            source_text: c.sourceText || { title: c.title || "" },
            width: meta.width, height: meta.height, fetched_at: new Date().toISOString(),
          };
          manifest.assets.push(entry);
        }
        if (!entry.concepts.includes(concept)) entry.concepts.push(concept);
        if (!(entry.asset_queries || (entry.asset_queries = [])).includes(query)) entry.asset_queries.push(query);
        if (usedQuery !== query && !entry.asset_queries.includes(usedQuery)) entry.asset_queries.push(usedQuery);
        resolved.push({ beat: w.beat, concept, asset_id: id, local_path: rel, source: s.name, license: entry.license, verified: v.why });
        console.log(`[fetch] ${s.name} "${concept}" → hit (${id}, ${entry.license}; ${v.why}; ${statSync(abs).size} B)`);
        done = true;
        break;
      }
      if (!done) {
        const summary = why.length ? [...new Set(why)].slice(0, 3).join("; ") : "no licensed results";
        reasons.push(`${s.name}: ${summary}`);
        console.log(`[fetch] ${s.name} "${concept}" → miss (${summary})`);
      }
    }
    if (!done) unresolved.push({ beat: w.beat, concept, asset_query: query, reasons });
  }

  mkdirSync(dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ requests, resolved, unresolved }, null, 2) + "\n");
  console.log(`[fetch] ${resolved.length} resolved, ${unresolved.length} unresolved, ${requests}/${MAX_REQUESTS} search requests`);
}

main().catch((e) => { console.error(`[fetch] failed: ${e.stack || e}`); process.exit(1); });
