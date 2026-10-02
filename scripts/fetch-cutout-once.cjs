#!/usr/bin/env node
/**
 * fetch-cutout-once.cjs — one cutout, fetched for ONE beat at render time
 * (owner's rule 2026-10-02: a pre-built library reuses whatever was fetched
 * the day it was built, not what this sentence needs).
 *
 *   fetchCutoutForBeat({ concept: "stack of coins", name: "coin-stack", channel: 1, beat_index: 3, spec })
 *     -> { png_path, abs_path, source_url, license, verdict: "MATCH", seen, width, height } | null
 *
 * For the concept: search Pixabay ("<concept> isolated", then "<concept>";
 * image_type=photo, safesearch=true), keep the first 3 results whose tags
 * share a word with the concept, and for each in order: download the
 * largest size -> rembg u2net + the geometric checks (scripts/cutout_lib.py:
 * object >= 12% of the image, no opaque pixel on all four edges, one object,
 * real transparency) -> content verification of the ISOLATED PNG
 * (verify-cutout-image.cjs; only MATCH is accepted — CLOSE, WRONG and "no
 * provider answered" all reject) -> saved to
 * public/cutouts-live/<channel>/<beat>-<slug>.png with a sidecar JSON.
 * All three rejected -> null (the caller falls back to the library, then to
 * type).
 *
 * Pixabay pacing: one request per 2 s for the whole process (a shared
 * token bucket: <= 30 a minute, under the free tier's 100); a 429 waits 30 s
 * and retries once, then gives up on that beat.
 * Cache: per process (one channel's render), concept -> result, so a
 * concept in two beats is fetched once. Nothing is cached across runs.
 *
 * Where this stops: the verdict is a vision model's reading (it once passed
 * a decorative sun dial as "calendar"); the frame reviewer checks the
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

const runCache = new Map();   // per process: `${channel}:${slug(concept)}` -> Promise<result|null>

async function fetchCutoutForBeat({ concept, name = null, channel, beat_index, spec = {} }) {
  const key = `${channel}:${slug(concept)}`;
  if (runCache.has(key)) {
    const r = await runCache.get(key);
    console.log(`[cutout-live] ch-${channel} beat ${beat_index} "${concept}": ${r ? `reused this run's ${r.png_path}` : "already failed this run"}`);
    return r;
  }
  const job = fetchOnce({ concept, name, channel, beat_index, spec });
  runCache.set(key, job);
  return job;
}

async function fetchOnce({ concept, name, channel, beat_index, spec }) {
  const tag = `ch-${channel} beat ${beat_index} "${concept}"`;
  const log = (m) => console.log(`[cutout-live] ${tag}: ${m}`);
  const want = new Set([...wordsOf(concept), ...wordsOf(name || "")]);
  const cands = [], seen = new Set();
  for (const q of [`${concept} isolated`, concept]) {
    if (cands.length >= 3) break;
    const r = await pixabay(q, log);
    if (r.rate) return null;
    for (const h of r.hits) {
      const url = h.largeImageURL || h.webformatURL;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      if (![...wordsOf(h.tags)].some((w) => want.has(w))) continue;          // the uploader's tags must name it
      if (Math.max(h.imageWidth || 0, h.imageHeight || 0) < 900) continue;
      cands.push({ url, page: h.pageURL || "", user: h.user || "" });
      if (cands.length >= 3) break;
    }
  }
  if (!cands.length) { log(`no Pixabay candidate whose tags name it`); return null; }
  const { verifyCutoutImage } = require("./verify-cutout-image.cjs");
  const flags = ["--max-side", "1024", ...(spec.rect_ok ? ["--rect-ok"] : []), ...(spec.grounded ? ["--grounded"] : []), ...(spec.multi ? ["--multi"] : [])];
  const work = join(tmpdir(), `cutout-live-${process.pid}`);
  mkdirSync(work, { recursive: true });
  for (const [i, c] of cands.entries()) {
    const n = i + 1, raw = join(work, `${slug(concept)}-${n}.img`), iso = join(work, `${slug(concept)}-${n}.png`);
    try {
      const res = await fetch(c.url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) { log(`candidate ${n}, download failed (HTTP ${res.status})`); continue; }
      writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    } catch (e) { log(`candidate ${n}, download failed (${e.message})`); continue; }
    const rep = await runPy([join(ROOT, "scripts", "cutout_lib.py"), "isolate", raw, iso, ...flags]);
    rmSync(raw, { force: true });
    if (!rep.ok) { log(`candidate ${n}, isolation FAILED (${rep.why})`); rmSync(iso, { force: true }); continue; }
    // No cross-run cache (sourceUrl null): each video verifies its own image.
    let v = await verifyCutoutImage(iso, name || concept, { sourceUrl: null, useCache: false });
    for (let r = 0; v.verdict === "NONE" && r < 2; r++) { await sleep(15000); v = await verifyCutoutImage(iso, name || concept, { sourceUrl: null, useCache: false }); }
    if (v.verdict !== "MATCH") {
      log(`candidate ${n}, isolation ok, verify ${v.verdict === "NONE" ? "UNAVAILABLE" : v.verdict} (saw "${v.seen}")`);
      rmSync(iso, { force: true });
      continue;
    }
    log(`candidate ${n}, isolation ok, verify MATCH (saw "${v.seen}")`);
    const dir = join(LIVE, String(channel));
    mkdirSync(dir, { recursive: true });
    const file = `${beat_index}-${slug(concept)}.png`;
    copyFileSync(iso, join(dir, file));
    rmSync(iso, { force: true });
    let width = null, height = null;
    try { const m = await require("sharp")(join(dir, file)).metadata(); width = m.width; height = m.height; } catch {}
    const out = { png_path: `cutouts-live/${channel}/${file}`, abs_path: join(dir, file), concept, name, source: "pixabay", source_url: c.page,
      license: "Pixabay Content License", attribution: c.user ? `Image by ${c.user} on Pixabay` : "Pixabay", verdict: "MATCH", seen: v.seen, provider: v.provider,
      width, height, fetched_at: new Date().toISOString() };
    writeFileSync(join(dir, file.replace(/\.png$/, ".json")), JSON.stringify(out, null, 2) + "\n");
    log("ACCEPTED");
    return out;
  }
  log(`all candidates rejected, beat will render without a live cutout`);
  return null;
}

module.exports = { fetchCutoutForBeat, _resetRunCache: () => runCache.clear() };

if (require.main === module) {
  require("dotenv/config");
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : null; };
  fetchCutoutForBeat({ concept: arg("concept"), name: arg("name"), channel: arg("channel") || "0", beat_index: arg("beat") || "0" })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r ? 0 : 1); });
}
