import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { Audio } from "@remotion/media";
import { currentAudio } from "../audio.js";
import "../wait-for-fonts.js";
import { resolveColors, resolveFontFamily } from "./visual.js";
import { MG_TYPE as TYPE } from "./beats.js";

/**
 * ONE TYPE SCALE FOR THE WHOLE SYSTEM.
 *
 * This style is pure kinetic typography, so the text IS the picture and
 * the sizes matter more here than anywhere else. They were hand-picked
 * (88/64/40) and the 40px step for continuation lines sat under
 * MG_TYPE.support, the 44px floor registered as TYP-04 in
 * CHECK-REGISTER.md and recorded there as failing.
 *
 * Imported from beats.js rather than restated, for the same reason
 * cinematic-documentary.jsx now does: three composition files were each
 * carrying their own numbers, which is how "no text below 44px" ends up
 * true in one style and false in the other two.
 */

/**
 * Minimal — kinetic typography, clean background, synced captions.
 * Shorts (9:16) and longform (16:9).
 * Props: { sections, ttsAudioPath, thumbnailStyle, tone, font, palette }
 */

// REBUILT for motion-graphics-rebuild-v2: the gradient background + radial
// accent glow are removed — PART 1 bans gradients and radial glows outright.
// Background is now flat #FFFFFF/#000000 per channel bg_mode; the accent no
// longer touches text (PART 2) — only the first line's emphasis is kept,
// recoloured to textPrimary.
const COLORS = {
  bg: "#000000",
  accent: "#6366F1",
  text: "#EBEBEB",
  dim: "#A1A1AA",
};

function AnimatedCaption({ text, delay = 0, index = 0, colors = COLORS, fontFamily, emphasis = false }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ frame: frame - delay, fps, config: { damping: 100, stiffness: 120 } });
  const y = interpolate(spring({ frame: frame - delay, fps, config: { damping: 90, stiffness: 100 } }), [0, 1], [24, 0]);
  const scale = emphasis
    ? interpolate(spring({ frame: frame - delay, fps, config: { damping: 80, stiffness: 90 } }), [0, 1], [0.9, 1])
    : 1;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        color: colors.text,
        fontFamily: fontFamily || "'Space Grotesk', 'Helvetica Neue', sans-serif",
        fontWeight: emphasis ? 900 : 700,
        // headline / caption / body — real steps off the shared scale, not
        // arithmetic on one. The old ladder was 88/64/40, and that 40px
        // continuation step sat under TYP-04's 44px floor.
        fontSize: emphasis ? TYPE.headline : index === 0 ? TYPE.caption : TYPE.body,
        lineHeight: 1.15,
        textAlign: "center",
        marginBottom: 20,
        maxWidth: "92%",
      }}
    >
      {text}
    </div>
  );
}

function MinimalBackground({ colors }) {
  return <AbsoluteFill style={{ backgroundColor: colors.bg }} />;
}

function MinimalSections({ sections, colors = COLORS, fontFamily, sectionWindows }) {
  const { durationInFrames } = useVideoConfig();
  // MOT-01 — real (or word-count-proportional) per-section windows from
  // render.js, replacing equal division by section count: a 10-word section
  // used to get exactly as much screen time as a 60-word one.
  const fallbackDuration = Math.floor(durationInFrames / Math.max(sections.length, 1));

  return (
    <>
      {sections.map((section, i) => {
        const window = sectionWindows && sectionWindows[i];
        const start = window ? window.from : i * fallbackDuration;
        const duration = window ? window.duration : fallbackDuration;
        const lines = (section.content || []).slice(0, 5);
        const emphasize = i === 0 || lines.length <= 1;
        return (
          <Sequence key={i} from={start} durationInFrames={duration}>
            <MinimalBackground colors={colors} />
            <AbsoluteFill
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: 40,
              }}
            >
              {lines.map((line, j) => (
                <AnimatedCaption
                  key={j}
                  text={line}
                  index={j}
                  delay={j * 10}
                  colors={colors}
                  fontFamily={fontFamily}
                  emphasis={emphasize && j === 0}
                />
              ))}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
}

export function MinimalShorts({ sections = [], ttsAudioPath, font = "Space Grotesk", palette = null, sectionWindows = null }) {
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);
  return (
    <AbsoluteFill>
      <MinimalSections sections={sections} colors={colors} fontFamily={fontFamily} sectionWindows={sectionWindows} />
      {ttsAudioPath ? <Audio src={currentAudio} /> : null}
    </AbsoluteFill>
  );
}

export function MinimalLongform({ sections = [], ttsAudioPath, font = "Space Grotesk", palette = null, sectionWindows = null }) {
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);
  return (
    <AbsoluteFill>
      <MinimalSections sections={sections} colors={colors} fontFamily={fontFamily} sectionWindows={sectionWindows} />
      {ttsAudioPath ? <Audio src={currentAudio} /> : null}
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "MinimalShorts",
    component: MinimalShorts,
    durationInFrames: 30 * 60,
    fps: 30,
    width: 1080,
    height: 1920,
  },
  {
    id: "MinimalLongform",
    component: MinimalLongform,
    durationInFrames: 30 * 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },
];
