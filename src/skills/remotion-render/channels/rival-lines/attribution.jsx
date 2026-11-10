// Reusable StatsBomb attribution: the open-data terms require crediting StatsBomb and showing their logo wherever analysis based on
// the data is shown or published. Rendered on every Rival Lines scene that uses event data, and in each video's description.
import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

export function StatsBombAttribution({ logo, dark = false, y = 1856, text = "Event data: StatsBomb Open Data" }) {
  const f = useCurrentFrame(), a = interpolate(f, [4, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 40, top: y, height: 54, display: "flex", alignItems: "center", gap: 14, padding: "0 20px 0 10px", borderRadius: 27, background: dark ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.96)", boxShadow: "0 3px 10px rgba(0,0,0,0.25)", opacity: a, zIndex: 1100, fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: 22, color: "#0B1220" }}>
      {logo ? <img src={logo} style={{ height: 38, width: "auto" }} /> : null}
      <span>{text}</span>
    </div>
  );
}
