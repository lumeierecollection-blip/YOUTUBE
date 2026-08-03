import { registerRoot, Composition } from "remotion";
import { compositions as cinematic } from "./compositions/cinematic-documentary.jsx";
import { compositions as minimal } from "./compositions/minimal.jsx";
import { compositions as motionGraphics } from "./compositions/motion-graphics.jsx";

/**
 * Remotion entry point.
 * Registers all style compositions for rendering.
 */

function RemotionRoot() {
  const all = [...cinematic, ...minimal, ...motionGraphics];
  return all.map((c) => (
    <Composition
      key={c.id}
      id={c.id}
      component={c.component}
      durationInFrames={c.durationInFrames}
      fps={c.fps}
      width={c.width}
      height={c.height}
    />
  ));
}

registerRoot(RemotionRoot);
