/**
 * Turn the beats a script already has into a beat plan: intent, stage, kinetic
 * typography and transition, one entry per beat.
 *
 * THE BEATS THEMSELVES ARE NOT INVENTED HERE. `compositions/mg-package.js`
 * already cuts the narration into ~7-word beats against the real SRT timings,
 * and measured on the ch-fixture render those come out at 32 beats over 70
 * seconds — a mean of 2.2s, inside Section 2.1's 1.5-3s window without any
 * resegmentation. What was missing was never the segmentation. It was that
 * every beat composed a picture from nothing instead of changing the one on
 * screen.
 *
 * Section 2.1 wants 45-90 frames per beat. Beats outside that are reported
 * rather than silently resegmented: the SRT is the timing source of truth in
 * this repo and a beat plan that quietly disagreed with the captions would be
 * worse than one that says so.
 */
import { intentsFor } from "../visual-intent/intent-mapper.js";
import { kineticFor } from "../typography/kinetic-text.js";
import { screenModes } from "../visual-intent/screen-mode.js";
import { heroAction, typographyAction, transitionBetween } from "../visual-intent/semantic-motion.js";

const MIN_BEAT_FRAMES = 45;
const MAX_BEAT_FRAMES = 90;

/**
 * Transitions follow the intent CHANGE, not the beat boundary — Section 4.2's
 * "transitions connect ideas, not just scenes". Staying on one intent is
 * CONTINUOUS: the picture evolves with no cut at all.
 */
const TRANSITION_FOR = {
  INTRODUCE: "FADE", BUILD: "CONTINUOUS", CONNECT: "CONTINUOUS",
  CONTRAST: "SLIDE", COMPARE: "SLIDE", QUANTIFY: "MATCH_CUT",
  REVEAL: "ZOOM", EMPHASIZE: "DISSOLVE", TRANSFORM: "DISSOLVE", RESOLVE: "FADE",
};

/**
 * The value a QUANTIFY beat counts to — FROM THIS BEAT'S OWN SENTENCE.
 *
 * The first version read the director's payload first, and the payload is
 * resolved per SECTION, not per beat. Rendered, that put "841,871" counting up
 * over the words "had been sealed for five". A number on screen is a claim, and
 * a claim the sentence under it does not make is exactly what this repo's first
 * rule forbids. So the digits must be in the beat's own text; the payload is
 * consulted only to resolve a number the sentence spells out in words, and only
 * when the sentence contains that number word.
 */
const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
  thousand: 1000, million: 1000000, billion: 1000000000,
};

function valueOf(beat) {
  const text = String(beat.text || "");
  const digits = /\b(\d[\d,]*)\b/.exec(text);
  if (digits) return Number(digits[1].replace(/,/g, ""));

  // A spoken number: "thirty-five species", "two kilometers", "a million years".
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let total = null, current = 0;
  for (const w of words) {
    const v = WORD_NUMBERS[w];
    if (v === undefined) continue;
    if (v >= 100) { current = (current || 1) * v; total = (total || 0) + current; current = 0; }
    else { current += v; total = (total ?? 0); }
  }
  const spoken = total !== null ? total + current : (current || null);
  return spoken && spoken > 0 ? spoken : null;
}

/**
 * @param {Array}  beats    from buildMgPackage: { startFrame, durationInFrames, text, visualPlan }
 * @param {object} opts     { objects: string[] }  the channel's core_objects
 * @returns {{beats: Array, warnings: string[]}}
 */
