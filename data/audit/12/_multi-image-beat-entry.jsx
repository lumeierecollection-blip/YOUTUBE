import React from "react";
import { registerRoot, Composition, AbsoluteFill, Sequence } from "remotion";
import "../../../src/skills/remotion-render/wait-for-fonts.js";
import { ImageBeatScene } from "../../../src/skills/remotion-render/compositions/motion-graphics.jsx";
import { paletteFromHues } from "../../../src/skills/remotion-render/styles/tokens.js";

// Real white-mode palette, same as this session's other demos.
const COLORS = paletteFromHues({ accentHue: 149.6, bgMode: "white" });

// Real assets fetched by build-asset-library.yml (run 32541446166) and
// committed to data/asset-library/index.json / public/asset-library/ch-01/
// — not fixtures, not placeholders. Rendered through the ACTUAL production
// ImageBeatScene (exported from motion-graphics.jsx for this probe; it was
// private before), not the unused standalone beats/ImageBeat.jsx this
// session's earlier "how does it look" demo mistakenly used instead.
const BEATS = [
  {
    text: "Start small.",
    image: "asset-library/ch-01/piggy-bank-savings-all-of-our-savings-to-the-homeland-0.png",
    imageTreatment: "cutout",
    credit: "Library of Congress",
  },
  {
    text: "Debt piles up fast.",
    image: "asset-library/ch-01/credit-card-debt-file-rid-of-credit-card-debt-3019181651-jpg-0.png",
    imageTreatment: "cutout",
    credit: "frankieleon via Wikimedia Commons",
  },
  {
    text: "Every dollar has a job.",
    image: "asset-library/ch-01/credit-card-debt-charity-1.jpg",
    imageTreatment: "fullbleed",
    credit: "Gift of Mr. and Mrs. Charles Wrightsman, 1974",
  },
];

const BEAT_FRAMES = 75; // 2.5s @ 30fps — enough to show the push-in settle plus a hold

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
  <Composition id="multi-image-beat-demo" component={Run} durationInFrames={BEATS.length * BEAT_FRAMES} fps={30} width={1080} height={1920} />
);

registerRoot(RemotionRoot);
