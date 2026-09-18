// DIAGNOSTIC composition: renders one scene declaration as a still so a
// composition can be LOOKED AT without running the pipeline.
//
// Kept deliberately. Every visual defect on this branch was found by
// rendering a frame and looking at it, never by reading a log — the
// translucent-text contrast failure, the mid-fade sampling, the labels the
// director refilled, and the overlapping-blob layout in the first version
// of ComposedScene. This is the cheapest way to do that.
//
// Not used by the render path; it only draws when explicitly selected.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ComposedScene } from "./visual-engine/composed-scene.jsx";
import { paletteRoles } from "./visual/palette-roles.js";

function ed_(palette) {
  const c = paletteRoles(palette);
  const all = [...palette.primary, ...palette.secondary];
  const lum = (h) => { const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)); return (0.299*r+0.587*g+0.114*b)/255; };
  const sorted = [...all].sort((a,b)=>lum(a)-lum(b));
  return { bg: sorted[0], depth: sorted[1]||sorted[0], surface: sorted[sorted.length-1],
           text: sorted[sorted.length-1], textDark: sorted[0], quiet: sorted[Math.max(1,sorted.length-2)],
           subdued: sorted[Math.max(1,sorted.length-2)], accent: c.accent, accentText: c.accent };
}

export function ComposePreview({ scene, palette, p }) {
  const e = ed_(palette);
  return (
    <AbsoluteFill style={{ backgroundColor: e.bg }}>
      <ComposedScene scene={scene} p={p ?? 0.82} ed={e} font="Inter" />
    </AbsoluteFill>
  );
}

export const compositions = [{
  id: "ComposePreview", component: ComposePreview,
  durationInFrames: 60, fps: 30, width: 1080, height: 1920,
  defaultProps: {
    scene: { objects: [{ kind: "field" }, { kind: "stack", count: 12, label: "Automated lines", emphasis: true }] },
    palette: { primary: ["#0F0F1A","#1A1A2E","#F5536B","#FAFAFA"], secondary: ["#16213E","#94A3B8"] },
    p: 0.82,
  },
}];
