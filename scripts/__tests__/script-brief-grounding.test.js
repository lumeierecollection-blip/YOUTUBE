// THE SCRIPT BRIEF WAS INSTRUCTING THE WRITER TO PRODUCE THE FAILURE.
//
// Board 38393719519: five of ten channels were stopped by three checks that all
// ask "does this text say what the sentence says". Causes 1 and 4 in FIXES.md are
// the same file, prompts/write-script.md, and this is the actual defect in it.
//
// CAUSE 1 — the close.
//
// The brief said:
//
//   "CLOSE ... What the viewer does with what they now know — a specific action"
//
// That is an instruction to emit an imperative addressed to the viewer. The writer
// obeyed, and produced:
//
//   ch-8, ch-26: "Apply these Harvard strategies to your next deal."
//
// which the claims gate correctly called INVENTED — the research reports what
// happened, not what the viewer should do about it. The brief was ordering the
// failure.
//
// CAUSE 1b — attribution, which was simply absent.
//
// There was no rule about attributing a VERB to a source. ch-1:
//
//   "...before the Gerald Financial Research Team suggests paying off debt."
//
// The research said that team noted repayment plans FAIL. Attributing a
// recommendation to a source that recorded the opposite is the most common way
// this pipeline loses a channel, and nothing in the brief warned about it.
//
// The claims gate (scripts/validate-script-claims.cjs) was right throughout and is
// NOT touched by this change. These tests pin the BRIEF, because the gate was
// never the broken part.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const BRIEF = readFileSync(new URL("../../prompts/write-script.md", import.meta.url), "utf8");

// ch-1's real rejected sentence, from data/ci-runs/blocked-claims-1.txt.
const CH1_SENTENCE = "Maintain a liquid savings buffer before the Gerald Financial Research Team suggests paying off debt.";
const CH1_RESEARCH = "repayment plans fail";

test("the close is no longer instructed to be an action", () => {
  assert.ok(
    !/What the viewer does with what they now know\s*—\s*a specific action/.test(BRIEF),
    "the brief still orders an actionable close",
  );
});

test("the brief states plainly that a close is never an instruction", () => {
  assert.ok(/A close is a FACT or\s*\n?\s*an ECHO — never an instruction/.test(BRIEF), "the fact-or-echo rule is missing");
});

test("the exact imperative that lost ch-8 and ch-26 is named as banned", () => {
  assert.ok(/Apply these strategies/.test(BRIEF), "the brief does not name the imperative it produced");
});

test("there is an attribution section", () => {
  assert.ok(/## ATTRIBUTION/.test(BRIEF), "the brief has no attribution rule at all");
});

test("the risky attribution verbs are named as needing a source", () => {
  for (const v of ["suggests", "recommends", "advises", "warns"]) {
    assert.ok(BRIEF.includes(v), `the brief never warns about "${v}"`);
  }
});

test("ch-1's real sentence is the one the rule is written against", () => {
  assert.ok(CH1_SENTENCE.includes("suggests paying off debt"), "fixture drifted from the real failure");
  assert.ok(CH1_RESEARCH.includes("fail"), "fixture drifted from the real research wording");
  assert.ok(
    BRIEF.includes("suggests paying off debt"),
    "the brief does not carry ch-1's real failure as its worked example",
  );
  assert.ok(BRIEF.includes("repayment plans fail"), "the brief does not carry what the research actually said");
});

test("the pre-return self-check sweeps attribution and imperative", () => {
  assert.ok(/ATTRIBUTION SWEEP/.test(BRIEF), "no attribution sweep before returning");
  assert.ok(/IMPERATIVE SWEEP/.test(BRIEF), "no imperative sweep before returning");
});

test("the claims gate is not weakened by this change", () => {
  // The gate caught every one of these correctly. It must stay as it is.
  const gate = readFileSync(new URL("../validate-script-claims.cjs", import.meta.url), "utf8");
  assert.ok(gate.length > 0, "the claims gate is missing");
  assert.ok(/INVENTED/.test(gate), "the gate no longer reports INVENTED claims");
});

test("the grounding rules that already worked are still there", () => {
  // Guards against this edit quietly gutting the brief to fix two rules.
  for (const keep of ["80-98 words", "No two consecutive sentences", "BANNED", "one idea per sentence"]) {
    assert.ok(BRIEF.toLowerCase().includes(keep.toLowerCase()), `the brief lost "${keep}"`);
  }
});