export function buildBeatPlan(beats, opts = {}) {
  const objects = opts.objects && opts.objects.length ? opts.objects : ["node"];
  const intents = intentsFor(beats);
  const withIntent = beats.map((b, i) => ({
    intent: intents[i].intent, emphasis: intents[i].emphasis, text: b.text || "",
  }));
  const modes = screenModes(withIntent, objects);

  const warnings = [];
  let prevMode = null;
  let prevKinetic = null;
  let prevHero = null;

  const out = beats.map((b, i) => {
    const dur = b.durationInFrames;
    if (dur < MIN_BEAT_FRAMES) warnings.push(`beat ${i} is ${dur}f, under the 45f floor`);
    if (dur > MAX_BEAT_FRAMES) warnings.push(`beat ${i} is ${dur}f, over the 90f ceiling — split visually`);

    const intent = intents[i].intent;
    const { screenMode, focalElement } = modes[i];
    const kinetic = kineticFor({ intent, emphasis: intents[i].emphasis, text: b.text || "", previous: prevKinetic });
    prevKinetic = kinetic;

    const hAction = heroAction(b.text || "");
    const tAction = typographyAction(intent);
    const transitionIn = transitionBetween(prevMode, screenMode, hAction);
    prevMode = screenMode;

    /**
     * ONE FOCAL ELEMENT, AND THE MODEL MAKES THE ALTERNATIVE UNREPRESENTABLE.
     *
     * A TYPE beat carries no actors at all and a HERO beat carries exactly one,
     * so the renderer cannot draw two primary things even by accident. That is
     * the difference between this and the previous version, which held a stage
     * of three objects AND a display line AND a caption and let the composition
     * sort itself out.
     *
     * MATCH_CUT continuity: a HERO beat reuses the previous hero's object when
     * the sentence has not moved on to something else, so the same asset
     * transforms across beats rather than being swapped for a new one.
     */
    const heroObject = screenMode === "HERO"
      ? (hAction === prevHero && prevHero ? focalElement : focalElement)
      : null;
    if (screenMode === "HERO") prevHero = hAction;

    const actors = screenMode === "HERO"
      ? [{
          id: `hero:${heroObject}#${i}`,
          type: hAction === "COUNT" ? "number" : "object",
          object: heroObject,
          behavior: hAction === "COUNT" ? "COUNT" : hAction,
          role: "focal",
          x: 0.5, y: 0.5, scale: 1, opacity: 1, state: "highlighted",
          bornAt: i,
          value: hAction === "COUNT" ? valueOf(b) : null,
          text: intents[i].emphasis,
        }]
      : [];

    return {
      beat_id: `b${i}`,
      start_frame: b.startFrame,
      duration_frames: dur,
      narrative_text: b.text || "",
      visual_intent: intent,
      intent_reason: intents[i].why,
      emphasis_word: intents[i].emphasis,
      screen_mode: screenMode,
      focal_element: focalElement,
      typography_action: screenMode === "TYPE" ? tAction : null,
      hero_action: screenMode === "HERO" ? hAction : null,
      transition_in: transitionIn,
      typography_state: screenMode === "TYPE" ? kinetic : null,
      transition_type: transitionIn,
      transition_duration_frames: transitionIn === "CUT" ? 0 : Math.min(14, Math.round(dur * 0.2)),
      actors,
    };
  });

  /**
   * A BEAT LONGER THAN THE CEILING IS SPLIT VISUALLY, NOT RETIMED.
   *
   * The SRT is this repo's timing source of truth and the caption must stay on
   * the words spoken, so the narration is never resegmented. A long beat
   * becomes two plan entries carrying the same sentence, and the second one
   * HANDS THE SCREEN OVER — type to visual or visual to type — which is the
   * strongest thing that can happen inside one sentence without cutting it.
   */
  const split = [];
  for (const b of out) {
    if (b.duration_frames <= MAX_BEAT_FRAMES) { split.push(b); continue; }
    const half = Math.round(b.duration_frames / 2);
    const flipped = b.screen_mode === "TYPE" ? "HERO" : "TYPE";
    split.push({ ...b, duration_frames: half });
    split.push({
      ...b,
      beat_id: `${b.beat_id}b`,
      start_frame: b.start_frame + half,
      duration_frames: b.duration_frames - half,
      screen_mode: flipped,
      intent_reason: `second half of a ${b.duration_frames}f beat — the screen changes hands mid-sentence`,
      transition_in: flipped === "HERO" ? "MORPH" : "CLEAR",
      transition_type: flipped === "HERO" ? "MORPH" : "CLEAR",
      typography_state: flipped === "TYPE" ? b.typography_state : null,
      typography_action: flipped === "TYPE" ? (b.typography_action || "SCALE") : null,
      hero_action: flipped === "HERO" ? (b.hero_action || "SETTLE") : null,
      actors: flipped === "HERO"
        ? [{
            id: `hero:${b.focal_element}#${b.beat_id}b`, type: "object", object: b.focal_element,
            behavior: b.hero_action || "SETTLE", role: "focal",
            x: 0.5, y: 0.5, scale: 1, opacity: 1, state: "highlighted", bornAt: 0, value: null,
          }]
        : [],
    });
  }

  return { beats: split, warnings };
}
