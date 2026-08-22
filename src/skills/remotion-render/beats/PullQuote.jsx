import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { D, MG_TYPE } from "../compositions/beats.js";
import { fontStyleFor, measureText } from "../layout/measure.js";

/**
 * PULL_QUOTE — a full sentence held on screen at once, with exactly one
 * semantically-dominant word in accent colour and the rest neutral. This is
 * the "colored-highlight" caption pattern (Hormozi-style: "large white
 * uppercase text with one or two key words highlighted in a bright color"),
 * deliberately distinct from this pipeline's existing bottom-anchored
 * CAPTION layer (motion-graphics.jsx CaptionLayer/CaptionToken), which is a
 * word-by-word "karaoke" active-word highlighter gated by CHECK-REGISTER
 * TYP-12 ("exactly one active caption token per frame"). PULL_QUOTE does not
 * touch that system, does not advance per-word, and is not subject to
 * TYP-12 — it shows the whole sentence for one continuous hold.
 *
 * NOT WIRED into the live classifier/render path (compositions/beats.js
 * classifyBeat, compositions/mg-package.js deriveScene, or
 * compositions/motion-graphics.jsx's StageScene switch) — same status as
 * every one of the 8 existing beats/** archetypes today (HeroNumber,
 * Contrast, Statement, Progress, TermDefine, Relation, ListItem, ImageBeat):
 * CHECK-REGISTER LAY-01/LAY-12 = N/B confirms the whole `rects`/`stage`
 * "compiled rect" system beats/** belongs to is built and audited but not
 * production-wired; only compositions/motion-graphics.jsx's inline-styled
 * Scene functions render today. This file follows that same, already-
 * precedented shape (a real, renderable, independently-verifiable
 * component) rather than forcing a new path into the live one. Two real
 * blockers stand between this and being classifier-reachable, found while
 * scoping this file — recorded here rather than silently:
 *   1. MOTION-GRAPHICS-MANUAL.md G2: "A channel MUST NOT introduce a new...
 *      archetype... it goes in this manual for all [every mg] channel[s] or
 *      it doesn't ship" — a single-file addition cannot satisfy that; it
 *      needs a Part F entry (F1-F8 format) plus sign-off the same way any
 *      of the other 8 archetypes has one.
 *   2. beats.js's MAX_WORDS_PER_BEAT (7) and MAX_BEAT_FRAMES (96, ~3.2s) are
 *      pipeline-wide constants applied during beat CONSTRUCTION, before
 *      classifyBeat ever runs — a ~10-word / ~3-4s pull-quote sentence is
 *      already split into 2+ beats and exceeds the frame ceiling before an
 *      archetype could be assigned. Loosening either constant affects all 8
 *      existing archetypes, not just this one; out of scope for this file.
 *
 * Verified with: node data/audit/12/pull-quote-probe.mjs — renders this
 * component standalone through the real Remotion renderer (real fonts
 * loaded via wait-for-fonts.js) on both a tnum (Inter) and non-tnum (DM
 * Sans) family, and asserts word-wrap (<=2 lines) and exactly one accent-
 * coloured word against the real DOM, not just the arithmetic. Passed in
 * this sandbox (chromium_headless_shell, see the probe's PROBE_CHROME
 * env var) — data/audit/12/out/*.png and pull-quote-report.json are the
 * evidence, committed alongside this file rather than claimed without it.
 * The same session run also re-verified HeroNumber.jsx's A1.3 fix below
 * (DM Sans offsetWidth: 599/646 jitter pre-fix -> 648/648 stable post-fix,
 * real render, not simulated).
 */

const E_OUT = Easing.bezier(0.16, 1, 0.3, 1);
// Exit easing mirrors motion-graphics.jsx's E_IN — the vetted settle curve
// CaptionLayer's own exit uses (see popStyle/exit note below).
const E_IN = Easing.bezier(0.33, 0, 0.67, 1);

function ease(frame, inputRange, outputRange, easing = E_OUT) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

function easeScale(frame, inputRange, outputRange, easing = E_OUT) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
    output: "perceptual-scale",
  });
}

// Function words a stressed/emphasised word essentially never is — kept
// deliberately small and closed-class (articles, conjunctions, prepositions,
// pronouns, auxiliary/copular verbs) rather than a broad "stopword list",
// so a genuine content word is never accidentally excluded.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "for", "yet", "so",
  "of", "to", "in", "on", "at", "by", "from", "with", "as", "into", "onto",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "it", "its", "this", "that", "these", "those",
  "he", "she", "they", "we", "you", "i", "them", "him", "her", "his", "their", "our", "your", "my",
  "not", "no", "do", "does", "did", "done",
  "has", "have", "had", "will", "would", "can", "could", "should", "may", "might", "must",
  "than", "then", "there", "here", "if", "when", "while", "which", "who", "whom", "what", "how",
]);

