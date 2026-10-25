// The naming check's second look: a beat fails only if it fails on two different frames (scripts/lib/naming-looks.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isFail, settleNaming } from "../lib/naming-looks.mjs";

const pass = (i) => ({ beat_index: i, verdict: "PASS", names: [{ shown: "x", expected: "x", ok: true }] });
const fail = (i, shown = "95 million curos") => ({ beat_index: i, verdict: "FAIL", names: [{ shown, expected: "95 million euros", ok: false, problem: "spelling" }] });

test("a one-off misread is cleared by the second look", () => {
  const out = settleNaming([pass(0), fail(1)], new Map([[1, pass(1)]]));
  assert.equal(isFail(out[1]), false);
  assert.equal(out[1].cleared_by_second_look, true);
  assert.equal(out[1].first_look.names[0].shown, "95 million curos");
});

test("a real misspelling fails both looks and stays failed", () => {
  const out = settleNaming([fail(1, "Gemany")], new Map([[1, fail(1, "Gemany")]]));
  assert.equal(isFail(out[0]), true);
  assert.ok(out[0].second_look);
});

test("a PASS verdict that lists a failing name still counts as a failure", () => {
  assert.equal(isFail({ verdict: "PASS", names: [{ ok: false }] }), true);
});

test("passing beats are never touched; a missing second answer keeps the first verdict; no second look returns the input", () => {
  const v = [pass(0), fail(1)];
  assert.equal(settleNaming(v, new Map([[0, fail(0)]]))[0], v[0], "a passing beat stays as it was");
  assert.equal(settleNaming(v, new Map())[1], v[1], "no second answer: the first verdict stands");
  assert.equal(settleNaming(v, null), v);
});
