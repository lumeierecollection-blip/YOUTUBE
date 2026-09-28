/**
 * MAP — the existing map engine (compositions/objects/maps.jsx, real Natural
 * Earth borders): the region outlines itself, a highlight fills, and the
 * label attaches on a leader line. Drawn on the paper, in its ink; the place
 * was checked against the region data at plan time (checkVisual).
 *
 * The engine clips its geography to a hard rectangle, which on the paper
 * read as a pasted grey box (run 36388470508 ch-9). The engine is not
 * changed; this wrapper feathers the map's edges into the paper with a
 * mask, so there is no background rectangle. Where this stops: the engine's
 * own label is clipped to the same box, so a long name next to the box
 * edge can still be cut ("United Arab Emirates").
 */
import React from "react";
import { ObjectShape } from "../../compositions/objects/index.jsx";
import { INK, clamp01 } from "./viz-common.js";

const FEATHER = 0.06;

export function PaperMap({ data, zone, local, dur, font }) {
  if (!data?.place) return null;
  const colors = { ground: "#FFFFFF", onGround: INK, accent: INK, paper: "#E7E8EA", ink: INK };
  // The map engine animates over its own progress 0..1; run it over the
  // first 60% of the beat, then hold the finished map.
  const p = clamp01(local / Math.max(1, dur * 0.6));
  const id = `pm-${String(data.place).replace(/[^a-z0-9]/gi, "")}`;
  const f = FEATHER * 100;
  return (
    <svg width={zone.x + zone.w} height={zone.y + zone.h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}-h`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" /><stop offset={`${f}%`} stopColor="#fff" />
          <stop offset={`${100 - f}%`} stopColor="#fff" /><stop offset="100%" stopColor="#000" />
        </linearGradient>
        <linearGradient id={`${id}-v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" /><stop offset={`${f}%`} stopColor="#fff" />
          <stop offset={`${100 - f}%`} stopColor="#fff" /><stop offset="100%" stopColor="#000" />
        </linearGradient>
        <mask id={`${id}-mh`} maskUnits="userSpaceOnUse" x={zone.x} y={zone.y} width={zone.w} height={zone.h}>
          <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} fill={`url(#${id}-h)`} />
        </mask>
        <mask id={`${id}-mv`} maskUnits="userSpaceOnUse" x={zone.x} y={zone.y} width={zone.w} height={zone.h}>
          <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} fill={`url(#${id}-v)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-mh)`}>
        <g mask={`url(#${id}-mv)`}>
          <ObjectShape name="map-region-highlight" box={{ x: zone.x, y: zone.y, w: zone.w, h: zone.h }} colors={colors} p={p}
            params={{ label: data.place, font }} />
        </g>
      </g>
    </svg>
  );
}

export default PaperMap;
