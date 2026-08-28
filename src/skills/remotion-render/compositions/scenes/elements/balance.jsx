import React from "react";
import { StackedMass } from "./chart.jsx";

/**
 * BalanceBeam — two stated quantities as a physical weighing scale, not two
 * bars on a shared axis. A beam pivots on a fulcrum; the heavier side's pan
 * sits lower. Tilt is derived from the real value delta, nothing invented.
 *
 * WHY COMPARISON GETS ITS OWN OBJECT INSTEAD OF SHARING DataChartScene's
 * bars. "Two quantities set against each other" and "a labelled series of
 * quantities" are different relationships — a shared bar/column look was
 * part of what made both strategies feel interchangeable. Weighing is the
 * literal, non-decorative reading of "comparison" (PART 28: geometry earns
 * its place only when the story specifically requires it — a comparison
 * IS a weighing). The masses on each pan reuse StackedMass so both scenes
 * still share the same underlying MATERIAL technique (PART 10: sharing a
 * primitive is fine, sharing the whole composition is not), while the
 * fulcrum/beam/pans make the composed object unmistakably different from a
 * freestanding column.
 */
export function BalanceBeam({
  cx, fulcrumY, span, tilt, colors,
  aH, bH, aColor, bColor, aDim, bDim, aEmphasis, bEmphasis,
}) {
  const halfSpan = span / 2;
  const maxDrop = 44;
  const t = Math.max(-1, Math.min(1, tilt));
  const leftY = fulcrumY - t * maxDrop;
  const rightY = fulcrumY + t * maxDrop;
  const hanger = 30;
  const panW = span * 0.32;

  return (
    <g>
      {/* Fulcrum — a solid triangular base the beam rests on. */}
      <path
        d={`M ${cx - 22} ${fulcrumY + 30} L ${cx + 22} ${fulcrumY + 30} L ${cx} ${fulcrumY} Z`}
        fill={colors.stroke} fillOpacity={0.42} stroke={colors.stroke} strokeWidth={2}
      />
      <rect x={cx - 34} y={fulcrumY + 28} width={68} height={8} rx={2}
        fill={colors.stroke} fillOpacity={0.42} />

      {/* Beam — a single rigid bar tilting on the fulcrum. */}
      <line x1={cx - halfSpan} y1={leftY} x2={cx + halfSpan} y2={rightY}
        stroke={colors.stroke} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
      <circle cx={cx} cy={fulcrumY} r={7} fill={colors.stroke} opacity={0.85} />

      {/* Left hanger + pan + mass. */}
      <line x1={cx - halfSpan} y1={leftY} x2={cx - halfSpan} y2={leftY + hanger}
        stroke={colors.stroke} strokeWidth={2} opacity={0.6} />
      <rect x={cx - halfSpan - panW / 2} y={leftY + hanger} width={panW} height={6} rx={2}
        fill={colors.stroke} fillOpacity={0.55} />
      <StackedMass x={cx - halfSpan - panW / 2 + panW * 0.08} w={panW * 0.84}
        baseY={leftY + hanger} h={aH} colors={colors} color={aColor}
        dim={aDim} emphasis={aEmphasis} />

      {/* Right hanger + pan + mass. */}
      <line x1={cx + halfSpan} y1={rightY} x2={cx + halfSpan} y2={rightY + hanger}
        stroke={colors.stroke} strokeWidth={2} opacity={0.6} />
      <rect x={cx + halfSpan - panW / 2} y={rightY + hanger} width={panW} height={6} rx={2}
        fill={colors.stroke} fillOpacity={0.55} />
      <StackedMass x={cx + halfSpan - panW / 2 + panW * 0.08} w={panW * 0.84}
        baseY={rightY + hanger} h={bH} colors={colors} color={bColor}
        dim={bDim} emphasis={bEmphasis} />
    </g>
  );
}
