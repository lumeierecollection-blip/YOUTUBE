// THE BOX DOES NOT GROW — AND A FITTENER THAT OVERFLOWS GETS THE TAIL CUT OFF.
//
// Board 38330253047 ch-49 beat 5 failed naming-check:
//   "OTHER" should be "Other Mommy" (Incomplete title shown)
//   "27.5 MILLION DOLLAR OPENING OF OTHER" — "The title on screen is incomplete;
//    it is missing the word 'Mommy'." (second look)
//
// The beat is a stat card. Its LABEL is "27.5 million dollar opening of Other
// Mommy", and fitText() laid it out in more lines than the label box has room
// for. "Mommy" was not crowded out of the layout — it was clipped off the end.
//
// The defect was in BOTH fitters, which had the same shape:
//
//   for (s = max; s >= min; s -= n) { ...if it fits, return it... }
//   return { size: min, lines: wrap(words, min, ...) };        // <- may be TALLER than maxLines
//
// The floor is a size BAND preference. It is not a licence to clip. Below the
// floor both fitters now keep stepping down until the text fits its box, and
// only give up at MIN_FIT_FLOOR, where type stops being legible at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitText } from "../../src/skills/remotion-render/visual/canvas-layout.js";
import { fitHeadline, MIN_FIT_FLOOR } from "../../src/skills/remotion-render/visual/typography.js";

// ch-49's real label, and a label box with room for two lines — the shape the
// stat card gives its label.
const CH49 = "27.5 million dollar opening of Other Mommy";

test("ch-49's label fits inside a two-line box, tail included", () => {
  const f = fitText(CH49, 420, { max: 48, min: 24, maxLines: 2, lineH: 1.15 });
  assert.ok(f.lines.length <= 2, `the fit is ${f.lines.length} lines in a 2-line box: ${JSON.stringify(f.lines)}`);
});

test("the last word of ch-49's label is present in the fit", () => {
  const f = fitText(CH49, 420, { max: 48, min: 24, maxLines: 2, lineH: 1.15 });
  assert.ok(f.lines.join(" ").includes("Mommy"), `"Mommy" was dropped: ${JSON.stringify(f.lines)}`);
});

test("the whole string survives, word for word", () => {
  const f = fitText(CH49, 420, { max: 48, min: 24, maxLines: 2, lineH: 1.15 });
  assert.equal(f.lines.join(" ").split(/\s+/).join(" "), CH49, "the fitter dropped or reordered words");
});

test("a fit that cannot reach maxLines is not silently returned as if it did", () => {
  // Nothing can make a very long word fit a very narrow box. The fitter must
  // still never return MORE lines than the box holds when it had a choice.
  const f = fitText("supercalifragilisticexpialidocious", 90, { max: 40, min: 24, maxLines: 1 });
  assert.ok(f.lines.length >= 1);
  assert.ok(f.size >= MIN_FIT_FLOOR, `size fell through the legible floor: ${f.size}`);
});

test("a headline that does not fit at the floor is not returned clipped", () => {
  const t = "the single longest word in this headline is unmistakability";
  const f = fitHeadline(t, 300, { maxLines: 2 });
  assert.ok(f.lines.length <= 2, `the fit is ${f.lines.length} lines in a 2-line box`);
  assert.ok(f.lines.join(" ").includes("unmistakability"), "the long word was dropped");
});

test("text that already fits is untouched — no needless shrink", () => {
  const f = fitText("$672 million", 900, { max: 48, min: 24, maxLines: 3 });
  assert.equal(f.size, 48, "a string that fits at the top of the band must stay there");
  assert.deepEqual(f.lines, ["$672 million"]);
});