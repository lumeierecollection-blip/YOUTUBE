import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { ObjectShape } from "../compositions/objects/registry.js";
import "../compositions/objects/index.jsx";
import { paletteRoles } from "../visual/palette-roles.js";
import { SAFE_SHORTS } from "../layout/slots.js";

/**
 * THE BEAT RENDERER — draws the stage, not a scene.
 *
 * The renderer this replaces composed each beat from nothing. Its output was a
 * slideshow: measured on a 70-second ch-02 render, twenty consecutive beats
 * drew the same document, and the only thing moving was a slow camera push.
 *
 * Here the frame is the state of a STAGE that persists. An actor present in
 * two beats is interpolated from where it was to where it now is, ACROSS THE
 * WHOLE BEAT rather than snapping at the boundary — so the picture is always
 * mid-move and never settles into a held image. That is the difference between
 * entrance animation and motion graphics, and it is why nothing here waits.
 *
 * TWO TEXT LAYERS, SECTION 2.2. The kinetic line carries the beat's word and
 * animates; the caption carries the spoken sentence and sits still. The old
 * renderer had only the second, which is why the typography never changed.
 *
 * NOTHING HERE KNOWS A CHANNEL. Palette, fonts and object vocabulary all
 * arrive in the plan, the same rule PLN-07 holds the template renderer to.
 */

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const S = SAFE_SHORTS;
const px = (fx) => S.left + (S.right - S.left) * fx;

/**
 * THE TYPE BAND IS RESERVED BEFORE THE ACTORS ARE PLACED.
 *
 * The kinetic line is 108px display type with a 40px second line under it, so
 * it occupies roughly 260px wherever it sits. Placed without reserving that,
 * the first render put THIRTY-FIVE straight across the document it was
 * describing. The actors get what is left, and the caption's own band at the
 * foot is reserved the same way.
 */
const TYPE_BAND = 270;
// One line of 38px caption plus its leading. 190 was reserving a paragraph's
// worth of space for a single line and taking it from the actors.
const CAPTION_BAND = 110;
function actorBand(placement) {
  const top = placement === "upper-third" ? S.top + TYPE_BAND : S.top + 20;
  const bottom = placement === "upper-third" ? S.bottom - CAPTION_BAND : S.bottom - TYPE_BAND - CAPTION_BAND;
  return { top, bottom };
}

/**
 * Actor footprint at scale 1. 0.34 of the safe width left the objects reading
 * as scattered thumbnails on the first render; the stage holds at most five and
 * they are meant to be the subject of the frame.
 */
const BASE = (S.right - S.left) * 0.44;

const EASE = Easing.bezier(0.33, 0, 0.15, 1);

/** The beat containing this frame, and how far through it we are. */
function at(plan, frame) {
  const beats = plan.beats;
  let i = 0;
  while (i < beats.length - 1 && frame >= beats[i + 1].start_frame) i++;
  const b = beats[i];
  const p = Math.max(0, Math.min(1, (frame - b.start_frame) / Math.max(1, b.duration_frames)));
  return { beat: b, prev: beats[i - 1] || null, index: i, p };
}

/** Where an actor was in the previous beat, if it was there at all. */
const findPrev = (prev, id) => (prev ? (prev.actors || []).find((a) => a.id === id) : null);

/**
 * One actor, interpolated from its previous state to its current one.
 *
 * A NEW actor eases in from slightly small and transparent. A SURVIVING one
 * travels the whole beat. An EXITing one shrinks away. In no case does an
 * actor cut from one state to another, which is Section 3.5's rule 1 expressed
 * in pixels rather than in the plan.
 */
