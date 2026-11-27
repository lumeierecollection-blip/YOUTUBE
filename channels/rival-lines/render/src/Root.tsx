import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { Episode } from "./Episode";
import { Thumb } from "./Thumb";
import { RealmEpisode } from "./RealmEpisode";
import { RealmThumb } from "./RealmThumb";

const calc: CalculateMetadataFunction<any> = async ({ props }) => ({
  durationInFrames: Math.max(30, Math.ceil((props.durationSec || 10) * (props.fps || 30))),
  fps: props.fps || 30,
  props,
});

export const RemotionRoot: React.FC = () => (
  <>
  <Composition
    id="Thumb"
    component={Thumb as any}
    durationInFrames={1}
    fps={30}
    width={1280}
    height={720}
    defaultProps={{} as any}
  />
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
  <Composition
    id="RealmThumb"
    component={RealmThumb as any}
    durationInFrames={1}
    fps={30}
    width={1280}
    height={720}
    defaultProps={{ theme: {}, thumb: {}, images: {} } as any}
  />
  <Composition
    id="RealmEpisode"
    component={RealmEpisode as any}
    durationInFrames={300}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ theme: {}, durationSec: 10, fps: 30, audioSrc: "", scenes: [], images: {} } as any}
    calculateMetadata={calc}
  />
  </>
);
