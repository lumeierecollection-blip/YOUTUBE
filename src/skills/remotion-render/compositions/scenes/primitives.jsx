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
export function Label({ x, y, text, color, size = 30, weight = 700, opacity = 1, align = "left", tracking = 1.5, fontFamily, mono = false }) {
  if (!text) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        color,
        opacity,
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
export function Figure({ x, y, value, unit = "", p = 1, color, size = 64, fontFamily, align = "left", format }) {
  const shown = (typeof format === "function" ? format : defaultFormat)(value * Math.max(0, Math.min(1, p)), value);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        color,
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
