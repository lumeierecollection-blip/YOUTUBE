// The daily digest must tell three different non-uploads apart (runs 40712679484 / 40899483670 reported all of them
// as "no OAuth credentials configured"):
//   - credentialed channel, no video passed QA  -> "no video passed QA this run"   (log written by the publish step)
//   - credentialed channel, upload itself failed -> "upload FAILED: <reason>"       (e.g. invalid_grant)
//   - channel without credentials               -> "no OAuth credentials configured" (publish step never ran: no log)
// This runs the REAL digest JS taken from the workflow, in a scratch cwd, against fake /tmp/publish-out-<ch>.log files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const yaml = createRequire(import.meta.url)("js-yaml");
const wf = yaml.load(readFileSync(new URL("../../.github/workflows/daily-pipeline-v2.yml", import.meta.url), "utf8"));
const step = wf.jobs["review-publish"].steps.find((s) => s.name === "Write the daily upload digest");
const js = step.run.match(/node -e '([\s\S]*)'\s*$/)[1];

// channel keys unlikely to collide with a real /tmp/publish-out-<n>.log
const QA = "9101", FAILED = "9102", NOCREDS = "9103";

function runDigest(logs) {
  mkdirSync("/tmp", { recursive: true });
  const paths = [];
  for (const [ch, text] of Object.entries(logs)) { const p = `/tmp/publish-out-${ch}.log`; writeFileSync(p, text); paths.push(p); }
  const cwd = mkdtempSync(join(tmpdir(), "digest-"));
  try {
    const r = spawnSync(process.execPath, ["-e", js], { cwd, encoding: "utf8", env: { ...process.env, TODAY: "2026-10-30", REVIEW_RUN: "1", REQUESTED: [QA, FAILED, NOCREDS].join(",") } });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(readFileSync(join(cwd, "data", "uploaded", "2026-10-30.json"), "utf8"));
  } finally {
    for (const p of paths) if (existsSync(p)) rmSync(p);
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("digest: QA failure, genuine upload failure and missing credentials are three different reasons", () => {
  const d = runDigest({
    [QA]: "No approved-review/ or approved/ renders found - run 1 has no approved-review videos\n",
    [FAILED]: "Uploading...\nERROR: invalid_grant: Token has been expired or revoked.\n",
  });
  assert.equal(d.not_uploaded[QA], "no video passed QA this run");
  assert.match(d.not_uploaded[FAILED], /^upload FAILED: invalid_grant/);
  assert.equal(d.not_uploaded[NOCREDS], "no OAuth credentials configured");
  assert.deepEqual(d.no_credentials, [NOCREDS], "only the channel with no log may be called credential-less");
  assert.deepEqual(d.uploads, [], "a log existing must never count as an upload");
});
