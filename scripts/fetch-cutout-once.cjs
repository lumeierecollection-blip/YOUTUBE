#!/usr/bin/env node
/**
 * fetch-cutout-once.cjs — one cutout, fetched for ONE beat at render time
 * (owner's rule 2026-10-02: a pre-built library reuses whatever was fetched
 * the day it was built, not what this sentence needs).
 *
 *   fetchCutoutForBeat({ concept: "stack of coins", name: "coin-stack", channel: 1, beat_index: 3, spec })
 *     -> { png_path, abs_path, source_url, license, verdict: "MATCH", literal, seen, width, height } | null
 *
 * For the concept: search Pixabay ("<concept> isolated", then "<concept>";
 * image_type=photo, safesearch=true), keep the first 6 results whose tags
 * name every word of the concept, and for each in order: download the
 * largest size -> rembg u2net + the geometric checks (scripts/cutout_lib.py:
 * object >= 12% of the image, no opaque pixel on all four edges, one object,
 * real transparency) -> content verification of the ISOLATED PNG
 * (verify-cutout-image.cjs: accepted only for verdict LITERAL and
 * recognizable; FIGURATIVE, DIFFERENT, not recognizable and "no provider
 * answered" all reject) -> saved to
 * public/cutouts-live/<channel>/<beat>-<slug>.png with a sidecar JSON.
 * All 6 rejected -> null, never the second-best: the beat renders without a
 * cutout. There is no library to fall back to (deleted 2026-10-02).
 *
 * Pixabay pacing: one request per 2 s for the whole process (a shared
 * token bucket: <= 30 a minute, under the free tier's 100); a 429 waits 30 s
 * and retries once, then gives up on that beat.
 * Reuse: per process (one channel's render), a concept in two beats is
 * fetched once, but the PNG is verified again before each reuse. Nothing is
 * kept across runs; public/cutouts-live/ is not committed.
 *
 * Where this stops: the verdict is a vision model's reading (an older prompt
 * once passed a sun dial as "calendar"); the frame reviewer checks the
 * rendered frame again. A named PERSON never comes through here — people
 * concepts are dropped on beats that name a person, whose photo stays on the
 * Wikipedia path (entity-assets.cjs).
 */
"use strict";
const { existsSync, mkdirSync, writeFileSync, rmSync, copyFileSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { spawn } = require("node:child_process");

const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "src", "skills", "remotion-render", "public");
const LIVE = join(PUBLIC, "cutouts-live");
const PY = process.env.CUTOUT_PYTHON || "python3";
const PACE_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

// One Pixabay request per PACE_MS for the whole process.
let nextSlot = 0;
async function pace() {
  const now = Date.now(), at = Math.max(now, nextSlot);
  nextSlot = at + PACE_MS;
  if (at > now) await sleep(at - now);
}

const STOP = new Set(["the", "and", "with", "for", "from", "isolated", "of", "a", "an", "photo"]);
const wordsOf = (s) => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));

async function pixabay(q, log) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return { hits: [], why: "no PIXABAY_API_KEY" };
  const url = `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&image_type=photo&safesearch=true&per_page=20`;
  for (let k = 0; k < 2; k++) {
    await pace();
    let res;
    try { res = await fetch(url, { signal: AbortSignal.timeout(20000) }); } catch (e) { return { hits: [], why: `network: ${e.message}` }; }
    if (res.status === 429) {
      if (k === 0) { log(`pixabay 429, waiting 30 s`); await sleep(30000); continue; }
      log(`pixabay 429, giving up on this beat`);
      return { hits: [], why: "pixabay 429", rate: true };
    }
    if (!res.ok) return { hits: [], why: `pixabay HTTP ${res.status}` };
    const j = await res.json().catch(() => ({}));
    return { hits: j.hits || [] };
  }
  return { hits: [], why: "pixabay 429" };
}

function runPy(args, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const p = spawn(PY, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const t = setTimeout(() => { p.kill("SIGKILL"); }, timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", () => { clearTimeout(t); try { resolve(JSON.parse(out.trim().split("\n").pop())); } catch { resolve({ ok: false, why: `cutout_lib failed: ${err.slice(-160)}` }); } });
    p.on("error", (e) => { clearTimeout(t); resolve({ ok: false, why: `python: ${e.message}` }); });
  });
}

// 8 candidates per concept (owner's spec 2026-10-03, part E.3; was 6).
const MAX_CANDIDATES = 8;
const runCache = new Map();   // per process: `${channel}:${slug(concept)}` -> Promise<result|null>
const { verifyImage } = require("./verify-image.cjs");
const UA = "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; cutouts)";

// A single bill or coin (part G): sourced from Wikipedia / Wikimedia first and checked
// for flatness. A stack, bundle, wallet, jar or card is an ordinary object.
const FLAT_MONEY = (c) => /\b(bills?|banknotes?|bank notes?|notes?|coins?|dollar)\b/i.test(c) && !/\b(stack|bundle|pile|banded|wad|jar|wallet|piggy|statement|card|receipt|purse)\b/i.test(c);

