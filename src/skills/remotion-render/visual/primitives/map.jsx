/**
 * MAP — the existing map engine (compositions/objects/maps.jsx, real Natural
 * Earth borders): the region outlines itself and a highlight fills. Drawn on
 * the paper, in its ink; the place was checked against the region data at
 * plan time (checkVisual).
 *
 * Fit contract (paper-layout.js PAPER_INNER): everything stays inside
 * `bounds`, a sub-box of the paper's inner box.
 *   - The geography is drawn in the upper part of bounds; the engine clips
 *     it to that box, and the box's edges are feathered into the paper with
 *     a mask (no pasted grey rectangle - run 36388470508 ch-9).
 *   - The label is NOT the engine's (that one was clipped to the map box and
 *     cut long names - "United Arab Emirates"). It is drawn here, in a strip
 *     under the map, measured by character count: it shrinks to fit the
 *     width, and wraps to two lines when one line would go below 22 px.
 *     Where this stops: the width is estimated (0.6 em per character of
 *     bold grotesk), not measured from the rendered glyphs.
 */
import React from "react";
import { ObjectShape } from "../../compositions/objects/index.jsx";
import { INK, clamp01, buildT } from "./viz-common.js";

const FEATHER = 0.06;
const EM = 0.6;

function fitLabel(text, width) {
  const one = Math.floor(width / (Math.max(1, text.length) * EM));
  if (one >= 22 || !text.includes(" ")) return { lines: [text], size: Math.min(40, one) };
  // Two lines, split at the space nearest the middle.
  const mid = text.length / 2;
  let cut = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === " " && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
  const lines = [text.slice(0, cut), text.slice(cut + 1)];
  const longest = Math.max(...lines.map((l) => l.length));
  return { lines, size: Math.min(40, Math.floor(width / (longest * EM))) };
}

export function PaperMap({ data, bounds, local, dur, font }) {
  if (!data?.place) return null;
  const colors = { ground: "#FFFFFF", onGround: INK, accent: INK, paper: "#E7E8EA", ink: INK };
  // The map engine animates over its own progress 0..1; run it over the
  // first 60% of the beat, then hold the finished map.
  const p = clamp01(local / Math.max(1, dur * 0.6));
  const place = String(data.place).trim();
  const label = fitLabel(place, bounds.w - 8);
  const labelH = label.lines.length * label.size * 1.1 + 12;
  const map = { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h - labelH };
  const id = `pm-${place.replace(/[^a-z0-9]/gi, "")}`;
  const f = FEATHER * 100;
  const lt = buildT(local, dur, 0.15, dur * 0.3);
  return (
    <svg width={bounds.x + bounds.w} height={bounds.y + bounds.h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}-h`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" /><stop offset={`${f}%`} stopColor="#fff" />
          <stop offset={`${100 - f}%`} stopColor="#fff" /><stop offset="100%" stopColor="#000" />
        </linearGradient>
        <linearGradient id={`${id}-v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" /><stop offset={`${f}%`} stopColor="#fff" />
          <stop offset={`${100 - f}%`} stopColor="#fff" /><stop offset="100%" stopColor="#000" />
        </linearGradient>
        <mask id={`${id}-mh`} maskUnits="userSpaceOnUse" x={map.x} y={map.y} width={map.w} height={map.h}>
          <rect x={map.x} y={map.y} width={map.w} height={map.h} fill={`url(#${id}-h)`} />
        </mask>
        <mask id={`${id}-mv`} maskUnits="userSpaceOnUse" x={map.x} y={map.y} width={map.w} height={map.h}>
          <rect x={map.x} y={map.y} width={map.w} height={map.h} fill={`url(#${id}-v)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-mh)`}>
        <g mask={`url(#${id}-mv)`}>
          <ObjectShape name="map-region-highlight" box={map} colors={colors} p={p}
            params={{ label: place, font, labelOutside: true }} />
        </g>
      </g>
      <text x={bounds.x + bounds.w / 2} textAnchor="middle" fill={INK} opacity={lt}
        fontFamily={`${font || "sans-serif"}, sans-serif`} fontWeight={700} fontSize={label.size}>
        {label.lines.map((l, i) => (
          <tspan key={i} x={bounds.x + bounds.w / 2} y={map.y + map.h + 8 + label.size * (0.85 + i * 1.1)}>{l}</tspan>
        ))}
      </text>
    </svg>
  );
}

export default PaperMap;
