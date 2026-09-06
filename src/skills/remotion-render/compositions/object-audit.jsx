import React from "react";
import { AbsoluteFill } from "remotion";
import { ObjectShape, knownObjects } from "./objects/registry.js";
import "./objects/index.jsx";

/**
 * Every registered object drawn once, each in a known box with a gap around it.
 *
 * THE BOX IS THE CONTRACT. A drawing gets a rect in frame pixels and must stay
 * inside it, because the renderer sizes and places objects against the camera-
 * inverted safe rect and an object that draws 24% larger than its box makes
 * that arithmetic a lie. That is not hypothetical: ch-09's border line did draw
 * at 1.24x, and the measured frame landed 16px below the safe rect.
 *
 * `qa-scripts/audit-object-bounds.mjs` renders this once and measures the gap
 * around each cell. Ink in the gap is an object breaking its contract, and it
 * names which one — one render for all 88 rather than 88 renders.
 */
export const AUDIT = { cols: 8, cell: { w: 270, h: 262 }, pad: 34 };

export function ObjectAudit({ colors, page = 0, perPage = 88 }) {
  const names = knownObjects().slice(page * perPage, (page + 1) * perPage);
  const { cols, cell, pad } = AUDIT;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.ground }}>
      <svg width={cols * cell.w} height={Math.ceil(names.length / cols) * cell.h}
        style={{ position: "absolute", left: 0, top: 0 }}>
        {names.map((name, i) => {
          const cx = (i % cols) * cell.w;
          const cy = Math.floor(i / cols) * cell.h;
          return (
            <g key={name} transform={`translate(${cx + pad}, ${cy + pad})`}>
              <ObjectShape name={name} colors={colors} p={0.85}
                box={{ x: 0, y: 0, w: cell.w - pad * 2, h: cell.h - pad * 2 }} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "ObjectAudit",
    component: ObjectAudit,
    durationInFrames: 1,
    fps: 30,
    width: AUDIT.cols * AUDIT.cell.w,
    height: 11 * AUDIT.cell.h,
    defaultProps: {
      colors: { ground: "#FFFFFF", paper: "#FFFFFF", ink: "#0F172A", onGround: "#0F172A", accent: "#22C55E" },
    },
  },
];
