// A number glued to a letter is part of a name ("A24"), never a stated figure (board 38864901359 ch-49).
import { test } from "node:test";
import assert from "node:assert/strict";
import { quantitiesOf } from "../canvas-grounding.js";

test("A24 states no figure; 24 films does", () => {
  assert.deepEqual(quantitiesOf("A24 scheduled the theatrical release for October.").map((q) => q.value), []);
  assert.ok(quantitiesOf("The studio raised $24 million last year.").some((q) => q.value.includes("24")));
});
