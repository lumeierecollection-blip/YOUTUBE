/**
 * Kinetic typography — pure JS (no React, no Remotion), so the layout, the
 * renderer, the planner step and the tests read one set of evaluators.
 *
 * Words are individuals. A phrase is a list of words, each with its own
 * weight, colour role and entrance; each word enters on its own frame, an
 * emphasis word physically grows, and every word keeps a little motion after
 * it lands. Nothing is animated as a block and nothing fades as its primary
 * entrance or exit.
 *
 *   markup      `The <bold>cost</bold> of <accent>borrowing</accent>`
 *               (also <emph>): parseMarkup() -> words with weight / accent / emph
 *   layout      layoutWords(): per-word measured widths (per weight), greedy
 *               wrap, left- or right-aligned lines; positions are relative to
 *               the block
 *   schedule    wordSchedule(): entrance stagger 4-8 frames, every word landed
 *               by 40% of the beat, clean hold to 70%, exit in the last 30%
 *   entrances   ENTRANCES (9), pickEntrances(): deterministic per word, never
 *               the same entrance at the same word position in two beats in a
 *               row, never twice in a row along a line
 *   emphasis    emphasisState(): scale to 1.15 in 4 frames, hold 6, settle to
 *               1.0 in 6; the colour is the accent through that window
 *   numbers     numberMode(): count_up (40% of the beat) / scale_impact /
 *               flip_digits; a year, article or section number never counts
 *
 * Where this stops (stated plainly, CLAUDE.md standing rule):
 *   - the entrance stagger is even across the phrase, not aligned to the
 *     narrator's word timestamps: the phrase must resolve by 40% of the beat,
 *     which is earlier than a long sentence is spoken;
 *   - widths are the measured advance tables (typography.js), kerning ignored.
 */
import { measure, advanceEm, ROLE_HEADLINE, SERIF_FAMILY, numberParts } from "./typography.js";
import { easeOut, easeInOut, backOut, lerp } from "./animations.js";
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));

export const FPS = 30;
export const WEIGHT_REGULAR = 500;
export const WEIGHT_BOLD = 700;

export const ENTRANCES = Object.freeze([
  "slide_in_left", "slide_in_right", "drop_in", "rise_up", "scale_punch", "mask_sweep", "blur_in", "letter_stagger", "rotate_in",
]);
/** Frames each entrance takes to settle (letter_stagger: per letter, plus 0.9 frame per letter of stagger). */
export const ENTRANCE_FRAMES = Object.freeze({
  slide_in_left: 8, slide_in_right: 8, drop_in: 8, rise_up: 8, scale_punch: 8, mask_sweep: 9, blur_in: 10, letter_stagger: 6, rotate_in: 9,
});
export const LETTER_GAP_FRAMES = 0.03 * FPS;   // letters 30 ms apart

export const EMPHASIS = Object.freeze({ scale: 1.15, grow: 4, hold: 6, settle: 6 });

// ── markup ────────────────────────────────────────────────────────────
const TAG = /<(bold|accent|emph)>([\s\S]*?)<\/\1>/gi;
/**
 * `The <bold>cost</bold> of <accent>borrowing</accent>` -> words. bold = weight
 * 700; accent = weight 700 in the channel accent; emph = weight 700, accent,
 * and the word that physically grows. Untagged words are weight 500.
 */
export function parseMarkup(text) {
  const src = String(text ?? "");
  const words = [];
  let last = 0, m;
  const push = (chunk, kind) => {
    for (const t of chunk.split(/\s+/).filter(Boolean)) words.push({ text: t, weight: kind ? WEIGHT_BOLD : WEIGHT_REGULAR, accent: kind === "accent" || kind === "emph", emph: kind === "emph" });
  };
  TAG.lastIndex = 0;
  while ((m = TAG.exec(src))) { push(src.slice(last, m.index), null); push(m[2], m[1].toLowerCase()); last = m.index + m[0].length; }
  push(src.slice(last), null);
  return words;
}
export const stripMarkup = (text) => String(text ?? "").replace(/<\/?(bold|accent|emph)>/gi, "");

const FILLER = new Set(("a an and are as at be but by can did do does for from had has have he her his how i if in is it its me my no not of on or our she so than that the their them then there they this to too up us was we were what when where which who why will with you your all any new now off one out own per").split(" "));
const bare = (w) => String(w).replace(/^[^\p{L}\p{N}$%]+|[^\p{L}\p{N}$%]+$/gu, "").toLowerCase();

