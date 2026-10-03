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
 *   schedule    wordSchedule(): each word pops 4-6 frames after the previous,
 *               every word landed by 40% of the beat, clean hold to 70%, exit
 *               in the last 30%
 *   entrances   the POP family only (owner's spec 2026-09-30): text appears IN
 *               PLACE from a smaller scale, a few px low, and settles. Nothing
 *               slides in, drops in, wipes (mask sweep), blurs in, rotates in
 *               or flies across the frame. popEntrances() gives each word its
 *               pop: POP_EMPHASIS on the emphasis word, POP_STANDARD otherwise,
 *               POP_SOFT on kickers / labels, POP_HARD on the hook / CTA, or the
 *               beat's planned POP_LETTER / POP_WORD_STACK
 *   numbers     numberMode(): "pop_roll" (the figure pops 1.3 -> 1.0 over 8
 *               frames, fully formed, then its digit slots roll 0 -> value over
 *               20 frames) or "pop" (a year, article or section number: pops,
 *               never rolls)
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

/**
 * The pop family. Every one appears in place; they differ only in how far
 * the scale travels and how long it takes to settle.
 *   POP_STANDARD   0.92 -> 1.0, y +8 -> 0, 6 frames, ease-out with a slight
 *                  overshoot settling exactly at frame 6 (most words)
 *   POP_EMPHASIS   0.75 -> 1.08 -> 1.0 over 10 frames (the emphasis word)
 *   POP_SOFT       0.95 -> 1.0, 4 frames (kickers, labels, captions)
 *   POP_HARD       0.6 -> 1.15 -> 1.0 over 12 frames (hook and CTA only)
 *   POP_LETTER     each letter pops (POP_STANDARD) 30 ms after the previous;
 *                  at most one beat a video
 *   POP_WORD_STACK each word pops (POP_STANDARD) one row above the previous,
 *                  then the stack settles into the laid-out line
 */
export const ENTRANCES = Object.freeze(["POP_STANDARD", "POP_EMPHASIS", "POP_SOFT", "POP_HARD", "POP_LETTER", "POP_WORD_STACK"]);
const POP = Object.freeze({
  POP_STANDARD: { from: 0.92, peak: null, frames: 6, dy: 8 },
  POP_EMPHASIS: { from: 0.75, peak: 1.08, frames: 10, dy: 8 },
  POP_SOFT: { from: 0.95, peak: null, frames: 4, dy: 5 },
  POP_HARD: { from: 0.6, peak: 1.15, frames: 12, dy: 8 },
  NUMBER: { from: 1.3, peak: null, frames: 8, dy: 0 },
});
/** Frames each entrance takes to settle (POP_LETTER: per letter, plus 0.9 frame per letter of stagger). */
export const ENTRANCE_FRAMES = Object.freeze({ POP_STANDARD: 6, POP_EMPHASIS: 10, POP_SOFT: 4, POP_HARD: 12, POP_LETTER: 6, POP_WORD_STACK: 6 });
export const LETTER_GAP_FRAMES = 0.03 * FPS;   // letters 30 ms apart
export const NUMBER_POP_FRAMES = POP.NUMBER.frames;
export const NUMBER_ROLL_FRAMES = 20;
/** POP_WORD_STACK: frames the finished stack holds, then takes to settle into the line. */
export const STACK_HOLD = 8, STACK_SETTLE = 12;

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
  if (!words.length) return words;
  // Planner markup is kept — but only when it gives the line a bold word AND
  // an accent word (kinetic-rules requires both; CI run 36956234025 ch-1
  // beat 2 had markup with neither and the video was rejected). Otherwise the
  // automatic marking below completes it.
  if (tagged && words.some((w) => w.weight === WEIGHT_BOLD) && words.some((w) => w.accent || w.emph)) return words;
  const want = new Set((marks || []).map(bare).filter(Boolean));
  if (want.size) {
    words.forEach((w) => { if (want.has(bare(w.text))) { w.weight = WEIGHT_BOLD; w.accent = true; w.emph = true; } });
    if (words.some((w) => w.emph)) return words;
  }
  let content = words.map((w, i) => ({ i, len: bare(w.text).length, ok: !FILLER.has(bare(w.text)) && /\p{L}|\d/u.test(w.text) })).filter((x) => x.ok).sort((a, b) => b.len - a.len || a.i - b.i);
  // All filler words ("it is what it is"): the longest word still carries the emphasis.
  if (!content.length) content = words.map((w, i) => ({ i, len: bare(w.text).length })).filter((x) => x.len > 0).sort((a, b) => b.len - a.len || a.i - b.i);
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
    let x = align === "right" ? blockW - lineW(ln) : align === "center" ? (blockW - lineW(ln)) / 2 : 0;
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
 * One pop per word. `group` is "headline" (a headline or statement) or
 * "label" (a kicker or data label). `style` is the beat's planned entrance
 * (canvas.text_entrance), already checked. `edge` is true on the hook (first
 * beat) and the CTA (last beat).
 *   label words                      POP_SOFT
 *   POP_LETTER / POP_WORD_STACK beat every headline word takes the beat's style
 *   POP_HARD (hook / CTA)            every headline word pops hard
 *   otherwise                        the emphasis word POP_EMPHASIS, the rest the
 *                                    beat's style (POP_STANDARD by default)
 * Deterministic: the same words and style give the same pops.
 */
export function popEntrances(words, { group = "headline", style = null, edge = false } = {}) {
  const st = ENTRANCES.includes(style) ? style : edge ? "POP_HARD" : "POP_STANDARD";
  return words.map((w) => {
    if (group === "label") return "POP_SOFT";
    if (st === "POP_LETTER" || st === "POP_WORD_STACK") return st;
    if (st === "POP_HARD") return edge ? "POP_HARD" : "POP_STANDARD";
    if (w && w.emph) return "POP_EMPHASIS";
    return st;
  });
}

/** An entrance name from an older plan (the nine block entrances) or none: the standard pop. */
export const popName = (name) => (ENTRANCES.includes(name) ? name : "POP_STANDARD");
// Ease-out-back with a small (~3%) overshoot that lands on exactly 1 at t = 1.
const BACK = 0.9;
const backOutSmall = (t) => 1 + (BACK + 1) * Math.pow(t - 1, 3) + BACK * Math.pow(t - 1, 2);

/**
 * The pop `f` frames after it starts: { s, dy, o, done }. Before the start
 * the word has not appeared (o 0). Opacity is full by 45% of the pop, while
 * the scale is still moving — the pop is the entrance, not a fade.
 * "NUMBER" is the hero-number pop (1.3 -> 1.0 over 8 frames).
 */
export function popState(style, f) {
  const P = POP[style] || POP.POP_STANDARD;
  if (!(f > 0)) return { s: P.from, dy: P.dy, o: 0, done: false };
  const t = clamp01(f / P.frames);
  const o = clamp01(t * 2.2);
  let s, prog;
  if (P.peak) {
    const k = 0.55;
    if (t < k) { const e = easeOut(t / k); s = P.from + (P.peak - P.from) * e; prog = e; }
    else { s = P.peak + (1 - P.peak) * easeInOut((t - k) / (1 - k)); prog = 1; }
  } else { prog = backOutSmall(t); s = P.from + (1 - P.from) * prog; }
  if (t >= 1) return { s: 1, dy: 0, o: 1, done: true };
  return { s, dy: P.dy * (1 - prog), o, done: false };
}

/**
 * A word's entrance at `f` frames after its start, in the renderer's shape
 * { dx, dy, s, rot, blur, o, reveal } (dx / rot / blur always 0, reveal
 * always 1: nothing slides, rotates, blurs or wipes). POP_LETTER is per
 * letter: pass `letter` (index).
 */
export function wordEntrance(name, f, { letter = 0 } = {}) {
  const n = popName(name);
  const style = n === "POP_LETTER" || n === "POP_WORD_STACK" ? "POP_STANDARD" : n;
  if (n === "POP_LETTER") f = f - letter * LETTER_GAP_FRAMES;
  const p = popState(style, f);
  return { dx: 0, dy: p.dy, s: p.s, rot: 0, blur: 0, o: p.o, reveal: 1 };
}
/** Frames a word's whole entrance takes (POP_LETTER: the last letter's). */
export const entranceFrames = (name, letters = 1) => (popName(name) === "POP_LETTER" ? ENTRANCE_FRAMES.POP_LETTER + Math.max(0, letters - 1) * LETTER_GAP_FRAMES : ENTRANCE_FRAMES[popName(name)]);

/** POP_WORD_STACK: 0..1 progress of the stack settling into the line, `f` frames after the first word, for `n` words whose last pops at `lastEnter`. */
export function stackSettle(lastEnter, f) {
  return easeInOut(clamp01((f - lastEnter - ENTRANCE_FRAMES.POP_STANDARD - STACK_HOLD) / STACK_SETTLE));
}

// ── micro-motion ──────────────────────────────────────────────────────
/** After landing: a 0.5% scale pulse and a 1 px drift, per-word phase, so no word sits frozen. */
export function microMotion(f, i = 0) {
  const t = f / FPS, ph = i * 1.7;
  return { s: 1 + 0.005 * Math.sin(t * 2.1 + ph), dx: Math.sin(t * 1.3 + ph) * 0.5, dy: Math.sin(t * 1.7 + ph * 0.6) * 1 };
}

// ── timing ────────────────────────────────────────────────────────────
/**
 * Frames (from the beat's start) for each of `n` words. Each word pops 4-6
 * frames after the previous; every word has landed by 40% of the beat (`resolveBy`); the
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
  const stagger = n > 1 ? Math.max(1, Math.min(6, room)) : 0;
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
export const NUMBER_MODES = Object.freeze(["pop_roll", "pop"]);
/**
 * How a number enters. Every number pops fully formed (1.3 -> 1.0 over 8
 * frames). A quantity then rolls its digit slots from 0 to the value over 20
 * frames ("pop_roll"). A year, article or section number, or an identifier
 * ("357-A", "Section 12") is a label, not a quantity: it pops and never rolls
 * ("pop").
 */
export function numberMode(value) {
  const p = numberParts(value);
  const s = String(value ?? "");
  return !p.isQuantity || /\b(section|article|rule|title|chapter|§)\b/i.test(s) ? "pop" : "pop_roll";
}
/** The number pop `f` frames after it starts: { s, o, done } (1.3 -> 1.0 over 8 frames, a slight settle below 1). */
export const numberPop = (f) => popState("NUMBER", f);
/** Roll progress 0..1 of a quantity `f` frames after its pop started: 0 until the pop settles, then eased over 20 frames. */
export const numberRoll = (f) => easeOut(clamp01((f - NUMBER_POP_FRAMES) / NUMBER_ROLL_FRAMES));
/** A digit slot's odometer value at roll progress `p`: slot `k` from the right starts 1.5 frames later than the one to its right, and turns 0 -> `target`. */
export const digitRoll = (p, k = 0, target = 0) => target * clamp01((p * NUMBER_ROLL_FRAMES - k * 1.5) / Math.max(1, NUMBER_ROLL_FRAMES - k * 1.5));
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
