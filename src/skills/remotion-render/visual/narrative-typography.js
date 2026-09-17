/**
 * NARRATIVE TYPOGRAPHY — the single source of truth for on-screen text.
 *
 * Plain .js, no JSX, no deps: the Remotion bundle imports it (like
 * palette-roles.js), AND the node-side scripts (gemini-visual-plan.js,
 * local-visual-auditor.js) import it directly. One module so the planner,
 * the renderer and the auditor cannot drift apart.
 *
 * THE DISTINCTION THIS MODULE ENFORCES
 *
 *   NARRATIVE TYPOGRAPHY (what we want)   HEADLINE TYPOGRAPHY (prohibited)
 *   - one short line                      - section/article/topic titles
 *   - centred in the safe area            - title + subtitle structures
 *   - 2-7 words, ONE thought              - explanatory headings
 *   - emphasises the narration            - "The Problem" / "The Psychology
 *   - selective, not every beat             Behind It" / topic labels
 *   - works ALONGSIDE the visual          - summarises the whole beat
 *
 * The narrator explains. The visual demonstrates. The typography emphasises.
 * Those three layers must not repeat each other — so typography is never the
 * narration verbatim (no subtitles), never a transcript, and never the
 * fallback for a beat nobody could think of a visual for.
 *
 * WHAT IS DETERMINISTIC HERE vs WHAT GEMINI JUDGES
 *
 * This module only decides things that can be MEASURED: word count, line
 * count, character budget, whether the phrase is the narration restated,
 * and a conservative set of unambiguous headline/label forms. Whether a
 * phrase is a GOOD piece of narrative emphasis is a semantic judgment and
 * stays with Gemini (plan-time direction + post-render review). Being
 * conservative here is deliberate: a false "headline" flag on a good phrase
 * would be worse than letting Gemini catch a mediocre one.
 */

/* ── Budgets ─────────────────────────────────────────────────────────── */

/** Preferred upper bound. 2-7 words is the narrative-typography target. */
export const TYPO_TARGET_MAX_WORDS = 7;
/** 8-9 is unusual but allowed; beyond this the phrase is not emphasis. */
export const TYPO_HARD_MAX_WORDS = 9;
/** A single line at a readable size cannot carry more glyphs than this. */
export const TYPO_MAX_CHARS = 48;
/** Below this the text is no longer emphasis, it is fine print. Condense instead. */
export const TYPO_MIN_READABLE_PX = 34;
/** Never larger than this, however few words. */
export const TYPO_MAX_PX = 132;
/** Fraction of the safe width a single line may occupy. */
export const TYPO_SAFE_WIDTH_FRACTION = 0.86;
/** Line-height used when fitting a single line into the safe height. */
export const TYPO_LINE_HEIGHT = 1.18;

/** The narrative moments typography is allowed to serve. */
export const TYPO_MOMENTS = ["hook", "re_hook", "key_fact", "contradiction", "question", "statement"];

/**
 * Share of beats that may carry on-screen text before the video reads as a
 * text-forward slideshow rather than visual storytelling.
 */
export const TYPO_MAX_BEAT_SHARE = 0.4;

/* ── Word handling ───────────────────────────────────────────────────── */

/** Tokens that are pure punctuation (an em dash between clauses) are not words. */
const PUNCT_ONLY = /^[^\p{L}\p{N}$%]+$/u;

export function words(phrase) {
  return String(phrase || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !PUNCT_ONLY.test(w));
}

export function wordCount(phrase) {
  return words(phrase).length;
}

