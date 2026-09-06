import React from "react";
import { registerObject } from "./registry.js";

/**
 * THE OBJECT LIBRARY — every noun any channel's `core_objects` names.
 *
 * Same contract as the originals in ./index.jsx: a box in frame pixels, the
 * channel's resolved palette, and `p` from 0 to 1 through the beat. Nothing
 * here decides where it sits or how big it is.
 *
 * THE RULE, RESTATED BECAUSE 79 OBJECTS IS ENOUGH TO FORGET IT. A gear is drawn
 * with teeth. A prison window is drawn with bars. An object whose identity
 * depends on a label next to it is not an object, and the whole rebuild exists
 * because the old renderer turned every idea into a rounded rectangle with a
 * word in it. There is not one rounded container in this file that is not
 * something real with rounded corners.
 *
 * WHICH SURFACE, WHICH COLOUR. An object that lays down its own sheet — a
 * document, a photograph, a form — marks that sheet with `ink`. An object drawn
 * straight onto the environment — a gear, a planet, a tower — marks with
 * `onGround`. Get this backwards on a dark channel and the object renders in
 * the background colour; that is CHECK-REGISTER 3.16's PLN-02/03 and it shipped
 * once already.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared drawing helpers. Each returns elements, never a whole object.
// ─────────────────────────────────────────────────────────────────────────────

/** A sheet of paper with a turned corner, the base of everything printed. */
const Sheet = ({ x, y, w, h, colors, fold = 0.1 }) => (
  <>
    <path
      d={`M${x},${y} L${x + w - h * fold},${y} L${x + w},${y + h * fold} L${x + w},${y + h} L${x},${y + h} Z`}
      fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.32}
    />
    <path d={`M${x + w - h * fold},${y} L${x + w - h * fold},${y + h * fold} L${x + w},${y + h * fold}`}
      fill="none" stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.32} />
  </>
);

/** Ruled lines of body text. `p` fills them in reading order. */
const Ruled = ({ x, y, w, rows, gap, colors, p = 1, weight = 0.5, seed = 7, color }) =>
  Array.from({ length: rows }).map((_, i) => {
    const a = Math.max(0, Math.min(1, p * rows - i));
    if (a <= 0) return null;
    const len = 0.55 + (((i + seed) * 37) % 40) / 100;
    return (
      <rect key={i} x={x} y={y + i * gap} width={w * len * a} height={Math.max(1.5, gap * 0.16)}
        fill={color || colors.ink} opacity={weight} />
    );
  });

/** A ruled grid, for forms, calendars and section drawings. */
const Grid = ({ x, y, w, h, cols, rows, colors, opacity = 0.25, color }) => (
  <g stroke={color || colors.ink} strokeWidth={1} opacity={opacity}>
    {Array.from({ length: cols + 1 }).map((_, i) => (
      <line key={`v${i}`} x1={x + (w * i) / cols} y1={y} x2={x + (w * i) / cols} y2={y + h} />
    ))}
    {Array.from({ length: rows + 1 }).map((_, i) => (
      <line key={`h${i}`} x1={x} y1={y + (h * i) / rows} x2={x + w} y2={y + (h * i) / rows} />
    ))}
  </g>
);

/** Deterministic pseudo-random in [0,1). Same seed, same frame, every render. */
const rnd = (seed) => (((seed * 2654435761) >>> 8) % 1000) / 1000;

/** A drawing pin, for anything on a board. */
const Pin = ({ cx, cy, r, colors }) => (
  <>
    <circle cx={cx} cy={cy} r={r} fill={colors.accent} opacity={0.9} />
    <circle cx={cx} cy={cy} r={r * 0.4} fill={colors.paper} opacity={0.5} />
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// PRINTED THINGS — each lays down its own sheet and marks it with ink.
// ─────────────────────────────────────────────────────────────────────────────

registerObject("archival photograph", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const m = w * 0.07;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.3} />
      {/* the image field, sunk inside a print border the way a photographic print is */}
      <rect x={x + m} y={y + m} width={w - m * 2} height={h - m * 3.2} fill={colors.ink} opacity={0.42} />
      {/* a horizon and two figures: enough that it reads as a photograph of something */}
      <line x1={x + m} y1={y + h * 0.52} x2={x + w - m} y2={y + h * 0.52} stroke={colors.paper} strokeWidth={1.5} opacity={0.35} />
      <circle cx={x + w * 0.38} cy={y + h * 0.45} r={h * 0.045} fill={colors.paper} opacity={0.5} />
      <rect x={x + w * 0.355} y={y + h * 0.49} width={w * 0.05} height={h * 0.09} fill={colors.paper} opacity={0.5} />
      <circle cx={x + w * 0.56} cy={y + h * 0.47} r={h * 0.038} fill={colors.paper} opacity={0.42} />
      <rect x={x + w * 0.538} y={y + h * 0.505} width={w * 0.045} height={h * 0.075} fill={colors.paper} opacity={0.42} />
      {/* a caption in the white margin under the print */}
      <Ruled x={x + m} y={y + h - m * 1.9} w={(w - m * 2) * 0.6} rows={1} gap={h * 0.05} colors={colors} p={p} weight={0.4} />
    </g>
  );
});

registerObject("pinned photograph", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  // Rotating the full box threw its corners past the edge; the sheet is inset
  // by the sagitta of a 3-degree turn so the tilt costs nothing outside.
  const tilt = -3;
  const m = Math.max(w, h) * 0.03;
  return (
    <g transform={`rotate(${tilt} ${x + w / 2} ${y + h / 2})`}>
      <rect x={x + m} y={y + m} width={w - m * 2} height={h - m * 2} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.3} />
      <rect x={x + w * 0.07} y={y + h * 0.07} width={w * 0.86} height={h * 0.72} fill={colors.ink} opacity={0.4} />
      <circle cx={x + w * 0.5} cy={y + h * 0.36} r={h * 0.11} fill={colors.paper} opacity={0.5} />
      <path d={`M${x + w * 0.3},${y + h * 0.79} Q${x + w * 0.5},${y + h * 0.5} ${x + w * 0.7},${y + h * 0.79} Z`}
        fill={colors.paper} opacity={0.5} />
      <Pin cx={x + w / 2} cy={y + h * 0.04} r={Math.max(3, w * 0.035)} colors={colors} />
      <Ruled x={x + w * 0.1} y={y + h * 0.87} w={w * 0.5} rows={1} gap={h * 0.06} colors={colors} p={p} weight={0.45} />
    </g>
  );
});

registerObject("period painting", ({ box, colors }) => {
  const { x, y, w, h } = box;
  const f = w * 0.055;
  return (
    <g>
      {/* the frame is what makes it a painting rather than a print */}
      <rect x={x} y={y} width={w} height={h} fill={colors.accent} opacity={0.55} />
      <rect x={x + f * 0.4} y={y + f * 0.4} width={w - f * 0.8} height={h - f * 0.8} fill="none"
        stroke={colors.paper} strokeWidth={1.5} opacity={0.4} />
      <rect x={x + f} y={y + f} width={w - f * 2} height={h - f * 2} fill={colors.ink} opacity={0.5} />
      {/* a sky, a land, a standing figure: a composition, not a texture */}
      <rect x={x + f} y={y + h * 0.58} width={w - f * 2} height={h - f - h * 0.58} fill={colors.paper} opacity={0.16} />
      <circle cx={x + w * 0.68} cy={y + h * 0.3} r={h * 0.07} fill={colors.paper} opacity={0.3} />
      <path d={`M${x + w * 0.42},${y + h * 0.58} l${w * 0.05},${-h * 0.16} l${w * 0.05},${h * 0.16} Z`}
        fill={colors.paper} opacity={0.28} />
      <rect x={x + w * 0.3} y={y + h * 0.46} width={w * 0.035} height={h * 0.12} fill={colors.paper} opacity={0.42} />
      <circle cx={x + w * 0.3175} cy={y + h * 0.44} r={h * 0.024} fill={colors.paper} opacity={0.42} />
    </g>
  );
});

registerObject("handwritten letter", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const lines = 9;
  return (
    <g>
      <Sheet x={x} y={y} w={w} h={h} colors={colors} fold={0.08} />
      {/* handwriting is a continuous wavering stroke, not a row of solid bars */}
      {Array.from({ length: lines }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * lines - i));
        if (a <= 0) return null;
        const ly = y + h * (0.16 + i * 0.082);
        const end = x + w * (0.14 + (0.62 + rnd(i + 3) * 0.2) * a);
        const d = [`M${x + w * 0.12},${ly}`];
        for (let s = 1; s <= 8; s++) {
          const px = x + w * 0.12 + ((end - x - w * 0.12) * s) / 8;
          d.push(`Q${px - w * 0.02},${ly + (s % 2 ? -h * 0.012 : h * 0.012)} ${px},${ly}`);
        }
        return <path key={i} d={d.join(" ")} fill="none" stroke={colors.ink} strokeWidth={1.6} opacity={0.5} />;
      })}
      {/* a signature, larger and looser, at the foot */}
      <path d={`M${x + w * 0.55},${y + h * 0.9} q${w * 0.06},${-h * 0.05} ${w * 0.12},0 t${w * 0.12},0`}
        fill="none" stroke={colors.ink} strokeWidth={2.2} opacity={0.6} />
    </g>
  );
});

registerObject("archival map sheet", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const rings = 4;
  return (
    <g>
      <Sheet x={x} y={y} w={w} h={h} colors={colors} fold={0.07} />
      {/* contours: nested closed curves, which is what a map sheet has on it */}
      {Array.from({ length: rings }).map((_, i) => {
        const k = 1 - i * 0.19;
        const a = Math.max(0, Math.min(1, p * rings - i));
        if (a <= 0) return null;
        return (
          <ellipse key={i} cx={x + w * 0.46} cy={y + h * 0.5} rx={w * 0.32 * k} ry={h * 0.26 * k}
            fill="none" stroke={colors.ink} strokeWidth={1.2} opacity={0.3 + i * 0.08} />
        );
      })}
      {/* a river and a graticule corner */}
      <path d={`M${x + w * 0.08},${y + h * 0.72} Q${x + w * 0.4},${y + h * 0.62} ${x + w * 0.62},${y + h * 0.8} T${x + w * 0.94},${y + h * 0.74}`}
        fill="none" stroke={colors.accent} strokeWidth={2} opacity={0.7} />
      <Grid x={x + w * 0.06} y={y + h * 0.08} w={w * 0.2} h={h * 0.16} cols={2} rows={2} colors={colors} opacity={0.18} />
    </g>
  );
});

registerObject("state map", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const d = `M${x + w * 0.14},${y + h * 0.2} L${x + w * 0.72},${y + h * 0.14} L${x + w * 0.86},${y + h * 0.42}
             L${x + w * 0.78},${y + h * 0.8} L${x + w * 0.3},${y + h * 0.86} L${x + w * 0.1},${y + h * 0.56} Z`;
  return (
    <g>
      <Sheet x={x} y={y} w={w} h={h} colors={colors} fold={0.06} />
      <path d={d} fill={colors.accent} opacity={0.22 * Math.max(0, Math.min(1, p * 1.5))} />
      <path d={d} fill="none" stroke={colors.ink} strokeWidth={2} opacity={0.6} />
      {/* a county line inside the border, so it reads as a jurisdiction not a blob */}
      <line x1={x + w * 0.44} y1={y + h * 0.16} x2={x + w * 0.4} y2={y + h * 0.85}
        stroke={colors.ink} strokeWidth={1} opacity={0.28} strokeDasharray="6 5" />
      <circle cx={x + w * 0.56} cy={y + h * 0.5} r={Math.max(3, w * 0.022)} fill={colors.accent} opacity={0.95} />
    </g>
  );
});

registerObject("balance sheet", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const rows = 8;
  return (
    <g>
      <Sheet x={x} y={y} w={w} h={h} colors={colors} fold={0.08} />
      {/* two money columns and a rule above the total: what makes it a balance sheet */}
      <Ruled x={x + w * 0.1} y={y + h * 0.2} w={w * 0.38} rows={rows} gap={h * 0.075} colors={colors} p={p} weight={0.42} />
      {Array.from({ length: rows }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * rows - i));
        if (a <= 0) return null;
        return (
          <rect key={i} x={x + w * 0.64} y={y + h * (0.2 + i * 0.075)} width={w * 0.22} height={Math.max(1.5, h * 0.012)}
            fill={i > rows - 3 ? colors.accent : colors.ink} opacity={i > rows - 3 ? 0.85 : 0.5} />
        );
      })}
      <line x1={x + w * 0.6} y1={y + h * 0.79} x2={x + w * 0.9} y2={y + h * 0.79}
        stroke={colors.ink} strokeWidth={2} opacity={0.6} />
    </g>
  );
});

registerObject("receipt", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const nw = w * 0.52, nx = x + (w - nw) / 2;
  const teeth = 9;
  return (
    <g>
      <rect x={nx} y={y} width={nw} height={h * 0.94} fill={colors.paper} stroke={colors.ink} strokeWidth={1.2} strokeOpacity={0.3} />
      {/* the torn foot is the whole tell of a till receipt */}
      <path d={`M${nx},${y + h * 0.94} ` + Array.from({ length: teeth }).map((_, i) =>
        `L${nx + (nw * (i + 0.5)) / teeth},${y + h * (i % 2 ? 0.985 : 0.955)} L${nx + (nw * (i + 1)) / teeth},${y + h * 0.94}`).join(" ")}
        fill={colors.paper} stroke={colors.ink} strokeWidth={1.2} strokeOpacity={0.3} />
      <Ruled x={nx + nw * 0.12} y={y + h * 0.16} w={nw * 0.76} rows={7} gap={h * 0.085} colors={colors} p={p} weight={0.4} seed={11} />
      <rect x={nx + nw * 0.12} y={y + h * 0.79} width={nw * 0.5} height={Math.max(2, h * 0.016)} fill={colors.accent} opacity={0.85} />
    </g>
  );
});

