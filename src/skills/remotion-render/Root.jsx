import { registerRoot, Composition } from "remotion";
import { compositions as cinematicDocumentary } from "./compositions/cinematic-documentary.jsx";
import { compositions as minimal } from "./compositions/minimal.jsx";
import { compositions as motionGraphics } from "./compositions/motion-graphics.jsx";
// Step 5 of the addendum: a renderer that is a pure function of a plan. It
// knows nothing about channels or strategies, so it is registered once and
// every channel drives it through inputProps.
import { compositions as templatePlan } from "./compositions/template-scene.jsx";

/**
 * Remotion entry point.
 * Registers all style compositions for rendering.
 */

function RemotionRoot() {
  return (
    <>
      {cinematicDocumentary.map(c => <Composition key={c.id} {...c} />)}
      {minimal.map(c => <Composition key={c.id} {...c} />)}
      {motionGraphics.map(c => <Composition key={c.id} {...c} />)}
      {templatePlan.map(c => <Composition key={c.id} {...c} />)}
    </>
  );
}

registerRoot(RemotionRoot);
