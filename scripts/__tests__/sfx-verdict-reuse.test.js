import test from "node:test";
import assert from "node:assert/strict";
import { reusablePrior, JUDGE_VERSION } from "../sfx-cc0.mjs";

// The judge sends three audio calls per recording. A settled verdict for the SAME bytes is reused; anything else is judged again.
test("a settled verdict for the same bytes is reused with no call", () => {
  const prior = { sha256: "abc", judge_version: JUDGE_VERSION, verdict: "recorded" };
  assert.equal(reusablePrior(prior, "abc"), true);
  assert.equal(reusablePrior({ ...prior, verdict: "robotic" }, "abc"), true);
});

test("different bytes, an older judge, or an unjudged answer is judged again", () => {
  const prior = { sha256: "abc", judge_version: JUDGE_VERSION, verdict: "recorded" };
  assert.equal(reusablePrior(prior, "xyz"), false, "a changed file is a new question");
  assert.equal(reusablePrior({ ...prior, judge_version: JUDGE_VERSION - 1 }, "abc"), false, "an older judge is not trusted");
  assert.equal(reusablePrior({ ...prior, verdict: "unjudged" }, "abc"), false, "an unjudged file is asked again");
  assert.equal(reusablePrior(undefined, "abc"), false);
});
