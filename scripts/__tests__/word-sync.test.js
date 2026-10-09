// Words pop on their spoken word (owner, 2026-10-09). wordPops maps a headline's words onto the narrator's timing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { wordPops } from "../../src/skills/remotion-render/visual/word-sync.js";

const spoken = [
  { text: "France", from: 3 }, { text: "and", from: 14 }, { text: "Germany", from: 22 }, { text: "signed", from: 40 },
  { text: "the", from: 52 }, { text: "treaty,", from: 58 }, { text: "in", from: 80 }, { text: "1963.", from: 88 },
];

test("each headline word lands on the frame it is spoken", () => {
  const at = wordPops(["France", "Germany", "treaty", "1963"], spoken, 150);
  assert.deepEqual(at, [3, 22, 58, 88]);
});

test("the first word is never later than frame 6 and the order never goes backwards", () => {
  const at = wordPops(["Signed", "treaty"], [{ text: "signed", from: 40 }, { text: "treaty", from: 58 }], 150);
  assert.ok(at[0] <= 6);
  assert.ok(at[1] >= at[0]);
});

test("words the narration does not match sit between their neighbours", () => {
  const at = wordPops(["France", "FRANCO-GERMAN", "treaty"], spoken, 150);
  assert.equal(at[0], 3);
  assert.equal(at[2], 58);
  assert.ok(at[1] > at[0] && at[1] <= at[2]);
});

test("too few matches or no timings -> null (the even stagger stays)", () => {
  assert.equal(wordPops(["alpha", "beta", "gamma"], spoken, 150), null);
  assert.equal(wordPops(["France"], null, 150), null);
  assert.equal(wordPops([], spoken, 150), null);
});

test("the last word lands before the beat ends", () => {
  const at = wordPops(["treaty", "1963"], spoken, 100);
  assert.ok(at[1] <= 100 - 24);
});