/**
 * Words of a headline with their marks. `marks` are the planner's emphasis
 * words (canvas.emphasis_words); a tagged headline keeps its own tags. When
 * neither says anything, the mark is deterministic: the longest content word
 * is the accent word (and the emphasis word); a second content word is bold.
 * A phrase of one or two words carries one accent word.
 */
export function markWords(text, marks = []) {
  const tagged = /<(bold|accent|emph)>/i.test(String(text));
  const words = parseMarkup(text);
  if (tagged || !words.length) return words;
  const want = new Set((marks || []).map(bare).filter(Boolean));
  if (want.size) {
    words.forEach((w) => { if (want.has(bare(w.text))) { w.weight = WEIGHT_BOLD; w.accent = true; w.emph = true; } });
    if (words.some((w) => w.emph)) return words;
  }
  const content = words.map((w, i) => ({ i, len: bare(w.text).length, ok: !FILLER.has(bare(w.text)) && /\p{L}|\d/u.test(w.text) })).filter((x) => x.ok).sort((a, b) => b.len - a.len || a.i - b.i);
  if (!content.length) return words;
  const top = words[content[0].i];
  top.weight = WEIGHT_BOLD; top.accent = true; top.emph = true;
  if (words.length >= 4 && content[1]) words[content[1].i].weight = WEIGHT_BOLD;
  return words;
}

// ── layout ────────────────────────────────────────────────────────────
const tracking = ROLE_HEADLINE.tracking;
const wordW = (t, size, weight, family) => measure(t, size, { family, weight, tracking });
const spaceW = (size, weight, family) => (advanceEm(" ", family, weight) + tracking) * size;

/**
 * Greedy wrap of `words` into lines <= `width`, each word measured at its own
 * weight. Returns { lines: [[wordIndex...]], words: [{...word, w, line, x, y}], width, height }
 * with x relative to the block's left edge (left-aligned lines start at 0,
 * right-aligned lines end at the block's width). Bold words are wider than
 * regular ones, which is why fitting is done on this layout and not on plain text.
 */
export function layoutWords(words, size, width, { align = "left", family = SERIF_FAMILY, lineHeight = ROLE_HEADLINE.lineHeight } = {}) {
  const ws = words.map((w) => ({ ...w, w: wordW(w.text, size, w.weight, family) }));
  const sp = spaceW(size, WEIGHT_REGULAR, family);
  const lines = [];
  let cur = [], curW = 0;
  ws.forEach((w, i) => {
    const add = cur.length ? sp + w.w : w.w;
    if (cur.length && curW + add > width) { lines.push(cur); cur = [i]; curW = w.w; } else { cur.push(i); curW += add; }
  });
  if (cur.length) lines.push(cur);
  const lineW = (ln) => ln.reduce((a, i, k) => a + ws[i].w + (k ? sp : 0), 0);
  const blockW = Math.max(0, ...lines.map(lineW));
  const lh = size * lineHeight;
  lines.forEach((ln, li) => {
    let x = align === "right" ? blockW - lineW(ln) : 0;
    ln.forEach((i) => { ws[i].line = li; ws[i].x = x; ws[i].y = li * lh; x += ws[i].w + sp; });
  });
  return { lines, words: ws, width: blockW, height: lines.length * lh, space: sp, lineHeight: lh, size };
}

/** The largest size (step 4) in [min, max] whose layout fits `width`, `maxLines` and `maxHeight`, with no word wider than `width`. */
export function fitWords(words, width, { maxLines = 5, maxHeight = Infinity, max = 260, min = 88, align = "left", family = SERIF_FAMILY } = {}) {
  for (let s = max; s >= min; s -= 4) {
    if (words.some((w) => wordW(w.text, s, w.weight, family) > width)) continue;
    const L = layoutWords(words, s, width, { align, family });
    if (L.lines.length <= maxLines && L.height <= maxHeight) return L;
  }
  return layoutWords(words, min, width, { align, family });
}

// ── entrances ─────────────────────────────────────────────────────────
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export { hash as kineticHash };

/**
 * One entrance per word, deterministic in (seed, beat, position). Constraints:
 * never the same as the word before it on this beat, and never the same as the
 * entrance this word POSITION had in the previous beat (`prev`, an array).
 * `history[i]` lists what position i has had earlier in the video; those are
 * avoided while an unused entrance is left (9 entrances, so a video of more
 * beats than that reuses only after every one has been seen at that position).
 */
