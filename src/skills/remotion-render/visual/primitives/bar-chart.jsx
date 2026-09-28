/**
 * BAR — 1-5 vertical bars growing from a thin baseline to their values over
 * the first 40% of the beat, with a 4-frame stagger. The largest bar is ink,
 * the others mid-grey. Values (rolling) above each bar, labels (caption
 * font) under. Heights are proportional to the real magnitudes, so
 * "3 million" beside "1.4 billion" is drawn at its true ratio.
 */
import React from "react";
import { parseQuantity, rollQuantity } from "./quantity.js";
import { INK, MID, SERIF, buildT } from "./viz-common.js";

export function BarChart({ data, zone, local, dur, font }) {
  const bars = (data?.bars || []).map((b) => ({ ...b, q: parseQuantity(b.value) })).filter((b) => b.q);
  if (!bars.length) return null;
  const max = Math.max(...bars.map((b) => b.q.magnitude)) || 1;
  const labelH = 44, valueH = 40;
  const plotH = zone.h - labelH - valueH;
  const baseY = zone.y + valueH + plotH;
  const slot = zone.w / bars.length;
  const bw = Math.min(110, slot * 0.56);
  const primary = bars.reduce((a, b, i) => (b.q.magnitude > bars[a].q.magnitude ? i : a), 0);
  return (
    <svg width={zone.x + zone.w} height={zone.y + zone.h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <line x1={zone.x} y1={baseY} x2={zone.x + zone.w} y2={baseY} stroke={MID} strokeWidth={1} />
      {bars.map((b, i) => {
        const t = buildT(local, dur, 0.4, i * 4);
        const h = Math.max(2, (b.q.magnitude / max) * plotH * t);
        const x = zone.x + slot * i + (slot - bw) / 2;
        return (
          <g key={i}>
            <rect x={x} y={baseY - h} width={bw} height={h} fill={i === primary ? INK : MID} />
            <text x={x + bw / 2} y={baseY - h - 12} textAnchor="middle" style={{ font: `700 26px ${font}, sans-serif` }} fill={INK}>{rollQuantity(b.q, t)}</text>
            <text x={x + bw / 2} y={baseY + 30} textAnchor="middle" style={{ font: `italic 400 20px ${SERIF}` }} fill={INK}>{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default BarChart;
