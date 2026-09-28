/**
 * MAP — the existing map engine (compositions/objects/maps.jsx, real Natural
 * Earth borders): the region outlines itself, a highlight fills, and the
 * label attaches on a leader line. Drawn on the paper, in its ink; the place
 * was checked against the region data at plan time (checkVisual).
 */
import React from "react";
import { ObjectShape } from "../../compositions/objects/index.jsx";
import { INK, clamp01 } from "./viz-common.js";

export function PaperMap({ data, zone, local, dur, font }) {
  if (!data?.place) return null;
  const colors = { ground: "#FFFFFF", onGround: INK, accent: INK, paper: "#E7E8EA", ink: INK };
  // The map engine animates over its own progress 0..1; run it over the
  // first 60% of the beat, then hold the finished map.
  const p = clamp01(local / Math.max(1, dur * 0.6));
  return (
    <svg width={zone.x + zone.w} height={zone.y + zone.h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <ObjectShape name="map-region-highlight" box={{ x: zone.x, y: zone.y, w: zone.w, h: zone.h }} colors={colors} p={p}
        params={{ label: data.place, font }} />
    </svg>
  );
}

export default PaperMap;
