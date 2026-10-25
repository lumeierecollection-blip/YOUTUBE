// THE HERO FIGURE MUST HONOUR A TOTAL THE BEAT ASSERTS.
//
// Board 38325399088 ch-6 beat 3 — the challenger rejected the plan twice:
//
//   "The visual displays the number 17, but the sentence specifies a total of
//    34 people (17 researchers plus 17 crew members)."
//
// The frame was a NUMBER-FULL showing 17. The deterministic gate PASSED it:
//
//   [entities] beat 3: number:17 -> OK by figure "17" (the figure)
//
// and on its own terms that was right — 17 is on the frame and 17 is in the
// sentence. The gap was that the beat ASSERTS a total the frame never shows: its
// own overlay reads "34 Total Personnel". entitiesOf() reads the SENTENCE, and
// 34 is not in the sentence — it is in the beat's stated figure. The check was
// reading the sentence and missing the claim the frame actually makes.
//
// So statedTotalOf() reads the canvas's own asserted figure. Nothing is
// loosened: this only ever ADDS a requirement, and only where a beat makes a
// claim the frame does not honour.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEntityCoverage, statedTotalOf } from "../entity-coverage.js";

// ch-6 beat 3, real sentence and real beat text_overlay.
const SENTENCE = "But this mission demands massive coordination, involving 17 researchers and 17 crew members.";
const OVERLAY = "34 Total Personnel";

const beat = (headline, value) => ({
  index: 3,
  sentence: SENTENCE,
  canvas: { composition: "NUMBER-FULL", headline, data: { value } },
});

test("a total named by the beat is read from the beat, not just the sentence", () => {
  const t = statedTotalOf({ headline: OVERLAY, data: { value: "17" } }, SENTENCE);
  assert.ok(t, "the beat's asserted total was not found");
  assert.equal(t.total, "34");
});

test("ch-6 beat 3 FAILS while the hero shows only a component", () => {
  const r = checkEntityCoverage([beat(OVERLAY, "17")]);
  assert.equal(r.failures.length, 1, `expected the beat to fail, got ${JSON.stringify(r.rows)}`);
  assert.match(r.failures[0].why, /total of 34/);
});

test("both parts on the frame passes — two ends of an arithmetic relation", () => {
  const r = checkEntityCoverage([{
    index: 3,
    sentence: SENTENCE,
    canvas: { composition: "DATA-FULL", visual_type: "BAR", headline: OVERLAY, data: { values: ["17 researchers", "17 crew"] } },
  }]);
  assert.deepEqual(r.failures, [], `17 and 17 together are the total, shown honestly: ${JSON.stringify(r.failures)}`);
});

test("the total ON the frame, with its parts named, passes", () => {
  const r = checkEntityCoverage([{
    index: 3,
    sentence: SENTENCE,
    canvas: { composition: "DATA-FULL", visual_type: "BAR", headline: "34 Total Personnel", data: { values: ["34", "17", "17"] } },
  }]);
  assert.deepEqual(r.failures, [], `the total drawn with its parts: ${JSON.stringify(r.failures)}`);
});

test("a beat with no total is untouched", () => {
  // Not this rule's: a lone figure asserts nothing to be summed.
  const r = checkEntityCoverage([{
    index: 1,
    sentence: "The film took $5.5 million at the box office.",
    canvas: { composition: "NUMBER-FULL", headline: "$5.5 Million", data: { value: "$5.5 million" } },
  }]);
  assert.deepEqual(r.failures, [], `a single figure must not be invented a total: ${JSON.stringify(r.failures)}`);
});

test("an ordinary figure beat is untouched — no total, no new failure", () => {
  const r = checkEntityCoverage([{
    index: 0,
    sentence: "Box office reached $5.5 million.",
    canvas: { composition: "NUMBER-FULL", headline: "$5.5 Million", data: { value: "$5.5 million" } },
  }]);
  assert.deepEqual(r.failures, []);
});