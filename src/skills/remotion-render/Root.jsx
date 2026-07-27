import { registerRoot, Composition } from "remotion";
import { compositions as cinematicDocumentary } from "./compositions/cinematic-documentary.jsx";
import { compositions as minimal } from "./compositions/minimal.jsx";
import { compositions as motionGraphics } from "./compositions/motion-graphics.jsx";

/**
 * Remotion entry point.
 * Registers all available compositions for rendering.
 */

function RemotionRoot() {
  return (
    <>
      {cinematicDocumentary.map(c => <Composition key={c.id} {...c} />)}
      {minimal.map(c => <Composition key={c.id} {...c} />)}
      {motionGraphics.map(c => <Composition key={c.id} {...c} />)}
    </>
  );
}

registerRoot(RemotionRoot);
