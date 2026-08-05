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

/** Hard safe rect — §2.1. Design to the Google numbers. */
export const SAFE = { top: 288, bottom: 1248, left: 48, right: 888 };
/** Optical centre for a Short — §2.3. Right margin is 4× the left. */
export const OPTICAL_CENTER_X = 468;

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
export const OPTICAL_CENTRE_X = 468; // NOT 540 — right margin is 4x the left
export const OPTICAL_CENTRE_Y = 768; // (288 + 1248) / 2

// MOTION-GRAPHICS-MANUAL.md B2 — caption geometry.
export const CAPTION = {
  zoneTop: 1148,
  zoneBottom: 1248,
  anchor: "bottom",
  maxWidth: 780,
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
