// planner-token-budget.yml measures the planner prompt with an offline tokenizer. It must stay read-only, secret-free and
// manual, and it must never turn "could not measure" into a pass.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const text = readFileSync(new URL("../../.github/workflows/planner-token-budget.yml", import.meta.url), "utf8");
const code = text.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
const py = readFileSync(new URL("../count-tokens-local.py", import.meta.url), "utf8");
const measure = readFileSync(new URL("../measure-planner-prompt.mjs", import.meta.url), "utf8");

test("token-budget workflow: manual dispatch and pushes to the recovery branch only, contents: read only", () => {
  const on = code.match(/^on:\n((?:[ \t]+.*\n|\n)+)/m)?.[1] ?? "";
  assert.match(on, /^\s+workflow_dispatch:/m);
  const push = on.match(/^  push:\n((?:    .*\n)+)/m)?.[1] ?? "";
  assert.deepEqual(push.trim().split("\n").map((l) => l.trim()), ["branches:", "- recovery/production-readiness"], "push is limited to the recovery branch: inert on main");
  for (const t of ["pull_request", "pull_request_target", "schedule", "workflow_run", "repository_dispatch", "workflow_call"]) {
    assert.doesNotMatch(on, new RegExp(`^\\s+${t}:`, "m"), `${t} must not trigger it`);
  }
  const perms = code.match(/^permissions:\n((?:[ \t]+.*\n)+)/m)?.[1] ?? "";
  assert.deepEqual(perms.trim().split("\n").map((l) => l.trim()), ["contents: read"]);
  assert.doesNotMatch(code, /^\s{4,}permissions:/m);
});

test("token-budget workflow: no secret, token, model key, push or publish; both checkouts drop credentials", () => {
  assert.doesNotMatch(code, /secrets\.|GITHUB_TOKEN|github\.token/);
  // Case-sensitive, secret-style names only: the workflow legitimately names the file scripts/gemini-visual-plan.js (--module).
  assert.doesNotMatch(code, /(GEMINI|GOOGLE_GENERATIVE_AI|OPENROUTER|GROQ|CEREBRAS|OLLAMA|YOUTUBE)_|API_KEY|CLIENT_SECRET|REFRESH_TOKEN/);
  assert.doesNotMatch(code, /git\s+(push|commit|tag|add)\b|\bgh\s+|publish|youtube|queue|ledger|daily-pipeline|curl|wget/i);
  const checkouts = [...code.matchAll(/uses:\s*actions\/checkout@/g)].length;
  const dropped = [...code.matchAll(/persist-credentials:\s*false/g)].length;
  assert.equal(checkouts, 2);
  assert.equal(dropped, checkouts);
});

test("token-budget workflow runs only the two measurement scripts, which exist", () => {
  const scripts = [...code.matchAll(/(?:node|python) (scripts\/[\w./-]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(scripts)].sort(), ["scripts/count-tokens-local.py", "scripts/measure-planner-prompt.mjs"]);
  for (const s of scripts) readFileSync(new URL(`../../${s}`, import.meta.url));
});

test("token-budget workflow uploads only files under out/tokens", () => {
  const paths = code.match(/upload-artifact@[\s\S]*?path:\s*\|\n((?:\s+out\/.*\n)+)/)?.[1] ?? "";
  assert.ok(paths.trim().length > 0);
  for (const l of paths.trim().split("\n")) assert.match(l.trim(), /^out\/tokens\//);
});

test("the counter can never pass the 4,500 budget: unmeasured is 3, over is 1, within-text-only is 4 (blocked), and there is no exit 0", () => {
  assert.match(py, /return 3/);
  assert.match(py, /NOT MEASURED/);
  assert.match(py, /unmeasured/);
  assert.match(py, /return 1/);
  assert.match(py, /return 4/);
  assert.match(py, /NOT VERIFIED/);
  assert.doesNotMatch(py, /return 0\b/, "the budget applies to the complete request; a text-only count cannot pass it");
  assert.ok(py.indexOf("return 3") < py.indexOf("return 4"), "the blocked path comes after the unmeasured path");
});

test("the counter states that its number is text only, and the prompt writer touches no network or credential", () => {
  assert.match(py, /reference frames/i);
  assert.match(py, /text only|TEXT only/);
  assert.match(py, /COMPLETE request/);
  assert.doesNotMatch(measure, /fetch\(|https?:\/\/|process\.env|child_process|spawn|exec/);
  assert.doesNotMatch(py, /os\.environ|api_key|API_KEY|requests|urllib/);
});
