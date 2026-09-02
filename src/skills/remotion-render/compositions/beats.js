import { parseSrt } from "@remotion/captions";

/**
 * Beat engine — the timing spine for all three style compositions.
 *
 * This module is PURE (no React, no remotion). It runs in node for
 * render.js / verify-compositions.js AND in the browser bundle.
 *
 * Implements MOTION-BLUEPRINT.md §1 (timing spine), §4.2 (classifier),
 * §5 (transition layout), §9 (renderer contract).
 */

export const FPS = 30;

/** Motion duration tokens — §1.3. The only duration table the compositions may use. */
export const D = {
  micro: 4, // 133ms — accent flash, counter tick, chip pop
  short: 6, // 200ms — small element entrance (icon, label, dot)
  base: 9, // 300ms — standard entrance (text line, bar, node)
  large: 12, // 400ms — large element (headline, panel, chart frame)
  complex: 15, // 500ms — full layout shift, scene furniture rebuild
  push: 60, // 2.0s  — slow camera push / Ken Burns, ONE at a time
  hold: 45, // 1.5s  — minimum on-screen time for readable text (§3.3)
};

import { SAFE_SHORTS, SLOTS_SHORTS } from "../layout/slots.js";

/** Hard safe rect — §2.1. Design to the Google numbers. Single source: layout/slots.js. */
export const SAFE = SAFE_SHORTS;

/** Minimum type sizes — §3.1, scaled by u = min(w,h)/1080. */
export const TYPE = {
  hero: 220, // hook number / single-word payoff
  headline: 84, // Remotion minimum — do not go below
  body: 52,
  support: 44, // Remotion minimum for supporting text
  kicker: 28, // section label, all caps, tracked
};

export const MAX_WORDS_PER_BEAT = 7; // §3.1
export const MAX_BEAT_FRAMES = 96; // §1.1 cadence ceiling (~3.2s). Relaxes the 90f target by 6f so whole 5-word captions don't get torn apart; beats this long are rare.
export const MIN_BEAT_FRAMES = D.hold; // §3.3
export const MAX_STATEMENT_RATIO = 0.3; // §4.1

// MOTION-GRAPHICS-MANUAL.md A1 — canvas + safe rect.
export const CANVAS = {
  shorts: { w: 1080, h: 1920, fps: 30 },
  longform: { w: 1920, h: 1080, fps: 30 },
};
export const OPTICAL_CENTRE_X = SAFE.left + (SAFE.right - SAFE.left) / 2; // 48 + 840/2 = 468 — NOT 540
export const OPTICAL_CENTRE_Y = (SAFE.top + SAFE.bottom) / 2; // (288 + 1248) / 2 = 768

// MOTION-GRAPHICS-MANUAL.md B2 — caption geometry.
export const CAPTION = {
  zoneTop: SLOTS_SHORTS.caption.y, // 1152 (corrected from 1148 — off-grid)
  zoneBottom: SLOTS_SHORTS.caption.y + SLOTS_SHORTS.caption.h, // 1248 == SAFE.bottom
  anchor: "bottom",
  maxWidth: SLOTS_SHORTS.caption.w, // 760 (corrected from 780 — 780 centred on 468 crossed slot right edge 848)
  maxLines: 2,
  lineHeight: 1.12,
  align: "center",
};

// MOTION-GRAPHICS-MANUAL.md B3 — segmentation caps. 42 chars x 0.6 ≈ 25/line
// (Netflix), 2 lines, 7 words, 15 CPS (BBC), 833ms–5s duration, ≥2 blank
// frames between pages.
export const CAPTION_LIMITS = {
  maxCharsPerLine: 25,
  maxLines: 2,
  maxWords: 7,
  maxCPS: 15,
  minDurationMs: 833, // 5/6 s
  maxDurationMs: 5000,
  minGapFrames: 2,
};

// MOTION-GRAPHICS-MANUAL.md A3.2 — the type scale (multiplied by u).
export const MG_TYPE = {
  hero: 220, // w800 — a single number or single word
  headline: 84, // w800 — Remotion floor. Never lower.
  value: 72, // w800 — chart values, counters
  caption: 64, // w800 — the VO caption
  body: 52, // w400
  support: 44, // w400
  label: 32, // w700, tracking +2 — axis labels, chip text
  kicker: 28, // w800, tracking +4, uppercase
};

export const ARCHETYPES = [
  "HERO_NUMBER",
  "CONTRAST",
  "PROGRESS",
  "LIST_ITEM",
  "RELATION",
  "TERM_DEFINE",
  "IMAGE_BEAT",
  "STATEMENT",
];

/** Cubic-bezier easing, equivalent to Remotion's Easing.bezier. */
export function bezierEasing(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleCurveX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleCurveY = (t) => ((ay * t + by) * t + cy) * t;
  const sampleCurveDerivativeX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let x = t;
    for (let i = 0; i < 8; i++) {
      const err = sampleCurveX(x) - t;
      if (Math.abs(err) < 1e-6) break;
      const d = sampleCurveDerivativeX(x);
      if (Math.abs(d) < 1e-6) break;
      x -= err / d;
    }
    return sampleCurveY(x);
  };
}

/** Standard decelerate — Easing.bezier(0.16, 1, 0.3, 1) — §1.4. */
export const EASE_DECELERATE = bezierEasing(0.16, 1, 0.3, 1);

