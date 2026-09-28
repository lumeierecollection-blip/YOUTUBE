/**
 * Abstract shapes from the reference (docs/REFERENCE-STYLE.md, 10-14 s,
 * 20-24 s, 28-29 s, 8.0 s):
 *   petals   a cluster of three black teardrop petals growing in from a
 *            corner of the paper (scale 0 -> 1 over 0.4 s, then hold)
 *   swoosh   a thick black arc sweeping across a corner (drawn over 0.4 s)
 *   hairline thin curves crossing the page (drawn over 0.4 s)
 * Drawn in PAPER coordinates, entirely INSIDE the paper's inner content box
 * (paper-layout.js PAPER_INNER, the fit contract): a shape anchors at a
 * corner of the inner box, inset by its own stroke/bulge, and grows inward.
 * They used to start off the page and be clipped at its edge - the fit
 * contract forbids both running past the box and clipping.
 */
import React from "react";
import { Easing } from "remotion";
import { PAPER, PAPER_INNER, INK } from "./paper-layout.js";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = Easing.bezier(0.2, 0.9, 0.2, 1);
// Corners of the inner box, with the inward direction.
function corners(B) {
  return { tl: [B.x, B.y, 1, 1], tr: [B.x + B.w, B.y, -1, 1], bl: [B.x, B.y + B.h, 1, -1], br: [B.x + B.w, B.y + B.h, -1, -1] };
}

function petal(len, wid) {
  return `M0,0 C${wid},${len * 0.25} ${wid * 0.9},${len * 0.8} 0,${len} C${-wid * 0.9},${len * 0.8} ${-wid},${len * 0.25} 0,0Z`;
}

export function AbstractShape({ variant, corner = "tr", local = 0, fps = 30, bounds = PAPER_INNER }) {
  if (!variant || variant === "none") return null;
  const B = bounds;
  const t = ease(clamp01(local / (0.4 * fps)));
  const C = corners(B);
  const [bx, by, sx, sy] = C[corner] || C.tr;
  if (variant === "petals" || variant === "leaf") {
    const base = Math.atan2(sy, sx) * 180 / Math.PI - 90;
    // The outer petals (±38° off the diagonal) bulge up to ~0.9 x their
    // half-width sideways past the anchor: inset the anchor by that.
    const inset = PAPER.w * 0.07;
    const cx = bx + sx * inset, cy = by + sy * inset;
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
    // Stroke half-width + its round cap, so the arc's ends stay inside.
    const sw = PAPER.w * 0.055, inset = sw / 2 + 6;
    const cx = bx + sx * inset, cy = by + sy * inset;
    const d = `M${cx},${cy + sy * r * 0.55} Q${cx + sx * r * 0.25},${cy + sy * r * 0.2} ${cx + sx * r * 0.62},${cy}`;
    return (
      <svg width={PAPER.w} height={PAPER.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={d} fill="none" stroke={INK} strokeWidth={sw} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
      </svg>
    );
  }
  // hairline
  // Edge to edge of the inner box (not the page); the lower curve runs in
  // the band under the caption (y 86-93%), above the inner box's bottom.
  const x0 = B.x + 2, x1 = B.x + B.w - 2, H = PAPER.h;
  const d1 = `M${x0},${H * 0.22} C${B.x + B.w * 0.3},${H * 0.12} ${B.x + B.w * 0.6},${H * 0.34} ${x1},${H * 0.2}`;
  const d2 = `M${x0},${H * 0.9} C${B.x + B.w * 0.3},${H * 0.86} ${B.x + B.w * 0.7},${H * 0.93} ${x1},${H * 0.88}`;
  return (
    <svg width={PAPER.w} height={PAPER.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {[d1, d2].map((d, i) => <path key={i} d={d} fill="none" stroke={INK} strokeWidth={2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />)}
    </svg>
  );
}

export default AbstractShape;
