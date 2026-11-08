import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { PhotoTreatment } from "./PhotoTreatment.jsx";

/** One treated photograph, rendered once to a still. The video shows that still unmoved. */
export function VoxStill({ src, width, height, halftoneOpacity }) {
  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      <PhotoTreatment src={staticFile(src)} treatment="fullbleed" width={width} height={height} halftoneOpacity={halftoneOpacity} />
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "VoxStill",
    component: VoxStill,
    durationInFrames: 1,
    fps: 30,
    width: 1080,
    height: 1080,
    defaultProps: { src: "", width: 1080, height: 1080 },
    calculateMetadata: ({ props }) => ({ width: props.width, height: props.height }),
  },
];
