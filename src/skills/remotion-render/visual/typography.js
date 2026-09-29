/**
 * The type system — editorial serif / sans (owner's typography rebuild,
 * 2026-09-29). TWO families, no third:
 *
 *   Fraunces (variable, optical-size axis 9..144)  headlines, hero numbers,
 *                                                  the emphasis word
 *   Inter    (variable, 400..800)                  data labels, small
 *                                                  figures, the caption
 *
 * Every text element on screen is one of four roles. A role fixes the
 * family, weight band, size band, line height, tracking, case and the
 * animation it moves with (full-canvas.jsx reads `motion`):
 *
 *   ROLE_HEADLINE  Fraunces 500-700, 160-260 px, sentence case, never all-caps
 *   ROLE_NUMBER    Fraunces (>= 100 px) / Inter (< 100 px), 260-420 px, hero
 *   ROLE_DATA      Inter 500-700, 24-48 px, UPPERCASE labels / sentence values
 *   ROLE_EMPHASIS  Fraunces 700, ONE word at 400-600 px, at most one a video
 *
 * Where this stops (each is a deliberate departure from the brief, and why):
 *   - Headline size: 160-260 px holds for a short headline. A 5-word headline
 *     cannot be 160 px in 1000 px of width, so the size steps down to
 *     HEADLINE_FLOOR (88 px) — the band is where the text allows it, not a
 *     promise for every string. fitHeadline() reports which it got.
 *   - Emphasis: a 6-letter word at 500 px is wider than the frame, so the
 *     size is the largest that fits the frame's width (never below
 *     EMPHASIS_FLOOR), and a word longer than EMPHASIS_MAX_CHARS is not an
 *     emphasis word at all.
 *   - Numerals: Fraunces is proportional-only (no tnum feature — measured,
 *     scripts/gen-type-metrics.py), so counting digits are laid out in slots
 *     at the FINAL number's own widths (numberSlots()): the layout does not
 *     move while the value counts up.
 *   - Widths come from the fonts' measured advance tables (type-metrics.js),
 *     kerning ignored (it only tightens), plus a 3% margin.
 */
import { TYPE_METRICS } from "./type-metrics.js";

export const SERIF_FAMILY = "Fraunces";
export const SANS_FAMILY = "Inter";
export const SERIF = `${SERIF_FAMILY}, Georgia, serif`;
export const SANS_STACK = `${SANS_FAMILY}, Helvetica, Arial, sans-serif`;

export const HEADLINE_FLOOR = 88;
export const EMPHASIS_FLOOR = 240;
export const EMPHASIS_MAX_CHARS = 7;
const MARGIN = 1.03;

// motion: the animation family the renderer applies (never "fade").
export const ROLE_HEADLINE = Object.freeze({
  role: "headline", family: SERIF_FAMILY, weight: 600, weights: [500, 700], sizeBand: [160, 260], lineHeight: 0.95, tracking: -0.02,
  caseMode: "sentence", motions: ["mask-reveal", "slide-land", "crop-open"],
});
export const ROLE_NUMBER = Object.freeze({
  role: "number", family: SERIF_FAMILY, familySmall: SANS_FAMILY, largeFrom: 100, weight: 700, weights: [600, 700], smallWeights: [600, 800],
  sizeBand: [260, 420], lineHeight: 0.9, tracking: -0.04, caseMode: "as-is", motions: ["count-up", "snap"],
});
export const ROLE_DATA = Object.freeze({
  role: "data", family: SANS_FAMILY, weight: 600, weights: [500, 700], sizeBand: [24, 48], lineHeight: 1.1, tracking: 0.01,
  labelCase: "upper", valueCase: "sentence", motions: ["settle"],
});
export const ROLE_EMPHASIS = Object.freeze({
  role: "emphasis", family: SERIF_FAMILY, weight: 700, sizeBand: [400, 600], lineHeight: 0.9, tracking: -0.03, caseMode: "sentence", motions: ["explode"],
});
export const ROLES = Object.freeze({ headline: ROLE_HEADLINE, number: ROLE_NUMBER, data: ROLE_DATA, emphasis: ROLE_EMPHASIS });

/** The family a number of `size` px is set in (Fraunces from 100 px up). */
export const numberFamily = (size) => (size >= ROLE_NUMBER.largeFrom ? ROLE_NUMBER.family : ROLE_NUMBER.familySmall);
/** CSS font shorthand for a role. `size` in px. */
export function roleFont(role, size, weight = role.weight, italic = false) {
  const fam = role === ROLE_NUMBER ? numberFamily(size) : role.family;
  const stack = fam === SERIF_FAMILY ? SERIF : SANS_STACK;
  return `${italic ? "italic " : ""}${weight} ${size}px ${stack}`;
}
/** Letter spacing in px for a role at `size`. */
export const roleTracking = (role, size) => +(role.tracking * size).toFixed(2);

