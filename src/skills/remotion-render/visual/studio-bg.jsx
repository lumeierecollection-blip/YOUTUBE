/**
 * Studio background — the reference's white studio with soft palm-frond
 * shadows (docs/REFERENCE-STYLE.md: measured darkest luminance 169 on the
 * right, 109 on the left; static).
 *
 * The shadows are drawn procedurally (an SVG frond — a curved stem with
 * leaflets — heavily blurred), not taken from a photo: they are lighting
 * decoration, not a depiction of anything the narration claims.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { CANVAS, STUDIO_BG } from "./paper-layout.js";

// One frond: leaflets along a quadratic stem from (0,0) toward (len,0),
// curving by `bend`. Returns SVG path data for all leaflets.
function frondPath(len, bend, leaflets = 16) {
  const parts = [];
  for (let i = 1; i <= leaflets; i++) {
    const t = i / (leaflets + 1);
    const x = len * t, y = bend * 4 * t * (1 - t);
    const size = len * 0.34 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    for (const side of [-1, 1]) {
      const ang = side * (0.95 - 0.35 * t);            // leaflets sweep back along the stem
      const ex = x + Math.cos(ang) * size * 0.35, ey = y + Math.sin(ang) * size;
      const cx1 = x + Math.cos(ang - side * 0.25) * size * 0.55, cy1 = y + Math.sin(ang - side * 0.25) * size * 0.5;
      const cx2 = x + Math.cos(ang + side * 0.25) * size * 0.2, cy2 = y + Math.sin(ang + side * 0.25) * size * 0.5;
      parts.push(`M${x.toFixed(1)},${y.toFixed(1)} Q${cx1.toFixed(1)},${cy1.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} Q${cx2.toFixed(1)},${cy2.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}Z`);
    }
  }
  return parts.join(" ");
}

export function StudioBG({ children }) {
  const { w, h } = CANVAS;
  return (
    <AbsoluteFill style={{ backgroundColor: STUDIO_BG }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="frond-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" /></filter>
        </defs>
        {/* top-right frond, falling down-left across the corner */}
        <g filter="url(#frond-blur)" opacity={0.26} transform={`translate(${w + 60},-40) rotate(128)`}>
          <path d={frondPath(820, 90)} fill="#000" />
        </g>
        {/* left frond, reaching in from the edge at mid-height (darker, as measured) */}
        <g filter="url(#frond-blur)" opacity={0.34} transform={`translate(-80,${h * 0.36}) rotate(18)`}>
          <path d={frondPath(700, -70, 14)} fill="#000" />
        </g>
        {/* faint lower-right frond */}
        <g filter="url(#frond-blur)" opacity={0.14} transform={`translate(${w + 40},${h * 0.62}) rotate(200)`}>
          <path d={frondPath(600, 60, 12)} fill="#000" />
        </g>
      </svg>
      {children}
    </AbsoluteFill>
  );
}

export default StudioBG;
