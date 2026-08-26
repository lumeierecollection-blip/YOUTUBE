import React from "react";
import { useCurrentFrame } from "remotion";
import {
  CANVAS_W, CANVAS_H, STAGE_CX, Label, GroundPlane, ease, seeded,
  useStateProgress, EASE_OUT, EASE_IN_OUT,
} from "./primitives.jsx";
import { progressOf } from "../../visual/states.js";

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
  // different motion, not a restyled version of the same one.
  const mode = /trap|caught|stuck|lock|bound|constrain|squeeze/.test(notion)
    ? "closing"
    : /pressure|burden|weight|crush|strain/.test(notion)
      ? "loading"
      : /hidden|invisible|silent|secret|unseen/.test(notion)
        ? "revealing"
        : /risk|fragile|collapse|fail/.test(notion)
          ? "destabilising"
          : "converging";

  const cx = STAGE_CX, cy = 730;
  const a = ease(pAct, EASE_IN_OUT);
  const rings = 5;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {Array.from({ length: rings }).map((_, i) => {
          const t = i / (rings - 1 || 1);
          const appear = ease(Math.max(0, Math.min(1, pEst * rings - i * 0.6)));
          if (appear <= 0.02) return null;

          let r, opacity = 0.5 + 0.5 * appear, sw = 2;
          switch (mode) {
            case "closing":
              // Rings contract toward the centre: the space available shrinks.
              r = (330 - i * 26) * (1 - 0.55 * a);
              sw = 2 + i * 0.4;
              break;
            case "loading":
              // Stacked bars compress downward under accumulating weight.
              r = 300 - i * 30;
              break;
            case "revealing":
              // Rings expand outward, exposing what was inside.
              r = (70 + i * 30) * (1 + 1.6 * a);
              opacity *= 1 - 0.5 * a;
              break;
            case "destabilising":
              r = 300 - i * 30;
              break;
            default: // converging
              r = (330 - i * 26) * (1 - 0.3 * a);
          }

          if (mode === "loading") {
            const squash = 1 - 0.5 * a * (1 - t);
            return (
              <rect key={i}
                x={cx - r} y={cy - 150 + i * 62 * squash}
                width={r * 2} height={44 * squash} rx={3}
                fill="none" stroke={i === 0 ? colors.accent : colors.stroke}
                strokeWidth={i === 0 ? 3.5 : 2} opacity={opacity} />
            );
          }

          const wobble = mode === "destabilising" ? Math.sin(frame * 0.11 + i) * 10 * a : 0;
          return (
            <ellipse key={i}
              cx={cx + wobble} cy={cy}
              rx={Math.max(r, 4)} ry={Math.max(r * 0.72, 3)}
              fill="none"
              stroke={i === 0 ? colors.accent : colors.stroke}
              strokeWidth={i === 0 ? 3.5 : sw}
              opacity={opacity} />
          );
        })}

        {/* The subject held at the centre — the thing the field acts upon. */}
        <circle cx={cx} cy={cy} r={12 + 6 * ease(pEst)} fill={colors.accent} opacity={ease(pEst)} />
      </svg>

      {pResolve > 0 ? (
        <Label x={cx} y={cy + 330} text={(beat.visualPlan && beat.visualPlan.supporting.phrase) || ""}
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
// available, the frame is still COMPOSED: a receding ground plane gives
// real depth, the subject phrase sits in that space at a considered
// position, and a slow parallax drift keeps it from being a static card.
// No icon. Ever.
// ─────────────────────────────────────────────────────────────────────────────
export function CinematicStatementScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];

  const pField = useStateProgress(states, "field");
  const pSubject = useStateProgress(states, "subject");
  const pDrift = progressOf(states, "drift", frame);

  // Decided on the plan (visual/text-budget.js), not here: the phrase has
  // to be countable by the render report, and three scene files each
  // extracting their own with three different word limits is how it stopped
  // being countable in the first place.
  const phrase = (beat.visualPlan && beat.visualPlan.supporting.phrase) || "";

  // Slow lateral parallax — the ground moves further than the subject, so
  // the frame reads as a held shot rather than a still slide.
  const drift = ease(pDrift, EASE_IN_OUT);
  const groundShift = -26 * drift;
  const subjectShift = -9 * drift;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${groundShift}px)` }}>
        <GroundPlane p={pField} color={colors.stroke} cx={STAGE_CX} horizonY={560} rows={8} cols={9} />
      </div>

      {/* A single horizon marker anchoring the subject in the space. */}
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <line
          x1={0} y1={560}
          x2={CANVAS_W * ease(pField)} y2={560}
          stroke={colors.stroke} strokeWidth={1.5} opacity={0.55} />
        {pSubject > 0 ? (
          <line
            x1={STAGE_CX - 150 + subjectShift} y1={742}
            x2={STAGE_CX - 150 + subjectShift + 300 * ease(pSubject)} y2={742}
            stroke={colors.accent} strokeWidth={4} />
        ) : null}
      </svg>

      {phrase ? (
        <div style={{
          position: "absolute",
          left: 0, right: 0, top: 640,
          textAlign: "center",
          transform: `translateX(${subjectShift}px)`,
          opacity: ease(pSubject),
        }}>
          <div style={{
            display: "inline-block",
            color: colors.textPrimary,
            fontFamily,
            fontWeight: 800,
            fontSize: phrase.length > 20 ? 56 : 72,
            letterSpacing: 1.5,
            lineHeight: 1.1,
            maxWidth: 780,
            transform: `translateY(${(1 - ease(pSubject)) * 20}px)`,
          }}>
            {phrase}
          </div>
        </div>
      ) : null}
    </div>
  );
}
