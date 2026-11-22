import { registerRoot, Composition } from "remotion";
import { RivalLinesVideo, rivalLinesComposition } from "./rival-lines/RivalLinesVideo.jsx";

function RivalLinesRoot() {
  return (
    <Composition
      id="RivalLinesVideo"
      component={RivalLinesVideo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={1}
      defaultProps={{ storyboard: { scenes: [] }, onlySceneId: null }}
      calculateMetadata={({ props }) => {
        const c = rivalLinesComposition(props?.storyboard);
        return { width: c.width, height: c.height, fps: c.fps, durationInFrames: c.durationInFrames };
      }}
    />
  );
}

registerRoot(RivalLinesRoot);
