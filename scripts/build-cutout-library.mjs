#!/usr/bin/env node
/**
 * build-cutout-library.mjs — builds public/cutouts/ (src/skills/remotion-render/
 * public/cutouts/): real photographs of physical objects, isolated onto
 * transparent PNGs, one per concept the planner can name.
 *
 *   node scripts/build-cutout-library.mjs [--only dollar-bill,gavel] [--force] [--tries 6]
 *
 * For each spec in scripts/cutout-specs.json (39 names, 2-3 queries each — owner's list 2026-10-02):
 *   1. search Pixabay (primary), then Unsplash (only for a spec Pixabay could not give) with the query
 *      (asset-sourcing/sources/*), keep licences on the allowlist, drop anything
 *      the source calls a drawing / vector / icon, keep keyword matches first;
 *   2. download the largest results (>= 900 px), and for each: rembg u2net ->
 *      scripts/cutout_lib.py (alpha >= 12%, no opaque pixel on all four edges,
 *      one object, not a rectangle unless the object is one, ...);
 *   2b. content verification on the isolated PNG (scripts/verify-cutout-image.cjs): a vision model must
 *      answer MATCH (CLOSE / WRONG / no answer reject); three rejected candidates -> MISSING.md;
 *   3. the first result that passes is cropped, optimised (pngquant when it is
 *      installed) and saved as <name>.png with its source, licence and
 *      attribution in index.json / CREDITS.md;
 *   4. if the three queries yield nothing usable the name goes to MISSING.md —
 *      NEVER replaced by a drawing.
 * Idempotent: a cutout that exists is skipped unless --force.
 *
 * --from-dir <dir>: no network — for each spec, <dir>/<name>.jpg|jpeg|png|webp is
 * the photograph (with <dir>/<name>.json {"license","attribution","source_url"}:
 * a photograph without a licence is refused), isolated and checked the same way.
 * For photographs you supply yourself, and for testing the whole pipeline offline.
 *
 * Needs PIXABAY_API_KEY and UNSPLASH_ACCESS_KEY in the environment (a missing one
 * is logged and that source skipped; both missing exits 1 "no image source
 * available") and network access to pixabay.com / api.unsplash.com — a GitHub
 * Actions runner has both; an interactive session behind an egress allowlist does not.
 * --dry-run: search every spec's queries and report the counts; download nothing.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, appendFileSync, copyFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import sharp from "sharp";
import * as pixabay from "../src/skills/asset-sourcing/sources/pixabay.js";
import * as unsplash from "../src/skills/asset-sourcing/sources/unsplash.js";
import { downloadFile } from "../src/skills/asset-sourcing/http.js";
import { shortlist, creditsMarkdown, missingMarkdown, upsert, markMissing, withBackoff, hostOf, makePacer } from "./cutout-library-lib.mjs";
import { isAllowedLicense, normalizeLicense } from "../src/skills/asset-sourcing/licenses.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.CUTOUT_OUT_DIR || join(ROOT, "src", "skills", "remotion-render", "public", "cutouts");
const LOG = process.env.CUTOUT_LOG || join(ROOT, "data", "cutout-library-log.jsonl");
const INDEX = join(OUT, "index.json");
const PY = process.env.CUTOUT_PYTHON || "python3";
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const only = arg("only") ? arg("only").split(",") : null;
const force = process.argv.includes("--force");
const tries = Number(arg("tries", 6));
const fromDir = arg("from-dir");
// Sources, in order: Pixabay (primary), Unsplash (secondary — only asked for a spec Pixabay could not give).
// Each needs a key from the environment; a source without one is logged and skipped. Pexels, Wikimedia Commons and
// Openverse are not used (Pexels has paused new API keys; the other two returned the wrong objects for this project).
const ORDER = ["pixabay", "unsplash"];
const MODS = { pixabay, unsplash };
const KEYS = { pixabay: "PIXABAY_API_KEY", unsplash: "UNSPLASH_ACCESS_KEY" };
const SOURCES = {};
const skippedNoKey = [];
for (const name of ORDER) {
  if (process.env[KEYS[name]]) SOURCES[name] = MODS[name];
  else { console.warn(`[cutouts] ${name}: no key (${KEYS[name]}), skipped`); skippedNoKey.push(name); }
}
const dryRun = process.argv.includes("--dry-run");
if (!Object.keys(SOURCES).length && !arg("from-dir")) {
  console.error("::error::[cutouts] no image source available (PIXABAY_API_KEY and UNSPLASH_ACCESS_KEY are both missing in this environment)");
  process.exit(1);
}
console.log(`[cutouts] sources this run: ${Object.keys(SOURCES).join(", ") || "none (--from-dir)"}${dryRun ? " (dry run: search only, nothing downloaded or written)" : ""}`);
/** A stock-photo search reads best with "isolated" (one object on a plain ground); each query is tried with it first, then plain. */
const variantsOf = (q) => [`${q} isolated`, q];
// Pacing: Unsplash's free tier allows 50 requests / hour, so one call per 2 s; Pixabay and the image hosts are gentler.
const PACE_MS = { pixabay: 700, unsplash: 2000 };
const pace = (key, fn) => paceFor(key)(key, fn);
const pacers = {};
const paceFor = (key) => (pacers[key] ||= makePacer(PACE_MS[key] ?? 400));
const backoff = { dead: new Set(), streak: {} };   // per-source 429 streaks; 403 / three 429s in a row disable a source for the run

