import { registerRoot } from "remotion";
import { compositions as cinematicDocumentary } from "./compositions/cinematic-documentary.jsx";
import { compositions as minimal } from "./compositions/minimal.jsx";
import { compositions as motionGraphics } from "./compositions/motion-graphics.jsx";

/**
 * Remotion entry point.
 * Registers all available compositions for rendering.
 */

function RemotionRoot() {
  return [
    ...cinematicDocumentary,
    ...minimal,
    ...motionGraphics,
  ];
}

registerRoot(RemotionRoot);