/** Collapse any newline/tab into a single space — typography is ONE line. */
export function toSingleLine(phrase) {
  return String(phrase || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Character-width estimate in em units. Shared with the renderer so the
 * planner/auditor can predict the rendered width without rendering.
 */
const WIDE = new Set("MWQ@%".split(""));
const NARROW = new Set("IJ1.,';:!|-".split(""));
export function estimateEmWidth(s) {
  return [...String(s)].reduce((w, c) => w + (WIDE.has(c) ? 0.88 : NARROW.has(c) ? 0.3 : 0.62), 0);
}

/* ── Headline / subtitle detection (conservative, unambiguous only) ──── */

/**
 * Exact topic-label phrases the direction explicitly prohibits. Matched on
 * the whole normalised phrase, so "Do I need it?" is never caught by them.
 */
const LABEL_PHRASES = new Set([
  "the problem", "the solution", "the hidden cost", "why this happens",
  "the psychology behind it", "financial mistakes", "consumer behavior",
  "consumer behaviour", "the shocking truth", "the real reason",
  "the bottom line", "key takeaways", "the takeaway", "what happened",
  "the breakdown", "the analysis", "the overview", "the basics",
]);

/** Openers that begin an article/section title rather than a spoken thought. */
const HEADLINE_OPENERS = /^the\s+(hidden|shocking|real|surprising|untold|dark|true|complete|ultimate|psychology|problem|solution|truth|cost|reason|answer|breakdown|analysis|overview|basics|science)\b/i;

/** Nouns that mark a topic label rather than narrative emphasis. */
const TOPIC_NOUNS = /\b(psychology|behaviou?r|mistakes|strategies|fundamentals|basics|overview|breakdown|analysis|guide|explained|implications|considerations|methodology)\b/i;

/**
 * Does the phrase contain a predicate — something being asked, asserted or
 * done? Narrative emphasis almost always does ("You barely notice it.",
 * "Do I need it?"); a topic label almost never does ("Consumer Behavior").
 */
const PREDICATE = /\b(is|are|was|were|am|be|been|do|does|did|don|doesn|didn|can|cant|cannot|could|will|wont|would|should|must|has|have|had|keep|keeps|kept|need|needs|want|wants|notice|notices|realise|realize|realizes|happen|happens|happening|pay|pays|paying|spend|spends|spending|lose|loses|losing|cost|costs|ask|asks|think|thinks|see|sees|know|knows|get|gets|go|goes|goes|become|becomes|make|makes|take|takes|add|adds|adds|drain|drains|vanish|vanishes|stop|stops|start|starts|call|calls|say|says|tell|tells|leave|leaves|grow|grows|shrink|shrinks|break|breaks|hide|hides|show|shows)\b/i;

function hasPredicate(phrase) {
  const p = String(phrase || "");
  if (/[?!]/.test(p)) return true;              // a question or exclamation is a spoken act
  if (/\p{L}'\p{L}|n't\b/iu.test(p)) return true; // contraction => spoken register
  if (PREDICATE.test(p.toLowerCase().replace(/['’]/g, ""))) return true;
  return false;
}

function normaliseForMatch(phrase) {
  return toSingleLine(phrase).toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim();
}

/**
 * TRUE only for phrases that are unambiguously headline/topic-label shaped.
 * Deliberately narrow — semantic nuance is Gemini's job.
 */
export function isHeadlineLike(phrase) {
  const norm = normaliseForMatch(phrase);
  if (!norm) return false;
  if (LABEL_PHRASES.has(norm)) return true;
  const n = wordCount(norm);
  // A title-style opener with no predicate is a heading, not a spoken thought.
  if (HEADLINE_OPENERS.test(norm) && !hasPredicate(norm)) return true;
  // A multi-word topic-noun phrase with no predicate is a section label.
  if (n >= 2 && TOPIC_NOUNS.test(norm) && !hasPredicate(norm)) return true;
  return false;
}

/**
 * Is the phrase the narration restated — i.e. a subtitle? Two signals:
 * it is simply too long to be emphasis, or it reproduces the spoken line.
 */
export function isTranscriptLike(phrase, narration) {
  const n = wordCount(phrase);
  if (n > TYPO_HARD_MAX_WORDS) return true;
  if (!narration) return false;
  const pTokens = words(normaliseForMatch(phrase)).map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""));
  const nTokens = new Set(words(normaliseForMatch(narration)).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")));
  if (pTokens.length < 4) return false;
  const overlap = pTokens.filter((t) => t && nTokens.has(t)).length / pTokens.length;
  return overlap >= 0.85;
}

/* ── Condensing (rewrite, never shrink-to-tiny) ──────────────────────── */

/**
 * Reduce a phrase to a single narrative line within the word budget.
 *
 * A phrase already inside budget is returned UNCHANGED — this must never
 * mangle a good short phrase like "Need it — or want it?" by splitting on
 * its em dash. Only over-budget text gets cut, preferring the first clause
 * and then a hard word cap.
 */
export function condenseToPhrase(text, maxWords = TYPO_TARGET_MAX_WORDS) {
  const line = toSingleLine(text);
  if (!line) return "";
  if (wordCount(line) <= maxWords && line.length <= TYPO_MAX_CHARS) return line;

  // Prefer the first clause, but only cut on separators that actually end a
  // thought — not on a hyphen inside a word.
  const clause = line.split(/\s+[—–-]\s+|[,;:]\s+/)[0].trim() || line;
  let out = clause;
  if (wordCount(out) > maxWords) out = words(out).slice(0, maxWords).join(" ");
  // A trailing period on a 3-word emphasis line reads like a sentence
  // fragment; question/exclamation marks carry meaning and are kept.
  return out.replace(/[.,;:]+$/, "").trim();
}

/* ── Validation ──────────────────────────────────────────────────────── */

/**
 * Validate a directed typography phrase. Returns the normalised single-line
 * phrase plus machine-checkable reasons it violates the direction.
 *   ok:false + normalized  => caller may use `normalized` (condensed) instead
 */
export function validateNarrativePhrase(phrase, { narration = null } = {}) {
  const reasons = [];
  const line = toSingleLine(phrase);
  if (!line) return { ok: false, normalized: "", reasons: ["empty phrase"] };

  if (/[\r\n]/.test(String(phrase || ""))) reasons.push("multi-line phrase (typography must be ONE line)");
  const n = wordCount(line);
  if (n > TYPO_HARD_MAX_WORDS) reasons.push(`${n} words exceeds the ${TYPO_HARD_MAX_WORDS}-word hard cap — this is narration, not emphasis`);
  else if (n > TYPO_TARGET_MAX_WORDS) reasons.push(`${n} words is above the ${TYPO_TARGET_MAX_WORDS}-word target (allowed but unusual)`);
  if (line.length > TYPO_MAX_CHARS) reasons.push(`${line.length} characters exceeds the ${TYPO_MAX_CHARS}-char single-line budget`);
  if (isHeadlineLike(line)) reasons.push("reads as a headline/topic label, not narrative emphasis");
  if (isTranscriptLike(line, narration)) reasons.push("reads as a transcript/subtitle of the narration");

  // Only the soft word-count note is non-blocking.
  const blocking = reasons.filter((r) => !r.includes("above the"));
  return { ok: blocking.length === 0, normalized: condenseToPhrase(line), reasons };
}

/* ── Single-line fitting (the renderer's guarantee) ──────────────────── */

/**
 * Fit a phrase onto EXACTLY ONE line inside (maxW x maxH).
 *
 * Fit always wins: the returned size can never make the line wider than
 * maxW, so it cannot overflow or wrap. And rather than shrinking text into
 * illegibility, once the size would drop below TYPO_MIN_READABLE_PX the
 * PHRASE is condensed (words dropped) and re-fitted — the direction's
 * "condense/rewrite rather than shrink until tiny" rule, in code.
 */
export function fitSingleLine(phrase, maxW, maxH) {
  let text = toSingleLine(phrase);
  if (!text) return { text: "", size: 0, condensed: false, lines: 1 };
  const original = text;
  const ceiling = Math.min(TYPO_MAX_PX, maxH / TYPO_LINE_HEIGHT);

  const sizeFor = (t) => Math.min(ceiling, maxW / Math.max(0.5, estimateEmWidth(t)));

  let size = sizeFor(text);
  // Drop the last word until the line is readable, down to 2 words.
  while (size < TYPO_MIN_READABLE_PX && wordCount(text) > 2) {
    text = words(text).slice(0, wordCount(text) - 1).join(" ").replace(/[.,;:—–-]+$/, "").trim();
    size = sizeFor(text);
  }
  // Even at 2 words it may not reach the readable floor (very long words):
  // accept the fitting size — never a size that would overflow maxW.
  return { text, size, condensed: text !== original, lines: 1 };
}
