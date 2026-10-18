import test from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
const { normalizer, judge, promptFor } = createRequire(import.meta.url)("../verify-image.cjs");

test("a prop photo with a second object is refused (board 39031532519 ch-1: a wallet with a magnifying glass)", () => {
  const v = normalizer(false)({ shows: "YES", kind: "LITERAL", quality: "CLEAN", alone: "OTHERS", others: "a magnifying glass", seen: "brown leather wallet with coins and a magnifying glass" });
  const j = judge(v, false);
  assert.equal(j.accept, false);
  assert.match(j.reason, /others=a magnifying glass/);
});

test("the subject alone passes; an answer without the question is not judged on it", () => {
  assert.equal(judge(normalizer(false)({ shows: "YES", kind: "LITERAL", quality: "CLEAN", alone: "ALONE", seen: "a black calculator" }), false).accept, true);
  assert.equal(judge(normalizer(false)({ shows: "YES", kind: "LITERAL", quality: "CLEAN", seen: "a gavel" }), false).accept, true);
});

test("the alone question is asked only for props", () => {
  assert.match(promptFor({ entity: "wallet", type: "object", alone: true }), /"alone": "ALONE" \| "OTHERS"/);
  assert.doesNotMatch(promptFor({ entity: "wallet", type: "object" }), /ALONE/);
  assert.match(promptFor({ entity: "coin", type: "object", money: true, alone: true }), /5\. Is the subject alone/);
});

test("asked whether the subject is alone and not answered: refused, not passed unjudged", () => {
  const v = normalizer(false)({ shows: "YES", kind: "LITERAL", quality: "CLEAN", seen: "a wallet" });
  const j = judge(v, false, false, true);
  assert.equal(j.accept, false);
  assert.match(j.reason, /alone=unanswered/);
  assert.equal(judge(normalizer(false)({ shows: "YES", kind: "LITERAL", quality: "CLEAN", alone: "ALONE", seen: "a wallet" }), false, false, true).accept, true);
});
