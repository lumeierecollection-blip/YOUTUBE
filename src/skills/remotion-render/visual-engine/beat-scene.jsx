import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { ObjectShape } from "../compositions/objects/registry.js";
import "../compositions/objects/index.jsx";
import { paletteRoles } from "../visual/palette-roles.js";
import { SAFE_SHORTS } from "../layout/slots.js";

/**
 * ONE PERFORMER AT A TIME.
 *
 * The version this replaces drew a display line, a supporting line, a caption
 * and a stage of three objects simultaneously. That is an animated infographic:
 * four things asking for the eye, none of them large enough to be the subject.
 *
 * Here every beat declares an owner and this file draws only that owner.
 *
 *   TYPE  the words fill the frame. No objects at all — not dimmed, not small,
 *         none. The type is sized to the width it has.
 *   HERO  one object fills the frame. The kinetic line is gone; only the small
 *         caption remains, and it is deliberately quiet.
 *
 * There is no branch in which both are drawn, and the beat model makes that
 * unrepresentable rather than merely discouraged: a TYPE beat carries an empty
 * actor list.
 *
 * MOTION IS THE SENTENCE'S. `hero_action` comes from the verb, so "deeper"
 * descends and "disappeared" disappears. A beat with no verb cue gets SETTLE,
 * which is weight and a slow drift, rather than a borrowed animation.
 */

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const S = SAFE_SHORTS;
const SAFE_W = S.right - S.left;
const SAFE_H = S.bottom - S.top;
const MID_Y = S.top + SAFE_H / 2;

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);

function at(plan, frame) {
  const beats = plan.beats;
  let i = 0;
  while (i < beats.length - 1 && frame >= beats[i + 1].start_frame) i++;
  const b = beats[i];
  const p = Math.max(0, Math.min(1, (frame - b.start_frame) / Math.max(1, b.duration_frames)));
  return { beat: b, prev: beats[i - 1] || null, p };
}

/**
 * Type set to the width it has, not to a fixed size.
 *
 * A fixed 108px made a short word look timid and a long one overflow. The
 * advance of a bold grotesque is about 0.56em per character, so the size that
 * fills the safe width is width / (chars * 0.56), clamped so one very long word
 * does not shrink to nothing and one very short word does not become absurd.
 */
/**
 * Per-character advance for bold uppercase, as ems.
 *
 * MEASURED, after a flat 0.56 put "ALONE" 98px past the right edge of the safe
 * rect at 300px — the measured advance on that render was 0.625, and a flat
 * average is wrong anyway because M and W are twice the width of I. These
 * weights are relative to a 0.64 default, which is the measured figure with a
 * small margin.
 */
const WIDE = new Set("MWQG@%".split(""));
const SEMI = new Set("LTFY".split(""));
const NARROW = new Set("IJ1.,';:!|-".split(""));
/**
 * Second correction. Treating uppercase L as narrow at 0.34 was wrong — in a
 * bold grotesque it is about 0.52 — and it dragged "ALONE" 66px past the safe
 * rect even after the first fix. The 1.03 factor makes every estimate err small,
 * because a word that fits with a hair to spare is invisible and a word that
 * overruns is a gate failure.
 */
const emWidth = (s) => 1.03 * [...s].reduce(
  (w, c) => w + (WIDE.has(c) ? 0.92 : SEMI.has(c) ? 0.52 : NARROW.has(c) ? 0.30 : 0.68), 0);

function fitLines(text, maxWidth, maxHeight) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [], size: 0 };
  // One word per line: a stack is what fills a 9:16 frame. Laid out as a
  // paragraph, three words came to one line 136px tall in a frame 1920 deep.
  const lines = words.slice(0, 3);
  const widest = lines.reduce((m, l) => Math.max(m, emWidth(l)), 0.5);
  const byWidth = maxWidth / widest;
  const byHeight = maxHeight / (lines.length * 1.06);
  const size = Math.max(72, Math.min(300, Math.min(byWidth, byHeight)));
  return { lines, size };
}

