import React from "react";
import { registerRoot, Composition, AbsoluteFill, useCurrentFrame } from "remotion";
import "../../../src/skills/remotion-render/wait-for-fonts.js";
import { ImageBeat } from "../../../src/skills/remotion-render/beats/ImageBeat.jsx";
import { paletteFromHues } from "../../../src/skills/remotion-render/styles/tokens.js";

// Same real white-mode palette as the pull-quote demo (channel 1 Money
// Mind's actual accentHue) for consistency across this session's evidence.
const COLORS = paletteFromHues({ accentHue: 149.6, bgMode: "white" });

// Same stage rect ImageBeat.jsx's own docstring cites (claim 9-07: "48,392,
// 840,548 — the stage slot IS the image slot").
const STAGE = { x: 48, y: 392, w: 840, h: 548 };

// A REAL, already-committed fixture photo (src/skills/remotion-render/
// b-roll-manifest-ch-fixture.json) — not an Openverse fetch, since every
// asset-sourcing host (NASA/Met/Wikimedia/Openverse/LOC) returned a
// connection failure from this sandbox's egress proxy when tested just
// before this file was written (curl HTTP 000 on all five). Public domain,
// real attribution from the manifest, sourced via Wikimedia originally —
// this demonstrates the SAME ImageBeat render path any Openverse-fetched
// photo would go through once fetch-library.js could actually reach a host.
function Run() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill data-root style={{ backgroundColor: COLORS.bg }}>
      <ImageBeat
        stage={STAGE}
        colors={COLORS}
        anchorFrame={10}
        frame={frame}
        src="b-roll/ch-fixture/cave-entrance.jpg"
        credit="Brady Smith / US Forest Service, Coconino National Forest"
      />
    </AbsoluteFill>
  );
}

export const RemotionRoot = () => (
  <Composition id="image-beat-demo" component={Run} durationInFrames={90} fps={30} width={1080} height={1920} />
);

registerRoot(RemotionRoot);
