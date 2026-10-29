// DISCOVERY VALIDATION HAS EXPLICIT SEMANTICS.
//
// Before: validate-discovery rejected every candidate -> the workflow logged ::error:: and wrote skip=true -> NOTHING read
// steps.discover.outputs.skip -> the Reserve topic step reserved the first non-duplicate of the unvalidated list anyway
// (runs 40712679484 / 40899483670, ch-1 and ch-48). The result was neither "advisory" nor "enforced"; it just looked like a gate.
//
// Now: DISCOVERY_VALIDATION=advisory (default) forwards the candidates TAGGED and exits 0; =enforce exits 1 and the Reserve step
// reserves nothing; any other value is an error. These tests pin both outcomes and the Reserve guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, chmodSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { resolveValidationMode, applyPolicy, screenCandidates } from "../validate-discovery.js";

const require = createRequire(import.meta.url);
const SCRIPT = new URL("../validate-discovery.js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// Real ch-1 titles from data/publish-queue (videos that WERE produced) - none contains a measurable keyword.
const HISTORY = [
  { topic: "Stolen Portchester Castle Plaque Exposes Forgotten African-Caribbean Prisoners", slug: "a", angle: "" },
  { topic: "A New Discovery of Cuneiform Tablets Offers a Glimpse Into Hittite Empire Life", slug: "b", angle: "" },
  { topic: "The Newly Unveiled Archive of The Snowman Creator Raymond Briggs", slug: "c", angle: "" },
];

test("mode: unset/empty is advisory, enforce is enforce (case/space tolerant), anything else is an ERROR", () => {
  assert.equal(resolveValidationMode({}), "advisory");
  assert.equal(resolveValidationMode({ DISCOVERY_VALIDATION: "" }), "advisory");
  assert.equal(resolveValidationMode({ DISCOVERY_VALIDATION: " Enforce " }), "enforce");
  assert.equal(resolveValidationMode({ DISCOVERY_VALIDATION: "advisory" }), "advisory");
  assert.throws(() => resolveValidationMode({ DISCOVERY_VALIDATION: "enforced" }), /not one of/);
  assert.throws(() => resolveValidationMode({ DISCOVERY_VALIDATION: "off" }), /not one of/);
});

const rejectAll = HISTORY.map((t) => ({ ...t, reject_reason: "topic title lacks measurable keyword" }));

test("advisory: no candidate passes -> ALL kept in ranked order, tagged advisory_fail, exit 0", () => {
  const r = applyPolicy({ topics: HISTORY }, { chosen: null, rejected: rejectAll }, "advisory");
  assert.equal(r.outcome, "advisory");
  assert.equal(r.exitCode, 0);
  assert.deepEqual(r.doc.topics.map((t) => t.slug), ["a", "b", "c"]);
  for (const t of r.doc.topics) {
    assert.equal(t.validation.status, "advisory_fail");
    assert.match(t.validation.reason, /measurable keyword/);
  }
  assert.equal(r.doc.validation.outcome, "advisory");
});

test("enforce: no candidate passes -> outcome rejected, exit 1, document untouched (nothing to reserve)", () => {
  const doc = { topics: HISTORY };
  const r = applyPolicy(doc, { chosen: null, rejected: rejectAll }, "enforce");
  assert.equal(r.outcome, "rejected");
  assert.equal(r.exitCode, 1);
  assert.equal(r.doc, doc);
  assert.equal(r.doc.validation, undefined);
});

test("a passing candidate wins in BOTH modes, alone, and is not tagged as failing", () => {
  for (const mode of ["advisory", "enforce"]) {
    const r = applyPolicy({ topics: HISTORY }, { chosen: HISTORY[1], rejected: [rejectAll[0]] }, mode);
    assert.equal(r.outcome, "passed");
    assert.equal(r.exitCode, 0);
    assert.deepEqual(r.doc.topics, [HISTORY[1]]);
    assert.equal(r.doc.validation.outcome, "passed");
  }
});

test("screenCandidates: first candidate to pass every check is chosen; later ones are not examined", async () => {
  const calls = [];
  const pass = { pass: true, domains: ["a.org", "b.org"], figures: 9, coverage: 1 };
  const checks = {
    keyword: async (t) => { calls.push(t.slug); return t.slug === "a" ? { pass: false, reason: "no keyword" } : { pass: true }; },
    domains: async () => pass, figures: async () => pass, visual: async () => pass,
  };
  const { chosen, rejected } = await screenCandidates(HISTORY, "1", checks, () => {});
  assert.equal(chosen.slug, "b");
  assert.deepEqual(rejected.map((r) => r.slug), ["a"]);
  assert.deepEqual(calls, ["a", "b"], "candidate c must not be checked once b passed");
});

test("screenCandidates: a failed hard check (one domain) rejects with its reason, not 'passed'", async () => {
  const checks = {
    keyword: async () => ({ pass: true }),
    domains: async () => ({ pass: false, domains: ["only.org"] }),
    figures: async () => { throw new Error("must not run after a failed domain check"); },
    visual: async () => { throw new Error("must not run"); },
  };
  const { chosen, rejected } = await screenCandidates([HISTORY[0]], "1", checks, () => {});
  assert.equal(chosen, null);
  assert.match(rejected[0].reject_reason, /only 1 independent domain/);
});

function cli(mode, topics) {
  const dir = mkdtempSync(join(tmpdir(), "vd-"));
  const file = join(dir, "topics.json");
  writeFileSync(file, JSON.stringify({ topics }));
  const env = { ...process.env };
  delete env.DISCOVERY_VALIDATION;
  if (mode !== undefined) env.DISCOVERY_VALIDATION = mode;
  const r = spawnSync(process.execPath, [SCRIPT, file, "1"], { encoding: "utf8", env });
  const after = JSON.parse(readFileSync(file, "utf8"));
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, out: r.stdout + r.stderr, after };
}

