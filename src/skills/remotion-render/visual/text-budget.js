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
   "this that these those they them their our your his her he she we you i " +
   // Quantifiers and prepositions. Without these, subjectPhrase's "first
   // content word" lands on the determiner rather than the noun: "Every
   // request the system takes…" named the travelling object "EVERY", which
   // on screen is a label attached to nothing.
   "every any each all both some many much most more other another such own same " +
   "through into about after before during over under between within across along " +
   "than then very just only also while when where which who whom whose what how why").split(" ")
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

/**
 * Split a sentence into its clauses, in order.
 *
 * Used by the scenes that draw a RELATION between two halves of a line
 * ("X happens, and a failure stops the whole thing"): the halves are the
 * two things on screen, so they have to be separable before either can be
 * labelled. Verbatim — no rewording, so a clause is always the script's
 * own words, per the repo's no-invented-content rule.
 */
export function clauses(text) {
  return String(text || "")
    // SENTENCE BOUNDARIES FIRST. Without this a section's two sentences
    // were one "clause", and a label drawn from it ran straight through the
    // full stop: "THE PURCHASES WERE NEVER THE PROBLEM. THE BALANCE…".
    // A sentence end is the strongest clause boundary there is.
    .split(/(?<=[.!?])\s+/)
    .flatMap((sentence) =>
      sentence.split(/,\s*(?:and|but|which|when|where|while|because|until|so)\b|[;:]|\s+—\s+/i)
    )
    .map((c) => c.trim().replace(/^(and|but|which|when|where|while|because|until|so)\s+/i, "").replace(/[.!?]+$/, ""))
    .filter((c) => c.split(/\s+/).filter(Boolean).length >= 2);
}

/**
 * The operative predicate of a line — the verb that carries the claim, plus
 * what it acts on ("STOPS THE WHOLE LINE", "COLLAPSED").
 *
 * WHY NOT subjectPhrase. subjectPhrase takes the FIRST content words, which
 * on a narration line is almost always the grammatical subject: "SYSTEM
 * PROCESSES EVERY" — the setup, never the point. The point of a line is
 * nearly always its verb. On a rendered frame the difference is whether the
 * one phrase on screen says what happened or just names the actor.
 *
 * Verbatim from the matched verb onward, so this quotes the script rather
 * than paraphrasing it; returns "" when no verb of consequence is present,
 * and callers fall back to subjectPhrase.
 */
const CONSEQUENCE_VERB =
  /\b(stops?|stopped|halts?|halted|blocks?|blocked|prevents?|prevented|collapsed?|collapses|fails?|failed|breaks?|broke|removed?|removes|doubled?|doubles|tripled?|triples|dropped?|drops|rose|risen|grew|grows|fell|falls|returns?|returned|holds?|holding|held|reaches?|reached|survives?|survived|killed?|kills|saved?|saves)\b/i;

/** Connectives a label must never END on — "STOPS THE WHOLE" reads as truncation. */
const TRAILING = new Set(
  "a an the of and or but not to from in on at for with by as it its this that these those because until while when where so is are was were be been being every any none each all both some many much more other another such own same".split(" ")
);

export function predicatePhrase(text, maxWords = 4) {
  const t = String(text || "").trim();
  if (!t) return "";
  const m = CONSEQUENCE_VERB.exec(t);
  if (!m) return "";
  const limit = Math.min(maxWords, MAX_SUPPORTING_WORDS);

  // PASSIVE ("the batching rule WAS finally REMOVED"): the verb alone is
  // "REMOVED", which names an action with no object — on screen that is a
  // label that could belong to any line in the script. The thing it happened
  // TO sits before the auxiliary, so carry it along.
  const before = t.slice(0, m.index);
  const passive = /\b(was|were|been|is|are|get|got)\s+(\w+\s+)?$/i.test(before);
  const head = passive ? subjectPhrase(before, 2) : "";

  /**
   * THE PREDICATE MUST BE COMPLETE, NOT CUT TO LENGTH.
   *
   * This used to slice the words after the verb to the cap, which on a long
   * sentence produced "COLLAPSED BECAUSE THE SECOND" — a label that stops
   * mid-clause and reads as a bug. So the tail runs only to the end of the
   * verb's OWN clause, and if that does not fit the cap this returns
   * nothing and the caller falls back to a clause that does.
   */
  const clauseEnd = /\b(because|until|while|when|where|which|and|but|so|though|after|before)\b|[,;:.]/i;
  let tailText = t.slice(m.index);
  const cut = clauseEnd.exec(tailText.slice(1));
  if (cut) tailText = tailText.slice(0, cut.index + 1);

  const tail = tailText
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // Trim trailing connectives so the label ends on a content word.
  while (tail.length > 1 && TRAILING.has(tail[tail.length - 1].toLowerCase())) tail.pop();

  const budget = Math.max(1, limit - (head ? head.split(/\s+/).length : 0));
  if (tail.length > budget) return "";

  return [head, tail.join(" ").toUpperCase()].filter(Boolean).join(" ").trim();
}