function Actor({ actor, prev, p, colors, band }) {
  const e = EASE(p);
  const from = prev || { x: actor.x, y: actor.y, scale: (actor.scale ?? 1) * 0.72, opacity: 0 };
  const lerp = (a, b) => a + (b - a) * e;

  const scale = lerp(from.scale ?? 1, actor.scale ?? 1);
  /**
   * The band is the range the object's EDGES must stay inside, not the range
   * its centre may take. Mapping the anchor straight onto the band put the
   * bottom of a document 46px past the caption on the first render, because an
   * anchor at 0.76 of the band plus half an object's height lands outside it.
   */
  const halfH = (BASE * scale * 1.02) / 2;
  const halfW = (BASE * scale) / 2;
  const py = (fy) => {
    const lo = band.top + halfH, hi = band.bottom - halfH;
    return hi > lo ? lo + (hi - lo) * fy : (band.top + band.bottom) / 2;
  };
  const pxc = (fx) => {
    const lo = S.left + halfW, hi = S.right - halfW;
    return hi > lo ? lo + (hi - lo) * fx : (S.left + S.right) / 2;
  };
  const x = pxc(lerp(from.x ?? 0.5, actor.x ?? 0.5));
  const y = py(lerp(from.y ?? 0.5, actor.y ?? 0.5));
  const opacity = lerp(from.opacity ?? 0, actor.opacity ?? 1);
  if (opacity <= 0.01) return null;

  if (actor.type === "number") {
    // Section 4.2: a quantity counts. The number reaching its value IS the
    // beat, so it runs over the whole duration rather than appearing set.
    const target = Number(actor.value);
    const shown = Number.isFinite(target) && target > 0
      ? Math.round(target * e).toLocaleString()
      : String(actor.text || "");
    return (
      <div style={{
        position: "absolute", left: 0, top: y - 130, width: CANVAS_W,
        textAlign: "center", opacity,
        color: colors.accent, fontWeight: 800, fontSize: 210 * scale,
        letterSpacing: -2, fontVariantNumeric: "tabular-nums",
      }}>{shown}</div>
    );
  }

  const w = BASE * scale;
  // Nearly square: most of these objects are wider than tall, and a 1.2 ratio
  // pushed them into each other vertically in a band only 500px deep.
  const h = w * 1.02;
  const dim = actor.state === "dimmed";
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, opacity: opacity * (dim ? 0.42 : 1) }}>
      <g transform={`translate(${x - w / 2}, ${y - h / 2})`}>
        <ObjectShape name={actor.object} colors={colors} p={Math.max(0.15, e)}
          box={{ x: 0, y: 0, w, h }} />
      </g>
    </svg>
  );
}

/** A connection between two actors, drawn as it is made. */
function Link({ link, beat, colors, p, band }) {
  const a = (beat.actors || []).find((x) => x.id === link.from);
  const b = (beat.actors || []).find((x) => x.id === link.to);
  if (!a || !b) return null;
  const e = EASE(Math.min(1, p * 1.6));
  const py = (fy) => band.top + (band.bottom - band.top) * fy;
  const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y);
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
      <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * e} y2={y1 + (y2 - y1) * e}
        stroke={colors.accent} strokeWidth={4} opacity={0.75} strokeLinecap="round" />
      <circle cx={x1 + (x2 - x1) * e} cy={y1 + (y2 - y1) * e} r={7} fill={colors.accent} opacity={0.9} />
    </svg>
  );
}

/**
 * The kinetic line. Each action is the literal motion its name describes, so a
 * CONTRAST beat visibly strikes the previous word out before the new one lands.
 */