export function wordCount(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

/**
 * §3.3 — minimum on-screen time. seconds = (chars ÷ 12) + 0.5,
 * rounded up to the nearest 7.5 frames. Never less than D.hold.
 */
export function holdFrames(text, fps = FPS) {
  const secs = String(text || "").length / 12 + 0.5;
  return Math.max(D.hold, Math.ceil((secs * fps) / 7.5) * 7.5);
}

/** SRT text → captions. Strips markup and whitespace. */
export function parseSRT(srtText) {
  if (!srtText || !String(srtText).trim()) return [];
  const { captions } = parseSrt({ input: String(srtText) });
  return captions
    .map((c) => ({
      text: String(c.text || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
      startMs: c.startMs,
      endMs: c.endMs,
      timestampMs: c.timestampMs,
    }))
    .filter((c) => c.text);
}

/**
 * Break one caption (a spoken unit) into word tokens with interpolated timing.
 * The distribution is proportional to word length so sync stays honest.
 */
export function splitCaptionToWordTokens(caption) {
  const words = caption.text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [{ text: caption.text, fromMs: caption.startMs, toMs: caption.endMs, captionEnd: true }];
  const totalChars = words.reduce((s, w) => s + w.length + 1, 0);
  const span = Math.max(caption.endMs - caption.startMs, 1);
  const tokens = [];
  let acc = 0;
  for (const w of words) {
    const from = caption.startMs + (acc / totalChars) * span;
    acc += w.length + 1;
    const to = caption.startMs + (acc / totalChars) * span;
    tokens.push({ text: w, fromMs: Math.round(from), toMs: Math.round(to), captionEnd: false });
  }
  tokens[tokens.length - 1].captionEnd = true;
  return tokens;
}

// Words a caption/chunk must never end on — orphaning them breaks mid-clause
// (PART 4.2 of the motion-graphics rebuild; shared by buildCaptionPages'
// clause-boundary repair below and chunkTextClauseAware for the
// minimal/cinematic-documentary styles' plain-text chunking).
const ARTICLES = new Set(["a", "an", "the"]);
const PREPOSITIONS = new Set([
  "of", "to", "in", "on", "at", "by", "for", "with", "from", "into", "onto",
  "over", "under", "near", "through", "during", "before", "after", "between",
  "among", "across", "along", "behind", "beneath", "beside", "without", "within", "about",
]);
const CONJUNCTIONS = new Set([
  "and", "or", "but", "nor", "so", "yet", "because", "while", "since",
  "although", "though", "whereas", "if", "when",
]);
const bareWord = (w) => String(w || "").replace(/[.,;:!?]+$/, "").toLowerCase();
const looksNumeric = (w) => /^[\d,]+(\.\d+)?%?$/.test(bareWord(w));
function endsMidClause(words) {
  const last = words[words.length - 1];
  if (!last) return false;
  if (/[.!?]$/.test(last)) return false; // a real sentence end is never a violation
  const b = bareWord(last);
  return ARTICLES.has(b) || PREPOSITIONS.has(b) || CONJUNCTIONS.has(b) || looksNumeric(last);
}

/**
 * Word-count chunking, clause-boundary aware (PART 4.2). Used by the
 * minimal/cinematic-documentary styles, whose captions are plain section
 * text (no per-word SRT timing) rather than motion-graphics' timed caption
 * pages. Groups words into ≤maxWords chunks, then repairs any boundary that
 * would strand an article, preposition, conjunction, or a bare number split
 * from its unit as the last word of a chunk.
 */
export function chunkTextClauseAware(text, maxWords = 7) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords));
  for (let i = 0; i < chunks.length - 1; i++) {
    const left = chunks[i];
    const right = chunks[i + 1];
    let guard = 0;
    while (endsMidClause(left) && right.length > 0 && guard++ < 6) {
      if (right.length > 1 && left.length < maxWords) {
        left.push(right.shift());
      } else if (left.length > 1) {
        right.unshift(left.pop());
      } else {
        break;
      }
    }
  }
  return chunks.filter((c) => c.length > 0).map((c) => c.join(" "));
}

/**
 * §1.2 — split one caption's words into ≤ maxWords-word parts. Even split;
 * every part is ≤ maxWords by construction and the safety tail keeps the
 * stream lossless.
 */
export function chunkWords(words, maxWords, targetCount) {
  const total = words.length;
  const count = Math.min(Math.max(Math.ceil(targetCount || 1), 1), total);
  const parts = [];
  let cursor = 0;
  for (let p = 0; p < count && cursor < total; p++) {
    const remainingParts = count - p;
    let size = Math.ceil((total - cursor) / remainingParts);
    if (size > maxWords) size = maxWords;
    let end = Math.min(cursor + size, total);
    if (end <= cursor) end = cursor + 1;
    parts.push(words.slice(cursor, end));
    cursor = end;
  }
  if (cursor < total) parts.push(words.slice(cursor));
  return parts;
}

/**
 * §1.2 — beat boundaries are AUDIO-derived. Build beats from captions.
 *
 * 1. Split each caption into ≤ maxWords-word units sized so every unit fits
 *    inside the frame cap (timing is proportional to word length).
 * 2. Greedily merge consecutive units into beats, closing only at the word /
 *    frame caps. Beats tile the full SRT timeline — audio is never dropped
 *    and never stretched (§1.3).
 * 3. Any beat still shorter than the readability floor is merged into the
 *    previous beat when the caps still allow it (§3.3).
 */
export function buildBeatsFromCaptions(captions, opts = {}) {
  const fps = opts.fps || FPS;
  const maxWords = opts.maxWordsPerBeat || MAX_WORDS_PER_BEAT;
  const maxFrames = opts.maxFrames || MAX_BEAT_FRAMES;

  // 1. Expand captions into word-capped units with char-proportional timing.
  const units = [];
  for (const caption of captions) {
    const words = String(caption.text || "").split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    const span = Math.max(caption.endMs - caption.startMs, 1);
    const durFrames = (span / 1000) * fps;
    const totalChars = words.reduce((s, w) => s + w.length + 1, 0);
    let partsNeeded = Math.max(Math.ceil(words.length / maxWords), Math.ceil(durFrames / maxFrames));
    let groups;
    for (;;) {
      groups = chunkWords(words, maxWords, partsNeeded);
      let worstFrames = 0;
      for (const part of groups) {
        const chars = part.reduce((s, w) => s + w.length + 1, 0);
        worstFrames = Math.max(worstFrames, (durFrames * chars) / totalChars);
      }
      if (worstFrames <= maxFrames || partsNeeded >= words.length) break;
      partsNeeded += 1;
    }
    let accChars = 0;
    for (let g = 0; g < groups.length; g++) {
      const partChars = groups[g].reduce((s, w) => s + w.length + 1, 0);
      const from = caption.startMs + (accChars / totalChars) * span;
      accChars += partChars;
      const to = caption.startMs + (accChars / totalChars) * span;
      units.push({
        text: groups[g].join(" ").trim(),
        words: groups[g].length,
        startMs: from,
        endMs: to,
      });
    }
  }
  if (units.length === 0) return [];

  // 2. Greedy grouping — a beat only ever closes at a cap, never mid-stream,
  //    so the whole caption range is tiled with no gaps or drops.
  const beats = [];
  let cur = null;
  const absorb = (unit) => {
    cur.tokens.push(unit);
    cur.text = (cur.text + " " + unit.text).replace(/\s+([.,;:!?])/g, "$1").trim();
    cur.words += unit.words;
    cur.endMs = unit.endMs;
  };
  for (const unit of units) {
    if (!cur) {
      cur = { text: unit.text, words: unit.words, startMs: unit.startMs, endMs: unit.endMs, tokens: [unit] };
      continue;
    }
    const mergedWords = cur.words + unit.words;
    const mergedFrames = ((unit.endMs - cur.startMs) / 1000) * fps;
    if (mergedWords > maxWords || mergedFrames > maxFrames) {
      beats.push(cur);
      cur = { text: unit.text, words: unit.words, startMs: unit.startMs, endMs: unit.endMs, tokens: [unit] };
    } else {
      absorb(unit);
    }
  }
  if (cur) beats.push(cur);

  // 3. Merge any beat below the readability floor into the previous beat when
  //    the caps still allow it. Never stretches past the SRT.
  const merged = [];
  for (const beat of beats) {
    const short = ((beat.endMs - beat.startMs) / 1000) * fps < MIN_BEAT_FRAMES;
    if (short && merged.length > 0) {
      const last = merged[merged.length - 1];
      const mergedWords = last.words + beat.words;
      const mergedFrames = ((beat.endMs - last.startMs) / 1000) * fps;
      if (mergedWords <= maxWords && mergedFrames <= maxFrames) {
        last.tokens.push(...beat.tokens);
        last.text = (last.text + " " + beat.text).replace(/\s+([.,;:!?])/g, "$1").trim();
        last.words = mergedWords;
        last.endMs = beat.endMs;
        continue;
      }
    }
    merged.push(beat);
  }

  return merged.map((beat) => ({
    startFrame: Math.round((beat.startMs / 1000) * fps),
    durationInFrames: Math.max(Math.round(((beat.endMs - beat.startMs) / 1000) * fps), 1),
    text: beat.text,
    tokens: beat.tokens,
    startMs: beat.startMs,
    endMs: beat.endMs,
    words: beat.words,
    sectionIndex: -1,
    archetype: "STATEMENT",
    data: {},
  }));
}

