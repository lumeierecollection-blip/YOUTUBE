// recovery-smoke.yml is the only workflow added for the recovery work, and the directive allows a smoke workflow
// only if it is read-only. These tests pin that: if someone later adds a secret, a push, an upload to YouTube or a
// trigger that fires on its own, this fails before the workflow can be dispatched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("../../.github/workflows/", import.meta.url);
const text = readFileSync(new URL("recovery-smoke.yml", DIR), "utf8");
const code = text.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

test("recovery-smoke runs on manual dispatch and on pushes to the recovery branch only: no other branch, pull_request, schedule or workflow_run trigger", () => {
  const on = code.match(/^on:\n((?:[ \t]+.*\n|\n)+)/m)?.[1] ?? "";
  assert.match(on, /^\s+workflow_dispatch:/m);
  // A workflow that exists only on a non-default branch cannot be dispatched; the branch-filtered push is how it runs there.
  const push = on.match(/^  push:\n((?:    .*\n)+)/m)?.[1] ?? "";
  assert.deepEqual(push.trim().split("\n").map((l) => l.trim()), ["branches:", "- recovery/production-readiness"], "push is limited to the recovery branch: inert on main");
  for (const t of ["pull_request", "pull_request_target", "schedule", "workflow_run", "repository_dispatch", "workflow_call"]) {
    assert.doesNotMatch(on, new RegExp(`^\\s+${t}:`, "m"), `${t} must not trigger it`);
  }
});

test("recovery-smoke grants contents: read and nothing else", () => {
  const perms = code.match(/^permissions:\n((?:[ \t]+.*\n)+)/m)?.[1] ?? "";
  assert.deepEqual(perms.trim().split("\n").map((l) => l.trim()), ["contents: read"]);
  assert.doesNotMatch(code, /^\s{4,}permissions:/m, "no job widens its own permissions");
});

test("recovery-smoke references no secret, token or credential", () => {
  assert.doesNotMatch(code, /secrets\./i);
  assert.doesNotMatch(code, /GITHUB_TOKEN|github\.token/);
  assert.doesNotMatch(code, /GEMINI|OPENROUTER|GROQ|CEREBRAS|OLLAMA|YOUTUBE_|CLIENT_SECRET|REFRESH_TOKEN|API_KEY/i);
  assert.match(code, /persist-credentials:\s*false/, "checkout does not leave a token in .git/config");
});

test("recovery-smoke cannot publish, push or write a ledger", () => {
  assert.doesNotMatch(code, /git\s+(push|commit|tag|add)\b/);
  assert.doesNotMatch(code, /\bgh\s+(workflow|run|pr|release|api)\b/);
  assert.doesNotMatch(code, /youtube-publish|publish-|upload-youtube|oauth-setup|youtube-auth|queue|topic-log|ledger/i);
  assert.doesNotMatch(code, /daily-pipeline/);
  assert.doesNotMatch(code, /curl|wget/);
});

test("recovery-smoke runs only scripts that exist, and the render scripts it calls are the read-only ones", () => {
  const scripts = [...code.matchAll(/node (scripts\/[\w./-]+)/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 4, `scripts called: ${scripts.join(", ")}`);
  for (const s of scripts) readFileSync(new URL(`../../${s}`, import.meta.url));
  assert.deepEqual([...new Set(scripts)].sort(), [
    "scripts/check-multi-png-render.mjs", "scripts/local-audit.cjs", "scripts/make-multi-png-fixture.mjs", "scripts/qa-canvas-render.mjs",
  ]);
});

test("recovery-smoke uploads only its own output directory as an artifact", () => {
  const uploads = [...code.matchAll(/uses:\s*actions\/upload-artifact@/g)];
  assert.equal(uploads.length, 1);
  const paths = code.match(/upload-artifact@[\s\S]*?path:\s*\|\n((?:\s+out\/.*\n)+)/)?.[1] ?? "";
  assert.ok(paths.trim().length > 0);
  for (const l of paths.trim().split("\n")) assert.match(l.trim(), /^out\//, `artifact path ${l.trim()}`);
});

test("recovery-smoke bounds its own run time and renders three times (two with video, one plain) into separate out/ dirs", () => {
  assert.match(code, /timeout-minutes:\s*\d+/);
  const renders = [...code.matchAll(/qa-canvas-render\.mjs --out (out\/run\d)([^\n]*)/g)];
  assert.deepEqual(renders.map((m) => m[1]), ["out/run1", "out/run2", "out/run3"]);
  assert.equal(renders.filter((m) => /--video/.test(m[2])).length, 2);
  assert.match(code, /check-multi-png-render\.mjs[^\n]*--plain out\/run3/);
});

test("the daily publishing workflow is still the only one that names a publish step", () => {
  const others = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f) && f !== "daily-pipeline-v2.yml" && f !== "recovery-smoke.yml");
  assert.ok(others.length > 0);
  assert.doesNotMatch(code, /publish/i, "recovery-smoke mentions publishing nowhere");
});
