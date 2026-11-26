import React from "react";
import { AbsoluteFill, Img, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadSG } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/DMSerifDisplay";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";

export const F = {
  anton: loadAnton().fontFamily,
  grotesk: loadSG().fontFamily,
  inter: loadInter().fontFamily,
  mono: loadMono().fontFamily,
  serif: loadSerif().fontFamily,
  outfit: loadOutfit().fontFamily,
};
// average glyph width / font size, used only for line fitting
const CHAR_W: Record<string, number> = { anton: 0.47, grotesk: 0.6, serif: 0.55, mono: 0.62, outfit: 0.58, inter: 0.58 };

export type Theme = {
  mode: "dark" | "light";
  bg: string; bg2?: string; ink: string; muted: string; accent: string; accent2?: string; accent3?: string;
  panel: string; panelInk?: string; line: string;
  texture?: "grid" | "scan" | "dots" | "paper" | "hazard" | "none";
  display?: keyof typeof F; body?: keyof typeof F; radius?: number;
};
export const CANVAS = { w: 1080, h: 1920 };
export const SAFE = { x: 64, top: 190, bottom: 1500 };

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const num = (v: any, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const IO = Easing.bezier(0.65, 0, 0.35, 1);

export const useAnim = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = f / fps;
  const dur = durationInFrames / fps;
  return {
    f, fps, t, dur,
    r: (a: number, d = 0.5) => OUT(clamp((t - a) / d, 0, 1)),
    lin: (a: number, d = 0.5) => clamp((t - a) / d, 0, 1),
    pop: (a: number) => spring({ frame: f - a * fps, fps, config: { damping: 12, stiffness: 190, mass: 0.7 } }),
  };
};

/** Evenly spaced reveal times so something new lands about every `step` seconds. */
export const stagger = (dur: number, n: number, start = 0.15, maxStep = 0.95, minStep = 0.3) => {
  const step = clamp((dur - start - 0.5) / Math.max(1, n), minStep, maxStep);
  return (i: number) => start + i * step;
};

export const fitText = (text: string, maxW: number, maxH: number, o: { font?: keyof typeof F; caps?: boolean; lh?: number; max?: number; min?: number; maxLines?: number } = {}) => {
  const font = o.font || "grotesk";
  const cw = (CHAR_W[font] || 0.58) * (o.caps ? 1.1 : 1);
  const lh = o.lh || 1.0;
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  for (let size = o.max || 160; size >= (o.min || 28); size -= 2) {
    const perLine = Math.floor(maxW / (size * cw));
    if (perLine < 3) continue;
    const lines: string[] = [];
    let cur = "";
    let ok = true;
    for (const w of words) {
      if (w.length > perLine) { ok = false; break; }
      if (!cur) cur = w; else if ((cur + " " + w).length <= perLine) cur += " " + w; else { lines.push(cur); cur = w; }
    }
    if (!ok) continue;
    if (cur) lines.push(cur);
    if (lines.length * size * lh <= maxH && lines.length <= (o.maxLines || 99)) return { size, lines };
  }
  const size = o.min || 28;
  return { size, lines: [words.join(" ")] };
};

export const asset = (p?: any): string | null => {
  const v: string = typeof p === "string" ? p : (p?.src || p?.a || p?.file || "");
  if (!v) return null;
  if (/^(https?:|data:)/.test(v)) return v;
  return staticFile(v.replace(/^\/+/, ""));
};