/**
 * §1.2 — full pipeline: SRT text → Beat[] with archetypes assigned. Optionally
 * takes pre-parsed captions (from render.js, which reuses the SRT path lookup).
 */
export function parseSrtToBeats(srtText, opts = {}) {
  const captions = opts.captions || parseSRT(srtText);
  const beats = buildBeatsFromCaptions(captions, opts);
  return annotateBeats(classifyBeats(beats, opts), captions);
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTION-GRAPHICS-MANUAL.md C2.1 — the anchor token. Every beat declares exactly
// one anchor token: the word in the voiceover that names the thing the Stage is
// showing (the numeral for HERO_NUMBER, the term for TERM_DEFINE, the value for
// PROGRESS). It drives the Stage entrance sync window [tA−4, tA+2] (gate H4).
// ─────────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    "a an the of and or but not nor for with by on at in to from as it its this that these those is are was were be been being " +
    "have has had do does did will would shall should can could may might must i you he she we they them their his her our " +
    "me my your our us there here then so if than when while where why how what which who whom because just very all any both each " +
    "more most other some such no yes up down about over under again further out once also only own same too very s t don now"
  ).split(/\s+/)
);

function isContentWord(token) {
  const w = String(token.text || token).replace(/[^\w']/g, "").toLowerCase();
  return w.length >= 3 && !STOPWORDS.has(w);
}

function maxLengthToken(wordTokens) {
  let best = wordTokens.length - 1;
  for (let i = 0; i < wordTokens.length; i++) {
    if ((wordTokens[i].text || "").length > (wordTokens[best].text || "").length) best = i;
  }
  return best;
}

const NUM_RE = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million|billion|percent)\b/i;

function firstTokenAfterMarker(wordTokens, markers) {
  for (let i = 0; i < wordTokens.length - 1; i++) {
    const w = String(wordTokens[i].text).toLowerCase();
    for (const m of markers) {
      if (w === m || w.replace(/[,.]$/, "") === m) return i + 1;
    }
  }
  return -1;
}

/**
 * MOTION-GRAPHICS-MANUAL.md C2.1 — pick the single anchor token for a beat.
 * Deterministic per archetype; falls back to the most content-heavy token.
 */
export function pickAnchorTokenIndex(beat, wordTokens) {
  const t = String(beat.text || "").toLowerCase();
  if (wordTokens.length === 0) return 0;
  switch (beat.archetype) {
    case "HERO_NUMBER":
    case "PROGRESS": {
      for (let i = 0; i < wordTokens.length; i++) {
        if (NUM_RE.test(wordTokens[i].text)) return i;
      }
      return maxLengthToken(wordTokens);
    }
    case "TERM_DEFINE": {
      const after = firstTokenAfterMarker(wordTokens, ["called", "known", "named", "records", "holds", "is", "as", "otherwise"]);
      if (after >= 0) return after;
      return maxLengthToken(wordTokens);
    }
    case "CONTRAST": {
      // The consequence side — first token after a pivot marker.
      const after = firstTokenAfterMarker(wordTokens, [
        "but", "instead", "whereas", "rather", "while", "despite", "never", "nowhere", "longer",
      ]);
      if (after >= 0) return after;
      return maxLengthToken(wordTokens);
    }
    case "RELATION": {
      // The second-mentioned concept — the connector points at it (F6).
      for (let i = wordTokens.length - 1; i >= 0; i--) {
        if (isContentWord(wordTokens[i])) return i;
      }
      return maxLengthToken(wordTokens);
    }
    case "LIST_ITEM": {
      // The item's key noun — first content token.
      for (let i = 0; i < wordTokens.length; i++) {
        if (isContentWord(wordTokens[i])) return i;
      }
      return maxLengthToken(wordTokens);
    }
    default: {
      // STATEMENT / IMAGE_BEAT — the named subject.
      for (let i = wordTokens.length - 1; i >= 0; i--) {
        if (isContentWord(wordTokens[i])) return i;
      }
      return maxLengthToken(wordTokens);
    }
  }
}

/**
 * Add word-level tokens, the anchor token index and the anchor's absolute frame
 * (video timeline) to every beat. Returns the annotated beat array.
 */
export function annotateBeats(beats, captions) {
  const fps = 30;
  const annotated = beats.map((beat) => {
    const wordTokens = [];
    for (const unit of beat.tokens) {
      for (const tok of splitCaptionToWordTokens(unit)) wordTokens.push(tok);
    }
    wordTokens.sort((a, b) => a.fromMs - b.fromMs);
    const anchorTokenIndex = pickAnchorTokenIndex(beat, wordTokens);
    const anchorMs = wordTokens[anchorTokenIndex] ? wordTokens[anchorTokenIndex].fromMs : beat.startMs;
    return {
      ...beat,
      wordTokens,
      anchorTokenIndex,
      anchorFrame: Math.round((anchorMs / 1000) * fps),
    };
  });
  return annotated;
}

/**
 * Full motion-graphics package: annotated beats + caption pages + the raw SRT
 * captions + the flattened word-token stream. This is what render.js and
 * verify-compositions.js pass to the MotionGraphics composition.
 */
export function parseSrtToMotionGraphics(srtText, opts = {}) {
  const captions = opts.captions || parseSRT(srtText);
  const beats = annotateBeats(classifyBeats(buildBeatsFromCaptions(captions, opts), opts), captions);
  const wordStream = [];
  for (const caption of captions) {
    for (const tok of splitCaptionToWordTokens(caption)) wordStream.push(tok);
  }
  wordStream.sort((a, b) => a.fromMs - b.fromMs);
  const pages = buildCaptionPages(wordStream, opts);
  return { beats, captions, wordStream, pages };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTION-GRAPHICS-MANUAL.md Part B — caption pages. Deterministic equivalent of
// createTikTokStyleCaptions({ combineTokensWithinMilliseconds: 1200; 600 for the
// hook }) followed by the CAPTION_LIMITS post-process: ≤25 chars/line, ≤2 lines,
// ≤7 words, ≤15 CPS, duration ∈ [833ms, 5000ms], ≥2 blank frames between pages.
// ─────────────────────────────────────────────────────────────────────────────

/** Wrap words into ≤ maxChars-per-line lines (word-boundary only). */
export function wrapCaptionWords(words, maxCharsPerLine = CAPTION_LIMITS.maxCharsPerLine) {
  const lines = [];
  let line = "";
  for (const w of words) {
    const sep = line ? " " : "";
    if ((line + sep + w).length > maxCharsPerLine) {
      if (line) lines.push(line);
      line = w;
    } else {
      line += sep + w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pageCps(page) {
  const chars = page.text.replace(/\s+/g, "").length;
  const secs = Math.max(page.endMs - page.startMs, 1) / 1000;
  return chars / secs;
}

/**
 * Greedy page builder over the word-token stream. A page accumulates tokens
 * while it fits: ≤ maxWords, ≤ maxLines (of ≤ maxChars), total span ≤ the
 * combine window (600ms hook / 1200ms sections), span ≤ maxDurationMs.
 */
export function buildCaptionPages(tokens, opts = {}) {
  const caps = opts.caps || CAPTION_LIMITS;
  const fps = opts.fps || 30;
  const sectionCombineMs = opts.sectionCombineMs ?? 1200;
  const hookCombineMs = opts.hookCombineMs ?? 600;
  const hookEndMs = opts.hookEndMs ?? 8000;
  if (!tokens || tokens.length === 0) return [];

  const sorted = [...tokens].sort((a, b) => a.fromMs - b.fromMs);
  const pages = [];
  let cur = null;

  const fit = (tok) => {
    if (cur.words.length >= caps.maxWords) return false;
    const candidate = [...cur.words, tok.text];
    if (wrapCaptionWords(candidate).length > caps.maxLines) return false;
    const span = tok.toMs - cur.startMs;
    if (span > caps.maxDurationMs) return false;
    const windowMs = cur.startMs < hookEndMs ? hookCombineMs : sectionCombineMs;
    return span <= windowMs;
  };

  for (const tok of sorted) {
    if (!cur) {
      cur = { text: tok.text, startMs: tok.fromMs, endMs: tok.toMs, words: [tok.text], tokens: [tok] };
      continue;
    }
    if (fit(tok)) {
      cur.words.push(tok.text);
      cur.tokens.push(tok);
      cur.endMs = tok.toMs;
      cur.text = cur.words.join(" ").replace(/\s+([.,;:!?])/g, "$1");
    } else {
      pages.push(cur);
      cur = { text: tok.text, startMs: tok.fromMs, endMs: tok.toMs, words: [tok.text], tokens: [tok] };
    }
  }
  if (cur) pages.push(cur);

  // ── Window enforcement (merge + min-duration/CPS + gap) ────────────────────
  // The greedy builder may strand a word (or two) whose raw audio window is long
  // enough but whose DISPLAY window — after reserving ≥ minGapFrames before the
  // next page — falls below minDurationMs (or above maxCPS). Merge it with a
  // neighbour until every page's display window satisfies CAPTION_LIMITS.
  const gapMs = (caps.minGapFrames / fps) * 1000;
  const pageChars = (page) => page.text.replace(/\s+/g, "").length;
  const canMerge = (a, b) =>
    a.words.length + b.words.length <= caps.maxWords &&
    wrapCaptionWords([...a.words, ...b.words]).length <= caps.maxLines;
  const fmtPage = (page) =>
    page.words.join(" ").replace(/\s+([.,;:!?])/g, "$1");

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const nextStart = i + 1 < pages.length ? pages[i + 1].startMs : Infinity;
      const displayEnd = Math.min(page.endMs, nextStart - gapMs);
      const dur = displayEnd - page.startMs;
      const need = Math.min(
        caps.maxDurationMs,
        Math.max(caps.minDurationMs, (pageChars(page) / caps.maxCPS) * 1000)
      );
      if (dur >= need) continue;

      // Backward merge — absorb this page into the previous one.
      if (i > 0 && canMerge(pages[i - 1], page)) {
        const prev = pages[i - 1];
        prev.words.push(...page.words);
        prev.tokens.push(...page.tokens);
        prev.endMs = page.endMs;
        prev.text = fmtPage(prev);
        pages.splice(i, 1);
        changed = true;
        break;
      }
      // Forward merge — absorb the next page into this one.
      if (i + 1 < pages.length && canMerge(page, pages[i + 1])) {
        const next = pages[i + 1];
        page.words.push(...next.words);
        page.tokens.push(...next.tokens);
        page.endMs = next.endMs;
        page.text = fmtPage(page);
        pages.splice(i + 1, 1);
        changed = true;
        break;
      }
      // Fallback: extend the display window as far as the slot allows (never
      // overlapping the next page). Keeps the text on screen during the pause.
      page.endMs = Math.max(page.endMs, page.startMs + need);
    }
  }

  // ── Clause-boundary repair (PART 4.2 of the motion-graphics rebuild) ───────
  // Everything above closes a page purely on word/char/duration/CPS caps,
  // with no grammar awareness — that is exactly how a real shipped defect
  // happened: "...found: 1,980 meters below the" stranded "the" as the last
  // word of a page with "surface," starting the next one. Walk every
  // boundary and, where the left page ends mid-clause (an article, a
  // preposition, a coordinating/subordinating conjunction, or a bare number
  // split from its unit), move the single dangling word across the boundary
  // — forward onto the right page when it still fits under caps, otherwise
  // backward onto the left page (removing a word can never violate a cap).
  // ARTICLES/PREPOSITIONS/CONJUNCTIONS/endsMidClause are module-scope,
  // shared with chunkTextClauseAware above.
  for (let i = 0; i < pages.length - 1; i++) {
    const left = pages[i];
    const right = pages[i + 1];
    let guard = 0;
    while (endsMidClause(left.words) && right.words.length > 0 && guard++ < 6) {
      const forwardWords = [...left.words, right.words[0]];
      if (
        right.words.length > 1 &&
        left.words.length < caps.maxWords &&
        wrapCaptionWords(forwardWords).length <= caps.maxLines
      ) {
        // Pull the right page's first word onto the left page — keeps the
        // dangling word with the clause it belongs to instead of orphaning it.
        const tok = right.tokens.shift();
        right.words.shift();
        left.tokens.push(tok);
        left.words.push(tok.text);
        left.endMs = tok.toMs;
        right.startMs = right.tokens[0].fromMs;
      } else if (left.words.length > 1) {
        // No room on the right — retreat the boundary instead. Removing a
        // word from the left page can never push it over a cap.
        const tok = left.tokens.pop();
        left.words.pop();
        right.tokens.unshift(tok);
        right.words.unshift(tok.text);
        right.startMs = tok.fromMs;
        left.endMs = left.tokens[left.tokens.length - 1].toMs;
      } else {
        break; // a single-word page ending mid-clause with nowhere to go — leave it
      }
      left.text = fmtPage(left);
      right.text = fmtPage(right);
    }
  }

  // Final clamp: reserve the inter-page gap, cap at maxDurationMs, and let the
  // last page hold its full minimum. Tokens clamp to the display window so the
  // B5.3 highlight never outlives the page.
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const nextStart = i + 1 < pages.length ? pages[i + 1].startMs : Infinity;
    let end = Math.min(page.endMs, nextStart - gapMs);
    if (end - page.startMs > caps.maxDurationMs) end = page.startMs + caps.maxDurationMs;
    if (i + 1 >= pages.length && end - page.startMs < caps.minDurationMs) end = page.startMs + caps.minDurationMs;
    page.endMs = Math.max(end, page.startMs);
    for (const tok of page.tokens) {
      tok.toMs = Math.min(tok.toMs, page.endMs);
      tok.fromMs = Math.max(tok.fromMs, page.startMs);
    }
  }
  return pages.map((page, i) => {
    const lines = wrapCaptionWords(page.words);
    return {
      ...page,
      index: i,
      lines,
      durationMs: Math.max(page.endMs - page.startMs, 1),
      cps: pageCps(page),
      startFrame: Math.round((page.startMs / 1000) * fps),
      endFrame: Math.round((page.endMs / 1000) * fps),
    };
  });
}

/**
 * MOTION-GRAPHICS-MANUAL.md §9 gates H5–H8 — static checks over caption pages.
 */
export function gateCaptions(pages, opts = {}) {
  const caps = opts.caps || CAPTION_LIMITS;
  const fps = opts.fps || 30;
  const failures = [];
  if (!pages || pages.length === 0) return { pass: false, failures: ["no caption pages"] };
  for (const page of pages) {
    for (const line of page.lines) {
      if (line.length > caps.maxCharsPerLine) failures.push(`caption "${page.text}" line exceeds ${caps.maxCharsPerLine} chars: "${line}"`);
    }
    if (page.lines.length > caps.maxLines) failures.push(`caption "${page.text}" has ${page.lines.length} lines > ${caps.maxLines}`);
    if (page.words.length > caps.maxWords) failures.push(`caption "${page.text}" has ${page.words.length} words > ${caps.maxWords}`);
    if (page.cps > caps.maxCPS) failures.push(`caption "${page.text}" is ${page.cps.toFixed(1)} CPS > ${caps.maxCPS}`);
    if (page.durationMs < caps.minDurationMs) failures.push(`caption "${page.text}" duration ${Math.round(page.durationMs)}ms < ${caps.minDurationMs}ms`);
    if (page.durationMs > caps.maxDurationMs) failures.push(`caption "${page.text}" duration ${Math.round(page.durationMs)}ms > ${caps.maxDurationMs}ms`);
  }
  for (let i = 1; i < pages.length; i++) {
    const gap = pages[i].startFrame - pages[i - 1].endFrame;
    if (gap < caps.minGapFrames) failures.push(`caption gap ${gap}f < ${caps.minGapFrames}f between "${pages[i - 1].text}" and "${pages[i].text}"`);
  }
  return { pass: failures.length === 0, failures };
}

/**
 * Assign archetypes to a beat timeline, enforcing §4.2 Rule 4.2 (no archetype
 * more than twice consecutively) via the classifier's prev context.
 */
export function classifyBeats(beats, opts = {}) {
  let prev = [];
  return beats.map((beat) => {
    const archetype = classifyBeat(beat.text, { prev, bRollFiles: opts.bRollFiles });
    prev = [archetype, prev[0]].slice(0, 2);
    return { ...beat, archetype };
  });
}

/**
 * §4.2 — beat → archetype classifier. Pure function over the beat's own
 * text (NOT animation cues — those failed on 44/50 channels).
 *
 * Priority: HERO_NUMBER > CONTRAST > PROGRESS > LIST_ITEM > RELATION >
 * TERM_DEFINE > IMAGE_BEAT > STATEMENT.
 *
 * ctx: { prev: [previous, previous-previous] } so Rule 4.2 (no archetype
 * more than twice consecutively) can demote.
 */
export function classifyBeat(text, ctx = {}) {
  const t = String(text || "").toLowerCase();
  const prev = ctx.prev || [];

  const matches = [];

  if (
    /\d/.test(text) ||
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million|billion|percent)\b/i.test(text)
  ) {
    matches.push("HERO_NUMBER");
  }
  if (/\b(but|however|instead|instead of|versus|whereas|yet|while|despite|rather than|on the other hand|not just|no longer|do not|does not|did not|never|nowhere|not alone|no light)\b/.test(t)) {
    matches.push("CONTRAST");
  }
  if (/\b(over time|year\w*|decade|century|millennia|since|grow\w*|rise\w*|fall\w*|increase\w*|decrease\w*|double\w*|triple\w*|record|deepest|highest|longest|went from|from .* to)\b/.test(t)) {
    matches.push("PROGRESS");
  }
  if (
    /\b(first|second|third|fourth|fifth|next|then|finally|last|one more|another)\b/.test(t) ||
    /^\s*(number|step|item|day|week)\b/.test(t) ||
    (t.match(/,/g) || []).length >= 2
  ) {
    matches.push("LIST_ITEM");
  }
  if (/\b(because|means that|leads? to|caused by|driven by|thanks to|due to|resulting|connected to|linked to|depends on|turns into|turning|running on|run on|powered by|fueled by|feed on|fed by|made of|exactly like|like the)\b/.test(t)) {
    matches.push("RELATION");
  }
  if (/\b(called|known as|which is|that is|, which|a type of|otherwise known as)\b/.test(t) || /\b(records? for|holds? the)\b/.test(t)) {
    matches.push("TERM_DEFINE");
  }
  if (ctx.bRollFiles && ctx.bRollFiles.length > 0) {
    matches.push("IMAGE_BEAT");
  }
  matches.push("STATEMENT");

  // Rule 4.2 — demote while the same archetype has already appeared twice.
  for (const m of matches) {
    if (prev[0] === m && prev[1] === m) continue;
    return m;
  }
  return matches[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// §1.2c — LLM-authored beats as the Stage-scene unit.
//
// classifyBeat (above) guesses an archetype from a ~7-word caption FRAGMENT
// with no data, which is why STATEMENT dominates in practice (ENC-01) and
// PROGRESS/CONTRAST/RELATION beats never carry real numbers (ENC-08/DEL-04's
// neighbor problem) — most 7-word fragments just don't contain a strong
// regex signal on their own, and a real chart figure never survives being
// re-derived from prose at render time. schemas/script.mg.json's own header
// admits the fix was never wired in: "mg-package.js still derives its own
// beat/archetype classification... it does not yet read sections[].beats".
//
// This is that wiring. sections[].beats[] is already gate-script.js-checked
// (SCR-03/04/05: anchor_token verbatim in the voiceover, PROGRESS has real
// series data traced to research numbers) — the writer already decided what
// each beat IS and what data it carries. What it doesn't have is real
// timing, so this function gets that from the SRT the exact same way the
// classifier path does: every caption is split into real per-word timestamps
// (splitCaptionToWordTokens), and each authored beat's anchor_token is
// located in that real word stream to get a real anchorMs. A beat's on-
// screen window is the real time between its own anchor and its neighbors'
// (first beat starts at the section's real start, last ends at the
// section's real end) — so Stage cuts land on real speech boundaries, not a
// word-count guess, while still being sized to a whole authored visual idea
// instead of one caption-sized fragment.
//
// Returns null — caller falls back to parseSrtToBeats unchanged — the
// moment anything doesn't line up: no captions to anchor against, a section
// missing beats entirely, or a section's real word count disagreeing with
// its voiceover's word count (TTS was given different text than the script
// contains, or an anchor_token that doesn't actually occur). Refusing to
// render un-anchored guesses on top of a data-quality problem matches this
// file's own precedent (parseNumber over extractStats/extractHeroNumber).
// ─────────────────────────────────────────────────────────────────────────────

const bareToken = (w) => String(w || "").replace(/[^\w']/g, "").toLowerCase();

/**
 * anchor_token is frequently a multi-word phrase in real authored scripts
 * ("150 meter", "6 to 3", "Fourth Amendment"), not a single word, even
 * though the field name suggests otherwise — gate-script.js's SCR-03 only
 * checks verbatim substring presence, not word count. Find the phrase as a
 * consecutive run of tokens; the anchor position is its first word.
 */
function findPhrase(tokens, phraseWords, from) {
  outer: for (let i = from; i <= tokens.length - phraseWords.length; i++) {
    for (let k = 0; k < phraseWords.length; k++) {
      if (bareToken(tokens[i + k].text) !== phraseWords[k]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Locate every authored beat's anchor_token in a section's real word-token
 * stream, in the writer's own order (never re-sorted — a re-sort would
 * silently override the writer's narrative sequencing if two anchors
 * happened to match out of order). Returns null on any unmatched anchor.
 */
function anchorAuthoredBeats(authoredBeats, sectionTokens, startFrom = 0) {
  const anchors = [];
  let searchFrom = startFrom;
  for (const ab of authoredBeats) {
    const phrase = String(ab.anchor_token || "").split(/\s+/).filter(Boolean).map(bareToken);
    if (!phrase.length) return null;
    let idx = findPhrase(sectionTokens, phrase, searchFrom);
    if (idx === -1) {
      // Second pass from startFrom — covers an authored beat list that
      // isn't in strict narration order (rare, but not itself a data
      // error). Never below startFrom: for section 0 that's the hook's own
      // word span, which the writer's beats were never told about and must
      // not match into (see the hook synthesis below).
      idx = findPhrase(sectionTokens, phrase, startFrom);
    }
    if (idx === -1) return null;
    searchFrom = idx + phrase.length;
    anchors.push({ authored: ab, idx, ms: sectionTokens[idx].fromMs });
  }
  return anchors;
}

// PART 12 — ONE CONCEPT, MORE VISUAL STATES. NOT SIX UNRELATED SCENES.
//
// This threshold used to DISCARD the writer's authored beats for a whole
// section whenever one of them spanned more than 8s, falling back to the
// fragment classifier. The reasoning was "a static scene that long is
// worse than a generic one" — which was true of the renderer as it existed
// then, because a beat WAS one static composition. It threw the authored
// idea away at exactly the moment the writer had given it the most room,
// and on the one real gate-passed script in the repo it discarded 3 of 5
// sections.
//
// That is no longer the trade. visual/states.js densifies a long window
// into more states OF THE SAME CONCEPT (the geofence beat gets establish ->
// origin -> expand -> lock -> populate -> select -> measure rather than one
// held frame), so length now buys visual progression instead of a stall.
//
// A ceiling still exists, far higher, for genuinely pathological spans: a
// single authored beat covering most of a long-form section means the
// script's beat density is wrong, and silently spreading one concept over
// 30s would hide that. At that point the classifier's finer-grained beats
// really are the better rendering, and the warning says so.
const MAX_AUTHORED_BEAT_FRAMES = 22 * FPS;

/**
 * Build the real-timed, archetype/data-carrying beats for ONE section from
 * its authored beats[], or return null if this section's authored data
 * can't be safely used (missing beats, an anchor_token that doesn't occur
 * in the real narration, or a beat that would hold the Stage past
 * MAX_AUTHORED_BEAT_FRAMES). null means "this section falls back to the
 * classifier", not "the whole video does" — see buildAuthoredBeats.
 */
function authoredBeatsForSection(section, sectionTokens, sectionIndex, opts) {
  const fps = opts.fps || FPS;
  if (!Array.isArray(section.beats) || section.beats.length === 0) return null;

  // script-narration.js folds the top-level `hook` into section one's
  // voiceover so it actually gets narrated and timed — but the writer
  // authored sections[0].beats against section one's ORIGINAL text, before
  // that fold, so the hook itself has no beat of its own. Without this, the
  // hook (the first ~5-10s a viewer decides whether to keep watching) would
  // either steal its screen time from section one's first real beat or push
  // that beat past the density cap below. Synthesize one STATEMENT beat
  // covering exactly the hook's own words, anchored on its last content
  // word (the same backward-search heuristic classifyBeat's
  // STATEMENT/default case already uses) — deterministic, no model call —
  // and section one's real authored beats still only ever search their own
  // text (startFrom below), never the hook's.
  const hook = typeof opts.hook === "string" ? opts.hook.trim() : "";
  const hookWordCount =
    sectionIndex === 0 && hook && section.voiceover.trim().startsWith(hook) ? wordCount(hook) : 0;

  let hookAnchor = null;
  let startFrom = 0;
  if (hookWordCount > 0 && hookWordCount < sectionTokens.length) {
    const hookTokens = sectionTokens.slice(0, hookWordCount);
    let anchorIdx = hookTokens.length - 1;
    for (let i = hookTokens.length - 1; i >= 0; i--) {
      if (isContentWord(hookTokens[i].text)) {
        anchorIdx = i;
        break;
      }
    }
    hookAnchor = {
      authored: { text: hook, archetype: "STATEMENT", anchor_token: hookTokens[anchorIdx].text, data: {} },
      idx: anchorIdx,
      ms: hookTokens[anchorIdx].fromMs,
    };
    startFrom = hookWordCount;
  }

  const rest = anchorAuthoredBeats(section.beats, sectionTokens, startFrom);
  if (!rest) return null;
  const anchors = hookAnchor ? [hookAnchor, ...rest] : rest;

  const sectionStartMs = sectionTokens[0].fromMs;
  const sectionEndMs = sectionTokens[sectionTokens.length - 1].toMs;
  const minSpanMs = (MIN_BEAT_FRAMES / fps) * 1000;

  const beats = [];
  let prevEndMs = sectionStartMs;
  for (let j = 0; j < anchors.length; j++) {
    const { authored, idx, ms } = anchors[j];
    const nextMs = j === anchors.length - 1 ? null : anchors[j + 1].ms;
    let startMs = j === 0 ? sectionStartMs : prevEndMs;
    let endMs = j === anchors.length - 1 ? sectionEndMs : Math.round((ms + nextMs) / 2);
    // Never let a beat fall below the readability floor by borrowing frames
    // from its own end — packing this many beats into too short a real
    // span is a script-pacing problem, not something to hide, so this only
    // nudges the boundary, it never invents time the SRT doesn't have.
    if (endMs - startMs < minSpanMs && j < anchors.length - 1) {
      endMs = Math.min(startMs + minSpanMs, sectionEndMs);
    }
    prevEndMs = endMs;

    const durationInFrames = Math.max(Math.round(((endMs - startMs) / 1000) * fps), 1);
    if (durationInFrames > MAX_AUTHORED_BEAT_FRAMES) {
      console.warn(
        `MG: authored beat "${authored.text}" (section ${sectionIndex}) would hold ONE concept for ` +
          `${(durationInFrames / fps).toFixed(1)}s — beyond what state densification can carry ` +
          `(${section.beats.length} beat(s) covering ~${((sectionEndMs - sectionStartMs) / 1000).toFixed(1)}s). ` +
          `This is a script beat-density problem: the section needs more authored beats. ` +
          `Falling back to the SRT classifier for this section only.`
      );
      return null;
    }

    const beatTokens = sectionTokens.filter((t) => t.fromMs >= startMs && t.fromMs < endMs);
    const tokensForText = beatTokens.length ? beatTokens : [sectionTokens[idx]];
    const anchorTokenIndex = Math.max(tokensForText.findIndex((t) => t === sectionTokens[idx]), 0);

    beats.push({
      startFrame: Math.round((startMs / 1000) * fps),
      durationInFrames,
      // The REAL spoken words in this beat's window. This is the richest
      // context the visual director gets — a whole authored idea's worth of
      // narration, not the ~7-word fragment classifyBeat has to guess from.
      text: tokensForText.map((t) => t.text).join(" "),
      startMs,
      endMs,
      words: tokensForText.length,
      sectionIndex,
      archetype: authored.archetype,
      data: authored.data || {},
      // The writer's own authored fields, carried through for the visual
      // director (visual/director.js). These used to be dropped here, which
      // meant the renderer could see WHEN a beat happened and WHAT TYPE it
      // was, but not what the writer said it was ABOUT:
      //   authoredText — the short on-screen label the writer wrote
      //     ("150 meters", "6-3 Decision"). Good as a supporting caption,
      //     useless as semantic input on its own, which is exactly why the
      //     director reads `text` above for meaning and this for display.
      //   anchorToken — names the subject of the beat.
      //   visual — the optional authored visual plan (schemas/script.mg.json).
      //     Absent on every script written before that field existed; the
      //     director falls through to its deterministic reading then.
      authoredText: authored.text || null,
      anchorToken: authored.anchor_token || null,
      visual: authored.visual || null,
      wordTokens: tokensForText,
      anchorTokenIndex,
      anchorFrame: Math.round((ms / 1000) * fps),
    });
  }
  return beats;
}

export function buildAuthoredBeats(sections, captions, opts = {}) {
  const fps = opts.fps || FPS;
  if (!captions || captions.length === 0) return null;
  if (!Array.isArray(sections) || sections.length === 0) return null;

  const allTokens = [];
  for (const cap of captions) {
    for (const tok of splitCaptionToWordTokens(cap)) allTokens.push(tok);
  }

  const sectionWordCounts = sections.map((s) => wordCount(s.voiceover));
  const totalExpected = sectionWordCounts.reduce((a, b) => a + b, 0);
  // Can't safely align anything without real per-word timing agreeing with
  // the script's own word count — this is the one case with no per-section
  // fallback, since it means the SRT wasn't actually narrating this script.
  if (totalExpected === 0 || allTokens.length !== totalExpected) return null;

  const perSection = [];
  let cursor = 0;
  let anyAuthored = false;
  let anyFallback = false;
  for (let s = 0; s < sections.length; s++) {
    const count = sectionWordCounts[s];
    const sectionTokens = allTokens.slice(cursor, cursor + count);
    const sectionStartMs = sectionTokens.length ? sectionTokens[0].fromMs : cursor === 0 ? 0 : null;
    const sectionEndMs = sectionTokens.length ? sectionTokens[sectionTokens.length - 1].toMs : sectionStartMs;
    cursor += count;
    if (sectionTokens.length === 0) {
      perSection.push({ beats: [], startMs: sectionStartMs ?? 0, endMs: sectionEndMs ?? 0 });
      continue;
    }

    const authored = authoredBeatsForSection(sections[s], sectionTokens, s, opts);
    if (authored) {
      anyAuthored = true;
      perSection.push({ beats: authored, startMs: sectionStartMs, endMs: sectionEndMs });
    } else {
      anyFallback = true;
      perSection.push({ beats: null, startMs: sectionStartMs, endMs: sectionEndMs });
    }
  }

  // Nothing usable anywhere — let the caller take the classifier path for
  // the whole video exactly as before (simpler than a per-section fallback
  // when there is no authored data to prefer in the first place).
  if (!anyAuthored) return null;

  // Only compute the classifier's fine-grained, real-timed beats (same as
  // the pre-existing path) when at least one section actually needs them.
  let classifierBeats = null;
  if (anyFallback) {
    classifierBeats = assignBeatsToSections(
      parseSrtToBeats(null, { captions, bRollFiles: opts.bRollFiles }),
      perSection.map((p) => [p.startMs, p.endMs])
    ).map(({ _i, ...rest }) => rest);
  }

  const beats = [];
  for (let s = 0; s < perSection.length; s++) {
    if (perSection[s].beats) {
      beats.push(...perSection[s].beats);
    } else {
      beats.push(...classifierBeats.filter((b) => b.sectionIndex === s));
    }
  }
  return beats;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOT-01 (CHECK-REGISTER.md): "Beats are SRT-derived, not section-index
// divided". True for motion-graphics (this file's own beat pipeline above),
// false for minimal/cinematic-documentary — minimal.jsx divides
// `durationInFrames` by section COUNT (equal screen time regardless of how
// much each section's voiceover actually says), and cinematic-documentary.jsx
// weights sections by a hardcoded dramatic-pacing multiplier that also never
// looks at word count. Both can put a section's visuals on screen for far
// longer or shorter than its narration takes to speak. This gives both
// styles the same real-per-word-timing source of truth motion-graphics
// already has, on the same terms: real SRT when available, and an honest
// word-count-proportional (not equal, not a content-blind dramatic weight)
// fallback when it isn't.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Real per-section [startMs, endMs] windows from actual per-word SRT
 * timing, the same word-count-cursor alignment buildAuthoredBeats uses for
 * beats. Returns null when there's nothing to anchor against (no captions,
 * or the SRT's word count doesn't match the sections' own voiceover word
 * count) — callers fall back to proportionalSectionWindows.
 */
export function realSectionWindows(sections, captions, fps = FPS) {
  if (!captions || captions.length === 0) return null;
  if (!Array.isArray(sections) || sections.length === 0) return null;

  const allTokens = [];
  for (const cap of captions) {
    for (const tok of splitCaptionToWordTokens(cap)) allTokens.push(tok);
  }

  const counts = sections.map((s) => wordCount(s.voiceover));
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0 || allTokens.length !== total) return null;

  const windows = [];
  let cursor = 0;
  for (let i = 0; i < sections.length; i++) {
    const slice = allTokens.slice(cursor, cursor + counts[i]);
    cursor += counts[i];
    if (slice.length === 0) return null;
    windows.push([slice[0].fromMs, slice[slice.length - 1].toMs]);
  }
  return windows;
}

/**
 * Word-count-proportional fallback for when there's no SRT to anchor
 * against — still honest about content length, unlike equal division or a
 * content-blind pacing weight.
 */
export function proportionalSectionWindows(sections, totalMs) {
  const counts = sections.map((s) => wordCount(s.voiceover || (s.content || []).join(" ")));
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const windows = [];
  let acc = 0;
  for (let i = 0; i < sections.length; i++) {
    const fromMs = (acc / total) * totalMs;
    acc += counts[i];
    const toMs = i === sections.length - 1 ? totalMs : (acc / total) * totalMs;
    windows.push([fromMs, toMs]);
  }
  return windows;
}

/**
 * Real or word-count-proportional per-section [startFrame, durationInFrames]
 * pairs for the minimal/cinematic-documentary compositions. Always returns
 * a full-coverage, gapless set of windows.
 */
export function sectionFrameWindows(sections, srtText, totalFrames, fps = FPS) {
  const totalMs = (totalFrames / fps) * 1000;
  const captions = srtText ? parseSRT(srtText) : [];
  const msWindows = realSectionWindows(sections, captions, fps) || proportionalSectionWindows(sections, totalMs);
  return msWindows.map(([fromMs, toMs], i) => {
    const startFrame = Math.round((fromMs / 1000) * fps);
    const endFrame = i === msWindows.length - 1 ? totalFrames : Math.round((toMs / 1000) * fps);
    return { from: startFrame, duration: Math.max(endFrame - startFrame, 1) };
  });
}

/**
 * Assign each beat to a section by its audio start time.
 * sections: array of { windowMs: [startMs, endMs] } (must be contiguous).
 */
export function assignBeatsToSections(beats, sectionWindowsMs) {
  const indexed = beats.map((b, i) => ({ ...b, _i: i }));
  const out = [];
  for (const beat of indexed) {
    let sectionIndex = sectionWindowsMs.length - 1;
    for (let s = 0; s < sectionWindowsMs.length; s++) {
      const [from, to] = sectionWindowsMs[s];
      if (beat.startMs >= from && beat.startMs < to) {
        sectionIndex = s;
        break;
      }
    }
    out.push({ ...beat, sectionIndex });
  }
  return out;
}

/** §5 transition budget. Returns null for hard cuts. */
export function transitionBeforeBeat(beatIndex, beats) {
  if (beatIndex <= 0) return null;
  const prev = beats[beatIndex - 1];
  const cur = beats[beatIndex];
  if (!prev || !cur) return null;
  if (prev.sectionIndex === cur.sectionIndex) return null; // beat → beat: hard cut

  const lastSectionIndex = Math.max(...beats.map((b) => b.sectionIndex));
  if (cur.sectionIndex === lastSectionIndex) {
    // Into close
    return { type: "fade", durationInFrames: 15, presentation: "fade" };
  }
  if (cur.sectionIndex === 1 && prev.sectionIndex === 0) {
    // Hook → section 1
    return { type: "pushcut", durationInFrames: 9, presentation: "pushCut" };
  }
  return { type: "wipe", durationInFrames: 12, presentation: "wipe" };
}

/**
 * §5.2 — compute the TransitionSeries layout. Returns per-sequence durations
 * (raw beat duration + its preceding transition) plus absolute section frame
 * ranges for furniture.
 *
 * Sequence i occupies [start_i, start_i + S_i) where start_i = Σ_{j<i} rawDur_j
 * (the entering transition of beat i plays inside the first T_i frames).
 * Total video = Σ rawDur + T_last. See MOTION-BLUEPRINT §5.2.
 */
export function layoutBeatSeries(beats) {
  const transitions = beats.map((_, i) => transitionBeforeBeat(i, beats));
  const sequences = beats.map((beat, i) => {
    const t = transitions[i] ? transitions[i].durationInFrames : 0;
    return { ...beat, sequenceDuration: beat.durationInFrames + t };
  });

  // Absolute start of each sequence in the video timeline = Σ_{j<i} rawDur_j.
  const rawStarts = [];
  let raw = 0;
  for (const b of beats) {
    rawStarts.push(raw);
    raw += b.durationInFrames;
  }

  // Section frame ranges (video timeline).
  const sectionRanges = {};
  for (let i = 0; i < beats.length; i++) {
    const idx = beats[i].sectionIndex;
    if (!sectionRanges[idx]) sectionRanges[idx] = { from: rawStarts[i], to: rawStarts[i] + beats[i].durationInFrames };
    else sectionRanges[idx].to = Math.max(sectionRanges[idx].to, rawStarts[i] + beats[i].durationInFrames);
  }

  const totalFrames = beats.reduce((s, b) => s + b.durationInFrames, 0) + (beats.length ? (transitions[beats.length - 1] ? transitions[beats.length - 1].durationInFrames : 0) : 0);

  return { transitions, sequences, sectionRanges, totalFrames, rawStarts };
}

/**
 * §10 static gate — checks 1–8. Pure, runs on a beat timeline without
 * rendering. Returns { pass, failures: [string] }.
 */
export function gateBeats(beats, opts = {}) {
  const fps = opts.fps || FPS;
  const failures = [];
  const n = beats.length;
  if (n === 0) return { pass: false, failures: ["no beats"] };

  // 1. Beat density — every rolling 300-frame window has 4–8 beats.
  const windowSize = 300;
  for (let start = 0; start + windowSize <= (beats[beats.length - 1].startFrame + beats[beats.length - 1].durationInFrames); start += windowSize) {
    const inWindow = beats.filter((b) => b.startFrame < start + windowSize && b.startFrame + b.durationInFrames > start).length;
    if (inWindow < 4 || inWindow > 8) failures.push(`beat density ${inWindow} in window ${start}-${start + windowSize} (need 4-8)`);
  }

  // 2. Statement ratio.
  const statements = beats.filter((b) => b.archetype === "STATEMENT").length;
  if (statements / n > MAX_STATEMENT_RATIO) {
    failures.push(`STATEMENT ratio ${(statements / n).toFixed(2)} > ${MAX_STATEMENT_RATIO}`);
  }

  // 3. Repetition — no archetype >2× consecutively.
  for (let i = 2; i < n; i++) {
    if (beats[i].archetype === beats[i - 1].archetype && beats[i].archetype === beats[i - 2].archetype) {
      failures.push(`archetype ${beats[i].archetype} repeats 3× at beat ${i}`);
    }
  }

  // 4. Hold floor — no beat below D.hold (45f). 1 frame of tolerance covers
  //    sub-frame rounding at SRT caption boundaries. The §3.3 char-based hold
  //    is a readability TARGET; audio (SRT) is the source of truth.
  for (const b of beats) {
    if (b.durationInFrames < MIN_BEAT_FRAMES - 1) {
      failures.push(`beat "${b.text}" holds ${b.durationInFrames}f < floor ${MIN_BEAT_FRAMES}f`);
    }
  }

  // 5. Word count.
  for (const b of beats) {
    if (wordCount(b.text) > MAX_WORDS_PER_BEAT) {
      failures.push(`beat "${b.text}" has ${wordCount(b.text)} words > ${MAX_WORDS_PER_BEAT}`);
    }
  }

  // MOTION-GRAPHICS-MANUAL.md H3 — every beat has exactly one anchor token.
  if (opts.requireAnchorTokens) {
    for (const b of beats) {
      if (!Number.isInteger(b.anchorTokenIndex) || b.anchorTokenIndex < 0 || b.anchorTokenIndex >= (b.wordTokens || []).length) {
        failures.push(`beat "${b.text}" has invalid anchorTokenIndex ${b.anchorTokenIndex}`);
      } else if (!Number.isInteger(b.anchorFrame)) {
        failures.push(`beat "${b.text}" has no anchorFrame`);
      }
    }
  }

  // 7. Duration — beats + tail ≥ audio length (caller passes audioFrames).
  //    Small tolerance covers overlapping SRT captions and tail silence.
  if (opts.audioFrames) {
    const total = beats.reduce((s, b) => s + b.durationInFrames, 0);
    if (total < opts.audioFrames - 6) failures.push(`beat total ${total}f < audio ${opts.audioFrames}f`);
  }

  return { pass: failures.length === 0, failures };
}

export function logBeatTimeline(beats) {
  console.log(`Beat timeline: ${beats.length} beats`);
  for (const b of beats) {
    console.log(
      `  [${String(b.startFrame).padStart(5)} → ${String(b.startFrame + b.durationInFrames).padStart(5)}] ${b.sectionIndex >= 0 ? "sec" + b.sectionIndex + " " : ""}${b.archetype.padEnd(12)} "${b.text}"`
    );
  }
}
