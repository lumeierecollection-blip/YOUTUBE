// A HEADLINE MAY NOT REWORD A FIGURE THE SENTENCE STATES.
//
// Board 38321106622 failed three channels on naming-check with ONE cause: the
// planner abbreviated a figure the sentence spells in full.
//
//   ch-49 beat 2: "$7m" should be "$7 million" — the frame drew the bars as
//          "$7 million" and "$8 million" (correct) under a headline reading
//          "$7m to $8m", so one frame said the same number two ways.
//   ch-10 beat 1: "15" should be "15th" — the figure unit was dropped.
//   ch-10 beat 0: "HUNDRED YEAR" for "Six hundred" — truncation, the same rule.
//
// The naming check reads the real frame and compares it to the real sentence,
// and it is RIGHT: an abbreviation is a different figure on screen than the one
// spoken. It is not loosened here. The fix is upstream, where the headline is
// written — by render time the abbreviation is laid out and nothing downstream
// compares it to the sentence.
//
// Equivalent spellings are NOT rewordings: "$7 million" is the sentence's own
// wording, "%" is "percent", "1,000" is "1000".
import { test } from "node:test";
import assert from "node:assert/strict";
import { rewordedFigures } from "../gemini-visual-plan.js";

test("the abbreviation that failed ch-49 is caught", () => {
  const bad = rewordedFigures("$7m to $8m projections", "Studio projections sat at $7 million to $8 million for domestic earnings.");
  assert.deepEqual(bad.map((b) => b.shown), ["$7m", "$8m"]);
  assert.deepEqual(bad.map((b) => b.expected), ["$7 million", "$8 million"]);
});

test("the sentence's own spelling passes", () => {
  assert.deepEqual(rewordedFigures("$7 million to $8 million", "Studio projections sat at $7 million to $8 million for domestic earnings."), []);
});

test("equivalent spellings are not rewordings", () => {
  assert.deepEqual(rewordedFigures("50 percent discount", "That is a 50 percent discount."), []);
  assert.deepEqual(rewordedFigures("50% discount", "That is a 50 percent discount."), []);
  assert.deepEqual(rewordedFigures("1,000 papers", "More than 1,000 corporate papers were filed."), []);
  assert.deepEqual(rewordedFigures("$5.5 million box office", "The film took $5.5 million."), []);
});

test("a figure the sentence does not state is another rule's business", () => {
  // Not this rule's: the headline introducing a number is a separate question
  // (beat-check / script fidelity), and flagging it here would report the wrong
  // defect and send the planner to the wrong fix.
  assert.deepEqual(rewordedFigures("A 300% surge", "Revenue rose sharply."), []);
});

test("a headline with no figure is clean", () => {
  assert.deepEqual(rewordedFigures("The measure passed", "Parliament approved the measure."), []);
  assert.deepEqual(rewordedFigures("", "$7 million was projected."), []);
});