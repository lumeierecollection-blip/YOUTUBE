// Verified against run 40958756262 (ch-48: 5 rejected attempts on the Cochrane topic, a swap, 3 on the IEA guide) and the workflow source:
// the attempt counter NOT resetting on a topic swap is the documented design, not a bug. One 8-attempt budget per channel per run; the
// strict-visual starvation re-pick (SCR-19) fires at attempt 3, once, so the replacement topic gets the 5 attempts that remain with a clean
// feedback slate. This pins that design and the correctness of the swap (new slug, new research, no stale re-ask counters) so a later edit
// cannot quietly change the retry budget or break the swap. It does not claim 3 attempts is enough; the run's gate codes are in logs that
// are not available here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const yaml = createRequire(import.meta.url)("js-yaml");
const wf = yaml.load(readFileSync(new URL("../../.github/workflows/daily-pipeline-v2.yml", import.meta.url), "utf8"));
const run = Object.values(wf.jobs).flatMap((j) => j.steps || []).find((s) => s.id === "script").run;
const strict = run.slice(run.indexOf("STRICT STARVATION -> ONE TOPIC RE-PICK"));

test("one 8-attempt budget and one re-pick per channel per run", () => {
  assert.match(run, /for ATTEMPT in 1 2 3 4 5 6 7 8; do/);
  assert.equal((run.match(/^\s*REPICKED=0$/gm) || []).length, 1, "REPICKED is initialised once, before the attempt loop");
  assert.match(run, /script gate still failing for \$SCRIPT_SLUG after 8 attempts/);
});

test("the strict-visual re-pick fires only at attempt 3, only once, only when SCR-17 STRICT is what failed", () => {
  assert.match(strict, /\[ "\$ATTEMPT" -eq 3 \] && \[ "\$REPICKED" -eq 0 \]/);
  assert.match(strict, /grep -q 'SCR-17 STRICT' \/tmp\/gate-out-\$FORMAT\.log/);
});

test("a swap moves the whole chain to the new topic: slug, research file, and the re-ask state", () => {
  assert.match(strict, /node scripts\/reserve-topic-single\.js "\$CH" "\$T" "\$S"/, "the replacement is reserved, never reused");
  assert.match(strict, /case " \$BURNED " in \*" \$S "\*\) continue ;; esac/, "a burned topic is never picked again");
  assert.match(strict, /key_facts \| length >= 3/, "no research, no swap");
  assert.match(strict, /jq '\.structured_output' \/tmp\/research-repick\.json > "data\/research\/\$CH\/\$NEXT\.json"/);
  assert.match(strict, /SLUG="\$NEXT"; SCRIPT_SLUG="\$\{SLUG\}-\$\{FORMAT\}"\s*\n\s*CLAIM_REASKED=0; SPEC_REASKED=0; SKIP_GEN=0; FEEDBACK=""\s*\n\s*REPICKED=1\s*\n\s*continue/);
  assert.match(strict, /research for the strict re-pick \$NEXT failed - continuing with the current topic/, "a failed swap keeps the current topic rather than inventing one");
});
