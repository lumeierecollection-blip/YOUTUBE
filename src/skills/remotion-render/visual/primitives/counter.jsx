/**
 * COUNTER — the sentence's number counting from 0 to its value over the
 * first 40% of the beat, then holding. Headline font, bold, at least ~30%
 * of the paper's width; an optional caption-font label under it.
 */
import React from "react";
import { parseQuantity, rollQuantity } from "./quantity.js";
import { INK, SERIF, buildT } from "./viz-common.js";

// Fit contract: drawn inside `bounds` (a sub-box of the paper's inner box).
// The number is sized so its full (final) width fits, and the number plus
// the label AS IT WRAPS fit the height — the size shrinks until they do
// (run 36414021961 ch-44: a gauge's two-line label ran out of the visual
// zone; the counter's label wraps the same way). Label width is estimated
// at 0.55 em per character of italic serif; lines are 1.4 em.
export function Counter({ data, bounds: zone, local, dur, font }) {
  const q = parseQuantity(data?.value);
  if (!q) return null;
  const t = buildT(local, dur, 0.4);
  const full = rollQuantity(q, 1);
  const label = data?.label ? String(data.label) : "";
  let size = Math.round(Math.min(zone.h * 0.42, (zone.w * 0.92) / Math.max(3, full.length * 0.62)));
  let labelSize = Math.round(size * 0.22 + 10);
  for (;;) {
    labelSize = Math.round(size * 0.22 + 10);
    const lines = label ? Math.max(1, Math.ceil((label.length * 0.55 * labelSize) / zone.w)) : 0;
    const total = size + (label ? size * 0.18 + lines * labelSize * 1.4 : 0);
    if (total <= zone.h - 16 || size < 24) break;
    size = Math.floor(size * 0.95);
  }
  return (
    <div style={{ position: "absolute", left: zone.x, top: zone.y, width: zone.w, height: zone.h, display: "flex",
      flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <div style={{ font: `700 ${size}px ${font}, sans-serif`, color: INK, letterSpacing: -size * 0.035, lineHeight: 1,
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{rollQuantity(q, t)}</div>
      {label ? (
        <div style={{ marginTop: size * 0.18, font: `italic 400 ${labelSize}px ${SERIF}`, color: INK, lineHeight: 1.4,
          maxWidth: zone.w, textAlign: "center",
          opacity: buildT(local, dur, 0.2, dur * 0.3) }}>{label}</div>
      ) : null}
    </div>
  );
}

export default Counter;
