import React from "react";
import { registerRoot, Composition, AbsoluteFill, staticFile } from "remotion";
import "../../../src/skills/remotion-render/wait-for-fonts.js";
import { ImageBeatScene, CaptionLayer, StatementScene } from "../../../src/skills/remotion-render/compositions/motion-graphics.jsx";
import { paletteFromHues } from "../../../src/skills/remotion-render/styles/tokens.js";

// Phase D-2 verification: the full-bleed background+scrim fallback
// (triggers whenever treat.js's classify() couldn't find a clean cutout
// subject — see motion-graphics.jsx's FULLBLEED_STAGE_* comment), shown
// WITH a real caption on top via the real, exported CaptionLayer (not a
// re-implementation), alongside a real cutout beat and a real
// typography-only (icon) beat on the SAME render to prove those two are
// unchanged: no gradient, same bounded stage box as before.
const COLORS = paletteFromHues({ accentHue: 149.6, bgMode: "white" });
const FPS = 30;

// A short, realistic caption page — same shape enrichPages()/mg-package.js
// produce: startFrame/endFrame + tokens[] (fromFrame/toFrame/text) + lines
// (token-array-per-line). One line, 4 words, evenly spaced.
function makeCaptionPage(words, msPerWord = 350) {
  let ms = 0;
  const tokens = words.map((text) => {
    const fromMs = ms;
    const toMs = ms + msPerWord;
    ms = toMs;
    return { text, fromMs, toMs, fromFrame: Math.round((fromMs / 1000) * FPS), toFrame: Math.round((toMs / 1000) * FPS) };
  });
  return {
    startFrame: 0,
    endFrame: Math.round((ms / 1000) * FPS) + 20,
    tokens,
    lines: [tokens],
  };
}

const CAPTION_PAGE = makeCaptionPage(["Deep-sea", "vents", "teem", "with", "life."]);

function FullbleedWithCaption() {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <ImageBeatScene
        beat={{ anchorFrame: 10, startFrame: 0 }}
        scene={{ image: "b-roll/ch-fixture/black-smoker.jpg", imageTreatment: "fullbleed", credit: "NOAA / Wikimedia Commons" }}
        colors={COLORS}
        fontFamily="Inter"
      />
      <CaptionLayer pages={[CAPTION_PAGE]} accentWindows={[]} colors={COLORS} fontFamily="Inter" />
    </AbsoluteFill>
  );
}

function CutoutUnchanged() {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <ImageBeatScene
        beat={{ anchorFrame: 10, startFrame: 0 }}
        scene={{
          image: "asset-library/ch-01/piggy-bank-savings-all-of-our-savings-to-the-homeland-0.png",
          imageTreatment: "cutout",
          credit: "Library of Congress",
        }}
        colors={COLORS}
        fontFamily="Inter"
      />
      <CaptionLayer pages={[CAPTION_PAGE]} accentWindows={[]} colors={COLORS} fontFamily="Inter" />
    </AbsoluteFill>
  );
}

function TypographyOnlyUnchanged() {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <StatementScene
        beat={{ anchorFrame: 10, startFrame: 0, scene: { isReveal: false } }}
        scene={{ icon: "activity", trace: false, iconIsSpecific: false }}
        colors={COLORS}
        fontFamily="Inter"
      />
      <CaptionLayer pages={[CAPTION_PAGE]} accentWindows={[]} colors={COLORS} fontFamily="Inter" />
    </AbsoluteFill>
  );
}

export const RemotionRoot = () => (
  <>
    <Composition id="fallback-fullbleed-caption" component={FullbleedWithCaption} durationInFrames={90} fps={FPS} width={1080} height={1920} />
    <Composition id="fallback-cutout-unchanged" component={CutoutUnchanged} durationInFrames={90} fps={FPS} width={1080} height={1920} />
    <Composition id="fallback-typography-unchanged" component={TypographyOnlyUnchanged} durationInFrames={90} fps={FPS} width={1080} height={1920} />
  </>
);

registerRoot(RemotionRoot);
