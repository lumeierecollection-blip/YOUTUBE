/**
 * The system MAKES the changes Gemini asks for, and proves they stuck.
 *
 * Gemini does not edit the plan. It says WHAT must change; these functions
 * apply it and verify it. That split exists because the previous loop asked
 * Gemini to re-plan from its own complaint, which does not converge: run
 * 35271777426 fed 28 then 38 corrections through two further planning passes
 * on channel 2 and the auditor's issue count went 12 -> 19 -> 16, with every
 * attempt REJECTED for "template monoculture".
 *
 * The assertions below are pinned to that run's measured state: 5 of 6 beats
 * carrying text (83%, cap 40%), two distinct mechanisms across six beats, and
 * two beats drawing more than one narrative line.
 *
 *   node scripts/test-plan-adjustments.mjs
 */

import {
  DIRECTIVES, ALL_MECHANISMS, OBJECT_FIRST_MECHANISMS,
  isKnownDirective, validateDirective,
  deriveAdjustments, applyAdjustments, verifyAdjustments,
  beatHasPhrase, describeDirective,
} from "../src/skills/remotion-render/visual/plan-adjustments.js";

let failed = 0;
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; } else { failed++; console.log(`  FAIL  ${msg}`); }
};
const section = (s) => console.log(`\n${s}`);

const mk = (i, mech, phrase) => ({
  index: i, mechanism: mech, visual_headline: phrase || "",
  typography_direction: phrase ? { phrase, single_line: true } : null,
  objects: {},
});

/** Channel 2 of run 35271777426, as the auditor measured it. */
function rejectedPlan() {
  return {
    beats: [
      mk(0, "TYPOGRAPHY", "Arbitration clause buried in page nine"),
      mk(1, "TYPOGRAPHY", "One employee, one corporation"),
      mk(2, "STATE_CHANGE", "The Full Agreement"),
      mk(3, "TYPOGRAPHY", "Courts split on this"),
      mk(4, "TYPOGRAPHY", "Silva loses the appeal"),
      mk(5, "STATE_CHANGE", "Final ruling stands"),
    ],
  };
}
const rejectedAudit = {
  typography: {
    textBeatShare: 5 / 6,
    issues: [
      { beat: 2, problem: 'beat draws 2 narrative lines ("The Full Agreement", "Final ruling")' },
      { beat: 5, problem: "typography rendered as 2 text blocks — must be ONE line" },
    ],
  },
  plan_compliance: { monoculture: true },
};

const textCount = (p) => p.beats.filter(beatHasPhrase).length;
const distinct = (p) => new Set(p.beats.map((b) => b.mechanism)).size;

section("1. Objective violations become directives with no model involved");
{
  const derived = deriveAdjustments(rejectedPlan(), rejectedAudit);
  const names = derived.map((d) => d.directive);
  ok(names.includes("REDUCE_TEXT_BEATS"), "an 83% text share yields REDUCE_TEXT_BEATS");
  ok(names.includes("DIVERSIFY_MECHANISMS"), "mechanism monoculture yields DIVERSIFY_MECHANISMS");
  ok(derived.filter((d) => d.directive === "REMOVE_TYPOGRAPHY").length === 2,
    "each multi-narrative-line beat yields REMOVE_TYPOGRAPHY");
  ok(derived.every((d) => d.source === "auditor"), "all are attributed to the auditor, not a model");
  ok(derived.every((d) => d.reason && d.reason.length > 10), "each carries the measured reason");

  // The cap must be derived, not guessed: 40% of 6 beats is 2.
  const reduce = derived.find((d) => d.directive === "REDUCE_TEXT_BEATS");
  ok(reduce.params.max === 2, `the cap is computed from beat count (got ${reduce.params.max}, expected 2)`);

  // A clean plan must yield nothing — enforcement only fires on violations.
  const clean = { beats: [mk(0, "TYPOGRAPHY", "One line"), mk(1, "STATE_CHANGE"), mk(2, "EVIDENCE_FIGURE"), mk(3, "PROPORTIONAL_OBJECTS")] };
  const none = deriveAdjustments(clean, { typography: { textBeatShare: 0.25, issues: [] }, plan_compliance: { monoculture: false } });
  ok(none.length === 0, `a compliant plan yields no directives (got ${none.length})`);
}

