// A LATER STAGE MUST NOT UN-DRAW A NAMED ENTITY.
//
// Board 38285053635 ch-1 beat 6. The entity ladder's own log:
//
//   [ladder] ch-1 beat 6: states 50 percent -> a stat card
//
// and the rendered frame:
//
//   [canvas] FAIL entity-coverage — beat 6: number "50 percent", number
//   "$6.99" — draws figure, none of it the entity
//
// The ladder replaced the beat's figure so the sentence's "50 percent" was on
// screen. chooseShots runs AFTER the ladder (render-and-qa.js:2199 then :2235)
// and rewrites `b.data` from its own figure choice, putting "$6.99" back — so
// the ladder's fix was computed, logged, and discarded before the render, and
// the gate was right that only one of the two numbers was on screen.
//
// This is the same failure the session has hit repeatedly, in a new place: two
// writers to one field, the later one winning, and a check reading the result.
// It is not a shot-variety bug — a shot choice is about VARIETY, and it must not
// decide that a named entity goes back on nothing.
//
// The ladder records `ladder_visual` on every beat it gave a visual to, and
// chooseShots keeps it while still taking the shot's other devices.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = readFileSync(join(ROOT, "scripts", "render-and-qa.js"), "utf8");

test("the ladder records what it drew, so a later stage can respect it", () => {
  assert.ok(/b\.ladder_visual\s*=\s*\{/.test(SRC), "the ladder does not record the visual it applied");
});

test("chooseShots does not overwrite a ladder visual", () => {
  // The shot's own figure is skipped on a beat the ladder drew.
  const i = SRC.indexOf("if (choice[i].figure) {");
  assert.ok(i > 0, "the figure branch moved or was renamed");
  const branch = SRC.slice(i, i + 520);
  assert.ok(/if \(b\.ladder_visual\)/.test(branch), "the figure branch ignores ladder_visual");
  assert.ok(
    /b\.visual_type = choice\[i\]\.figure\.visual_type/.test(branch),
    "the shot's figure is no longer applied at all — it must still apply when the ladder did not draw",
  );
  assert.ok(
    /else\s*\{\s*b\.visual_type = choice\[i\]\.figure\.visual_type/.test(branch),
    "the shot's figure must still be applied on a beat the ladder did not touch",
  );
});

test("the object branch respects it too", () => {
  assert.ok(/if \(choice\[i\]\.object && !b\.ladder_visual\)/.test(SRC), "a shot object can still replace a ladder visual");
});

test("a SECOND ladder pass does not swap an entity's visual for a figure", () => {
  // Board 38289136245 ch-1 beat 4. The ladder runs twice (before and after the
  // asset pass). Pass one drew the plate for "Quicken Simplifi"; on pass two
  // the figure $3.49 was still on screen and looked complete, so the figure
  // branch REPLACED the plate with a stat card — and both the organisation and
  // the number went off screen:
  //
  //   [ladder] ch-1 beat 4: names organization "Quicken Simplifi" ->
  //     plate-organization (replaces a visual that carried none of it)
  //   [ladder] ch-1 beat 4: states $3.49 -> a stat card
  //   [canvas] FAIL entity-coverage — beat 4: organization "Quicken Simplifi",
  //     number "$3.49" — draws figure, none of it the entity
  //
  // An entity the sentence named is not traded away for a figure it also named.
  // Anchored on the guard itself: the branch marker appears more than once in
  // this file, and it is the guard that is being asserted.
  const gi = SRC.indexOf("if (b.ladder_visual && d.art) {");
  assert.ok(gi > 0, "the figure branch no longer guards a ladder-drawn entity");
  assert.ok(SRC.slice(gi, gi + 400).includes("continue;"), "the guard does not stop the branch");
});

test("every ladder branch records what it drew", () => {
  // map, art and the alongside concept visual all set ladder_visual, so a later
  // stage can tell this beat's visual apart from the planner's.
  const marks = SRC.match(/b\.ladder_visual\s*=\s*\{/g) || [];
  assert.ok(marks.length >= 4, `expected the map, figure, art and alongside branches to record a visual; found ${marks.length}`);
});

test("the two stages are ordered so the guard is the thing that matters", () => {
  // This is a regression note as much as a test: the ladder runs first and
  // chooseShots second, so the guard on the later writer is what keeps the
  // entity on screen. If the order is ever swapped the guard becomes
  // meaningless and this test is the reminder to move it.
  const ladder = SRC.indexOf("await entityLadder(plan, channelId)");
  const shots = SRC.indexOf("await chooseShots(plan, channelId)");
  assert.ok(ladder > 0 && shots > 0, "could not find both stage calls");
  assert.ok(ladder < shots, "chooseShots now runs BEFORE the ladder; the guard belongs on the other writer");
});