registerObject("court document", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const lines = 12;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.3} />
      {/* the numbered margin rule: pleading paper is line-numbered down the left */}
      <line x1={x + w * 0.13} y1={y} x2={x + w * 0.13} y2={y + h} stroke={colors.accent} strokeWidth={1.5} opacity={0.5} />
      {Array.from({ length: lines }).map((_, i) => (
        <rect key={`n${i}`} x={x + w * 0.06} y={y + h * (0.12 + i * 0.066)} width={w * 0.025} height={Math.max(1, h * 0.007)}
          fill={colors.ink} opacity={0.35} />
      ))}
      <Ruled x={x + w * 0.18} y={y + h * 0.12} w={w * 0.7} rows={lines} gap={h * 0.066} colors={colors} p={p} weight={0.44} seed={5} />
      {/* a filing stamp, angled the way a clerk's stamp lands */}
      <g transform={`rotate(-9 ${x + w * 0.72} ${y + h * 0.84})`}>
        <rect x={x + w * 0.56} y={y + h * 0.77} width={w * 0.32} height={h * 0.13} fill="none"
          stroke={colors.accent} strokeWidth={2.5} opacity={0.8} />
        <rect x={x + w * 0.6} y={y + h * 0.83} width={w * 0.24} height={Math.max(2, h * 0.014)} fill={colors.accent} opacity={0.8} />
      </g>
    </g>
  );
});

registerObject("constitutional text", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const lines = 13;
  return (
    <g>
      <Sheet x={x} y={y} w={w} h={h} colors={colors} fold={0.06} />
      {/* an oversized engrossed opening word, then dense set text */}
      <rect x={x + w * 0.12} y={y + h * 0.1} width={w * 0.3} height={h * 0.055} fill={colors.ink} opacity={0.72} />
      <Ruled x={x + w * 0.12} y={y + h * 0.2} w={w * 0.76} rows={lines} gap={h * 0.055} colors={colors} p={p} weight={0.4} seed={2} />
      {/* the operative clause, marked */}
      <rect x={x + w * 0.1} y={y + h * 0.52} width={w * 0.8} height={h * 0.05} fill={colors.accent}
        opacity={0.2 * Math.max(0, Math.min(1, p * 2))} />
    </g>
  );
});

registerObject("press headline", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.3} />
      {/* masthead rule, deck, then two columns: a newspaper page's actual anatomy */}
      <line x1={x + w * 0.06} y1={y + h * 0.11} x2={x + w * 0.94} y2={y + h * 0.11} stroke={colors.ink} strokeWidth={3} opacity={0.65} />
      <rect x={x + w * 0.06} y={y + h * 0.16} width={w * 0.88} height={h * 0.075} fill={colors.ink} opacity={0.78} />
      <rect x={x + w * 0.06} y={y + h * 0.27} width={w * 0.52} height={h * 0.035} fill={colors.accent} opacity={0.8} />
      <Ruled x={x + w * 0.06} y={y + h * 0.36} w={w * 0.4} rows={8} gap={h * 0.062} colors={colors} p={p} weight={0.38} seed={9} />
      <Ruled x={x + w * 0.54} y={y + h * 0.36} w={w * 0.4} rows={8} gap={h * 0.062} colors={colors} p={p} weight={0.38} seed={17} />
      <line x1={x + w * 0.5} y1={y + h * 0.34} x2={x + w * 0.5} y2={y + h * 0.9} stroke={colors.ink} strokeWidth={1} opacity={0.22} />
    </g>
  );
});

registerObject("blueprint sheet", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      {/* a blueprint is line-work on a saturated ground, the inverse of a document */}
      <rect x={x} y={y} width={w} height={h} fill={colors.accent} opacity={0.32} />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={colors.onGround} strokeWidth={1.5} strokeOpacity={0.5} />
      <Grid x={x} y={y} w={w} h={h} cols={8} rows={10} colors={colors} opacity={0.12} color={colors.paper} />
      {/* the drawn part, in white line, with a dimension run under it */}
      <rect x={x + w * 0.2} y={y + h * 0.26} width={w * 0.44} height={h * 0.3} fill="none" stroke={colors.paper} strokeWidth={2} opacity={0.85} />
      <circle cx={x + w * 0.72} cy={y + h * 0.41} r={h * 0.09} fill="none" stroke={colors.paper} strokeWidth={2} opacity={0.85} />
      <line x1={x + w * 0.2} y1={y + h * 0.68} x2={x + w * 0.64} y2={y + h * 0.68} stroke={colors.paper} strokeWidth={1.2} opacity={0.6} />
      {[0.2, 0.64].map((f, i) => (
        <line key={i} x1={x + w * f} y1={y + h * 0.65} x2={x + w * f} y2={y + h * 0.71} stroke={colors.paper} strokeWidth={1.2} opacity={0.6} />
      ))}
      {/* title block, bottom right, where every drawing keeps it */}
      <rect x={x + w * 0.58} y={y + h * 0.78} width={w * 0.34} height={h * 0.15} fill="none" stroke={colors.paper} strokeWidth={1.2} opacity={0.6} />
      <Ruled x={x + w * 0.61} y={y + h * 0.82} w={w * 0.26} rows={2} gap={h * 0.05} colors={colors} p={p} weight={0.5} color={colors.paper} />
    </g>
  );
});

registerObject("patient chart", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.3} />
      {/* the clipboard bar and clip, which is how a chart differs from a page */}
      <rect x={x} y={y} width={w} height={h * 0.09} fill={colors.ink} opacity={0.3} />
      <rect x={x + w * 0.4} y={y + h * 0.01} width={w * 0.2} height={h * 0.07} rx={h * 0.015} fill={colors.ink} opacity={0.5} />
      <Grid x={x + w * 0.08} y={y + h * 0.16} w={w * 0.84} h={h * 0.3} cols={6} rows={3} colors={colors} opacity={0.22} />
      {/* an observation trace across the lower half */}
      <path d={`M${x + w * 0.08},${y + h * 0.72} ` + Array.from({ length: 9 }).map((_, i) =>
        `L${x + w * (0.08 + 0.093 * (i + 1))},${y + h * (0.6 + rnd(i + 4) * 0.22)}`).join(" ")}
        fill="none" stroke={colors.accent} strokeWidth={2.4} opacity={0.9}
        strokeDasharray={600} strokeDashoffset={600 * (1 - Math.max(0, Math.min(1, p)))} />
    </g>
  );
});

registerObject("medical scan", ({ box, colors }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      {/* a scan is bright tissue on a black field, not ink on paper */}
      <rect x={x} y={y} width={w} height={h} fill="#000000" />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={colors.onGround} strokeWidth={1.5} strokeOpacity={0.4} />
      <ellipse cx={x + w / 2} cy={y + h * 0.5} rx={w * 0.34} ry={h * 0.3} fill={colors.paper} opacity={0.22} />
      <ellipse cx={x + w / 2} cy={y + h * 0.5} rx={w * 0.24} ry={h * 0.21} fill={colors.paper} opacity={0.34} />
      <ellipse cx={x + w * 0.44} cy={y + h * 0.46} rx={w * 0.07} ry={h * 0.06} fill={colors.paper} opacity={0.6} />
      {/* the finding, ringed the way a radiologist rings it */}
      <circle cx={x + w * 0.58} cy={y + h * 0.56} r={h * 0.055} fill={colors.accent} opacity={0.75} />
      <circle cx={x + w * 0.58} cy={y + h * 0.56} r={h * 0.1} fill="none" stroke={colors.accent} strokeWidth={2} opacity={0.9} />
      {/* the corner burn-in every scanner writes */}
      <rect x={x + w * 0.05} y={y + h * 0.05} width={w * 0.22} height={Math.max(2, h * 0.012)} fill={colors.paper} opacity={0.5} />
    </g>
  );
});

registerObject("enrollment form", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const fields = 5;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.3} />
      <rect x={x + w * 0.08} y={y + h * 0.08} width={w * 0.44} height={h * 0.04} fill={colors.ink} opacity={0.7} />
      {/* labelled rules with a box to tick: a form, not a list */}
      {Array.from({ length: fields }).map((_, i) => {
        const fy = y + h * (0.22 + i * 0.14);
        const a = Math.max(0, Math.min(1, p * fields - i));
        if (a <= 0) return null;
        return (
          <g key={i} opacity={a}>
            <rect x={x + w * 0.08} y={fy} width={w * 0.2} height={Math.max(1.5, h * 0.011)} fill={colors.ink} opacity={0.45} />
            <line x1={x + w * 0.32} y1={fy + h * 0.035} x2={x + w * 0.78} y2={fy + h * 0.035} stroke={colors.ink} strokeWidth={1.4} opacity={0.4} />
            <rect x={x + w * 0.84} y={fy - h * 0.005} width={w * 0.07} height={w * 0.07} fill="none" stroke={colors.ink} strokeWidth={1.6} opacity={0.45} />
            {i < 2 && <path d={`M${x + w * 0.855},${fy + w * 0.032} l${w * 0.018},${w * 0.022} l${w * 0.035},${-w * 0.045}`}
              fill="none" stroke={colors.accent} strokeWidth={2.6} opacity={0.95} />}
          </g>
        );
      })}
    </g>
  );
});

registerObject("plan comparison rows", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const rows = 6;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.3} />
      {/* two plan columns compared row by row, the shape a benefits table has */}
      {[0.42, 0.72].map((f, c) => (
        <rect key={c} x={x + w * (f - 0.11)} y={y + h * 0.08} width={w * 0.22} height={h * 0.035}
          fill={c ? colors.accent : colors.ink} opacity={c ? 0.85 : 0.6} />
      ))}
      {Array.from({ length: rows }).map((_, i) => {
        const ry = y + h * (0.2 + i * 0.12);
        const a = Math.max(0, Math.min(1, p * rows - i));
        if (a <= 0) return null;
        return (
          <g key={i} opacity={a}>
            <rect x={x + w * 0.07} y={ry} width={w * 0.2} height={Math.max(1.4, h * 0.01)} fill={colors.ink} opacity={0.45} />
            <circle cx={x + w * 0.42} cy={ry + h * 0.005} r={Math.max(2.5, w * 0.018)} fill={colors.ink} opacity={i % 2 ? 0.2 : 0.5} />
            <circle cx={x + w * 0.72} cy={ry + h * 0.005} r={Math.max(2.5, w * 0.018)} fill={colors.accent} opacity={i % 3 ? 0.9 : 0.25} />
            <line x1={x + w * 0.07} y1={ry + h * 0.06} x2={x + w * 0.93} y2={ry + h * 0.06} stroke={colors.ink} strokeWidth={1} opacity={0.14} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("output transcript", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const lines = 11;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={colors.paper} stroke={colors.ink} strokeWidth={1.4} strokeOpacity={0.28} />
      {/* monospaced output: constant leading, ragged right, a caret at the end */}
      {Array.from({ length: lines }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * lines - i));
        if (a <= 0) return null;
        const len = 0.3 + rnd(i + 21) * 0.55;
        return (
          <rect key={i} x={x + w * 0.08} y={y + h * (0.1 + i * 0.075)} width={w * len * a} height={Math.max(1.6, h * 0.018)}
            fill={colors.ink} opacity={i === 0 ? 0.75 : 0.42} />
        );
      })}
      <rect x={x + w * 0.08} y={y + h * (0.1 + lines * 0.075)} width={w * 0.02} height={Math.max(3, h * 0.028)}
        fill={colors.accent} opacity={p * 8 % 2 > 1 ? 0.2 : 0.95} />
    </g>
  );
});

registerObject("evidence exhibit", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      <Sheet x={x} y={y} w={w} h={h} colors={colors} fold={0.07} />
      <Ruled x={x + w * 0.12} y={y + h * 0.24} w={w * 0.72} rows={7} gap={h * 0.075} colors={colors} p={p} weight={0.4} seed={13} />
      {/* The exhibit tag, tied on: what makes a page an exhibit. It used to hang
          20% past the right edge of its own box, which is a bounds violation
          waiting for the first template that anchors this object near the
          margin. It now sits inside, overlapping the sheet's top corner. */}
      <line x1={x + w * 0.62} y1={y + h * 0.13} x2={x + w * 0.76} y2={y + h * 0.07}
        stroke={colors.ink} strokeWidth={1.4} opacity={0.5} />
      <path d={`M${x + w * 0.74},${y + h * 0.02} l${w * 0.24},${-h * 0.02} l0,${h * 0.11} l${-w * 0.24},${h * 0.02} Z`}
        fill={colors.paper} stroke={colors.accent} strokeWidth={2} opacity={0.95} />
      <rect x={x + w * 0.79} y={y + h * 0.055} width={w * 0.13} height={Math.max(2, h * 0.014)} fill={colors.accent} opacity={0.9} />
    </g>
  );
});

