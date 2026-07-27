import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

/**
 * Minimal — Long-form (16:9, ~8 min)
 *
 * Kinetic typography style:
 * - Clean backgrounds with color shifts
 * - Word-by-word text animation
 * - Bold, large typography
 * - Minimal visual elements
 * - Fast pacing
 */

const COLORS = {
  bgDark: "#0F172A",
  bgMid: "#1E293B",
  bgLight: "#334155",
  accent1: "#22C55E",
  accent2: "#3B82F6",
  accent3: "#F59E0B",
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",
};

const BG_COLORS = [
  COLORS.bgDark,
  "#1A1F2E",
  "#0D1117",
  "#1E293B",
  "#0A1020",
  "#1A1A2E",
];

function AnimatedWord({ text, delay = 0, color = COLORS.accent1 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame: frame - delay,
    fps,
    config: { damping: 100, stiffness: 120 },
  });

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 50, stiffness: 200 },
  });

  return (
    <span
      style={{
        opacity,
        transform: `scale(${scale})`,
        color,
        fontFamily: "Inter, sans-serif",
        fontWeight: 900,
        display: "inline-block",
        marginRight: 12,
      }}
    >
      {text}
    </span>
  );
}

function KineticText({ text, delay = 0, fontSize = 72 }) {
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 8,
        maxWidth: "90%",
      }}
    >
      {words.map((word, i) => (
        <AnimatedWord
          key={i}
          text={word}
          delay={delay + i * 3}
          color={i % 2 === 0 ? COLORS.textPrimary : COLORS.accent1}
        />
      ))}
    </div>
  );
}

function StatDisplay({ value, label, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 30, stiffness: 200 },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          color: COLORS.accent1,
          fontFamily: "Inter, sans-serif",
          fontWeight: 900,
          fontSize: 96,
          textShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: COLORS.textSecondary,
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          fontSize: 28,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ColorShiftBackground({ index, children }) {
  const bgColor = BG_COLORS[index % BG_COLORS.length];

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${bgColor} 0%, ${COLORS.bgMid} 100%)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

/**
 * Main Minimal composition.
 * Props: { sections, thumbnailStyle, tone }
 */
export function MinimalLongform({ sections = [], thumbnailStyle }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const sectionDuration = Math.floor(durationInFrames / Math.max(sections.length, 1));

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      {sections.map((section, i) => {
        const sectionStart = i * sectionDuration;

        return (
          <Sequence
            key={i}
            from={sectionStart}
            durationInFrames={sectionDuration}
          >
            <ColorShiftBackground index={i}>
              <AbsoluteFill
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 80,
                }}
              >
                {section.content?.map((line, j) => (
                  <KineticText
                    key={j}
                    text={line}
                    delay={j * 10}
                    fontSize={j === 0 ? 72 : 48}
                  />
                ))}
              </AbsoluteFill>
            </ColorShiftBackground>
          </Sequence>
        );
      })}

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 4,
          backgroundColor: COLORS.accent1,
          width: `${(frame / durationInFrames) * 100}%`,
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Shorts composition (9:16, ~60s).
 * Same visual language, vertical format, faster pacing.
 */
export function MinimalShorts({ sections = [], thumbnailStyle }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const sectionDuration = Math.floor(durationInFrames / Math.max(sections.length, 1));

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      {sections.map((section, i) => {
        const sectionStart = i * sectionDuration;

        return (
          <Sequence
            key={i}
            from={sectionStart}
            durationInFrames={sectionDuration}
          >
            <ColorShiftBackground index={i}>
              <AbsoluteFill
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 40,
                }}
              >
                {section.content?.map((line, j) => (
                  <KineticText
                    key={j}
                    text={line}
                    delay={j * 8}
                    fontSize={j === 0 ? 56 : 36}
                  />
                ))}
              </AbsoluteFill>
            </ColorShiftBackground>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "MinimalLongform",
    component: MinimalLongform,
    durationInFrames: 30 * 480, // 8 min at 30fps
    fps: 30,
    width: 1920,
    height: 1080,
  },
  {
    id: "MinimalShorts",
    component: MinimalShorts,
    durationInFrames: 30 * 60, // 60s at 30fps
    fps: 30,
    width: 1080,
    height: 1920,
  },
];
