import React from "react";
import { registerRoot, Composition, AbsoluteFill, staticFile } from "remotion";
import { PhotoTreatment } from "../../../src/skills/remotion-render/effects/PhotoTreatment.jsx";

const STAGE = { x: 48, y: 392, w: 840, h: 548 };

// Real, already-committed assets from three different original providers,
// to check the SAME grade recipe reads as one consistent piece across
// sources (vox-style-treatment SKILL.md's explicit ask), not to check
// content relevance (already covered in data/audit/12) — cutout treatment
// only, since that's the one asset that survived review; two other real
// b-roll fixture photos (different provider, Wikimedia via the ch-fixture
// manifest) stand in as the 2nd/3rd source for this specific check.
const RUNS = [
  { id: "pt-piggybank-cutout", src: "asset-library/ch-01/piggy-bank-savings-all-of-our-savings-to-the-homeland-0.png", treatment: "cutout" },
  { id: "pt-cavespider-cutout", src: "b-roll/ch-fixture/cave-spider.jpg", treatment: "fullbleed" },
  { id: "pt-blacksmoker-fullbleed", src: "b-roll/ch-fixture/black-smoker.jpg", treatment: "fullbleed" },
];

function Run({ run }) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF" }}>
      <div style={{ position: "absolute", left: STAGE.x, top: STAGE.y, width: STAGE.w, height: STAGE.h, overflow: "visible" }}>
        <PhotoTreatment src={staticFile(run.src)} treatment={run.treatment} width={STAGE.w} height={STAGE.h} />
      </div>
    </AbsoluteFill>
  );
}

export const RemotionRoot = () => (
  <>
    {RUNS.map((run) => (
      <Composition key={run.id} id={run.id} component={Run} durationInFrames={60} fps={30} width={1080} height={1920} defaultProps={{ run }} />
    ))}
  </>
);

registerRoot(RemotionRoot);
