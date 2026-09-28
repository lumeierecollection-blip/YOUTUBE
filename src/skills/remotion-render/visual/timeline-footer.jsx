/**
 * Timeline device — the reference's dark rounded slab under the paper,
 * showing an editing timeline: a ruler, clip tracks in purple / violet /
 * green, an audio waveform row, and a playhead that travels left to right
 * across the WHOLE video (as in the reference; the layout itself does not
 * change between beats). In slight perspective, left end lower.
 *
 * The clip layout is deterministic from `seed` (the channel), so every
 * video on a channel shows the same edit. Purely decorative.
 */
import React from "react";
import { DEVICE, DEVICE_FILL, TIMELINE, hash32 } from "./paper-layout.js";

function rng(seed) {
  let s = hash32(seed) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
}

export function TimelineFooter({ seed = "0", progress = 0 }) {
  const { w, h } = DEVICE;
  const pad = 26, top = 60, trackH = 13, gap = 10;
  const innerW = w - pad * 2;
  const r = rng(seed);
  const colors = [TIMELINE.purple, TIMELINE.violet, TIMELINE.purple, TIMELINE.violet, TIMELINE.purple, TIMELINE.violet, TIMELINE.green, TIMELINE.green, TIMELINE.green];
  const tracks = colors.map((c, t) => {
    const clips = [];
    let x = r() * 30;
    while (x < innerW - 20) {
      const cw = 10 + r() * (t < 6 ? 44 : 22);
      if (r() > 0.28) clips.push({ x, w: Math.min(cw, innerW - x), c });
      x += cw + 4 + r() * 26;
    }
    return clips;
  });
  const waveY = top + colors.length * (trackH + gap) + 6;
  const bars = Array.from({ length: 140 }, (_, i) => 3 + Math.abs(Math.sin(i * 0.7 + r() * 3)) * 9);
  const ph = pad + Math.max(0, Math.min(1, progress)) * innerW;
  return (
    <div style={{
      position: "absolute", left: DEVICE.x, top: DEVICE.y, width: w, height: h,
      transform: "perspective(1600px) rotateX(10deg) rotateZ(-1.5deg)", transformOrigin: "center top",
      borderRadius: 34, backgroundColor: DEVICE_FILL, border: "3px solid #151515",
      boxShadow: "0 36px 60px rgba(0,0,0,0.30), 0 10px 18px rgba(0,0,0,0.20)", overflow: "hidden",
    }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        <rect x={0} y={0} width={w} height={30} fill="#1c1c1c" />
        {Array.from({ length: 7 }, (_, i) => <rect key={`tab${i}`} x={pad + i * 102} y={10} width={80} height={9} rx={2} fill="#3a3a3a" />)}
        <line x1={pad} y1={44} x2={w - pad} y2={44} stroke="#555" strokeWidth={1} />
        {Array.from({ length: 40 }, (_, i) => <line key={`tk${i}`} x1={pad + (i * innerW) / 40} y1={38} x2={pad + (i * innerW) / 40} y2={i % 5 === 0 ? 50 : 46} stroke="#666" strokeWidth={1} />)}
        {tracks.map((clips, t) => clips.map((c, k) => (
          <rect key={`c${t}-${k}`} x={pad + c.x} y={top + t * (trackH + gap)} width={c.w} height={trackH} rx={3} fill={c.c} stroke="#000" strokeOpacity={0.35} />
        )))}
        <line x1={pad} y1={waveY + 12} x2={w - pad} y2={waveY + 12} stroke={TIMELINE.wave} strokeOpacity={0.35} />
        {bars.map((bh, i) => <rect key={`w${i}`} x={pad + (i * innerW) / bars.length} y={waveY + 12 - bh} width={2} height={bh * 2} fill={TIMELINE.wave} />)}
        <line x1={ph} y1={34} x2={ph} y2={h - 16} stroke="#dfe7ff" strokeWidth={2} />
        <path d={`M${ph - 7},32 L${ph + 7},32 L${ph},42 Z`} fill="#4c8dff" />
      </svg>
    </div>
  );
}

export default TimelineFooter;
