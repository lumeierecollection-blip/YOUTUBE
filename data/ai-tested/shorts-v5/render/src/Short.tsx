import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, CANVAS, F, Glitch, Ground, Crt, OUT, Pic, Plate, asset, clamp, rnd, useT } from "./kit";
import { Widget, WidgetView } from "./widgets";
import { staticFile } from "remotion";

export type TextItem = {
  words: string; times: number[]; x: number; y: number; size: number;
  role?: "serif" | "kw"; align?: "left" | "center" | "right"; maxW?: number; bar?: string; gap?: number; lh?: number; color?: string; tracking?: number;
};
export type PicItem = {
  src?: string; logo?: string; tile?: boolean; x: number; y: number; w: number; aspect: number; at: number;
  frame?: "thin" | "card" | "none" | "tile"; enter?: "glitch" | "slide-l" | "slide-r" | "slide-u" | "slide-d" | "fade" | "pop" | "cut";
  rot?: number; z?: number; radius?: number; cutout?: boolean; fit?: "cover" | "contain"; shadow?: boolean; tint?: string;
};
export type Decor = { k: "hair-v" | "hair-h" | "cross" | "bracket" | "tag"; x: number; y: number; len?: number; w?: number; h?: number; text?: string; at?: number };
export type Beat = {
  id: string; t: number; dur: number; plate: Plate; enter: "cut" | "flash" | "glitch" | "flicker";
  flickerTo?: number; flashFrames?: number;
  bg?: { src: string; treat?: "halftone" | "dim" | "none"; at?: number };
  pics: PicItem[]; text: TextItem[]; widget?: Widget; decor?: Decor[];
};
export type SfxEvent = { src: string; t: number; volume?: number; dur?: number; purpose?: string };
export type Plan = {
  id: string; slug: string; title: string; schema: number;
  words: { w: string; t0: number; t1: number }[];
  beats: Beat[];
  audio: { music?: { src: string; volume?: number }; ambience?: { src: string; volume?: number }; sfx: SfxEvent[] };
};
export type ShortProps = { plan: Plan; audioSrc: string; audioDurationSec: number };

const darkInk = "#EDEDE8";

const TextView: React.FC<{ it: TextItem; plate: Plate }> = ({ it, plate }) => {
  const { t } = useT();
  const words = it.words.split(/\s+/).filter(Boolean);
  const kw = it.role === "kw";
  const base = it.color || (plate === "paper" ? C.ink : darkInk);
  const maxW = (it.maxW ?? 0.88) * CANVAS.w;
  const al = it.align || "center";
  const tx = al === "center" ? "-50%" : al === "right" ? "-100%" : "0";
  return <div style={{ position: "absolute", left: it.x * CANVAS.w, top: it.y * CANVAS.h, width: maxW, transform: `translate(${tx}, -50%)`, left_: 0, display: "flex", flexWrap: "wrap", justifyContent: al === "center" ? "center" : al === "right" ? "flex-end" : "flex-start", columnGap: it.gap ?? it.size * 0.2, rowGap: 0, textAlign: al } as React.CSSProperties}>
    {words.map((w, i) => {
      const ti = it.times[i] ?? it.times[it.times.length - 1] ?? 0;
      const p = OUT(clamp((t - ti) / (kw ? 0.16 : 0.28), 0, 1));
      const bp = clamp((t - ti) / 0.12, 0, 1);
      const bar = kw ? it.bar : undefined;
      const txt = bar === "blue" || bar === "red" ? "#fff" : bar ? C.ink : base;
      return <span key={i} style={{
        fontFamily: kw ? F.sans : F.serif, fontStyle: kw ? "normal" : "italic", fontSize: it.size, lineHeight: it.lh ?? (kw ? 1.0 : 0.98),
        letterSpacing: it.tracking !== undefined ? `${it.tracking}em` : kw ? "-0.045em" : "-0.015em", color: txt, opacity: p, filter: p < 1 ? `blur(${(1 - p) * 9}px)` : undefined,
        transform: `translateY(${(1 - p) * (kw ? 6 : 16)}px)`, display: "inline-block", whiteSpace: "pre",
        ...(bar ? { backgroundImage: `linear-gradient(${C.bars[bar]},${C.bars[bar]})`, backgroundRepeat: "no-repeat", backgroundPosition: "0 58%", backgroundSize: `${bp * 100}% 74%`, padding: `0 ${it.size * 0.1}px` } : {}),
      }}>{w}</span>;
    })}
  </div>;
};

