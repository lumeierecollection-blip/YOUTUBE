#!/usr/bin/env node
/**
 * resolve.mjs — the material resolver of the visual director (docs/VISUAL-DIRECTOR.md).
 *
 *   node scripts/visual-director/materials/resolve.mjs --direction <direction.json> --out <direction.resolved.json> \
 *        --assets-dir <dir> --report <materials-report.json> [--research <research.json>]
 *
 * For every material of every shot (schemas/scene-direction.json definitions/material):
 *   1. run its `search` queries — Wikimedia Commons and the Wikipedia lead image first; museum / archive
 *      sources only when those give too few candidates; stock sites only for kind photo / object-cutout
 *      (sources.mjs sourceOrder)
 *   2. download at most MAX_CANDIDATES (6) licensed candidates, round-robin across the queries
 *   3. ask a vision model the literal question "Does this image show: <must_show>?" (verify.mjs)
 *   4. keep the FIRST YES; record file, source_url, license, credit and the verdict in material.resolved
 *   kind object-cutout: the YES photo then goes through the existing rembg step + its alpha quality gate
 *                       (scripts/rembg-process.cjs removeBackground); a failed cutout tries the next candidate
 *   kind data:          nothing is downloaded; every value must be in the research JSON with a source_url (data.mjs)
 *
 * Nothing verifies -> resolved.status "missing" (or "unverified" when no vision provider answered at all), file null.
 * There is NO substitution step: no generic photo, no look-alike, no "closest" PARTLY answer (CLAUDE.md hard rule).
 * Every material is treated as essential (the schema has no optional flag, and a shot's materials are what it
 * draws), so every unresolved one is listed in report.beats[].essential_missing for the loop to send back to the director.
 *
 * Cache: <assets-dir>/.cache/<sha1(query|must_show)>.json holds that query's search results per source and every
 * verdict reached for (candidate url, must_show). A rerun reuses both: no re-search, no re-download, no re-ask.
 * UNAVAILABLE ("no provider answered") is never cached. Downloads: <assets-dir>/raw/, chosen files: <assets-dir>/materials/.
 * resolved.file is that path as <assets-dir>/materials/<file>, joined onto --assets-dir exactly as it was passed.
 *
 * Research for kind data: --research when given, else derived from the direction's `script` path
 * (data/research/<ch>/<slug>-script.json -> <slug>.json, "-shorts-script" likewise).
 *
 * Where this stops: a YES is one vision model's reading (verify.mjs); licences are what the source API reports
 * (Openverse says its own licence data is unverified); museum/archive search quality varies by query.
 * Exit codes: 0 resolver ran (missing materials are a result, not an error), 2 bad input / output failed the schema.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname, basename, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateData } from "./data.mjs";

export const MAX_CANDIDATES = 6;
const PRIMARY = new Set(["wikimedia", "wikipedia-lead"]);
const sha1 = (s) => createHash("sha1").update(String(s)).digest("hex");
const safe = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "material";

/** The cache key of one (query, must_show) pair. Pure. */
export function cacheKey(query, mustShow) {
  return sha1(`${String(query).trim().toLowerCase()}|${String(mustShow).trim().toLowerCase()}`);
}

/**
 * Commons search is AND over the query's words, so a sentence-shaped query finds almost nothing
 * (run 40377931670: "Hittite cuneiform clay tablet artifact" matched one PDF; "Hittite cuneiform
 * tablet" matched ten photographs). Every long query also contributes its last qualifier dropped
 * and its first three keywords. Originals first, deduped, at most `maxExtra` additions. Pure.
 */
export function queryVariants(queries, { maxExtra = 4 } = {}) {
  const out = [...queries];
  const seen = new Set(out.map((q) => q.toLowerCase()));
  for (const q of queries) {
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length <= 3) continue;
    for (const v of [words.slice(0, -1).join(" "), words.slice(0, 3).join(" ")]) {
      const k = v.toLowerCase();
      if (seen.has(k) || v.split(" ").length < 2) continue;
      seen.add(k); out.push(v);
      if (out.length >= queries.length + maxExtra) return out;
    }
  }
  return out;
}

