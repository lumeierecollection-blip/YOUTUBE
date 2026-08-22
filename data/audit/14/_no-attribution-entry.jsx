import React from "react";
import { registerRoot, Composition, AbsoluteFill, Sequence } from "remotion";
import "../../../src/skills/remotion-render/wait-for-fonts.js";
import { ImageBeatScene } from "../../../src/skills/remotion-render/compositions/motion-graphics.jsx";
import { paletteFromHues } from "../../../src/skills/remotion-render/styles/tokens.js";

// Phase D, Part 1.1 verification: same real 3-provider beats as
// data/audit/12 (Library of Congress, Wikimedia, Met), through the SAME
// production ImageBeatScene, AFTER removing the on-screen rotated credit
// <span> from motion-graphics.jsx. data/audit/12's stills are the "before"
// (attribution visible) evidence; this directory's stills are "after".
const COLORS = paletteFromHues({ accentHue: 149.6, bgMode: "white" });

const BEATS = [
  {
    text: "Start small.",
    image: "asset-library/ch-01/piggy-bank-savings-all-of-our-savings-to-the-homeland-0.png",
    imageTreatment: "cutout",
    credit: "Library of Congress",
  },
  {
    // The original two Wikimedia/Met assets used here in audit/12 were
    // since pulled from the manifest (content-mismatch cleanup, see
    // CHECK-REGISTER.md AST-16) and their files no longer exist on disk —
    // swapped for the same b-roll fixtures data/audit/13 already confirmed
    // load correctly, so this still exercises 3 distinct real files/
    // providers for the attribution-removal check.
    text: "Debt piles up fast.",
    image: "b-roll/ch-fixture/cave-spider.jpg",
    imageTreatment: "fullbleed",
    credit: "Wikimedia Commons",
  },
  {
    text: "Every dollar has a job.",
    image: "b-roll/ch-fixture/black-smoker.jpg",
    imageTreatment: "fullbleed",
    credit: "NOAA / Wikimedia Commons",
  },
];

const BEAT_FRAMES = 75;

function Run() {
  return (
    <AbsoluteFill data-root style={{ backgroundColor: COLORS.bg }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={i * BEAT_FRAMES} durationInFrames={BEAT_FRAMES}>
          <ImageBeatScene
            beat={{ anchorFrame: 10, startFrame: 0 }}
            scene={{ image: b.image, imageTreatment: b.imageTreatment, credit: b.credit }}
            colors={COLORS}
            fontFamily="Inter"
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export const RemotionRoot = () => (
  <Composition id="no-attribution-demo" component={Run} durationInFrames={BEATS.length * BEAT_FRAMES} fps={30} width={1080} height={1920} />
);

registerRoot(RemotionRoot);
