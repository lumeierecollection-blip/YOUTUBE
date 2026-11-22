// node --test platform/longform/description.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildDescription } from "./assemble.mjs";

test("This Is History layout: hashtags first, summary paragraphs, sources, chapters", () => {
  const d = buildDescription({ style: "this-is-history", hashtags: ["#history", "#a", "#b"], summary: ["One.", "Two."], sources: ["https://x"], credits: "Maps: Natural Earth.", chapters: "0:00 A\n1:00 B\n2:00 C" });
  assert.ok(d.startsWith("#history #a #b\n\nOne.\n\nTwo."));
  assert.match(d, /Sources\n- https:\/\/x/);
  assert.match(d, /Chapters\n0:00 A/);
});

test("AI Search layout: one summary line ending in the hashtags", () => {
  assert.match(buildDescription({ style: "ai-search", hashtags: ["#ai", "#b", "#c"], summary: ["Claim."] }), /^Claim\. #ai #b #c/);
});

test("fewer than 3 hashtags or an unknown style is refused", () => {
  assert.throws(() => buildDescription({ style: "this-is-history", hashtags: ["#a"] }), /at least 3 hashtags/);
  assert.throws(() => buildDescription({ style: "nope", hashtags: ["#a", "#b", "#c"] }), /unknown description style/);
});
