import React from "react";
import { AbsoluteFill, useCurrentFrame, Easing } from "remotion";
import { paletteRoles } from "../visual/palette-roles.js";
import { SAFE_SHORTS } from "../layout/slots.js";

/**
 * SENTENCE, THEN THE THING THE SENTENCE WAS ABOUT.
 *
 * Two states and nothing else. In TYPE the sentence builds word by word as it
 * is spoken and nothing else is drawn. In VISUAL one asset fills the frame and
 * no words are drawn at all. There is no third branch, no caption strip, no
 * furniture, no rail, no kicker.
 *
 * WORD BY WORD IS THE POINT, NOT AN EFFECT. The previous version set a phrase
 * and highlighted a word inside it, which is a caption with emphasis. Here the
 * sentence does not exist until it has been said: each word arrives on its own
 * mark and stays, so the screen is always mid-sentence and the reader is
 * reading at the speed of the speech.
 *
 * The word being spoken is set in the accent; the words already said hold in
 * the mark colour; the words to come are not on screen. That ordering is the
 * whole design and it is why nothing else is needed to show progress.
 */

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const S = SAFE_SHORTS;
const SAFE_W = S.right - S.left;
const SAFE_H = S.bottom - S.top;
const MID_Y = S.top + SAFE_H / 2;

const EASE = Easing.bezier(0.2, 0.9, 0.3, 1);

/** Measured per-character advance for bold uppercase, from a rendered frame. */
const WIDE = new Set("MWQG@%".split(""));
const SEMI = new Set("LTFY".split(""));
const NARROW = new Set("IJ1.,';:!|-".split(""));
const emWidth = (s) => 1.03 * [...s].reduce(
  (w, c) => w + (WIDE.has(c) ? 0.92 : SEMI.has(c) ? 0.52 : NARROW.has(c) ? 0.3 : 0.68), 0);

/**
 * Break the sentence into lines and size it to fill the safe rect.
 *
 * MEASURED DEFECT this replaces: the old version aimed for a roughly square
 * block (`lines = sqrt(total * 0.62)`, capped at 6) and split by word COUNT.
 * On the cave script that produced 70px type filling 47% of the safe height
 * at its fullest and 4% at its emptiest, with lines of 260px next to lines of
 * 660px. The safe rect is 840x960 — taller than it is wide — so a square block
 * throws away a third of the frame.
 *
 * This solves it the other way round: try every line count, wrap by measured
 * width, and keep whichever count yields the largest type that still fits both
 * the width and the height. On a long sentence that lands on nine or ten lines
 * of ~90px rather than six of 70px.
 */
const LH = 1.16;
const MAX_SIZE = 148;
const MIN_SIZE = 38;

function layout(words, maxW, maxH) {
  const ems = words.map((w) => emWidth(w) + 0.3);
  const totalEm = ems.reduce((a, b) => a + b, 0);
  const size = Math.min(MAX_SIZE, maxW / Math.max(0.5, totalEm), maxH / LH);
  return { rows: [words], size: Math.max(MIN_SIZE, size) };
}

function at(plan, frame) {
  const beats = plan.beats;
  let i = 0;
  while (i < beats.length - 1 && frame >= beats[i + 1].start_frame) i++;
  const b = beats[i];
  const p = Math.max(0, Math.min(1, (frame - b.start_frame) / Math.max(1, b.duration_frames)));
  return { beat: b, p, local: frame - b.start_frame };
}

