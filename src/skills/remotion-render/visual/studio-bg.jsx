/**
 * Studio background — uniform white (backgrounds.js GROUND), one solid
 * colour on every beat. The palm-frond shadow overlay and the per-channel
 * gradient were removed on 2026-09-30 (owner: "no tint, no gradient, no
 * vignette, no darkening — just white"); a full-bleed photo beat covers the
 * ground for its own beat only.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { GROUND } from "./backgrounds.js";

export function StudioBG({ children }) {
  return <AbsoluteFill style={{ backgroundColor: GROUND }}>{children}</AbsoluteFill>;
}

export default StudioBG;