// Three questions (verify-image.cjs, part E): shows YES, LITERAL, CLEAN (and FLAT for money).
async function verify(png, concept, scene) {
  return verifyImage(png, { entity: concept, type: "object", scene, money: FLAT_MONEY(concept) });
}
const why = (v) => (v.unavailable ? "verifier unavailable" : v.reason);

async function fetchCutoutForBeat({ concept, name = null, channel, beat_index, spec = {}, scene = null }) {
  const key = `${channel}:${slug(concept)}`;
  if (runCache.has(key)) {
    // A concept already fetched this run: its PNG is verified again before it is reused.
    const r = await runCache.get(key);
    const tag = `[cutout] ch-${channel} beat ${beat_index} "${concept}"`;
    if (!r) { console.log(`${tag}: already rejected this run, beat renders without a cutout`); return null; }
    const v = await verify(r.abs_path, concept, scene);
    if (!v.accept) { console.log(`${tag}: reuse of ${r.png_path} REJECTED (${why(v)}, saw "${v.seen}")`); return null; }
    console.log(`${tag}: reuse of ${r.png_path} ACCEPTED (${v.reason}, saw "${v.seen}")`);
    return { ...r, literal: v.kind, seen: v.seen, provider: v.provider };
  }
  const job = fetchOnce({ concept, name, channel, beat_index, spec, scene });
  runCache.set(key, job);
  return job;
}

async function getJson(url) {
  try { const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) }); return r.ok ? await r.json() : null; } catch { return null; }
}
// Money (part G.1 / G.2), ahead of Pixabay: US currency is public domain and Wikipedia's
// article for each bill leads with a flat, straight-on scan; Commons holds the rest.
const DENOM = [["one hundred", /\b(100|hundred)\b/], ["fifty", /\b(50|fifty)\b/], ["twenty", /\b(20|twenty)\b/], ["ten", /\b(10|ten)\b/], ["five", /\b(5|five)\b/], ["two", /\b(2|two)\b/], ["one", /\b(1|one|single)\b/]];
async function moneyCandidates(concept, scene) {
  const out = [];
  const text = `${concept} ${scene || ""}`.toLowerCase();
  const us = /\b(dollar|usd|us|u\.s\.|american|federal reserve)\b|\$/.test(text) || !/\b(euro|pound|yen|rupee|peso|yuan|naira|franc|won|real)\b/.test(text);
  if (/\b(bills?|banknotes?|notes?|dollar)\b/.test(concept) && us) {
    const d = (DENOM.find(([, re]) => re.test(text)) || ["one hundred"])[0];
    const s = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(`United States ${d}-dollar bill`.replace(/ /g, "_"))}?redirect=true`);
    if (s?.originalimage?.source) out.push({ url: s.originalimage.source, page: s.content_urls?.desktop?.page || "https://en.wikipedia.org", user: "", source: "wikipedia", license: "Public domain (US federal work)" });
    for (const cat of ["Category:Federal Reserve Notes", "Category:Banknotes of the United States dollar"]) {
      const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtype=file&cmlimit=40&cmtitle=${encodeURIComponent(cat)}`);
      const files = (j?.query?.categorymembers || []).map((m) => m.title).filter((t) => /\.(jpe?g|png)$/i.test(t) && /obverse|front/i.test(t)).slice(0, 4);
      for (const f of files) out.push({ commonsFile: f, page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(f.replace(/ /g, "_"))}`, user: "", source: "wikimedia commons", license: "Public domain (US federal work)" });
    }
  } else {
    const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=10&srsearch=${encodeURIComponent(`${concept} obverse`)}`);
    for (const h of (j?.query?.search || []).filter((x) => /\.(jpe?g|png)$/i.test(x.title)).slice(0, 4)) out.push({ commonsFile: h.title, page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, "_"))}`, user: "", source: "wikimedia commons", license: "see Commons" });
  }
  // A Commons file's own URL (and licence, which must be free).
  for (const c of out.filter((x) => x.commonsFile)) {
    const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&titles=${encodeURIComponent(c.commonsFile)}`);
    const ii = Object.values(j?.query?.pages || {})[0]?.imageinfo?.[0];
    const lic = String(ii?.extmetadata?.LicenseShortName?.value || "");
    if (ii && !/non-?free|fair use/i.test(lic)) { c.url = ii.thumburl || ii.url; c.license = lic || c.license; }
  }
  return out.filter((c) => c.url);
}

