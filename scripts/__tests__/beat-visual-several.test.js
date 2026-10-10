import test from "node:test";
import assert from "node:assert/strict";
import { buildBeatVisualPrompt, SEVERAL_ENTITIES_NOTE, BEAT_VISUAL_PROMPT } from "../beat-visual.js";

test("a beat naming several entities with a listed asset carries the several-entities note; a single-entity beat does not", () => {
  const assets = [{ id: "a.jpg", entity: "Matt Damon", entity_type: "person", kind: "person" }];
  const many = buildBeatVisualPrompt({ line: "Matt Damon and Jennifer Garner joined.", entities: [{ type: "person", name: "Matt Damon" }, { type: "person", name: "Jennifer Garner" }], assets });
  assert.ok(many.includes(SEVERAL_ENTITIES_NOTE));
  assert.ok(many.startsWith(BEAT_VISUAL_PROMPT), "the owner's prompt is untouched");
  const one = buildBeatVisualPrompt({ line: "Matt Damon joined.", entities: [{ type: "person", name: "Matt Damon" }], assets });
  assert.ok(!one.includes(SEVERAL_ENTITIES_NOTE));
});
