// A text directive must change what the renderer draws.
//
// Board 38177554641 (the first board to run with the canvas-backed text
// inventory) showed the correction loop enforcing changes that never reached
// the frame. ch-1, attempt 1:
//
//   APPLIED  whole video: at most 3 beats carry text
//   APPLIED  beat 0: draw no on-screen phrase
//   APPLIED  beat 7: draw no on-screen phrase
//   [enforce] the 4 applied directive(s) change nothing a beat renders from
//
// and the headline-dominated share went 50% -> 75% on the next attempt: the
// loop made the video worse while reporting success. The plan fields it
// cleared (typography_direction, visual_headline, objects.*) are not the field
// the renderer draws — canvas-layout.js builds every composition's headline box
// from `c.headline`.
//
// The fixture is that plan, verbatim from the run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { applyAdjustments, beatHasPhrase } from "../../src/skills/remotion-render/visual/plan-adjustments.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "ch1-plan");
const plan = JSON.parse(readFileSync(join(FIX, "visual-plan-resolved.json"), "utf8"));

// What a beat renders from, as render-and-qa.js's guard computes it: the
// canvas fields the layout reads, not the plan-level prose.
const renders = (p) => JSON.stringify((p.beats || []).map((b) => [
  b.canvas?.headline, b.canvas?.hero_headline, b.canvas?.lead_in, b.canvas?.label, b.visual_headline,
]));
const carrying = (p) => (p.beats || []).filter(beatHasPhrase).length;

test("the fixture is the case that failed: every beat's text lives on canvas.headline", () => {
  assert.equal(plan.beats.length, 8);
  for (const b of plan.beats) {
    assert.ok(String(b.canvas?.headline || "").trim(), `beat ${b.index} has no canvas.headline — the fixture no longer reproduces the failure`);
  }
  assert.equal(carrying(plan), 8);
});

test("REDUCE_TEXT_BEATS actually removes rendered phrases", () => {
  const { plan: next } = applyAdjustments(plan, [
    { directive: "REDUCE_TEXT_BEATS", params: { max: 3, keep: [0, 1, 2] }, owner: "DIRECTION_QUALITY", reason: "fixture", source: "auditor" },
  ]);
  assert.ok(carrying(next) <= 3, `${carrying(next)} beats still carry a phrase, expected at most 3`);
  assert.notEqual(renders(next), renders(plan), "the directive changed nothing a beat renders from");
});

test("REMOVE_TYPOGRAPHY clears the headline the frame draws, not just the plan's copy", () => {
  const target = plan.beats[7];
  const { plan: next } = applyAdjustments(plan, [
    { directive: "REMOVE_TYPOGRAPHY", beat: 7, owner: "PLAN_COMPLIANCE", reason: "fixture", source: "auditor" },
  ]);
  assert.equal(String(next.beats[7].canvas.headline || "").trim(), "", "canvas.headline survived REMOVE_TYPOGRAPHY");
  assert.ok(!beatHasPhrase(next.beats[7]), "the beat still reports carrying a phrase");
  assert.equal(String(target.canvas.headline).trim(), "Track your spending", "fixture beat 7 changed; the beat indices moved");
});

test("the beats kept by `keep` are the ones that survive", () => {
  const { plan: next } = applyAdjustments(plan, [
    { directive: "REDUCE_TEXT_BEATS", params: { max: 3, keep: [0, 1, 2] }, owner: "DIRECTION_QUALITY", reason: "fixture", source: "auditor" },
  ]);
  for (const i of [0, 1, 2]) assert.ok(beatHasPhrase(next.beats[i]), `kept beat ${i} lost its phrase`);
  for (const i of [3, 4, 5, 6, 7]) assert.ok(!beatHasPhrase(next.beats[i]), `beat ${i} should have been cleared`);
});

test("a beat with no canvas is still cleared (older plans)", () => {
  // Plans from before the canvas block must still respond to the directive,
  // so clearBeatPhrase keeps touching the plan-level fields.
  const legacy = { beats: [{ index: 0, typography_direction: { phrase: "Some phrase" }, visual_headline: "Some phrase" }] };
  const { plan: next } = applyAdjustments(legacy, [
    { directive: "REMOVE_TYPOGRAPHY", beat: 0, owner: "PLAN_COMPLIANCE", reason: "fixture", source: "auditor" },
  ]);
  assert.ok(!beatHasPhrase(next.beats[0]), "a canvas-less beat kept its phrase");
});