/** The type owner: the words, filling the frame, doing what the intent asks. */
function TypeStage({ beat, p, colors, font }) {
  const st = beat.typography_state || {};
  const text = beat.focal_element || st.primary_text || "";
  // The type may use the whole safe rect minus the caption's own strip.
  const { lines, size } = fitLines(text, SAFE_W, SAFE_H - 150);
  if (!lines.length) return null;

  const inE = EASE(Math.min(1, p / 0.34));
  const outE = Math.max(0, Math.min(1, (p - 0.88) / 0.12));
  const action = beat.typography_action || "SCALE";

  const wrap = { position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - (lines.length * size * 1.02) / 2 };
  const base = {
    color: colors.onGround, fontFamily: `${font}, sans-serif`, fontWeight: 800,
    fontSize: size, lineHeight: 1.02, letterSpacing: -size * 0.03, margin: 0,
  };

  /** Per-line motion, so the words arrive as words rather than as a block. */
  const lineStyle = (li) => {
    const stagger = EASE(Math.max(0, Math.min(1, (p - li * 0.06) / 0.34)));
    const s = { ...base, opacity: (1 - outE) * stagger };
    switch (action) {
      // Slides in from the left edge of the safe rect, never from outside it.
      case "SLIDE": s.transform = `translateX(${(1 - stagger) * -SAFE_W * 0.18}px)`; s.opacity *= stagger; break;
      case "SCALE": s.transform = `scale(${0.7 + 0.3 * stagger})`; s.transformOrigin = "left center"; break;
      case "REVEAL": s.clipPath = `inset(0 ${(1 - stagger) * 100}% 0 0)`; s.opacity = 1 - outE; break;
      /**
       * EXPLODE and SPLIT both used to animate OUTWARD, and the line is already
       * sized to exactly fill the safe width — so any outward motion put it
       * outside. Measured, the typographic split reached x[22,966] against a
       * safe rect of [48,888]. Both now resolve INWARD to the fitted width:
       * the letters open from tight rather than closing from wide, and the
       * lines converge vertically rather than sliding in from the sides.
       */
      case "EXPLODE": s.letterSpacing = `${-size * (0.03 + 0.22 * (1 - stagger))}px`; break;
      case "COLLAPSE": s.transform = `scaleY(${0.4 + 0.6 * stagger})`; s.transformOrigin = "center bottom"; break;
      case "REPLACE": s.transform = `translateY(${(1 - stagger) * size * 0.9}px)`; break;
      case "SPLIT": s.transform = `translateY(${(li % 2 ? 1 : -1) * (1 - stagger) * size * 0.8}px)`; break;
      default: s.transform = `scale(${0.9 + 0.1 * stagger})`; break;
    }
    return s;
  };

  return (
    <div style={wrap}>
      {/* STRIKE draws a rule through the word this one displaces, then clears it */}
      {action === "STRIKE" && st.replaces && p < 0.55 && (
        <div style={{ ...base, fontSize: size * 0.5, opacity: 0.42 * (1 - p / 0.55), position: "relative", marginBottom: size * 0.18 }}>
          {st.replaces}
          <span style={{
            position: "absolute", left: 0, top: "48%", height: Math.max(5, size * 0.05),
            width: `${Math.min(1, p / 0.4) * 100}%`, background: colors.accent,
          }} />
        </div>
      )}
      {lines.map((l, li) => <div key={li} style={lineStyle(li)}>{l}</div>)}
      {/* one accent rule under the word: the only mark allowed to share a TYPE beat */}
      <div style={{
        marginTop: size * 0.22, height: Math.max(6, size * 0.055),
        width: `${inE * 46}%`, background: colors.accent, opacity: 1 - outE,
      }} />
    </div>
  );
}

/**
 * The visual owner: ONE object, at a size that makes it the subject, moving the
 * way the sentence says.
 */
