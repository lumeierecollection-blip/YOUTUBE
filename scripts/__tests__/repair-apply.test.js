// The sentence repair may CUT a sentence the research cannot support instead of inventing one (boards 38044082797 ch 6 / ch 44).
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRepairs } from "../lib/repair-apply.mjs";

const rows = () => [
  { n: 1, si: 0, beat: "hook", text: "A prosecutor was shot at home." },
  { n: 2, si: 1, beat: "setup", text: "Investigators tracked clues for 25 years." },
  { n: 3, si: 1, beat: "setup", text: "Justice demands answers." },
  { n: 4, si: 2, beat: "close", text: "Call the FBI tip line." },
];

test("a replacement replaces only the sentence named", () => {
  const r = applyRepairs(rows(), [{ n: 3, text: "The FBI says the case is active." }], new Set([3]));
  assert.deepEqual(r.rows.map((x) => x.text), ["A prosecutor was shot at home.", "Investigators tracked clues for 25 years.", "The FBI says the case is active.", "Call the FBI tip line."]);
  assert.equal(r.replaced.length, 1);
});

test("CUT removes the sentence when its beat keeps another", () => {
  const r = applyRepairs(rows(), [{ n: 3, text: "CUT" }], new Set([3]));
  assert.deepEqual(r.rows.map((x) => x.n), [1, 2, 4]);
  assert.equal(r.cut.length, 1);
});

test("CUT is refused for a beat's only sentence (the original stays)", () => {
  const r = applyRepairs(rows(), [{ n: 4, text: "CUT" }, { n: 1, text: "cut." }], new Set([1, 4]));
  assert.deepEqual(r.rows.map((x) => x.n), [1, 2, 3, 4]);
  assert.equal(r.refused.length, 2);
  assert.equal(r.cut.length, 0);
});

test("cutting both sentences of a two-sentence beat keeps the first one that was asked", () => {
  const r = applyRepairs(rows(), [{ n: 2, text: "CUT" }, { n: 3, text: "CUT" }], new Set([2, 3]));
  assert.deepEqual(r.rows.map((x) => x.n), [1, 3, 4]);
  assert.equal(r.refused.length, 1);
});

test("a sentence the checks did not flag cannot be touched, and sentence text that merely contains the word cut is a normal replacement", () => {
  const r = applyRepairs(rows(), [{ n: 1, text: "CUT" }, { n: 2, text: "Cut costs fell 12% in 2024." }], new Set([2]));
  assert.equal(r.rows.find((x) => x.n === 1).text, "A prosecutor was shot at home.");
  assert.equal(r.rows.find((x) => x.n === 2).text, "Cut costs fell 12% in 2024.");
});

test("nothing usable: no change", () => {
  const r = applyRepairs(rows(), [{ n: 9, text: "x" }, { n: 2, text: "" }], new Set([2]));
  assert.deepEqual(r.rows.map((x) => x.text), rows().map((x) => x.text));
  assert.equal(r.replaced.length + r.cut.length, 0);
});