export function pickEntrances(n, { seed = "", beat = 0, prev = [], history = [] } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const start = hash(`${seed}|${beat}|${i}`) % ENTRANCES.length;
    const used = history[i] || [];
    // Prefer an entrance this position has not had in the video; when it has had them all, only the hard rules apply.
    for (const strict of [true, false]) {
      let pick = null;
      for (let k = 0; k < ENTRANCES.length && !pick; k++) {
        const e = ENTRANCES[(start + k) % ENTRANCES.length];
        if (e !== out[i - 1] && e !== prev[i] && !(strict && used.includes(e))) pick = e;
      }
      if (pick) { out.push(pick); break; }
      if (!strict) out.push(ENTRANCES[start]);
    }
  }
  return out;
}

/**
 * A word's entrance at `f` frames after its start: { dx, dy, s, rot, blur, o, reveal }.
 * `reveal` (0..1) is a left-to-right mask (mask_sweep); `o` is a 3-frame
 * coverage ramp on the moving entrances, so a word never pops at full size mid
 * -stroke: motion, not a fade, is the entrance. letter_stagger is per letter:
 * pass `letter` (index) and `letters` (count).
 */
export function wordEntrance(name, f, { letter = 0 } = {}) {
  const d = ENTRANCE_FRAMES[name] ?? 8;
  const st = { dx: 0, dy: 0, s: 1, rot: 0, blur: 0, o: 1, reveal: 1 };
  if (name === "letter_stagger") f = f - letter * LETTER_GAP_FRAMES;
  if (f <= 0) return { ...st, o: 0, reveal: 0 };
  const p = clamp01(f / d), e = easeOut(p), ramp = clamp01(f / 3);
  switch (name) {
    case "slide_in_left": return { ...st, dx: -40 * (1 - e), o: ramp };
    case "slide_in_right": return { ...st, dx: 40 * (1 - e), o: ramp };
    case "drop_in": return { ...st, dy: p < 0.7 ? lerp(-30, 2, easeOut(p / 0.7)) : lerp(2, 0, easeInOut((p - 0.7) / 0.3)), o: ramp };
    case "rise_up": return { ...st, dy: 20 * (1 - e), o: ramp };
    case "scale_punch": return { ...st, s: p < 0.6 ? lerp(0.8, 1.06, easeOut(p / 0.6)) : lerp(1.06, 1, easeInOut((p - 0.6) / 0.4)), o: ramp };
    case "mask_sweep": return { ...st, reveal: easeInOut(p), dx: -8 * (1 - e) };
    case "blur_in": return { ...st, blur: 10 * (1 - e), o: clamp01(f / 4) };
    case "letter_stagger": return { ...st, dy: 14 * (1 - e), o: ramp };
    case "rotate_in": return { ...st, rot: -6 * (1 - e), dy: 6 * (1 - e), o: ramp };
    default: return st;
  }
}
/** Frames a word's whole entrance takes (letter_stagger: the last letter's). */
export const entranceFrames = (name, letters = 1) => (name === "letter_stagger" ? ENTRANCE_FRAMES[name] + Math.max(0, letters - 1) * LETTER_GAP_FRAMES : ENTRANCE_FRAMES[name] ?? 8);

// ── emphasis ──────────────────────────────────────────────────────────
/** Frames after the word lands: grow to 1.15 (4), hold (6), settle to 1.0 (6). `accent` is the colour mix 0..1 (1 through the window, easing back on settle). */
export function emphasisState(f) {
  const { scale, grow, hold, settle } = EMPHASIS;
  if (f <= 0) return { s: 1, accent: 0 };
  if (f < grow) { const p = easeOut(f / grow); return { s: lerp(1, scale, p), accent: p }; }
  if (f < grow + hold) return { s: scale, accent: 1 };
  if (f < grow + hold + settle) { const p = easeInOut((f - grow - hold) / settle); return { s: lerp(scale, 1, p), accent: 1 - p }; }
  return { s: 1, accent: 0 };
}
export const EMPHASIS_FRAMES = EMPHASIS.grow + EMPHASIS.hold + EMPHASIS.settle;

// ── micro-motion ──────────────────────────────────────────────────────
/** After landing: a 0.5% scale pulse and a 1 px drift, per-word phase, so no word sits frozen. */
export function microMotion(f, i = 0) {
  const t = f / FPS, ph = i * 1.7;
  return { s: 1 + 0.005 * Math.sin(t * 2.1 + ph), dx: Math.sin(t * 1.3 + ph) * 0.5, dy: Math.sin(t * 1.7 + ph * 0.6) * 1 };
}

