/**
 * Abstract shapes from the reference (docs/REFERENCE-STYLE.md, 10-14 s,
 * 20-24 s, 28-29 s, 8.0 s):
 *   petals   a cluster of three black teardrop petals growing in from a
 *            corner of the paper (scale 0 -> 1 over 0.4 s, then hold)
 *   swoosh   a thick black arc sweeping across a corner (drawn over 0.4 s)
 *   hairline thin curves crossing the page (drawn over 0.4 s)
 * Drawn in PAPER coordinates; they may run off the paper's edge.
 */
import React from "react";
import { Easing } from "remotion";
import { PAPER, INK } from "./paper-layout.js";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = Easing.bezier(0.2, 0.9, 0.2, 1);
const CORNERS = { tl: [0, 0, 1, 1], tr: [PAPER.w, 0, -1, 1], bl: [0, PAPER.h, 1, -1], br: [PAPER.w, PAPER.h, -1, -1] };

function petal(len, wid) {
  return `M0,0 C${wid},${len * 0.25} ${wid * 0.9},${len * 0.8} 0,${len} C${-wid * 0.9},${len * 0.8} ${-wid},${len * 0.25} 0,0Z`;
}

export function AbstractShape({ variant, corner = "tr", local = 0, fps = 30 }) {
  if (!variant || variant === "none") return null;
  const t = ease(clamp01(local / (0.4 * fps)));
  const [cx, cy, sx, sy] = CORNERS[corner] || CORNERS.tr;
  if (variant === "petals" || variant === "leaf") {
    const base = Math.atan2(sy, sx) * 180 / Math.PI - 90;
    return (
      <svg width={PAPER.w} height={PAPER.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g transform={`translate(${cx},${cy}) scale(${t})`}>
          {[-38, 0, 38].map((a, i) => (
            <path key={i} d={petal(PAPER.w * (i === 1 ? 0.3 : 0.24), PAPER.w * 0.07)} fill={INK} transform={`rotate(${base + a})`} />
          ))}
        </g>
      </svg>
    );
  }
  if (variant === "swoosh" || variant === "ribbon") {
    const r = PAPER.w * 0.9;
    const d = `M${cx + sx * -40},${cy + sy * r * 0.55} Q${cx + sx * r * 0.25},${cy + sy * r * 0.2} ${cx + sx * r * 0.62},${cy + sy * -40}`;
    return (
      <svg width={PAPER.w} height={PAPER.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={d} fill="none" stroke={INK} strokeWidth={PAPER.w * 0.055} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
      </svg>
    );
  }
  // hairline
  const d1 = `M-20,${PAPER.h * 0.22} C${PAPER.w * 0.35},${PAPER.h * 0.12} ${PAPER.w * 0.6},${PAPER.h * 0.34} ${PAPER.w + 20},${PAPER.h * 0.2}`;
  const d2 = `M-20,${PAPER.h * 0.86} C${PAPER.w * 0.3},${PAPER.h * 0.78} ${PAPER.w * 0.7},${PAPER.h * 0.92} ${PAPER.w + 20},${PAPER.h * 0.8}`;
  return (
    <svg width={PAPER.w} height={PAPER.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {[d1, d2].map((d, i) => <path key={i} d={d} fill="none" stroke={INK} strokeWidth={2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />)}
    </svg>
  );
}

export default AbstractShape;
