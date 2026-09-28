/**
 * PIE — a donut whose primary segment sweeps open from 0 to its percentage
 * over the first 50% of the beat; the remainder fills in after, light grey.
 * The centre holds the percentage (rolling) and its label.
 */
import React from "react";
import { INK, LIGHT, SERIF, buildT } from "./viz-common.js";

function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
}

// Fit contract: drawn inside `bounds` (ring radius + stroke < half the box).
export function PieChart({ data, bounds: zone, local, dur, font }) {
  const pct = Math.max(0, Math.min(100, Number(data?.percent)));
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const r = Math.min(zone.w, zone.h) * 0.36;
  const sw = r * 0.34;
  const cx = zone.x + zone.w / 2, cy = zone.y + zone.h / 2;
  const t = buildT(local, dur, 0.5);
  const rest = buildT(local, dur, 0.2, dur * 0.45);
  const full = 2 * Math.PI;
  const a1 = (pct / 100) * full * t;
  const restStart = (pct / 100) * full;
  const restEnd = restStart + (1 - pct / 100) * full * rest;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={zone.x + zone.w} height={zone.y + zone.h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {rest > 0 && pct < 100 ? <path d={arc(cx, cy, r, restStart, Math.min(restEnd, full - 0.0001))} fill="none" stroke={LIGHT} strokeWidth={sw} /> : null}
        {a1 > 0.001 ? <path d={arc(cx, cy, r, 0, Math.min(a1, full - 0.0001))} fill="none" stroke={INK} strokeWidth={sw} /> : null}
      </svg>
      <div style={{ position: "absolute", left: cx - r, top: cy - r * 0.35, width: r * 2, textAlign: "center" }}>
        <div style={{ font: `700 ${Math.round(r * 0.46)}px ${font}, sans-serif`, color: INK, lineHeight: 1 }}>{Math.round(pct * t)}%</div>
        {data.label ? <div style={{ font: `italic 400 ${Math.round(r * 0.13 + 8)}px ${SERIF}`, color: INK, marginTop: 6 }}>{data.label}</div> : null}
      </div>
    </div>
  );
}

export default PieChart;