const LogoMark: React.FC<{ id: string; color: string; size: string }> = ({ id, color, size }) => (
  <div style={{ width: size, height: size, backgroundColor: color, WebkitMaskImage: `url(${staticFile(`logos/${id}.svg`)})`, maskImage: `url(${staticFile(`logos/${id}.svg`)})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskSize: "contain", maskSize: "contain" }} />
);

const PicView: React.FC<{ it: PicItem }> = ({ it }) => {
  const { t, f } = useT();
  const dt = t - it.at;
  if (dt < 0) return null;
  const W = it.w * CANVAS.w, H = W / it.aspect;
  const enter = it.enter || "fade";
  const p = OUT(clamp(dt / 0.32, 0, 1));
  let tr = "";
  if (enter === "slide-l") tr = `translateX(${(1 - p) * -70}px)`;
  else if (enter === "slide-r") tr = `translateX(${(1 - p) * 70}px)`;
  else if (enter === "slide-u") tr = `translateY(${(1 - p) * -60}px)`;
  else if (enter === "slide-d") tr = `translateY(${(1 - p) * 60}px)`;
  else if (enter === "pop") tr = `scale(${0.92 + 0.08 * p})`;
  const op = enter === "cut" || enter === "glitch" ? 1 : p;
  const framed = it.frame === "thin";
  const tile = it.tile || it.frame === "tile";
  const inner = it.logo
    ? <div style={{ width: "100%", height: "100%", background: tile ? C.black : "transparent", borderRadius: tile ? W * 0.2 : 0, display: "flex", alignItems: "center", justifyContent: "center" }}><LogoMark id={it.logo} color={tile ? "#fff" : (it.tint || C.ink)} size={tile ? "62%" : "100%"} /></div>
    : <Pic src={it.src!} fit={it.fit || (it.cutout ? "contain" : "cover")} style={it.shadow || it.cutout ? { filter: "drop-shadow(0 22px 28px rgba(0,0,0,0.35))" } : undefined} />;
  const box = <div style={{
    position: "absolute", left: it.x * CANVAS.w - W / 2, top: it.y * CANVAS.h - H / 2, width: W, height: H, zIndex: it.z ?? 1,
    transform: `${tr} rotate(${it.rot ?? 0}deg)`, opacity: op,
    ...(it.radius ? { borderRadius: it.radius * W, overflow: "hidden" } : {}),
    ...(framed ? { padding: 9, background: C.paper, border: "2px solid rgba(0,0,0,0.28)", boxSizing: "border-box" } : {}),
    ...(it.frame === "card" ? { boxShadow: "0 24px 50px rgba(0,0,0,0.28)", border: "2px solid rgba(255,255,255,0.65)" } : {}),
  }}>{inner}</div>;
  if (enter === "glitch") return <AbsoluteFill style={{ zIndex: it.z ?? 1 }}><Glitch frames={Math.round(0.3 * 30)} seed={Math.round(it.at * 10)}>{box}</Glitch></AbsoluteFill>;
  void f;
  return box;
};

const DecorView: React.FC<{ d: Decor; plate: Plate }> = ({ d, plate }) => {
  const { t } = useT();
  const op = clamp((t - (d.at ?? 0)) / 0.25, 0, 1);
  const col = plate === "paper" ? "rgba(17,17,17,0.75)" : "rgba(237,237,232,0.8)";
  const X = d.x * CANVAS.w, Y = d.y * CANVAS.h;
  if (d.k === "hair-v") return <div style={{ position: "absolute", left: X, top: Y, width: 2, height: (d.len ?? 0.25) * CANVAS.h, background: col, opacity: op }} />;
  if (d.k === "hair-h") return <div style={{ position: "absolute", left: X, top: Y, height: 2, width: (d.len ?? 0.25) * CANVAS.w, background: col, opacity: op }} />;
  if (d.k === "cross") return <><div style={{ position: "absolute", left: X - 22, top: Y, width: 44, height: 2, background: col, opacity: op }} /><div style={{ position: "absolute", left: X, top: Y - 22, width: 2, height: 44, background: col, opacity: op }} /></>;
  if (d.k === "bracket") return <div style={{ position: "absolute", left: X, top: Y, width: (d.w ?? 0.1) * CANVAS.w, height: (d.h ?? 0.06) * CANVAS.h, border: `2px solid ${col}`, opacity: op }} />;
  return <div style={{ position: "absolute", left: X, top: Y, fontFamily: F.mono, fontWeight: 700, fontSize: 30, letterSpacing: "0.06em", color: col, opacity: op }}>{d.text}</div>;
};

const BgView: React.FC<{ bg: NonNullable<Beat["bg"]> }> = ({ bg }) => {
  const { t } = useT();
  const at = bg.at ?? 0;
  if (t < at) return null;
  const treat = bg.treat || "dim";
  const filt = treat === "halftone" ? "grayscale(1) contrast(1.7) brightness(0.9)" : treat === "dim" ? "brightness(0.62) contrast(1.15) saturate(0.9)" : undefined;
  return <AbsoluteFill>
    <Pic src={bg.src} style={{ filter: filt }} />
    {treat === "halftone" ? <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.55) 1.6px, transparent 2px)", backgroundSize: "7px 7px", mixBlendMode: "multiply" }} /> : null}
  </AbsoluteFill>;
};

const BeatView: React.FC<{ beat: Beat }> = ({ beat }) => {
  const { f, t } = useT();
  const flash = beat.enter === "flash" && f < (beat.flashFrames ?? 3);
  const flick = beat.enter === "flicker" && t < (beat.flickerTo ?? 0.6) && Math.floor(f / 2) % 2 === 0;
  const body = <>
    {beat.bg ? <BgView bg={beat.bg} /> : null}
    {(beat.decor || []).map((d, i) => <DecorView key={i} d={d} plate={beat.plate} />)}
    {beat.pics.map((p, i) => <PicView key={i} it={p} />)}
    {beat.text.map((tx, i) => <TextView key={i} it={tx} plate={beat.plate} />)}
    {beat.widget ? <WidgetView w={beat.widget} bt={t} /> : null}
  </>;
  return <AbsoluteFill style={{ filter: flash || flick ? "invert(1)" : undefined }}>
    <Ground plate={beat.plate} />
    {beat.enter === "glitch" ? <Glitch frames={7} slices={8} amp={110} seed={Math.round(beat.t * 10)}>{body}</Glitch> : body}
  </AbsoluteFill>;
};

export const Short: React.FC<ShortProps> = ({ plan, audioSrc, audioDurationSec }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const f = useCurrentFrame();
  const total = durationInFrames / fps;
  const a = plan.audio;
  const speech = React.useMemo(() => {
    const iv: [number, number][] = [];
    for (const w of plan.words) {
      const s = w.t0 - 0.05, e = w.t1 + 0.12;
      if (iv.length && s - iv[iv.length - 1][1] < 0.22) iv[iv.length - 1][1] = Math.max(iv[iv.length - 1][1], e); else iv.push([s, e]);
    }
    return iv;
  }, [plan]);
  const speechAmt = (s: number) => {
    let m = 0;
    for (const [a0, a1] of speech) { const k = clamp(Math.min((s - a0) / 0.14, (a1 - s) / 0.3), 0, 1); if (k > m) m = k; if (s < a0 - 1) break; }
    return m;
  };
  const musicVol = (fr: number) => {
    if (!a.music) return 0;
    const s = fr / fps;
    const base = a.music.volume ?? 0.2;
    const duck = 1 - 0.62 * speechAmt(s);
    return base * duck * interpolate(s, [0, 0.6, total - 1.4, total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };
  const ambVol = (fr: number) => {
    if (!a.ambience) return 0;
    const s = fr / fps;
    return (a.ambience.volume ?? 0.07) * (1 - 0.5 * speechAmt(s)) * interpolate(s, [0, 0.8, total - 1.2, total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };
  void f; void audioDurationSec; void rnd;
  return <AbsoluteFill style={{ background: C.paper }}>
    {plan.beats.map((b, i) => {
      const from = Math.round(b.t * fps);
      const end = i === plan.beats.length - 1 ? durationInFrames : Math.round(plan.beats[i + 1].t * fps);
      return <Sequence key={b.id} from={from} durationInFrames={Math.max(1, end - from)} layout="none"><BeatView beat={b} /></Sequence>;
    })}
    <Crt />
    {audioSrc ? <Audio src={asset(audioSrc)!} volume={1} /> : null}
    {a.music?.src ? <Audio src={asset(a.music.src)!} volume={musicVol} loop /> : null}
    {a.ambience?.src ? <Audio src={asset(a.ambience.src)!} volume={ambVol} loop /> : null}
    {a.sfx.map((s, i) => <Sequence key={i} from={Math.max(0, Math.round(s.t * fps))} durationInFrames={Math.max(3, Math.round((s.dur ?? 2.5) * fps))} layout="none"><Audio src={asset(s.src)!} volume={s.volume ?? 0.6} /></Sequence>)}
  </AbsoluteFill>;
};
