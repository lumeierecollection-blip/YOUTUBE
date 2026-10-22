// Material resolver (scripts/visual-director/materials/). Deterministic: search / download / verify / cutout are
// injected, nothing touches the network or a model. The live clients are exercised only in CI's proof workflow.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDirection, cacheKey, researchPathFor, MAX_CANDIDATES } from "../visual-director/materials/resolve.mjs";
import { validateData, numericLeaves } from "../visual-director/materials/data.mjs";
import { normalizeAnswer, verifyPrompt } from "../visual-director/materials/verify.mjs";
import { sourceOrder } from "../visual-director/materials/sources.mjs";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "vd", "materials");
const direction = () => JSON.parse(readFileSync(join(FIX, "direction.json"), "utf8"));
const research = JSON.parse(readFileSync(join(FIX, "research.json"), "utf8"));
const tmp = () => mkdtempSync(join(tmpdir(), "vd-mat-"));

const cand = (id, extra = {}) => ({ source: "wikimedia", title: `File:${id}.jpg`, source_url: `https://commons.wikimedia.org/wiki/File:${id}.jpg`,
  download_url: `https://upload.wikimedia.org/${id}.jpg`, license: "PD", credit: `Artist ${id} via Wikimedia Commons`, description: "", ...extra });

/** Fake deps: `results[source][query]` -> candidates; `answers[url]` -> { answer, seen }. Counts every call. */
function fakeDeps({ results = {}, answers = {}, cutoutOk = true } = {}) {
  const calls = { search: [], download: [], verify: [], cutout: [] };
  return {
    calls,
    deps: {
      sourceOrder,
      search: async (source, q) => { calls.search.push(`${source}|${q}`); return (results[source] || {})[q] || []; },
      download: async (url, dest) => { calls.download.push(url); mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, `img:${url}`); return dest; },
      verify: async (file, mustShow) => {
        const url = readFileSync(file, "utf8").slice(4);
        calls.verify.push({ url, mustShow });
        return { provider: "fake", ...(answers[url] || { answer: "NO", seen: "something else" }) };
      },
      cutout: async (input, output) => { calls.cutout.push(input); if (cutoutOk) writeFileSync(output, "png"); return cutoutOk ? { ok: true } : { ok: false, reason: "alpha coverage 3%" }; },
    },
  };
}

test("the first YES is kept, with licence, credit and source url; earlier NO/PARTLY are logged with what they showed", async () => {
  const town = cand("Bayeux_town"), cathedral = cand("Bayeux_cathedral"), comet = cand("Tapestry_comet", { license: "CC-BY-4.0", credit: "Myrabella via Wikimedia Commons" }), later = cand("later");
  const { deps, calls } = fakeDeps({
    results: { wikimedia: { "Bayeux Tapestry Halley comet": [town, comet, later], "Bayeux Tapestry scene 32": [cathedral] } },
    answers: {
      [town.download_url]: { answer: "NO", seen: "a street in the town of Bayeux" },
      [cathedral.download_url]: { answer: "PARTLY", seen: "a different panel of the Bayeux Tapestry, no comet" },
      [comet.download_url]: { answer: "YES", seen: "embroidered comet above pointing men on the Bayeux Tapestry" },
    },
  });
  const dir = tmp();
  const { direction: out, report } = await resolveDirection(direction(), { assetsDir: dir, research, deps });
  const m = out.beats[0].shots[0].materials[0];
  assert.equal(m.resolved.status, "verified");
  assert.equal(m.resolved.source_url, comet.source_url);
  assert.equal(m.resolved.license, "CC-BY-4.0");
  assert.equal(m.resolved.credit, "Myrabella via Wikimedia Commons");
  assert.match(m.resolved.verdict, /^YES: embroidered comet/);
  assert.ok(existsSync(m.resolved.file));
  // round-robin: query 1 hit 1, query 2 hit 1, query 1 hit 2 (the YES) — then stop; `later` never downloaded
  assert.deepEqual(calls.download, [town.download_url, cathedral.download_url, comet.download_url]);
  assert.ok(calls.verify.every((v) => v.mustShow === "the Bayeux Tapestry panel with Halley's comet"), "asked about must_show, not the entity name");
  const e = report.materials.find((x) => x.material_id === "tapestry-comet");
  assert.deepEqual(e.candidates.map((c) => c.verdict), ["NO", "PARTLY", "YES"]);
  assert.equal(e.candidates[0].seen, "a street in the town of Bayeux");
  assert.equal(e.chosen.url, comet.download_url);
  // Commons had candidates, so archives / stock were never asked
  assert.ok(calls.search.every((s) => /^(wikimedia|wikipedia-lead)\|/.test(s)), calls.search.join(","));
  assert.equal(report.beats[0].ok, true);
});

