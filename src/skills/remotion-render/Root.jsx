import { registerRoot } from "remotion";
import { compositions } from "./compositions/cinematic-documentary.jsx";

/**
 * Remotion entry point.
 * Registers all available compositions for rendering.
 */

function RemotionRoot() {
  return compositions;
}

registerRoot(RemotionRoot);