registerObject("museum artifact", ({ box, colors }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      {/* a vessel on a plinth under a case line — an artifact is a displayed thing */}
      <rect x={x + w * 0.18} y={y + h * 0.82} width={w * 0.64} height={h * 0.1} fill={colors.onGround} opacity={0.3} />
      <rect x={x + w * 0.24} y={y + h * 0.78} width={w * 0.52} height={h * 0.05} fill={colors.onGround} opacity={0.45} />
      <path d={`M${x + w * 0.38},${y + h * 0.22}
                C${x + w * 0.16},${y + h * 0.42} ${x + w * 0.2},${y + h * 0.74} ${x + w * 0.42},${y + h * 0.78}
                L${x + w * 0.58},${y + h * 0.78}
                C${x + w * 0.8},${y + h * 0.74} ${x + w * 0.84},${y + h * 0.42} ${x + w * 0.62},${y + h * 0.22} Z`}
        fill={colors.accent} opacity={0.4} stroke={colors.onGround} strokeWidth={2} strokeOpacity={0.7} />
      {/* handles and a decorative band, so it is a specific vessel */}
      <rect x={x + w * 0.36} y={y + h * 0.16} width={w * 0.28} height={h * 0.07} rx={h * 0.02}
        fill="none" stroke={colors.onGround} strokeWidth={2} strokeOpacity={0.7} />
      <line x1={x + w * 0.26} y1={y + h * 0.46} x2={x + w * 0.74} y2={y + h * 0.46}
        stroke={colors.onGround} strokeWidth={1.5} opacity={0.4} />
      <line x1={x + w * 0.27} y1={y + h * 0.54} x2={x + w * 0.73} y2={y + h * 0.54}
        stroke={colors.onGround} strokeWidth={1.5} opacity={0.4} />
    </g>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SCREENS — self-lit surfaces. Chrome is drawn with onGround, content on a
// paper-toned field, so a screen reads as a screen on a light or dark channel.
// ─────────────────────────────────────────────────────────────────────────────

registerObject("application window", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const bar = h * 0.09;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h * 0.02} fill={colors.paper} stroke={colors.onGround} strokeWidth={1.6} strokeOpacity={0.5} />
      {/* the title bar with three lights: the one thing that says "window" */}
      <path d={`M${x},${y + bar} L${x},${y + h * 0.02} Q${x},${y} ${x + h * 0.02},${y} L${x + w - h * 0.02},${y} Q${x + w},${y} ${x + w},${y + h * 0.02} L${x + w},${y + bar} Z`}
        fill={colors.ink} opacity={0.18} />
      {[0.05, 0.11, 0.17].map((f, i) => (
        <circle key={i} cx={x + w * f} cy={y + bar / 2} r={Math.max(2.5, bar * 0.22)}
          fill={i === 2 ? colors.accent : colors.ink} opacity={i === 2 ? 0.8 : 0.35} />
      ))}
      {/* a sidebar and a content pane, which is what an application looks like */}
      <line x1={x + w * 0.28} y1={y + bar} x2={x + w * 0.28} y2={y + h} stroke={colors.ink} strokeWidth={1.2} opacity={0.22} />
      <Ruled x={x + w * 0.05} y={y + h * 0.2} w={w * 0.18} rows={5} gap={h * 0.1} colors={colors} p={p} weight={0.32} seed={3} />
      <Ruled x={x + w * 0.34} y={y + h * 0.2} w={w * 0.58} rows={7} gap={h * 0.095} colors={colors} p={p} weight={0.42} seed={8} />
    </g>
  );
});

registerObject("prompt field", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const fh = h * 0.28;
  const fy = y + (h - fh) / 2;
  return (
    <g>
      {/* one input row with a caret and a send affordance — nothing else */}
      <rect x={x} y={fy} width={w} height={fh} rx={fh * 0.3} fill={colors.paper}
        stroke={colors.accent} strokeWidth={2.4} strokeOpacity={0.85} />
      <rect x={x + w * 0.05} y={fy + fh * 0.42} width={w * 0.62 * Math.max(0, Math.min(1, p * 1.6))}
        height={Math.max(2, fh * 0.1)} fill={colors.ink} opacity={0.55} />
      <rect x={x + w * 0.05 + w * 0.62 * Math.max(0, Math.min(1, p * 1.6)) + 4} y={fy + fh * 0.3}
        width={Math.max(2, w * 0.008)} height={fh * 0.36} fill={colors.accent} opacity={(p * 8) % 2 > 1 ? 0.2 : 0.95} />
      <path d={`M${x + w * 0.87},${fy + fh * 0.32} l${w * 0.06},${fh * 0.18} l${-w * 0.06},${fh * 0.18}`}
        fill="none" stroke={colors.accent} strokeWidth={3} opacity={0.9} />
    </g>
  );
});

registerObject("cursor pointer", ({ box, colors }) => {
  const { x, y, w, h } = box;
  const s = Math.min(w, h);
  return (
    <g>
      {/* the arrow, at the real proportions of a pointer, with its click ring */}
      <path d={`M${x},${y} L${x},${y + s * 0.78} L${x + s * 0.2},${y + s * 0.6}
                L${x + s * 0.33},${y + s * 0.92} L${x + s * 0.46},${y + s * 0.86}
                L${x + s * 0.33},${y + s * 0.55} L${x + s * 0.56},${y + s * 0.53} Z`}
        fill={colors.paper} stroke={colors.onGround} strokeWidth={2} strokeOpacity={0.85} />
      {/* the click ring, centred on the tip but pulled inside the box */}
      <circle cx={x + s * 0.34} cy={y + s * 0.34} r={s * 0.32} fill="none"
        stroke={colors.accent} strokeWidth={2.5} opacity={0.5} />
    </g>
  );
});

registerObject("phone showing a budgeting app", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const bw = w * 0.52, bx = x + (w - bw) / 2;
  const r = bw * 0.12;
  return (
    <g>
      <rect x={bx} y={y} width={bw} height={h} rx={r} fill={colors.onGround} opacity={0.16} />
      <rect x={bx} y={y} width={bw} height={h} rx={r} fill="none" stroke={colors.onGround} strokeWidth={2.4} strokeOpacity={0.6} />
      <rect x={bx + bw * 0.06} y={y + h * 0.05} width={bw * 0.88} height={h * 0.9} rx={r * 0.5} fill={colors.paper} />
      {/* the notch, then a balance figure and category bars: a budgeting app */}
      <rect x={bx + bw * 0.34} y={y + h * 0.055} width={bw * 0.32} height={h * 0.018} rx={h * 0.009}
        fill={colors.onGround} opacity={0.5} />
      <rect x={bx + bw * 0.14} y={y + h * 0.13} width={bw * 0.5} height={h * 0.042} fill={colors.ink} opacity={0.72} />
      {Array.from({ length: 4 }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * 4 - i));
        if (a <= 0) return null;
        return (
          <g key={i}>
            <rect x={bx + bw * 0.14} y={y + h * (0.26 + i * 0.13)} width={bw * 0.62 * (0.4 + rnd(i + 6) * 0.6) * a}
              height={h * 0.035} fill={i === 1 ? colors.accent : colors.ink} opacity={i === 1 ? 0.9 : 0.35} />
            <rect x={bx + bw * 0.14} y={y + h * (0.22 + i * 0.13)} width={bw * 0.3} height={Math.max(1.4, h * 0.008)}
              fill={colors.ink} opacity={0.3} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("police dashcam frame", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#000000" />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={colors.onGround} strokeWidth={1.5} strokeOpacity={0.4} />
      {/* road, lane markings running to a vanishing point, tail lights ahead */}
      <path d={`M${x},${y + h} L${x + w * 0.42},${y + h * 0.46} L${x + w * 0.58},${y + h * 0.46} L${x + w},${y + h} Z`}
        fill={colors.paper} opacity={0.12} />
      {[0.62, 0.76, 0.92].map((f, i) => (
        <rect key={i} x={x + w * (0.5 - 0.012 * (i + 1))} y={y + h * f} width={w * 0.024 * (i + 1)} height={h * 0.035}
          fill={colors.paper} opacity={0.45} />
      ))}
      <rect x={x + w * 0.44} y={y + h * 0.4} width={w * 0.12} height={h * 0.07} fill={colors.ink} opacity={0.8} />
      {[0.455, 0.525].map((f, i) => (
        <rect key={i} x={x + w * f} y={y + h * 0.43} width={w * 0.02} height={h * 0.018} fill={colors.accent} opacity={0.95} />
      ))}
      {/* the burnt-in timecode every dashcam writes across the bottom */}
      <rect x={x + w * 0.04} y={y + h * 0.92} width={w * 0.34 * Math.max(0.3, p)} height={Math.max(2, h * 0.016)}
        fill={colors.paper} opacity={0.6} />
    </g>
  );
});

registerObject("calendar grid", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cols = 7, rows = 5;
  const gy = y + h * 0.18;
  const gh = h - (gy - y);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={colors.paper} stroke={colors.ink} strokeWidth={1.5} strokeOpacity={0.3} />
      <rect x={x} y={y} width={w} height={h * 0.11} fill={colors.accent} opacity={0.75} />
      {Array.from({ length: cols }).map((_, i) => (
        <rect key={i} x={x + (w * (i + 0.25)) / cols} y={y + h * 0.135} width={(w * 0.5) / cols} height={Math.max(1.4, h * 0.01)}
          fill={colors.ink} opacity={0.4} />
      ))}
      <Grid x={x} y={gy} w={w} h={gh} cols={cols} rows={rows} colors={colors} opacity={0.2} />
      {/* the enrolment window, filled as a run of marked days */}
      {Array.from({ length: 9 }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * 9 - i));
        if (a <= 0) return null;
        const c = (i + 2) % cols, r = Math.floor((i + 2) / cols) + 1;
        return (
          <rect key={i} x={x + (w * c) / cols + 2} y={gy + (gh * r) / rows + 2}
            width={w / cols - 4} height={gh / rows - 4} fill={colors.accent} opacity={0.32 * a} />
        );
      })}
    </g>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MEASUREMENT — bars, traces, rules and dials. Drawn on the ground, so they
// mark with onGround and carry their value in the accent.
// ─────────────────────────────────────────────────────────────────────────────

registerObject("benchmark bar", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 5;
  return (
    <g>
      {/* a common baseline is what makes bars comparable rather than decorative */}
      <line x1={x} y1={y + h} x2={x} y2={y} stroke={colors.onGround} strokeWidth={2} opacity={0.5} />
      {Array.from({ length: n }).map((_, i) => {
        const v = 0.3 + rnd(i + 12) * 0.68;
        const bh = (h / n) * 0.62;
        const by = y + (h / n) * i + (h / n - bh) / 2;
        const a = Math.max(0, Math.min(1, p * n - i));
        if (a <= 0) return null;
        return (
          <g key={i}>
            <rect x={x} y={by} width={w * v * a} height={bh} fill={i === 1 ? colors.accent : colors.onGround}
              opacity={i === 1 ? 0.9 : 0.4} />
            <rect x={x + w * v * a + 6} y={by + bh * 0.35} width={w * 0.07} height={Math.max(2, bh * 0.22)}
              fill={colors.onGround} opacity={0.45 * a} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("latency trace", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 22;
  const pts = Array.from({ length: n }).map((_, i) =>
    [x + (w * i) / (n - 1), y + h * (0.72 - rnd(i + 31) * 0.5 - (i > 15 ? 0.18 : 0))]);
  return (
    <g>
      <line x1={x} y1={y + h} x2={x + w} y2={y + h} stroke={colors.onGround} strokeWidth={1.5} opacity={0.35} />
      {/* a spiky sampled series, drawn as it is measured */}
      <path d={pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}
        fill="none" stroke={colors.accent} strokeWidth={2.6} opacity={0.95}
        strokeDasharray={2000} strokeDashoffset={2000 * (1 - Math.max(0, Math.min(1, p)))} />
      {/* the budget line the trace is being judged against */}
      <line x1={x} y1={y + h * 0.34} x2={x + w} y2={y + h * 0.34}
        stroke={colors.onGround} strokeWidth={1.5} opacity={0.4} strokeDasharray="8 6" />
    </g>
  );
});

registerObject("vital trace", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const beats = 4;
  const seg = w / beats;
  const mid = y + h * 0.55;
  let d = `M${x},${mid}`;
  for (let i = 0; i < beats; i++) {
    const bx = x + seg * i;
    // P, QRS, T — the shape that makes this an ECG and not a zigzag
    d += ` L${bx + seg * 0.18},${mid} Q${bx + seg * 0.24},${mid - h * 0.1} ${bx + seg * 0.3},${mid}`;
    d += ` L${bx + seg * 0.38},${mid} L${bx + seg * 0.44},${mid + h * 0.14} L${bx + seg * 0.52},${mid - h * 0.42}`;
    d += ` L${bx + seg * 0.6},${mid + h * 0.08} L${bx + seg * 0.68},${mid}`;
    d += ` Q${bx + seg * 0.8},${mid - h * 0.16} ${bx + seg * 0.92},${mid} L${bx + seg},${mid}`;
  }
  return (
    <g>
      <path d={d} fill="none" stroke={colors.accent} strokeWidth={3} opacity={0.95} strokeLinejoin="round"
        strokeDasharray={4000} strokeDashoffset={4000 * (1 - Math.max(0, Math.min(1, p)))} />
      <line x1={x} y1={mid} x2={x + w} y2={mid} stroke={colors.onGround} strokeWidth={1} opacity={0.2} />
    </g>
  );
});

registerObject("share price line", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 16;
  const pts = Array.from({ length: n }).map((_, i) => {
    const t = i / (n - 1);
    // rises, tops out, then falls away — the shape of the channel's whole subject
    const v = t < 0.45 ? 0.35 + t * 0.9 : 0.76 - (t - 0.45) * 1.25;
    return [x + w * t, y + h * (1 - Math.max(0.04, v)) + rnd(i + 41) * h * 0.05];
  });
  const drawn = Math.max(2, Math.round(n * Math.max(0, Math.min(1, p))));
  return (
    <g>
      <line x1={x} y1={y + h} x2={x + w} y2={y + h} stroke={colors.onGround} strokeWidth={1.5} opacity={0.35} />
      <path d={pts.slice(0, drawn).map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}
        fill="none" stroke={colors.accent} strokeWidth={3} opacity={0.95} />
      <circle cx={pts[drawn - 1][0]} cy={pts[drawn - 1][1]} r={Math.max(3, w * 0.012)} fill={colors.accent} />
      {/* the peak, marked, because the fall is only meaningful against it */}
      <line x1={x} y1={pts[7][1]} x2={x + w} y2={pts[7][1]} stroke={colors.onGround} strokeWidth={1} opacity={0.3} strokeDasharray="6 6" />
    </g>
  );
});

registerObject("load curve", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const d = `M${x},${y + h} Q${x + w * 0.42},${y + h * 0.95} ${x + w * 0.66},${y + h * 0.5} T${x + w},${y + h * 0.06}`;
  return (
    <g>
      <line x1={x} y1={y + h} x2={x + w} y2={y + h} stroke={colors.onGround} strokeWidth={1.8} opacity={0.5} />
      <line x1={x} y1={y + h} x2={x} y2={y} stroke={colors.onGround} strokeWidth={1.8} opacity={0.5} />
      <path d={d} fill="none" stroke={colors.accent} strokeWidth={3} opacity={0.95}
        strokeDasharray={2400} strokeDashoffset={2400 * (1 - Math.max(0, Math.min(1, p)))} />
      {/* the yield point, where a load curve stops being a line */}
      <circle cx={x + w * 0.66} cy={y + h * 0.5} r={Math.max(4, w * 0.018)} fill="none"
        stroke={colors.onGround} strokeWidth={2.2} opacity={0.75} />
    </g>
  );
});

registerObject("progress arc", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  // 0.42 left no room for the graduation ticks outside the ring.
  const r = Math.min(w, h) * 0.38;
  const cx = x + w / 2, cy = y + h / 2;
  const frac = Math.max(0.02, Math.min(1, p)) * 0.78;
  const a0 = -Math.PI * 0.5;
  const a1 = a0 + Math.PI * 2 * frac;
  const large = frac > 0.5 ? 1 : 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.onGround} strokeWidth={r * 0.16} opacity={0.2} />
      <path d={`M${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}`}
        fill="none" stroke={colors.accent} strokeWidth={r * 0.16} strokeLinecap="round" opacity={0.95} />
      {/* tick marks at the quarters, so the arc is a measure and not a swoosh */}
      {[0, 1, 2, 3].map((i) => {
        const a = a0 + (Math.PI / 2) * i;
        return (
          <line key={i} x1={cx + Math.cos(a) * r * 1.16} y1={cy + Math.sin(a) * r * 1.16}
            x2={cx + Math.cos(a) * r * 1.16} y2={cy + Math.sin(a) * r * 1.16}
            stroke={colors.onGround} strokeWidth={2} opacity={0.4} />
        );
      })}
    </g>
  );
});

