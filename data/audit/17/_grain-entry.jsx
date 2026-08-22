import React from "react";
import { registerRoot, Composition } from "remotion";
import "../../../src/skills/remotion-render/wait-for-fonts.js";
import { MotionGraphicsShorts } from "../../../src/skills/remotion-render/compositions/motion-graphics.jsx";
import { paletteFromHues } from "../../../src/skills/remotion-render/styles/tokens.js";

// Real production Background layer (flat colour + dotGrid + CanvasGrain),
// mg=null so ONLY the background renders — exactly the "flat canvas,
// typography-only" scenario the grain/flatness verification is about.
// Two real channel palettes: white-mode and black-mode, since grain
// against a near-white vs near-black base is visually asymmetric.
const WHITE_PALETTE = paletteFromHues({ accentHue: 149.6, bgMode: "white" });
const BLACK_PALETTE = paletteFromHues({ accentHue: 149.6, bgMode: "black" });

export const RemotionRoot = () => (
  <>
    <Composition
      id="grain-white"
      component={MotionGraphicsShorts}
      durationInFrames={30}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ mg: null, palette: WHITE_PALETTE, font: "Inter" }}
    />
    <Composition
      id="grain-black"
      component={MotionGraphicsShorts}
      durationInFrames={30}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ mg: null, palette: BLACK_PALETTE, font: "Inter" }}
    />
  </>
);

registerRoot(RemotionRoot);
