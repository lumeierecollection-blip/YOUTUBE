// STRICT PRE-SCREEN (scripts/strict-prescreen.mjs) - can this topic's RESEARCH ground enough frames?
//
// Runs 39790127811 and 39961381904 (ch-2, ch-48, both strict_visual): the SCR-17 STRICT script gate
// rejected all 8 attempts for the topics below, and the one re-pick was itself unscreened. The gate is
// deliberate and unchanged (strict-visual.test.js, gate-script tests); this pre-screen only asks, before
// the writer is called, whether the research states anything the gate's own groundedVisualFor can draw.
//
// Fixtures in fixtures/strict-prescreen/ are the real research facts/numbers (urls trimmed):
//   starved-*  the failed topics of run 39961381904 (openai-dots, mit-x-hinges, michigan-haptic)
//   passed-*   research of scripts that DID pass the strict gate and shipped (llm-api-price, minimax, wso2, state-farm)
//   writer-failed-flint  grounded research whose script still failed: the writer, not the topic. Known limit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { researchGroundability, stripMetadata, groundedHints, describe, STRICT_MIN_STRONG } from "../strict-prescreen.mjs";
import { groundedVisualFor, strictUngroundableSentences } from "../strict-visual.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (n) => JSON.parse(readFileSync(join(HERE, "fixtures", "strict-prescreen", `${n}.json`), "utf-8"));

test("the topics that burned 8 script attempts are rejected before the writer is called", () => {
  for (const n of ["starved-openai-dots", "starved-mit-x-hinges", "starved-michigan-haptic"]) {
    const r = researchGroundability(load(n));
    assert.equal(r.ok, false, `${n}: ${describe(r, n)}`);
    assert.ok(r.strong < STRICT_MIN_STRONG, `${n}: ${r.strong} strong`);
  }
});

test("research behind scripts that passed the strict gate is accepted (no false rejection)", () => {
  for (const n of ["passed-llm-api-price", "passed-minimax", "passed-wso2", "passed-state-farm"]) {
    const r = researchGroundability(load(n));
    assert.equal(r.ok, true, `${n}: ${describe(r, n)}`);
    assert.ok(r.strong >= STRICT_MIN_STRONG);
  }
});

test("grounded research whose writer failed is still accepted: the pre-screen blocks topics, not wording", () => {
  assert.equal(researchGroundability(load("writer-failed-flint")).ok, true);
});

test("michigan: a publication date and a university name are weak-only, not strong", () => {
  const r = researchGroundability(load("starved-michigan-haptic"));
  assert.ok(r.weak >= 1, "the gate itself would draw the date / place - that is exactly why the weak tier misleads");
  assert.equal(r.strong, 0);
});

test("stripMetadata removes publication dates and institution-embedded places, keeps the substance", () => {
  const t = stripMetadata("Published on October 1, 2026, the University of Michigan team tested 48 drivers.");
  assert.ok(!/October|University of Michigan/.test(t), t);
  assert.match(t, /48 drivers/);
});

test("a stated figure, a dated series, a list and a comparison each count as strong", () => {
  const research = {
    key_facts: [
      { fact: "The API now costs $3 per million input tokens." },
      { fact: "In 2019 the plant opened in Detroit, in 2022 it doubled, and in 2025 it closed." },
      { fact: "The three stages are sourcing, melting, and casting." },
      { fact: "Ford sold 12,000 trucks in 2023 versus 9,000 in 2022." },
    ],
    numbers: [],
  };
  const r = researchGroundability(research);
  assert.equal(r.ok, true, describe(r));
});

test("a research artifact with only 'who did what' facts is starved", () => {
  const research = {
    key_facts: [
      { fact: "Researchers analysed how developers talk about agents." },
      { fact: "The authors argue that workflow design matters." },
      { fact: "A journalist compared the two assistants and liked both." },
    ],
    numbers: [],
  };
  const r = researchGroundability(research);
  assert.equal(r.ok, false);
  assert.equal(r.strong, 0);
});

test("number entries that only restate the publication date add nothing", () => {
  const r = researchGroundability({
    key_facts: [{ fact: "The authors argue workflow design matters." }],
    numbers: [{ label: "Publication Day", value: 1, unit: "day" }, { label: "Publication Month", value: 10, unit: "month" }],
  });
  assert.equal(r.strong, 0);
});

test("a figure carried by a strong fact is not counted twice through numbers[]", () => {
  const r = researchGroundability({
    key_facts: [{ fact: "The API now costs $3 per million input tokens." }],
    numbers: [{ label: "Input price", value: 3, unit: "USD per million tokens" }],
  });
  assert.equal(r.strong, 1);
});

test("the pre-screen loosens nothing: the strict gate still rejects a sentence the research cannot ground", () => {
  const bad = ["Researchers analysed how developers talk about agents."];
  assert.equal(groundedVisualFor(bad[0]), null);
  assert.deepEqual(strictUngroundableSentences(bad), bad);
});

test("hints list only facts a frame can draw, for the rewrite feedback", () => {
  const hints = groundedHints(load("passed-llm-api-price"));
  assert.ok(hints.length >= 1 && hints.length <= 4);
  for (const h of hints) assert.ok(groundedVisualFor(h), `hint must itself be drawable: ${h}`);
  assert.deepEqual(groundedHints({ key_facts: [{ fact: "Researchers analysed how developers talk about agents." }] }), []);
});

test("an empty or missing research artifact is starved, not a crash", () => {
  assert.equal(researchGroundability({}).ok, false);
  assert.equal(researchGroundability(null).ok, false);
});

test("CLI: --is-strict follows config/channels.json; a non-strict channel is never screened", () => {
  const run = (...a) => spawnSync(process.execPath, [join(HERE, "..", "strict-prescreen.mjs"), ...a], { encoding: "utf-8" });
  assert.equal(run("--is-strict", "2").stdout.trim(), "true");
  assert.equal(run("--is-strict", "48").stdout.trim(), "true");
  assert.equal(run("--is-strict", "1").stdout.trim(), "false");
  const r = run("1", "any-slug");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /not a strict_visual channel/);
  assert.equal(run("1", "any-slug").stderr.includes("no research artifact"), false);
});

test("a bare publication date alone is weak, never strong (the gate would draw it, the story does not contain it)", () => {
  const r = researchGroundability({ key_facts: [{ fact: "The ruling took effect on March 3, 2025." }], numbers: [] });
  assert.equal(r.weak, 1);
  assert.equal(r.strong, 0);
});