registerObject("gauge dial", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const r = Math.min(w, h * 1.6) * 0.44;
  const cx = x + w / 2, cy = y + h * 0.72;
  const a = Math.PI * (1 - Math.max(0.05, Math.min(0.95, 0.15 + p * 0.7)));
  return (
    <g>
      <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none"
        stroke={colors.onGround} strokeWidth={r * 0.1} opacity={0.35} />
      {/* a red band at the top of the range, and graduations */}
      <path d={`M${cx + r * Math.cos(Math.PI * 0.22)},${cy + r * Math.sin(Math.PI * 0.22) * -1} A${r},${r} 0 0 1 ${cx + r},${cy}`}
        fill="none" stroke={colors.accent} strokeWidth={r * 0.1} opacity={0.8} />
      {Array.from({ length: 9 }).map((_, i) => {
        const t = Math.PI * (1 - i / 8);
        return (
          <line key={i} x1={cx + Math.cos(t) * r * 0.82} y1={cy + Math.sin(t) * -r * 0.82}
            x2={cx + Math.cos(t) * r * 0.94} y2={cy + Math.sin(t) * -r * 0.94}
            stroke={colors.onGround} strokeWidth={2} opacity={0.45} />
        );
      })}
      <line x1={cx} y1={cy} x2={cx + Math.cos(a) * r * 0.78} y2={cy - Math.sin(a) * r * 0.78}
        stroke={colors.accent} strokeWidth={r * 0.09} strokeLinecap="round" opacity={0.98} />
      <circle cx={cx} cy={cy} r={r * 0.1} fill={colors.onGround} opacity={0.7} />
    </g>
  );
});

registerObject("scale bar", ({ box, colors }) => {
  const { x, y, w, h } = box;
  const n = 6;
  const bh = Math.max(6, h * 0.14);
  const by = y + h * 0.5 - bh / 2;
  return (
    <g>
      {/* alternating blocks with end ticks: a cartographer's scale bar */}
      {Array.from({ length: n }).map((_, i) => (
        <rect key={i} x={x + (w * i) / n} y={by} width={w / n} height={bh}
          fill={i % 2 ? colors.accent : colors.onGround} opacity={i % 2 ? 0.85 : 0.55} />
      ))}
      <rect x={x} y={by} width={w} height={bh} fill="none" stroke={colors.onGround} strokeWidth={1.6} opacity={0.7} />
      {[0, 0.5, 1].map((f, i) => (
        <line key={i} x1={x + w * f} y1={by - h * 0.12} x2={x + w * f} y2={by + bh + h * 0.12}
          stroke={colors.onGround} strokeWidth={1.8} opacity={0.6} />
      ))}
    </g>
  );
});

registerObject("timeline rule", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 6;
  const ay = y + h * 0.55;
  return (
    <g>
      <line x1={x} y1={ay} x2={x + w} y2={ay} stroke={colors.onGround} strokeWidth={2.4} opacity={0.6} />
      {Array.from({ length: n }).map((_, i) => {
        const tx = x + (w * (i + 0.5)) / n;
        const a = Math.max(0, Math.min(1, p * n - i));
        if (a <= 0) return null;
        const up = i % 2 === 0;
        return (
          <g key={i} opacity={a}>
            <line x1={tx} y1={ay} x2={tx} y2={ay + (up ? -h * 0.26 : h * 0.26)}
              stroke={colors.onGround} strokeWidth={1.8} opacity={0.55} />
            <circle cx={tx} cy={ay} r={Math.max(3, w * 0.011)} fill={i === n - 1 ? colors.accent : colors.onGround}
              opacity={i === n - 1 ? 0.95 : 0.7} />
            <rect x={tx - w * 0.055} y={ay + (up ? -h * 0.34 : h * 0.29)} width={w * 0.11} height={Math.max(2, h * 0.022)}
              fill={colors.onGround} opacity={0.45} />
          </g>
        );
      })}
      {/* an arrowhead, so the axis has a direction */}
      <path d={`M${x + w},${ay} l${-w * 0.028},${-h * 0.05} l0,${h * 0.1} Z`} fill={colors.onGround} opacity={0.6} />
    </g>
  );
});

registerObject("checklist rule", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 5;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const ry = y + (h * (i + 0.5)) / n;
        const a = Math.max(0, Math.min(1, p * n - i));
        if (a <= 0) return null;
        const s = Math.max(8, h * 0.1);
        return (
          <g key={i} opacity={a}>
            <rect x={x} y={ry - s / 2} width={s} height={s} fill="none" stroke={colors.onGround} strokeWidth={2} opacity={0.55} />
            {i < n - 1 && (
              <path d={`M${x + s * 0.2},${ry} l${s * 0.24},${s * 0.26} l${s * 0.55},${-s * 0.6}`}
                fill="none" stroke={colors.accent} strokeWidth={3} opacity={0.95} strokeLinecap="round" />
            )}
            <rect x={x + s * 1.5} y={ry - Math.max(1.5, h * 0.012)} width={(w - s * 1.5) * (0.5 + rnd(i + 19) * 0.45)}
              height={Math.max(3, h * 0.024)} fill={colors.onGround} opacity={0.4} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("benefit rule", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const ay = y + h * 0.5;
  const n = 4;
  return (
    <g>
      {/* a coverage line with the covered span filled and the gap left open */}
      <line x1={x} y1={ay} x2={x + w} y2={ay} stroke={colors.onGround} strokeWidth={Math.max(5, h * 0.09)} opacity={0.22} />
      <line x1={x} y1={ay} x2={x + w * 0.62 * Math.max(0.1, Math.min(1, p * 1.3))} y2={ay}
        stroke={colors.accent} strokeWidth={Math.max(5, h * 0.09)} opacity={0.9} />
      {Array.from({ length: n }).map((_, i) => {
        const tx = x + (w * (i + 0.5)) / n;
        return (
          <g key={i}>
            <line x1={tx} y1={ay - h * 0.14} x2={tx} y2={ay + h * 0.14} stroke={colors.onGround} strokeWidth={2} opacity={0.5} />
            <rect x={tx - w * 0.05} y={ay + h * 0.2} width={w * 0.1} height={Math.max(2, h * 0.03)} fill={colors.onGround} opacity={0.4} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("question line", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const ay = y + h * 0.5;
  // Round caps extend half a stroke width past each endpoint, so the line starts
  // and ends inset by exactly that.
  const cap = Math.max(4, h * 0.07) / 2;
  const len = w * 0.74 * Math.max(0.15, Math.min(1, p * 1.4));
  return (
    <g>
      {/* a line of speech that ends in a rising terminal, drawn not lettered */}
      <line x1={x + cap} y1={ay} x2={x + cap + len} y2={ay} stroke={colors.onGround} strokeWidth={Math.max(4, h * 0.07)}
        opacity={0.55} strokeLinecap="round" />
      <path d={`M${x + cap + len},${ay} q${w * 0.08},0 ${w * 0.08},${-h * 0.16}`}
        fill="none" stroke={colors.accent} strokeWidth={Math.max(4, h * 0.07)} opacity={0.95} strokeLinecap="round" />
      <circle cx={Math.min(x + w * 0.9, x + w - Math.max(3, h * 0.045) - 2)} cy={ay - h * 0.3}
        r={Math.max(3, h * 0.045)} fill={colors.accent} opacity={0.95} />
      <line x1={x + cap} y1={ay + h * 0.22} x2={x + cap + len * 0.6} y2={ay + h * 0.22}
        stroke={colors.onGround} strokeWidth={Math.max(3, h * 0.045)} opacity={0.28} strokeLinecap="round" />
    </g>
  );
});

registerObject("answer frame", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const t = Math.max(3, w * 0.02);
  const arm = w * 0.22;
  const a = Math.max(0, Math.min(1, p * 1.5));
  return (
    <g opacity={0.4 + 0.6 * a}>
      {/* two brackets holding an answer, with the content ruled between them */}
      {[[x, 1], [x + w, -1]].map(([bx, dir], i) => (
        <g key={i} stroke={colors.accent} strokeWidth={t} fill="none" opacity={0.9} strokeLinecap="square">
          <line x1={bx} y1={y} x2={bx + arm * dir} y2={y} />
          <line x1={bx} y1={y} x2={bx} y2={y + h} />
          <line x1={bx} y1={y + h} x2={bx + arm * dir} y2={y + h} />
        </g>
      ))}
      <Ruled x={x + arm * 1.3} y={y + h * 0.3} w={w - arm * 2.6} rows={3} gap={h * 0.18} colors={colors}
        p={p} weight={0.45} seed={23} color={colors.onGround} />
    </g>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS AND NETWORKS — space, connection, sequence. All ground-drawn.
// ─────────────────────────────────────────────────────────────────────────────

registerObject("planet sphere", ({ box, colors, p, uid }) => {
  const { x, y, w, h } = box;
  const r = Math.min(w, h) * 0.42;
  const cx = x + w / 2, cy = y + h / 2;
  return (
    <g>
      <defs>
        <clipPath id={`pl${uid}`}><circle cx={cx} cy={cy} r={r} /></clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={colors.accent} opacity={0.55} />
      <g clipPath={`url(#pl${uid})`}>
        {/* latitude banding, then the terminator: a lit sphere, not a disc */}
        {[0.28, 0.5, 0.72].map((f, i) => (
          <ellipse key={i} cx={cx} cy={cy - r + r * 2 * f} rx={r * (0.99 - Math.abs(f - 0.5))} ry={r * 0.1}
            fill={colors.onGround} opacity={0.12 + i * 0.04} />
        ))}
        <circle cx={cx + r * 0.55} cy={cy - r * 0.2} r={r * 1.18} fill="#000000" opacity={0.5} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.onGround} strokeWidth={1.6} opacity={0.5} />
      {/* a moon on its own short arc */}
      {/* the moon rides just inside the box rather than 1.5 radii out */}
      <circle cx={Math.min(cx + r * 1.5, x + w - r * 0.16)} cy={Math.max(cy - r * 0.75, y + r * 0.16)}
        r={r * 0.14} fill={colors.onGround} opacity={0.55 * Math.max(0.3, p)} />
    </g>
  );
});

registerObject("orbit path", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cx = x + w / 2, cy = y + h / 2;
  const rx = w * 0.46, ry = h * 0.24;
  const a = Math.PI * 2 * Math.max(0, Math.min(1, p));
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={colors.onGround} strokeWidth={1.6}
        opacity={0.45} strokeDasharray="10 8" />
      <circle cx={cx} cy={cy} r={Math.min(w, h) * 0.09} fill={colors.accent} opacity={0.85} />
      {/* the body, actually somewhere on the ellipse for this frame */}
      <circle cx={cx + Math.cos(a) * rx} cy={cy + Math.sin(a) * ry} r={Math.min(w, h) * 0.045}
        fill={colors.onGround} opacity={0.9} />
      {/* the swept arc behind it, so the direction of travel is legible */}
      <path d={`M${cx + rx},${cy} A${rx},${ry} 0 ${a > Math.PI ? 1 : 0} 1 ${cx + Math.cos(a) * rx},${cy + Math.sin(a) * ry}`}
        fill="none" stroke={colors.accent} strokeWidth={2.4} opacity={0.8} />
    </g>
  );
});

registerObject("star field", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 60;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const sx = x + rnd(i * 3 + 1) * w;
        const sy = y + rnd(i * 5 + 2) * h;
        const r = 0.8 + rnd(i * 7 + 3) * 2.4;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(p * 6 + i));
        return <circle key={i} cx={sx} cy={sy} r={r} fill={colors.onGround} opacity={0.25 + tw * 0.5} />;
      })}
      {/* three brighter stars with cross flare, so the field has structure */}
      {[[0.24, 0.3], [0.7, 0.22], [0.55, 0.74]].map(([fx, fy], i) => {
        const sx = x + w * fx, sy = y + h * fy, r = Math.min(w, h) * 0.018;
        return (
          <g key={i} opacity={0.9}>
            <circle cx={sx} cy={sy} r={r} fill={colors.accent} />
            <line x1={sx - r * 4} y1={sy} x2={sx + r * 4} y2={sy} stroke={colors.accent} strokeWidth={1.4} opacity={0.6} />
            <line x1={sx} y1={sy - r * 4} x2={sx} y2={sy + r * 4} stroke={colors.accent} strokeWidth={1.4} opacity={0.6} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("galaxy spiral", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cx = x + w / 2, cy = y + h / 2;
  const R = Math.min(w, h) * 0.46;
  const arms = 2;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={R * 0.26} ry={R * 0.2} fill={colors.accent} opacity={0.6} />
      {Array.from({ length: arms }).map((_, a) => {
        const pts = Array.from({ length: 34 }).map((_, i) => {
          const t = i / 33;
          const th = a * Math.PI + t * Math.PI * 1.9;
          const r = R * (0.22 + t * 0.78);
          return [cx + Math.cos(th) * r, cy + Math.sin(th) * r * 0.62];
        });
        return (
          <path key={a} d={pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}
            fill="none" stroke={colors.onGround} strokeWidth={Math.max(3, R * 0.09)} strokeLinecap="round"
            opacity={0.34} />
        );
      })}
      {/* star knots along the arms, arriving as the beat runs */}
      {Array.from({ length: 16 }).map((_, i) => {
        const t = i / 15, th = (i % 2) * Math.PI + t * Math.PI * 1.9, r = R * (0.28 + t * 0.7);
        const a = Math.max(0, Math.min(1, p * 16 - i));
        if (a <= 0) return null;
        return <circle key={i} cx={cx + Math.cos(th) * r} cy={cy + Math.sin(th) * r * 0.62}
          r={Math.max(1.5, R * 0.022)} fill={colors.onGround} opacity={0.75 * a} />;
      })}
    </g>
  );
});

registerObject("concept node", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const r = Math.min(w, h) * 0.3;
  const cx = x + w / 2, cy = y + h / 2;
  const a = Math.max(0, Math.min(1, p * 1.4));
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={colors.accent} opacity={0.32} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.accent} strokeWidth={3} opacity={0.9} />
      {/* the ring that says this node has been reached */}
      <circle cx={cx} cy={cy} r={r * (1.2 + a * 0.25)} fill="none" stroke={colors.onGround}
        strokeWidth={1.8} opacity={0.4 * (1 - a * 0.6)} />
      {/* three stubs, so it reads as a node in something rather than a dot */}
      {[0.3, 2.4, 4.2].map((th, i) => (
        <line key={i} x1={cx + Math.cos(th) * r} y1={cy + Math.sin(th) * r}
          x2={cx + Math.cos(th) * r * 1.55} y2={cy + Math.sin(th) * r * 1.55}
          stroke={colors.onGround} strokeWidth={2.2} opacity={0.45} />
      ))}
    </g>
  );
});

registerObject("link path", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const r = Math.max(4, w * 0.03);
  // Inset by the node radius at both ends: the discs used to be centred on the
  // box edge, which put half of each one outside.
  const d = `M${x + r},${y + h * 0.72} C${x + w * 0.3},${y + h * 0.1} ${x + w * 0.66},${y + h * 0.92} ${x + w - r},${y + h * 0.24}`;
  return (
    <g>
      <path d={d} fill="none" stroke={colors.onGround} strokeWidth={2} opacity={0.28} />
      <path d={d} fill="none" stroke={colors.accent} strokeWidth={3.2} opacity={0.95}
        strokeDasharray={2200} strokeDashoffset={2200 * (1 - Math.max(0, Math.min(1, p)))} />
      {[[x + r, y + h * 0.72], [x + w - r, y + h * 0.24]].map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={r} fill={colors.onGround} opacity={0.8} />
      ))}
    </g>
  );
});

