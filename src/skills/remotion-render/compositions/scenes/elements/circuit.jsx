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

/**
 * A node on the circuit — a DIP-style chip package (a body plus pins on
 * two edges), not a bare rounded square standing in for "a stage".
 *
 * WHY THIS CHANGED. A rendered frame (CHECK-REGISTER §3.12.15) showed the
 * original rounded square + status-light dot reading as nothing more than
 * "a numbered box" once placed in a straight vertical column joined by a
 * single line — precisely the banned box-arrow-box grammar, unintentionally
 * rebuilt. Pins are the one feature that is unambiguously "electronic
 * component" and not "labelled box": no other object in this renderer has
 * short perpendicular legs on two sides of a rectangular body.
 */
export function CircuitNode({ x, y, r, colors, lit, working, appear = 1 }) {
  const a = ease(appear);
  if (a <= 0.01) return null;
  const col = lit || working ? colors.accent : colors.stroke;
  const bodyW = r * 1.5, bodyH = r * 2;
  const pinCount = 3;
  const pinLen = r * 0.42;
  // Fill opacity does NOT drop below the render's own measured ink-visible
  // floor (stage.jsx documents 5% landing ~12/255 from bg, under what the
  // frame audit counts as ink at all) just because a node has not lit up
  // yet — a node that has not received the signal is still a real,
  // visible component sitting in the chain, not a component that doesn't
  // exist until the signal reaches it.
  return (
    <g opacity={a}>
      {Array.from({ length: pinCount }).map((_, i) => {
        const py = y - bodyH / 2 + ((i + 0.5) / pinCount) * bodyH;
        return (
          <React.Fragment key={i}>
            <line x1={x - bodyW / 2 - pinLen} y1={py} x2={x - bodyW / 2} y2={py}
              stroke={col} strokeWidth={3} opacity={0.75} />
            <line x1={x + bodyW / 2} y1={py} x2={x + bodyW / 2 + pinLen} y2={py}
              stroke={col} strokeWidth={3} opacity={0.75} />
          </React.Fragment>
        );
      })}
      <rect x={x - bodyW / 2} y={y - bodyH / 2} width={bodyW} height={bodyH} rx={4}
        fill={colors.stroke} fillOpacity={lit ? 0.24 : 0.14}
        stroke={col} strokeWidth={working ? 4 : 2.5} />
      {/* Notch — the pin-1 orientation mark real DIP packages carry. */}
      <path d={`M ${x - bodyW * 0.22} ${y - bodyH / 2} a ${bodyW * 0.22} ${bodyW * 0.22} 0 0 0 ${bodyW * 0.44} 0`}
        fill="none" stroke={col} strokeWidth={2} opacity={0.6} />
      {/* The status light — off, working (pulsing ring), or lit (solid). */}
      <circle cx={x} cy={y + bodyH * 0.22} r={r * 0.14}
        fill={lit ? colors.accent : "none"} stroke={col} strokeWidth={2} />
      {working ? (
        <circle cx={x} cy={y + bodyH * 0.22} r={r * 0.28}
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
