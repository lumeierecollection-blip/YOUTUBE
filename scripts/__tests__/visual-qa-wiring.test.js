// Section-7 QA wiring. The gate used to be spawned by render-and-qa.js with no --plan and
// nobody read its exit code. Now: the gate refuses a missing or JSON plan (exit 2, no
// vacuous verdict), and the pipeline does not spawn a gate whose verdict it does not use.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const GATE = join(here, "..", "gate-visual-qa.js");
const run = (args) => spawnSync(process.execPath, [GATE, ...args], { encoding: "utf-8" });

test("no --plan: exit 2 with a reason, not a verdict", () => {
  const r = run(["--channel", "ch-01", "--video", "x.mp4"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--plan is required/);
});

test("a plan path that does not exist: exit 2", () => {
  const r = run(["--channel", "ch-01", "--video", "x.mp4", "--plan", join(tmpdir(), "no-such-plan.txt")]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no plan at/);
});

test("a JSON visual plan is refused, not parsed as empty text", () => {
  const dir = mkdtempSync(join(tmpdir(), "vqa-wiring-"));
  const p = join(dir, "plan.json");
  writeFileSync(p, JSON.stringify({ beats: [{ index: 0 }] }));
  const r = run(["--channel", "ch-01", "--video", "x.mp4", "--plan", p]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not a JSON visual plan/);
});

test("JSON content in a .txt file is refused too", () => {
  const dir = mkdtempSync(join(tmpdir(), "vqa-wiring-"));
  const p = join(dir, "plan.txt");
  writeFileSync(p, '  {"beats":[]}');
  const r = run(["--channel", "ch-01", "--video", "x.mp4", "--plan", p]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not a JSON visual plan/);
});

test("render-and-qa.js no longer spawns a section-7 gate whose verdict it ignores", () => {
  const src = readFileSync(join(here, "..", "render-and-qa.js"), "utf-8");
  assert.doesNotMatch(src, /VISUAL_QA_JS/);
  assert.doesNotMatch(src, /visionQaPromise/);
  assert.doesNotMatch(src, /"--channel", chId, "--video", outputPath\]/);
});