const { specs, min_side_px: MIN_SIDE } = JSON.parse(readFileSync(join(ROOT, "scripts", "cutout-specs.json"), "utf8"));
mkdirSync(OUT, { recursive: true });
mkdirSync(dirname(LOG), { recursive: true });
let index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : { version: 1, cutouts: [], missing: [] };
const log = (o) => appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...o }) + "\n");
const save = () => {
  writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n");
  writeFileSync(join(OUT, "CREDITS.md"), creditsMarkdown(index));
  writeFileSync(join(OUT, "MISSING.md"), missingMarkdown(index));
};

// Pixabay orientation per spec (owner's rule 2.4: vertical "for objects that
// should be tall"): a standing person, a tower or a pin is shot tall; a
// banknote, a card, a flag or a contract is shot wide, and vertical-only left
// those names with nothing to try (run 36950257339: 23 still missing).
// spec.orientation overrides; CUTOUT_PIXABAY_ORIENTATION overrides all.
const TALL = new Set(["person-silhouette", "person-walking", "business-person", "scientist", "worker", "office-tower", "map-pin"]);
const orientationOf = (spec) => (process.env.CUTOUT_PIXABAY_ORIENTATION || spec.orientation || (TALL.has(spec.name) ? "vertical" : "all")).toLowerCase();

async function searchOne(name, q, spec = {}) {
  if (backoff.dead.has(name)) return [];
  const orient = orientationOf(spec);
  const opts = name === "pixabay" ? { count: 30, orientation: orient === "all" ? null : orient } : { count: 12 };
  try { return await withBackoff(backoff, name, () => pace(name, () => SOURCES[name].search(q, opts))); }
  catch (e) {
    if (!e.disabled && !/HTTP (401|403|429)/.test(String(e.message))) console.warn(`[cutouts] ${name} failed for "${q}": ${String(e.message).slice(0, 100)}`);
    return [];
  }
}

function isolate(src, out, spec) {
  const flags = ["--max-side", "1024", ...(spec.rect_ok ? ["--rect-ok"] : []), ...(spec.grounded ? ["--grounded"] : []), ...(spec.multi ? ["--multi"] : [])];
  const r = spawnSync(PY, [join(ROOT, "scripts", "cutout_lib.py"), "isolate", src, out, ...flags], { encoding: "utf8", timeout: 240000 });
  try { return JSON.parse(r.stdout.trim().split("\n").pop()); } catch { return { ok: false, why: `cutout_lib failed: ${(r.stderr || "").slice(-200)}` }; }
}

/** pngquant when it is installed (visually lossless at 70-95), else the file as Pillow wrote it. */
function optimise(file) {
  const tmp = `${file}.q.png`;
  const r = spawnSync("pngquant", ["--quality=70-95", "--speed", "1", "--force", "--output", tmp, "--", file], { encoding: "utf8" });
  if (r.status === 0 && existsSync(tmp) && statSync(tmp).size < statSync(file).size) { copyFileSync(tmp, file); }
  try { rmSync(tmp, { force: true }); } catch {}
  return r.status === 0 ? "pngquant" : "pillow";
}

