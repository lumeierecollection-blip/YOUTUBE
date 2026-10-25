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
 * image_type=photo, safesearch=true) and then Wikimedia Commons (free licences
 * only; the second source, and the only one where there is no Pixabay key), keep
 * up to 8 results whose tags / file title name every word of the concept, and
 * for each in order: download the
 * largest size -> rembg u2net + the geometric checks (scripts/cutout_lib.py:
 * object >= 12% of the image, no opaque pixel on all four edges, one object,
 * real transparency) -> content verification of the ISOLATED PNG
 * (verify-cutout-image.cjs: accepted only for verdict LITERAL and
 * recognizable; FIGURATIVE, DIFFERENT, not recognizable and "no provider
 * answered" all reject; then a blind pass names the subject without being told
 * the concept, and it must agree) -> saved to
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
 * Resolution: an isolated object smaller than MIN_SIDE px on its long side is rejected
 * before the judge sees it — the hero cutout is drawn ~600-900 px tall on a 1080x1920
 * frame (the reference videos' cutouts are crisp), and an upscaled thumbnail is not.
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
const PACE_MS = Number(process.env.CUTOUT_PACE_MS || 2000);
const WAIT_429_MS = Number(process.env.CUTOUT_429_WAIT_MS || 20000);   // first wait after a download 429 without Retry-After (doubles once)
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

// A candidate's image DOWNLOAD. Pixabay's image host rate-limits too: on 2026-10-18 (run 39128017438) nearly every download answered 429 while the search API
// still answered, and each 429 was counted as a rejected candidate — ch-44 got 0 props on 8 beats, ch-1 0-1 — with no picture ever looked at. So a Pixabay
// download is paced through the same bucket as the search, a 429 waits (Retry-After, at most 60 s) and retries twice, and a download still refused is
// reported as RATE-LIMITED, not as a rejected picture.
async function download(c) {
  for (let k = 0; ; k++) {
    if (c.source === "pixabay") await pace();
    const res = await fetch(c.url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
    if (res.status !== 429 || k >= 2) return res;
    const ra = Number(res.headers.get("retry-after"));
    await sleep(Math.min(60000, Number.isFinite(ra) && ra > 0 ? ra * 1000 : WAIT_429_MS * (k + 1)));
  }
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
const MAX_CANDIDATES_DEFAULT = 8;
const runCache = new Map();   // per process: `${channel}:${slug(concept)}` -> Promise<result|null>
const { verifyImage } = require("./verify-image.cjs");
const UA = "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; cutouts)";

// A single bill or coin (part G): sourced from Wikipedia / Wikimedia first and checked
// for flatness. A stack, bundle, wallet, jar or card is an ordinary object.
const FLAT_MONEY = (c) => /\b(bills?|banknotes?|bank notes?|notes?|coins?|dollar)\b/i.test(c) && !/\b(stack|bundle|pile|banded|wad|jar|wallet|piggy|statement|card|receipt|purse)\b/i.test(c);

// Three questions (verify-image.cjs, part E): shows YES, LITERAL, CLEAN (and FLAT for money).
// What the verifier SAW may still put a person or a costume next to the object (board 39031532519 ch-26: "a hand holding a red marker pen" passed as
// "pen", next to a named defendant; "a green piggy bank wearing sunglasses"). A stranger's hand reads as the story's person and a dressed-up object is a
// joke, so either refuses the photo whatever the three answers were. Only when the concept itself is not about a person or clothing.
const SAW_PERSON = /(?<!-)\b(hands?|fingers?|person|people|man|men|woman|women|boy|girl|child|someone|holding|held by|wearing|dressed|costume|sunglasses|cartoon|smiling)\b(?!-)/i;
// A concept that IS a generic person (plan-props.mjs PEOPLE, allowed since 2026-10-18, captioned on screen) is not refused for showing one: "worker counting
// coins" or "police officer" would otherwise always fail here, since the verifier says "a man ..." of every such photo.
const PERSON_CONCEPT = /\b(man|men|woman|women|person|people|boy|girl|child|children|kid|kids|worker|workers|officer|officers|judge|lawyer|doctor|nurse|teacher|student|students|ceo|businessman|businesswoman|crowd|family|couple|soldier|player|fans?|hands?|human|humans)\b/i;
// A BLANK object shows nothing (run 39169019904 ch-1: "stack of papers" accepted as "stack of blank white paper" and held a featureless white box on
// screen for 8 s; board 38976972038: a blank old book passed as "document" twice). Refused unless the concept asks for blankness.
const SAW_BLANK = /\b(blank|plain white|empty white|unprinted|featureless|unlabell?ed)\b/i;
function sawRefusal(seen, concept) {
  if (!seen) return null;
  const c = String(concept || "");
  const b = SAW_BLANK.test(c) || /\bempty\b/i.test(c) ? null : String(seen).match(SAW_BLANK);
  if (b) return `the photo shows a "${b[0]}" object: nothing a viewer can read at a glance`;
  if (SAW_PERSON.test(c) || PERSON_CONCEPT.test(c)) return null;
  const m = String(seen).match(SAW_PERSON);
  return m ? `the photo shows "${m[0]}" with the object (a stranger or a costume)` : null;
}
// explains: the claim an EXPLAINING prop shows (plan-props.mjs role "explains"); the verifier then also asks whether the photo explains it.
async function verify(png, concept, scene, explains = null) {
  const v = await verifyImage(png, { entity: concept, type: "object", scene, money: FLAT_MONEY(concept), alone: true, explains });
  const refused = v.accept ? sawRefusal(v.seen, concept) : null;
  return refused ? { ...v, accept: false, reason: refused } : v;
}
const why = (v) => (v.unavailable ? "verifier unavailable" : v.reason);

// A bare concept is searched and verified out of context: "plates" in a steel-mill sentence
// fetched a fruit plate (CI run 37114977307 ch-48 beat 3), and the reuse check rejected it.
// The concept is qualified with the material the sentence/scene gives it: the word right
// before it when that is a material ("copper wire"), else — only for nouns that mean a
// different object in every trade (plates, sheets, bars, coils...) — the first material the
// text names ("heavy plates" at "a steel mill" -> "steel plates"). It never invents a
// material: no material word in the text, the concept is left as the planner wrote it.
const MATERIAL = "steel|stainless|metal|iron|aluminium|aluminum|copper|brass|bronze|titanium|lead|zinc|tin|glass|wooden|wood|timber|plastic|concrete|paper|cardboard|gold|silver|rubber|leather|ceramic|stone|carbon|silicon|lithium";
const AMBIGUOUS = /^(plates?|sheets?|bars?|coils?|rods?|chips?|blocks?|beams?|tubes?|pipes?|wires?|rolls?|panels?|cells?|cards?|slabs?|ingots?)$/i;
function qualifyConcept(concept, text) {
  const c = String(concept || "").trim();
  if (!c || /\s/.test(c) || !text) return c;
  const t = String(text).toLowerCase();
  const before = t.match(new RegExp(`\\b(${MATERIAL})\\s+${c.toLowerCase()}\\b`));
  if (before) return `${before[1]} ${c}`;
  if (!AMBIGUOUS.test(c)) return c;
  const any = t.match(new RegExp(`\\b(${MATERIAL})\\b`));
  return any ? `${any[1]} ${c}` : c;
}

async function fetchCutoutForBeat({ concept, name = null, channel, beat_index, spec = {}, scene = null, explains = null }) {
  // an explaining fetch is judged on one more question; its refusal ("decorative" for that claim) must not block the object where a sentence names it
  const key = `${channel}:${slug(concept)}${explains ? ":explains" : ""}`;
  if (runCache.has(key)) {
    // A concept already fetched this run: its PNG is verified again before it is reused.
    const r = await runCache.get(key);
    const tag = `[cutout] ch-${channel} beat ${beat_index} "${concept}"`;
    if (!r) { console.log(`${tag}: already rejected this run, beat renders without a cutout`); return null; }
    const v = await verify(r.abs_path, concept, scene, explains);
    if (!v.accept) { console.log(`${tag}: reuse of ${r.png_path} REJECTED (${why(v)}, saw "${v.seen}")`); return null; }
    console.log(`${tag}: reuse of ${r.png_path} ACCEPTED (${v.reason}, saw "${v.seen}")`);
    return { ...r, literal: v.kind, seen: v.seen, provider: v.provider };
  }
  // A concept that only hit the rate limit is not remembered as rejected: the cache entry is dropped, so the next beat that wants it fetches it again.
  const job = fetchOnce({ concept, name, channel, beat_index, spec, scene, explains }).then((r) => {
    if (r !== RATE_LIMITED) return r;
    if (runCache.get(key) === job) runCache.delete(key);
    return null;
  });
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
    // A US story gets US coins only: "coin" for "$3.8 million" fetched an Iranian Pahlavi gold coin with two men's portraits (run 39012850944 ch-26). With no
    // US file in the results nothing is taken here and Pixabay's generic coins are tried instead.
    const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=20&srsearch=${encodeURIComponent(`${us ? "United States " : ""}${concept} obverse`)}`);
    const usFile = (t) => /united states|\bu\.?s\.?\b|quarter|dime|nickel|\bcent\b|penny|half dollar|dollar coin|eagle/i.test(t);
    for (const h of (j?.query?.search || []).filter((x) => /\.(jpe?g|png)$/i.test(x.title) && (!us || usFile(x.title))).slice(0, 4)) out.push({ commonsFile: h.title, page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, "_"))}`, user: "", source: "wikimedia commons", license: "see Commons" });
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

async function fetchOnce({ concept, name, channel, beat_index, spec, scene, explains = null }) {
  const tag = `ch-${channel} beat ${beat_index} "${concept}"`;
  const log = (m) => console.log(`[cutout] ${tag}: ${m}`);
  const cands = [], seen = new Set();
  // spec.max_candidates: how many candidates a VISION MODEL looks at — a PROP (render-and-qa.js attachCloneProps) at most 3: every look costs one vision call,
  // and a board of props on every beat with 8 each ran all four Gemini keys out of quota (board 38889577784). A prop that fails 3 gives way to the beat's next.
  // The cap counts LOOKS, not downloads (run 39165054721: ch-9 "mineral rock sample", "federal document", "industrial furnace" spent all 3 slots on photos the
  // free local isolation refused — 0.0% / 5.5% / 8.6% object, "nothing removed" — so no picture was ever looked at and 6 of 7 beats got none). Up to
  // MAX_POOL candidates are downloaded and isolated (local, no model); the vision cap applies only to those that come out as a clean single object.
  const MAX_CANDIDATES = Math.max(1, Number(spec.max_candidates) || MAX_CANDIDATES_DEFAULT);
  const MAX_POOL = Math.max(MAX_CANDIDATES, Number(process.env.CUTOUT_POOL || 8));
  const money = FLAT_MONEY(concept);
  if (money) {
    for (const c of await moneyCandidates(concept, scene)) if (!seen.has(c.url) && cands.length < MAX_CANDIDATES) { seen.add(c.url); cands.push(c); }
    log(`money: ${cands.length} Wikipedia / Wikimedia candidate(s) before Pixabay`);
  }
  // Tags: a hit whose tags name EVERY word of the concept comes first; then one whose tags name its HEAD noun (the last word: "bill" of "unpaid bills").
  // Every word was once required — "bank" alone let piggy banks in for "bank statement" (CI run 36988420698) — and the head noun still is ("statement"),
  // but uploaders do not tag the explaining word: "unpaid bills", "falling banknotes", "empty wallet" found nothing to look at (run 39165054721 ch-1).
  // The vision check, not the tags, decides whether the picture shows the concept.
  const want = wordsOf(concept), head = want[want.length - 1];
  const full = [], partial = [];
  for (const q of [`${concept} isolated`, concept, ...(want.length > 1 && head ? [`${head} isolated`] : [])]) {
    if (cands.length + full.length >= MAX_POOL) break;
    const r = await pixabay(q, log);
    if (r.rate) { if (cands.length || full.length || partial.length) break; log(`Pixabay rate limit, beat renders without a cutout`); return RATE_LIMITED; }
    if (r.why) log(`Pixabay search "${q}": ${r.why}`);
    for (const h of r.hits) {
      const url = h.largeImageURL || h.webformatURL;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      if (Math.max(h.imageWidth || 0, h.imageHeight || 0) < 900) continue;
      const tags = new Set(wordsOf(h.tags));
      const c = { url, page: h.pageURL || "", user: h.user || "", source: "pixabay", license: "Pixabay Content License" };
      if (want.every((w) => tags.has(w))) full.push(c);
      else if (head && tags.has(head)) partial.push(c);
    }
  }
  cands.push(...[...full, ...partial].slice(0, Math.max(0, MAX_POOL - cands.length)));
  if (!cands.length) { log(`no candidate whose tags name it, beat renders without a cutout`); return null; }
  // A bill is a rectangle by nature: the isolation keeps a rectangular object (cutout_lib --rect-ok).
  const flags = ["--max-side", "1024", ...(spec.rect_ok || money ? ["--rect-ok"] : []), ...(spec.grounded ? ["--grounded"] : []), ...(spec.multi ? ["--multi"] : [])];
  const work = join(tmpdir(), `cutout-live-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const rejected = { shows: 0, kind: 0, quality: 0, flat: 0, isolation: 0, other: 0 };
  let limited = 0, looks = 0;
  for (const [i, c] of cands.entries()) {
    if (looks >= MAX_CANDIDATES) break;
    const n = i + 1, raw = join(work, `${slug(concept)}-${n}.img`), iso = join(work, `${slug(concept)}-${n}.png`);
    try {
      const res = await download(c);
      if (res.status === 429) { log(`candidate ${n} NOT CHECKED (download rate-limited, HTTP 429 after retries)`); limited++; continue; }
      if (!res.ok) { log(`candidate ${n} REJECTED (download failed, HTTP ${res.status})`); rejected.other++; continue; }
      writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    } catch (e) { log(`candidate ${n} REJECTED (download failed, ${e.message})`); rejected.other++; continue; }
    // A Wikipedia / Wikimedia bill or coin scan is already the object edge to edge: background
    // removal has nothing to remove and refused 6 of 8 (CI run 37110620556 ch-1). Its margin is
    // trimmed and the scan used as it is — still verified (three questions + FLAT) below.
    let rep;
    if (money && c.source !== "pixabay") {
      try {
        await require("sharp")(raw).trim({ threshold: 18 }).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).ensureAlpha().png().toFile(iso);
        rep = { ok: true };
      } catch (e) { rep = { ok: false, why: `scan could not be read (${e.message})` }; }
    } else rep = await runPy([join(ROOT, "scripts", "cutout_lib.py"), "isolate", raw, iso, ...flags]);
    rmSync(raw, { force: true });
    if (!rep.ok) { log(`candidate ${n} REJECTED (isolation: ${rep.why})`); rejected.isolation++; rmSync(iso, { force: true }); continue; }
    looks++;
    const v = await verify(iso, concept, scene, explains);
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
      license: c.license || "Pixabay Content License",
      attribution: c.source === "pixabay" ? (c.user ? `Image by ${c.user} on Pixabay` : "Pixabay") : c.user ? `${c.user}, ${c.license}, via Wikimedia Commons` : `Wikimedia Commons (${c.license})`,
      verdict: "MATCH", literal: v.kind, shows: v.shows, quality: v.quality, flat: v.flat, seen: v.seen, blind: v.blind || null, provider: v.provider,
      width, height, fetched_at: new Date().toISOString() };
    writeFileSync(join(dir, file.replace(/\.png$/, ".json")), JSON.stringify(out, null, 2) + "\n");
    log(`candidate ${n} ACCEPTED (${v.reason}, saw "${v.seen}") ${c.page}`);
    return out;
  }
  log(`${cands.length} candidates, ${looks} looked at, 0 accepted (rejected: shows ${rejected.shows}, kind ${rejected.kind}, quality ${rejected.quality}${money ? `, flat ${rejected.flat}` : ""}, isolation ${rejected.isolation}, other ${rejected.other}${limited ? `; ${limited} never checked: rate-limited` : ""}), beat renders as name card / TYPE`);
  // Only pictures that were LOOKED AT and refused make the concept "rejected this run"; one that was never downloaded may be tried again by a later beat.
  return limited ? RATE_LIMITED : null;
}
const RATE_LIMITED = Symbol("rate-limited");

module.exports = { fetchCutoutForBeat, qualifyConcept, sawRefusal, pixabay, wordsOf, FLAT_MONEY, _resetRunCache: () => runCache.clear() };

if (require.main === module) {
  require("dotenv/config");
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : null; };
  fetchCutoutForBeat({ concept: arg("concept"), name: arg("name"), channel: arg("channel") || "0", beat_index: arg("beat") || "0" })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r ? 0 : 1); });
}