registerObject("wire node", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cx = x + w / 2, cy = y + h / 2;
  const R = Math.min(w, h) * 0.44;
  const spokes = 6;
  return (
    <g>
      {Array.from({ length: spokes }).map((_, i) => {
        const th = (i / spokes) * Math.PI * 2 + 0.3;
        const a = Math.max(0, Math.min(1, p * spokes - i));
        if (a <= 0) return null;
        const ex = cx + Math.cos(th) * R, ey = cy + Math.sin(th) * R;
        return (
          <g key={i} opacity={a}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={colors.onGround} strokeWidth={1.8} opacity={0.45} />
            <circle cx={ex} cy={ey} r={Math.max(3, R * 0.12)} fill={colors.onGround} opacity={0.6} />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={R * 0.22} fill={colors.accent} opacity={0.9} />
    </g>
  );
});

registerObject("money trail", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const stops = 5;
  const r = Math.max(5, Math.min(w, h) * 0.055);
  // Inset by the coin radius and the stack height so the end stops stay in.
  const at = (i) => [x + r + ((w - r * 2) * i) / (stops - 1), y + h * (0.5 + Math.sin(i * 1.6) * 0.24)];
  return (
    <g>
      {Array.from({ length: stops - 1 }).map((_, i) => {
        const [ax, ay] = at(i), [bx, by] = at(i + 1);
        const a = Math.max(0, Math.min(1, p * (stops - 1) - i));
        if (a <= 0) return null;
        return (
          <line key={i} x1={ax} y1={ay} x2={ax + (bx - ax) * a} y2={ay + (by - ay) * a}
            stroke={colors.accent} strokeWidth={2.6} opacity={0.85} strokeDasharray="7 6" />
        );
      })}
      {Array.from({ length: stops }).map((_, i) => {
        const [cx, cy] = at(i);
        const a = Math.max(0, Math.min(1, p * stops - i));
        if (a <= 0) return null;
        return (
          <g key={i} opacity={a}>
            {/* each stop is a stack of coins seen edge-on, not a bullet point */}
            {[0, 1, 2].map((k) => (
              <ellipse key={k} cx={cx} cy={cy - k * r * 0.34} rx={r} ry={r * 0.4}
                fill={k === 2 ? colors.accent : colors.onGround} opacity={k === 2 ? 0.9 : 0.5} />
            ))}
          </g>
        );
      })}
    </g>
  );
});

registerObject("red string", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const pins = [[0.08, 0.2], [0.52, 0.08], [0.9, 0.44], [0.32, 0.78], [0.74, 0.9]];
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 3]];
  const at = (i) => [x + w * pins[i][0], y + h * pins[i][1]];
  return (
    <g>
      {links.map(([a, b], i) => {
        const [ax, ay] = at(a), [bx, by] = at(b);
        const t = Math.max(0, Math.min(1, p * links.length - i));
        if (t <= 0) return null;
        // a string between two pins sags; a straight line between them does not
        const mx = (ax + bx) / 2, my = (ay + by) / 2 + h * 0.06;
        return (
          <path key={i} d={`M${ax},${ay} Q${mx},${my} ${ax + (bx - ax) * t},${ay + (by - ay) * t}`}
            fill="none" stroke={colors.accent} strokeWidth={2} opacity={0.85} />
        );
      })}
      {pins.map((_, i) => {
        const [cx, cy] = at(i);
        return <Pin key={i} cx={cx} cy={cy} r={Math.max(3.5, Math.min(w, h) * 0.028)} colors={colors} />;
      })}
    </g>
  );
});

registerObject("dna helix", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const rungs = 14;
  const amp = w * 0.3, cx = x + w / 2;
  const strand = (phase) => Array.from({ length: 40 }).map((_, i) => {
    const t = i / 39;
    return [cx + Math.sin(t * Math.PI * 3 + phase) * amp, y + h * t];
  });
  const path = (pts) => pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
  return (
    <g>
      {/* base pairs first: without rungs two sine waves are not a helix */}
      {Array.from({ length: rungs }).map((_, i) => {
        const t = (i + 0.5) / rungs;
        const a = Math.max(0, Math.min(1, p * rungs - i));
        if (a <= 0) return null;
        const x1 = cx + Math.sin(t * Math.PI * 3) * amp;
        const x2 = cx + Math.sin(t * Math.PI * 3 + Math.PI) * amp;
        return (
          <line key={i} x1={x1} y1={y + h * t} x2={x2} y2={y + h * t}
            stroke={i % 3 === 0 ? colors.accent : colors.onGround} strokeWidth={2.4}
            opacity={(i % 3 === 0 ? 0.9 : 0.4) * a} />
        );
      })}
      <path d={path(strand(0))} fill="none" stroke={colors.onGround} strokeWidth={3.4} opacity={0.75} />
      <path d={path(strand(Math.PI))} fill="none" stroke={colors.onGround} strokeWidth={3.4} opacity={0.5} />
    </g>
  );
});

registerObject("family tree", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const r = Math.max(5, Math.min(w, h) * 0.05);
  const rows = [[0.5], [0.28, 0.72], [0.14, 0.4, 0.62, 0.88]];
  const ys = [0.14, 0.5, 0.86];
  return (
    <g>
      {rows.slice(0, 2).map((row, ri) =>
        row.map((fx, i) => {
          const kids = rows[ri + 1];
          const span = kids.slice(i * (kids.length / row.length), (i + 1) * (kids.length / row.length));
          return span.map((kx, k) => {
            const a = Math.max(0, Math.min(1, p * 3 - ri));
            if (a <= 0) return null;
            return (
              <path key={`${ri}-${i}-${k}`}
                d={`M${x + w * fx},${y + h * ys[ri] + r} L${x + w * fx},${y + h * (ys[ri] + ys[ri + 1]) / 2} L${x + w * kx},${y + h * (ys[ri] + ys[ri + 1]) / 2} L${x + w * kx},${y + h * ys[ri + 1] - r}`}
                fill="none" stroke={colors.onGround} strokeWidth={1.8} opacity={0.45 * a} />
            );
          });
        })
      )}
      {rows.map((row, ri) =>
        row.map((fx, i) => {
          const a = Math.max(0, Math.min(1, p * 3 - ri));
          if (a <= 0) return null;
          // the matched relative is the one the whole method turns on
          const matched = ri === 2 && i === 2;
          return (
            <circle key={`n${ri}-${i}`} cx={x + w * fx} cy={y + h * ys[ri]} r={r}
              fill={matched ? colors.accent : colors.onGround} opacity={(matched ? 0.95 : 0.6) * a} />
          );
        })
      )}
    </g>
  );
});

registerObject("stacked layer", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 4;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * n - i));
        if (a <= 0) return null;
        const k = 1 - i * 0.13;
        const lw = w * k, lh = h * 0.17;
        const ly = y + h - lh * (i + 1) * 1.12;
        // an isometric slab: a top face and a front face, so it stacks visibly
        return (
          <g key={i} opacity={a}>
            <path d={`M${x + (w - lw) / 2},${ly + lh * 0.35} l${lw * 0.5},${-lh * 0.35} l${lw * 0.5},${lh * 0.35} l${-lw * 0.5},${lh * 0.35} Z`}
              fill={i === n - 1 ? colors.accent : colors.onGround} opacity={i === n - 1 ? 0.75 : 0.34} />
            <path d={`M${x + (w - lw) / 2},${ly + lh * 0.35} l${lw * 0.5},${lh * 0.35} l0,${lh * 0.5} l${-lw * 0.5},${-lh * 0.35} Z`}
              fill={colors.onGround} opacity={0.2} />
            <path d={`M${x + (w + lw) / 2},${ly + lh * 0.35} l${-lw * 0.5},${lh * 0.35} l0,${lh * 0.5} l${lw * 0.5},${-lh * 0.35} Z`}
              fill={colors.onGround} opacity={0.12} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("stepped platform", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 4;
  const sw = w / n;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * n - i));
        if (a <= 0) return null;
        const sh = (h * (i + 1)) / n;
        return (
          <g key={i} opacity={a}>
            <rect x={x + sw * i} y={y + h - sh} width={sw} height={sh}
              fill={i === n - 1 ? colors.accent : colors.onGround} opacity={i === n - 1 ? 0.7 : 0.3} />
            <line x1={x + sw * i} y1={y + h - sh} x2={x + sw * (i + 1)} y2={y + h - sh}
              stroke={colors.onGround} strokeWidth={2} opacity={0.6} />
          </g>
        );
      })}
      {/* a figure at the top step, giving the climb a subject */}
      {/* the figure stands ON the top step, not above the box */}
      <circle cx={x + sw * (n - 0.5)} cy={y + Math.max(4, w * 0.03) + 2} r={Math.max(4, w * 0.03)}
        fill={colors.onGround} opacity={0.75} />
    </g>
  );
});

registerObject("process arrow", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 3;
  const cw = w / n;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * n - i));
        if (a <= 0) return null;
        const bx = x + cw * i;
        const notch = cw * 0.18;
        // a chevron that slots into the next one: a process, not three arrows
        return (
          <path key={i}
            d={`M${bx},${y} L${bx + cw - notch},${y} L${bx + cw},${y + h / 2} L${bx + cw - notch},${y + h}
                L${bx},${y + h} L${bx + notch},${y + h / 2} Z`}
            fill={i === n - 1 ? colors.accent : colors.onGround} opacity={(i === n - 1 ? 0.85 : 0.34) * a} />
        );
      })}
    </g>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MACHINERY AND EQUIPMENT — ground-drawn, marked with onGround.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One gear: a rim with square-cut teeth, a hub, and spokes between them.
 *
 * The first version drew each tooth as four points between the root and tip
 * radii and rendered as a soft lump — at 300px the teeth read as a wavy outline
 * and four accumulated copies merged into a cloud. Teeth on a real gear are
 * flat-topped and roughly as wide as the gap beside them, and the space between
 * hub and rim is open. Both of those are what make the silhouette legible.
 */
