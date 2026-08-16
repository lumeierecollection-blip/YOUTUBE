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
    // Derived roles object (styles/tokens.js paletteFromHues) — flat bg,
    // accent on shapes only. bgDark/bgMid collapse to the single flat bg;
    // there is no second background tone to grade toward.
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
 * Fades the whole frame to the channel's own flat bg over the final 20
 * frames — never a hardcoded black, so a white-mode channel fades to white,
 * not to a mismatched black flash.
 */
export function EndFadeToBlack({ active = false, color = "#000000" }) {
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
        backgroundColor: color,
        opacity: fade,
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
}