/**
 * Picks the single most emphasis-worthy word: prefer a token carrying a
 * digit (a punchy pull-quote sentence is usually built around a stat), else
 * the longest remaining content word (a defensible proxy for information
 * density — this is a heuristic over TEXT, not real prosodic/TTS stress
 * data, and is documented as exactly that; a caller with real stress
 * markers should pass `emphasisIndex` explicitly instead of relying on
 * this). Ties break on the LAST match — the emphatic word in a short
 * declarative sentence tends to land late ("...costs families $12,000",
 * not "$12,000 costs..."). Returns -1 (no emphasis) if every word is a
 * stopword/punctuation-only.
 *
 * Known limitation, observed on a real render (data/audit/12): the digit
 * regex only matches literal digit characters, so a spelled-out number
 * ("twelve thousand dollars") never triggers the digit-preference branch —
 * "This one change quietly saved most families twelve thousand dollars"
 * picked "thousand" (a longest-word tie-break against "families") rather
 * than a more obviously stat-carrying span. Detecting spelled-out numeric
 * phrases would need real tokenization/NLP, which this pure, dependency-
 * free heuristic deliberately doesn't attempt — pass `emphasisIndex`
 * explicitly for sentences where that gap matters.
 */
export function chooseEmphasisIndex(words) {
  const candidates = [];
  for (let i = 0; i < words.length; i++) {
    const bare = String(words[i]).replace(/[^\w%$.,'-]/g, "");
    if (bare.length === 0 || STOPWORDS.has(bare.toLowerCase())) continue;
    candidates.push({ i, bare });
  }
  if (candidates.length === 0) return -1;
  const withDigit = candidates.filter((c) => /\d/.test(c.bare));
  const pool = withDigit.length > 0 ? withDigit : candidates;
  let best = pool[0];
  for (const c of pool) {
    if (c.bare.length >= best.bare.length) best = c;
  }
  return best.i;
}

/**
 * Reading-speed hold duration, in frames — pure arithmetic, no
 * measurement/DOM dependency. Two floors, both from professional subtitle
 * standards, take the larger (a sentence must clear BOTH):
 *   - BBC: 160-180 WPM -> minimum ~0.3s per word (a caption "left on screen
 *     for a minimum period of around 0.3 seconds per word").
 *   - Professional sweet spot: ~15 characters/second (180 WPM ~= 15 CPS);
 *     this pipeline's own caption gate already enforces the same 15 CPS
 *     ceiling for its (different) caption system (beats.js CAPTION_LIMITS
 *     .maxCPS) — reused here as the same vetted number, not a new one.
 * Floored at D.hold (this pipeline's existing "minimum on-screen time for
 * readable text", beats.js:23) and capped at 5000ms — the upper bound of
 * this pipeline's own caption-page duration gate (TYP-08, 833-5000ms) is
 * the nearest already-vetted answer to "how long can on-screen text hold"
 * in this codebase, reused rather than inventing a separate ceiling.
 */
export function pullQuoteHoldFrames(text, fps) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return D.hold;
  const minByWords = Math.ceil(words.length * 0.3 * fps);
  const minByCps = Math.ceil((text.length / 15) * fps);
  const maxFrames = Math.round(5 * fps);
  return Math.min(Math.max(minByWords, minByCps, D.hold), maxFrames);
}

/** Greedily wraps `words` at `fontSize`, measuring real advance widths
 *  (never estimated) — returns lines as {text, indices} so the caller can
 *  recolour any single word by its ORIGINAL index regardless of which line
 *  it lands on. */
function greedyWrapPQ(words, fontStyle, fontSize, maxWidth) {
  const lines = [];
  let text = "";
  let indices = [];
  for (let i = 0; i < words.length; i++) {
    const candidate = text ? `${text} ${words[i]}` : words[i];
    const width = measureText({ text: candidate, ...fontStyle, fontSize }).width;
    if (width <= maxWidth || !text) {
      text = candidate;
      indices = [...indices, i];
    } else {
      lines.push({ text, indices });
      text = words[i];
      indices = [i];
    }
  }
  if (text) lines.push({ text, indices });
  return lines;
}

/**
 * Finds the largest font size (stepping down from maxFontSize to
 * minFontSize) whose greedy wrap fits within maxLines — verified directly
 * against measureText on the ACTUAL wrapped lines, never against a library
 * fit estimate. HeadlineBox (motion-graphics.jsx:638-668) hit a real,
 * confirmed defect from trusting `fitTextOnNLines`'s own returned
 * fontSize/lines without re-verifying them ("ACCOUNTS EARLY" running off
 * the canvas edge while the library claimed a one-line fit at 84px inside a
 * 780px box) — this function sidesteps that failure mode entirely by never
 * calling fitTextOnNLines: greedyWrapPQ's per-candidate-line measureText
 * check is the same "reliable primitive" that file's fix fell back to,
 * used here as the primary path instead of a fallback.
 */
function fitQuoteText(words, fontStyle, maxBoxWidth, maxLines, maxFontSize, minFontSize) {
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const lines = greedyWrapPQ(words, fontStyle, fontSize, maxBoxWidth);
    if (lines.length <= maxLines) return { fontSize, lines };
  }
  // Floor reached and it still doesn't fit maxLines — hold the floor size
  // and let it run long rather than truncating words the voiceover said.
  return { fontSize: minFontSize, lines: greedyWrapPQ(words, fontStyle, minFontSize, maxBoxWidth) };
}

