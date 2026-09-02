import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";
import { Audio } from "@remotion/media";
import { currentAudio } from "../audio.js";
import "../wait-for-fonts.js";
import { resolveColors, resolveFontFamily, EndFadeToBlack } from "./visual.js";

/**
 * CinematicDocumentary — Long-form (16:9, ~10 min)
 *
 * Sections animate through the script with:
 * - Flat, pure background (#FFFFFF or #000000 per channel bg_mode)
 * - Film grain overlay (texture, not colour)
 * - Ken Burns on real sourced stills
 * - Animated data overlays (accent on shapes/values, never on body text)
 * - Dramatic pacing cuts
 *
 * REBUILT for motion-graphics-rebuild-v2: mood-based colour grading
 * (nostalgia/crisis/outrage gradients), the radial-gradient vignette, and
 * the light-leak flare are all removed — PART 1/2 of the rebuild ban
 * gradients, radial glows, and tinted washes outright, and the mood system
 * (moodFromVisualCue/moodFromContent, formerly in visual.js) was exactly
 * that: a per-section colour wash picked from keyword-matched prose. See
 * CHECK-REGISTER.md DEL-22 / COL-22 ("no mood-based colour grading").
 */

const COLORS = {
  textPrimary: "#EBEBEB",
  textAccent: "#EBEBEB", // never used as a text colour default anymore — kept for callers that pass it through unchanged
  bgDark: "#000000",
  bgMid: "#000000",
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

/**
 * Dramatic pacing: weights section lengths so the opening and resolution
 * breathe (slow cuts) while crisis/tension sections run fast.
 *
 * MOT-01 — this used to be the ONLY input to section timing: a hardcoded
 * weight per section that never looked at how many words that section's
 * voiceover actually has, so a 20-word "crisis" section and a 150-word calm
 * one could get sized by the same 0.8x/1.0x multiplier — real risk of the
 * narration for one section still playing over another section's visuals.
 * `sectionWindows` (render.js's sectionFrameWindows: real SRT timing, or an
 * honest word-count-proportional split) is used directly when provided;
 * this dramatic-only layout is now only the last-resort fallback for a
 * caller that doesn't pass it (e.g. verify-compositions.js's fixtures).
 */
function computeLayout(durationInFrames, sections, sectionWindows) {
  if (sectionWindows && sectionWindows.length === sections.length) return sectionWindows;
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
        color: color || colors.textPrimary,
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
 * crossfaded between shots. Readability for text over the photo comes from
 * two FLAT solid bars (top/bottom, bg-coloured, opaque) sized to the actual
 * text zones — never a gradient scrim, never a mood tint (PART 1/2: no
 * gradients, no colour washes, photographic assets keep their own tone).
 */
function BrollLayer({ files = [], colors = COLORS }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  if (!files || files.length === 0) return null;

  const n = files.length;
  const chunk = Math.floor(durationInFrames / n);
  const fade = 12; // crossfade frames between shots

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
      {/* Readability: flat, opaque bars behind the text zones — not a gradient. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "22%", backgroundColor: colors.bgDark, opacity: 0.72 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "34%", backgroundColor: colors.bgDark, opacity: 0.8 }} />
    </AbsoluteFill>
  );
}

function SectionBackground({ children, colors = COLORS }) {
  return <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>{children}</AbsoluteFill>;
}

/**
 * Main CinematicDocumentary composition.
 * Props: { sections, thumbnailStyle, tone, font, palette }
 */
export function CinematicDocumentaryLongform({ sections = [], thumbnailStyle, ttsAudioPath, font = "Inter", palette = null, sectionWindows = null }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);

  // Dramatic pacing: opening/resolution breathe, crisis sections run fast.
  const layout = computeLayout(durationInFrames, sections, sectionWindows);

  const lastSection = sections[sections.length - 1];
  const fadeOut = Boolean(lastSection?.transitionOut?.toLowerCase().includes("fade"));

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>
      {sections.map((section, i) => {
        const { from: sectionStart, duration: sectionDuration } = layout[i];

        return (
          <Sequence
            key={i}
            from={sectionStart}
            durationInFrames={sectionDuration}
          >
            <SectionBackground colors={colors}>
              <BrollLayer files={section.bRollFiles} colors={colors} />
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
                    color: colors.textPrimary,
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
                    color={colors.textPrimary}
                    colors={colors}
                    fontFamily={fontFamily}
                  />
                ))}
              </AbsoluteFill>

              {/* Texture only — no vignette, no light leak, no mood grade. */}
              <FilmGrain opacity={0.08} />
            </SectionBackground>
          </Sequence>
        );
      })}

      {/* Global progress indicator — a shape, so the accent belongs here. */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 3,
          backgroundColor: colors.accent,
          width: `${(frame / durationInFrames) * 100}%`,
          opacity: 1,
        }}
      />
      <EndFadeToBlack active={fadeOut} color={colors.bg} />
      {ttsAudioPath ? <Audio src={currentAudio} /> : null}
    </AbsoluteFill>
  );
}

/**
 * Shorts composition (9:16, ~60s).
 * Same visual language, vertical format, faster pacing.
 */
export function CinematicDocumentaryShorts({ sections = [], thumbnailStyle, ttsAudioPath, font = "Inter", palette = null, sectionWindows = null }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);

  const layout = computeLayout(durationInFrames, sections, sectionWindows);

  const lastSection = sections[sections.length - 1];
  const fadeOut = Boolean(lastSection?.transitionOut?.toLowerCase().includes("fade"));

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>
      {sections.map((section, i) => {
        const { from: sectionStart, duration: sectionDuration } = layout[i];

        return (
          <Sequence
            key={i}
            from={sectionStart}
            durationInFrames={sectionDuration}
          >
            <SectionBackground colors={colors}>
              <BrollLayer files={section.bRollFiles} colors={colors} />
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
                    color: colors.textPrimary,
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
                    color={colors.textPrimary}
                    colors={colors}
                    fontFamily={fontFamily}
                  />
                ))}
              </AbsoluteFill>

              <FilmGrain opacity={0.1} />
            </SectionBackground>
          </Sequence>
        );
      })}
      <EndFadeToBlack active={fadeOut} color={colors.bg} />
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
