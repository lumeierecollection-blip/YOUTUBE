import React from "react";
import { registerRoot, Composition, AbsoluteFill, staticFile } from "remotion";
import { PhotoTreatment } from "../../../src/skills/remotion-render/effects/PhotoTreatment.jsx";

// Verification probe for a reported full-bleed letterboxing bug — isolates
// the cover-fit math with NO scrim, NO caption, at the EXACT real
// production fullbleed box (1080 x 898, motion-graphics.jsx's
// FULLBLEED_STAGE_*), against a magenta canvas with a lime outline around
// the stage box so ANY letterbox gap is unmistakable (a scrim fading to
// the channel's bg color could otherwise mask a real gap as an
// intentional fade — see render-cover-fit.mjs's header for why this
// probe deliberately excludes the scrim).
const STAGE = { x: 0, y: 392, w: 1080, h: 898 };

const RUNS = [
  { id: "cover-fit-cavespider", src: "b-roll/ch-fixture/cave-spider.jpg" }, // real fixture, aspect 1.125
  { id: "cover-fit-blacksmoker", src: "b-roll/ch-fixture/black-smoker.jpg" }, // real fixture, aspect 1.333 (box aspect = 1.203)
  { id: "cover-fit-wide", src: "_probe-fixtures/wide-fixture.jpg" }, // synthetic 4.5:1, stress-tests extreme wide
  { id: "cover-fit-tall", src: "_probe-fixtures/tall-fixture.jpg" }, // synthetic 1:4.5, stress-tests extreme tall
];

function Run({ run }) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#FF00FF" }}>
      <div style={{ position: "absolute", left: STAGE.x, top: STAGE.y, width: STAGE.w, height: STAGE.h, outline: "4px solid lime" }}>
        <PhotoTreatment src={staticFile(run.src)} treatment="fullbleed" width={STAGE.w} height={STAGE.h} />
      </div>
    </AbsoluteFill>
  );
}

export const RemotionRoot = () => (
  <>
    {RUNS.map((run) => (
      <Composition key={run.id} id={run.id} component={Run} durationInFrames={30} fps={30} width={1080} height={1920} defaultProps={{ run }} />
    ))}
  </>
);

registerRoot(RemotionRoot);