test("all NO / PARTLY -> missing, file null, no substitution; the beat lists it as essential_missing", async () => {
  const cands = Array.from({ length: 9 }, (_, i) => cand(`generic_${i}`));
  const answers = Object.fromEntries(cands.map((c, i) => [c.download_url, { answer: i % 2 ? "PARTLY" : "NO", seen: i % 2 ? "a medieval embroidery, not the comet panel" : "a generic old chest" }]));
  const { deps, calls } = fakeDeps({ results: { wikimedia: { "Bayeux Tapestry Halley comet": cands } }, answers });
  const { direction: out, report } = await resolveDirection(direction(), { assetsDir: tmp(), research, deps });
  const m = out.beats[0].shots[0].materials[0];
  assert.equal(m.resolved.status, "missing");
  assert.equal(m.resolved.file, null);
  assert.equal(m.resolved.source_url, null);
  assert.equal(calls.download.length, MAX_CANDIDATES, "bounded at 6 candidates per material");
  assert.equal(calls.cutout.length, 0);
  assert.deepEqual(report.beats[0].essential_missing.map((x) => x.material_id), ["tapestry-comet"]);
  assert.deepEqual(report.summary.beats_with_essential_missing, [0]);
  assert.match(report.materials[0].why_missing, /6 candidate\(s\) checked, none shows/);
  // the budget was spent on Commons, so the archive tier was never needed
  assert.ok(!calls.search.some((s) => s.startsWith("met|")));
});

test("Commons too thin -> the archive tier is asked; an artwork-scan never reaches stock sites", async () => {
  const one = cand("one"), museum = cand("museum", { source: "met" });
  const { deps, calls } = fakeDeps({ results: { wikimedia: { "Bayeux Tapestry Halley comet": [one] }, met: { "Bayeux Tapestry scene 32": [museum] } },
    answers: { [museum.download_url]: { answer: "YES", seen: "the comet panel of the tapestry" } } });
  const { report } = await resolveDirection(direction(), { assetsDir: tmp(), research, deps });
  assert.equal(report.materials[0].status, "verified");
  assert.equal(report.materials[0].chosen.url, museum.download_url);
  assert.ok(!calls.search.some((s) => /^(pexels|pixabay|unsplash)\|/.test(s)));
});

test("a candidate without an allowed licence is refused before download and does not use the budget", async () => {
  const sa = cand("sa", { license: null }), ok = cand("ok");
  const { deps, calls } = fakeDeps({ results: { wikimedia: { "Bayeux Tapestry Halley comet": [sa, ok] } }, answers: { [ok.download_url]: { answer: "YES", seen: "the comet panel" } } });
  const { report } = await resolveDirection(direction(), { assetsDir: tmp(), research, deps });
  assert.deepEqual(calls.download, [ok.download_url]);
  assert.equal(report.materials[0].candidates[0].verdict, "REFUSED");
  assert.equal(report.materials[0].status, "verified");
});

