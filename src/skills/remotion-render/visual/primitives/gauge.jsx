/**
 * GAUGE — a semicircular arc filling from 0 to the sentence's percentage
 * over the first 40% of the beat, on a light-grey track; the sentence's value
 * sits under the arc from the first frame (headline font), the label in
 * caption font.
 */
import React from "react";
import { INK, LIGHT, SERIF, buildT } from "./viz-common.js";

// Fit contract: drawn inside `bounds` (arc + value + label, see r).
export function Gauge({ data, bounds: zone, local, dur, font }) {
  const pct = Math.max(0, Math.min(100, Number(data?.percent)));
  if (!Number.isFinite(pct)) return null;
  // Fit the WHOLE gauge — arc, value and the label as it wraps — inside
  // `bounds`, shrinking the radius until it does, then centre it. Run
  // 36414021961 ch-44: the label "outcomes driven by preparation" wrapped to
  // two lines and ran out of the visual zone into the headline zone (caught
  // by shapes-clear-of-text). Label width is estimated at 0.55 em per
  // character of italic serif; lines are 1.4 em.
  const label = data?.label ? String(data.label) : "";
  let r = Math.min(zone.w * 0.42, zone.h * 0.6), sw, valueSize, labelSize, total;
  for (;;) {
    sw = r * 0.16; valueSize = Math.round(r * 0.38); labelSize = Math.round(r * 0.1 + 10);
    const lines = label ? Math.max(1, Math.ceil((label.length * 0.55 * labelSize) / (r * 2))) : 0;
    total = r + sw / 2 + sw * 0.4 + valueSize + (label ? 6 + lines * labelSize * 1.4 : 0);
    if (total <= zone.h - 16 || r < 40) break;
    r *= 0.95;
  }
  const cx = zone.x + zone.w / 2, cy = zone.y + Math.max(4, (zone.h - total) / 2) + r + sw / 2;
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
        {/* The sentence's figure from the first frame; only the arc sweeps.
            A rolling label showed "26%" in a frame sampled mid-sweep while
            the voiceover said 50% (run 36405739332 ch-48 review). */}
        <div style={{ font: `700 ${valueSize}px ${font}, sans-serif`, color: INK, lineHeight: 1 }}>{pct}%</div>
        {label ? <div style={{ font: `italic 400 ${labelSize}px ${SERIF}`, color: INK, marginTop: 6, lineHeight: 1.4 }}>{label}</div> : null}
      </div>
    </div>
  );
}

export default Gauge;
