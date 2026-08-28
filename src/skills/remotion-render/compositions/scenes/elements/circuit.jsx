import React from "react";
import { ease } from "../primitives.jsx";

/**
 * Circuit elements — the digital-system family for PROCESS when the
 * sentence's own words are about software/systems rather than physical
 * material (a request moving through a server, not a workpiece through a
 * press). Selected by a real keyword read of the beat's text
 * (`processFamily` in structure-scenes.jsx), the same technique
 * `VisualMetaphorScene` already uses to pick its physical behaviour — never
 * a fabricated label, only a different OBJECT VOCABULARY for an unlabelled
 * stage count.
 */

/** A node on the circuit — a component with a body and a status light,
 * not a bare circle standing in for "a stage". */
export function CircuitNode({ x, y, r, colors, lit, working, appear = 1 }) {
  const a = ease(appear);
  if (a <= 0.01) return null;
  const col = lit || working ? colors.accent : colors.stroke;
  // Fill opacity does NOT drop below the render's own measured ink-visible
  // floor (stage.jsx documents 5% landing ~12/255 from bg, under what the
  // frame audit counts as ink at all) just because a node has not lit up
  // yet — a node that has not received the signal is still a real,
  // visible component sitting in the chain, not a component that doesn't
  // exist until the signal reaches it.
  return (
    <g opacity={a}>
      <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={r * 0.3}
        fill={colors.stroke} fillOpacity={lit ? 0.22 : 0.13}
        stroke={col} strokeWidth={working ? 4 : 2.5} />
      {/* The status light — off, working (pulsing ring), or lit (solid). */}
      <circle cx={x} cy={y + r * 0.55} r={r * 0.16}
        fill={lit ? colors.accent : "none"} stroke={col} strokeWidth={2} />
      {working ? (
        <circle cx={x} cy={y + r * 0.55} r={r * 0.32}
          fill="none" stroke={colors.accent} strokeWidth={1.5} opacity={0.5} />
      ) : null}
    </g>
  );
}

/** A right-angled trace between two nodes — a circuit board connection,
 * not a curved "flow" line borrowed from the mechanical family. */
export function CircuitTrace({ x1, y1, x2, y2, colors, progress, lit }) {
  const p = ease(Math.max(0, Math.min(1, progress)));
  if (p <= 0.005) return null;
  const midY = (y1 + y2) / 2;
  const full = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  const len = Math.abs(midY - y1) + Math.abs(x2 - x1) + Math.abs(y2 - midY);
  return (
    <path d={full} fill="none" stroke={lit ? colors.accent : colors.stroke}
      strokeWidth={lit ? 4 : 2.5} strokeLinecap="round" strokeLinejoin="round"
      opacity={lit ? 0.85 : 0.4}
      strokeDasharray={`${len * p} ${len}`} />
  );
}

/** The signal packet travelling the trace — the thing actually moving,
 * so a viewer can point at an object and say "that is the request". */
export function SignalPacket({ x, y, colors, opacity = 1 }) {
  if (opacity <= 0.01) return null;
  return <rect x={x - 9} y={y - 6} width={18} height={12} rx={3}
    fill={colors.accent} opacity={opacity} />;
}