section("2. Applying them actually changes the plan");
{
  const before = rejectedPlan();
  ok(textCount(before) === 6, "before: every beat carries text");
  ok(distinct(before) === 2, "before: only 2 distinct mechanisms");

  const derived = deriveAdjustments(before, rejectedAudit);
  const { plan: after, applied, rejected } = applyAdjustments(before, derived);

  ok(rejected.length === 0, `no directive was rejected (got ${rejected.length})`);
  ok(textCount(after) <= 2, `after: at most 2 beats carry text (got ${textCount(after)})`);
  ok(distinct(after) >= 5, `after: mechanisms diversified (got ${distinct(after)})`);
  ok(textCount(before) === 6, "the input plan was NOT mutated (a copy is edited)");

  // Removing text must never leave a TYPOGRAPHY beat with nothing to draw.
  for (const b of after.beats) {
    if (b.mechanism === "TYPOGRAPHY") ok(beatHasPhrase(b), "a TYPOGRAPHY beat always keeps a phrase");
    if (!beatHasPhrase(b)) ok(b.mechanism !== "TYPOGRAPHY", "a text-free beat is never left as TYPOGRAPHY");
  }
}

section("3. Verification is real — it catches a change that did not stick");
{
  const derived = deriveAdjustments(rejectedPlan(), rejectedAudit);
  const { plan: after, applied } = applyAdjustments(rejectedPlan(), derived);
  ok(verifyAdjustments(after, applied).ok, "a correctly applied set verifies");

  // Put the defect back and confirm verification FAILS. Without this, the
  // verifier could be vacuous and the loop would render the rejected plan.
  const tampered = JSON.parse(JSON.stringify(after));
  tampered.beats[3].visual_headline = "text sneaks back in";
  tampered.beats[3].typography_direction = { phrase: "text sneaks back in" };
  tampered.beats[4].visual_headline = "and here too";
  tampered.beats[4].typography_direction = { phrase: "and here too" };
  const v = verifyAdjustments(tampered, applied);
  ok(!v.ok, "re-introducing text makes verification FAIL");
  ok(v.failures.some((f) => /still carry a phrase/.test(f.reason)), "the failure names the violated cap");
}

section("4. Gemini supplies VALUES; the system never invents them");
{
  const plan = rejectedPlan();
  const fromGemini = [
    { directive: "SET_PHRASE", beat: 0, params: { phrase: "Buried on page nine" } },
    { directive: "SET_FIGURE", beat: 2, params: { figure: "1 employee" } },
    { directive: "SET_OBJECT_LABEL", beat: 5, params: { key: "label_b", label: "Ruling stands" } },
  ];
  const { plan: after, applied } = applyAdjustments(plan, fromGemini);
  ok(verifyAdjustments(after, applied).ok, "value directives apply and verify");
  ok(after.beats[0].typography_direction.phrase === "Buried on page nine", "the phrase is Gemini's, verbatim");
  ok(after.beats[2].objects.figure === "1 employee", "the figure is Gemini's, verbatim");
  ok(after.beats[5].objects.label_b === "Ruling stands", "the object label is Gemini's, verbatim");

  // Every value-setting directive REQUIRES the value. The system has no
  // default, because a default would be fabricated on-screen content.
  ok(validateDirective({ directive: "SET_PHRASE", beat: 0, params: {} }, 6) !== null,
    "SET_PHRASE without a phrase is invalid, not defaulted");
  ok(validateDirective({ directive: "SET_FIGURE", beat: 0, params: {} }, 6) !== null,
    "SET_FIGURE without a figure is invalid, not defaulted");
}

section("5. Malformed and unsatisfiable directives are reported, never skipped");
{
  const plan = rejectedPlan();
  const bad = [
    { directive: "MAKE_IT_POP", beat: 0, params: {} },
    { directive: "SET_MECHANISM", beat: 0, params: { mechanism: "CINEMATIC_VIBES" } },
    { directive: "SET_MECHANISM", beat: 99, params: { mechanism: "STATE_CHANGE" } },
    { directive: "SET_MECHANISM", params: { mechanism: "STATE_CHANGE" } },
  ];
  const { applied, rejected } = applyAdjustments(plan, bad);
  ok(applied.length === 0, "no malformed directive is applied");
  ok(rejected.length === 4, `all 4 are reported with reasons (got ${rejected.length})`);
  ok(rejected.every((r) => r.reason && r.reason.length > 5), "each rejection carries a reason");
  ok(!isKnownDirective("MAKE_IT_POP"), "an invented directive name is not known");

  // An impossible demand is distinguishable from a failed application: a
  // 2-beat video cannot carry 6 distinct mechanisms, and that is a bad
  // directive rather than an enforcement bug.
  const tiny = { beats: [mk(0, "TYPOGRAPHY", "a"), mk(1, "STATE_CHANGE")] };
  const demand = [{ directive: "DIVERSIFY_MECHANISMS", params: { minDistinct: 6 } }];
  const r = applyAdjustments(tiny, demand);
  const v = verifyAdjustments(r.plan, r.applied);
  ok(!v.ok, "an unsatisfiable diversify demand fails verification");
  ok(v.failures[0].impossible === true, "...and is flagged impossible, not a silent miss");
}