// ── measured widths ───────────────────────────────────────────────────
const nearestWeight = (table, weight) => {
  const ks = Object.keys(table).filter((k) => /^\d+$/.test(k)).map(Number);
  return ks.reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a));
};
/** Advance width of one character in em, for a family at a weight. */
export function advanceEm(ch, family = SERIF_FAMILY, weight = 600) {
  const fam = TYPE_METRICS[family === SANS_FAMILY ? "inter" : "fraunces"];
  const t = fam[String(nearestWeight(fam, weight))];
  if (ch === " ") return t[" "] ?? 0.25;
  return t[ch] ?? t["n"] ?? 0.55;
}
/** Estimated width of `text` at `size` px (measured advances, +3% margin, tracking included). */
export function measure(text, size, { family = SERIF_FAMILY, weight = 600, tracking = 0 } = {}) {
  let w = 0;
  const s = String(text ?? "");
  for (const ch of s) w += advanceEm(ch, family, weight) * size + tracking * size;
  return w * MARGIN;
}
export const capHeightEm = (family) => TYPE_METRICS[family === SANS_FAMILY ? "inter" : "fraunces"].capHeight;

function wrapWords(words, size, width, o) {
  const lines = [];
  let cur = [];
  for (const w of words) {
    const next = [...cur, w].join(" ");
    if (cur.length && measure(next, size, o) > width) { lines.push(cur.join(" ")); cur = [w]; } else cur.push(w);
  }
  if (cur.length) lines.push(cur.join(" "));
  return lines;
}
/**
 * The largest headline size (step 4) that wraps into <= maxLines lines of
 * `width` with no word overflowing. Starts at the band's top (260) and steps
 * down to HEADLINE_FLOOR. `inBand` says whether the 160-260 band was kept.
 */
export function fitHeadline(text, width, { maxLines = 4, maxHeight = Infinity, role = ROLE_HEADLINE, max = role.sizeBand[1], min = HEADLINE_FLOOR } = {}) {
  const o = { family: role.family, weight: role.weight, tracking: role.tracking };
  const words = String(text || "").split(/\s+/).filter(Boolean);
  for (let s = max; s >= min; s -= 4) {
    if (words.some((w) => measure(w, s, o) > width)) continue;
    const lines = wrapWords(words, s, width, o);
    if (lines.length <= maxLines && lines.length * s * role.lineHeight <= maxHeight) return { size: s, lines, inBand: s >= role.sizeBand[0] };
  }
  return { size: min, lines: wrapWords(words, min, width, o), inBand: min >= role.sizeBand[0] };
}

