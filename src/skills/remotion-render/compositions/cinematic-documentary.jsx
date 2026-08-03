import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";
import { currentAudio } from "../audio.js";
import "../wait-for-fonts.js";
import { resolveColors, resolveFontFamily, moodFromVisualCue, moodFromContent, EndFadeToBlack } from "./visual.js";

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

/**
 * Light leak — a soft warm flare that flashes in at a section transition.
 * Spec: 5-12% intensity, transitions/key reveals ONLY, max 3-4 per video.
 * Plays once over ~0.7s at the start of the section it is mounted in.
 */
function LightLeak({ intensity = 0.08 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps) / 0.7;
  const opacity = t >= 1 ? 0 : Math.sin(t * Math.PI) * intensity;
  if (opacity <= 0.001) return null;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 78% 18%, rgba(255,182,90,${opacity}) 0%, rgba(255,140,60,${opacity * 0.5}) 35%, transparent 62%)`,
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Dramatic pacing: weights section lengths so the opening and resolution
 * breathe (slow cuts) while crisis/tension sections run fast.
 */
function computeLayout(durationInFrames, sections) {
  const n = Math.max(sections.length, 1);
  const weights = [];
  for (let i = 0; i < n; i++) {
    const s = sections[i] || {};
    if (i === 0) weights.push(1.25);
    else if (i === n - 1) weights.push(1.3);
    else {
      const cue = ((s.visualCue || "") + " " + (s.id || "")).toLowerCase();
      weights.push(/crisis|tension|outrage|climax|fast|accel/.test(cue) ? 0.8 : 1.0);
    }
  }
  const total = weights.reduce((a, b) => a + b, 0);
  const layout = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    layout.push({ from: acc, duration: Math.round((weights[i] / total) * durationInFrames) });
    acc += layout[i].duration;
  }
  layout[n - 1].duration = durationInFrames - layout[n - 1].from;
  return layout;
}

function AnimatedText({ text, delay = 0, style = {}, color, fontFamily, colors = COLORS }) {
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
        color: color || colors.textAccent,
        fontFamily: fontFamily || "Inter, sans-serif",
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

function DataOverlay({ value, label, delay = 0, colors = COLORS, fontFamily = "Inter, sans-serif" }) {
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
          color: colors.textAccent,
          fontFamily,
          fontWeight: 900,
          fontSize: 64,
          textShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: colors.textPrimary,
          fontFamily,
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

function KenBurnsImage({ src, direction = "in", durationInFrames = 150, opacity = 1, fit = "cover" }) {
  const frame = useCurrentFrame();

  // Spec: 0.5-2%/s zoom. Proportional to how long the shot is on screen.
  const zoom = Math.min(1.15, 1 + 0.015 * (durationInFrames / 30));
  const scale = interpolate(
    frame,
    [0, durationInFrames],
    direction === "in" ? [1, zoom] : [zoom, 1],
    { extrapolateRight: "clamp" }
  );

  const translateX = interpolate(
    frame,
    [0, durationInFrames],
    [0, direction === "left" ? -24 : direction === "right" ? 24 : 0],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: fit,
          transform: `scale(${scale}) translateX(${translateX}px)`,
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * B-roll layer — real sourced imagery per section, slow Ken Burns motion,
 * crossfaded between shots, tinted to the section's mood grade and darkened
 * top/bottom so captions stay readable. Falls back to nothing (gradient stays).
 */
function BrollLayer({ files = [], mood = "neutral", colors = COLORS }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  if (!files || files.length === 0) return null;

  const n = files.length;
  const chunk = Math.floor(durationInFrames / n);
  const fade = 12; // crossfade frames between shots

  const tints = {
    nostalgia: "rgba(212,168,83,0.18)",
    crisis: "rgba(16,42,70,0.45)",
    outrage: "rgba(139,26,26,0.28)",
    neutral: "rgba(0,0,0,0.28)",
  };

  return (
    <AbsoluteFill>
      {files.map((f, i) => {
        const start = i * chunk;
        const end = i === n - 1 ? durationInFrames : start + chunk;
        let opacity = 1;
        const rel = frame - start;
        if (rel < fade) opacity = rel / fade;
        if (i < n - 1 && end - frame < fade) opacity = Math.min(opacity, (end - frame) / fade);
        if (opacity <= 0) return null;
        return (
          <KenBurnsImage
            key={f}
            src={staticFile(f)}
            direction={i % 2 === 0 ? "in" : "out"}
            durationInFrames={end - start}
            opacity={opacity}
            fit={f.includes("cross-section") ? "contain" : "cover"}
          />
        );
      })}
      {/* Readability + grade: darken for captions, tint to the mood */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.15) 28%, rgba(0,0,0,0.15) 62%, rgba(0,0,0,0.78) 100%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{ backgroundColor: tints[mood] || tints.neutral, mixBlendMode: "multiply", pointerEvents: "none" }}
      />
    </AbsoluteFill>
  );
}

function SectionBackground({ mood = "neutral", children, colors = COLORS }) {
  const bgColors = {
    nostalgia: `linear-gradient(135deg, ${colors.bgDark} 0%, #2A1F0D 100%)`,
    crisis: `linear-gradient(135deg, ${colors.bgDark} 0%, ${colors.crisis} 100%)`,
    outrage: `linear-gradient(135deg, ${colors.bgDark} 0%, ${colors.outrage} 100%)`,
    neutral: `linear-gradient(135deg, ${colors.bgDark} 0%, ${colors.bgMid} 100%)`,
  };

  return (
    <AbsoluteFill style={{ background: bgColors[mood] || bgColors.neutral }}>
      {children}
    </AbsoluteFill>
  );
}

