/**
 * GAUGE — a semicircular arc filling from 0 to the sentence's percentage
 * over the first 40% of the beat, on a light-grey track; the current value
 * types in under the arc in the headline font, the label in caption font.
 */
import React from "react";
import { INK, LIGHT, SERIF, buildT } from "./viz-common.js";

// Fit contract: drawn inside `bounds` (arc + value + label, see r).
export function Gauge({ data, bounds: zone, local, dur, font }) {
  const pct = Math.max(0, Math.min(100, Number(data?.percent)));
  if (!Number.isFinite(pct)) return null;
  const r = Math.min(zone.w * 0.42, zone.h * 0.6);
  const sw = r * 0.16;
  const cx = zone.x + zone.w / 2, cy = zone.y + zone.h * 0.62;
  const t = buildT(local, dur, 0.4);
  const a = Math.PI * (pct / 100) * t;
  const pt = (ang) => [cx - r * Math.cos(ang), cy - r * Math.sin(ang)];
  const [sx, sy] = pt(0);
  const [tx, ty] = pt(Math.PI);
  const [fx, fy] = pt(a);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={zone.x + zone.w} height={zone.y + zone.h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <path d={`M${sx},${sy} A${r},${r} 0 0 1 ${tx},${ty}`} fill="none" stroke={LIGHT} strokeWidth={sw} strokeLinecap="round" />
        {a > 0.001 ? <path d={`M${sx},${sy} A${r},${r} 0 0 1 ${fx},${fy}`} fill="none" stroke={INK} strokeWidth={sw} strokeLinecap="round" /> : null}
      </svg>
      <div style={{ position: "absolute", left: cx - r, top: cy + sw * 0.4, width: r * 2, textAlign: "center" }}>
        <div style={{ font: `700 ${Math.round(r * 0.38)}px ${font}, sans-serif`, color: INK, lineHeight: 1 }}>{Math.round(pct * t)}%</div>
        {data.label ? <div style={{ font: `italic 400 ${Math.round(r * 0.1 + 10)}px ${SERIF}`, color: INK, marginTop: 6 }}>{data.label}</div> : null}
      </div>
    </div>
  );
}

export default Gauge;
