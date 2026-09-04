import React from "react";
import { interpolate, Easing, useCurrentFrame } from "remotion";

/**
 * DataGauge — a dial that reads a value against its maximum.
 *
 * Ported from lifeprompt-team/remotion-scenes @ 02c7a84,
 * src/scenes/DataAnimations/DataGauge.tsx (MIT, © 2026 lifeprompt-team).
 * The arc geometry, tick placement, needle and sweep timing are theirs and
 * are reproduced faithfully.
 *
 * FOUR DELIBERATE DEVIATIONS from the upstream file, each because the
 * original is a standalone full-screen demo scene and this has to sit on a
 * beat's stage:
 *
 *  1. No <AbsoluteFill> and no `background`. Upstream paints the whole frame
 *     black; here the shot, ground and falloff already own the frame, so this
 *     renders only the dial.
 *  2. Colours come from the CHANNEL PALETTE, not the vendored `C` constants.
 *     Colour lives in channels.json and never in a component — CHECK-REGISTER
 *     SCR-13. Upstream's green/amber/red gradient would put three colours on
 *     screen that no channel chose.
 *  3. `lerp` and `EASE.out` are not imported. Upstream's `lerp` is Remotion's
 *     `interpolate` with both extrapolations clamped, and `EASE.out` is
 *     `Easing.bezier(0.16, 1, 0.3, 1)`; both are inlined here so this pulls in
 *     one component rather than a parallel utility layer.
 *  4. The caption under the value is the beat's own unit, not the hardcoded
 *     string "Performance Score" upstream renders. A label the script did not
 *     write must never appear on screen.
 *
 * AND ONE UPSTREAM BUG FIXED, found by rendering it rather than reading it.
 * The arc is a SEMICIRCLE — `M 50 250 A 150 150 0 1 1 350 250` around centre
 * (200,250), and the progress dash is scaled by 471 ≈ 150π, half a
 * circumference. But upstream sweeps the needle `-135 + progress * 270` and
 * places ticks over the same 270°, so needle and ticks run a full three
 * quarters of a turn across a half-turn dial. Rendered at 7%, the needle
 * pointed down-left, off the arc entirely, and the 75 and 100 ticks sat below
 * the gauge. Both now use the arc's real 180°: ticks at 180 + (t/100)*180 in
 * SVG coordinates, and the needle at -90 + progress*180, since the needle div
 * points up at rotation 0 and up is 270° in that frame.
 */
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

export function DataGauge({
  value = 0, maxValue = 100, startDelay = 0,
  color = "#FFFFFF", dim = "#888888", track = "#333333", accent = "#22C55E",
  label = "", fontFamily, size = 1,
}) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startDelay, startDelay + 50], [0, maxValue ? value / maxValue : 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT,
  });
  const angle = -90 + progress * 180; // needle: up is 0deg, arc spans 180deg
  const ticks = [0, 25, 50, 75, 100];
  return (
    <div style={{ position: "relative", transform: `scale(${size})`, transformOrigin: "center center" }}>
      <svg width={400} height={300} style={{ overflow: "visible" }} aria-hidden="true">
        <path d="M 50 250 A 150 150 0 1 1 350 250" fill="none" stroke={track} strokeWidth={20} strokeLinecap="round" />
        <path d="M 50 250 A 150 150 0 1 1 350 250" fill="none" stroke={accent} strokeWidth={20}
          strokeLinecap="round" strokeDasharray={`${progress * 471} 471`} />
        {ticks.map((tick) => {
          const rad = ((180 + (tick / 100) * 180) * Math.PI) / 180;
          return (
            <g key={`tick-${tick}`}>
              <line x1={200 + 130 * Math.cos(rad)} y1={250 + 130 * Math.sin(rad)}
                x2={200 + 160 * Math.cos(rad)} y2={250 + 160 * Math.sin(rad)} stroke={dim} strokeWidth={2} />
              <text x={200 + 180 * Math.cos(rad)} y={250 + 180 * Math.sin(rad)} textAnchor="middle"
                fill={dim} fontSize={14} fontFamily={fontFamily}>{tick}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 200, top: 250, width: 4, height: 120, background: color,
        transformOrigin: "bottom center", transform: `translateX(-50%) rotate(${angle}deg)`, borderRadius: 2 }} />
      <div style={{ position: "absolute", left: 200, top: 250, width: 20, height: 20, background: color,
        borderRadius: "50%", transform: "translate(-50%, -50%)" }} />
      <div style={{ position: "absolute", left: 200, top: 320, transform: "translateX(-50%)", textAlign: "center" }}>
        <div style={{ fontFamily, fontSize: 64, fontWeight: 800, color }}>{Math.round(progress * maxValue)}</div>
        {label ? <div style={{ fontFamily, fontSize: 18, color: dim }}>{label}</div> : null}
      </div>
    </div>
  );
}
