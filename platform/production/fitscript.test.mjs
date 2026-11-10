import test from "node:test";
import assert from "node:assert/strict";
import { compactScenes, fitScript } from "./fitscript.mjs";

const w = (n) => Array.from({ length: n }, () => "w").join(" ");
const slots = [
  { id: "a", scene: 0, variants: [w(20), w(10)] },
  { id: "b", scene: 1, variants: [w(28), w(12)] },
  { id: "c", scene: 2, optional: true, variants: [w(24)] },
  { id: "d", scene: 3, variants: [w(16)] },
];

test("a slower voice drops the optional line, a faster one keeps it", () => {
  const slow = fitScript({ slots, wpm: 80 }), fast = fitScript({ slots, wpm: 140 });
  assert.ok(!slow.kept.includes("c"));
  assert.ok(fast.kept.includes("c"));
});
test("the estimate lands inside the 35 to 40 second window when a configuration can", () => {
  const r = fitScript({ slots, wpm: 110 });
  assert.ok(r.inside_window, JSON.stringify(r));
  assert.ok(r.estimated_seconds >= 35 && r.estimated_seconds <= 39.2);
});
test("it never changes the speed and refuses an implausible pace", () => {
  assert.throws(() => fitScript({ slots, wpm: 10 }), /implausible/);
});
test("scenes the chosen sentences do not use are removed and the rest renumbered", () => {
  const sentences = [{ text: "x", scene: 0 }, { text: "y", scene: 1 }, { text: "z", scene: 3 }];
  const { scenes, sentences: s2 } = compactScenes({ scenes: ["s0", "s1", "s2", "s3"], sentences });
  assert.deepEqual(scenes, ["s0", "s1", "s3"]);
  assert.deepEqual(s2.map((s) => s.scene), [0, 1, 2]);
});
