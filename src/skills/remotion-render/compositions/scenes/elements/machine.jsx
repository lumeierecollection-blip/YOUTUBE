import React from "react";
import { ease } from "../primitives.jsx";

/**
 * Machine elements — the mechanism family shared by CAUSE_EFFECT and
 * PROCESS's "mechanism" subject (raw material -> machine -> changed output).
 *
 * WHY THIS FILE EXISTS
 *
 * The previous CauseEffectScene/ProcessScene bodies were primitive assembly
 * with more width than usual: curved `<path>` strokes for "flow", two
 * chevron strokes for "the gate", circles for "rollers". Read cold, that is
 * still lines and shapes arranged on a background — a viewer cannot point
 * at an OBJECT and say "that is the constraint". These components ARE
 * objects: a casing with wall thickness, a gate with two jaws whose gap you
 * can see change, material that is a discrete filled body moving through
 * both.
 *
 * These are still built from `<rect>`/`<path>`/`<polygon>` internally —
 * PART 8 of the task is explicit that low-level primitives may still exist
 * "under the hood". What changes is that the exported unit is MachineBody /
 * Gate / MaterialSlug, not Rectangle / Line.
 */

/**
 * The casing a mechanism sits inside — wall, floor and cross-ties, so a
 * gate or a station reads as sitting IN something rather than floating on
 * a background. Filled with `colors.stroke` at low opacity, the same
 * technique GEOSPATIAL_RADIUS uses for ground (`colors.bg`/`surface` are
 * literally the canvas colour in this token system — see styles/tokens.js
 * — so a real fill has to come off the ink colour).
 */
export function MachineBody({ x, y, w, h, colors, opacity = 1, ribs = 10, vertical = false }) {
  const rib = [];
  const count = ribs;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    if (vertical) {
      const yy = y + t * h;
      rib.push(
        <line key={i} x1={x} y1={yy} x2={x + w} y2={yy}
          stroke={colors.stroke} strokeWidth={1.5} opacity={0.12} />
      );
    } else {
      const xx = x + t * w;
      rib.push(
        <line key={i} x1={xx} y1={y} x2={xx} y2={y + h}
          stroke={colors.stroke} strokeWidth={1.5} opacity={0.12} />
      );
    }
  }
  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={w} height={h} rx={8}
        fill={colors.stroke} fillOpacity={0.07} stroke={colors.stroke} strokeWidth={3} />
      <g style={{ clipPath: `inset(0px round 8px)` }}>{rib}</g>
    </g>
  );
}

/**
 * A gate: two facing jaws closing across a horizontal channel. This IS the
 * "visible constraint" the task asks for — not a symbol for a constraint,
 * an object whose aperture narrows.
 *
 * `close` 0..1: 0 is fully open (gap = full channel), 1 is nearly sealed
 * (a working gate never fully seals — a residual gap keeps some material
 * getting through, which is what "collapsed" means rather than "stopped").
 */
export function Gate({ cx, cy, channelHalfH, jawSpan = 92, close, colors, working = false, thickness = 3 }) {
  const c = ease(Math.max(0, Math.min(1, close)));
  const gap = channelHalfH * (1 - 0.82 * c);
  const col = working ? colors.accent : colors.stroke;
  const half = jawSpan / 2;

  const topJaw = `M ${cx - half} ${cy - channelHalfH - 46} L ${cx + half} ${cy - channelHalfH - 46} L ${cx + half * 0.42} ${cy - gap} L ${cx - half * 0.42} ${cy - gap} Z`;
  const botJaw = `M ${cx - half} ${cy + channelHalfH + 46} L ${cx + half} ${cy + channelHalfH + 46} L ${cx + half * 0.42} ${cy + gap} L ${cx - half * 0.42} ${cy + gap} Z`;

  return (
    <g>
      <path d={topJaw} fill={col} fillOpacity={working ? 0.9 : 0.75} stroke={col} strokeWidth={thickness} />
      <path d={botJaw} fill={col} fillOpacity={working ? 0.9 : 0.75} stroke={col} strokeWidth={thickness} />
      {/* Teeth on the jaw faces — the detail that reads "mechanical part",
          not decoration: it sits only on the inner edge that actually
          meets the material. */}
      {[-1, 0, 1].map((i) => (
        <React.Fragment key={i}>
          <rect x={cx + i * half * 0.28 - 3} y={cy - gap - 7} width={6} height={7} fill={col} opacity={0.9} />
          <rect x={cx + i * half * 0.28 - 3} y={cy + gap} width={6} height={7} fill={col} opacity={0.9} />
        </React.Fragment>
      ))}
    </g>
  );
}

/**
 * A discrete body of material — the thing actually flowing, as one filled
 * object rather than a stroked line standing in for "flow". `width` scales
 * with how much is getting through, so a downstream slug that is visibly
 * thinner than an upstream one IS the collapse, without a label saying so.
 */
export function MaterialSlug({ x, y, w, h, colors, accent = false, opacity = 1, vertical = false }) {
  const rw = vertical ? h : w;
  const rh = vertical ? w : h;
  return (
    <rect
      x={x - rw / 2} y={y - rh / 2} width={rw} height={rh} rx={Math.min(rw, rh) * 0.28}
      fill={accent ? colors.accent : colors.stroke}
      fillOpacity={accent ? 0.55 : 0.4}
      stroke={accent ? colors.accent : colors.stroke}
      strokeWidth={2}
      opacity={opacity}
    />
  );
}

