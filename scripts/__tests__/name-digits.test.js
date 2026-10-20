// A number glued to a letter is part of a name ("A24"), never a stated figure (board 38864901359 ch-49).
import { test } from "node:test";
import assert from "node:assert/strict";
import { quantitiesOf } from "../canvas-grounding.js";

test("A24 states no figure; 24 films does", () => {
  assert.deepEqual(quantitiesOf("A24 scheduled the theatrical release for October.").map((q) => q.value), []);
  assert.ok(quantitiesOf("The studio raised $24 million last year.").some((q) => q.value.includes("24")));
});

test("figures written as words are figures: eighteen parameters, forty-one patients", () => {
  const a = quantitiesOf("Frontiers published the study, but only eighteen parameters proved excellent.");
  assert.ok(a.some((q) => q.value === "18" && /parameters/.test(q.label || "")));
  const b = quantitiesOf("Forty-one older patients walked while twelve cameras tracked them.");
  assert.ok(b.some((q) => q.value === "41"));
  assert.ok(b.some((q) => q.value === "12"));
});

test("number words in idioms and magnitudes do not become figures", () => {
  assert.deepEqual(quantitiesOf("No one was hurt in two of the tests."), []);
  assert.deepEqual(quantitiesOf("The team tested one of the devices."), []);
  assert.deepEqual(quantitiesOf("It saved two million dollars."), []);
});