test("cache: a rerun on the same assets dir re-searches, re-downloads and re-asks nothing", async () => {
  const dir = tmp();
  const no = cand("no"), yes = cand("yes");
  const first = fakeDeps({ results: { wikimedia: { "Bayeux Tapestry Halley comet": [no, yes] } }, answers: { [no.download_url]: { answer: "NO", seen: "a chest" }, [yes.download_url]: { answer: "YES", seen: "the comet panel" } } });
  await resolveDirection(direction(), { assetsDir: dir, research, deps: first.deps });
  assert.ok(existsSync(join(dir, ".cache", `${cacheKey("Bayeux Tapestry Halley comet", "the Bayeux Tapestry panel with Halley's comet")}.json`)));
  const second = fakeDeps({}); // empty search results: if anything were re-searched the material would go missing
  second.deps.download = async () => { throw new Error("must not download on a cache hit"); };
  const { direction: out, report } = await resolveDirection(direction(), { assetsDir: dir, research, deps: second.deps });
  assert.equal(second.calls.search.length, 0);
  assert.equal(second.calls.verify.length, 0);
  assert.equal(out.beats[0].shots[0].materials[0].resolved.status, "verified");
  assert.equal(report.materials[0].queries[0].cache, "hit");
  assert.deepEqual(report.materials[0].candidates.map((c) => [c.verdict, c.cache]), [["NO", "hit"], ["YES", "hit"]]);
});

test("cache key is (query, must_show): the same query for a different must_show is asked again", () => {
  assert.notEqual(cacheKey("Great Fire of London", "Pudding Lane in 1666"), cacheKey("Great Fire of London", "the Monument to the Great Fire"));
  assert.equal(cacheKey(" Great Fire ", "X Y"), cacheKey("great fire", "x y"));
});

test("UNAVAILABLE (no provider answered) is never accepted or cached, and is reported as unverified", async () => {
  const a = cand("a");
  const dir = tmp();
  const { deps } = fakeDeps({ results: { wikimedia: { "Bayeux Tapestry Halley comet": [a] } }, answers: { [a.download_url]: { answer: "UNAVAILABLE", seen: "no vision provider answered" } } });
  const { direction: out } = await resolveDirection(direction(), { assetsDir: dir, research, deps });
  const r = out.beats[0].shots[0].materials[0].resolved;
  assert.equal(r.status, "unverified");
  assert.equal(r.file, null);
  const cached = JSON.parse(readFileSync(join(dir, ".cache", `${cacheKey("Bayeux Tapestry Halley comet", "the Bayeux Tapestry panel with Halley's comet")}.json`), "utf8"));
  assert.deepEqual(cached.verdicts, {});
});

test("object-cutout: the YES photo goes through the cutout step; a failed cutout tries the next candidate", async () => {
  const d = direction();
  const m = d.beats[0].shots[0].materials[0];
  Object.assign(m, { id: "gavel", kind: "object-cutout", must_show: "a wooden judge's gavel", search: ["wooden gavel"] });
  const x = cand("x"), y = cand("y");
  const f = fakeDeps({ results: { wikimedia: { "wooden gavel": [x, y] } }, answers: { [x.download_url]: { answer: "YES", seen: "a gavel" }, [y.download_url]: { answer: "YES", seen: "a gavel on a block" } } });
  let n = 0;
  f.deps.cutout = async (input, output) => { n++; if (n === 1) return { ok: false, reason: "edge touches all four sides" }; writeFileSync(output, "png"); return { ok: true }; };
  const { direction: out, report } = await resolveDirection(d, { assetsDir: tmp(), research, deps: f.deps });
  const r = out.beats[0].shots[0].materials[0].resolved;
  assert.equal(r.status, "verified");
  assert.match(r.file, /gavel-[0-9a-f]{8}\.png$/);
  assert.equal(r.source_url, y.source_url);
  assert.match(report.materials[0].candidates[0].reason, /cutout failed: edge touches/);
});

test("data kind: values present in research with a source_url verify; nothing is downloaded", async () => {
  const { deps, calls } = fakeDeps({});
  const { direction: out } = await resolveDirection(direction(), { assetsDir: tmp(), research, deps });
  const r = out.beats[1].shots[0].materials[0].resolved;
  assert.equal(r.status, "verified");
  assert.equal(r.source_url, "https://example.org/bayeux");
  assert.equal(r.file, null);
  assert.ok(!calls.search.some((s) => s.includes("research numbers")));
});

