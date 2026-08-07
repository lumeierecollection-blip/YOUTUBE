import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

/**
 * Shared visual helpers for the style compositions.
 * Threads per-channel visual specs (font + palette) into the templates and
 * gives them access to the script's per-section visual cues.
 */

export function resolveFontFamily(font) {
  if (!font) return "'Helvetica Neue', sans-serif";
  return `'${font}', 'Helvetica Neue', sans-serif`;
}

/**
 * Maps a channel palette ([bg, accent, text] from config/channels.json) onto
 * the style's semantic color roles. Falls back to the style defaults when the
 * channel has no palette.
 */
export function resolveColors(palette, fallback) {
  if (
    palette &&
    typeof palette === "object" &&
    !Array.isArray(palette) &&
    typeof palette.bg === "string" &&
    typeof palette.accent === "string"
  ) {
    // Stage-3 derived roles object (styles/tokens.js paletteFromHues).
    return {
      ...fallback,
      bgDark: palette.bg,
      bgMid: palette.bg,
      bg: palette.bg,
      accent: palette.accent,
      accent2: palette.accent,
      textAccent: palette.accent,
      textPrimary: palette.textPrimary,
      text: palette.textPrimary,
      textDim: palette.textDim ?? fallback.textDim,
      stroke: palette.stroke ?? fallback.stroke,
      surface: palette.surface ?? fallback.surface,
      raised: palette.raised ?? fallback.raised,
    };
  }
  if (Array.isArray(palette) && palette.length >= 3) {
    return {
      ...fallback,
      bgDark: palette[0],
      bgMid: palette[0],
      bg: palette[0],
      accent: palette[1],
      accent2: palette[1],
      textAccent: palette[1],
      textPrimary: palette[2],
      text: palette[2],
    };
  }
  return fallback;
}

/**
 * Picks a grading mood from the script's per-section visual_cue text.
 * Returns null when the cue does not imply a mood (caller falls back).
 * Word-boundary matched so e.g. "shots" never triggers "hot".
 */
export function moodFromVisualCue(cue) {
  if (!cue) return null;
  const c = String(cue).toLowerCase();
  if (/\b(warm|gold|golden|amber|sepia|sunset|sunlight|nostal\w*)\b/.test(c)) return "nostalgia";
  if (/\b(no\s+light)\b|\b(cool|blue|steel|cold|dark|black|night|neon|underwater|shadow|abyss|cave\w*|pale|bioluminescen\w*|deep\w*)\b/.test(c)) return "crisis";
  if (/\b(red|anger|angry|rage\w*|outrage\w*|fire|fiery|hot|blood)\b/.test(c)) return "outrage";
  return null;
}

/**
 * Content-based fallback mood: grades each section from what the voiceover
 * actually says (checking outrage -> crisis -> nostalgia in order), so the
 * color grade never contradicts the story. Returns "neutral" when nothing
 * matches instead of cycling through arbitrary moods.
 */
export function moodFromContent(voiceover, id) {
  const c = `${voiceover || ""} ${id || ""}`.toLowerCase();
  if (/\b(rage\w*|outrage\w*|anger|angry|scandal|collapse|abuse\w*|traged\w*|war|kill\w*|violen\w*|fraud|corrupt\w*)\b/.test(c)) return "outrage";
  if (/\b(no\s+light)\b|\b(dark\w*|deep\w*|underground|beneath|underwater|cave\w*|abyss\w*|shadow\w*|night\w*|black\w*|void|pressure|extreme)\b/.test(c)) return "crisis";
  if (/\b(warm|gold\w*|sun\w*|sunset|nostal\w*|childhood|histor\w*|sepia|amber)\b/.test(c)) return "nostalgia";
  return "neutral";
}

/** Fades the whole frame to black over the final 20 frames. */
export function EndFadeToBlack({ active = false }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!active) return null;
  const fade = interpolate(frame, [durationInFrames - 20, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (fade <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        opacity: fade,
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
}
