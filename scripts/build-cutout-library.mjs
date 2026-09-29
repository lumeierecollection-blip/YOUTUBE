#!/usr/bin/env node
/**
 * build-cutout-library.mjs — builds public/cutouts/ (src/skills/remotion-render/
 * public/cutouts/): real photographs of physical objects, isolated onto
 * transparent PNGs, one per concept the planner can name.
 *
 *   node scripts/build-cutout-library.mjs [--only dollar-bill,gavel] [--force] [--tries 6]
 *
 * For each spec in scripts/cutout-specs.json (41 names, 3 queries each):
 *   1. search Pexels, Pixabay, Unsplash, Openverse and Wikimedia with the query
 *      (asset-sourcing/sources/*), keep licences on the allowlist, drop anything
 *      the source calls a drawing / vector / icon, keep keyword matches first;
 *   2. download the largest results (>= 900 px), and for each: rembg u2net ->
 *      scripts/cutout_lib.py (alpha >= 12%, no opaque pixel on all four edges,
 *      one object, not a rectangle unless the object is one, ...);
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
 * Needs network access to those hosts and PEXELS_API_KEY / PIXABAY_API_KEY /
 * UNSPLASH_ACCESS_KEY (a source with no key is skipped, as in asset-sourcing);
 * a GitHub Actions runner has both (the daily-pipeline-v2 `cutouts` job); an
 * interactive session behind an egress allowlist does not.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, appendFileSync, copyFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import * as pexels from "../src/skills/asset-sourcing/sources/pexels.js";
import * as pixabay from "../src/skills/asset-sourcing/sources/pixabay.js";
import * as unsplash from "../src/skills/asset-sourcing/sources/unsplash.js";
import * as openverse from "../src/skills/asset-sourcing/sources/openverse.js";
import * as wikimedia from "../src/skills/asset-sourcing/sources/wikimedia.js";
import { downloadFile } from "../src/skills/asset-sourcing/http.js";
import { shortlist, creditsMarkdown, missingMarkdown, upsert, markMissing } from "./cutout-library-lib.mjs";
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
const SOURCES = { pexels, pixabay, unsplash, openverse, wikimedia };
const KEYS = { pexels: "PEXELS_API_KEY", pixabay: "PIXABAY_API_KEY", unsplash: "UNSPLASH_ACCESS_KEY" };
// Default: the keyed sources that have a key. Openverse / Wikimedia (no key) only with --sources openverse,wikimedia.
const optIn = arg("sources") ? arg("sources").split(",") : [];
const skippedNoKey = [];
for (const name of Object.keys(SOURCES)) {
  if (KEYS[name] && !process.env[KEYS[name]]) { console.warn(`[cutouts] ${name}: no key, skipped`); skippedNoKey.push(name); delete SOURCES[name]; }
  else if (!KEYS[name] && !optIn.includes(name)) delete SOURCES[name];
}
console.log(`[cutouts] sources this run: ${Object.keys(SOURCES).join(", ") || "none"}`);
if (!Object.keys(SOURCES).length && !fromDir) {
  // Never "succeed" with nothing to search: an empty library must not be committed as if it were a result.
  console.error("::error::[cutouts] no source has an API key (PEXELS_API_KEY / PIXABAY_API_KEY / UNSPLASH_ACCESS_KEY are all empty in this job). Are the secrets set as REPOSITORY secrets for this repo (not environment / Dependabot / Codespaces secrets)?");
  process.exit(2);
}
const dead = new Set();       // sources that answered 401 / 403 / 429 this run: not asked again

const { specs, min_side_px: MIN_SIDE } = JSON.parse(readFileSync(join(ROOT, "scripts", "cutout-specs.json"), "utf8"));
mkdirSync(OUT, { recursive: true });
mkdirSync(dirname(LOG), { recursive: true });
let index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : { version: 1, cutouts: [], missing: [] };
index.sources_skipped = skippedNoKey;
const log = (o) => appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...o }) + "\n");
const save = () => {
  writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n");
  writeFileSync(join(OUT, "CREDITS.md"), creditsMarkdown(index));
  writeFileSync(join(OUT, "MISSING.md"), missingMarkdown(index));
};

async function searchAll(query) {
  const res = await Promise.all(Object.entries(SOURCES).filter(([n]) => !dead.has(n)).map(async ([name, mod]) => {
    try { return await mod.search(query, { count: 8 }); }
    catch (e) {
      const m = String(e.message || e);
      if (/HTTP (401|403|429)/.test(m)) { dead.add(name); console.warn(`[cutouts] ${name} refused (${m.slice(0, 60)}) — not asked again this run`); }
      else console.warn(`[cutouts] ${name} failed for "${query}": ${m.slice(0, 100)}`);
      return [];
    }
  }));
  return res.flat();
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
let made = 0, skipped = 0, missing = 0;
for (const spec of specs) {
  if (only && !only.includes(spec.name)) continue;
  const file = join(OUT, `${spec.name}.png`);
  if (existsSync(file) && !force && index.cutouts.some((c) => c.name === spec.name)) { skipped++; continue; }
  const attempts = [];
  let done = false;
  // A source of candidates: the network (each query in turn) or a directory of photographs you supply.
  const rounds = fromDir ? [null] : spec.queries;
  for (const query of rounds) {
    if (done) break;
    let list;
    if (fromDir) {
      const ext = ["jpg", "jpeg", "png", "webp"].find((e) => existsSync(join(fromDir, `${spec.name}.${e}`)));
      const meta = existsSync(join(fromDir, `${spec.name}.json`)) ? JSON.parse(readFileSync(join(fromDir, `${spec.name}.json`), "utf8")) : null;
      if (!ext) { attempts.push("no photograph in --from-dir"); continue; }
      if (!meta?.license || !isAllowedLicense(meta.license)) { attempts.push(`${spec.name}.json has no allowed licence (${meta?.license || "none"})`); continue; }
      list = [{ sourceApi: "manual", localPath: join(fromDir, `${spec.name}.${ext}`), license: normalizeLicense(meta.license), attribution: meta.attribution || "", sourceUrl: meta.source_url || "" }];
    } else {
      const found = await searchAll(query);
      list = shortlist(found, spec, { minSide: MIN_SIDE }).slice(0, tries);
      console.log(`[cutouts] ${spec.name}: "${query}" -> ${found.length} candidates, ${list.length} worth trying`);
      if (!list.length) attempts.push(`"${query}": ${found.length} candidate(s), none passed the licence / keyword / size filter`);
    }
    for (const [k, c] of list.entries()) {
      const raw = c.localPath || join(work, `${spec.name}-${k}.img`);
      if (!c.localPath) {
        try { await downloadFile(c.downloadUrl, raw, { timeoutMs: 60000 }); }
        catch (e) { attempts.push(`"${query}": download failed (${c.sourceApi}: ${String(e.message).slice(0, 60)})`); continue; }
      }
      const meta = await sharp(raw).metadata().catch(() => null);
      if (!meta || Math.max(meta.width || 0, meta.height || 0) < MIN_SIDE) { attempts.push(`"${query}": ${c.sourceApi} image unreadable or under ${MIN_SIDE}px`); if (!c.localPath) rmSync(raw, { force: true }); continue; }
      const rep = isolate(raw, file, spec);
      log({ name: spec.name, query, source: c.sourceApi, url: c.sourceUrl, ok: rep.ok, why: rep.why, coverage: rep.coverage });
      if (!c.localPath) rmSync(raw, { force: true });
      if (!rep.ok) { attempts.push(`${query ? `"${query}": ` : ""}${c.sourceApi} rejected — ${rep.why}`); continue; }
      const how = optimise(file);
      const m2 = await sharp(file).metadata();
      index = upsert(index, { name: spec.name, category: spec.category, file: `cutouts/${spec.name}.png`, width: m2.width, height: m2.height, bytes: statSync(file).size, source: c.sourceApi,
        license: c.license, attribution: c.attribution, source_url: c.sourceUrl, query: query || "(supplied)", coverage: rep.coverage, optimised: how, built_at: new Date().toISOString() });
      console.log(`[cutouts] ${spec.name}: OK from ${c.sourceApi} (${c.license}), ${m2.width}x${m2.height}, ${(statSync(file).size / 1024).toFixed(0)} KB (${how})`);
      made++; done = true; break;
    }
  }
  if (!done) {
    rmSync(file, { force: true });
    index = markMissing(index, spec.name, attempts.slice(-12));
    missing++;
    console.warn(`[cutouts] ${spec.name}: MISSING after ${fromDir ? "the supplied photograph" : `${spec.queries.length} queries`}`);
  }
  save();                        // after every cutout: a timeout keeps the work done so far
}
rmSync(work, { recursive: true, force: true });
save();
console.log(`[cutouts] done: ${made} made, ${skipped} already present, ${missing} missing; ${index.cutouts.length}/${specs.length} in the library`);
process.exit(0);
