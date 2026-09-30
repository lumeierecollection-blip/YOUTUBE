import { UpwardArrow } from "./UpwardArrow.jsx";
import { DownwardArrow } from "./DownwardArrow.jsx";
import { WarningTriangle } from "./WarningTriangle.jsx";
import { Checkmark } from "./Checkmark.jsx";
import { Crosshair } from "./Crosshair.jsx";
import { Radar } from "./Radar.jsx";
import { BrokenChain } from "./BrokenChain.jsx";
import { DollarSign } from "./DollarSign.jsx";
import React from "react";

/** The drawn symbols by concept name (visual/concept-classes.js SYMBOLS). */
export const SYMBOL_COMPONENTS = {
  "upward-arrow": UpwardArrow, "downward-arrow": DownwardArrow, "warning-triangle": WarningTriangle, "checkmark": Checkmark,
  "crosshair": Crosshair, "radar": Radar, "broken-chain": BrokenChain, "dollar-sign": DollarSign,
};

/** <Symbol name="warning-triangle" size={380} color={accent} /> — null for a name that is not a symbol. */
export function Symbol({ name, ...props }) {
  const C = SYMBOL_COMPONENTS[name];
  return C ? <C {...props} /> : null;
}

export { UpwardArrow, DownwardArrow, WarningTriangle, Checkmark, Crosshair, Radar, BrokenChain, DollarSign };
