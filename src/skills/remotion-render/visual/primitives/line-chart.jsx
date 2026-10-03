/**
 * LINE — a line through the sentence's values drawing left to right over
 * the first 60% of the beat; a dot at its end pulses once on arrival. Thin
 * 1px mid-grey axis rules; labels in the caption font; end value in the
 * headline font. Points are scaled by real magnitude.
 */
import React from "react";
import { parseQuantity, rollQuantity } from "./quantity.js";
import { INK, MID, SERIF, clamp01, buildT } from "./viz-common.js";

// Fit contract: drawn inside `bounds`; end labels anchor inward.
export function LineChart({ data, bounds: zone, local, dur, fps = 30, font }) {
  const pts = (data?.points || []).map((p) => ({ ...p, q: parseQuantity(p.value) })).filter((p) => p.q);
  if (pts.length < 2) return null;
  const pad = 30;
  const top = zone.y + 50, bottom = zone.y + zone.h - 44;
  const left = zone.x + pad, right = zone.x + zone.w - pad;
  const max = Math.max(...pts.map((p) => p.q.magnitude)) || 1;
  const xy = pts.map((p, i) => [left + (i * (right - left)) / (pts.length - 1), bottom - (p.q.magnitude / max) * (bottom - top)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const t = buildT(local, dur, 0.6);
  const arrived = clamp01((local - dur * 0.6) / (0.3 * fps));
  const pulse = arrived > 0 && arrived < 1 ? 1 + 0.6 * Math.sin(Math.PI * arrived) : 1;
  const [ex, ey] = xy[xy.length - 1];
  const last = pts[pts.length - 1];
  return (
    <svg width={zone.x + zone.w} height={zone.y + zone.h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <line x1={left} y1={bottom} x2={right} y2={bottom} stroke={MID} strokeWidth={1} />
      <line x1={left} y1={top} x2={left} y2={bottom} stroke={MID} strokeWidth={1} />
      <path d={d} fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
      {t >= 0.999 ? <circle cx={ex} cy={ey} r={8 * pulse} fill={INK} /> : null}
      {pts.map((p, i) => (
        <text key={i} x={xy[i][0]} y={bottom + 30} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}
          style={{ font: `italic 400 20px ${SERIF}` }} fill={INK}>{p.label}</text>
      ))}
      <text x={ex} y={ey - 22} textAnchor="end" style={{ font: `700 28px ${font}, sans-serif` }} fill={INK} opacity={clamp01(arrived * 2)}>{rollQuantity(last.q, 1)}</text>
      <text x={xy[0][0]} y={xy[0][1] - 18} textAnchor="start" style={{ font: `700 22px ${font}, sans-serif` }} fill={MID} opacity={t > 0.05 ? 1 : 0}>{rollQuantity(pts[0].q, 1)}</text>
    </svg>
  );
}

export default LineChart;
