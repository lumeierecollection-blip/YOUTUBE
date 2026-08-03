import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { currentAudio } from "../audio.js";
import "../wait-for-fonts.js";
import { resolveColors, resolveFontFamily } from "./visual.js";

/**
 * MotionGraphics — geometric icon/scene animation style.
 * Shorts (9:16) and longform (16:9).
 * Props: { sections, ttsAudioPath, thumbnailStyle, tone, font, palette }
 */

const COLORS = {
  bg: "#0A1020",
  accent: "#22D3EE",
  accent2: "#EF4444",
  textPrimary: "#F8FAFC",
  textDim: "#94A3B8",
};

function GridBackground({ colors = COLORS }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shift = (frame / fps) * 20;

  const cells = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            left: `${c * 16.67}%`,
            top: `${r * 16.67}%`,
            width: "16.67%",
            height: "16.67%",
            border: `1px solid ${colors.accent}14`,
            boxSizing: "border-box",
          }}
        />
      );
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, overflow: "hidden" }}>
      {cells}
      <AbsoluteFill
        style={{
          transform: `translateY(${shift}px)`,
          opacity: 0.35,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            width: 260,
            height: 260,
            marginLeft: -130,
            marginTop: -130,
            borderRadius: 999,
            border: `3px solid ${colors.accent}`,
            boxShadow: `0 0 60px ${colors.accent}55`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "30%",
            width: 40,
            height: 40,
            transform: "rotate(45deg)",
            backgroundColor: colors.accent2,
            opacity: 0.8,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "55%",
            left: "62%",
            width: 24,
            height: 24,
            borderRadius: 999,
            backgroundColor: colors.accent,
            opacity: 0.9,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/**
 * Bold color wipe — full-screen accent sweep at section boundaries.
 * Spec: "Full-screen color wipes between sections" (Half as Interesting).
 */
function ColorWipe({ colors = COLORS, accent2 = false }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [0, Math.round(fps * 0.7)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const color = accent2 ? colors.accent2 : colors.accent;
  const x = interpolate(p, [0, 1], [-35, 135]);
  const fade = p >= 1 ? 0 : 1;
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: -100,
          bottom: -100,
          left: `${x}%`,
          width: "38%",
          background: `linear-gradient(90deg, transparent 0%, ${color} 30%, ${color} 55%, transparent 100%)`,
          transform: "skewX(-18deg)",
          opacity: fade * 0.65,
        }}
      />
    </AbsoluteFill>
  );
}

function AnimatedLine({ text, delay = 0, index = 0, colors = COLORS, fontFamily = "Oswald, 'Arial Narrow', sans-serif" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ frame: frame - delay, fps, config: { damping: 90, stiffness: 110 } });
  const x = interpolate(spring({ frame: frame - delay, fps, config: { damping: 70, stiffness: 90 } }), [0, 1], [-40, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${x}px)`,
        color: index === 0 ? colors.accent : colors.textPrimary,
        fontFamily,
        fontWeight: 900,
        fontSize: index === 0 ? 54 : 34,
        lineHeight: 1.25,
        textAlign: "left",
        textTransform: "uppercase",
        textShadow: "0 3px 10px rgba(0,0,0,0.5)",
        marginBottom: 16,
        maxWidth: "92%",
      }}
    >
      {text}
    </div>
  );
}

function VoiceoverAudio({ src }) {
  if (!src) return null;
  return <Audio src={src} />;
}

function MotionSections({ sections, accentFirst, colors = COLORS, fontFamily }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sectionDuration = Math.floor(durationInFrames / Math.max(sections.length, 1));

  return (
    <>
      {sections.map((section, i) => {
        const start = i * sectionDuration;
        const lines = (section.content || []).slice(0, 4);
        return (
          <Sequence key={i} from={start} durationInFrames={sectionDuration}>
            <GridBackground colors={colors} />
            {i > 0 ? <ColorWipe colors={colors} accent2={i % 2 === 0} /> : null}
            <AbsoluteFill
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: 48,
              }}
            >
              {lines.map((line, j) => (
                <AnimatedLine key={j} text={line} index={accentFirst && j === 0 ? 0 : j} delay={j * 12} colors={colors} fontFamily={fontFamily} />
              ))}
            </AbsoluteFill>
            <div
              style={{
                position: "absolute",
                left: 48,
                top: "50%",
                width: 6,
                height: 90,
                backgroundColor: colors.accent2,
                borderRadius: 4,
                transform: `translateY(-50%) scaleY(${0.6 + (frame / durationInFrames) * 0.8})`,
                transformOrigin: "center",
              }}
            />
          </Sequence>
        );
      })}
    </>
  );
}

export function MotionGraphicsShorts({ sections = [], ttsAudioPath, font = "Oswald", palette = null }) {
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <MotionSections sections={sections} accentFirst colors={colors} fontFamily={fontFamily} />
      <VoiceoverAudio src={ttsAudioPath ? currentAudio : null} />
    </AbsoluteFill>
  );
}

export function MotionGraphicsLongform({ sections = [], ttsAudioPath, font = "Oswald", palette = null }) {
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <MotionSections sections={sections} accentFirst colors={colors} fontFamily={fontFamily} />
      <VoiceoverAudio src={ttsAudioPath ? currentAudio : null} />
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "MotionGraphicsShorts",
    component: MotionGraphicsShorts,
    durationInFrames: 30 * 60,
    fps: 30,
    width: 1080,
    height: 1920,
  },
  {
    id: "MotionGraphicsLongform",
    component: MotionGraphicsLongform,
    durationInFrames: 30 * 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },
];
