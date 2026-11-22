// The daily run retries the channels that failed BEFORE upload, once, and a retry run never retries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const yaml = createRequire(import.meta.url)("js-yaml");
const text = readFileSync(new URL("../../.github/workflows/daily-pipeline-v2.yml", import.meta.url), "utf8").split("\r").join("");
const wf = yaml.load(text);
const job = wf.jobs["retry-failed"];

test("the retry job exists, needs the stages it judges, and cannot recurse", () => {
  assert.ok(job, "retry-failed job");
  assert.deepEqual([...job.needs].sort(), ["prep", "render", "setup"]);
  assert.match(job.if, /github\.event\.inputs\.is_retry != 'true'/);
  assert.match(job.if, /needs\.prep\.result == 'failure' \|\| needs\.render\.result == 'failure'/);
  assert.equal(wf.on.workflow_dispatch.inputs.is_retry.type, "boolean");
  assert.equal(job.permissions.actions, "write");
});

test("it re-dispatches only channels that failed before upload, with the run's own settings and is_retry=true", () => {
  const run = job.steps[0].run;
  assert.match(run, /select\(\.conclusion=="failure"\)/);
  assert.match(run, /Publish to YouTube \(private\)" and \.conclusion=="success"/, "an uploaded video is never retried");
  assert.match(run, /-f is_retry=true/);
  for (const flag of ["channels", "dry_run", "hold_public", "timeout_minutes"]) assert.match(run, new RegExp(`-f ${flag}=`));
});

test("the job-name filter picks exactly the channel ids of failed prep and render jobs", () => {
  const sh = job.steps[0].run.match(/sed -n '([^']+)'/)[1];
  const r = spawnSync("sed", ["-n", sh], { input: ["prep (3)", "render (48)", "render (3)", "setup", "preview", "prep (11)"].join("\n"), encoding: "utf8" });
  if (r.error) return; // no sed on this machine; CI has it
  assert.deepEqual(r.stdout.trim().split("\n").sort(), ["11", "3", "3", "48"]);
});