// ── sentence case ─────────────────────────────────────────────────────
// Headlines are sentence case. The planner's headlines arrive in whatever
// case the model chose (often ALL CAPS: the old system uppercased them), so
// the case is rebuilt from the narration itself: a word keeps the casing it
// has in the sentence when that is an acronym or a proper noun ("SEC",
// "Ponzi", "Miami"); anything else is lower-cased; the first letter is
// capitalised. Nothing is invented — every character is the planner's, only
// its case changes.
const COMMON = new Set(("a an and are as at be but by can did do for from had has have he her his how i if in is it its me my no not of on or our she so than that the their them then there they this to too up us was we were what when where which who why will with you your all any new now off one out own per see two way").split(" "));
const stripPunct = (w) => w.replace(/^[^\p{L}\p{N}$%]+|[^\p{L}\p{N}$%]+$/gu, "");
function sourceCasing(source) {
  const map = new Map();
  const toks = String(source || "").split(/\s+/).filter(Boolean);
  toks.forEach((raw, i) => {
    const w = stripPunct(raw);
    if (!w || !/\p{L}/u.test(w)) return;
    const startsSentence = i === 0 || /[.!?]["')\]]*$/.test(toks[i - 1]);
    const acronym = w.length >= 2 && w === w.toUpperCase() && /^[\p{Lu}0-9&.-]+$/u.test(w);
    const proper = /^\p{Lu}/u.test(w) && !startsSentence;
    const mixed = /\p{Ll}\p{Lu}/u.test(w);   // iPhone, McKinsey
    if (acronym || proper || mixed) map.set(w.toLowerCase(), w);
  });
  return map;
}
export function sentenceCase(text, source = "") {
  const s = String(text ?? "").trim();
  if (!s) return s;
  const letters = s.replace(/[^\p{L}]/gu, "");
  const allCaps = letters.length > 0 && letters === letters.toUpperCase();
  const map = sourceCasing(source), hasSource = !!String(source || "").trim();
  const out = s.split(/(\s+)/).map((tok) => {
    if (/^\s+$/.test(tok) || !tok) return tok;
    const core = stripPunct(tok);
    if (!core || !/\p{L}/u.test(core)) return tok;
    const lead = tok.slice(0, tok.indexOf(core)), tail = tok.slice(tok.indexOf(core) + core.length);
    const key = core.toLowerCase();
    let word;
    if (map.has(key)) word = map.get(key);
    // No source to consult: a short non-word in an all-caps headline is an acronym.
    else if (allCaps) word = !hasSource && core.length >= 2 && core.length <= 4 && !COMMON.has(key) && /^[A-Z&]+$/.test(core) ? core : key;
    else word = core;
    return lead + word + tail;
  }).join("");
  // Capitalise the first character when it is a letter ("$127 million ..."
  // starts with a figure: nothing to capitalise).
  const i = out.search(/[\p{L}\p{N}]/u);
  return i < 0 || !/\p{L}/u.test(out[i]) ? out : out.slice(0, i) + out[i].toUpperCase() + out.slice(i + 1);
}

// ── numbers ───────────────────────────────────────────────────────────
const SCALE_LETTERS = { k: "K", m: "M", b: "B", bn: "B", mn: "M", t: "T" };
/**
 * A quantity split for the hero-number layout, exactly as the narration
 * states it: "$105M" -> { pre: "$", digits: "105", suffix: "M" };
 * "$127 million" -> { pre: "$", digits: "127", scaleWord: "million" };
 * "34%" -> { digits: "34", percent: true }; "357-A" -> { digits: "357", post: "-A" }.
 * `isQuantity` is false for a year / identifier (the number snaps in).
 */
export function numberParts(value) {
  const s = String(value ?? "").trim();
  const m = s.match(/^(.*?)(\d[\d,]*(?:\.\d+)?)\s*(thousand|million|billion|trillion|bn|mn|k|m|b|t)?\b\s*(%|percent)?(.*)$/i);
  if (!m) return { pre: "", digits: s, suffix: "", scaleWord: "", percent: false, post: "", isQuantity: false, text: s };
  const pre = (m[1] || "").trim(), digits = m[2], scale = (m[3] || ""), percent = !!m[4], post = (m[5] || "").trim();
  const word = /^(thousand|million|billion|trillion)$/i.test(scale) ? scale.toLowerCase() : "";
  const letter = scale && !word ? SCALE_LETTERS[scale.toLowerCase()] || scale.toUpperCase() : "";
  const year = /^(1[0-9]{3}|20[0-9]{2})$/.test(digits) && !pre && !percent && !scale;
  const identifier = /^[-–]?[A-Za-z]/.test(post) || /^[A-Za-z]{1,2}$/.test(post);
  return { pre, digits, suffix: letter, scaleWord: word, percent, post, isQuantity: !year && !identifier, text: s };
}
export const SUPERSCRIPT_SCALE = 0.5;   // "$" at 0.5x the numeral, raised to its cap height
export const SUFFIX_SCALE = 0.59;       // "M" / "B" / "K": $105M -> 130 / 340 / 200 px
export const PERCENT_SCALE = 0.8;       // "%": never larger than the numeral

/**
 * Slot layout of a number of `size` px: one slot per character of the FINAL
 * string, at that character's own advance — so a counting number never moves.
 * Returns { slots: [{ch, x, w, kind}], width } where kind is digit | sep |
 * pre | suffix | percent, x measured from the number's left edge.
 */
export function numberSlots(parts, size, { weight = 700 } = {}) {
  const fam = numberFamily(size);
  const adv = (ch, sz) => advanceEm(ch, fam, weight) * sz * MARGIN;
  const slots = [];
  let x = 0;
  const push = (ch, sz, kind) => { const w = adv(ch, sz) + ROLE_NUMBER.tracking * sz; slots.push({ ch, x, w, kind, size: sz }); x += w; };
  for (const ch of parts.pre || "") push(ch, size * (ch === "$" || /[€£¥]/.test(ch) ? SUPERSCRIPT_SCALE : 1), "pre");
  for (const ch of parts.digits || "") push(ch, size, /[,.]/.test(ch) ? "sep" : "digit");
  if (parts.suffix) push(parts.suffix, size * SUFFIX_SCALE, "suffix");
  if (parts.percent) push("%", size * PERCENT_SCALE, "percent");
  for (const ch of parts.post || "") push(ch, size * 0.6, "post");
  return { slots, width: x };
}
/** Largest numeral size (step 4) in the number band whose slots fit `width`; below the band only when it must. */
export function fitNumber(parts, width, { max = ROLE_NUMBER.sizeBand[1], min = 120 } = {}) {
  for (let s = max; s >= min; s -= 4) if (numberSlots(parts, s).width <= width) return { size: s, inBand: s >= ROLE_NUMBER.sizeBand[0] };
  return { size: min, inBand: false };
}
/** Emphasis word: the largest size in 240-600 that fits `width`; null when the word is not an emphasis candidate. */
export function fitEmphasis(word, width) {
  const w = stripPunct(String(word || ""));
  if (!w || w.length > EMPHASIS_MAX_CHARS || !/^\p{L}+$/u.test(w)) return null;
  const o = { family: ROLE_EMPHASIS.family, weight: ROLE_EMPHASIS.weight, tracking: ROLE_EMPHASIS.tracking };
  for (let s = ROLE_EMPHASIS.sizeBand[1]; s >= EMPHASIS_FLOOR; s -= 4) if (measure(w, s, o) <= width) return { size: s, inBand: s >= ROLE_EMPHASIS.sizeBand[0] };
  return null;
}

/** ROLE_DATA label text: uppercase for labels, sentence case for values. */
export const dataLabel = (text) => String(text ?? "").toUpperCase();