const Gear = ({ cx, cy, r, teeth, rot, colors, fill, opacity }) => {
  const tw = (Math.PI * 2) / teeth;
  const R = r * 1.22;
  const d = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = i * tw + rot;
    const a1 = a0 + tw * 0.5;   // tooth flank
    const a2 = a0 + tw * 0.5;   // flat top runs a1..a2 after the radius change
    const a3 = a0 + tw;
    d.push(`${i ? "L" : "M"}${cx + Math.cos(a0) * r},${cy + Math.sin(a0) * r}`);
    d.push(`L${cx + Math.cos(a0) * R},${cy + Math.sin(a0) * R}`);
    d.push(`L${cx + Math.cos(a1) * R},${cy + Math.sin(a1) * R}`);
    d.push(`L${cx + Math.cos(a2) * r},${cy + Math.sin(a2) * r}`);
    d.push(`L${cx + Math.cos(a3) * r},${cy + Math.sin(a3) * r}`);
  }
  const hub = r * 0.26;
  return (
    <g>
      <path d={d.join(" ") + " Z"} fill={fill} opacity={opacity} fillRule="evenodd" />
      {/* the bore, punched out of the body */}
      <circle cx={cx} cy={cy} r={r * 0.58} fill={colors.ground} opacity={0.92} />
      <circle cx={cx} cy={cy} r={r * 0.58} fill="none" stroke={colors.onGround} strokeWidth={2} opacity={0.5} />
      {/* four spokes and a hub, so the open centre is structural not a hole */}
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + rot;
        return (
          <line key={k} x1={cx + Math.cos(a) * hub} y1={cy + Math.sin(a) * hub}
            x2={cx + Math.cos(a) * r * 0.58} y2={cy + Math.sin(a) * r * 0.58}
            stroke={fill} strokeWidth={r * 0.16} opacity={opacity} />
        );
      })}
      <circle cx={cx} cy={cy} r={hub} fill={fill} opacity={opacity} />
      <circle cx={cx} cy={cy} r={hub * 0.45} fill={colors.ground} opacity={0.9} />
    </g>
  );
};

registerObject("gear train", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const r1 = Math.min(w, h) * 0.26, r2 = r1 * 0.62, r3 = r1 * 0.44;
  const rot = p * Math.PI * 0.9;
  return (
    <g>
      {/* Positions pulled in so the third gear's TIP radius (1.22r) still lands
          inside the box; the train used to reach 1.05x the width. */}
      <Gear cx={x + w * 0.3} cy={y + h * 0.46} r={r1} teeth={12} rot={rot} colors={colors} fill={colors.onGround} opacity={0.45} />
      {/* meshed gears turn in opposite directions and their teeth interleave */}
      <Gear cx={x + w * 0.3 + r1 * 1.42} cy={y + h * 0.46 + r1 * 0.72} r={r2} teeth={8} rot={-rot * (r1 / r2)}
        colors={colors} fill={colors.accent} opacity={0.75} />
      <Gear cx={x + w * 0.3 + r1 * 2.1} cy={y + h * 0.46 - r1 * 0.33} r={r3} teeth={7} rot={rot * (r1 / r3)}
        colors={colors} fill={colors.onGround} opacity={0.35} />
    </g>
  );
});

registerObject("cross section", ({ box, colors, p, uid }) => {
  const { x, y, w, h } = box;
  const hatch = 16;
  const id = `cs${uid}`;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <path d={`M${x + w * 0.12},${y + h * 0.2} L${x + w * 0.88},${y + h * 0.2} L${x + w * 0.88},${y + h * 0.8}
                    L${x + w * 0.12},${y + h * 0.8} Z M${x + w * 0.38},${y + h * 0.38} L${x + w * 0.62},${y + h * 0.38}
                    L${x + w * 0.62},${y + h * 0.62} L${x + w * 0.38},${y + h * 0.62} Z`} clipRule="evenodd" />
        </clipPath>
      </defs>
      {/* section hatching at 45 degrees is the convention that says "cut through" */}
      <g clipPath={`url(#${id})`}>
        {Array.from({ length: hatch * 2 }).map((_, i) => (
          <line key={i} x1={x - w + (w * i) / hatch} y1={y} x2={x + (w * i) / hatch} y2={y + h}
            stroke={colors.onGround} strokeWidth={1.4} opacity={0.32} />
        ))}
      </g>
      <path d={`M${x + w * 0.12},${y + h * 0.2} L${x + w * 0.88},${y + h * 0.2} L${x + w * 0.88},${y + h * 0.8} L${x + w * 0.12},${y + h * 0.8} Z`}
        fill="none" stroke={colors.onGround} strokeWidth={2.6} opacity={0.8} />
      <rect x={x + w * 0.38} y={y + h * 0.38} width={w * 0.24} height={h * 0.24} fill="none"
        stroke={colors.accent} strokeWidth={2.6} opacity={0.9} />
      {/* the cut plane arrows down the side */}
      <line x1={x + w * 0.04} y1={y + h * 0.2} x2={x + w * 0.04} y2={y + h * 0.8}
        stroke={colors.accent} strokeWidth={2} opacity={0.7 * Math.max(0.3, p)} strokeDasharray="12 6" />
    </g>
  );
});

registerObject("bolt joint", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const th = h * 0.14;
  return (
    <g>
      {/* two plates clamped by one bolt: the joint, not a screw floating alone */}
      <rect x={x} y={y + h * 0.34} width={w} height={th} fill={colors.onGround} opacity={0.35} />
      <rect x={x} y={y + h * 0.34 + th} width={w} height={th} fill={colors.onGround} opacity={0.22} />
      <rect x={x + w * 0.42} y={y + h * 0.14} width={w * 0.16} height={h * 0.62} fill={colors.accent} opacity={0.75} />
      {/* hex head and nut, drawn as hexes */}
      {[y + h * 0.14, y + h * 0.76].map((cy, i) => (
        <path key={i} d={Array.from({ length: 6 }).map((_, k) => {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          return `${k ? "L" : "M"}${x + w * 0.5 + Math.cos(a) * w * 0.14},${cy + Math.sin(a) * w * 0.14}`;
        }).join(" ") + " Z"} fill={colors.accent} opacity={0.9} />
      ))}
      {/* the clamping force, arriving */}
      {[0.2, 0.8].map((f, i) => (
        <line key={i} x1={x + w * f} y1={y + h * (0.2 - 0.06 * p)} x2={x + w * f} y2={y + h * 0.32}
          stroke={colors.onGround} strokeWidth={2} opacity={0.5} markerEnd="" />
      ))}
    </g>
  );
});

registerObject("machine housing", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      <rect x={x} y={y + h * 0.1} width={w} height={h * 0.78} rx={w * 0.03} fill={colors.onGround} opacity={0.28} />
      <rect x={x} y={y + h * 0.1} width={w} height={h * 0.78} rx={w * 0.03} fill="none"
        stroke={colors.onGround} strokeWidth={2.4} strokeOpacity={0.65} />
      {/* louvres, an access panel, feet — the things that make a box a machine */}
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={x + w * 0.08} y={y + h * (0.2 + i * 0.055)} width={w * 0.3} height={Math.max(2, h * 0.018)}
          fill={colors.onGround} opacity={0.45} />
      ))}
      <rect x={x + w * 0.52} y={y + h * 0.2} width={w * 0.38} height={h * 0.36} fill="none"
        stroke={colors.onGround} strokeWidth={1.8} opacity={0.5} />
      <circle cx={x + w * 0.86} cy={y + h * 0.38} r={Math.max(3, w * 0.022)} fill={colors.onGround} opacity={0.5} />
      {/* a running lamp, on once the beat is under way */}
      <circle cx={x + w * 0.6} cy={y + h * 0.68} r={Math.max(4, w * 0.03)} fill={colors.accent} opacity={p > 0.25 ? 0.95 : 0.25} />
      {[0.14, 0.86].map((f, i) => (
        <rect key={i} x={x + w * f - w * 0.05} y={y + h * 0.88} width={w * 0.1} height={h * 0.08}
          fill={colors.onGround} opacity={0.4} />
      ))}
    </g>
  );
});

registerObject("robot arm", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const bx = x + w * 0.16, by = y + h * 0.9;
  const a1 = -Math.PI * (0.62 - 0.16 * p);
  const L1 = h * 0.42, L2 = h * 0.34;
  const jx = bx + Math.cos(a1) * L1, jy = by + Math.sin(a1) * L1;
  const a2 = a1 + Math.PI * (0.42 - 0.2 * p);
  const ex = jx + Math.cos(a2) * L2, ey = jy + Math.sin(a2) * L2;
  const seg = Math.max(6, w * 0.055);
  return (
    <g>
      <rect x={bx - w * 0.11} y={by} width={w * 0.22} height={h * 0.1} fill={colors.onGround} opacity={0.45} />
      <line x1={bx} y1={by} x2={jx} y2={jy} stroke={colors.onGround} strokeWidth={seg} strokeLinecap="round" opacity={0.55} />
      <line x1={jx} y1={jy} x2={ex} y2={ey} stroke={colors.onGround} strokeWidth={seg * 0.8} strokeLinecap="round" opacity={0.45} />
      {[[bx, by], [jx, jy]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={seg * 0.62} fill={colors.onGround} opacity={0.7} />
      ))}
      {/* the gripper, open, at the end of the arm */}
      <g stroke={colors.accent} strokeWidth={seg * 0.42} strokeLinecap="round" opacity={0.95} fill="none">
        <line x1={ex} y1={ey} x2={ex + Math.cos(a2 - 0.5) * seg * 1.5} y2={ey + Math.sin(a2 - 0.5) * seg * 1.5} />
        <line x1={ex} y1={ey} x2={ex + Math.cos(a2 + 0.5) * seg * 1.5} y2={ey + Math.sin(a2 + 0.5) * seg * 1.5} />
      </g>
    </g>
  );
});

registerObject("conveyor belt", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const by = y + h * 0.6;
  const bh = h * 0.12;
  const rollers = 7;
  return (
    <g>
      <rect x={x} y={by} width={w} height={bh} fill={colors.onGround} opacity={0.35} />
      {Array.from({ length: rollers }).map((_, i) => (
        <circle key={i} cx={x + (w * (i + 0.5)) / rollers} cy={by + bh / 2} r={bh * 0.42}
          fill="none" stroke={colors.onGround} strokeWidth={1.6} opacity={0.55} />
      ))}
      <line x1={x} y1={by + bh} x2={x + w} y2={by + bh} stroke={colors.onGround} strokeWidth={2.4} opacity={0.6} />
      {/* parts riding the belt, actually moving with p */}
      {Array.from({ length: 4 }).map((_, i) => {
        const t = ((i / 4) + p * 0.55) % 1;
        const s = Math.max(8, w * 0.07);
        return (
          <rect key={i} x={x + w * t - s / 2} y={by - s} width={s} height={s}
            fill={i === 1 ? colors.accent : colors.onGround} opacity={i === 1 ? 0.85 : 0.5} />
        );
      })}
      {/* legs, so the belt is standing on the floor */}
      {[0.12, 0.88].map((f, i) => (
        <rect key={i} x={x + w * f} y={by + bh} width={Math.max(3, w * 0.02)} height={h * 0.28}
          fill={colors.onGround} opacity={0.4} />
      ))}
    </g>
  );
});

registerObject("component part", ({ box, colors }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      {/* an L-bracket with drilled holes and a chamfer: a made part */}
      <path d={`M${x + w * 0.1},${y + h * 0.18} L${x + w * 0.72},${y + h * 0.18} L${x + w * 0.86},${y + h * 0.32}
                L${x + w * 0.86},${y + h * 0.56} L${x + w * 0.38},${y + h * 0.56} L${x + w * 0.38},${y + h * 0.86}
                L${x + w * 0.1},${y + h * 0.86} Z`}
        fill={colors.onGround} opacity={0.34} stroke={colors.onGround} strokeWidth={2.4} strokeOpacity={0.75} />
      {[[0.22, 0.32], [0.62, 0.32], [0.22, 0.72]].map(([fx, fy], i) => (
        <circle key={i} cx={x + w * fx} cy={y + h * fy} r={Math.max(3.5, w * 0.045)}
          fill="none" stroke={colors.accent} strokeWidth={2.2} opacity={0.9} />
      ))}
    </g>
  );
});

registerObject("iv stand", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const px = x + w * 0.5;
  return (
    <g>
      <line x1={px} y1={y + h * 0.1} x2={px} y2={y + h * 0.88} stroke={colors.onGround} strokeWidth={Math.max(3, w * 0.025)} opacity={0.55} />
      {/* the five-star base every drip stand has */}
      {[-1, -0.5, 0.5, 1].map((k, i) => (
        <line key={i} x1={px} y1={y + h * 0.88} x2={px + w * 0.22 * k} y2={y + h * 0.96}
          stroke={colors.onGround} strokeWidth={2.4} opacity={0.5} />
      ))}
      {/* the bag, draining as the beat runs */}
      <path d={`M${px - w * 0.16},${y + h * 0.14} L${px + w * 0.16},${y + h * 0.14} L${px + w * 0.13},${y + h * 0.44}
                L${px - w * 0.13},${y + h * 0.44} Z`}
        fill={colors.onGround} opacity={0.18} stroke={colors.onGround} strokeWidth={1.8} strokeOpacity={0.55} />
      <path d={`M${px - w * 0.15},${y + h * (0.44 - 0.28 * (1 - p))} L${px + w * 0.15},${y + h * (0.44 - 0.28 * (1 - p))}
                L${px + w * 0.13},${y + h * 0.44} L${px - w * 0.13},${y + h * 0.44} Z`}
        fill={colors.accent} opacity={0.6} />
      <line x1={px} y1={y + h * 0.44} x2={px} y2={y + h * 0.66} stroke={colors.accent} strokeWidth={2} opacity={0.7} />
      <circle cx={px} cy={y + h * 0.7} r={Math.max(2.5, w * 0.018)} fill={colors.accent} opacity={0.9} />
    </g>
  );
});

