/**
 * primitives/Rule.jsx — MANUAL A5.1 "Rule": dividers, underlines, axes.
 *
 *   <Layer rect={…}> <Rule colors={colors} …/> </Layer>
 *
 * A5.1 table: 4 px, `stroke`, radius 2. The "radius 2" is the round line-cap
 * of a 4 px stroke (live renderer: motion-graphics.jsx:690-698, `<line
 * strokeWidth={4} strokeLinecap="round">`), not a box corner radius — A5.3's
 * radius list applies to boxes, and A5.1's own Rule row says radius 2.
 *
 * Contract (LAYOUT-SYSTEM §4.2): this primitive NEVER positions itself. The
 * wrapping Layer applies position:absolute + the compiled rect; Rule fills
 * that box (svg 100% × 100%) and draws one line between box-relative
 * endpoints. Default endpoints span the full box (a divider/axis); pass
 * explicit x1/y1/x2/y2 for a partial rule (e.g. the accent underline under a
 * term, or the connector-style segment).
 *
 * No shadows (A5.2), no composition math, no useCurrentFrame — static by
 * design (a Rule is furniture; any entrance/exit motion is the Layer's).
 */

import React from "react";

/**
 * @param {object} props
 * @param {object} props.colors      derived roles (paletteFromHues keys:
 *   bg, surface, raised, stroke, textPrimary, textDim, accent)
 * @param {number} [props.x1=0]      line start, box-relative
 * @param {number} [props.y1=null]   line start, box-relative (null → vertical centre)
 * @param {number} [props.x2=null]   line end, box-relative (null → box width)
 * @param {number} [props.y2=null]   line end, box-relative (null → same as y1)
 * @param {number} [props.thickness=4]  px, A5.1
 * @param {string} [props.color]     stroke colour — defaults to colors.stroke;
 *   pass colors.accent for the accent rule (TYP-18)
 */
export function Rule({ colors, x1 = 0, y1 = null, x2 = null, y2 = null, thickness = 4, color, ...rest }) {
  const left = x1;
  const top = y1 ?? thickness / 2; // default: a horizontal rule centred in the box
  const right = x2 ?? 100; // box is a 100×100 coordinate space (proportional)
  const sameY = y2 ?? top;
  return (
    <svg
      {...rest}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
    >
      <line
        x1={left}
        y1={top}
        x2={right}
        y2={sameY}
        stroke={color ?? colors.stroke}
        strokeWidth={thickness}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default Rule;
