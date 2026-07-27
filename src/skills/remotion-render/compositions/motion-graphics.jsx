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
 * MotionGraphics — Long-form (16:9, ~8 min)
 *
 * Animated diagram/explainer style:
 * - Animated shapes and icons
 * - Data visualizations
 * - Flow diagrams
 * - Illustrated elements
 * - Smooth transitions
 */

const COLORS = {
  bgDark: "#0D1117",
  bgMid: "#1A1F2E",
  accent1: "#3B82F6",
  accent2: "#8B5CF6",
  accent3: "#EC4899",
  accent4: "#10B981",
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",
};

function AnimatedShape({ type = "circle", size = 100, color = COLORS.accent1, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 30, stiffness: 150 },
  });

  const rotation = interpolate(
    spring({ frame: frame - delay, fps, config: { damping: 50, stiffness: 100 } }),
    [0, 1],
    [0, 360]
  );

  const shapes = {
    circle: (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: color,
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          boxShadow: `0 8px 24px ${color}40`,
        }}
      />
    ),
    square: (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 16,
          backgroundColor: color,
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          boxShadow: `0 8px 24px ${color}40`,
        }}
      />
    ),
    triangle: (
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: `${size / 2}px solid transparent`,
          borderRight: `${size / 2}px solid transparent`,
          borderBottom: `${size}px solid ${color}`,
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          filter: `drop-shadow(0 8px 24px ${color}40)`,
        }}
      />
    ),
  };

  return shapes[type] || shapes.circle;
}

function FlowArrow({ delay = 0, direction = "right" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame: frame - delay,
    fps,
    config: { damping: 100, stiffness: 100 },
  });

  const translateX = interpolate(
    spring({ frame: frame - delay, fps, config: { damping: 50, stiffness: 100 } }),
    [0, 1],
    direction === "right" ? [-20, 20] : [20, -20]
  );

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${translateX}px)`,
        color: COLORS.accent1,
        fontSize: 48,
        fontWeight: 900,
      }}
    >
      {direction === "right" ? "→" : "←"}
    </div>
  );
}

function AnimatedChart({ data, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 16,
        height: 200,
      }}
    >
      {data.map((item, i) => {
        const height = spring({
          frame: frame - delay - i * 5,
          fps,
          config: { damping: 30, stiffness: 100 },
        });

        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 60,
                height: height * item.value * 2,
                backgroundColor: COLORS.accent1,
                borderRadius: 8,
                boxShadow: `0 4px 12px ${COLORS.accent1}40`,
              }}
            />
            <div
              style={{
                color: COLORS.textSecondary,
                fontSize: 14,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DiagramNode({ label, delay = 0, color = COLORS.accent1 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 30, stiffness: 150 },
  });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        backgroundColor: `${color}20`,
        border: `2px solid ${color}`,
        borderRadius: 12,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          color: COLORS.textPrimary,
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: 20,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function IllustratedSection({ title, description, delay = 0 }) {
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
    [30, 0]
  );

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        maxWidth: 800,
      }}
    >
      <div
        style={{
          color: COLORS.textPrimary,
          fontFamily: "Inter, sans-serif",
          fontWeight: 700,
          fontSize: 36,
          textAlign: "center",
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: COLORS.textSecondary,
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          fontSize: 24,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </div>
  );
}

function GraphicBackground({ index, children }) {
  const gradients = [
    `linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.accent1}15 100%)`,
    `linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.accent2}15 100%)`,
    `linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.accent3}15 100%)`,
    `linear-gradient(135deg, ${COLORS.bgDark} 0%, ${COLORS.accent4}15 100%)`,
  ];

  return (
    <AbsoluteFill style={{ background: gradients[index % gradients.length] }}>
      {children}
    </AbsoluteFill>
  );
}

/**
 * Main MotionGraphics composition.
 * Props: { sections, thumbnailStyle, tone }
 */
export function MotionGraphicsLongform({ sections = [], thumbnailStyle }) {
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
            <GraphicBackground index={i}>
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
                  <AnimatedShape
                    key={j}
                    type={j % 3 === 0 ? "circle" : j % 3 === 1 ? "square" : "triangle"}
                    size={j === 0 ? 120 : 80}
                    color={j === 0 ? COLORS.accent1 : COLORS.accent2}
                    delay={j * 15}
                  />
                ))}
              </AbsoluteFill>
            </GraphicBackground>
          </Sequence>
        );
      })}

      {/* Progress indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          color: COLORS.textSecondary,
          fontFamily: "Inter, sans-serif",
          fontSize: 14,
        }}
      >
        {Math.floor((frame / durationInFrames) * 100)}%
      </div>
    </AbsoluteFill>
  );
}

/**
 * Shorts composition (9:16, ~60s).
 * Same visual language, vertical format, faster pacing.
 */
export function MotionGraphicsShorts({ sections = [], thumbnailStyle }) {
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
            <GraphicBackground index={i}>
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
                  <AnimatedShape
                    key={j}
                    type={j % 3 === 0 ? "circle" : j % 3 === 1 ? "square" : "triangle"}
                    size={j === 0 ? 100 : 60}
                    color={j === 0 ? COLORS.accent1 : COLORS.accent2}
                    delay={j * 12}
                  />
                ))}
              </AbsoluteFill>
            </GraphicBackground>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "MotionGraphicsLongform",
    component: MotionGraphicsLongform,
    durationInFrames: 30 * 480, // 8 min at 30fps
    fps: 30,
    width: 1920,
    height: 1080,
  },
  {
    id: "MotionGraphicsShorts",
    component: MotionGraphicsShorts,
    durationInFrames: 30 * 60, // 60s at 30fps
    fps: 30,
    width: 1080,
    height: 1920,
  },
];
