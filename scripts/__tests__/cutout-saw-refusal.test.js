import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { sawRefusal } = createRequire(import.meta.url)("../fetch-cutout-once.cjs");

test("a hand or a costume in the photo refuses the prop (board 39031532519 ch-26)", () => {
  assert.match(sawRefusal("a hand holding a red marker pen", "pen"), /stranger or a costume/);
  assert.match(sawRefusal("bright green piggy bank wearing sunglasses", "piggy bank"), /stranger or a costume/);
});

test("a plain object, a clock face or small arms pass; a concept about a person is not judged", () => {
  assert.equal(sawRefusal("stacks of hundred dollar bills", "stack of cash"), null);
  assert.equal(sawRefusal("an alarm clock face on white", "alarm clock"), null);
  assert.equal(sawRefusal("a rack of small arms", "rifle"), null);
  assert.equal(sawRefusal("a hand-held radio", "radio"), null);
  assert.equal(sawRefusal("a pair of work gloves on hands", "work gloves on hands"), null);
});
