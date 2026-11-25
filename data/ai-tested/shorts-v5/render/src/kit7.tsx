import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadSans } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

// Reference type system (REFERENCE-ANALYSIS.md section 3): italic display serif for narration,
// heavy grotesque for keywords, mono only for micro labels.
const serif = loadSerif("italic", { weights: ["400"] });
export const F = { serif: serif.fontFamily, sans: loadSans().fontFamily, mono: loadMono().fontFamily };

// Reference palette (REFERENCE-ANALYSIS.md section 2). Nothing else is allowed.
export const C = {
  paper: "#DADCD9",
  ink: "#111111",
  black: "#030403",
  char: "#242421",
  bars: { yellow: "#E4F23A", blue: "#1018E0", cyan: "#38D8C0", red: "#D01818" } as Record<string, string>,
  termGlow: "#8FF0F0",
};
export const CANVAS = { w: 1080, h: 1920 };

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const asset = (p?: string): string | null => {
  if (!p) return null;
  if (/^(https?:|data:)/.test(p)) return p;
  return staticFile(p.replace(/^\/+/, ""));
};
export const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const useT = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { f, fps, t: f / fps };
};

export type Plate = "paper" | "dark" | "char";
export const plateColor = (p: Plate) => (p === "paper" ? C.paper : p === "dark" ? C.black : C.char);

/** Paper or dark ground with the vertical scanline texture and a soft centre vignette. */
export const Ground: React.FC<{ plate: Plate }> = ({ plate }) => {
  const dark = plate !== "paper";
  return <AbsoluteFill style={{ background: plateColor(plate) }}>
    <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(90deg, ${dark ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)"} 0 1px, transparent 1px 4.5px)` }} />
    <AbsoluteFill style={{ background: dark ? "radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.35) 100%)" : "radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.28) 0%, rgba(0,0,0,0.10) 100%)" }} />
  </AbsoluteFill>;
};

/** Whole-frame CRT feel drawn over everything: scanlines and a faint flicker. */
export const Crt: React.FC = () => {
  const { f } = useT();
  return <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "multiply", opacity: 0.55, backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0 1px, transparent 1px 3px)", transform: `translateY(${(f % 3)}px)` }} />;
};

/** Horizontal-slice tear plus RGB split. Used as the entry of a picture or a whole beat. */
export const Glitch: React.FC<{ frames: number; children: React.ReactNode; slices?: number; amp?: number; seed?: number }> = ({ frames, children, slices = 7, amp = 90, seed = 1 }) => {
  const { f } = useT();
  if (f >= frames) return <>{children}</>;
  const k = 1 - f / frames;
  const bands = Array.from({ length: slices }, (_, i) => {
    const y0 = (i / slices) * 100, y1 = ((i + 1) / slices) * 100;
    const dx = (rnd(f * 13 + i * 7 + seed) - 0.5) * 2 * amp * k;
    return <div key={i} style={{ position: "absolute", inset: 0, clipPath: `inset(${y0}% 0 ${100 - y1}% 0)`, transform: `translateX(${dx}px)`, filter: `drop-shadow(${10 * k}px 0 0 rgba(255,0,60,0.55)) drop-shadow(${-10 * k}px 0 0 rgba(0,230,255,0.55))` }}>{children}</div>;
  });
  const bar = rnd(f * 3 + seed) > 0.5 ? <div style={{ position: "absolute", left: 0, right: 0, top: `${rnd(f + seed) * 90}%`, height: 14 + rnd(f * 5) * 40, background: dark(f), mixBlendMode: "difference" }} /> : null;
  return <AbsoluteFill>{bands}{bar}</AbsoluteFill>;
};
const dark = (f: number) => (f % 2 ? "#fff" : "#000");

export const Pic: React.FC<{ src: string; style?: React.CSSProperties; fit?: "cover" | "contain" }> = ({ src, style, fit = "cover" }) => {
  const s = asset(src);
  return s ? <Img src={s} style={{ width: "100%", height: "100%", objectFit: fit, display: "block", ...style }} /> : null;
};

export const lerp = interpolate;