/** research JSON path for a script path, or null. Pure. */
export function researchPathFor(scriptPath) {
  if (!scriptPath) return null;
  const p = String(scriptPath).replace(/-shorts-script\.json$/, ".json").replace(/-script\.json$/, ".json");
  return p === scriptPath ? null : p;
}

async function defaultDeps() {
  const sources = await import("./sources.mjs");
  const verify = await import("./verify.mjs");
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  return {
    sourceOrder: sources.sourceOrder,
    search: (source, query) => sources.searchSource(source, query, { count: MAX_CANDIDATES }),
    // download, then re-encode to JPEG with sharp: a TIFF / WebP / broken file is refused here, not in the renderer
    download: async (url, dest) => {
      const tmp = `${dest}.part`;
      await sources.download(url, tmp);
      const sharp = (await import("sharp")).default;
      await sharp(tmp).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toFile(dest);
      const { rmSync } = await import("node:fs");
      rmSync(tmp, { force: true });
      return dest;
    },
    verify: (file, mustShow) => verify.verifyMaterial(file, mustShow),
    cutout: (input, output) => require("../../rembg-process.cjs").removeBackground(resolvePath(input), resolvePath(output)),
    log: (m) => console.log(`[materials] ${m}`),
  };
}

function loadCache(dir, key) {
  try { return JSON.parse(readFileSync(join(dir, `${key}.json`), "utf8")); } catch { return null; }
}
function saveCache(dir, key, c) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${key}.json`), JSON.stringify(c, null, 2) + "\n");
}

/** Resolve one non-data material. Returns { resolved, entry } (entry = this material's report record). */
async function resolveImage(material, ctx) {
  const { deps, assetsDir } = ctx;
  const cacheDir = join(assetsDir, ".cache");
  const queries = queryVariants((material.search || []).map((q) => String(q).trim()).filter(Boolean));
  const caches = queries.map((q) => {
    const key = cacheKey(q, material.must_show);
    const c = loadCache(cacheDir, key);
    return { key, q, hit: !!c, data: c || { query: q, must_show: material.must_show, searched: {}, verdicts: {} } };
  });
  const entry = { queries: caches.map((c) => ({ query: c.q, cache: c.hit ? "hit" : "miss", sources: [], errors: [] })), candidates: [], chosen: null, status: "missing", why_missing: null };
  const order = deps.sourceOrder(material.kind);
  const tiers = [order.filter((s) => PRIMARY.has(s)), order.filter((s) => !PRIMARY.has(s))];
  const seen = new Set();
  let tried = 0, unavailable = 0;

  const fetchTier = async (tier) => {
    const lists = [];
    for (const [qi, c] of caches.entries()) {
      const list = [];
      for (const src of tier) {
        let got = c.data.searched[src];
        if (!got) {
          try { got = await deps.search(src, c.q); c.data.searched[src] = got; }
          catch (e) { entry.queries[qi].errors.push(`${src}: ${String(e.message || e).slice(0, 160)}`); got = []; }
        }
        entry.queries[qi].sources.push(`${src}:${got.length}`);
        for (const cand of got) list.push({ ...cand, _q: qi });
      }
      lists.push(list);
    }
    saveAll();
    // round-robin across queries so one query's six bad hits cannot spend the whole budget
    const out = [];
    for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
    return out;
  };
  const saveAll = () => { for (const c of caches) saveCache(cacheDir, c.key, c.data); };

  const tryOne = async (cand) => {
    const rec = { url: cand.download_url, source: cand.source, source_url: cand.source_url, title: cand.title, license: cand.license, credit: cand.credit, query: queries[cand._q] };
    if (!cand.license) { entry.candidates.push({ ...rec, verdict: "REFUSED", seen: null, reason: "licence not on the allowlist (licenses.js)" }); return null; }
    if (tried >= MAX_CANDIDATES) return null;
    tried++;
    const cache = caches[cand._q].data;
    const raw = join(assetsDir, "raw", `${sha1(cand.download_url).slice(0, 16)}.jpg`);
    let v = cache.verdicts[cand.download_url];
    if (v && (!v.file || existsSync(v.file) || v.answer !== "YES")) {
      rec.cache = "hit";
    } else {
      try { if (!existsSync(raw)) await deps.download(cand.download_url, raw); }
      catch (e) { entry.candidates.push({ ...rec, verdict: "REJECTED", seen: null, reason: `download failed: ${String(e.message || e).slice(0, 160)}` }); return null; }
      const a = await deps.verify(raw, material.must_show);
      v = { answer: a.answer, seen: a.seen, provider: a.provider || null, file: raw };
      if (a.answer !== "UNAVAILABLE") { cache.verdicts[cand.download_url] = v; saveAll(); }
    }
    if (v.answer === "UNAVAILABLE") unavailable++;
    const cr = { ...rec, verdict: v.answer, seen: v.seen, provider: v.provider, cache: rec.cache || "miss" };
    entry.candidates.push(cr);
    deps.log(`${ctx.where} ${material.id} ${tried}/${MAX_CANDIDATES} ${cand.source} ${cand.title || cand.download_url} -> ${v.answer}: ${v.seen}`);
    if (v.answer !== "YES") return null;
    const dest = join(assetsDir, "materials", `${safe(material.id)}-${sha1(cand.download_url).slice(0, 8)}${material.kind === "object-cutout" ? ".png" : ".jpg"}`);
    mkdirSync(dirname(dest), { recursive: true });
    if (material.kind === "object-cutout") {
      const cut = await deps.cutout(v.file, dest);
      if (!cut?.ok) { cr.verdict = "REJECTED"; cr.reason = `YES, but cutout failed: ${cut?.reason || "no result"}`; deps.log(`${ctx.where} ${material.id} cutout failed: ${cr.reason}`); return null; }
    } else {
      copyFileSync(v.file, dest);
    }
    return { file: dest, cand, v };
  };

  let won = null;
  for (const tier of tiers) {
    if (won || tried >= MAX_CANDIDATES || !tier.length) break;
    for (const cand of await fetchTier(tier)) {
      if (seen.has(cand.download_url)) continue;
      seen.add(cand.download_url);
      won = await tryOne(cand);
      if (won || tried >= MAX_CANDIDATES) break;
    }
  }
  saveAll();
  if (won) {
    entry.status = "verified";
    entry.chosen = { file: won.file, url: won.cand.download_url, source_url: won.cand.source_url, license: won.cand.license, credit: won.cand.credit, verdict: won.v.seen };
    return { entry, resolved: { status: "verified", file: won.file, source_url: won.cand.source_url, license: won.cand.license, credit: won.cand.credit, verdict: `YES: ${won.v.seen}` } };
  }
  const allUnavailable = tried > 0 && unavailable === tried;
  entry.status = allUnavailable ? "unverified" : "missing";
  entry.why_missing = !queries.length ? "no search queries"
    : allUnavailable ? `no vision provider answered for ${tried} candidate(s); nothing is used unverified`
    : tried === 0 ? `no licensed candidate found for ${queries.length} quer${queries.length === 1 ? "y" : "ies"}`
    : `${tried} candidate(s) checked, none shows "${material.must_show}" (${entry.candidates.filter((c) => c.verdict === "PARTLY").length} PARTLY, ${entry.candidates.filter((c) => c.verdict === "NO").length} NO)`;
  return { entry, resolved: { status: entry.status, file: null, source_url: null, license: null, credit: null, verdict: entry.why_missing } };
}

/**
 * resolveDirection(direction, { assetsDir, research, deps }) -> { direction, report }
 * Pure apart from what `deps` and the assets dir do; tests inject search / download / verify / cutout.
 */
export async function resolveDirection(direction, { assetsDir, research = null, researchPath = null, deps = {} } = {}) {
  if (!assetsDir) throw new Error("assetsDir is required");
  const needDefaults = ["sourceOrder", "search", "download", "verify", "cutout"].some((k) => typeof deps[k] !== "function");
  const d = { ...(needDefaults ? await defaultDeps() : {}), ...deps };
  if (!d.log) d.log = () => {};
  const out = structuredClone(direction);
  const memo = new Map();
  const materials = [], beats = [];
  for (const beat of out.beats || []) {
    const missing = [];
    for (const shot of beat.shots || []) {
      for (const m of shot.materials || []) {
        const where = `b${beat.beat_index}/${shot.id}`;
        const key = JSON.stringify([m.kind, m.must_show, m.search, m.kind === "data" ? m.data : null]);
        let r = memo.get(key);
        if (!r) {
          if (m.kind === "data") {
            const v = validateData(m, research);
            r = { resolved: { status: v.status, file: null, source_url: v.source_url, license: null, credit: null, verdict: v.verdict },
              entry: { queries: [], candidates: [], checked: v.checked, chosen: v.status === "verified" ? { source_url: v.source_url } : null, status: v.status,
                why_missing: v.status === "verified" ? null : v.verdict, research: researchPath } };
            d.log(`${where} ${m.id} data -> ${v.status}: ${v.verdict}`);
          } else {
            r = await resolveImage(m, { deps: d, assetsDir, where });
          }
          memo.set(key, r);
        } else r = { ...r, entry: { ...r.entry, reused_from_same_material: true } };
        m.resolved = { ...r.resolved };
        materials.push({ beat_index: beat.beat_index, shot_id: shot.id, material_id: m.id, kind: m.kind, must_show: m.must_show, ...r.entry });
        if (r.resolved.status !== "verified") missing.push({ shot_id: shot.id, material_id: m.id, must_show: m.must_show, status: r.resolved.status, why: r.resolved.verdict });
      }
    }
    beats.push({ beat_index: beat.beat_index, sentence: beat.sentence, ok: missing.length === 0, essential_missing: missing });
  }
  const count = (s) => materials.filter((m) => m.status === s).length;
  const report = {
    schema_version: 1,
    channel_id: out.channel_id,
    script: out.script,
    assets_dir: assetsDir,
    research: researchPath,
    max_candidates_per_material: MAX_CANDIDATES,
    summary: { materials: materials.length, verified: count("verified"), missing: count("missing"), unverified: count("unverified"),
      beats_with_essential_missing: beats.filter((b) => !b.ok).map((b) => b.beat_index) },
    beats,
    materials,
  };
  return { direction: out, report };
}

function arg(argv, name) { const i = argv.indexOf(`--${name}`); return i > -1 ? argv[i + 1] : null; }

async function main(argv = process.argv.slice(2)) {
  const dirPath = arg(argv, "direction"), outPath = arg(argv, "out"), assetsDir = arg(argv, "assets-dir"), reportPath = arg(argv, "report");
  if (!dirPath || !outPath || !assetsDir || !reportPath) {
    console.error("usage: resolve.mjs --direction <direction.json> --out <direction.resolved.json> --assets-dir <dir> --report <materials-report.json> [--research <research.json>]");
    return 2;
  }
  try { (await import("dotenv")).config(); } catch { /* CI passes secrets as env */ }
  const direction = JSON.parse(readFileSync(dirPath, "utf8"));
  const researchPath = arg(argv, "research") || researchPathFor(direction.script);
  let research = null;
  if (researchPath && existsSync(researchPath)) research = JSON.parse(readFileSync(researchPath, "utf8"));
  else if (researchPath) console.warn(`[materials] research ${researchPath} not found: every kind:data material will be missing`);
  const { direction: resolved, report } = await resolveDirection(direction, { assetsDir, research, researchPath: research ? researchPath : null });
  // the output must still be a valid direction (resolved has additionalProperties:false in the schema)
  const Ajv = (await import("ajv")).default;
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "schemas", "scene-direction.json");
  const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: false });
  const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
  const valid = validate(resolved);
  report.output_schema_valid = valid;
  if (!valid) report.output_schema_errors = validate.errors.slice(0, 20);
  mkdirSync(dirname(resolvePath(outPath)), { recursive: true });
  mkdirSync(dirname(resolvePath(reportPath)), { recursive: true });
  writeFileSync(outPath, JSON.stringify(resolved, null, 2) + "\n");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  const s = report.summary;
  console.log(`[materials] ${s.materials} material(s): ${s.verified} verified, ${s.missing} missing, ${s.unverified} unverified; beats with essential material missing: ${s.beats_with_essential_missing.join(", ") || "none"}`);
  for (const b of report.beats) for (const m of b.essential_missing) console.log(`[materials] ESSENTIAL MISSING beat ${b.beat_index} ${m.shot_id}/${m.material_id} "${m.must_show}": ${m.why}`);
  if (!valid) { console.error(`[materials] resolved direction fails schemas/scene-direction.json: ${ajv.errorsText(validate.errors)}`); return 2; }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolvePath(process.argv[1])).href) {
  main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
}
export { main };