async function fetchOnce({ concept, name, channel, beat_index, spec, scene }) {
  const tag = `ch-${channel} beat ${beat_index} "${concept}"`;
  const log = (m) => console.log(`[cutout] ${tag}: ${m}`);
  const cands = [], seen = new Set();
  const money = FLAT_MONEY(concept);
  if (money) {
    for (const c of await moneyCandidates(concept, scene)) if (!seen.has(c.url) && cands.length < MAX_CANDIDATES) { seen.add(c.url); cands.push(c); }
    log(`money: ${cands.length} Wikipedia / Wikimedia candidate(s) before Pixabay`);
  }
  for (const q of [`${concept} isolated`, concept]) {
    if (cands.length >= MAX_CANDIDATES) break;
    const r = await pixabay(q, log);
    if (r.rate) { if (cands.length) break; log(`Pixabay rate limit, beat renders without a cutout`); return null; }
    if (r.why) log(`Pixabay search "${q}": ${r.why}`);
    for (const h of r.hits) {
      const url = h.largeImageURL || h.webformatURL;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      // The uploader's tags must name EVERY word of the concept: "bank" alone
      // let piggy banks and coins in for "bank statement" (CI run 36988420698).
      { const tags = new Set(wordsOf(h.tags)); if (![...wordsOf(concept)].every((w) => tags.has(w))) continue; }
      if (Math.max(h.imageWidth || 0, h.imageHeight || 0) < 900) continue;
      cands.push({ url, page: h.pageURL || "", user: h.user || "", source: "pixabay", license: "Pixabay Content License" });
      if (cands.length >= MAX_CANDIDATES) break;
    }
  }
  if (!cands.length) { log(`no candidate whose tags name it, beat renders without a cutout`); return null; }
  // A bill is a rectangle by nature: the isolation keeps a rectangular object (cutout_lib --rect-ok).
  const flags = ["--max-side", "1024", ...(spec.rect_ok || money ? ["--rect-ok"] : []), ...(spec.grounded ? ["--grounded"] : []), ...(spec.multi ? ["--multi"] : [])];
  const work = join(tmpdir(), `cutout-live-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const rejected = { shows: 0, kind: 0, quality: 0, flat: 0, isolation: 0, other: 0 };
  for (const [i, c] of cands.entries()) {
    const n = i + 1, raw = join(work, `${slug(concept)}-${n}.img`), iso = join(work, `${slug(concept)}-${n}.png`);
    try {
      const res = await fetch(c.url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) { log(`candidate ${n} REJECTED (download failed, HTTP ${res.status})`); rejected.other++; continue; }
      writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    } catch (e) { log(`candidate ${n} REJECTED (download failed, ${e.message})`); rejected.other++; continue; }
    const rep = await runPy([join(ROOT, "scripts", "cutout_lib.py"), "isolate", raw, iso, ...flags]);
    rmSync(raw, { force: true });
    if (!rep.ok) { log(`candidate ${n} REJECTED (isolation: ${rep.why})`); rejected.isolation++; rmSync(iso, { force: true }); continue; }
    const v = await verify(iso, concept, scene);
    if (!v.accept) {
      for (const k of ["shows", "kind", "quality", "flat"]) if (String(v.reason).includes(`${k}=`)) rejected[k]++;
      if (v.unavailable) rejected.other++;
      log(`candidate ${n} REJECTED (${why(v)}, saw "${v.seen}") ${c.page}`);
      rmSync(iso, { force: true });
      continue;
    }
    const dir = join(LIVE, String(channel));
    mkdirSync(dir, { recursive: true });
    const file = `${beat_index}-${slug(concept)}.png`;
    copyFileSync(iso, join(dir, file));
    rmSync(iso, { force: true });
    let width = null, height = null;
    try { const m = await require("sharp")(join(dir, file)).metadata(); width = m.width; height = m.height; } catch {}
    const out = { png_path: `cutouts-live/${channel}/${file}`, abs_path: join(dir, file), concept, name, source: c.source || "pixabay", source_url: c.page,
      license: c.license || "Pixabay Content License", attribution: c.user ? `Image by ${c.user} on Pixabay` : c.source === "pixabay" ? "Pixabay" : "Wikimedia",
      verdict: "MATCH", literal: v.kind, shows: v.shows, quality: v.quality, flat: v.flat, seen: v.seen, provider: v.provider,
      width, height, fetched_at: new Date().toISOString() };
    writeFileSync(join(dir, file.replace(/\.png$/, ".json")), JSON.stringify(out, null, 2) + "\n");
    log(`candidate ${n} ACCEPTED (${v.reason}, saw "${v.seen}") ${c.page}`);
    return out;
  }
  log(`${cands.length} candidates, 0 accepted (rejected: shows ${rejected.shows}, kind ${rejected.kind}, quality ${rejected.quality}${money ? `, flat ${rejected.flat}` : ""}, isolation ${rejected.isolation}, other ${rejected.other}), beat renders as name card / TYPE`);
  return null;
}

module.exports = { fetchCutoutForBeat, pixabay, wordsOf, FLAT_MONEY, _resetRunCache: () => runCache.clear() };

if (require.main === module) {
  require("dotenv/config");
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : null; };
  fetchCutoutForBeat({ concept: arg("concept"), name: arg("name"), channel: arg("channel") || "0", beat_index: arg("beat") || "0" })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r ? 0 : 1); });
}
