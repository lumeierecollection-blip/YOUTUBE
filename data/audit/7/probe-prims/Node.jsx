/**
 * primitives/Node.jsx — MANUAL A5.1 "Node": flow/relation points.
 *
 *   <Layer rect={…}> <Node colors={colors} active={…} /> </Layer>
 *
 * A5.1 table: circle, r 44, `surface` fill, 3 px `accent` border. Live
 * renderer (RelationScene, motion-graphics.jsx:844-868): makeCircle({radius:
 * 44}) → 88×88 path, surface fill, 3 px stroke border, flipped to accent when
 * the node is the highlight (bAccent, mg.jsx:866).
 *
 * Contract: NEVER positions itself — the wrapping Layer owns position. Node
 * fills the Layer box (the box is the 88×88 circle's bounding square; the
 * Layer rect is positioned so the circle lands on its anchor point). The
 * circle is centered in the box, so `rect.x/y` place the circle's top-left —
 * callers that need centre-anchored placement set the rect from
 * anchorPoint() (layout/slots.js) or use a centred slot anchor.
 *
 * No shadows (A5.2); a circle is excepted from A5.3's radius list.
 */

import React from "react";
import { makeCircle } from "@remotion/shapes";

const NODE_RADIUS = 44; // A5.1: r 44
const NODE_STROKE = 3; // A5.1: 3 px accent border

const circlePath = makeCircle({ radius: NODE_RADIUS }).path; // static, 88×88

/**
 * @param {object} props
 * @param {object} props.colors         derived roles (paletteFromHues keys)
 * @param {boolean} [props.active=false] accent border (live bAccent highlight)
 * @param {string} [props.fill]          override fill (default colors.surface)
 * @param {string} [props.stroke]        override stroke (default: accent if
 *   active else colors.stroke — live mg.jsx:855/866)
 */
export function Node({ colors, active = false, fill, stroke, ...rest }) {
  const strokeColor = stroke ?? (active ? colors.accent : colors.stroke);
  return (
    <svg {...rest} width="100%" height="100%" viewBox="0 0 88 88" fill="none">
      <path d={circlePath} fill={fill ?? colors.surface} stroke={strokeColor} strokeWidth={NODE_STROKE} />
    </svg>
  );
}

export default Node;
