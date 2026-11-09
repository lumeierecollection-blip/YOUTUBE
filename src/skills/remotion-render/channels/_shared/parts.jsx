// Small building blocks shared by directly scripted Shorts. Not a template: each channel supplies its own scenes.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
export const ease = Easing.out(Easing.cubic);
export const useIn = (delay = 0, len = 12) => interpolate(useCurrentFrame(), [delay, delay + len], [0, 1], { ...clamp, easing: ease });
export const abs = (x, y, w, h, extra) => ({ position: "absolute", left: x, top: y, width: w, height: h, ...extra });

export const From = ({ dx = 0, dy = 40, delay = 0, style, children }) => {
  const t = useIn(delay);
  return <div style={{ opacity: t, transform: `translate(${(1 - t) * dx}px, ${(1 - t) * dy}px)`, ...style }}>{children}</div>;
};

/** Fades a scene in and out so cuts between measured scene boundaries are never hard. */
export function Scene({ dur, children }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(f, [0, 5, dur - 4, dur], [0, 1, 1, 0], clamp) }}>{children}</AbsoluteFill>;
}

/** Word-timed captions from the measured narration, clear of the picture area. */
export function Captions({ captions, font, color, accent, top = 1600 }) {
  const f = useCurrentFrame();
  const c = captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  return (
    <div style={abs(60, top, 960, 170, { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "0 16px", fontFamily: font, fontWeight: 700, fontSize: 56, lineHeight: 1.12, textAlign: "center" })}>
      {(c.words || [{ text: c.text, from: c.from }]).map((w, i) => <span key={i} style={{ color: f >= w.from ? color : accent, opacity: f >= w.from ? 1 : 0.45 }}>{w.text}</span>)}
    </div>
  );
}
