import React from "react";
import { useCurrentFrame } from "remotion";
import { Easing, interpolate } from "remotion";
import { progressOf, reached, stateAt } from "../../visual/states.js";

/**
 * Shared drawing primitives for the semantic scene components.
 *
 * These are deliberately LOW-LEVEL (a ruled line, a plotted marker, a
 * measured bar) rather than "card" or "panel" components. The previous
 * renderer's whole problem was that every archetype reached for the same
 * card furniture; giving the new scenes a card primitive would recreate
 * that in one commit.
 *
 * MOTION RULE (PART 17): every helper here takes a 0..1 progress value
 * driven by a visual STATE, not by raw frame count. If a value isn't
 * changing because the concept is changing, it doesn't animate.
 */

// Matches the existing house easing in motion-graphics.jsx (E_OUT), so new
// scenes share the established motion feel rather than inventing a second one.
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** Design-space canvas. Matches DesignSpace in motion-graphics.jsx. */
export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

/** Safe rect (MOTION-GRAPHICS-MANUAL A1) — never draw meaning outside this. */
export const SAFE = { left: 48, right: 888, top: 288, bottom: 1248 };

/** The stage band: above the caption zone, below the headline zone. */
export const STAGE = { x: 48, y: 300, w: 840, h: 820 };
export const STAGE_CX = STAGE.x + STAGE.w / 2; // 468 — the real optical centre
export const STAGE_CY = STAGE.y + STAGE.h / 2;

export function ease(p, easing = EASE_OUT) {
  return easing(Math.max(0, Math.min(1, p)));
}

/** Progress through a named state, eased. The scene's main timing verb. */
export function useStateProgress(states, key, easing = EASE_OUT) {
  const frame = useCurrentFrame();
  return ease(progressOf(states, key, frame), easing);
}

export function useReached(states, key) {
  const frame = useCurrentFrame();
  return reached(states, key, frame);
}

export function useActiveState(states) {
  const frame = useCurrentFrame();
  return stateAt(states, frame);
}

/**
 * Deterministic pseudo-random in [0,1) from an integer seed. Used for
 * scatter positions that must be STABLE across renders (a device marker
 * must not jump between frames) — never for decoration.
 */
export function seeded(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Which composition variant this beat gets, out of `count`.
 *
 * PART 13 / PART 30 — the same strategy firing twice in one video drew a
 * pixel-identical composition both times. On a real legal script
 * DOCUMENT_EVIDENCE took three beats, so the viewer saw the same page, the
 * same seventeen ruled lines and the same highlighted line nine, three
 * times. Individually correct, collectively templated.
 *
 * DETERMINISTIC, NOT RANDOM. The index is hashed from the beat's own
 * identity, so a given script always renders the same way — re-running a
 * render must not shuffle the video, and a diff between two renders of the
 * same script must stay empty. Math.random would break both.
 *
 * The variant may only change HOW a concept is composed (which line is
 * operative, which side the subject sits, how the page is cropped), never
 * WHAT it says. A variant that changed the meaning would be a second scene
 * wearing the same name.
 */
export function variantOf(beat) {
  // Both numbers come from the plan: the index from mg-package.js (an
  // ordinal across the strategy's uses in this video) and the count from
  // the strategy's own `variants` declaration. Neither is recomputed here,
  // so the render report and the pixels cannot disagree about which variant
  // a beat got.
  const plan = beat && beat.visualPlan;
  if (!plan) return 0;
  const count = plan.variantCount || 1;
  return count > 1 && Number.isFinite(plan.variant) ? plan.variant % count : 0;
}

/** A hairline rule that draws itself left-to-right over progress p. */
export function Rule({ x, y, w, p = 1, color, thickness = 2, vertical = false }) {
  const len = Math.max(0, Math.min(1, p)) * (vertical ? 1 : w);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: vertical ? thickness : len,
        height: vertical ? w * Math.max(0, Math.min(1, p)) : thickness,
        background: color,
      }}
    />
  );
}

/**
 * Text placed as a MEASUREMENT or LABEL — small, tracked, subordinate.
 * This is the only text primitive the scenes get: there is deliberately no
 * "big headline" primitive, because PART 16 wants text supporting the
 * visual rather than being it.
 */