// ── timing ────────────────────────────────────────────────────────────
/**
 * Frames (from the beat's start) for each of `n` words. Entrances stagger
 * 4-8 frames; every word has landed by 40% of the beat (`resolveBy`); the
 * phrase holds clean to 70%; each word then exits masked, 3 frames apart, so
 * the last one is gone by the beat's end. `start` is the beat-relative frame
 * of the first word (a second element starts later); `span` bounds the phrase
 * (default 0.4 of the beat). When 4 frames apart would overrun the span the
 * stagger tightens to fit — that is reported as `tight` (an honest limit, not
 * a silent one).
 */
export function wordSchedule(n, dur, { start = 0, resolveBy = 0.4, entrance = 8, exitAt = 0.7, exitFrames = 8 } = {}) {
  const lastLand = Math.max(start, dur * resolveBy - entrance);
  const room = n > 1 ? (lastLand - start) / (n - 1) : 0;
  const stagger = n > 1 ? Math.max(1, Math.min(8, room)) : 0;
  const tight = n > 1 && room < 4;
  const enter = Array.from({ length: n }, (_, i) => start + i * stagger);
  // spread over the last stretch so the LAST word is gone exactly at the beat's end (never an empty tail)
  const es = Math.min(8, Math.max(0, (dur * (1 - exitAt) - exitFrames - 1) / Math.max(1, n - 1)));
  const exit = Array.from({ length: n }, (_, i) => dur * exitAt + i * es);
  return { enter, exit, stagger, tight, exitFrames };
}
/** Masked exit at `f` frames after the word's exit start: the word rises out of its line box under a clip. */
export function wordExit(f, frames = 8) {
  if (f <= 0) return { dy: 0, clip: 0 };
  const p = easeInOut(clamp01(f / frames));
  return { dy: -p * 0.55, clip: p };     // dy in line heights; clip = fraction of the word's height cut from the bottom
}

// ── numbers ───────────────────────────────────────────────────────────
export const NUMBER_MODES = Object.freeze(["count_up", "scale_impact", "flip_digits"]);
/**
 * How a number enters. A year, article or section number, or an identifier
 * ("357-A", "Section 12") is a label, not a quantity: it never counts and never
 * rolls — it lands with scale_impact. A quantity picks by beat, deterministically.
 */
export function numberMode(value, { beat = 0, seed = "", prev = null } = {}) {
  const p = numberParts(value);
  const s = String(value ?? "");
  if (!p.isQuantity || /\b(section|article|rule|title|chapter|§)\b/i.test(s)) return "scale_impact";
  const start = hash(`${seed}|n|${beat}`) % NUMBER_MODES.length;
  for (let k = 0; k < NUMBER_MODES.length; k++) { const m = NUMBER_MODES[(start + k) % NUMBER_MODES.length]; if (m !== prev) return m; }
  return NUMBER_MODES[start];
}
/** scale_impact: 0.6 -> overshoot 1.4 -> 1.0 over p in 0..1. */
export function scaleImpact(p) {
  p = clamp01(p);
  return p < 0.45 ? lerp(0.6, 1.4, easeOut(p / 0.45)) : lerp(1.4, 1, easeInOut((p - 0.45) / 0.55));
}
/** count_up progress: 0 -> 1 across the first 40% of the beat. */
export const countProgress = (f, dur, at = 0) => easeOut(clamp01((f - at) / Math.max(1, dur * 0.4 - at)));

/**
 * Number sizing for the kinetic scale: as large as the frame allows, digits
 * NEVER cropped (a cropped digit misstates the figure — CLAUDE.md hard rule),
 * the trailing unit ("%", "M", "B", a post-fix) allowed to run off the frame
 * edge by up to half its own width.
 * `slotsAt(size)` -> { slots, width } (typography.numberSlots).
 */
export function fitNumberBleed(slotsAt, frameW = 984, { max = 1000, min = 200 } = {}) {
  for (let s = max; s >= min; s -= 4) {
    const { slots, width } = slotsAt(s);
    const tail = slots.filter((x) => x.kind === "suffix" || x.kind === "percent" || x.kind === "post");
    const tailW = tail.reduce((a, x) => a + x.w, 0);
    const solid = width - tailW;
    if (solid <= frameW && width <= frameW + tailW * 0.5) return { size: s, bleed: Math.max(0, Math.round(width - frameW)), width };
  }
  return { size: min, bleed: 0, width: slotsAt(min).width };
}
export { easeOut, easeInOut, backOut };
