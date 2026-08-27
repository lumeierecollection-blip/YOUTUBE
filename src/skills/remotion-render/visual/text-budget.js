/**
 * The on-screen text budget.
 *
 * PURE module. No model call.
 *
 * WHY THERE IS A BUDGET AT ALL
 *
 * The viewer already has the narration in audio. Every word the picture
 * also prints is a word the eye reads instead of watching, and once there
 * is a sentence on screen the composition behind it becomes decoration.
 * Full narration captions are off for exactly that reason; the same logic
 * applies to a scene that quietly prints ten words of the sentence it is
 * supposed to be illustrating.
 *
 * SUPPORTING TEXT IS A LABEL, NOT A SUBTITLE. 0-8 words, and 1-4 is the
 * normal case: a name, a side, a clause fragment, an axis. Zero is a
 * perfectly good answer — a chart with a dimension on it needs no phrase.
 *
 * WHY IT LIVES HERE AND NOT IN THE SCENES
 *
 * Three scene files each had their own near-identical phrase extractor
 * (subjectPhrase, keyPhrase, clauseFrom) with three different limits — 3,
 * 3 and TEN. Nothing could measure the total because nothing outside the
 * JSX knew what any of them would produce. The director now builds these
 * strings onto the plan, so the render report can count the words that will
 * actually be drawn (diagnostics.js supportingTextWords) and a scene that
 * starts printing sentences shows up as a number instead of a feeling.
 */

/** Hard ceiling. A scene asking for more than this is asking for a subtitle. */
export const MAX_SUPPORTING_WORDS = 8;

const STOP = new Set(
  ("a an the of and or but not is are was were be been being to from in on at for with by as it its " +
   "this that these those they them their our your his her he she we you i").split(" ")
);

/**
 * The strongest content words of a span, upper-cased, as a short label.
 *
 * Used where the scene needs to NAME its subject — the thing a field is
 * acting on, the two sides of a cause. Drops stopwords because "THE OF AND"
 * is not a label.
 */
export function subjectPhrase(text, maxWords = 4) {
  const words = String(text || "")
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
  if (!words.length) return "";
  return words.slice(0, Math.min(maxWords, MAX_SUPPORTING_WORDS)).join(" ").toUpperCase();
}

/**
 * A verbatim fragment, kept in its original wording.
 *
 * Distinct from subjectPhrase: where a scene is showing a QUOTATION — the
 * operative clause of a document — dropping the stopwords would misquote
 * it. So the words stay as written and only the length is capped.
 */
export function clausePhrase(text, maxWords = 7) {
  const t = String(text || "").trim();
  if (!t) return "";
  const limit = Math.min(maxWords, MAX_SUPPORTING_WORDS);
  const words = t.split(/\s+/);
  return words.length <= limit ? t : words.slice(0, limit).join(" ") + "…";
}

/** Distinct content words, for scenes that label several nodes at once. */
export function entityLabels(text, max = 5) {
  const words = String(text || "")
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()));
  return [...new Set(words)].slice(0, max);
}

/** How many words a phrase or label set puts on screen. */
export function wordsIn(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.reduce((a, v) => a + wordsIn(v), 0);
  return String(value).trim().split(/\s+/).filter(Boolean).length;
}
