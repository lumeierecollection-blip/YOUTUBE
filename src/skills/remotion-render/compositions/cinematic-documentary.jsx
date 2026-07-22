import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
} from "remotion";

/**
 * CinematicDocumentary — Long-form (16:9, ~10 min)
 *
 * Sections animate through the script with:
 * - Warm golden grading for nostalgia
 * - Cold blue/steel for modern/crisis
 * - Film grain overlay
 * - Ken Burns on stills
 * - Animated data overlays
 * - Dramatic pacing cuts
 */

const COLORS = {
  nostalgia: "#D4A853",
  crisis: "#1A3A5C",
  outrage: "#8B1A1A",
  neutral: "#2A2A2A",
  textPrimary: "#FFFFFF",
  textAccent: "#C9A227",
  bgDark: "#0D1117",
  bgMid: "#1A1F2E",
};

function FilmGrain({ opacity = 0.1 }) {
  return (
    <AbsoluteFill
      style={{
        background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='${opacity}'/%3E%3C/svg%3E")`,
        mixBlendMode: "overlay",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}

function Vignette({ intensity = 0.2 }) {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${intensity}) 100%)`,
        pointerEvents: "none",
      }}
    />
  );
}

function AnimatedText({ text, delay = 0, style = {}, color = COLORS.textAccent }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame: frame - delay,
    fps,
    config: { damping: 100, stiffness: 100 },
  });

  const translateY = interpolate(
    spring({ frame: frame - delay, fps, config: { damping: 100, stiffness: 80 } }),
    [0, 1],
    [20, 0]
  );

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        color,
        fontFamily: "Inter, sans-serif",
        fontWeight: 900,
        fontSize: 72,
        textAlign: "center",
        textShadow: "0 4px 12px rgba(0,0,0,0.6)",
        ...style,
      }}
    >
      {text}
    </div>
  );
}

function DataOverlay({ value, label, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 50, stiffness: 200 },
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
          color: COLORS.textAccent,
          fontFamily: "Inter, sans-serif",
          fontWeight: 900,
          fontSize: 64,
          textShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: COLORS.textPrimary,
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          fontSize: 24,
          opacity: 0.8,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function KenBurnsImage({ src, direction = "in", durationInFrames = 150 }) {
  const frame = useCurrentFrame();

  const scale = interpolate(
    frame,
    [0, durationInFrames],
    direction === "in" ? [1, 1.15] : [1.15, 1],
    { extrapolateRight: "clamp" }
  );

  const translateX = interpolate(
    frame,
    [0, durationInFrames],
    [0, direction === "left" ? -30 : direction === "right" ? 30 : 0],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateX(${translateX}px)`,
        }}
      />
    </AbsoluteFill>
  );
}

function SectionBackground({ mood = "neutral", children }) {
  const bgColors = {
    nostalgia: `linear-gradient(135deg, ${COLORS.bgDark} 0%, #2A1F0D 100%)`,
    crisis: `linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.crisis} 100%)`,
    outrage: `linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.outrage} 100%)`,
    neutral: `linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.bgMid} 100%)`,
  };

  return (
    <AbsoluteFill style={{ background: bgColors[mood] || bgColors.neutral }}>
      {children}
    </AbsoluteFill>
  );
}

/**
 * Main CinematicDocumentary composition.
 * Props: { sections, thumbnailStyle, tone }
 */
export function CinematicDocumentaryLongform({ sections = [], thumbnailStyle }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Calculate section timing
  const sectionDuration = Math.floor(durationInFrames / Math.max(sections.length, 1));

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      {sections.map((section, i) => {
        const sectionStart = i * sectionDuration;
        const moods = ["nostalgia", "neutral", "crisis", "outrage", "neutral"];
        const mood = moods[i % moods.length];

        return (
          <Sequence
            key={i}
            from={sectionStart}
            durationInFrames={sectionDuration}
          >
            <SectionBackground mood={mood}>
              {/* Section content area */}
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
                  <AnimatedText
                    key={j}
                    text={line}
                    delay={j * 15}
                    style={{ fontSize: j === 0 ? 56 : 36, marginBottom: 20 }}
                    color={j === 0 ? COLORS.textAccent : COLORS.textPrimary}
                  />
                ))}
              </AbsoluteFill>

              {/* Overlays */}
              <FilmGrain opacity={mood === "crisis" ? 0.15 : 0.08} />
              <Vignette intensity={0.2} />
            </SectionBackground>
          </Sequence>
        );
      })}

      {/* Global progress indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 3,
          backgroundColor: COLORS.textAccent,
          width: `${(frame / durationInFrames) * 100}%`,
          opacity: 0.6,
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Shorts composition (9:16, ~60s).
 * Same visual language, vertical format, faster pacing.
 */
export function CinematicDocumentaryShorts({ sections = [], thumbnailStyle }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const sectionDuration = Math.floor(durationInFrames / Math.max(sections.length, 1));

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      {sections.map((section, i) => {
        const sectionStart = i * sectionDuration;
        const moods = ["nostalgia", "crisis", "outrage"];
        const mood = moods[i % moods.length];

        return (
          <Sequence
            key={i}
            from={sectionStart}
            durationInFrames={sectionDuration}
          >
            <SectionBackground mood={mood}>
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
                  <AnimatedText
                    key={j}
                    text={line}
                    delay={j * 10}
                    style={{
                      fontSize: j === 0 ? 48 : 32,
                      marginBottom: 16,
                      maxWidth: "90%",
                    }}
                    color={j === 0 ? COLORS.textAccent : COLORS.textPrimary}
                  />
                ))}
              </AbsoluteFill>

              <FilmGrain opacity={0.1} />
              <Vignette intensity={0.25} />
            </SectionBackground>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "CinematicDocumentaryLongform",
    component: CinematicDocumentaryLongform,
    durationInFrames: 30 * 600, // 10 min at 30fps
    fps: 30,
    width: 1920,
    height: 1080,
  },
  {
    id: "CinematicDocumentaryShorts",
    component: CinematicDocumentaryShorts,
    durationInFrames: 30 * 60, // 60s at 30fps
    fps: 30,
    width: 1080,
    height: 1920,
  },
];
