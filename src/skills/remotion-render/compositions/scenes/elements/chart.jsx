import React from "react";

/**
 * StackedMass — a quantity built from discrete, countable units stacked
 * upward, not a flat rectangle and not a rectangle with fake isometric
 * bevel faces pretending to be a 3D block.
 *
 * WHY THIS REPLACES ChartColumn.
 *
 * ChartColumn (visual-system-reset PART 2 of this repo's history) drew
 * three `<path>` faces — front/top/side — off one ink colour at three
 * opacities, styled as a fake-3D isometric block. Read cold on a rendered
 * frame it is a grey bevelled block with a number over it: the exact
 * "grey 3D bar chart" / fake-3D-bevel pattern this rebuild is explicitly
 * required to remove (visual-system-reset PART 11, PART 35). Faking depth
 * with two extra parallelograms is decoration bolted onto a rectangle, not
 * a designed object with internal structure.
 *
 * A stack of real, separately-drawn unit segments IS internal structure:
 * the number of segments is the value (derived from the real number, nothing
 * invented), each segment is a discrete filled body with its own edge, and
 * the whole column reads as counted mass — the isotype/pictogram-chart
 * convention (discrete repeated units) rather than the continuous-bar
 * convention this project was told to stop defaulting to.
 */
export function StackedMass({ x, w, baseY, h, colors, color, dim = false, emphasis = 1 }) {
  if (h <= 0.5) return null;
  const col = color || colors.accent;
  const unit = Math.max(10, Math.min(20, w * 0.55));
  const gapPx = Math.max(2, unit * 0.16);
  const count = Math.max(1, Math.round(h / unit));
  const segH = (h - gapPx * (count - 1)) / count;
  const baseOpacity = dim ? 0.18 : 0.32 + 0.55 * emphasis;
  const segs = [];
  for (let i = 0; i < count; i++) {
    const segTop = baseY - (i + 1) * segH - i * gapPx;
    // Alternating opacity between neighbouring units is what makes them
    // read as separate counted pieces instead of one gradient-shaded bar.
    const o = baseOpacity * (i % 2 === 0 ? 1 : 0.84);
    segs.push(
      <rect key={i} x={x} y={segTop} width={w} height={Math.max(1, segH)}
        rx={Math.min(4, segH * 0.32)}
        fill={col} fillOpacity={o} stroke={col} strokeOpacity={0.5} strokeWidth={1.5} />
    );
  }
  return <g opacity={dim ? 0.55 : 1}>{segs}</g>;
}