registerObject("lab bench", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const ty = y + h * 0.52;
  return (
    <g>
      {/* the bench top and its riser shelf */}
      <rect x={x} y={ty} width={w} height={h * 0.06} fill={colors.onGround} opacity={0.5} />
      <rect x={x + w * 0.04} y={y + h * 0.2} width={w * 0.92} height={Math.max(2, h * 0.018)} fill={colors.onGround} opacity={0.35} />
      {[0.06, 0.94].map((f, i) => (
        <rect key={i} x={x + w * f - w * 0.012} y={ty + h * 0.06} width={w * 0.024} height={h * 0.34}
          fill={colors.onGround} opacity={0.4} />
      ))}
      {/* glassware and a microscope stand on it */}
      {Array.from({ length: 3 }).map((_, i) => {
        const cx = x + w * (0.16 + i * 0.14);
        const a = Math.max(0, Math.min(1, p * 3 - i));
        if (a <= 0) return null;
        return (
          <g key={i} opacity={a}>
            <path d={`M${cx - w * 0.035},${ty - h * 0.16} L${cx + w * 0.035},${ty - h * 0.16} L${cx + w * 0.05},${ty} L${cx - w * 0.05},${ty} Z`}
              fill="none" stroke={colors.onGround} strokeWidth={1.8} opacity={0.6} />
            <path d={`M${cx - w * 0.043},${ty - h * 0.06} L${cx + w * 0.043},${ty - h * 0.06} L${cx + w * 0.05},${ty} L${cx - w * 0.05},${ty} Z`}
              fill={colors.accent} opacity={0.6} />
          </g>
        );
      })}
      <g opacity={0.6}>
        <rect x={x + w * 0.66} y={ty - h * 0.05} width={w * 0.16} height={h * 0.05} fill={colors.onGround} />
        <rect x={x + w * 0.72} y={ty - h * 0.3} width={w * 0.04} height={h * 0.25} fill={colors.onGround} />
        <rect x={x + w * 0.68} y={ty - h * 0.34} width={w * 0.12} height={h * 0.05} fill={colors.onGround} />
      </g>
    </g>
  );
});

registerObject("evidence tube", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const tw = w * 0.34, tx = x + (w - tw) / 2;
  return (
    <g>
      {/* a round-bottomed vial with a cap and a barcode label */}
      <path d={`M${tx},${y + h * 0.12} L${tx + tw},${y + h * 0.12} L${tx + tw},${y + h * 0.8}
                Q${tx + tw / 2},${y + h * 0.98} ${tx},${y + h * 0.8} Z`}
        fill={colors.onGround} opacity={0.14} stroke={colors.onGround} strokeWidth={2} strokeOpacity={0.6} />
      <rect x={tx - tw * 0.08} y={y} width={tw * 1.16} height={h * 0.13} rx={tw * 0.06} fill={colors.accent} opacity={0.85} />
      <path d={`M${tx},${y + h * (0.8 - 0.42 * Math.max(0.2, p))} L${tx + tw},${y + h * (0.8 - 0.42 * Math.max(0.2, p))}
                L${tx + tw},${y + h * 0.8} Q${tx + tw / 2},${y + h * 0.98} ${tx},${y + h * 0.8} Z`}
        fill={colors.accent} opacity={0.45} />
      <rect x={tx + tw * 0.1} y={y + h * 0.3} width={tw * 0.8} height={h * 0.18} fill={colors.paper} opacity={0.85} />
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x={tx + tw * (0.16 + i * 0.1)} y={y + h * 0.33} width={tw * (i % 2 ? 0.05 : 0.025)} height={h * 0.12}
          fill={colors.ink} opacity={0.8} />
      ))}
    </g>
  );
});

registerObject("pill dose", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 3;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * n - i));
        if (a <= 0) return null;
        const cw = w * 0.42, ch = h * 0.15;
        const cx = x + w * (0.2 + i * 0.16), cy = y + h * (0.3 + i * 0.18);
        return (
          <g key={i} opacity={a} transform={`rotate(${-12 + i * 10} ${cx + cw / 2} ${cy + ch / 2})`}>
            {/* a two-tone capsule with a seam, not a lozenge */}
            <rect x={cx} y={cy} width={cw} height={ch} rx={ch / 2} fill={colors.onGround} opacity={0.4} />
            <path d={`M${cx + cw / 2},${cy} L${cx + cw - ch / 2},${cy} A${ch / 2},${ch / 2} 0 0 1 ${cx + cw - ch / 2},${cy + ch} L${cx + cw / 2},${cy + ch} Z`}
              fill={colors.accent} opacity={0.85} />
            <line x1={cx + cw / 2} y1={cy} x2={cx + cw / 2} y2={cy + ch} stroke={colors.onGround} strokeWidth={1.6} opacity={0.6} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("film reel", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const R = Math.min(w, h) * 0.4;
  const cx = x + w / 2, cy = y + h / 2;
  const rot = p * 90;
  return (
    <g>
      <g transform={`rotate(${rot} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={colors.onGround} strokeWidth={R * 0.12} opacity={0.6} />
        <circle cx={cx} cy={cy} r={R * 0.18} fill={colors.onGround} opacity={0.6} />
        {/* the three cut-outs a reel flange actually has */}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return <circle key={i} cx={cx + Math.cos(a) * R * 0.55} cy={cy + Math.sin(a) * R * 0.55} r={R * 0.22}
            fill="none" stroke={colors.onGround} strokeWidth={R * 0.08} opacity={0.45} />;
        })}
      </g>
      {/* film pulling off the reel, with sprocket holes */}
      {/* the film pulls off toward the bottom-right corner, INSIDE the box --
          it used to run to 1.22x the width and would have overflowed any
          template that anchored a reel near the frame edge */}
      <path d={`M${cx + R * 0.85},${cy + R * 0.38} q${w * 0.08},${h * 0.1} ${w * 0.1},${h * 0.2}`}
        fill="none" stroke={colors.accent} strokeWidth={Math.max(6, R * 0.24)} opacity={0.7} />
      {Array.from({ length: 4 }).map((_, i) => (
        <rect key={i} x={cx + R * 0.92 + i * w * 0.035} y={cy + R * 0.5 + i * h * 0.06}
          width={Math.max(2, w * 0.014)} height={Math.max(2, h * 0.016)} fill={colors.onGround} opacity={0.7} />
      ))}
    </g>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURES AND FIGURES — architecture, silhouettes, insignia. Ground-drawn.
// ─────────────────────────────────────────────────────────────────────────────

registerObject("office tower", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const bw = w * 0.56, bx = x + (w - bw) / 2;
  const cols = 5, rows = 11;
  return (
    <g>
      <rect x={bx} y={y + h * 0.08} width={bw} height={h * 0.92} fill={colors.onGround} opacity={0.26} />
      <rect x={bx} y={y + h * 0.08} width={bw} height={h * 0.92} fill="none" stroke={colors.onGround} strokeWidth={2} strokeOpacity={0.55} />
      {/* lit and unlit windows — a tower is a grid of rooms, some occupied */}
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const lit = ((r * 7 + c * 3) % 5) < 2 && p > (r / rows) * 0.5;
          return (
            <rect key={`${r}-${c}`} x={bx + bw * (0.1 + c * 0.17)} y={y + h * (0.14 + r * 0.078)}
              width={bw * 0.12} height={h * 0.045}
              fill={lit ? colors.accent : colors.onGround} opacity={lit ? 0.8 : 0.22} />
          );
        })
      )}
      {/* a shorter neighbour, so it reads as a skyline not a monolith */}
      <rect x={bx - w * 0.22} y={y + h * 0.42} width={w * 0.2} height={h * 0.58} fill={colors.onGround} opacity={0.16} />
    </g>
  );
});

registerObject("courthouse column", ({ box, colors }) => {
  const { x, y, w, h } = box;
  const cw = w * 0.34, cx = x + (w - cw) / 2;
  const flutes = 5;
  return (
    <g>
      {/* pediment corner, capital, fluted shaft, base: a classical order */}
      <path d={`M${x},${y + h * 0.12} L${x + w / 2},${y} L${x + w},${y + h * 0.12} Z`} fill={colors.onGround} opacity={0.3} />
      <rect x={x} y={y + h * 0.12} width={w} height={h * 0.05} fill={colors.onGround} opacity={0.42} />
      <rect x={cx - cw * 0.18} y={y + h * 0.17} width={cw * 1.36} height={h * 0.05} fill={colors.onGround} opacity={0.5} />
      <rect x={cx} y={y + h * 0.22} width={cw} height={h * 0.68} fill={colors.onGround} opacity={0.3} />
      {Array.from({ length: flutes }).map((_, i) => (
        <line key={i} x1={cx + (cw * (i + 0.5)) / flutes} y1={y + h * 0.23}
          x2={cx + (cw * (i + 0.5)) / flutes} y2={y + h * 0.89}
          stroke={colors.onGround} strokeWidth={1.6} opacity={0.4} />
      ))}
      <rect x={cx - cw * 0.14} y={y + h * 0.9} width={cw * 1.28} height={h * 0.06} fill={colors.onGround} opacity={0.5} />
      <rect x={cx - cw * 0.24} y={y + h * 0.96} width={cw * 1.48} height={h * 0.04} fill={colors.accent} opacity={0.55} />
    </g>
  );
});

registerObject("prison window", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const bars = 5;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={colors.onGround} opacity={0.4} />
      {/* the light beyond, which is the only reason to draw a prison window */}
      <rect x={x + w * 0.08} y={y + h * 0.08} width={w * 0.84} height={h * 0.84}
        fill={colors.accent} opacity={0.28 + 0.35 * Math.max(0, Math.min(1, p))} />
      {Array.from({ length: bars }).map((_, i) => (
        <rect key={i} x={x + w * (0.08 + (i + 0.5) * (0.84 / bars)) - w * 0.022} y={y + h * 0.08}
          width={w * 0.044} height={h * 0.84} fill={colors.onGround} opacity={0.85} />
      ))}
      <rect x={x + w * 0.08} y={y + h * 0.48} width={w * 0.84} height={h * 0.04} fill={colors.onGround} opacity={0.85} />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={colors.onGround} strokeWidth={3} strokeOpacity={0.8} />
    </g>
  );
});

registerObject("stone monument", ({ box, colors }) => {
  const { x, y, w, h } = box;
  const mw = w * 0.3, mx = x + (w - mw) / 2;
  return (
    <g>
      {/* a tapering obelisk on a stepped plinth */}
      <path d={`M${mx + mw * 0.5},${y + h * 0.04} L${mx + mw * 0.86},${y + h * 0.18} L${mx + mw * 0.78},${y + h * 0.76}
                L${mx + mw * 0.22},${y + h * 0.76} L${mx + mw * 0.14},${y + h * 0.18} Z`}
        fill={colors.onGround} opacity={0.34} stroke={colors.onGround} strokeWidth={2} strokeOpacity={0.6} />
      {[0.8, 0.87].map((f, i) => (
        <rect key={i} x={mx - mw * (0.2 + i * 0.24)} y={y + h * f} width={mw * (1.4 + i * 0.48)} height={h * 0.07}
          fill={colors.onGround} opacity={0.42 - i * 0.08} />
      ))}
      {/* an inscription panel, ruled not lettered */}
      <rect x={mx + mw * 0.26} y={y + h * 0.36} width={mw * 0.48} height={h * 0.22} fill={colors.accent} opacity={0.3} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={mx + mw * 0.31} y={y + h * (0.4 + i * 0.06)} width={mw * 0.38} height={Math.max(1.5, h * 0.012)}
          fill={colors.onGround} opacity={0.55} />
      ))}
    </g>
  );
});

registerObject("desk edge", ({ box, colors }) => {
  const { x, y, w, h } = box;
  const ey = y + h * 0.42;
  return (
    <g>
      {/* the front edge of a desk seen level: a surface, a lip, and a shadow under it */}
      <rect x={x} y={ey} width={w} height={h * 0.07} fill={colors.onGround} opacity={0.5} />
      <rect x={x} y={ey + h * 0.07} width={w} height={h * 0.05} fill={colors.onGround} opacity={0.22} />
      <line x1={x} y1={ey} x2={x + w} y2={ey} stroke={colors.onGround} strokeWidth={2} opacity={0.65} />
      {/* a mug and a pen resting on it, at the edge of frame */}
      <rect x={x + w * 0.12} y={ey - h * 0.13} width={w * 0.1} height={h * 0.13} rx={w * 0.012}
        fill={colors.accent} opacity={0.7} />
      <path d={`M${x + w * 0.22},${ey - h * 0.1} q${w * 0.04},${h * 0.03} 0,${h * 0.06}`}
        fill="none" stroke={colors.accent} strokeWidth={2.4} opacity={0.7} />
      <line x1={x + w * 0.62} y1={ey - h * 0.02} x2={x + w * 0.82} y2={ey - h * 0.02}
        stroke={colors.onGround} strokeWidth={Math.max(3, h * 0.022)} opacity={0.55} strokeLinecap="round" />
    </g>
  );
});

registerObject("figure silhouette", ({ box, colors }) => {
  const { x, y, w, h } = box;
  const cx = x + w / 2;
  return (
    <g>
      {/* head, neck, shoulders: the standard bust crop, drawn as one mass */}
      <circle cx={cx} cy={y + h * 0.22} r={Math.min(w, h) * 0.16} fill={colors.onGround} opacity={0.55} />
      <path d={`M${cx - w * 0.05},${y + h * 0.35} L${cx + w * 0.05},${y + h * 0.35}
                C${cx + w * 0.34},${y + h * 0.44} ${cx + w * 0.4},${y + h * 0.7} ${cx + w * 0.4},${y + h}
                L${cx - w * 0.4},${y + h}
                C${cx - w * 0.4},${y + h * 0.7} ${cx - w * 0.34},${y + h * 0.44} ${cx - w * 0.05},${y + h * 0.35} Z`}
        fill={colors.onGround} opacity={0.45} />
      {/* a collar line so it reads as a person dressed, not a shadow */}
      <path d={`M${cx - w * 0.12},${y + h * 0.42} L${cx},${y + h * 0.56} L${cx + w * 0.12},${y + h * 0.42}`}
        fill="none" stroke={colors.accent} strokeWidth={2.6} opacity={0.8} />
    </g>
  );
});

registerObject("product silhouette", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  return (
    <g>
      {/* a boxed product on a reflective plinth: the glamour-shot staging */}
      <rect x={x + w * 0.24} y={y + h * 0.2} width={w * 0.52} height={h * 0.56} rx={w * 0.03}
        fill={colors.onGround} opacity={0.4} />
      <path d={`M${x + w * 0.24},${y + h * 0.2} l${w * 0.1},${-h * 0.1} l${w * 0.52},0 l${-w * 0.1},${h * 0.1} Z`}
        fill={colors.onGround} opacity={0.26} />
      <path d={`M${x + w * 0.76},${y + h * 0.2} l${w * 0.1},${-h * 0.1} l0,${h * 0.56} l${-w * 0.1},${h * 0.1} Z`}
        fill={colors.onGround} opacity={0.18} />
      <rect x={x + w * 0.32} y={y + h * 0.34} width={w * 0.36} height={h * 0.05} fill={colors.accent} opacity={0.85} />
      {/* the reflection, fading */}
      <rect x={x + w * 0.24} y={y + h * 0.78} width={w * 0.52} height={h * 0.16} fill={colors.onGround}
        opacity={0.12 * Math.max(0.3, p)} />
    </g>
  );
});

registerObject("spacecraft silhouette", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cy = y + h / 2;
  return (
    <g>
      {/* a bus with two solar wings and a dish — a real spacecraft layout */}
      <rect x={x + w * 0.42} y={cy - h * 0.12} width={w * 0.18} height={h * 0.24} fill={colors.onGround} opacity={0.6} />
      {[-1, 1].map((k, i) => (
        <g key={i}>
          <line x1={x + w * (k < 0 ? 0.42 : 0.6)} y1={cy} x2={x + w * (0.5 + k * 0.24)} y2={cy}
            stroke={colors.onGround} strokeWidth={2.4} opacity={0.5} />
          <rect x={x + w * (0.5 + k * 0.44) - (k < 0 ? 0 : w * 0.2)} y={cy - h * 0.1}
            width={w * 0.2} height={h * 0.2} fill={colors.accent} opacity={0.5} />
          <rect x={x + w * (0.5 + k * 0.44) - (k < 0 ? 0 : w * 0.2)} y={cy - h * 0.1}
            width={w * 0.2} height={h * 0.2} fill="none" stroke={colors.onGround} strokeWidth={1.4} opacity={0.6} />
        </g>
      ))}
      <path d={`M${x + w * 0.5},${cy - h * 0.12} A${h * 0.13},${h * 0.13} 0 0 1 ${x + w * 0.5},${cy - h * 0.38}`}
        fill="none" stroke={colors.onGround} strokeWidth={2.4} opacity={0.6} />
      <ellipse cx={x + w * 0.5} cy={cy - h * 0.34} rx={w * 0.09} ry={h * 0.05} fill={colors.onGround} opacity={0.45} />
      {/* thruster plume, lit once under way */}
      <path d={`M${x + w * 0.42},${cy - h * 0.05} l${-w * 0.1 * Math.max(0.2, p)},${h * 0.05} l${w * 0.1 * Math.max(0.2, p)},${h * 0.05} Z`}
        fill={colors.accent} opacity={0.8} />
    </g>
  );
});

registerObject("gavel", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const lift = (1 - Math.max(0, Math.min(1, p * 1.6))) * h * 0.16;
  return (
    <g>
      {/* the sound block stays put; the gavel comes down onto it */}
      <rect x={x + w * 0.28} y={y + h * 0.78} width={w * 0.44} height={h * 0.09} rx={h * 0.015}
        fill={colors.onGround} opacity={0.5} />
      <g transform={`translate(0 ${-lift}) rotate(-14 ${x + w * 0.5} ${y + h * 0.6})`}>
        <rect x={x + w * 0.3} y={y + h * 0.5} width={w * 0.4} height={h * 0.18} rx={h * 0.03}
          fill={colors.accent} opacity={0.85} />
        {[0.32, 0.64].map((f, i) => (
          <rect key={i} x={x + w * f} y={y + h * 0.48} width={w * 0.04} height={h * 0.22} fill={colors.onGround} opacity={0.55} />
        ))}
        <rect x={x + w * 0.47} y={y + h * 0.16} width={w * 0.06} height={h * 0.36} rx={w * 0.02}
          fill={colors.onGround} opacity={0.6} />
        <circle cx={x + w * 0.5} cy={y + h * 0.14} r={w * 0.05} fill={colors.onGround} opacity={0.6} />
      </g>
    </g>
  );
});

registerObject("royal seal", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const R = Math.min(w, h) * 0.3;
  const cx = x + w / 2, cy = y + h * 0.4;
  const pts = 12;
  return (
    <g>
      {/* two ribbon tails under a wax medallion with a scalloped edge */}
      {[-1, 1].map((k, i) => (
        <path key={i} d={`M${cx + k * R * 0.4},${cy + R * 0.7} L${cx + k * R * 1.1},${y + h * 0.95} L${cx + k * R * 0.3},${y + h * 0.86} Z`}
          fill={colors.accent} opacity={0.5} />
      ))}
      <path d={Array.from({ length: pts * 2 }).map((_, i) => {
        const a = (i / (pts * 2)) * Math.PI * 2;
        const r = i % 2 ? R : R * 1.14;
        return `${i ? "L" : "M"}${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
      }).join(" ") + " Z"} fill={colors.accent} opacity={0.8} />
      <circle cx={cx} cy={cy} r={R * 0.72} fill="none" stroke={colors.onGround} strokeWidth={2} opacity={0.55} />
      {/* an impressed device: a crown reduced to three points */}
      <path d={`M${cx - R * 0.34},${cy + R * 0.24} L${cx - R * 0.34},${cy - R * 0.1} L${cx - R * 0.14},${cy + R * 0.06}
                L${cx},${cy - R * 0.26} L${cx + R * 0.14},${cy + R * 0.06} L${cx + R * 0.34},${cy - R * 0.1}
                L${cx + R * 0.34},${cy + R * 0.24} Z`}
        fill={colors.onGround} opacity={0.5 * Math.max(0.4, p)} />
    </g>
  );
});