/**
 * Main CinematicDocumentary composition.
 * Props: { sections, thumbnailStyle, tone, font, palette }
 */
export function CinematicDocumentaryLongform({ sections = [], thumbnailStyle, ttsAudioPath, font = "Inter", palette = null }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);

  // Dramatic pacing: opening/resolution breathe, crisis sections run fast.
  const layout = computeLayout(durationInFrames, sections);

  const lastSection = sections[sections.length - 1];
  const fadeOut = Boolean(lastSection?.transitionOut?.toLowerCase().includes("fade"));

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>
      {sections.map((section, i) => {
        const { from: sectionStart, duration: sectionDuration } = layout[i];
        const moods = ["nostalgia", "neutral", "crisis", "outrage", "neutral"];
        const mood =
          moodFromVisualCue(section.visualCue) ||
          moodFromContent(section.voiceover, section.id) ||
          moods[i % moods.length];
        // Light leaks at a few key transitions only (spec: max 3-4 per video).
        const leak = i === 1 || i === 3;

        return (
          <Sequence
            key={i}
            from={sectionStart}
            durationInFrames={sectionDuration}
          >
            <SectionBackground mood={mood} colors={colors}>
              <BrollLayer files={section.bRollFiles} mood={mood} colors={colors} />
              {section.textOverlay ? (
                <div
                  style={{
                    position: "absolute",
                    top: 48,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    fontFamily,
                    fontWeight: 700,
                    fontSize: 26,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: colors.textAccent,
                    textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                    opacity: 0.9,
                  }}
                >
                  {section.textOverlay}
                </div>
              ) : null}

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
                    color={j === 0 ? colors.textAccent : colors.textPrimary}
                    colors={colors}
                    fontFamily={fontFamily}
                  />
                ))}
              </AbsoluteFill>

              {/* Overlays */}
              <FilmGrain opacity={mood === "crisis" ? 0.15 : 0.08} />
              <Vignette intensity={0.2} />
              {leak ? <LightLeak intensity={mood === "crisis" ? 0.1 : 0.07} /> : null}
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
          backgroundColor: colors.textAccent,
          width: `${(frame / durationInFrames) * 100}%`,
          opacity: 0.6,
        }}
      />
      <EndFadeToBlack active={fadeOut} />
      {ttsAudioPath ? <Audio src={currentAudio} /> : null}
    </AbsoluteFill>
  );
}

/**
 * Shorts composition (9:16, ~60s).
 * Same visual language, vertical format, faster pacing.
 */
export function CinematicDocumentaryShorts({ sections = [], thumbnailStyle, ttsAudioPath, font = "Inter", palette = null }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);

  const layout = computeLayout(durationInFrames, sections);

  const lastSection = sections[sections.length - 1];
  const fadeOut = Boolean(lastSection?.transitionOut?.toLowerCase().includes("fade"));

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>
      {sections.map((section, i) => {
        const { from: sectionStart, duration: sectionDuration } = layout[i];
        const moods = ["nostalgia", "crisis", "outrage"];
        const mood =
          moodFromVisualCue(section.visualCue) ||
          moodFromContent(section.voiceover, section.id) ||
          moods[i % moods.length];
        const leak = i === 1;

        return (
          <Sequence
            key={i}
            from={sectionStart}
            durationInFrames={sectionDuration}
          >
            <SectionBackground mood={mood} colors={colors}>
              <BrollLayer files={section.bRollFiles} mood={mood} colors={colors} />
              {section.textOverlay ? (
                <div
                  style={{
                    position: "absolute",
                    top: 28,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    fontFamily,
                    fontWeight: 700,
                    fontSize: 22,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: colors.textAccent,
                    textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                    opacity: 0.9,
                  }}
                >
                  {section.textOverlay}
                </div>
              ) : null}

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
                    color={j === 0 ? colors.textAccent : colors.textPrimary}
                    colors={colors}
                    fontFamily={fontFamily}
                  />
                ))}
              </AbsoluteFill>

              <FilmGrain opacity={0.1} />
              <Vignette intensity={0.25} />
              {leak ? <LightLeak intensity={0.08} /> : null}
            </SectionBackground>
          </Sequence>
        );
      })}
      <EndFadeToBlack active={fadeOut} />
      {ttsAudioPath ? <Audio src={currentAudio} /> : null}
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
