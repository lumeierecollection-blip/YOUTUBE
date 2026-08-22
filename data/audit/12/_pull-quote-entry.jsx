import React from "react";
import { registerRoot, Composition, AbsoluteFill, useCurrentFrame } from "remotion";
import "../../../src/skills/remotion-render/wait-for-fonts.js";
import { PullQuote } from "../../../src/skills/remotion-render/beats/PullQuote.jsx";
import { paletteFromHues, hexToRgb } from "../../../src/skills/remotion-render/styles/tokens.js";

// White-mode palette, via the real derivation function (styles/tokens.js) —
// not hand-picked hex values. accentHue 149.6 is channel 1's (Money Mind,
// config/channels.json:13,51 — bg_mode "white", the same channel the
// existing HERO_NUMBER fixtures below use) real accentHue, so this demo
// matches an actual configured channel rather than an invented palette.
const COLORS = paletteFromHues({ accentHue: 149.6, bgMode: "white" });
const STAGE = { x: 48, y: 300, w: 984, h: 900 };

const WIRED = [
  {
    id: "pq-inter-digit",
    fontFamily: "Inter",
    text: "This one change quietly saved most families twelve thousand dollars",
  },
  {
    id: "pq-dmsans-no-digit",
    fontFamily: "DM Sans",
    text: "The plan quietly rebuilt the entire budget",
  },
];

const accentRgb = hexToRgb(COLORS.accent);
const ACCENT_CSS_RGB = `rgb(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b})`;

function Measure({ compId }) {
  React.useEffect(() => {
    const root = document.querySelector("[data-root]");
    const rr = root ? root.getBoundingClientRect() : { x: 0, y: 0 };
    const lines = Array.from(document.querySelectorAll('[data-role="pull-quote-line"]'));
    const spans = Array.from(document.querySelectorAll('[data-role="pull-quote-line"] span'));
    const accentSpans = spans.filter((s) => getComputedStyle(s).color === ACCENT_CSS_RGB);
    const wrapper = document.querySelector('[data-role="pull-quote"]');
    const rect = wrapper ? wrapper.getBoundingClientRect() : null;
    console.log(
      "PQ_MEASURE:" + compId + ":" +
        JSON.stringify({
          lineCount: lines.length,
          lineTexts: lines.map((l) => l.textContent),
          accentWordCount: accentSpans.length,
          accentWords: accentSpans.map((s) => s.textContent),
          wrapperBox: rect ? { x: rect.x - rr.x, y: rect.y - rr.y, w: rect.width, h: rect.height } : null,
          holdEndFrame: wrapper ? wrapper.getAttribute("data-hold-end") : null,
        })
    );
  }, []);
  return null;
}

function Run({ run }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill data-root style={{ backgroundColor: run.colors ? run.colors.bg : COLORS.bg }}>
      <PullQuote stage={STAGE} colors={COLORS} anchorFrame={10} frame={frame} text={run.text} fontFamily={run.fontFamily} />
      <Measure compId={run.id} />
    </AbsoluteFill>
  );
}

export const RemotionRoot = () => (
  <>
    {WIRED.map((run) => (
      <Composition
        key={run.id}
        id={run.id}
        component={Run}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ run }}
      />
    ))}
  </>
);

registerRoot(RemotionRoot);