const work = join(tmpdir(), `cutout-raw-${process.pid}`);
mkdirSync(work, { recursive: true });
// Content verification (scripts/verify-cutout-image.cjs): a vision model checks the isolated PNG is the named
// object. Three rejected candidates for one name -> MISSING.md (owner's rule 2026-10-02).
const { verifyCutoutImage: verifyLive } = createRequire(import.meta.url)("./verify-cutout-image.cjs");
// Test stub (scripts/test-cutout-library.mjs runs the builder offline, no
// vision model): CUTOUT_VERIFY_STUB is honoured ONLY when the output dir is
// not the real library, so it can never let an unverified cutout ship.
const REAL_OUT = join(ROOT, "src", "skills", "remotion-render", "public", "cutouts");
const STUB = process.env.CUTOUT_VERIFY_STUB && OUT !== REAL_OUT ? String(process.env.CUTOUT_VERIFY_STUB).toUpperCase() : null;
if (process.env.CUTOUT_VERIFY_STUB && !STUB) console.warn("::warning::[cutouts] CUTOUT_VERIFY_STUB ignored: the output is the real library");
const verifyCutoutImage = STUB ? async () => ({ verdict: STUB, seen: "(test stub)", provider: "stub", cached: false }) : verifyLive;
const MAX_VERIFY_REJECTS = 3;
const verified = () => { try { return JSON.parse(readFileSync(join(OUT, "verified.json"), "utf8")); } catch { return {}; } };
const summary = [];
let made = 0, skipped = 0, missing = 0;
const dry = [];
for (const spec of specs) {
  if (only && !only.includes(spec.name)) continue;
  const file = join(OUT, `${spec.name}.png`);
  // Skipped only when it exists AND its verification passed (verified.json): an unverified cutout is rebuilt.
  if (existsSync(file) && !force && index.cutouts.some((c) => c.name === spec.name) && verified()[spec.name]?.verdict === "MATCH") { skipped++; continue; }
  const attempts = [];
  const tally = { tried: 0, isolation: 0, verify: 0, unverified: 0, accepted: 0 };
  summary.push([spec.name, tally]);
  let done = false, gaveUp = false;
  if (dryRun) { /* search only */ }
  // A source of candidates: the network (each query in turn) or a directory of photographs you supply.
  const rounds = fromDir ? [{ query: null }] : Object.keys(SOURCES).flatMap((source) => spec.queries.flatMap((query) => variantsOf(query).map((q) => ({ source, query, q }))));
  for (const { source, query, q } of rounds) {
    if (!fromDir && backoff.dead.has(source)) continue;
    if (done || gaveUp) break;
    let list;
    if (fromDir) {
      const ext = ["jpg", "jpeg", "png", "webp"].find((e) => existsSync(join(fromDir, `${spec.name}.${e}`)));
      const meta = existsSync(join(fromDir, `${spec.name}.json`)) ? JSON.parse(readFileSync(join(fromDir, `${spec.name}.json`), "utf8")) : null;
      if (!ext) { attempts.push("no photograph in --from-dir"); continue; }
      if (!meta?.license || !isAllowedLicense(meta.license)) { attempts.push(`${spec.name}.json has no allowed licence (${meta?.license || "none"})`); continue; }
      list = [{ sourceApi: "manual", localPath: join(fromDir, `${spec.name}.${ext}`), license: normalizeLicense(meta.license), attribution: meta.attribution || "", sourceUrl: meta.source_url || "" }];
    } else {
      const found = await searchOne(source, q, spec);
      list = shortlist(found, spec, { minSide: MIN_SIDE, query }).slice(0, tries);
      console.log(`[cutouts] ${spec.name}: ${source} "${q}" -> ${found.length} candidates, ${list.length} worth trying`);
      if (!list.length) attempts.push(`${source} "${q}": ${found.length} candidate(s), none passed the licence / keyword / size filter`);
      if (dryRun) {
        const by = (arr) => Object.entries(arr.reduce((m, c) => ((m[c.sourceApi] = (m[c.sourceApi] || 0) + 1), m), {})).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
        dry.push({ name: spec.name, query: `${source} ${q}`, found: found.length, worth: list.length, foundBy: by(found), worthBy: by(list) });
        continue;
      }
    }
    for (const [k, c] of list.entries()) {
      const raw = c.localPath || join(work, `${spec.name}-${k}.img`);
      if (!c.localPath) {
        try { const dl = c.thumbUrl || c.downloadUrl, hk = `download:${hostOf(dl)}`; await withBackoff(backoff, hk, () => pace(hk, () => downloadFile(dl, raw, { timeoutMs: 60000 }))); }
        catch (e) { attempts.push(`${source} "${q}": download failed (${c.sourceApi}: ${String(e.message).slice(0, 60)})`); continue; }
      }
      const meta = await sharp(raw).metadata().catch(() => null);
      if (!meta || Math.max(meta.width || 0, meta.height || 0) < MIN_SIDE) { attempts.push(`${source} "${q}": image unreadable or under ${MIN_SIDE}px`); if (!c.localPath) rmSync(raw, { force: true }); continue; }
      // 2-3. rembg + geometric checks, into a temp file: nothing reaches <name>.png before it is verified.
      tally.tried++;
      const n = tally.tried;
      const iso = join(work, `${spec.name}-${k}.png`);
      const rep = isolate(raw, iso, spec);
      log({ name: spec.name, query, source: c.sourceApi, url: c.sourceUrl, ok: rep.ok, why: rep.why, coverage: rep.coverage });
      if (!c.localPath) rmSync(raw, { force: true });
      if (!rep.ok) {
        tally.isolation++;
        console.log(`[cutout] ${spec.name}: ${c.sourceApi} candidate ${n}, isolation FAILED (${rep.why})`);
        attempts.push(`${source ? `${source} "${q}": ` : ""}rejected — ${rep.why}`);
        rmSync(iso, { force: true });
        continue;
      }
      // 4. content verification on the isolated PNG that would render (scripts/verify-cutout-image.cjs).
      let vr = await verifyCutoutImage(iso, spec.name, { sourceUrl: c.sourceUrl || c.downloadUrl || null });
      // No provider answered (rate limit, budget, outage): not a judgment of
      // the image. Retry twice after a pause; if still unanswered, skip the
      // candidate WITHOUT counting it as a content rejection.
      for (let r = 0; vr.verdict === "NONE" && r < 2; r++) {
        await new Promise((res) => setTimeout(res, 20000));
        vr = await verifyCutoutImage(iso, spec.name, { sourceUrl: c.sourceUrl || c.downloadUrl || null });
      }
      if (vr.verdict === "NONE") {
        tally.unverified++;
        console.log(`[cutout] ${spec.name}: ${c.sourceApi} candidate ${n}, isolation ok, verify UNAVAILABLE (no vision provider answered) — not saved, not counted as wrong`);
        attempts.push(`${source ? `${source} "${q}": ` : ""}verifier unavailable (no vision provider answered)`);
        rmSync(iso, { force: true });
        continue;
      }
      if (vr.verdict !== "MATCH") {
        tally.verify++;
        console.log(`[cutout] ${spec.name}: ${c.sourceApi} candidate ${n}, isolation ok, verify FAILED (saw "${vr.seen}")`);
        console.log(`[cutout] ${spec.name}: candidate rejected, saw "${vr.seen}"`);
        attempts.push(`${source ? `${source} "${q}": ` : ""}verify ${vr.verdict} — saw "${vr.seen}"`);
        rmSync(iso, { force: true });
        if (tally.verify >= MAX_VERIFY_REJECTS) { gaveUp = true; break; }
        console.log(`[cutout] ${spec.name}: trying next candidate`);
        continue;
      }
      console.log(`[cutout] ${spec.name}: ${c.sourceApi} candidate ${n}, isolation ok, verify PASSED (saw "${vr.seen}")`);
      // 5. all passed: save.
      copyFileSync(iso, file);
      rmSync(iso, { force: true });
      tally.accepted = 1;
      const how = optimise(file);
      const m2 = await sharp(file).metadata();
      index = upsert(index, { name: spec.name, category: spec.category, file: `cutouts/${spec.name}.png`, width: m2.width, height: m2.height, bytes: statSync(file).size, source: c.sourceApi,
        license: c.license, attribution: c.attribution, source_url: c.sourceUrl, query: q || "(supplied)", coverage: rep.coverage, optimised: how, built_at: new Date().toISOString() });
      console.log(`[cutouts] ${spec.name}: OK from ${c.sourceApi} (${c.license}), ${m2.width}x${m2.height}, ${(statSync(file).size / 1024).toFixed(0)} KB (${how})`);
      made++; done = true; break;
    }
  }
  if (!done && !dryRun) {
    rmSync(file, { force: true });
    index = markMissing(index, spec.name, attempts.slice(-12));
    missing++;
    console.warn(`[cutouts] ${spec.name}: MISSING after ${gaveUp ? `${MAX_VERIFY_REJECTS} candidates rejected by content verification` : fromDir ? "the supplied photograph" : `${spec.queries.length * 2} searches`}`);
  }
  if (!dryRun) save();           // after every cutout: a timeout keeps the work done so far
}
rmSync(work, { recursive: true, force: true });
if (dryRun) {
  const names = [...new Set(dry.map((d) => d.name))];
  const hit = names.filter((n) => dry.some((d) => d.name === n && d.worth > 0));
  console.log(`[cutouts] dry run: ${names.length} specs x ${dry.length} queries searched against ${Object.keys(SOURCES).join(" + ")}`);
  console.log(`[cutouts] dry run: ${hit.length}/${names.length} specs have >= 1 candidate that passes the licence / keyword / size filters; without: ${names.filter((n) => !hit.includes(n)).join(", ") || "none"}`);
  for (const d of dry) console.log(`[cutouts]   ${d.name} | "${d.query}" | found ${d.found} (${d.foundBy}) | worth trying ${d.worth} (${d.worthBy})`);
  process.exit(0);
}
save();
for (const [name, t] of summary) {
  console.log(`[cutout] ${name}: ${t.tried} candidates tried, ${t.isolation} rejected by isolation, ${t.verify} rejected by verification, ${t.unverified} unverifiable (no provider), ${t.accepted} accepted`);
}
console.log(`[cutouts] done: ${made} made, ${skipped} already present (verified), ${missing} missing; ${index.cutouts.length}/${specs.length} in the library`);
process.exit(0);
