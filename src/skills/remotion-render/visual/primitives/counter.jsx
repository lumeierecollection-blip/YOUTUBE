/**
 * COUNTER — the sentence's number counting from 0 to its value over the
 * first 40% of the beat, then holding. Headline font, bold, at least ~30%
 * of the paper's width; an optional caption-font label under it.
 */
import React from "react";
import { parseQuantity, rollQuantity } from "./quantity.js";
import { INK, SERIF, buildT } from "./viz-common.js";

export function Counter({ data, zone, local, dur, font }) {
  const q = parseQuantity(data?.value);
  if (!q) return null;
  const t = buildT(local, dur, 0.4);
  const full = rollQuantity(q, 1);
  const size = Math.round(Math.min(zone.h * 0.42, (zone.w * 0.95) / Math.max(3, full.length * 0.56)));
  return (
    <div style={{ position: "absolute", left: zone.x, top: zone.y, width: zone.w, height: zone.h, display: "flex",
      flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <div style={{ font: `700 ${size}px ${font}, sans-serif`, color: INK, letterSpacing: -size * 0.035, lineHeight: 1,
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{rollQuantity(q, t)}</div>
      {data.label ? (
        <div style={{ marginTop: size * 0.18, font: `italic 400 ${Math.round(size * 0.22 + 10)}px ${SERIF}`, color: INK,
          opacity: buildT(local, dur, 0.2, dur * 0.3) }}>{data.label}</div>
      ) : null}
    </div>
  );
}

export default Counter;
