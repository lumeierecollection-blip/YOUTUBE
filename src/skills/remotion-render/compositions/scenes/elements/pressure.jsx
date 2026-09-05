import React from "react";

/**
 * PressureWalls — a subject under physical constraint from four solid
 * walls closing in (or opening away), not a field of concentric rings.
 *
 * WHY THIS REPLACES THE RING FIELD.
 *
 * VisualMetaphorScene's first two passes still drew N concentric circles
 * (first as hairline strokes, then as filled discs) around a subject for
 * every mode except "loading" — a shrinking, growing, or wobbling ring
 * field is still the "decorative bullseye" / "concentric-ring background"
 * pattern this rebuild is explicitly required to remove (visual-system-reset
 * PART 28, PART 35), regardless of how the radius was being driven. Four
 * flat walls closing on (or opening away from) a subject is a genuinely
 * different object: it reads as a vice/press/frame acting on something,
 * with a visible aperture that narrows or widens, rather than a target
 * pattern radiating from a centre.
 */
export function PressureWalls({ cx, cy, halfW, halfH, standoff, colors, opacity = 1, wobble = [0, 0, 0, 0], accent = false }) {
  const th = Math.max(12, Math.min(halfW, halfH) * 0.22);
  const overhang = th * 1.4;
  const top = cy - halfH - standoff + (wobble[0] || 0);
  const bottom = cy + halfH + standoff + (wobble[1] || 0);
  const left = cx - halfW - standoff + (wobble[2] || 0);
  const right = cx + halfW + standoff + (wobble[3] || 0);
  const col = accent ? colors.accent : colors.stroke;
  const spanX = right - left + overhang * 2;
  const spanY = bottom - top + overhang * 2;
  return (
    <g opacity={opacity}>
      <rect x={left - overhang} y={top} width={spanX} height={th} rx={3}
        fill={col} fillOpacity={0.4} stroke={col} strokeWidth={1.5} />
      <rect x={left - overhang} y={bottom - th} width={spanX} height={th} rx={3}
        fill={col} fillOpacity={0.4} stroke={col} strokeWidth={1.5} />
      <rect x={left} y={top - overhang} width={th} height={spanY} rx={3}
        fill={col} fillOpacity={0.4} stroke={col} strokeWidth={1.5} />
      <rect x={right - th} y={top - overhang} width={th} height={spanY} rx={3}
        fill={col} fillOpacity={0.4} stroke={col} strokeWidth={1.5} />
    </g>
  );
}