test("CLI, legitimate ch-1 history topics, default (advisory): exits 0, warns, forwards all three tagged", () => {
  const r = cli(undefined, HISTORY);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /::warning::discovery validation ADVISORY/);
  assert.equal(r.after.topics.length, 3);
  assert.equal(r.after.validation.outcome, "advisory");
  assert.ok(r.after.topics.every((t) => t.validation.status === "advisory_fail"));
});

test("CLI, same topics under enforce: exits 1 and leaves the file untouched", () => {
  const r = cli("enforce", HISTORY);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /CANDIDATES REJECTED.*channel will be skipped/);
  assert.equal(r.after.validation, undefined);
  assert.equal(r.after.topics.length, 3);
});

test("CLI, unrecognised mode: exits nonzero (never silently advisory)", () => {
  const r = cli("enforced", HISTORY);
  assert.notEqual(r.status, 0);
  assert.equal(r.after.validation, undefined);
});

// ---- the Reserve topic step must honour steps.discover.outputs.skip --------------------------------------------------------
const bashOk = spawnSync("bash", ["-c", "true"]).status === 0;
const yaml = require("js-yaml");
const wf = yaml.load(readFileSync(new URL("../../.github/workflows/daily-pipeline-v2.yml", import.meta.url), "utf8"));
const reserve = Object.values(wf.jobs).flatMap((j) => j.steps || []).find((s) => s.id === "reserve");

function runReserve(discoverSkip) {
  const dir = mkdtempSync(join(tmpdir(), "reserve-"));
  const bin = join(dir, "bin"); mkdirSync(bin);
  const log = join(dir, "calls.log");
  for (const cmd of ["git", "jq", "node", "seq", "sleep"]) {
    const p = join(bin, cmd);
    // jq prints "1" (a COUNT / topic / slug), seq prints a single index; everything succeeds and is recorded.
    writeFileSync(p, `#!/bin/bash\necho "${cmd} $*" >> "${log.replace(/\\/g, "/")}"\n` + (cmd === "jq" ? "echo 1\n" : cmd === "seq" ? "echo 0\n" : ""));
    chmodSync(p, 0o755);
  }
  const script = reserve.run
    .replace(/\$\{\{\s*matrix\.channel_id\s*\}\}/g, "1")
    .replace(/\$\{\{\s*steps\.discover\.outputs\.skip\s*\}\}/g, discoverSkip)
    .replace(/\$\{\{\s*github\.event\.inputs\.dry_run\s*\}\}/g, "")
    .replace(/\$\{\{[\s\S]*?\}\}/g, "main");
  const out = join(dir, "gh-output");
  writeFileSync(out, "");
  const r = spawnSync("bash", ["-c", script], { cwd: dir, encoding: "utf8", env: { ...process.env, PATH: `${bin.replace(/\\/g, "/")}:${process.env.PATH}`, GITHUB_OUTPUT: out.replace(/\\/g, "/") } });
  const calls = existsSync(log) ? readFileSync(log, "utf8") : "";
  const outputs = readFileSync(out, "utf8");
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, calls, outputs, stderr: r.stderr };
}

test("Reserve topic step exists and begins with the discovery-skip guard", { skip: reserve ? false : "reserve step not found" }, () => {
  assert.match(reserve.run.split("\n").slice(0, 8).join("\n"), /steps\.discover\.outputs\.skip/);
});

test("Reserve topic, discovery skip=true: publishes skip=true, exits 0, runs no git/jq/node (reserves nothing)", { skip: bashOk ? false : "bash is not available" }, () => {
  const r = runReserve("true");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.outputs, /skip=true/);
  assert.equal(r.calls, "", `nothing may run after a skip, got:\n${r.calls}`);
});

test("Reserve topic, no discovery skip: proceeds to reserve (reserve-topic-single is invoked) and publishes skip=false", { skip: bashOk ? false : "bash is not available" }, () => {
  const r = runReserve("");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.calls, /node scripts\/reserve-topic-single\.js/);
  assert.match(r.outputs, /skip=false/);
});
