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

/**
 * Minimal — kinetic typography, clean background, synced captions.
 * Shorts (9:16) and longform (16:9).
 * Props: { sections, ttsAudioPath, thumbnailStyle, tone, font, palette }
 */

const COLORS = {
  bg: "#0D0D0F",
  accent: "#6366F1",
  text: "#FFFFFF",
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
        color: emphasis ? colors.accent : index === 0 ? colors.accent : colors.text,
        fontFamily: fontFamily || "'Space Grotesk', 'Helvetica Neue', sans-serif",
        fontWeight: emphasis ? 900 : 700,
        fontSize: emphasis ? 88 : index === 0 ? 64 : 40,
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
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${colors.bg} 0%, ${colors.bg} 55%, ${colors.accent}1a 160%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 18%, ${colors.accent}26 0%, transparent 55%)`,
        }}
      />
    </AbsoluteFill>
  );
}

function MinimalSections({ sections, colors = COLORS, fontFamily }) {
  const { fps, durationInFrames } = useVideoConfig();
  const sectionDuration = Math.floor(durationInFrames / Math.max(sections.length, 1));

  return (
    <>
      {sections.map((section, i) => {
        const start = i * sectionDuration;
        const lines = (section.content || []).slice(0, 5);
        const emphasize = i === 0 || lines.length <= 1;
        return (
          <Sequence key={i} from={start} durationInFrames={sectionDuration}>
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

export function MinimalShorts({ sections = [], ttsAudioPath, font = "Space Grotesk", palette = null }) {
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);
  return (
    <AbsoluteFill>
      <MinimalSections sections={sections} colors={colors} fontFamily={fontFamily} />
      {ttsAudioPath ? <Audio src={currentAudio} /> : null}
    </AbsoluteFill>
  );
}

export function MinimalLongform({ sections = [], ttsAudioPath, font = "Space Grotesk", palette = null }) {
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);
  return (
    <AbsoluteFill>
      <MinimalSections sections={sections} colors={colors} fontFamily={fontFamily} />
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
