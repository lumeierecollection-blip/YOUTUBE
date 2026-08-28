import React from "react";

/**
 * ChartColumn — a constructed block, not a flat rectangle standing in for
 * a number. Three faces (front, top, side) built from the SAME ink at
 * three opacities — no new colour, no gradient, the same technique the
 * rest of the renderer already uses for depth — so a column reads as a
 * solid volume with weight rather than a bar-chart rectangle.
 *
 * Shared by ComparisonScene (two quantities, physically different scales)
 * and DataChartScene (a designed data column with real hierarchy), so the
 * "two magnitudes" and "series of magnitudes" cases build the same kind
 * of object instead of each inventing its own rectangle.
 */
export function ChartColumn({ x, w, baseY, h, colors, emphasis = 1, dim = false, color }) {
  if (h <= 0.5) return null;
  const depth = Math.min(18, w * 0.22);
  const topY = baseY - h;
  const col = color || colors.accent;
  const baseOpacity = dim ? 0.16 : 0.32 + 0.58 * emphasis;

  return (
    <g opacity={dim ? 0.55 : 1}>
      {/* Side face — darkest of the three, the "shadowed" side. */}
      <path
        d={`M ${x + w} ${topY} L ${x + w + depth} ${topY - depth * 0.6} L ${x + w + depth} ${baseY - depth * 0.6} L ${x + w} ${baseY} Z`}
        fill={col} fillOpacity={baseOpacity * 0.55} stroke={col} strokeOpacity={0.5} strokeWidth={1.5}
      />
      {/* Top face — lightest, catching the light. */}
      <path
        d={`M ${x} ${topY} L ${x + depth} ${topY - depth * 0.6} L ${x + w + depth} ${topY - depth * 0.6} L ${x + w} ${topY} Z`}
        fill={col} fillOpacity={Math.min(1, baseOpacity * 1.25)} stroke={col} strokeOpacity={0.6} strokeWidth={1.5}
      />
      {/* Front face. */}
      <rect x={x} y={topY} width={w} height={h}
        fill={col} fillOpacity={baseOpacity} stroke={col} strokeWidth={2.5} />
    </g>
  );
}
