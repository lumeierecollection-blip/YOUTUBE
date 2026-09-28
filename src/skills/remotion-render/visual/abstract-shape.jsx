/**
 * Abstract shapes from the reference (docs/REFERENCE-STYLE.md, 10-14 s,
 * 20-24 s, 28-29 s, 8.0 s):
 *   petals   a cluster of three black teardrop petals growing in from a
 *            corner (scale 0 -> 1 over 0.4 s, then hold)
 *   swoosh   a thick black arc sweeping across a corner (drawn over 0.4 s)
 *   hairline two thin curves (drawn over 0.4 s)
 *
 * Placement is shape-geometry.js shapeLayout(): a corner of the VISUAL zone
 * only (paper-layout.js ZONES), inside a box of at most 220 x 220 paper px
 * (150 x 150 behind a chart, counter or map), scaled down to fit or not
 * drawn. A shape never enters the headline or caption zone, so it cannot
 * cross text. PaperContent draws it BEHIND the visual (the cutout or chart
 * sits on top of it). Run 36397373831 ch-44: a swoosh crossed the caption
 * "for securing" and another cut through "Leveraging information ...
 * advantage" when shapes were placed at the page corners with no knowledge
 * of the text.
 */
import React from "react";
import { Easing } from "remotion";
import { PAPER, INK } from "./paper-layout.js";
import { shapeLayout, petalPath } from "./shape-geometry.js";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = Easing.bezier(0.2, 0.9, 0.2, 1);

export function AbstractShape({ variant, corner = "tr", visualType = null, local = 0, fps = 30 }) {
  if (!variant || variant === "none") return null;
  const L = shapeLayout(variant, corner, visualType);
  if (!L) return null;
  const t = ease(clamp01(local / (0.4 * fps)));
  const g = L.geometry;
  const place = `translate(${L.ax.toFixed(2)},${L.ay.toFixed(2)}) scale(${(L.sx * L.scale).toFixed(4)},${(L.sy * L.scale).toFixed(4)})`;
  let body;
  if (g.kind === "petals") {
    // Grows about the petals' shared root, which lies inside the final box,
    // so the growing cluster never leaves it.
    body = (
      <g transform={`scale(${t.toFixed(4)})`}>
        {g.petals.map((p, i) => <path key={i} d={petalPath(p.len, p.wid)} fill={INK} transform={`rotate(${p.rot})`} />)}
      </g>
    );
  } else if (g.kind === "swoosh") {
    body = (
      <path d={`M${g.p0} Q${g.p1} ${g.p2}`} fill="none" stroke={INK} strokeWidth={g.sw} strokeLinecap="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
    );
  } else {
    body = g.curves.map((c, i) => (
      // 2 px on the paper whatever the placement scale.
      <path key={i} d={`M${c[0]} C${c[1]} ${c[2]} ${c[3]}`} fill="none" stroke={INK} strokeWidth={g.sw / L.scale}
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
    ));
  }
  return (
    <svg width={PAPER.w} height={PAPER.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g transform={place}>{body}</g>
    </svg>
  );
}

export default AbstractShape;