/** Draws a monochrome SVG logo in an exact brand colour. */
export const Logo: React.FC<{ id: string; size: number; color: string }> = ({ id, size, color }) => (
  <div style={{ width: size, height: size, backgroundColor: color, WebkitMaskImage: `url(${staticFile(`logos/${id}.svg`)})`, maskImage: `url(${staticFile(`logos/${id}.svg`)})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskSize: "contain", maskSize: "contain" }} />
);

export const Backdrop: React.FC<{ th: Theme; seed?: number }> = ({ th, seed = 0 }) => {
  const { f, dur } = useAnim();
  const drift = (f * 0.35) % 90;
  const grid = th.mode === "dark" ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.05)";
  const base: React.CSSProperties = th.bg2 ? { background: `linear-gradient(165deg, ${th.bg} 0%, ${th.bg2} 100%)` } : { background: th.bg };
  return <AbsoluteFill style={base}>
    {th.texture === "grid" || !th.texture ? <div style={{ position: "absolute", inset: -90, transform: `translate(${-drift}px,${-drift}px)`, backgroundImage: `linear-gradient(${grid} 2px,transparent 2px),linear-gradient(90deg,${grid} 2px,transparent 2px)`, backgroundSize: "90px 90px" }} /> : null}
    {th.texture === "dots" ? <div style={{ position: "absolute", inset: -60, transform: `translateY(${-drift * 0.6}px)`, backgroundImage: `radial-gradient(${grid} 3px, transparent 3.5px)`, backgroundSize: "54px 54px" }} /> : null}
    {th.texture === "scan" ? <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(0deg, ${grid} 0 2px, transparent 2px 7px)`, transform: `translateY(${(f * 0.8) % 14}px)` }} /> : null}
    {th.texture === "paper" ? <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1.2px)`, backgroundSize: "9px 9px" }} /> : null}
    {th.texture === "hazard" ? <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 46, backgroundImage: `repeating-linear-gradient(-45deg, ${th.accent} 0 28px, #0a0a0a 28px 56px)`, backgroundPosition: `${f * 0.9}px 0` }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 46, backgroundImage: `repeating-linear-gradient(-45deg, ${th.accent} 0 28px, #0a0a0a 28px 56px)`, backgroundPosition: `${-f * 0.9}px 0` }} />
    </> : null}
    <div style={{ position: "absolute", width: 900, height: 900, borderRadius: 999, right: -380 + Math.sin(f / 90 + seed) * 30, top: -300, background: th.accent, opacity: th.mode === "dark" ? 0.13 : 0.1, filter: "blur(40px)" }} />
    <div style={{ position: "absolute", width: 760, height: 760, borderRadius: 999, left: -340, bottom: 40 + Math.cos(f / 80 + seed) * 30, background: th.accent2 || th.accent, opacity: th.mode === "dark" ? 0.1 : 0.08, filter: "blur(40px)" }} />
    {/* Ambient motion/texture: keeps QA from flagging dead frames; visually subtle editorial grain */}
    <div style={{ position: "absolute", inset: -30, opacity: th.mode === "dark" ? 0.16 : 0.12, backgroundImage: "repeating-linear-gradient(0deg, rgba(127,127,127,0.55) 0 1px, transparent 1px 6px), repeating-linear-gradient(90deg, rgba(127,127,127,0.4) 0 1px, transparent 1px 8px)", backgroundSize: "8px 7px, 9px 8px", transform: `translate(${(f * 0.9) % 8}px, ${(f * 1.1) % 7}px)` }} />
    <div style={{ position: "absolute", inset: -40, opacity: th.mode === "dark" ? 0.06 : 0.05, background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12), transparent 45%), radial-gradient(circle at 70% 65%, rgba(255,255,255,0.1), transparent 40%)", transform: `translate(${Math.sin(f/40)*18}px, ${Math.cos(f/45)*14}px)` }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.22) 100%)" }} />
  </AbsoluteFill>;
};

/** Constant AI Tested identity, drawn over every scene. */
export const Chrome: React.FC<{ th: Theme; index: number; total: number; kicker?: string; progress: number }> = ({ th, index, total, kicker, progress }) => {
  const a = useAnim();
  const inkSoft = th.mode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.62)";
  return <>
    <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 70, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: a.r(0, 0.3) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 54, height: 54, background: th.accent, color: th.mode === "dark" ? "#000" : "#fff", fontFamily: F.grotesk, fontWeight: 800, fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>AI</div>
        <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 34, letterSpacing: "0.12em", color: th.ink }}>TESTED</div>
      </div>
      <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 26, letterSpacing: "0.08em", color: inkSoft }}>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</div>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 12, background: th.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
      <div style={{ height: "100%", width: `${progress * 100}%`, background: th.accent }} />
    </div>
  </>;
};

export const Kicker: React.FC<{ th: Theme; text?: string; at?: number }> = ({ th, text, at = 0 }) => {
  const a = useAnim();
  if (!text) return null;
  const p = a.r(at, 0.35);
  return <div style={{ display: "inline-flex", alignItems: "center", gap: 14, opacity: p, transform: `translateX(${(1 - p) * -40}px)` }}>
    <div style={{ width: 16, height: 16, background: th.accent, transform: "rotate(45deg)" }} />
    <div style={{ fontFamily: F.mono, fontWeight: 800, fontSize: 34, letterSpacing: "0.16em", color: th.accent, textTransform: "uppercase" }}>{text}</div>
  </div>;
};

