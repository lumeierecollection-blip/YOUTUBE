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
import { stageTimeline } from "../actors/actor-manager.js";
import { kineticFor } from "../typography/kinetic-text.js";

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
    intent: intents[i].intent,
    emphasis: intents[i].emphasis,
    value: valueOf(b),
    seq: i,
  }));
  const stages = stageTimeline(withIntent, objects);

  const warnings = [];
  let prevIntent = null;
  let prevKinetic = null;

  const out = beats.map((b, i) => {
    const dur = b.durationInFrames;
    if (dur < MIN_BEAT_FRAMES) warnings.push(`beat ${i} is ${dur}f, under the 45f floor`);
    if (dur > MAX_BEAT_FRAMES) warnings.push(`beat ${i} is ${dur}f, over the 90f ceiling — split visually`);
    const intent = intents[i].intent;
    const kinetic = kineticFor({
      intent, emphasis: intents[i].emphasis, text: b.text || "", previous: prevKinetic,
    });
    prevKinetic = kinetic;
    const transition = prevIntent === intent ? "CONTINUOUS" : (TRANSITION_FOR[intent] || "DISSOLVE");
    prevIntent = intent;
    return {
      beat_id: `b${i}`,
      start_frame: b.startFrame,
      duration_frames: dur,
      narrative_text: b.text || "",
      visual_intent: intent,
      intent_reason: intents[i].why,
      emphasis_word: intents[i].emphasis,
      typography_state: kinetic,
      transition_type: transition,
      transition_duration_frames: transition === "CONTINUOUS" ? 0 : Math.min(12, Math.round(dur * 0.18)),
      actors: stages[i],
    };
  });

  /**
   * A BEAT LONGER THAN THE CEILING IS SPLIT VISUALLY, NOT RETIMED.
   *
   * The SRT is this repo's timing source of truth and the caption must stay on
   * the words that were spoken, so the narration is not resegmented. But a
   * 94-frame beat means one composition held for 3.1 seconds, which is the
   * defect this whole rebuild exists to remove — measured, that is exactly what
   * CHECK 6 caught on beat 8. So a long beat becomes two plan entries carrying
   * the same sentence: the second half re-stages, emphasising what the first
   * half assembled. The viewer hears one continuous line and watches the
   * picture resolve underneath it.
   */
  const split = [];
  for (const b of out) {
    if (b.duration_frames <= MAX_BEAT_FRAMES) { split.push(b); continue; }
    const half = Math.round(b.duration_frames / 2);
    const lit = (b.actors || []).map((a, i) => ({
      ...a,
      behavior: i === 0 ? "EMPHASIZE" : "DE_EMPHASIZE",
      scale: i === 0 ? (a.scale ?? 1) * 1.14 : (a.scale ?? 1) * 0.86,
      opacity: i === 0 ? 1 : Math.min(a.opacity ?? 1, 0.3),
      state: i === 0 ? "highlighted" : "dimmed",
      x: i === 0 ? 0.5 : a.x,
      y: i === 0 ? 0.48 : a.y,
    }));
    split.push({ ...b, duration_frames: half });
    split.push({
      ...b,
      beat_id: `${b.beat_id}b`,
      start_frame: b.start_frame + half,
      duration_frames: b.duration_frames - half,
      visual_intent: "EMPHASIZE",
      intent_reason: `second half of a ${b.duration_frames}f beat — the picture resolves while the sentence continues`,
      transition_type: "CONTINUOUS",
      transition_duration_frames: 0,
      typography_state: { ...b.typography_state, action: "EMPHASIZE", replaces: null },
      actors: lit,
    });
  }

  return { beats: split, warnings };
}
