/**
 * Visual Bible v5 -> v6: the review must return DIRECTIVES, not only prose.
 *
 * The whole-video review produced a one-sentence verdict and free-text
 * corrections. Run 35271777426 shows why that is not enough: on both
 * channels all three attempts came back REJECTED with prose like "relying
 * entirely on a repetitive, AI-generated template of floating legal
 * headlines and abstract UI boxes" — accurate, and un-actionable. The system
 * could not apply it, so nothing changed and the video shipped anyway.
 *
 * Gemini now also answers in a small machine-applicable vocabulary. It still
 * decides WHAT must change; the system applies it and verifies it
 * (src/skills/remotion-render/visual/plan-adjustments.js).
 *
 * Idempotent.
 *
 *   node scripts/patch-visual-bible-adjustments.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "config/visual-bible.json";
const bible = JSON.parse(readFileSync(PATH, "utf8"));

const ADJUSTMENT_CONTRACT = `

## MANDATORY: return machine-applicable adjustments

A verdict the pipeline cannot apply changes nothing. Alongside your prose
review, return an "adjustments" array. Each entry names a change the system
will make to the visual plan AUTOMATICALLY and then verify. You are not
rewriting the plan — you are stating the change; the system makes it.

Use ONLY these directives:

  { "directive": "SET_MECHANISM", "beat": <int>, "params": { "mechanism": "<MECHANISM>" } }
      Show this beat a different way. MECHANISM is one of TYPOGRAPHY,
      STATE_CHANGE, EVIDENCE_FIGURE, ACTION_CONSEQUENCE, PHYSICAL_GROWTH,
      VISIBLE_CONSUMPTION, SURFACE_AND_BENEATH, PROPORTIONAL_OBJECTS,
      STRUCTURAL_BREAKDOWN.

  { "directive": "REMOVE_TYPOGRAPHY", "beat": <int> }
      This beat must draw no on-screen phrase at all. Use it when the text
      is carrying a beat that should be carried by the visual.

  { "directive": "SET_PHRASE", "beat": <int>, "params": { "phrase": "<2-7 words>" } }
      Replace the on-screen phrase with this exact wording. YOU supply the
      words — the system will never invent a phrase.

  { "directive": "SET_FIGURE", "beat": <int>, "params": { "figure": "<e.g. $34 MILLION, 70%, 2 seconds>" } }
      Replace a figure slot. Must be a number with an optional unit, and it
      must come from the research — never invent a statistic.

  { "directive": "SET_OBJECT_LABEL", "beat": <int>, "params": { "key": "<label_a|label_b|cause|effect>", "label": "<short label>" } }

  { "directive": "REDUCE_TEXT_BEATS", "params": { "max": <int>, "keep": [<beat indices to keep text on>] } }
      At most N beats may carry a phrase. Put the beats whose text matters
      most (the hook, the key fact) in "keep".

  { "directive": "DIVERSIFY_MECHANISMS", "params": { "minDistinct": <int> } }
      Require at least N distinct mechanisms across the video. Never ask for
      more than the number of beats.

Rules:
- Every entry needs a "reason" naming what you saw in the frames.
- If you reject the video, you MUST return at least one adjustment. A
  rejection with no adjustment is not a review, and the pipeline will
  report it as an unactioned rejection.
- Do not ask for anything outside this vocabulary. "Make it more cinematic"
  is not a directive; "REMOVE_TYPOGRAPHY on beats 1,3,4 and
  DIVERSIFY_MECHANISMS minDistinct 5" is.
- Prefer the fewest directives that fix the actual problem.`;

let changed = 0;

for (const key of ["whole_video_review", "plan_compliance_review"]) {
  const p = bible.prompts?.[key];
  if (typeof p !== "string") continue;
  if (p.includes("MANDATORY: return machine-applicable adjustments")) continue;
  bible.prompts[key] = p + ADJUSTMENT_CONTRACT;
  changed++;
}

// Record the rule itself, so the contract is documented where the other
// rules live rather than only inside a prompt string.
if (!bible.rules["REV-01"]) {
  bible.rules["REV-01"] = {
    name: "rejection-must-carry-adjustments",
    category: "REVIEW",
    severity: "CRITICAL",
    description:
      "A review that rejects a video must return at least one machine-" +
      "applicable adjustment. Gemini judges meaning and states WHAT must " +
      "change; the system applies the change and verifies it held " +
      "(visual/plan-adjustments.js). Prose-only rejections are what allowed " +
      "run 35271777426 to ship two videos after three REJECTED attempts " +
      "each: the verdict was accurate and nothing could act on it. Objective " +
      "violations (text-beat share over the cap, mechanism monoculture, a " +
      "beat drawing two narrative lines) are derived by the system without " +
      "asking, because they are arithmetic. Gemini is required only for the " +
      "values it alone can judge: which phrase, which figure.",
    pass: "Every REJECTED or NEEDS_IMPROVEMENT review carries adjustments the pipeline applied and verified.",
    fail: "A rejection with no adjustments, or an adjustment outside the declared directive vocabulary.",
  };
  changed++;
}

bible.version = 6;
writeFileSync(PATH, JSON.stringify(bible, null, 2) + "\n");
console.log(`visual-bible.json -> v${bible.version}: ${changed} change(s); rules ${Object.keys(bible.rules).length}`);