test("data kind: an invented value, a wrong source_url, or no research -> missing", () => {
  const mk = (data) => ({ id: "d", kind: "data", data });
  assert.equal(validateData(mk({ values: [{ value: 13200, source_url: "https://example.org/bayeux" }] }), research).status, "missing");
  assert.equal(validateData(mk({ values: [{ value: 70, source_url: "https://elsewhere.example/x" }] }), research).status, "missing");
  assert.equal(validateData(mk({ values: [{ value: 70 }] }), null).status, "missing");
  assert.equal(validateData(mk({ label: "no numbers" }), research).status, "missing");
  // a number written in a key fact counts ("1066" in key_facts[0])
  assert.equal(validateData(mk({ year: 1066 }), research).status, "verified");
  assert.equal(validateData(mk({ points: [{ x: "1,066" }] }), research).status, "verified");
  assert.deepEqual(numericLeaves({ a: [1, { b: "2" }], source_url: "u" }).map((l) => [l.value, l.source_url]), [[1, "u"], [2, "u"]]);
});

test("the resolved direction keeps the schema: resolved carries only status/file/source_url/license/credit/verdict", async () => {
  const Ajv = (await import("ajv")).default;
  const schema = JSON.parse(readFileSync(join(FIX, "..", "..", "..", "..", "..", "schemas", "scene-direction.json"), "utf8"));
  const validate = new Ajv({ strict: false }).compile(schema);
  const { deps } = fakeDeps({});
  const { direction: out } = await resolveDirection(direction(), { assetsDir: tmp(), research, deps });
  assert.ok(validate(out), JSON.stringify(validate.errors));
});

test("verifier answer parsing and the literal question", () => {
  assert.deepEqual(normalizeAnswer({ answer: "partly", seen: "a tapestry panel without the comet" }), { answer: "PARTLY", seen: "a tapestry panel without the comet" });
  assert.equal(normalizeAnswer({ answer: "MAYBE", seen: "x" }), null);
  assert.equal(normalizeAnswer({ answer: "YES" }), null);
  assert.match(verifyPrompt("the Bayeux Tapestry panel with Halley's comet"), /^Does this image show: the Bayeux Tapestry panel with Halley's comet\? Answer YES\/NO\/PARTLY \+ one line of what it actually shows/);
});

test("research path is derived from the script path", () => {
  assert.equal(researchPathFor("data/research/1/bayeux-script.json"), "data/research/1/bayeux.json");
  assert.equal(researchPathFor("data/research/1/bayeux-shorts-script.json"), "data/research/1/bayeux.json");
  assert.equal(researchPathFor("data/research/1/bayeux.json"), null);
});

test("CLI: the exact flags write the resolved direction and the report (data-only direction: no network)", async () => {
  const { spawnSync } = await import("node:child_process");
  const d = direction();
  d.beats = [d.beats[1]];
  d.beats[0].beat_index = 0;
  const dir = tmp();
  const dirPath = join(dir, "direction.json");
  writeFileSync(dirPath, JSON.stringify(d));
  const cli = join(FIX, "..", "..", "..", "..", "visual-director", "materials", "resolve.mjs");
  const r = spawnSync(process.execPath, [cli, "--direction", dirPath, "--out", join(dir, "out", "direction.resolved.json"), "--assets-dir", join(dir, "assets"), "--report", join(dir, "out", "materials-report.json"), "--research", join(FIX, "research.json")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const out = JSON.parse(readFileSync(join(dir, "out", "direction.resolved.json"), "utf8"));
  const rep = JSON.parse(readFileSync(join(dir, "out", "materials-report.json"), "utf8"));
  assert.equal(out.beats[0].shots[0].materials[0].resolved.status, "verified");
  assert.equal(rep.output_schema_valid, true);
  assert.deepEqual(rep.summary.beats_with_essential_missing, []);
});