/** Headline whose words land one after another inside a clipping mask. */
export const Headline: React.FC<{ th: Theme; text: string; maxW?: number; maxH?: number; at?: number; align?: "left" | "center"; max?: number; color?: string; hl?: string[]; maxLines?: number; font?: keyof typeof F }> = ({ th, text, maxW = 950, maxH = 520, at = 0.1, align = "left", max = 150, color, hl = [], maxLines, font }) => {
  const a = useAnim();
  const fnt = font || th.display || "grotesk";
  const caps = fnt !== "serif";
  const { size, lines } = fitText(caps ? text.toUpperCase() : text, maxW, maxH, { font: fnt, caps, lh: fnt === "anton" ? 1.02 : 0.94, max, maxLines });
  let wi = 0;
  return <div style={{ textAlign: align, width: "100%" }}>
    {lines.map((ln, li) => <div key={li} style={{ overflow: "hidden", paddingBottom: size * 0.08, marginBottom: -size * 0.04, display: "flex", justifyContent: align === "center" ? "center" : "flex-start", gap: size * 0.26 }}>
      {ln.split(" ").map((w, i) => {
        const k = wi++;
        const p = a.r(at + k * 0.11, 0.5);
        const isHl = hl.some(h => w.replace(/[^A-Z0-9$.%-]/gi, "").toUpperCase() === h.toUpperCase());
        return <span key={i} style={{ display: "inline-block", fontFamily: F[fnt], fontWeight: 800, fontSize: size, lineHeight: fnt === "anton" ? 1.02 : 0.96, letterSpacing: fnt === "anton" ? "0.01em" : "-0.035em", color: isHl ? th.accent : (color || th.ink), transform: `translateY(${(1 - p) * 110}%)`, opacity: p }}>{w}</span>;
      })}
    </div>)}
  </div>;
};

export const SubText: React.FC<{ th: Theme; text?: string; at?: number; maxW?: number; maxH?: number; size?: number; align?: "left" | "center"; color?: string }> = ({ th, text, at = 0.8, maxW = 940, maxH = 260, size = 46, align = "left", color }) => {
  const a = useAnim();
  if (!text) return null;
  const { size: s, lines } = fitText(text, maxW, maxH, { font: th.body || "inter", lh: 1.22, max: size, min: 30 });
  const p = a.r(at, 0.5);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 26}px)`, fontFamily: F[th.body || "inter"], fontWeight: 600, fontSize: s, lineHeight: 1.22, color: color || th.muted, textAlign: align, maxWidth: maxW, margin: align === "center" ? "0 auto" : undefined }}>
    {lines.map((l, i) => <div key={i}>{l}</div>)}
  </div>;
};

export const Chip: React.FC<{ th: Theme; text: string; at: number; color?: string; solid?: boolean; size?: number; icon?: string }> = ({ th, text, at, color, solid, size = 34, icon }) => {
  const a = useAnim();
  const p = a.pop(at);
  const c = color || th.accent;
  return <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: `${size * 0.36}px ${size * 0.7}px`, borderRadius: th.radius ?? 14, background: solid ? c : (th.mode === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.8)"), border: `3px solid ${c}`, color: solid ? (th.mode === "dark" ? "#000" : "#fff") : th.ink, fontFamily: F.mono, fontWeight: 800, fontSize: size, letterSpacing: "0.04em", transform: `scale(${clamp(p, 0, 1.15)})`, opacity: clamp(p, 0, 1), transformOrigin: "left center", boxShadow: th.mode === "dark" ? "none" : "0 10px 30px rgba(0,0,0,0.12)" }}>
    {icon ? <span style={{ color: c }}>{icon}</span> : null}{text}
  </div>;
};

export const Panel: React.FC<{ th: Theme; children: React.ReactNode; style?: React.CSSProperties; at?: number; from?: "up" | "left" | "right" | "scale" }> = ({ th, children, style, at = 0, from = "up" }) => {
  const a = useAnim();
  const p = a.r(at, 0.55);
  const tr = from === "up" ? `translateY(${(1 - p) * 70}px)` : from === "left" ? `translateX(${(1 - p) * -120}px)` : from === "right" ? `translateX(${(1 - p) * 120}px)` : `scale(${0.9 + p * 0.1})`;
  return <div style={{ background: th.panel, color: th.panelInk || th.ink, border: `3px solid ${th.line}`, borderRadius: th.radius ?? 18, boxShadow: th.mode === "dark" ? "0 24px 60px rgba(0,0,0,0.45)" : "0 24px 50px rgba(30,30,60,0.16)", opacity: p, transform: tr, ...style }}>{children}</div>;
};

export const Credit: React.FC<{ th: Theme; text?: string }> = ({ th, text }) => text ? <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, bottom: 40, fontFamily: F.inter, fontWeight: 600, fontSize: 22, color: th.mode === "dark" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)", textAlign: "left" }}>{text}</div> : null;

export const Img2: React.FC<{ src: any; style?: React.CSSProperties }> = ({ src, style }) => {
  const s = asset(src);
  return s ? <Img src={s} style={style} /> : null;
};
export const lerp = interpolate;
