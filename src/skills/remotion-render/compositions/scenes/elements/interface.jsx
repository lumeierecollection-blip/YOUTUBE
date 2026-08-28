import React from "react";
import { ease } from "../primitives.jsx";

/**
 * InterfacePanel — a real windowed-application hierarchy: title bar, a
 * navigation rail, a toolbar/address row, a content area and a status
 * bar, not a bordered rectangle with three loose rectangles inside it.
 *
 * PART 19 is explicit that boxes are allowed here (an interface genuinely
 * contains boxes) but the scene has to feel like an actual interface. No
 * product identity is invented — no logo, no real brand, no fabricated
 * copy — this is the same abstract-mechanism treatment INTERFACE_SIMULATION
 * already used (`dataNeeds: []`), just with the actual regions a windowed
 * application has, so the abstraction reads as "a real kind of screen"
 * rather than "three placeholder rectangles".
 */
export function WindowChrome({ x, y, w, h, colors, progress }) {
  const p = ease(progress);
  return (
    <g opacity={p}>
      <rect x={x} y={y} width={w} height={h} rx={8}
        fill={colors.stroke} fillOpacity={0.06} stroke={colors.stroke} strokeWidth={2.5} />
      <line x1={x} y1={y + 52} x2={x + w} y2={y + 52} stroke={colors.stroke} strokeWidth={2} opacity={0.7} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={x + 26 + i * 24} cy={y + 26} r={6}
          fill="none" stroke={colors.stroke} strokeWidth={1.8} opacity={0.8} />
      ))}
      {/* A tab, so the title bar reads as chrome rather than a plain
          strip — the detail that says "windowed app". */}
      <rect x={x + 110} y={y + 10} width={120} height={32} rx={5}
        fill={colors.stroke} fillOpacity={0.1} stroke={colors.stroke} strokeWidth={1.5} opacity={0.8} />
    </g>
  );
}

/** A left navigation rail — a handful of section markers, not content. */
export function NavRail({ x, y, w, h, colors, progress, active = 0 }) {
  const p = ease(progress);
  if (p <= 0.01) return null;
  const items = 4;
  return (
    <g opacity={p}>
      <rect x={x} y={y} width={w} height={h} fill={colors.stroke} fillOpacity={0.04} />
      <line x1={x + w} y1={y} x2={x + w} y2={y + h} stroke={colors.stroke} strokeWidth={1.5} opacity={0.35} />
      {Array.from({ length: items }).map((_, i) => {
        const iy = y + 40 + i * 62;
        const isActive = i === active;
        return (
          <g key={i}>
            {isActive ? <rect x={x} y={iy - 16} width={4} height={32} fill={colors.accent} /> : null}
            <rect x={x + w / 2 - 14} y={iy - 14} width={28} height={28} rx={6}
              fill={isActive ? colors.accent : colors.stroke}
              fillOpacity={isActive ? 0.3 : 0.12}
              stroke={isActive ? colors.accent : colors.stroke} strokeWidth={1.5} opacity={0.8} />
          </g>
        );
      })}
    </g>
  );
}

/** A slim status bar at the foot of the window — presence, not detail:
 * a connection dot and an idle progress hairline, no invented metrics. */
export function StatusBar({ x, y, w, colors, progress, active }) {
  const p = ease(progress);
  if (p <= 0.01) return null;
  return (
    <g opacity={p * 0.85}>
      <line x1={x} y1={y} x2={x + w} y2={y} stroke={colors.stroke} strokeWidth={1.5} opacity={0.35} />
      <circle cx={x + 16} cy={y + 20} r={5} fill={active ? colors.accent : colors.stroke} opacity={active ? 1 : 0.5} />
    </g>
  );
}