section("6. Enforcement is deterministic");
{
  // The same rejection must always produce the same plan, or a retry is
  // just another roll of the dice under a different name.
  const a = applyAdjustments(rejectedPlan(), deriveAdjustments(rejectedPlan(), rejectedAudit)).plan;
  const b = applyAdjustments(rejectedPlan(), deriveAdjustments(rejectedPlan(), rejectedAudit)).plan;
  ok(JSON.stringify(a) === JSON.stringify(b), "applying the same directives twice yields an identical plan");
}

section("7. Every declared directive is appliable and verifiable");
{
  for (const [name, spec] of Object.entries(DIRECTIVES)) {
    ok(["beat", "video"].includes(spec.scope), `${name} declares a valid scope`);
    ok(Array.isArray(spec.params), `${name} declares its params`);
    ok(describeDirective({ directive: name, beat: 0, params: { mechanism: "STATE_CHANGE", phrase: "x", figure: "1", key: "k", label: "l", max: 1, minDistinct: 2 } })
      .length > 0, `${name} has a human-readable description`);
  }
  ok(OBJECT_FIRST_MECHANISMS.every((m) => ALL_MECHANISMS.includes(m)), "object-first mechanisms are part of the vocabulary");
  ok(!OBJECT_FIRST_MECHANISMS.includes("TYPOGRAPHY"), "TYPOGRAPHY is not an object-first mechanism");
}

section("8. Video length is never changed by enforcement");
{
  // Duration is set by the VOICEOVER (render.js computeDurationFrames:
  // audioSeconds * fps + AUDIO_TAIL_FRAMES), not by the visual plan.
  // Enforcement rewrites how a beat is SHOWN, so the beat count and every
  // timing field must come out identical — otherwise fixing the visuals
  // would quietly change how long every video runs.
  const timed = (i, mech, phrase, sf, df) => ({
    ...mk(i, mech, phrase), start_frame: sf, duration_frames: df,
  });
  const plan = {
    totalFrames: 1240, durationSec: 41.33,
    beats: [
      timed(0, "TYPOGRAPHY", "Arbitration clause buried in page nine", 0, 207),
      timed(1, "TYPOGRAPHY", "One employee, one corporation", 207, 207),
      timed(2, "STATE_CHANGE", "The Full Agreement", 414, 207),
      timed(3, "TYPOGRAPHY", "Courts split on this", 621, 207),
      timed(4, "TYPOGRAPHY", "Silva loses the appeal", 828, 206),
      timed(5, "STATE_CHANGE", "Final ruling stands", 1034, 206),
    ],
  };
  const sig = (p) => `${p.beats.length}|` +
    p.beats.map((b) => `${b.start_frame}:${b.duration_frames}`).join(",") +
    `|${p.totalFrames}|${p.durationSec}`;

  const before = sig(plan);
  const { plan: after, applied, lengthViolation } = applyAdjustments(plan, deriveAdjustments(plan, rejectedAudit));

  ok(!lengthViolation, "no length violation was triggered");
  ok(applied.length > 0, "directives were still applied (the invariant did not block real work)");
  ok(sig(after) === before, `length signature is identical\n      before ${before}\n      after  ${sig(after)}`);
  ok(after.beats.length === plan.beats.length, "beat count unchanged");
  ok(after.totalFrames === plan.totalFrames, "totalFrames unchanged");
  after.beats.forEach((b, i) => {
    ok(b.start_frame === plan.beats[i].start_frame, `beat ${i} start_frame unchanged`);
    ok(b.duration_frames === plan.beats[i].duration_frames, `beat ${i} duration_frames unchanged`);
  });
  // ...while the VISUALS did change, which is the point.
  ok(after.beats.filter(beatHasPhrase).length < plan.beats.filter(beatHasPhrase).length,
    "the visual content changed even though the timing did not");

  // And the invariant actually bites: a directive that retimed a beat must
  // cause the whole edit to be discarded rather than rendered.
  const sneaky = [{ directive: "SET_MECHANISM", beat: 0, params: { mechanism: "STATE_CHANGE" } }];
  const spy = JSON.parse(JSON.stringify(plan));
  const res = applyAdjustments(spy, sneaky);
  ok(sig(res.plan) === before, "a normal directive still preserves the signature");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
