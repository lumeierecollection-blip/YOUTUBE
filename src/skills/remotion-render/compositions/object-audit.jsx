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
 * `qa-scripts/audit-object-bounds.mjs` renders this and measures the gap
 * around each cell. Ink in the gap is an object breaking its contract, and it
 * names which one — one render for all of them rather than one render each.
 *
 * THE CLOCK IS PART OF THE CONTRACT. This used to draw every object at a single
 * `p = 0.85` and pass. The moment the sentence renderer started sweeping `p`
 * across the whole beat, the springtail's furcula — `sin(p * 2PI)`, at full
 * extension when p is 0.25 — reached 48px past the safe rect in a measured
 * frame, having never been drawn at that phase by any check. `p` is a prop now
 * and the audit sweeps it, because a box a drawing only honours at one phase
 * is not a box.
 */
export const AUDIT = { cols: 8, cell: { w: 270, h: 262 }, pad: 34 };

export function ObjectAudit({ colors, p = 0.85 }) {
  // Every registered object, always. A fixed page size of 88 silently stopped
  // drawing the natural-world set the moment it was added, and the audit then
  // passed 109 objects while looking at 21 empty cells.
  const names = knownObjects();
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
              <ObjectShape name={name} colors={colors} p={p}
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
    // Derived from the registry, not a fixed 11: adding the natural-world set
    // overflowed a hard-coded grid and the audit then measured the wrong cells,
    // reporting four objects out of box that were nothing of the kind.
    height: Math.ceil(knownObjects().length / AUDIT.cols) * AUDIT.cell.h,
    defaultProps: {
      colors: { ground: "#FFFFFF", paper: "#FFFFFF", ink: "#0F172A", onGround: "#0F172A", accent: "#22C55E" },
      p: 0.85,
    },
  },
];
