// Proves the channel composition auto-registration works. Not a production asset.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

function Smoke({ label }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 90, fontFamily: "sans-serif", fontWeight: 800, color: "#111827", transform: `translateY(${interpolate(f, [0, 20], [60, 0], { extrapolateRight: "clamp" })}px)` }}>{label}</div>
    </AbsoluteFill>
  );
}

export const compositions = [{ id: "ChannelSmoke", component: Smoke, durationInFrames: 60, fps: 30, width: 1080, height: 1920, defaultProps: { label: "Pipeline check" } }];
