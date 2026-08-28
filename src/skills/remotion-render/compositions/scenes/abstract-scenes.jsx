import React from "react";
import { useCurrentFrame } from "remotion";
import {
  CANVAS_W, CANVAS_H, SAFE, Label, ease, seeded,
  useStateProgress, useValueProgress, EASE_OUT, EASE_IN_OUT,
} from "./primitives.jsx";
import { progressOf } from "../../visual/states.js";
import { Plane, shotFrame } from "./stage.jsx";
import { PressureWalls } from "./elements/pressure.jsx";

/**
 * Abstract scenes — the two that carry a beat when nothing concrete is
 * available. These are where PART 7 is won or lost.
 *
 * The old terminal fallback was StatementScene, which rendered ONE ICON at
 * 120px in the middle of the frame and nothing else. That is what made
 * every video feel templated: whenever the classifier couldn't read a
 * fragment (which was most of the time), a noun-matched glyph appeared.
 *
 * Neither scene here renders an icon at all.
 */


// ─────────────────────────────────────────────────────────────────────────────
// VISUAL_METAPHOR — an abstract idea given physical behaviour.
//
// The notion detected in the text (trapped, pressure, growth, erosion...)
// selects HOW the field behaves, so "debt keeps people trapped" produces
// something closing in, not a lock icon.
// ─────────────────────────────────────────────────────────────────────────────
export function VisualMetaphorScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const notion = String((plan.payload && plan.payload.notion) || "").toLowerCase();

  const pEst = useStateProgress(states, "establish");
  const pAct = progressOf(states, "act", frame);
  const pResolve = useStateProgress(states, "resolve");

  // Which physical behaviour the notion maps to. Each is a genuinely
  // different motion, not a restyled version of the same one. No keyword
  // match now folds into "closing" rather than a separate "converging"
  // bucket — both were the same shrink formula at a different rate, i.e.
  // one mode wearing two names.
  const mode = /trap|caught|stuck|lock|bound|constrain|squeeze/.test(notion)
    ? "closing"
    : /pressure|burden|weight|crush|strain/.test(notion)
      ? "loading"
      : /hidden|invisible|silent|secret|unseen/.test(notion)
        ? "revealing"
        : /risk|fragile|collapse|fail/.test(notion)
          ? "destabilising"
          : "closing";

  const f = shotFrame((beat.visualPlan && beat.visualPlan.shot) || null);
  const cx = f.cx, cy = f.cy;
  const a = ease(pAct, EASE_IN_OUT);
  // Field size follows the SHOT, not a fixed 330px. IMMERSIVE puts the
  // viewer inside the field; CLOSE puts them near a smaller one. Hardcoding
  // the size made both framings draw an identical field, which is the
  // whole complaint this layer exists to answer.
  const boxHalfW = f.w * 0.21;
  const boxHalfH = f.h * 0.17;
  const openMax = Math.min(f.w, f.h) * 0.2;
  const appear = ease(pEst);

  // loading's own geometry: a compressing stack of load bars, unrelated
  // to the wall box the other three modes use.
  const rings = 5;
  const R = Math.min(f.w, f.h) * 0.46;
  const step = R * 0.079;

  let standoff = openMax, wallOpacity = appear, wobble = [0, 0, 0, 0], accent = false;
  switch (mode) {
    case "closing":
      // Walls close toward the subject as the beat plays out. A working
      // vice never fully seals — same residual-gap precedent as
      // elements/machine.jsx's Gate — so the minimum standoff stays a
      // small positive gap, not zero.
      standoff = openMax * (1 - 0.82 * a);
      break;
    case "revealing":
      // Walls start almost flush against the subject and retreat outward,
      // exposing what they held, fading as they go.
      standoff = openMax * (0.08 + 1.6 * a);
      wallOpacity = appear * (1 - 0.5 * a);
      accent = true;
      break;
    case "destabilising":
      standoff = openMax * 0.55;
      wobble = [0, 1, 2, 3].map((i) => Math.sin(frame * 0.13 + i * 1.7) * 9 * a);
      break;
    default:
      break; // "loading" draws its own bars below and ignores standoff
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {mode === "loading" ? (
          Array.from({ length: rings }).map((_, i) => {
            const t = i / (rings - 1 || 1);
            const barAppear = ease(Math.max(0, Math.min(1, pEst * rings - i * 0.6)));
            if (barAppear <= 0.02) return null;
            const r = R * 0.9 - i * step * 1.15;
            const opacity = 0.5 + 0.5 * barAppear;
            const squash = 1 - 0.5 * a * (1 - t);
            // Stacked bars compress downward under accumulating weight —
            // filled MASS, not a wireframe outline, so the weight reads.
            return (
              <rect key={i}
                x={cx - r} y={cy - f.h * 0.17 + i * (f.h * 0.07) * squash}
                width={r * 2} height={f.h * 0.05 * squash} rx={3}
                fill={i === 0 ? colors.accent : colors.stroke}
                fillOpacity={(i === 0 ? 0.55 : 0.3) * opacity}
                stroke={i === 0 ? colors.accent : colors.stroke}
                strokeWidth={i === 0 ? 3.5 : 2} opacity={opacity} />
            );
          })
        ) : (
          // Four solid walls acting on the subject — a vice/frame closing
          // or opening — instead of a field of concentric rings.
          <PressureWalls cx={cx} cy={cy} halfW={boxHalfW} halfH={boxHalfH}
            standoff={standoff} colors={colors} opacity={wallOpacity}
            wobble={wobble} accent={accent} />
        )}

        {/* The subject held at the centre — the thing the walls act upon. */}
        <circle cx={cx} cy={cy} r={12 + 6 * appear} fill={colors.accent} opacity={appear} />
      </svg>

      {pResolve > 0 ? (
        <Label x={cx} y={cy + R * 0.95} text={(beat.visualPlan && beat.visualPlan.supporting.phrase) || ""}
          color={colors.textPrimary} size={40} weight={800} tracking={2}
          align="center" opacity={pResolve} fontFamily={fontFamily} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CINEMATIC_STATEMENT — the terminal fallback.
//
// This replaces the icon-only StatementScene. When no richer reading was
// available the frame is still a SHOT: distance, three real depth planes,
// and the statement standing somewhere in that distance. No icon. Ever.
//
// WHAT WAS WRONG WITH THE FIRST VERSION. It drew `GroundPlane` — a
// perspective grid — with a horizon line at y=560, on top of the
// `AtmosphereGround` the router already stages, whose own horizon is at
// y=1152. Two horizons, at different heights, in one frame. That is the
// same defect the TIMELINE rebuild fixed, and it is what a scene gets for
// staging its own world instead of standing in the one it was given.
//
// It also ignored its shot entirely: `f` was computed and then never read,
// while the composition used a hardcoded STAGE_CX and a fixed y=640. Both
// framings CINEMATIC_STATEMENT can receive drew the identical picture.
//
// This version stands in the atmosphere ground's world — its horizon,
// nothing competing with it — and separates near from far with the real
// `Plane` primitive, which until now was exported and used by no scene.
// ─────────────────────────────────────────────────────────────────────────────

/** Where AtmosphereGround puts its horizon. One horizon per frame. */
const ATMOSPHERE_HORIZON_Y = CANVAS_H * 0.6;

export function CinematicStatementScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const shot = (beat.visualPlan && beat.visualPlan.shot) || null;
  const f = shotFrame(shot);
  const dur = beat.durationInFrames;

  const pField = useStateProgress(states, "field");
  const pDrift = progressOf(states, "drift", frame);
  // THE STATEMENT LANDS ON THE ANCHOR, IT DOES NOT START THERE.
  //
  // `subject` is this strategy's anchored state, so driving the phrase from
  // it put opacity 0 on the exact frame the key word is spoken — and this
  // scene's entire content IS that phrase, so the rendered anchor frame
  // came back blank. Measured: 0.1% ink, bbox 100x1%, no text at all.
  //
  // useValueProgress reaches exactly 1 at the anchor, which is what the
  // channel config means by "the largest visual move lands at reveal": the
  // words arrive as they are said, rather than beginning to arrive.
  const pSubject = useValueProgress(states);

  // Decided on the plan (visual/text-budget.js), not here: the phrase has
  // to be countable by the render report, and three scene files each
  // extracting their own with three different word limits is how it stopped
  // being countable in the first place.
  const phrase = (beat.visualPlan && beat.visualPlan.supporting.phrase) || "";

  const seed = (beat.startFrame || 0) + 7;
  const horizon = ATMOSPHERE_HORIZON_Y;
  const eField = ease(pField);
  const eSubject = ease(pSubject);
  // The one extra breath the terminal fallback gets, on top of the camera's
  // drift. Small: the sparseness is the point, movement is not the point.
  const settle = ease(pDrift, EASE_IN_OUT);

  // The statement stands where the FRAMING says, not in the middle. HORIZON
  // sets it low and near the ground; ISOLATED lifts it into the haze and
  // pushes it left, which is what "isolated" should look like.
  const textCx = f.cx;
  // A CLEAN VERTICAL STACK: ground, then the stake standing on it, then the
  // words above the stake. The first version derived the stake's height
  // from the text's top edge, and on a rendered frame the two overlapped —
  // "CARRIED BALANCE" was struck through by its own stake and sat across
  // the horizon line. Stack downward from the horizon instead, and let the
  // text sit on top of the stake rather than around it.
  const stakeH = Math.max(90, f.h * 0.2);
  const stakeTop = horizon - stakeH;
  // Positioned by its BOTTOM edge, so a phrase that wraps to two lines
  // grows upward into empty sky instead of down through the stake.
  const textBottom = CANVAS_H - (stakeTop - 26);

  // A far ridge: deterministic, irregular, and BELOW the eye — it sits on
  // the horizon rather than floating. Seeded, so a re-render is identical.
  const ridge = [];
  const ridgeN = 22;
  for (let i = 0; i <= ridgeN; i++) {
    const x = (i / ridgeN) * CANVAS_W;
    const y = horizon - (10 + seeded(seed * 31 + i) * 46) * eField;
    ridge.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  ridge.push(`L${CANVAS_W},${horizon} L0,${horizon} Z`);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* FAR — a ridge on the horizon. Lags the camera most (parallax 0.2),
          so it barely moves, the way distance behaves. */}
      <Plane shot={shot} depth="far" states={states} durationInFrames={dur}>
        <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
          {/* 0.07 was invisible. These planes ARE the composition for the
              terminal fallback, not background texture, and on a white-bg
              channel (Money Mind) the whole frame rendered as blank paper. */}
          <path d={ridge.join(" ")} fill={colors.stroke} opacity={0.26 * eField} />
        </svg>
      </Plane>

      {/* SUBJECT — the statement, and a single stake tying it to the
          ground. Without the stake the words float; with it, they are
          somewhere. */}
      <Plane shot={shot} depth="subject" states={states} durationInFrames={dur}>
        <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {pSubject > 0 ? (
            <line
              x1={textCx} y1={horizon}
              x2={textCx} y2={horizon - stakeH * eSubject}
              stroke={colors.accent} strokeWidth={3} />
          ) : null}
          {/* Its footing on the ground — a shadow, so the stake is standing
              on the plane rather than crossing in front of it. */}
          {pSubject > 0 ? (
            <ellipse cx={textCx} cy={horizon + 3} rx={26 * eSubject} ry={4 * eSubject}
              fill={colors.stroke} opacity={0.22} />
          ) : null}
        </svg>

        {phrase ? (
          <div style={{
            position: "absolute",
            left: Math.max(SAFE.left, textCx - f.w * 0.44),
            width: Math.min(f.w * 0.88, SAFE.right - SAFE.left),
            bottom: textBottom,
            textAlign: shot && shot.anchorX < 0.45 ? "left" : "center",
            opacity: eSubject,
            transform: `translateY(${(1 - eSubject) * 20 - settle * 6}px)`,
          }}>
            <div style={{
              color: colors.textPrimary,
              fontFamily,
              fontWeight: 800,
              // Type scales with the shot: a tighter framing means the
              // words are nearer, not smaller in the same frame.
              fontSize: Math.round((phrase.length > 20 ? 56 : 72) * Math.min(1.1, f.w / 1080)),
              letterSpacing: 1.5,
              lineHeight: 1.1,
            }}>
              {phrase}
            </div>
          </div>
        ) : null}
      </Plane>

      {/* FOREGROUND — the near edge of the ground the viewer is standing
          on. Leads the camera (parallax 1.5), so it is the layer that
          actually sells the depth; a still frame shows only a dark band. */}
      <Plane shot={shot} depth="foreground" states={states} durationInFrames={dur}>
        <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
          <path
            d={`M-60,${CANVAS_H} L-60,${CANVAS_H - 150 * eField} ${Array.from({ length: 13 })
              .map((_, i) => {
                const x = -60 + (i / 12) * (CANVAS_W + 120);
                const y = CANVAS_H - (110 + seeded(seed * 53 + i) * 80) * eField;
                return `L${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ")} L${CANVAS_W + 60},${CANVAS_H} Z`}
            fill={colors.stroke} opacity={0.32 * eField} />
        </svg>
      </Plane>
    </div>
  );
}