/**
 * @param {object} props
 * @param {{x:number,y:number,w:number,h:number}} props.stage
 * @param {object} props.colors     palette roles (paletteFromHues keys)
 * @param {number} [props.anchorFrame] beat-relative anchor token frame
 * @param {number} [props.frame]    beat-relative frame (default useCurrentFrame)
 * @param {string} props.text       the full sentence, verbatim from the
 *                                  voiceover/script — never truncated
 * @param {number} [props.emphasisIndex] explicit word index to accent
 *                                  (0-based, whitespace-split); omit to use
 *                                  chooseEmphasisIndex's heuristic
 * @param {string} [props.fontFamily]
 */
export function PullQuote({
  stage,
  colors,
  anchorFrame = 0,
  frame: frameProp,
  text = "",
  emphasisIndex,
  fontFamily = "Inter",
  ...rest
}) {
  const frame = frameProp ?? useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const tA = Math.max(anchorFrame, 0);
  const start = Math.max(tA - D.short, 0);
  const emphasisI = emphasisIndex != null ? emphasisIndex : chooseEmphasisIndex(words);

  const holdFrames = pullQuoteHoldFrames(text, fps);
  const exitAt = start + holdFrames;

  const fontStyle = fontStyleFor(fontFamily, { fontWeight: 800 });
  const maxBoxWidth = Math.max(stage.w - 96, 200); // matches this file family's ~48-96px stage insets
  const fit = fitQuoteText(words, fontStyle, maxBoxWidth, 2, MG_TYPE.headline, MG_TYPE.support);

  // Motion — CaptionLayer's vetted idiom (motion-graphics.jsx PART 10 note):
  // running text never opacity-fades in this pipeline (a full fade
  // measurably dropped rendered contrast below 4.5:1 on caption text — the
  // exact same class of element this is). Scale + translate carry
  // entrance/exit instead; opacity stays 1 throughout.
  const rel = frame - start;
  const exitRel = exitAt - frame;
  const popScale = easeScale(rel, [0, 5, 8], [0.88, 1.04, 1.0], E_OUT);
  const popTranslateY = ease(rel, [0, 6], [14, 0], E_OUT);
  const exitScale = exitRel <= 3 && exitRel > 0 ? easeScale(exitRel, [0, 3], [1, 0.97], E_IN) : 1;

  const cx = stage.x + stage.w / 2;
  const cy = stage.y + stage.h / 2;

  return (
    <div
      {...rest}
      data-role="pull-quote"
      data-hold-end={exitAt}
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        // Centring (-50%/-50%) and the entrance rise (popTranslateY) must be
        // ONE translate value, not two separate declarations — a second
        // `translate` silently replaces the first on spread instead of
        // combining with it (the exact bug HeadlineBox's own PART 10 note
        // documents finding here first).
        translate: `-50% calc(-50% + ${popTranslateY}px)`,
        width: "max-content",
        maxWidth: maxBoxWidth,
        textAlign: "center",
        scale: `${popScale * exitScale}`,
        transformOrigin: "center",
      }}
    >
      <div style={{ ...fontStyle, fontSize: fit.fontSize, lineHeight: 1.18, whiteSpace: "pre-wrap" }}>
        {fit.lines.map((line, li) => (
          <div key={li} data-role="pull-quote-line">
            {line.indices.map((globalIndex, wi) => (
              // A literal space as a sibling text node, not baked into the
              // span — adjacent inline-block-free spans with no text node
              // between them render with NO gap at all, a real defect this
              // pipeline already hit and fixed once for captions
              // (CaptionLine, motion-graphics.jsx ~:508-513); same fix here.
              <React.Fragment key={globalIndex}>
                {wi > 0 ? " " : ""}
                <span style={{ color: globalIndex === emphasisI ? colors.accent : colors.textPrimary }}>
                  {words[globalIndex]}
                </span>
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PullQuote;
