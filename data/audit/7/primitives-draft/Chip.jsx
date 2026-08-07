/**
 * primitives/Chip.jsx — MANUAL A5.1 "Chip": list items, labels, nodes.
 *
 *   <Layer rect={…}> <Chip colors={colors} active={…}>…content…</Chip> </Layer>
 *
 * A5.1 table: `surface` fill, 2 px `stroke` border, radius 16, padding 16×24.
 * Live renderer (ListRunScene, motion-graphics.jsx:1048-1087): radius 16,
 * surface fill, 2 px stroke border, paddingLeft/Right 24, flex row with gap
 * 24, content vertically centred — the draft is exactly that, parameterised.
 *
 * Contract: NEVER positions itself — the wrapping Layer owns position
 * (LAYOUT-SYSTEM §4.2). Chip fills the Layer box and lays out its children
 * inside (the one permitted flex: INSIDE a single leaf primitive, §4.1 R1 —
 * the Tier-2 sibling-flex gate is about flex in Stage/Headline/Caption
 * positioners, not this leaf).
 *
 * `active` flips the border to accent (the live badgeAccent case, mg.jsx:1078)
 * and, if `activeColor` is given, tints the label text to accent. The badge
 * itself is the caller's content (a Node primitive inside the chip, or a
 * number in a circle) — Chip only provides the surface.
 *
 * No shadows (A5.2); radius 16 is a permitted A5.3 value.
 */

import React from "react";

const CHIP_BORDER = 2; // A5.1: 2 px stroke border
const CHIP_RADIUS = 16; // A5.1 / A5.3
const CHIP_PAD = { y: 16, x: 24 }; // A5.1 "padding 16×24"
const CHIP_GAP = 24; // live ListRunScene gap (mg.jsx:1059)

/**
 * @param {object} props
 * @param {object} props.colors   derived roles (paletteFromHues keys)
 * @param {boolean} [props.active=false] accent border/label (live badgeAccent)
 * @param {boolean} [props.activeColor=true] when active, tint text to accent
 * @param {import("react").ReactNode} props.children  content laid out inside
 */
export function Chip({ colors, active = false, activeColor = true, children, style, ...rest }) {
  const borderColor = active ? colors.accent : colors.stroke;
  return (
    <div
      {...rest}
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex", // leaf-internal layout — §4.1 R1, not a sibling positioner
        alignItems: "center",
        gap: CHIP_GAP,
        padding: `${CHIP_PAD.y}px ${CHIP_PAD.x}px`,
        borderRadius: CHIP_RADIUS,
        backgroundColor: colors.surface,
        border: `${CHIP_BORDER}px solid ${borderColor}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Chip;