function Kinetic({ state, p, colors, font, placement, caption }) {
  if (!state || !state.primary_text) return null;
  const e = EASE(Math.min(1, p * 2.2));
  const out = Math.max(0, Math.min(1, (p - 0.86) / 0.14));
  const base = {
    position: "absolute", left: S.left, width: S.right - S.left,
    color: colors.onGround, fontFamily: `${font}, sans-serif`,
    fontWeight: 800, letterSpacing: -1, lineHeight: 1.02,
  };
  const top = placement === "upper-third" ? S.top + 30 : S.bottom - 430;

  let style = { ...base, top, fontSize: 108, opacity: 1 - out * 0.9 };
  let strike = 0;
  switch (state.action) {
    case "SLIDE_IN": style.transform = `translateX(${(1 - e) * -140}px)`; style.opacity *= e; break;
    case "SCALE": style.fontSize = 108 * (0.72 + 0.28 * e); style.opacity *= e; break;
    case "REVEAL": style.clipPath = `inset(0 ${(1 - e) * 100}% 0 0)`; break;
    case "EMPHASIZE": style.fontSize = 108 * (1 + 0.06 * Math.sin(p * Math.PI)); style.color = colors.accent; break;
    case "REPLACE": style.transform = `translateY(${(1 - e) * 60}px)`; style.opacity *= e; break;
    case "STRIKE_THROUGH": strike = e; style.opacity *= Math.min(1, e * 1.4); break;
    case "FADE_TRANSFORM": style.opacity *= e; break;
    case "EXPLODE": style.letterSpacing = `${(1 - e) * 26}px`; style.opacity *= e; break;
    default: style.transform = `scale(${0.94 + 0.06 * e})`; style.opacity *= e; break;
  }

  return (
    <>
      {/* the word being replaced, struck out as the new one arrives */}
      {state.action === "STRIKE_THROUGH" && state.replaces && (
        <div style={{ ...base, top: top - 96, fontSize: 64, opacity: 0.5 * (1 - e) }}>
          <span style={{ position: "relative" }}>
            {state.replaces}
            <span style={{
              position: "absolute", left: 0, top: "52%", height: 5, width: `${strike * 100}%`,
              background: colors.accent,
            }} />
          </span>
        </div>
      )}
      <div style={style}>{state.primary_text}</div>
      {/* Suppressed when it merely repeats the caption. On the first render the
          secondary line and the caption both read "Plutomurus holds the record
          for", which is the picture reciting the narration twice. */}
      {state.secondary_text && !String(caption || "").toLowerCase().includes(state.secondary_text.toLowerCase()) && (
        <div style={{
          ...base, top: top + 124, fontSize: 40, fontWeight: 500, letterSpacing: 0,
          opacity: (1 - out) * 0.62 * e, color: colors.onGround,
        }}>{state.secondary_text}</div>
      )}
    </>
  );
}

/** The caption: the spoken words, verbatim, in one fixed place. */
function Caption({ text, colors, font }) {
  if (!text) return null;
  return (
    <div style={{
      position: "absolute", left: S.left, width: S.right - S.left, top: S.bottom - 150,
      color: colors.onGround, opacity: 0.78, fontFamily: `${font}, sans-serif`,
      fontWeight: 500, fontSize: 38, lineHeight: 1.25,
    }}>{text}</div>
  );
}

export function BeatScene({ plan }) {
  const frame = useCurrentFrame();
  const colors = paletteRoles(plan.palette);
  const { beat, prev, p, index } = at(plan, frame);
  const actors = (beat.actors || []).filter((a) => a.type !== "line");
  const links = (beat.actors || []).filter((a) => a.type === "line");

  /**
   * A slow continuous drift over the whole video, independent of the beats.
   * It is small on purpose: the motion that matters is the actors moving, and
   * a camera doing the work is the thing that made the old renderer look like
   * it was moving when nothing was happening.
   */
  const drift = interpolate(frame % 900, [0, 450, 900], [0, 8, 0]);
  const band = actorBand(plan.text_placement);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.ground }}>
      <AbsoluteFill style={{ transform: `translateY(${drift}px)` }}>
        {links.map((l) => <Link key={l.id} link={l} beat={beat} colors={colors} p={p} band={band} />)}
        {actors.map((a) => (
          <Actor key={a.id} actor={a} prev={findPrev(prev, a.id)} p={p} colors={colors} band={band} />
        ))}
      </AbsoluteFill>
      <Kinetic state={beat.typography_state} p={p} colors={colors} caption={beat.narrative_text}
        font={plan.fonts.primary} placement={plan.text_placement} />
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
        beats: [{ beat_id: "b0", start_frame: 0, duration_frames: 300, narrative_text: "", visual_intent: "INTRODUCE", typography_state: null, actors: [] }],
        palette: { primary: ["#1A1A2E", "#16213E", "#F5536B", "#0F0F1A"], secondary: ["#C81E3C", "#8892B0", "#E6E8EC"] },
        fonts: { primary: "DM Sans", secondary: "Noto Serif" },
        text_placement: "upper-third",
      },
    },
  },
];
