// A policy decision must be distinguishable from a fault.
//   exit 0 = passed or advisory; exit 1 = every candidate rejected under DISCOVERY_VALIDATION=enforce (policy);
//   exit 2 = the validator itself failed (usage, bad mode, unreadable or empty input, a crash).
// Before this, 1 meant both, so the workflow could not tell a rejection from a crash. Both still skip the channel (fail closed),
// and neither may reach reservation; only the annotation differs (::warning:: for a rejection, ::error:: for a fault).
// No network: the process-level cases fail before any lookup, and the workflow snippet is run with a fake `node`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { applyPolicy, EXIT } from "../validate-discovery.js";

const SCRIPT = fileURLToPath(new URL("../validate-discovery.js", import.meta.url));
const yaml = createRequire(import.meta.url)("js-yaml");
const wf = yaml.load(readFileSync(new URL("../../.github/workflows/daily-pipeline-v2.yml", import.meta.url), "utf8"));

const run = (args, env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, DISCOVERY_VALIDATION: "", ...env } });
const withFile = (contents, fn) => {
  const dir = mkdtempSync(join(tmpdir(), "vd-"));
  const f = join(dir, "topics.json");
  if (contents !== null) writeFileSync(f, contents);
  try { return fn(f); } finally { rmSync(dir, { recursive: true, force: true }); }
};

test("the exit codes are named and distinct", () => {
  assert.deepEqual({ ...EXIT }, { OK: 0, REJECTED: 1, ERROR: 2 });
});

test("policy outcomes: passed and advisory exit 0, an enforced rejection exits 1", () => {
  const doc = { topics: [{ topic: "a" }] };
  assert.equal(applyPolicy(doc, { chosen: doc.topics[0], rejected: [] }, "enforce").exitCode, EXIT.OK);
  assert.equal(applyPolicy(doc, { chosen: null, rejected: [{ topic: "a", reject_reason: "x" }] }, "advisory").exitCode, EXIT.OK);
  assert.equal(applyPolicy(doc, { chosen: null, rejected: [{ topic: "a", reject_reason: "x" }] }, "enforce").exitCode, EXIT.REJECTED);
});

test("a validator FAULT exits 2, never 1: usage, unknown mode, unreadable file, empty topics, malformed JSON", () => {
  assert.equal(run([]).status, EXIT.ERROR, "no arguments");
  withFile(JSON.stringify({ topics: [{ topic: "t" }] }), (f) => {
    const r = run([f, "1"], { DISCOVERY_VALIDATION: "enfroce" });
    assert.equal(r.status, EXIT.ERROR, "a mistyped mode must not pick a policy");
    assert.match(r.stderr, /not one of advisory, enforce/);
  });
  withFile(null, (f) => assert.equal(run([f, "1"]).status, EXIT.ERROR, "file does not exist"));
  withFile(JSON.stringify({ topics: [] }), (f) => assert.equal(run([f, "1"]).status, EXIT.ERROR, "no topics"));
  withFile("{not json", (f) => assert.equal(run([f, "1"]).status, EXIT.ERROR, "malformed JSON"));
});

// ---- the workflow reacts differently to the two, and skips in both --------------------------------------------------------------
const discover = Object.values(wf.jobs).flatMap((j) => j.steps || []).find((s) => s.id === "discover");
const snippet = discover.run.match(/(RC=0\nnode scripts\/validate-discovery\.js[\s\S]*?\nfi)\n/)?.[1];

test("the discover step distinguishes a rejection (1) from a fault (anything else) and skips the channel in both", () => {
  assert.ok(snippet, "the validator call moved - revisit this test");
  assert.match(snippet, /\|\| RC=\$\?/);
  assert.match(snippet, /\[ "\$RC" -eq 1 \][\s\S]*::warning::[\s\S]*skip=true/);
  assert.match(snippet, /\[ "\$RC" -ne 0 \][\s\S]*::error::[\s\S]*skip=true/);
  assert.doesNotMatch(discover.run, /node scripts\/validate-discovery\.js[^\n]*\|\| \{/, "the old catch-all block is gone");
});

const bashOk = (() => { try { return spawnSync("bash", ["--version"], { encoding: "utf8" }).status === 0; } catch { return false; } })();
test("running the real snippet: exit 0 forwards, exit 1 warns+skips, exit 2/137 errors+skips", { skip: bashOk ? false : "bash is needed (present on the Linux CI runner)" }, () => {
  const play = (rc) => {
    const dir = mkdtempSync(join(tmpdir(), "vd-sh-"));
    try {
      const out = join(dir, "gh-output");
      writeFileSync(out, "");
      const sh = `set -e\nCH=7\nnode() { return ${rc}; }\n${snippet}\necho DONE`;
      const r = spawnSync("bash", ["-c", sh], { encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: out.replaceAll("\\", "/") } });
      return { status: r.status, stdout: r.stdout, skip: /skip=true/.test(readFileSync(out, "utf8")) };
    } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  const ok = play(0);
  assert.deepEqual([ok.status, ok.skip, /DONE/.test(ok.stdout)], [0, false, true], "exit 0: not skipped, the step carries on");
  const rejected = play(1);
  assert.deepEqual([rejected.status, rejected.skip], [0, true]);
  assert.match(rejected.stdout, /::warning::.*REJECTED every candidate/);
  assert.doesNotMatch(rejected.stdout, /::error::/);
  for (const rc of [2, 137]) {
    const fault = play(rc);
    assert.deepEqual([fault.status, fault.skip], [0, true], `exit ${rc} still skips the channel (fail closed)`);
    assert.match(fault.stdout, new RegExp(`::error::.*FAILED.*exit ${rc}`));
    assert.doesNotMatch(fault.stdout, /::warning::/);
  }
});
