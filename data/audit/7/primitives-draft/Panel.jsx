/**
 * primitives/Panel.jsx — MANUAL A5.1 "Panel": grouped content.
 *
 *   <Layer rect={…}> <Panel colors={colors}>…content…</Panel> </Layer>
 *
 * A5.1 table: `surface`, radius 24, 32 px padding, no shadow. A5.2: no
 * shadows, no bevels, no glass, no blur-behind — so the panel is a flat
 * surface fill with rounded corners and padding, nothing else.
 *
 * Contract: NEVER positions itself — the wrapping Layer owns position
 * (LAYOUT-SYSTEM §4.2). Panel fills the Layer box (width/height 100%,
 * border-box) and lays out its children inside the 32 px padding. The panel
 * is a plain block — no flex, no grid (if a caller needs an internal row,
 * they compose chips/nodes inside via their own Layer children, not flex
 * siblings in the Stage).
 *
 * No shadows (A5.2); radius 24 is a permitted A5.3 value.
 */

import React from "react";

const PANEL_RADIUS = 24; // A5.1 / A5.3
const PANEL_PAD = 32; // A5.1: 32 px padding

/**
 * @param {object} props
 * @param {object} props.colors   derived roles (paletteFromHues keys)
 * @param {import("react").ReactNode} props.children  grouped content
 */
export function Panel({ colors, children, style, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: PANEL_PAD,
        borderRadius: PANEL_RADIUS,
        backgroundColor: colors.surface,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Panel;
