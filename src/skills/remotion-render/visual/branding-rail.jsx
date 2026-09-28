/**
 * Branding rail — the reference's fixed vertical wordmark ("MY EDIT"), left
 * of the paper, rotated 90deg counter-clockwise (reads bottom to top). Here
 * it carries the channel's own name. It never moves.
 */
import React from "react";
import { RAIL, INK } from "./paper-layout.js";

export function BrandingRail({ text, font = "Inter" }) {
  const label = String(text || "").toUpperCase();
  if (!label) return null;
  // Box is RAIL rotated: the text runs along RAIL.h, its cap height ~RAIL.w.
  const size = Math.round(Math.min(RAIL.w * 0.95, (RAIL.h * 1.35) / Math.max(4, label.length)));
  return (
    <div style={{
      position: "absolute",
      left: RAIL.x + RAIL.w / 2, top: RAIL.y + RAIL.h / 2,
      transform: "translate(-50%, -50%) rotate(-90deg)",
      whiteSpace: "nowrap", color: INK,
      font: `700 ${size}px ${font}, sans-serif`, letterSpacing: Math.round(size * 0.04),
    }}>{label}</div>
  );
}

export default BrandingRail;