registerObject("clock face", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const R = Math.min(w, h) * 0.42;
  const cx = x + w / 2, cy = y + h / 2;
  const mins = Math.PI * 2 * p - Math.PI / 2;
  const hrs = Math.PI * 2 * (p / 12) - Math.PI / 2;
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill={colors.paper} opacity={0.14} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={colors.onGround} strokeWidth={R * 0.08} opacity={0.6} />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const long = i % 3 === 0;
        return (
          <line key={i} x1={cx + Math.cos(a) * R * (long ? 0.76 : 0.84)} y1={cy + Math.sin(a) * R * (long ? 0.76 : 0.84)}
            x2={cx + Math.cos(a) * R * 0.92} y2={cy + Math.sin(a) * R * 0.92}
            stroke={colors.onGround} strokeWidth={long ? 3 : 1.6} opacity={long ? 0.7 : 0.4} />
        );
      })}
      <line x1={cx} y1={cy} x2={cx + Math.cos(hrs) * R * 0.46} y2={cy + Math.sin(hrs) * R * 0.46}
        stroke={colors.onGround} strokeWidth={R * 0.1} strokeLinecap="round" opacity={0.8} />
      <line x1={cx} y1={cy} x2={cx + Math.cos(mins) * R * 0.72} y2={cy + Math.sin(mins) * R * 0.72}
        stroke={colors.accent} strokeWidth={R * 0.07} strokeLinecap="round" opacity={0.95} />
      <circle cx={cx} cy={cy} r={R * 0.07} fill={colors.onGround} opacity={0.85} />
    </g>
  );
});

registerObject("resource site marker", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const cx = x + w / 2;
  return (
    <g>
      {/* a derrick over a pin: an extraction site, not a generic map dot */}
      <path d={`M${cx - w * 0.18},${y + h * 0.72} L${cx - w * 0.06},${y + h * 0.22}
                L${cx + w * 0.06},${y + h * 0.22} L${cx + w * 0.18},${y + h * 0.72}`}
        fill="none" stroke={colors.onGround} strokeWidth={2.6} opacity={0.65} />
      {[0.34, 0.48, 0.62].map((f, i) => (
        <line key={i} x1={cx - w * (0.06 + (f - 0.22) * 0.3)} y1={y + h * f}
          x2={cx + w * (0.06 + (f - 0.22) * 0.3)} y2={y + h * (f + 0.06)}
          stroke={colors.onGround} strokeWidth={1.8} opacity={0.45} />
      ))}
      <path d={`M${cx},${y + h * 0.96} L${cx - w * 0.1},${y + h * 0.78} A${w * 0.1},${w * 0.1} 0 1 1 ${cx + w * 0.1},${y + h * 0.78} Z`}
        fill={colors.accent} opacity={0.9} />
      <circle cx={cx} cy={y + h * 0.74} r={w * 0.038} fill={colors.paper} opacity={0.75} />
      {/* the extraction plume, once the site is running */}
      <path d={`M${cx},${y + h * 0.22} q${w * 0.08},${-h * 0.1 * Math.max(0.2, p)} ${w * 0.02},${-h * 0.18 * Math.max(0.2, p)}`}
        fill="none" stroke={colors.accent} strokeWidth={3} opacity={0.7} />
    </g>
  );
});

registerObject("supply route", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const m = Math.max(5, w * 0.035);
  const d = `M${x + m},${y + h * 0.78} Q${x + w * 0.3},${y + h * 0.2} ${x + w * 0.58},${y + h * 0.52} T${x + w - m},${y + h * 0.24}`;
  const t = Math.max(0, Math.min(1, p));
  return (
    <g>
      <path d={d} fill="none" stroke={colors.onGround} strokeWidth={2} opacity={0.25} strokeDasharray="4 8" />
      <path d={d} fill="none" stroke={colors.accent} strokeWidth={3.2} opacity={0.9}
        strokeDasharray={2400} strokeDashoffset={2400 * (1 - t)} />
      {/* origin and destination, and a convoy chevron partway along */}
      <circle cx={x + m} cy={y + h * 0.78} r={Math.max(4, w * 0.026)} fill={colors.onGround} opacity={0.8} />
      <rect x={x + w - m - w * 0.03} y={y + h * 0.24 - w * 0.03} width={w * 0.06} height={w * 0.06}
        fill={colors.accent} opacity={0.95} transform={`rotate(45 ${x + w - m} ${y + h * 0.24})`} />
      <path d={`M${x + w * 0.52},${y + h * 0.46} l${w * 0.05},${h * 0.05} l${-w * 0.05},${h * 0.05}`}
        fill="none" stroke={colors.accent} strokeWidth={3} opacity={0.9 * t} />
    </g>
  );
});

registerObject("cash notes", ({ box, colors, p }) => {
  const { x, y, w, h } = box;
  const n = 4;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const a = Math.max(0, Math.min(1, p * n - i));
        if (a <= 0) return null;
        const nw = w * 0.78, nh = h * 0.34;
        const nx = x + w * 0.06 + i * w * 0.035;
        const ny = y + h * 0.5 - nh / 2 + i * h * 0.06 - n * h * 0.03;
        return (
          <g key={i} opacity={a} transform={`rotate(${-6 + i * 4} ${nx + nw / 2} ${ny + nh / 2})`}>
            <rect x={nx} y={ny} width={nw} height={nh} fill={colors.paper} stroke={colors.ink} strokeWidth={1.4} strokeOpacity={0.35} />
            {/* the oval portrait window and the guilloche border a note actually has */}
            <rect x={nx + nw * 0.04} y={ny + nh * 0.1} width={nw * 0.92} height={nh * 0.8} fill="none"
              stroke={colors.accent} strokeWidth={1.4} opacity={0.6} />
            <ellipse cx={nx + nw * 0.3} cy={ny + nh * 0.5} rx={nw * 0.12} ry={nh * 0.28}
              fill={colors.ink} opacity={0.28} />
            <rect x={nx + nw * 0.52} y={ny + nh * 0.38} width={nw * 0.3} height={nh * 0.18} fill={colors.accent} opacity={0.7} />
          </g>
        );
      })}
    </g>
  );
});

registerObject("stock ticker tape", ({ box, colors, p, uid }) => {
  const { x, y, w, h } = box;
  const ty = y + h * 0.38, th = h * 0.24;
  const entries = 7;
  return (
    <g>
      {/* the band the tape runs in, dark whatever the channel's ground is */}
      <rect x={x} y={ty} width={w} height={th} fill="#000000" opacity={0.75} />
      <rect x={x} y={ty} width={w} height={th} fill="none" stroke={colors.onGround} strokeWidth={1.5} strokeOpacity={0.4} />
      <defs>
        <clipPath id={`tk${uid}`}><rect x={x} y={ty} width={w} height={th} /></clipPath>
      </defs>
      <g clipPath={`url(#tk${uid})`}>
        {Array.from({ length: entries }).map((_, i) => {
          // the tape scrolls: each entry is a symbol block, a figure, and an
          // up or down triangle, and the whole run slides left with p
          const ex = x + w * (((i * 0.3) - p * 0.6) % 1.6) - w * 0.3;
          const down = i % 3 !== 0;
          return (
            <g key={i}>
              <rect x={ex} y={ty + th * 0.34} width={w * 0.075} height={Math.max(2, th * 0.14)}
                fill={colors.paper} opacity={0.85} />
              <rect x={ex + w * 0.09} y={ty + th * 0.34} width={w * 0.055} height={Math.max(2, th * 0.14)}
                fill={down ? colors.accent : colors.paper} opacity={0.75} />
              <path d={down
                ? `M${ex + w * 0.16},${ty + th * 0.32} l${w * 0.028},0 l${-w * 0.014},${th * 0.2} Z`
                : `M${ex + w * 0.16},${ty + th * 0.52} l${w * 0.028},0 l${-w * 0.014},${-th * 0.2} Z`}
                fill={colors.accent} opacity={0.95} />
            </g>
          );
        })}
      </g>
      {/* the mounting the board hangs from */}
      <line x1={x + w * 0.5} y1={y} x2={x + w * 0.5} y2={ty} stroke={colors.onGround} strokeWidth={2} opacity={0.4} />
    </g>
  );
});