/**
 * The most substantial clause of a line, kept verbatim.
 *
 * A DIFFERENT JOB FROM predicatePhrase, which exists to label an object
 * inside a diagram and so wants the shortest thing that names the claim
 * ("STOPS THE WHOLE LINE"). Where the text IS the shot — a documentary
 * line set over a photograph — that rule degenerates: the last clause of
 * "none of them needing sunlight to survive" reduces to the single word
 * "SURVIVE", a verb with nothing to attach to.
 *
 * So this picks by information instead of by position: the clause with the
 * most content words, with a number counting extra because a figure is the
 * most concrete thing a documentary line can put on screen. Verbatim and
 * length-capped, never reworded — the script's own sentence, shortened.
 */
export function bestClause(text, maxWords = 8) {
  const cl = clauses(text);
  if (!cl.length) return clausePhrase(text, maxWords);
  const score = (c) => {
    const words = c.split(/\s+/).filter(Boolean);
    const content = words.filter((w) => w.length > 3 && !STOP.has(w.toLowerCase().replace(/[^\w'-]/g, "")));
    const hasNumber = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)\b/i.test(c);
    // Long enough to be a sentence fragment worth reading, short enough to
    // set large: content words carry it, a figure adds weight, and anything
    // past the cap will be trimmed anyway so extra length earns nothing.
    return content.length + (hasNumber ? 2 : 0) - Math.max(0, words.length - maxWords) * 0.5;
  };
  const best = cl.reduce((a, b) => (score(b) > score(a) ? b : a), cl[0]);
  const cut = clausePhrase(best, maxWords);
  // A truncated clause must not end on a function word: "…centipedes, none
  // of…" reads as a bug rather than as an elision. Trim back to the last
  // content word, then re-attach the ellipsis.
  if (!cut.endsWith("…")) return cut;
  const words = cut.slice(0, -1).trim().split(/\s+/);
  while (words.length > 1 && (STOP.has(words[words.length - 1].toLowerCase().replace(/[^\w'-]/g, "")) || TRAILING.has(words[words.length - 1].toLowerCase().replace(/[^\w'-]/g, "")))) {
    words.pop();
  }
  return words.join(" ").replace(/[.,;:]+$/, "") + "…";
}

/**
 * A clause that fits the cap WHOLE — verbatim, grammatical, no ellipsis.
 *
 * WHY THIS EXISTS. The two existing extractors both fail on a label:
 * `subjectPhrase` strips stopwords and concatenates whatever survives,
 * which on real narration produces "PURCHASES NEVER PROBLEM", "PUT SIDE
 * SIDE", "FORTY NORTH SIXTY FIVE" — not English, and printed at 84px in
 * the middle of a frame. `bestClause` keeps the wording but truncates, so a
 * long sentence becomes "SEVENTY PERCENT OF THE ENTIRE…", which reads as
 * unfinished rather than as a label.
 *
 * A label has to be a whole thought or it should not be drawn. So this only
 * returns a clause that already fits: no cutting, no rewording, no
 * stopword surgery. Returns "" when the sentence has no short clause in it,
 * and callers draw nothing — which text-budget's own header calls a
 * perfectly good answer, and is certainly better than word salad.
 */
export function completeClause(text, maxWords = 6) {
  const limit = Math.min(maxWords, MAX_SUPPORTING_WORDS);
  const candidates = clauses(text)
    .map((c) => c.replace(/[.,;:]+$/, "").trim())
    .filter((c) => {
      const n = c.split(/\s+/).filter(Boolean).length;
      return n >= 3 && n <= limit;
    });
  if (!candidates.length) return "";
  const contentWords = (c) =>
    c.split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w.toLowerCase().replace(/[^\w'-]/g, ""))).length;
  const best = candidates.reduce((a, b) => (contentWords(b) > contentWords(a) ? b : a), candidates[0]);
  return best.toUpperCase();
}

/**
 * The items of a spoken list — "the regulator, the clearing house, the
 * custodian bank and the exchange" — as whole names.
 *
 * entityLabels() below splits on whitespace and keeps distinct words, which
 * tears multi-word names in half. On a rendered RELATIONSHIP frame that put
 * "CLEARING" and "HOUSE" on screen as two separate parties, dropped
 * "exchange" entirely, and left five labels around four nodes. The parties
 * were wrong, not just ugly — the picture asserted something the script did
 * not say.
 *
 * A list is a real grammatical structure and can be read as one: split on
 * commas and the final "and", strip the article each item starts with, and
 * keep what is left whole. Returns [] when the sentence is not a list, and
 * the caller falls back to entityLabels.
 */
export function listEntities(text, max = 5) {
  const t = String(text || "");
  // Needs at least one comma AND a final connective, or it is not a list.
  if (!/,/.test(t) || !/\b(and|or)\b/i.test(t)) return [];
  const upTo = t.split(/\b(?:all|both|each|every|which|that|who)\b/i)[0] || t;
  const items = upTo
    .replace(/\s+(and|or)\s+/gi, ",")
    .split(",")
    .map((p) => p.trim().replace(/^(the|a|an|its|their|his|her|our|your)\s+/i, "").replace(/[.;:]+$/, "").trim())
    .filter((p) => {
      const words = p.split(/\s+/).filter(Boolean);
      return words.length >= 1 && words.length <= 3 && /[a-z]/i.test(p);
    });
  // A single item is not a list, and neither is a sentence that merely
  // happens to contain a comma.
  if (items.length < 3) return [];
  return [...new Set(items.map((p) => p.toUpperCase()))].slice(0, max);
}

/** Distinct content words, for scenes that label several nodes at once. */
export function entityLabels(text, max = 5) {
  const words = String(text || "")
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()));
  return [...new Set(words)].slice(0, max);
}

/**
 * What a NUMBER at `index` is called, taken from the words beside it.
 *
 * COMPARISON draws two figures side by side. When both come from the
 * writer's own `data.series` they arrive with authored labels, but the
 * fallback path — two bare quantities plus comparison language — emitted
 * `label: ""`, so a rendered beat showed "215" next to "13,600" with
 * nothing on screen saying which was which. Muted, that is half a claim:
 * the viewer sees that one is bigger and cannot see what either IS.
 *
 * EXTRACTED, NEVER INVENTED. The label is real words from the same
 * sentence, nearest first, scanning backwards from the number and falling
 * forward only if nothing qualifies behind it — the same discipline every
 * other helper in this module follows. A wrong label is worse than none,
 * because it asserts an identity the script never gave, so when no content
 * word sits within `window` this returns "" and the scene draws no label
 * rather than a guess.
 */
export function labelNearNumber(text, index, { maxWords = 2, window = 6 } = {}) {
  const s = String(text || "");
  if (!Number.isFinite(index) || index < 0) return "";
  const isContent = (w) => w.length > 3 && !STOP.has(w.toLowerCase());
  const tokens = (chunk) => chunk.replace(/[^\w\s'-]/g, " ").split(/\s+/).filter(Boolean);

  const before = tokens(s.slice(0, index)).slice(-window);
  const picked = [];
  for (let i = before.length - 1; i >= 0 && picked.length < maxWords; i--) {
    if (isContent(before[i])) picked.unshift(before[i]);
  }
  if (picked.length) return picked.join(" ").toUpperCase();

  // Nothing behind it — look just ahead, skipping the number's own token
  // and any unit that trails it ("$215 question" -> QUESTION).
  const after = tokens(s.slice(index)).slice(0, window);
  for (const w of after) {
    if (/^\d/.test(w)) continue;
    if (isContent(w)) return w.toUpperCase();
  }
  return "";
}

/** How many words a phrase or label set puts on screen. */
export function wordsIn(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.reduce((a, v) => a + wordsIn(v), 0);
  return String(value).trim().split(/\s+/).filter(Boolean).length;
}
