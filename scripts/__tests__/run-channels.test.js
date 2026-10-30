// config/run-channels.json = what the daily pipeline prepares and renders; config/priority-channels.json = what may be UPLOADED.
// Ten channels run; only the ones with working OAuth upload; the rest must run to the end without credentials.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { STYLE_NAMES } from "../editor/styles.mjs";

const require = createRequire(import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"));
const { resolveChannel } = require("../lib/channel-lookup.cjs");
const run = read("config/run-channels.json").channels.map(String);
const publish = read("config/priority-channels.json").channels.map(String);
const wf = readFileSync(new URL("../../.github/workflows/daily-pipeline-v2.yml", import.meta.url), "utf8").split("\r").join("");

test("every run channel resolves unambiguously and has an editor look from the five that exist", () => {
  assert.equal(new Set(run).size, run.length, "no duplicates");
  const looks = new Set();
  for (const id of run) {
    const c = resolveChannel(id);
    assert.ok(STYLE_NAMES[c.editor_look], `channel ${id} has editor_look ${c.editor_look}`);
    looks.add(c.editor_look);
  }
  assert.equal(looks.size, 5, "all five looks are in use across the run channels");
});

test("every channel that may upload also runs, and the others are not asked for credentials", () => {
  for (const id of publish) assert.ok(run.includes(id), `publish channel ${id} is a run channel`);
  assert.ok(run.length > publish.length);
  assert.match(wf, /const priority = JSON\.parse\(fs\.readFileSync\('config\/run-channels\.json'/, "the matrix is built from run-channels.json");
  const creds = wf.slice(wf.indexOf("id: creds"));
  assert.match(creds, /publishSet\.includes\(id\)[\s\S]{0,400}publish=false[\s\S]{0,60}process\.exit\(0\)/, "a non-publish channel exits 0 with publish=false");
  assert.match(wf, /name: Publish to YouTube \(private\)\n\s+if: steps\.creds\.outputs\.publish != 'false'/);
  assert.match(wf, /name: Process publish queue[\s\S]{0,300}steps\.creds\.outputs\.publish != 'false'/);
});

test("the review-publish job and the uploader still use only the publish list", () => {
  assert.match(wf, /CHANNELS=\$\(node -e "console\.log\(require\('\.\/config\/priority-channels\.json'\)/);
});
