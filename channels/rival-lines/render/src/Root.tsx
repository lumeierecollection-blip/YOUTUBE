import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { Episode } from "./Episode";

const calc: CalculateMetadataFunction<any> = async ({ props }) => ({
  durationInFrames: Math.max(30, Math.ceil((props.durationSec || 10) * (props.fps || 30))),
  fps: props.fps || 30,
  props,
});

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Episode"
    component={Episode as any}
    durationInFrames={300}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ theme: { paper: "#fff", ink: "#000", accent: "#c00", accent2: "#06c", highlight: "#fc0", muted: "#888", grid: "#ddd" }, durationSec: 10, fps: 30, audioSrc: "", scenes: [], images: {}, data: {} } as any}
    calculateMetadata={calc}
  />
);
