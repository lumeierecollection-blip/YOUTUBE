// "SX" Shorts kit (1080x1920, 30 fps), measured frame by frame from two reference Shorts (channel-reverse/reports/shorts-study-2026-11-19.md,
// flash analysis in channel-reverse/uploads-1119): every state is held for 2-3 frames (motion steps "on threes", never smooth), a new picture every
// 0.3-0.6 s, glitch frames (inverted, posterised, colour-split) before a key word, key words revealed letter by letter out of order inside a highlighter
// bar that flips blue/yellow while the ground flips black/paper, 1-frame black bars, ink-brush strokes behind key words, framed inset pictures on grey
// grain paper, mixed-size serif-italic + bold-sans captions (style "v1"); real photographs with a centred name, split photos sliding in, giant years,
// a white page with one italic word, real article captures with a highlighter sweep, counting bars, a comment CTA (style "v3").
// Everything comes from props built by platform/shorts-sx/build.mjs (word timings from faster-whisper on our own narration). Their art is not used.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { F, Fonts } from "../lf2/kit.jsx";

const SERIF = F.display, SANS = '"Inter", "Helvetica Neue", Arial, sans-serif';
const src = (p) => (p && (p.startsWith("http") || p.startsWith("data:")) ? p : staticFile(p));
const step = (f, n = 3) => f - (f % n);                     // motion "on threes", as measured (median hold 3 frames)
const PAPER = "#E2E2E0", BLUE = "#1F2BD6", YELLOW = "#E9F25A", TEAL = "#38D9C0", RED = "#D9302C";

function Grain({ f, o = 0.12 }) {
  return <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, opacity: o, mixBlendMode: "multiply", pointerEvents: "none" }}>
    <filter id={`sg${step(f) % 4}`}><feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed={step(f) % 4} /><feColorMatrix type="saturate" values="0" /></filter>
    <rect width="1080" height="1920" filter={`url(#sg${step(f) % 4})`} />
  </svg>;
}
const Media = ({ s, style, ss = 0 }) => s.video
  ? <OffthreadVideo src={src(s.video)} muted startFrom={Math.round(ss * 30)} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />
  : <Img src={src(s.img)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.pos || "50% 40%", ...style }} />;