export function Label({ x, y, text, color, size = 30, weight = 700, opacity = 1, align = "left", tracking = 1.5, fontFamily, mono = false, halo = null }) {
  if (!text) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        color,
        opacity,
        // A cartographic halo, not a card. Map labels have been set over
        // busy ground this way for a century; a panel behind the text would
        // reintroduce exactly the card furniture these scenes exist to
        // avoid. Only passed where a label actually sits over detail.
        textShadow: halo ? `0 0 10px ${halo}, 0 0 6px ${halo}, 0 0 3px ${halo}` : undefined,
        fontFamily,
        fontWeight: weight,
        fontSize: size,
        letterSpacing: tracking,
        lineHeight: 1.15,
        whiteSpace: "pre",
        transform: align === "center" ? "translateX(-50%)" : align === "right" ? "translateX(-100%)" : "none",
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
      }}
    >
      {text}
    </div>
  );
}

/**
 * A number that counts toward its real value. Counters survive from the old
 * renderer (they were never the problem) but per PART 6 they now live
 * INSIDE a concept, at supporting scale, never as the composition.
 */
export function Figure({ x, y, value, unit = "", p = 1, color, size = 64, fontFamily, align = "left", format, halo = null }) {
  const shown = (typeof format === "function" ? format : defaultFormat)(value * Math.max(0, Math.min(1, p)), value);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        color,
        textShadow: halo ? `0 0 12px ${halo}, 0 0 7px ${halo}, 0 0 4px ${halo}` : undefined,
        fontFamily,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: -0.5,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "pre",
        transform: align === "center" ? "translateX(-50%)" : align === "right" ? "translateX(-100%)" : "none",
      }}
    >
      {shown}
      {unit ? <span style={{ fontSize: size * 0.42, fontWeight: 700, marginLeft: size * 0.1 }}>{unit}</span> : null}
    </div>
  );
}

function defaultFormat(current, target) {
  const decimals = Number.isInteger(target) ? 0 : target < 10 ? 1 : 0;
  return current.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Ground plane — a perspective floor grid. This is the shared "real space"
 * cue for the spatial scenes. Lines converge toward a horizon, so a radius
 * drawn on it reads as lying ON ground rather than floating on a slide.
 */
export function GroundPlane({ p = 1, color, cx = STAGE_CX, horizonY = 520, rows = 9, cols = 11, spread = 1180 }) {
  const a = ease(p);
  const lines = [];
  const baseY = horizonY + 470;

  for (let i = 0; i <= cols; i++) {
    const t = i / cols - 0.5;
    const xTop = cx + t * 190;
    const xBot = cx + t * spread;
    lines.push(
      <line
        key={`v${i}`}
        x1={xTop} y1={horizonY} x2={xBot} y2={baseY}
        stroke={color} strokeWidth={1} opacity={0.3 * a}
      />
    );
  }
  for (let r = 1; r <= rows; r++) {
    const t = r / rows;
    const y = horizonY + (baseY - horizonY) * (t * t); // perspective compression
    const halfW = (190 + (spread - 190) * (t * t)) / 2;
    lines.push(
      <line
        key={`h${r}`}
        x1={cx - halfW} y1={y} x2={cx + halfW} y2={y}
        stroke={color} strokeWidth={1} opacity={0.26 * a * (0.4 + t * 0.6)}
      />
    );
  }
  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
    >
      {lines}
    </svg>
  );
}

/** Bracket used to mark a measured span (a real measurement, not decor). */
export function MeasureBracket({ x1, y, x2, color, p = 1, tickH = 14, thickness = 2 }) {
  const a = ease(p);
  const mid = x1 + (x2 - x1) * a;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={CANVAS_W} height={CANVAS_H}>
      <line x1={x1} y1={y} x2={mid} y2={y} stroke={color} strokeWidth={thickness} />
      <line x1={x1} y1={y - tickH} x2={x1} y2={y + tickH} stroke={color} strokeWidth={thickness} />
      <line x1={mid} y1={y - tickH} x2={mid} y2={y + tickH} stroke={color} strokeWidth={thickness} opacity={a} />
    </svg>
  );
}

/** Fade+rise wrapper. The one entrance shared by supporting elements. */
export function Enter({ p, children, dy = 18, style }) {
  const a = ease(p);
  return (
    <div style={{ opacity: a, transform: `translateY(${(1 - a) * dy}px)`, ...style }}>{children}</div>
  );
}

export { interpolate };
