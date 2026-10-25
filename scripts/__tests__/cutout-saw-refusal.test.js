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

test("run 39169019904: a blank object is refused (a featureless white box held the screen 8 s); 'empty' concepts may be empty", () => {
  assert.match(sawRefusal("stack of blank white paper on a white background", "stack of papers"), /nothing a viewer can read/);
  assert.match(sawRefusal("a blank old book", "document"), /nothing a viewer can read/);
  assert.equal(sawRefusal("an empty brown leather wallet", "empty wallet"), null);
  assert.equal(sawRefusal("a printed contract with a signature line", "contract"), null);
});

test("owner 2026-10-18: a generic-person prop is not refused for showing a person", () => {
  assert.equal(sawRefusal("a man in overalls counting coins at a table", "worker counting coins"), null);
  assert.equal(sawRefusal("a woman in a police uniform", "police officer"), null);
  assert.match(sawRefusal("a man holding a gavel", "gavel"), /stranger or a costume/);
});