function HeroStage({ beat, p, colors }) {
  const a = (beat.actors || [])[0];
  if (!a) return null;
  const action = beat.hero_action || "SETTLE";
  const e = EASE(Math.min(1, p / 0.42));
  const eio = EASE_IO(p);
  const out = Math.max(0, Math.min(1, (p - 0.9) / 0.1));

  if (a.type === "number") {
    const target = Number(a.value);
    const shown = Number.isFinite(target) && target > 0
      ? Math.round(target * EASE_IO(Math.min(1, p / 0.72))).toLocaleString()
      : String(a.text || "");
    const size = Math.max(150, Math.min(400, SAFE_W / (String(shown).length * 0.58)));
    return (
      <div style={{
        position: "absolute", left: S.left, width: SAFE_W, top: MID_Y - size * 0.62,
        textAlign: "center", color: colors.accent, fontWeight: 800, fontSize: size,
        letterSpacing: -size * 0.04, fontVariantNumeric: "tabular-nums", opacity: 1 - out,
      }}>{shown}</div>
    );
  }

  /** The hero fills most of the frame. That is what makes it the hero. */
  const FULL = SAFE_W * 0.82;
  const draw = (w, x, y, opacity, rot = 0, name = a.object) => (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, opacity }}>
      <g transform={`translate(${x - w / 2}, ${y - (w * 1.02) / 2}) rotate(${rot} ${w / 2} ${w * 0.51})`}>
        <ObjectShape name={name} colors={colors} p={Math.max(0.2, e)} box={{ x: 0, y: 0, w, h: w * 1.02 }} />
      </g>
    </svg>
  );
  const cx = S.left + SAFE_W / 2;

  switch (action) {
    case "DESCEND":
      // the object travels down the frame, which is what "deeper" means
      return draw(FULL, cx, S.top + SAFE_H * (0.18 + 0.6 * eio), 1 - out);
    case "GROW":
      return draw(FULL * (0.28 + 0.72 * eio), cx, MID_Y, 1 - out);
    case "VANISH":
      // it actually goes: shrinks and fades to nothing by the end of the beat
      return draw(FULL * (1 - 0.55 * eio), cx, MID_Y, Math.max(0, 1 - eio * 1.15));
    case "SPLIT": {
      /**
       * Measured: at a 0.24 gap and 0.58 size the two halves reached x[22,966]
       * against a safe rect of [48,888] — the rotation adds about 8% to each
       * half's footprint and nothing accounted for it. Gap and size pulled in so
       * the rotated extent stays inside.
       */
      const gap = SAFE_W * 0.2 * eio;
      return (<>
        {draw(FULL * 0.5, cx - gap, MID_Y, 1 - out, -5 * eio)}
        {draw(FULL * 0.5, cx + gap, MID_Y, 1 - out, 5 * eio)}
      </>);
    }
    case "CONNECT": {
      const gap = SAFE_W * 0.26;
      const t = EASE_IO(Math.min(1, p / 0.8));
      return (<>
        {draw(FULL * 0.5, cx - gap, MID_Y, 1 - out)}
        <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
          <line x1={cx - gap + FULL * 0.24} y1={MID_Y} x2={cx - gap + FULL * 0.24 + (gap * 2 - FULL * 0.48) * t} y2={MID_Y}
            stroke={colors.accent} strokeWidth={10} strokeLinecap="round" opacity={0.95} />
        </svg>
        {draw(FULL * 0.5, cx + gap, MID_Y, (1 - out) * t)}
      </>);
    }
    case "TRANSFORM":
      // one thing becoming another IN PLACE, which is what makes it a
      // transformation rather than a cut to something else
      return (<>
        {draw(FULL, cx, MID_Y, Math.max(0, 1 - eio * 1.6))}
        {draw(FULL, cx, MID_Y, Math.max(0, (eio - 0.35) / 0.65) * (1 - out), 0, a.object)}
      </>);
    case "REVEAL_IN":
      return (<>
        {draw(FULL * (1 + 0.5 * eio), cx, MID_Y, (1 - out) * (1 - eio * 0.55))}
        {draw(FULL * 0.4 * eio, cx, MID_Y, (1 - out) * eio)}
      </>);
    default:
      // SETTLE — weight on arrival, then a slow live drift so it never freezes
      return draw(FULL * (0.9 + 0.1 * e), cx, MID_Y + Math.sin(p * Math.PI) * -18, 1 - out);
  }
}

/**
 * The caption. Small, bottom-left, and never the focal element. It exists so
 * the spoken words are legible with sound off; it is not the text layer.
 */
function Caption({ text, colors, font }) {
  if (!text) return null;
  return (
    <div style={{
      position: "absolute", left: S.left, width: SAFE_W * 0.8, top: S.bottom - 92,
      color: colors.onGround, opacity: 0.5, fontFamily: `${font}, sans-serif`,
      fontWeight: 500, fontSize: 32, lineHeight: 1.2,
    }}>{text}</div>
  );
}

export function BeatScene({ plan }) {
  const frame = useCurrentFrame();
  const colors = paletteRoles(plan.palette);
  const { beat, p } = at(plan, frame);

  /**
   * The handover. A change of owner clears the frame first: the outgoing
   * element is already gone by the time the incoming one starts, so the two
   * are never on screen together. That is the transition doing the work the
   * prohibition asks for, rather than a crossfade that briefly shows both.
   */
  const handover = beat.transition_in === "CLEAR" || beat.transition_in === "MORPH";
  /**
   * The dead window at the start of a handover was 10% of the beat, which on a
   * 60-frame beat is six frames of nothing but a caption — measured, one
   * sampled still came back at 0.2% ink. A handover still clears first, but the
   * incoming element starts almost immediately.
   */
  const enter = handover ? Math.max(0, Math.min(1, (p - 0.02) / 0.22)) : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.ground }}>
      <AbsoluteFill style={{ opacity: enter }}>
        {beat.screen_mode === "TYPE"
          ? <TypeStage beat={beat} p={p} colors={colors} font={plan.fonts.primary} />
          : <HeroStage beat={beat} p={p} colors={colors} />}
      </AbsoluteFill>
      <Caption text={beat.narrative_text} colors={colors} font={plan.fonts.secondary} />
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "BeatSequenceShorts",
    component: BeatScene,
    durationInFrames: 300,
    fps: 30,
    width: CANVAS_W,
    height: CANVAS_H,
    defaultProps: {
      plan: {
        beats: [{ beat_id: "b0", start_frame: 0, duration_frames: 300, narrative_text: "", screen_mode: "TYPE", focal_element: "", typography_state: null, typography_action: "SCALE", transition_in: "CUT", actors: [] }],
        palette: { primary: ["#1A1A2E", "#16213E", "#F5536B", "#0F0F1A"], secondary: ["#C81E3C", "#8892B0", "#E6E8EC"] },
        fonts: { primary: "DM Sans", secondary: "Noto Serif" },
        text_placement: "upper-third",
      },
    },
  },
];