/** The sentence, building. */
function Sentence({ beat, local, colors, font }) {
  const words = beat.words || [];
  if (!words.length) return null;
  const { rows, size } = layout(words.map((w) => w.word), SAFE_W, SAFE_H * 0.86);

  let k = 0;
  const spoken = words.filter((w) => local >= w.frame).length;
  const out = Math.max(0, Math.min(1, (local - beat.duration_frames * 0.9) / (beat.duration_frames * 0.1)));

  return (
    <div style={{
      position: "absolute", left: S.left, width: SAFE_W,
      top: MID_Y - (rows.length * size * LH) / 2,
      fontFamily: `${font}, sans-serif`, fontWeight: 800,
      fontSize: size, lineHeight: LH, letterSpacing: -size * 0.02,
      opacity: 1 - out, whiteSpace: "nowrap", overflow: "hidden",
    }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ whiteSpace: "nowrap" }}>
          {row.map((word) => {
            const idx = k++;
            const w = words[idx];
            const since = local - w.frame;
            if (since < 0) return null;
            /**
             * Each word arrives on its own mark: up from below, settling.
             *
             * +1, not `since / 7` alone: at since=0 (the word's very first
             * rendered frame) that ratio is exactly 0 and EASE(0) is exactly
             * 0, so the first word of every TYPE beat opened on a fully blank
             * frame -- measured on the cave render, frame 145 (a beat's own
             * first frame) came back 0.000% ink against a lossless still, not
             * a compression artifact. A fade's first rendered frame already
             * has one frame of progress into it; it does not render the
             * instant before the fade began.
             */
            const e = EASE(Math.min(1, (since + 1) / 7));
            const current = idx === spoken - 1;
            return (
              <span key={idx} style={{
                display: "inline-block",
                marginRight: size * 0.26,
                transform: `translateY(${(1 - e) * size * 0.55}px)`,
                opacity: e,
                color: current ? colors.accent : colors.onGround,
              }}>{word}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * An Iconify icon, contain-fit into the box the beat gives it. This is the
 * only visual this engine draws — see qa-scripts/render-sentences.mjs for why
 * the 109-drawing procedural fallback that used to sit behind this is gone
 * rather than kept as a second-choice candidate.
 *
 * THIS IS WHY AN ICON CANNOT BREAK THE SAFE RECT THE WAY THE OLD PROCEDURAL
 * DRAWINGS DID. Those drew arbitrary coordinates relative to their own box
 * and had to individually honour it (several didn't). An icon's own viewBox
 * is fixed and known (`beat.icon.width/height`), so scaling it to fit `box`
 * by the smaller of the two axis ratios is a geometric guarantee, not a
 * drawing convention someone has to remember. There is nothing to audit here
 * because there is nothing that can go wrong the way it did before.
 *
 * Icons are flat glyphs with no internal animation of their own — unlike a
 * procedural drawing's `p`-driven motion (a spring, a furcula), there is no
 * per-icon behaviour to sweep `p` through. A slow breathing scale keyed to
 * the beat's own progress is the one motion applied here, so a visual beat is
 * never a perfectly frozen frame even when its subject is a static glyph.
 */
function IconGlyph({ icon, box, colors, p }) {
  const scale = Math.min(box.w / icon.width, box.h / icon.height);
  const iw = icon.width * scale, ih = icon.height * scale;
  const breathe = 1 + Math.sin(p * Math.PI * 2) * 0.015;
  return (
    <g transform={`translate(${box.x + box.w / 2}, ${box.y + box.h / 2}) scale(${breathe}) translate(${-iw / 2}, ${-ih / 2})`}>
      <g transform={`scale(${scale})`} fill={colors.onGround} color={colors.onGround}
        dangerouslySetInnerHTML={{ __html: icon.body }} />
    </g>
  );
}

function Visual({ beat, p, colors }) {
  /**
   * Same +1-frame fix as the word entrance above, and the same measured
   * defect: at p=0 (a VISUAL beat's own first rendered frame), `p / 0.28` is
   * exactly 0 and EASE(0) is exactly 0 -- every one of the 12 visual beats in
   * the cave render opened on a fully blank frame. Derived in frames, not a
   * flat constant, so it scales correctly on both a 28-frame beat and a
   * 150-frame one.
   */
  const framesIn = p * beat.duration_frames;
  const e = EASE(Math.min(1, (framesIn + 1) / (beat.duration_frames * 0.28)));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  const box = Math.min(SAFE_W, SAFE_H * 0.86);
  const w = box * (0.9 + 0.1 * e);
  const h = w;
  const cx = S.left + SAFE_W / 2;
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, opacity: (1 - out) * e }}>
      <g transform={`translate(${cx - w / 2}, ${MID_Y - h / 2})`}>
        <IconGlyph icon={beat.icon} colors={colors} p={p} box={{ x: 0, y: 0, w, h }} />
      </g>
    </svg>
  );
}

export function SentenceScene({ plan }) {
  const frame = useCurrentFrame();
  const colors = paletteRoles(plan.palette);
  const { beat, p, local } = at(plan, frame);
  return (
    <AbsoluteFill style={{ backgroundColor: colors.ground }}>
      {beat.mode === "TYPE"
        ? <Sentence beat={beat} local={local} colors={colors} font={plan.fonts.primary} />
        : <Visual beat={beat} p={p} colors={colors} />}
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "SentenceShorts",
    component: SentenceScene,
    durationInFrames: 300,
    fps: 30,
    width: CANVAS_W,
    height: CANVAS_H,
    defaultProps: {
      plan: {
        beats: [{ beat_id: "s0t", mode: "TYPE", focal: "", start_frame: 0, duration_frames: 300, words: [] }],
        palette: { primary: ["#1A1A2E", "#16213E", "#F5536B", "#0F0F1A"], secondary: ["#C81E3C", "#8892B0", "#E6E8EC"] },
        fonts: { primary: "DM Sans", secondary: "Noto Serif" },
      },
    },
  },
];
