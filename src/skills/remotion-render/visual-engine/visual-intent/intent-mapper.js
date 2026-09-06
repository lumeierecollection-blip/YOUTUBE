/**
 * Map a beat's own sentence to one of the ten visual intents.
 *
 * Section 3.4's rules are literal and are implemented literally: a number means
 * QUANTIFY, "not" or "but" means CONTRAST, "because" or "so" means CONNECT, an
 * ordinal run means BUILD, and so on. They are applied in a fixed order with
 * the more specific tests first, so a sentence that is both numeric and
 * contrastive resolves the same way every time.
 *
 * WHY THIS SITS ALONGSIDE THE STRATEGY DETECTORS RATHER THAN REPLACING THEM.
 * `visual/semantics.js` already reads these sentences and does it well — it
 * finds the numbers, the pairs, the years, the entities. What it produces is a
 * STRATEGY, which answers "what kind of picture is this beat". An INTENT
 * answers a different question: "what does this beat DO to the picture that is
 * already on screen". A beat can be a COMPARISON and still be the moment the
 * comparison RESOLVES. So the detectors are reused for their extraction and the
 * intent is decided here, from the sentence and from what the previous beat left
 * behind.
 *
 * NOTHING HERE READS ANYTHING BUT THE BEAT'S OWN TEXT AND THE PRECEDING INTENT.
 */

export const INTENTS = [
  "INTRODUCE", "TRANSFORM", "CONNECT", "COMPARE", "QUANTIFY",
  "REVEAL", "RESOLVE", "CONTRAST", "BUILD", "EMPHASIZE",
];

/** Section 3.4's cue words, kept as data so the rules are readable as rules. */
const CUES = {
  CONTRAST: /\b(not|but|however|instead|rather than|unlike|whereas|yet|despite|although)\b/i,
  CONNECT: /\b(because|so|therefore|which means|that means|leads to|causes|results in|due to|thanks to)\b/i,
  BUILD: /\b(first|second|third|then|next|also|another|adds?|plus|and then|finally)\b/i,
  REVEAL: /\b(actually|in fact|turns out|discovered|found|hidden|secret|revealed|the truth)\b/i,
  RESOLVE: /\b(so|that is why|in the end|ultimately|all of it|nothing but|comes down to|the answer)\b/i,
  COMPARE: /\b(than|versus|vs\.?|compared|twice|half|more than|less than|as much as)\b/i,
  TRANSFORM: /\b(becomes?|turned? into|changes? to|grew|shrank|rose|fell|from .+ to )\b/i,
  EMPHASIZE: /\b(the key|the point|critical|crucial|matters|most important|remember|never|always)\b/i,
};

/** A quantity written as digits or as a spoken number. */
const NUMBERISH = /\b(\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|million|billion|percent|%)\b/i;

/** Words that carry no emphasis, so the emphasis word is never one of these. */
const STOP = new Set(`a an the and or but of to in on at for with from by is are was were be been being
  it its this that these those as if then than so not no you your they them their he she his her we our us i
  do does did done have has had will would can could should may might must about into over under after before`.split(/\s+/));

/**
 * The word this beat is about.
 *
 * Longest non-stop word, with a number preferred when one is present, because
 * a quantity is what a viewer's eye goes to. Returned uppercased: the kinetic
 * layer sets these as display type and the caption layer carries the verbatim
 * spoken words, so casing here is a rendering decision, not a change to what
 * was said.
 */
export function emphasisWord(text) {
  // Trailing punctuation rode along on the first pass: PERCENT. and ALONE.
  const clean = (w) => w.replace(/^[^A-Za-z0-9$]+|[^A-Za-z0-9%]+$/g, "");
  const words = String(text || "").split(/\s+/).map(clean).filter(Boolean);
  const num = words.find((w) => /^\$?\d/.test(w));
  if (num) return num.toUpperCase();
  const candidates = words.filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()));
  if (!candidates.length) return (words[0] || "").toUpperCase();
  return candidates.sort((a, b) => b.length - a.length)[0].toUpperCase();
}

/**
 * @param {object} beat        the beat, with `text` and optionally `visualPlan`
 * @param {object} ctx         { index, total, previousIntent }
 * @returns {{intent: string, why: string, emphasis: string}}
 */
export function intentFor(beat, ctx = {}) {
  const text = String(beat.text || (beat.visualPlan && beat.visualPlan.text) || "");
  const i = ctx.index || 0;
  const total = ctx.total || 1;
  const prev = ctx.previousIntent || null;
  const emphasis = emphasisWord(text);
  const pick = (intent, why) => ({ intent, why, emphasis });

  // Position first: the opening beat introduces whatever follows, and the last
  // beat resolves it. Both are true regardless of what words are in them.
  if (i === 0) return pick("INTRODUCE", "first beat of the video");
  if (i === total - 1) return pick("RESOLVE", "last beat of the video");

  // Then the cue words, most specific first.
  if (CUES.REVEAL.test(text)) return pick("REVEAL", "reveal cue in the sentence");
  if (CUES.CONTRAST.test(text)) return pick("CONTRAST", "contrast cue in the sentence");
  if (CUES.COMPARE.test(text)) return pick("COMPARE", "comparison cue in the sentence");
  if (CUES.CONNECT.test(text)) return pick("CONNECT", "causal cue in the sentence");
  if (CUES.TRANSFORM.test(text)) return pick("TRANSFORM", "change-of-state cue in the sentence");
  if (NUMBERISH.test(text)) return pick("QUANTIFY", "the sentence states a quantity");
  if (CUES.BUILD.test(text)) return pick("BUILD", "additive cue in the sentence");
  if (CUES.EMPHASIZE.test(text)) return pick("EMPHASIZE", "emphasis cue in the sentence");

  /**
   * NOTHING MATCHED, AND THIS IS WHERE THE OLD RENDERER WENT WRONG.
   *
   * Its classifier fell through to STATEMENT and drew the same picture, which
   * is how twenty consecutive beats came to be one held document. A beat with
   * no cue is not a beat with nothing to do: it is still adding to what is on
   * screen, or emphasising it, and which of those depends on what the last
   * beat did. Alternating is not a coin toss — it guarantees the picture keeps
   * moving through a run of plain sentences, which is exactly the run that
   * used to freeze.
   */
  if (prev === "BUILD") return pick("EMPHASIZE", "no cue; the previous beat built, so this one lands on what was built");
  return pick("BUILD", "no cue; adds to what is already on screen");
}

/** Assign an intent to every beat in order, threading the previous one through. */
export function intentsFor(beats) {
  let prev = null;
  return beats.map((b, i) => {
    const r = intentFor(b, { index: i, total: beats.length, previousIntent: prev });
    prev = r.intent;
    return r;
  });
}
