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

function runDigest(logs, queues = {}) {
  mkdirSync("/tmp", { recursive: true });
  const paths = [];
  for (const [ch, text] of Object.entries(logs)) { const p = `/tmp/publish-out-${ch}.log`; writeFileSync(p, text); paths.push(p); }
  const cwd = mkdtempSync(join(tmpdir(), "digest-"));
  for (const [ch, rows] of Object.entries(queues)) { mkdirSync(join(cwd, "data", "publish-queue", ch), { recursive: true }); writeFileSync(join(cwd, "data", "publish-queue", ch, "publish-queue.json"), JSON.stringify(rows)); }
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

// Case 4: a video that WAS uploaded privately. It must appear under `uploads` with its Studio link and private status, the
// channel must NOT also be reported as "not uploaded", and the "everything is PRIVATE" note must only appear when that is true.
test("digest: a successful private upload is listed with its Studio link; a run with no uploads never says 'private'", () => {
  const OK = "9101"; // same key as above, here with an upload today instead of a QA failure
  const entry = { video_id: "abcDEF12345", channel_id: OK, title: "A Title", uploaded_at: "2026-10-30T09:00:00.000Z", privacy_status: "private", cancelled: true, source_queue: "approved" };
  const d = runDigest({ [FAILED]: "ERROR: invalid_grant: Token has been expired or revoked.\n" }, { [OK]: [entry] });
  assert.equal(d.uploads.length, 1);
  assert.equal(d.uploads[0].video_id, "abcDEF12345");
  assert.equal(d.uploads[0].privacy_status, "private");
  assert.equal(d.uploads[0].studio_link, "https://studio.youtube.com/video/abcDEF12345/edit");
  assert.equal(d.not_uploaded[OK], undefined, "an uploaded channel must not also be listed as failed");
  assert.match(d.not_uploaded[FAILED], /^upload FAILED/, "a failure elsewhere stays visible next to a success");
  assert.match(d.note, /PRIVATE/);

  const none = runDigest({ [QA]: "No approved-review/ or approved/ renders found - run 1\n" });
  assert.deepEqual(none.uploads, []);
  assert.match(none.note, /Nothing was uploaded today/);
  assert.doesNotMatch(none.note, /PRIVATE/, "a failed day must never read as a successful private upload");
});
