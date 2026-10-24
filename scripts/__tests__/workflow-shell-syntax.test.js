// EVERY `run:` STEP IN THE DAILY PIPELINE MUST PARSE AS BASH.
//
// review-publish exited 2 on runs 39790127811 (2026-10-22) and 39961381904 (2026-10-23) with
//
//   line 64: unexpected EOF while looking for matching `"'
//
// The "Write the daily upload digest" step is `node -e '<js>'`: the JS sits inside SINGLE-quoted bash.
// Its note string said  "...see not_uploaded for each channel's reason."  and that one apostrophe
// closed the bash quote early. bash never ran node: it died at PARSE time, exit 2, and the digest
// (data/uploaded/<date>.json) was never written. The uploads themselves had already succeeded
// (the previous step), which is why this looked like an upload failure when it was not.
//
// This test runs `bash -n` (parse only, executes nothing) over every run: step, with ${{ }}
// expressions replaced by a placeholder, so the same class of mistake fails here instead of in prod.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const DIR = new URL("../../.github/workflows/", import.meta.url);

const bashOk = spawnSync("bash", ["-c", "true"]).status === 0;

function runSteps(file) {
  const doc = yaml.load(readFileSync(new URL(file, DIR), "utf8"));
  const out = [];
  for (const [jobName, job] of Object.entries(doc.jobs || {})) {
    for (const [i, step] of (job.steps || []).entries()) {
      if (typeof step.run === "string") out.push({ where: `${file} :: ${jobName} :: ${step.name || `step ${i}`}`, script: step.run, shell: step.shell });
    }
  }
  return out;
}

// The pipeline file is checked step by step so a failure names the step.
const pipeline = runSteps("daily-pipeline-v2.yml");

test("daily-pipeline-v2.yml has run steps to check", () => {
  assert.ok(pipeline.length > 20, `only ${pipeline.length} run steps found`);
});

for (const s of pipeline) {
  // pwsh/python/cmd steps are not bash.
  if (s.shell && !/^bash/.test(s.shell)) continue;
  test(`bash -n: ${s.where}`, { skip: bashOk ? false : "bash is not available" }, () => {
    const script = s.script.replace(/\$\{\{[\s\S]*?\}\}/g, "X");
    const r = spawnSync("bash", ["-n"], { input: script, encoding: "utf8" });
    assert.equal(r.status, 0, `bash cannot parse this step (exit ${r.status}):\n${r.stderr}`);
  });
}

test("the digest step's embedded JS holds no single quote (it is single-quoted bash)", () => {
  const step = pipeline.find((s) => /Write the daily upload digest/.test(s.where));
  assert.ok(step, "digest step not found");
  const m = step.script.match(/node -e '([\s\S]*)'\s*$/);
  assert.ok(m, "digest step is no longer a single `node -e '...'` block - revisit this test");
  assert.ok(!m[1].includes("'"), `a single quote inside node -e '...' ends the bash quote: ${(m[1].match(/.{0,30}'.{0,30}/) || [""])[0]}`);
});

test("the digest JS itself is valid JavaScript", () => {
  const step = pipeline.find((s) => /Write the daily upload digest/.test(s.where));
  const js = step.script.match(/node -e '([\s\S]*)'\s*$/)[1];
  assert.doesNotThrow(() => new Function(js));
});
