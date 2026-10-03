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
import { INK, clamp01 } from "./viz-common.js";
import { popState } from "../kinetic.js";

const FEATHER = 0.06;
const EM = 0.6;

function fitLabel(text, width, maxSize = 40) {
  const one = Math.floor(width / (Math.max(1, text.length) * EM));
  if (one >= 22 || !text.includes(" ")) return { lines: [text], size: Math.min(maxSize, one) };
  // Two lines, split at the space nearest the middle.
  const mid = text.length / 2;
  let cut = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === " " && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
  const lines = [text.slice(0, cut), text.slice(cut + 1)];
  const longest = Math.max(...lines.map((l) => l.length));
  return { lines, size: Math.min(40, Math.floor(width / (longest * EM))) };
}

// accent / ground / labelMax: the full-canvas renderer draws the highlight
// in the channel's accent on its off-white studio ground (defaults: paper).
export function PaperMap({ data, bounds, local, dur, font, accent = INK, ground = "#FFFFFF", labelMax = 40 }) {
  if (!data?.place) return null;
  const colors = { ground, onGround: INK, accent, paper: "#E7E8EA", ink: INK };
  // The map engine animates over its own progress 0..1; run it over the
  // first 60% of the beat, then hold the finished map.
  const p = clamp01(local / Math.max(1, dur * 0.6));
  const place = String(data.place).trim();
  const label = fitLabel(place, bounds.w - 8, labelMax);
  const labelH = label.lines.length * label.size * 1.1 + 12;
  const map = { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h - labelH };
  const id = `pm-${place.replace(/[^a-z0-9]/gi, "")}`;
  const f = FEATHER * 100;
  // The place name pops in place (kinetic.js POP_SOFT) once the outline has drawn.
  const ly = map.y + map.h + 8 + label.size * 0.85, lx = bounds.x + bounds.w / 2;
  const lp = popState("POP_SOFT", local - dur * 0.3);
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
      <text x={bounds.x + bounds.w / 2} textAnchor="middle" fill={INK} opacity={lp.o}
        transform={`translate(${lx.toFixed(1)} ${(ly + lp.dy).toFixed(1)}) scale(${lp.s.toFixed(4)}) translate(${(-lx).toFixed(1)} ${(-ly).toFixed(1)})`}
        fontFamily={`${font || "sans-serif"}, sans-serif`} fontWeight={700} fontSize={label.size}>
        {label.lines.map((l, i) => (
          <tspan key={i} x={bounds.x + bounds.w / 2} y={map.y + map.h + 8 + label.size * (0.85 + i * 1.1)}>{l}</tspan>
        ))}
      </text>
    </svg>
  );
}

/**
 * MAP-CENTERED: the map fills the frame (its edges feather into the ground,
 * like a photo bleeding out of the studio), zoomed tight on the region
 * (pad 0.12), the region's name set AT the region in the serif. The place was
 * checked against the region data at plan time (checkVisual); a place with no
 * border in the data never reaches here (regionOrThrow).
 */
export function CenteredMap({ data, bounds, local, dur, font, accent = INK, ground = "#F6F4F0", ink = INK }) {
  if (!data?.place) return null;
  const colors = { ground, onGround: ink, accent, paper: "#E7E8EA", ink };
  const p = clamp01(local / Math.max(1, dur * 0.6));
  const place = String(data.place).trim();
  const id = `cm-${place.replace(/[^a-z0-9]/gi, "")}`;
  const f = 9;
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
        <mask id={`${id}-mh`} maskUnits="userSpaceOnUse" x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h}>
          <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill={`url(#${id}-h)`} />
        </mask>
        <mask id={`${id}-mv`} maskUnits="userSpaceOnUse" x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h}>
          <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill={`url(#${id}-v)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-mh)`}>
        <g mask={`url(#${id}-mv)`}>
          <ObjectShape name="map-region-highlight" box={bounds} colors={colors} p={p}
            params={{ label: place, font, labelOutside: false, labelAtRegion: true, pad: 0.16, labelSize: 84, ctxStroke: 0.62, ctxWidth: 3, fillAlpha: 0.55, pFrames: Math.max(1, dur * 0.6) }} />
        </g>
      </g>
    </svg>
  );
}

export default PaperMap;
