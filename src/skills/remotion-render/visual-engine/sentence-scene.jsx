import React from "react";
import { AbsoluteFill, useCurrentFrame, Easing } from "remotion";
import { ObjectShape } from "../compositions/objects/registry.js";
import "../compositions/objects/index.jsx";
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

/** Greedy wrap into exactly n lines, aiming at an even measure per line. */
function wrapInto(ems, n) {
  const total = ems.reduce((a, b) => a + b, 0);
  const target = total / n;
  const rows = [];
  let row = [], acc = 0;
  for (let i = 0; i < ems.length; i++) {
    const left = ems.length - i;          // words still unplaced
    const need = n - rows.length;          // lines still to fill
    // Break when this line has met its share, but never strand a later line
    // with no words and never overfill the last line.
    if (row.length && (acc + ems[i] / 2 > target && need > 1) && left >= need) {
      rows.push(row); row = []; acc = 0;
    }
    row.push(i); acc += ems[i];
  }
  if (row.length) rows.push(row);
  return rows.length === n ? rows : null;
}

function layout(words, maxW, maxH) {
  const ems = words.map((w) => emWidth(w) + 0.3);
  let best = null;
  for (let n = 1; n <= Math.min(14, words.length); n++) {
    const idx = wrapInto(ems, n);
    if (!idx) continue;
    const widest = idx.reduce((m, r) => Math.max(m, r.reduce((a, i) => a + ems[i], 0)), 0.5);
    const size = Math.min(MAX_SIZE, maxW / widest, maxH / (n * LH));
    if (!best || size > best.size) best = { size, rows: idx.map((r) => r.map((i) => words[i])) };
  }
  if (!best) return { rows: [words], size: MIN_SIZE };
  return { rows: best.rows, size: Math.max(MIN_SIZE, best.size) };
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
      opacity: 1 - out,
    }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ whiteSpace: "nowrap" }}>
          {row.map((word) => {
            const idx = k++;
            const w = words[idx];
            const since = local - w.frame;
            if (since < 0) return null;
            // Each word arrives on its own mark: up from below, settling.
            const e = EASE(Math.min(1, since / 7));
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
 * The asset, filling the frame. Nothing else is drawn on a visual beat.
 *
 * MEASURED DEFECT this fixes: the drawing used to be handed `p = max(0.15, e)`
 * where `e` saturates at 1 after the first third of the beat, so the drawing's
 * own clock stopped there. On the cave script's springtail beat (143 frames)
 * frames 1230 and 1241 came back pixel-identical — bounding box 72,600
 * 730x403 and 4.31% ink on both — and the frozen stretch ran 74 frames, 2.5
 * seconds. That is the slideshow the rebuild exists to kill.
 *
 * The drawing now gets the beat's own linear progress, so a drawing written
 * against `p` runs its full cycle across the beat: the springtail's furcula is
 * `sin(p * 2PI)`, and it now fires over the whole beat instead of once in the
 * first third and then holding. 89 of the 100 drawings reference `p`.
 *
 * The entrance envelope is kept separate as `e` and only drives opacity and
 * the settle in scale — it must not be the drawing's clock, which was the bug.
 */
/**
 * An Iconify icon, contain-fit into the same box a procedural drawing gets.
 *
 * THIS IS WHY AN ICON CANNOT BREAK THE SAFE RECT THE WAY 16 OF THE 109
 * PROCEDURAL DRAWINGS DID. Those drew arbitrary coordinates relative to their
 * own box and had to individually honour it (qa-scripts/audit-object-bounds.mjs
 * exists because several didn't). An icon's own viewBox is fixed and known
 * (`beat.icon.width/height`), so scaling it to fit `box` by the smaller of the
 * two axis ratios is a geometric guarantee, not a drawing convention someone
 * has to remember. There is nothing to audit here because there is nothing
 * that can go wrong the way it did before.
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
  const e = EASE(Math.min(1, p / 0.28));
  const out = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  const box = Math.min(SAFE_W, SAFE_H * 0.86);
  const w = box * (0.9 + 0.1 * e);
  const h = w;
  const cx = S.left + SAFE_W / 2;
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, opacity: (1 - out) * e }}>
      <g transform={`translate(${cx - w / 2}, ${MID_Y - h / 2})`}>
        {beat.icon
          ? <IconGlyph icon={beat.icon} colors={colors} p={p} box={{ x: 0, y: 0, w, h }} />
          : <ObjectShape name={beat.focal} colors={colors} p={p} box={{ x: 0, y: 0, w, h }} />}
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
