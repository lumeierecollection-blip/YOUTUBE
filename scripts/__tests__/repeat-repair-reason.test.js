// Run 40958756262 ch-2: the script was skipped with "the script repeats a sentence that deleting cannot fix". That message was all the run
// said, but the skip fires when EITHER the attempt cap is reached OR scripts/repair-sentences.mjs exits non-zero (Gemini unavailable, an
// unusable answer, a CUT refused on a beat's only sentence...). The repair's own output was discarded, so the cause could not be told from
// the annotations. The workflow now keeps and prints the reason.
//
// This pins ONLY the observability change. The strictness is pinned here too so it cannot be traded away: the final check is still
// --strict, the skip still happens, the attempt cap is unchanged, and nothing is whitelisted. It does not claim the repair is fixed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const yaml = createRequire(import.meta.url)("js-yaml");
const wf = yaml.load(readFileSync(new URL("../../.github/workflows/daily-pipeline-v2.yml", import.meta.url), "utf8"));
const writeScript = Object.values(wf.jobs).flatMap((j) => j.steps || []).find((s) => s.id === "script");
const run = writeScript.run;
const block = run.slice(run.indexOf('node scripts/dedupe-sentences.js "data/research/$CH/${SCRIPT_SLUG}-script.json" --strict'));

test("the final repeat check is still strict and a repeat that cannot be repaired still skips the channel", () => {
  assert.ok(block.length > 0, "the strict dedupe call moved - revisit this test");
  assert.match(block, /--strict > \/tmp\/dedupe-final-\$FORMAT\.log/);
  assert.match(block, /if \[ "\$DD_EXIT" -eq 3 \]; then/);
  assert.match(block, /\[ "\$ATTEMPT" -lt 8 \] && node scripts\/repair-sentences\.mjs/, "the attempt cap is unchanged");
  assert.match(block, /echo "skip=true" >> "\$GITHUB_OUTPUT"\s*\n\s*echo "skip_reason=repeats" >> "\$GITHUB_OUTPUT"\s*\n\s*exit 0/, "the skip is unchanged");
});

test("the repair's own output is kept, printed, and its last lines go into a warning, in both the success and the failure path", () => {
  assert.match(block, /repair-sentences\.mjs [^\n]*> \/tmp\/repair-out-\$FORMAT\.log 2>&1; then\s*\n\s*cat \/tmp\/repair-out-\$FORMAT\.log/, "printed on success");
  assert.match(block, /fi\s*\n[^\n]*\n[^\n]*\n\s*cat \/tmp\/repair-out-\$FORMAT\.log/, "printed on failure");
  assert.match(block, /REPAIR_WHY=/);
  assert.match(block, /no repair attempted: attempt \$ATTEMPT of 8/);
  assert.match(block, /::warning::\[script\] ch-\$CH: sentence repair did not fix the repeat \(\$\{REPAIR_WHY:-no output from the repair\}\)/);
});

test("nothing was added that would let a repeat through: no whitelist, no raised cap, no skip removed", () => {
  assert.doesNotMatch(block.slice(0, 2500), /\|\| true\s*\n\s*(SKIP_GEN=1|continue)/);
  assert.doesNotMatch(run, /ATTEMPT" -lt (9|1\d)/);
  assert.equal((run.match(/skip_reason=repeats/g) || []).length, 1);
});