/** The picture layer of one shot. l = local frame. */
function Plate({ s, l, ground }) {
  const z = 1 + 0.004 * step(l), g = s.glitch && l < 3;
  const fx = g ? { filter: "invert(1) grayscale(1) contrast(3.5)" } : {};
  const ins = (w, top) => ({ position: "absolute", left: (1080 - w) / 2, top, width: w, height: w * (s.ratio || 0.75), background: "#fff", padding: s.mat ? 14 : 0, boxShadow: "0 8px 30px rgba(0,0,0,0.18)" });
  if (s.kind === "inset") return <AbsoluteFill style={{ background: ground }}>
    <div style={{ ...ins(s.w || 760, s.top || 560), transform: `scale(${z})`, ...fx }}><div style={{ width: "100%", height: "100%", overflow: "hidden", outline: s.mat ? "3px solid #111" : "none", outlineOffset: -6 }}><Media s={s} ss={s.ss} /></div></div>
    {g && <div style={{ ...ins(s.w || 760, s.top || 560), mixBlendMode: "screen", transform: "translateX(14px)", background: "rgba(255,0,90,0.35)" }} />}
  </AbsoluteFill>;
  if (s.kind === "full" || s.kind === "year") return <AbsoluteFill style={{ background: "#000", ...fx }}>
    <div style={{ position: "absolute", inset: 0, transform: `scale(${z})` }}><Media s={s} ss={s.ss} style={s.kind === "year" ? { filter: "brightness(0.55)" } : {}} /></div>
    {s.kind === "year" && <div style={{ position: "absolute", left: 0, right: 0, top: 700, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 330, color: "#fff", letterSpacing: -12, textShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>{s.year}</div>}
  </AbsoluteFill>;
  if (s.kind === "split") { const k = interpolate(step(l), [0, 9], [0, 1], { extrapolateRight: "clamp" }); return <AbsoluteFill style={{ background: "#000" }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080 - 520 * k, height: 1920, overflow: "hidden" }}><Media s={{ img: s.img, pos: s.pos }} /></div>
    <div style={{ position: "absolute", left: 1080 - 520 * k, top: 0, width: 540, height: 1920, overflow: "hidden" }}><Media s={{ img: s.img2, pos: s.pos2 }} /></div>
  </AbsoluteFill>; }
  if (s.kind === "page") return <AbsoluteFill style={{ background: "#F7F7F5" }}><div style={{ position: "absolute", left: 0, right: 0, top: 880, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 92, color: "#111" }}>{s.page}</div></AbsoluteFill>;
  if (s.kind === "capture") { const W = 1000, sc = W / (s.cw || 1280), cx = s.cx || 0, k = interpolate(step(l), [6, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return <AbsoluteFill style={{ background: g ? "#111" : "#F7F7F5" }}>
      <div style={{ position: "absolute", left: 40, top: 640, width: W, height: (s.ch || 900) * sc, boxShadow: "0 10px 40px rgba(0,0,0,0.18)", background: "#fff", overflow: "hidden", ...(g ? { filter: "invert(1)" } : {}) }}>
        <Img src={src(s.img)} style={{ width: (s.pw || 1280) * sc, maxWidth: "none", position: "absolute", left: -cx * sc, top: -(s.cy || 0) * sc }} />
        {(s.rects || []).map((r, i) => <div key={i} style={{ position: "absolute", left: (r.x - cx) * sc, top: (r.y - (s.cy || 0)) * sc, width: r.w * sc * k, height: r.h * sc, background: i === 0 ? "rgba(240,230,40,0.55)" : "rgba(225,40,40,0.45)", mixBlendMode: "multiply" }} />)}
      </div></AbsoluteFill>; }
  if (s.kind === "bars") { const k = interpolate(step(l), [3, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), mx = Math.max(...s.bars.map((b) => b.value));
    return <AbsoluteFill style={{ background: "#F7F7F5" }}>{s.bars.map((b, i) => <div key={i} style={{ position: "absolute", left: 90, top: 760 + i * 230 }}>
      <div style={{ width: 760 * (b.value / mx) * k, height: 110, background: i === 0 ? "#D9775A" : "#151515" }} />
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: "#111", marginTop: 12 }}>{b.label} · {b.prefix || ""}{Math.round(b.value * k)}{b.suffix || ""}</div></div>)}</AbsoluteFill>; }
  if (s.kind === "logo") { const k = Math.min(1, step(l) / 6); return <AbsoluteFill style={{ background: s.white ? "#F7F7F5" : ground }}>
    <div style={{ position: "absolute", left: (1080 - (s.tile ? 340 : 760)) / 2, top: s.tile ? 640 : 720, width: s.tile ? 340 : 760, height: s.tile ? 340 : 220, borderRadius: s.tile ? 64 : 0, background: s.tile ? "#0d0d0d" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${0.9 + 0.1 * k})`, boxShadow: s.tile ? "0 10px 30px rgba(0,0,0,0.25)" : "none" }}>
      <Img src={src(s.img)} style={{ maxWidth: s.tile ? "78%" : "100%", maxHeight: s.tile ? "78%" : "100%", objectFit: "contain", filter: s.tile ? "invert(1)" : "none" }} /></div></AbsoluteFill>; }
  if (s.kind === "cta") return <AbsoluteFill style={{ background: "#3A3A3A" }}>
    {(s.logos || []).map((g, i, all) => <Img key={i} src={src(g)} style={{ position: "absolute", left: 540 - (all.length * 330) / 2 + i * 330 + 15, top: 1130, width: 300, height: 110, objectFit: "contain", filter: "invert(1)" }} />)}</AbsoluteFill>;
  return <AbsoluteFill style={{ background: ground }} />;
}

/** v1 key word: letters appear out of order over ~9 frames inside a bar that flips blue/yellow every 3 frames. */
function KeyWord({ w, l, hl, brush, counter }) {
  const n = w.length, order = [...Array(n).keys()].sort((a, b) => ((a * 7 + 3) % n) - ((b * 7 + 3) % n)), shown = Math.min(n, Math.floor(step(l) / 3 * (n / 3)) + 1);
  const vis = new Set(order.slice(0, shown)), bar = hl ? (Math.floor(l / 3) % 2 && l < 15 ? BLUE : YELLOW) : null;
  const size = Math.min(176, Math.floor(980 / (n * 0.6)));
  return <span style={{ position: "relative", display: "inline-block", padding: "0 18px", fontFamily: SANS, fontWeight: 800, fontSize: size, letterSpacing: -size / 30, lineHeight: 1, color: bar === BLUE ? "#fff" : "#111" }}>
    {brush && <svg width="760" height="190" style={{ position: "absolute", left: -40, top: 0 }}><path d="M10 120 C120 40 300 70 420 60 S640 40 740 90 L730 140 C600 120 420 150 260 160 S60 170 20 150 Z" fill={brush === "red" ? RED : TEAL} opacity={0.9} /></svg>}
    {bar && <span style={{ position: "absolute", left: 0, right: 0, top: 18, bottom: 8, background: bar }} />}
    {counter && <span style={{ position: "absolute", right: "100%", top: 60, fontFamily: SANS, fontWeight: 500, fontSize: 52, color: "#111", marginRight: 10 }}>({counter})</span>}
    <span style={{ position: "relative" }}>{w.split("").map((ch, i) => <span key={i} style={{ opacity: vis.has(i) ? 1 : 0 }}>{ch}</span>)}</span>
  </span>;
}

/** Captions: the current phrase builds word by word. v1: small serif italic words of mixed sizes + bold sans key words; v3: white sans, centred. */
function Captions({ words, f, styleName, dark, top }) {
  const t = f / 30, cur = words.findIndex((w, i) => t >= w.t0 && (i + 1 >= words.length || t < words[i + 1].t0));
  if (cur < 0) return null;
  const ph = words[cur].p, list = words.filter((w) => w.p === ph && w.t0 <= t);
  if (styleName === "v3") return <div style={{ position: "absolute", left: 60, right: 60, top: 1000, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 76, color: dark ? "#fff" : "#111", textShadow: dark ? "0 3px 16px rgba(0,0,0,0.6)" : "none", lineHeight: 1.1 }}>{list.map((w) => w.w).join(" ")}</div>;
  return <div style={{ position: "absolute", left: 40, right: 40, top: top ?? 860, textAlign: "center", lineHeight: 1.05, textShadow: dark ? "0 3px 14px rgba(0,0,0,0.75)" : "none" }}>
    {list.map((w, i) => w.key
      ? <KeyWord key={i} w={w.w} l={f - Math.round(w.t0 * 30)} hl={w.hl} brush={w.brush} counter={w.counter} />
      : <span key={i} style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: [70, 112, 92, 132][(w.i * 5) % 4], color: dark ? "#f2f2f2" : "#151515", margin: "0 10px", verticalAlign: "middle" }}>{w.w}</span>)}
  </div>;
}

export function SX({ words = [], shots = [], styleName = "v1", tag, handle, cta }) {
  const f = useCurrentFrame();
  let si = 0; for (let i = 0; i < shots.length; i++) if (shots[i].f0 <= f) si = i;
  const s = shots[si] || { kind: "paper" }, l = f - (s.f0 || 0);
  const strobe = s.strobe && l < 15, ground = strobe ? (Math.floor(l / 2) % 2 ? "#050505" : PAPER) : s.kind === "black" ? "#050505" : PAPER;
  const dark = ["full", "year", "split", "black", "cta"].includes(s.kind) || ground === "#050505";
  return <AbsoluteFill style={{ background: ground }}>
    <Fonts />
    <Plate s={s} l={l} ground={ground} />
    {s.kind !== "page" && s.kind !== "cta" && s.kind !== "bars" && s.kind !== "capture" && !(s.kind === "logo" && s.white) && !s.cap && <Captions words={words} f={f} styleName={styleName} dark={dark || s.kind === "inset"} top={s.kind === "inset" ? (s.top || 560) + (s.w || 760) * (s.ratio || 0.75) / 2 - 70 : undefined} />}
    {s.cap && <div style={{ position: "absolute", left: 0, right: 0, top: 1040, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 78, color: "#fff", textShadow: "0 3px 18px rgba(0,0,0,0.65)" }}>{s.cap}</div>}
    {s.kind === "cta" && <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 110, color: "#fff", lineHeight: 1.05 }}>{cta}</div>}
    {s.blackbar && l === 4 && <div style={{ position: "absolute", left: 0, right: 0, top: 930, height: 26, background: "#000" }} />}
    {styleName === "v1" && s.kind !== "full" && <Grain f={f} />}
    {tag && <div style={{ position: "absolute", right: 46, top: 52, background: "#111", color: "#fff", fontFamily: F.mono, fontSize: 22, letterSpacing: 2, padding: "4px 10px" }}>{tag}</div>}
    {handle && dark && s.kind !== "cta" && <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 34, color: "rgba(255,255,255,0.85)" }}>{handle}</div>}
    {s.credit && <div style={{ position: "absolute", left: 30, bottom: 30, fontFamily: SANS, fontSize: 20, color: dark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.55)" }}>{s.credit}</div>}
  </AbsoluteFill>;
}

export const compositions = [{ id: "SX", component: SX, durationInFrames: 1200, fps: 30, width: 1080, height: 1920, defaultProps: { words: [], shots: [], styleName: "v1" } }];
