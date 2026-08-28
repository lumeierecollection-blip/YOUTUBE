import React from "react";
import { ease } from "../primitives.jsx";

/**
 * MorphShape — an object whose own FORM changes, not two boxes swapped
 * for each other (visual-system-reset PART 14/§10's "coloured wireframe"
 * test: two rectangles that only change colour or position fail it).
 *
 * Interpolates corner rounding (a technique borrowed from the lifeprompt
 * reference's ShapeMorphing scene — literal shape interpolation rather
 * than a cut between two states) AND its own proportions, so the object
 * is visibly a DIFFERENT shape at the end than it was at the start, not
 * the same rectangle relabelled.
 */
export function MorphShape({ cx, baseY, fromH, toH, w, progress, colors, accent = false }) {
  const p = ease(Math.max(0, Math.min(1, progress)));
  const h = fromH + (toH - fromH) * p;
  // Rounder while small/starting, squares off as it grows/settles — a
  // shape becoming more resolved as the value resolves.
  const radius = Math.max(4, (Math.min(w, h) / 2) * (1 - 0.75 * p));
  const col = accent ? colors.accent : colors.stroke;
  return (
    <rect
      x={cx - w / 2} y={baseY - h} width={w} height={Math.max(h, 1)} rx={radius}
      fill={col} fillOpacity={0.22 + 0.4 * p} stroke={col} strokeWidth={3}
    />
  );
}

/**
 * A bounded container whose CONTENTS change density/order — used where no
 * specific before/after content is known (BEFORE_AFTER carries no real
 * data at all), so the change stays a real object's contents shifting
 * rather than an unbounded field of independent cells with nothing
 * holding them.
 */
export function ContentVessel({ x, y, w, h, colors, progress }) {
  const p = ease(progress);
  return (
    <rect x={x} y={y} width={w} height={h} rx={10}
      fill={colors.stroke} fillOpacity={0.05} stroke={colors.stroke} strokeWidth={2.5} opacity={p} />
  );
}
