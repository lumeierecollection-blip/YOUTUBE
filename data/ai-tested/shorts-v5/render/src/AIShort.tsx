import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { loadFont as loadSG } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: sg } = loadSG();
const { fontFamily: inter } = loadInter();

type ChartPoint = { label: string; value: number; color?: string };
type MotionSpec = { property?: string; from?: number; to?: number; dur?: number; delay?: number };
type Focal = { x?: number; y?: number; w?: number; h_pct?: number };
type Beat = {
  t: number; dur: number; narration: string; visual: string; headline: string; sub?: string; kicker?: string;
  accent?: string; bg?: string; bg_image?: string; assets?: string[]; photo?: string; photo_credit?: string;
  left?: string; right?: string; cta?: string; chart?: { type?: string; points?: ChartPoint[]; max?: number; unit?: string };
  timeline?: { steps?: string[] } | string[]; motion?: MotionSpec[]; focal?: Focal; palette?: string[];
};
type Plan = { id: string; slug: string; title: string; concept?: string; beats: Beat[]; duration_target_sec?: number; cta?: string; audio?: { sfx?: { src: string; t: number; volume?: number; dur?: number }[]; music?: { src: string; volume?: number } } };
export type AIShortProps = { plan: Plan; audioSrc: string; audioDurationSec: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const num = (v: any, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const isDarkBg = (bg?: string) => {
  const b = (bg || "#FAFAF8").toLowerCase().replace("#", "");
  if (b.length !== 6) return false;
  const r = parseInt(b.slice(0, 2), 16), g = parseInt(b.slice(2, 4), 16), bl = parseInt(b.slice(4, 6), 16);
  return (r * 299 + g * 587 + bl * 114) / 1000 < 140;
};
const resolveAsset = (p?: any) => {
  let v: string = typeof p === "string" ? p : (p?.file || p?.src || p?.name || "");
  if (!v || typeof v !== "string") return null;
  if (/^(https?:|data:)/.test(v)) return v;
  if (v.startsWith("sfx/") || v.startsWith("photos/") || v.startsWith("logos/") || v.startsWith("audio/") || v.startsWith("images/")) return staticFile(v);
  if (v.includes("/")) return staticFile(v);
  if (/\.(png|jpg|jpeg|webp|svg)$/i.test(v)) {
    const base = v.replace(/\.(png|jpg|jpeg|webp|svg)$/i, "").replace(/-logo$/, "").replace(/_logo$/, "").replace(/-white$/, "");
    const known = ["openai","google","meta","anthropic","nvidia","huggingface","spacex","claude","gemini"];
    if (known.includes(base)) return staticFile(`logos/${base}-white.svg`);
    if (/\.svg$/i.test(v)) {
      if (/logo|seal|icon|badge|mark/i.test(v)) return staticFile(`logos/${v}`);
      return staticFile(`photos/${v}`);
    }
    return staticFile(`photos/${v}`);
  }
  return staticFile(`logos/${v}-white.svg`);
};
const logoSrc = (l: any) => {
  let v: string = typeof l === "string" ? l : (l?.file || l?.src || l?.name || l?.logo || "");
  if (!v || typeof v !== "string") return staticFile("logos/openai-white.svg");
  if (/^(https?:|data:)/.test(v)) return v;
  if (v.startsWith("logos/") || v.startsWith("photos/") || v.startsWith("images/")) return staticFile(v);
  if (v.includes("/")) return staticFile(v);
  if (/\.(svg|png|jpg|jpeg|webp)$/i.test(v)) {
    const base = v.replace(/\.(svg|png|jpg|jpeg|webp)$/i, "").replace(/-logo$/, "").replace(/_logo$/, "").replace(/-white$/, "");
    const known = ["openai","google","meta","anthropic","nvidia","huggingface","spacex","claude","gemini"];
    if (known.includes(base)) return staticFile(`logos/${base}-white.svg`);
    return staticFile(`logos/${v}`);
  }
  const clean = v.replace(/-logo$/, "").replace(/_logo$/, "").replace(/-white$/, "");
  return staticFile(`logos/${clean}-white.svg`);
};

const Bg: React.FC<{ bg: string; accent: string; dark: boolean; bgImage?: string }> = ({ bg, accent, dark, bgImage }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, -18], { extrapolateRight: "clamp" });
  const grid = dark ? "rgba(255,255,255,0.035)" : "rgba(17,17,17,0.03)";
  return <AbsoluteFill style={{ background: bg }}>
    {bgImage ? <AbsoluteFill><Img src={resolveAsset(bgImage)!} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: dark ? 0.28 : 0.18 }} /><AbsoluteFill style={{ background: dark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.35)" }} /></AbsoluteFill> : null}
    <div style={{ position: "absolute", inset: -60, transform: `translateY(${drift}px)`, backgroundImage: `linear-gradient(${grid} 1px,transparent 1px),linear-gradient(90deg,${grid} 1px,transparent 1px)`, backgroundSize: "72px 72px" }} />
    <div style={{ position: "absolute", top: -180, right: -140, width: 560, height: 560, borderRadius: 999, background: accent, opacity: dark ? 0.12 : 0.05 }} />
    <div style={{ position: "absolute", bottom: 180, left: -160, width: 460, height: 460, borderRadius: 999, background: accent, opacity: dark ? 0.08 : 0.035 }} />
  </AbsoluteFill>;
};

const FadeSlide: React.FC<{ children: React.ReactNode; delay?: number; y?: number; dur?: number }> = ({ children, delay = 0, y = 28, dur = 14 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: dur });
  return <div style={{ opacity: interpolate(p, [0, 1], [0, 1]), transform: `translateY(${interpolate(p, [0, 1], [y, 0])}px)` }}>{children}</div>;
};

const Kicker: React.FC<{ beat: Beat; dark: boolean }> = ({ beat, dark }) => (
  <FadeSlide delay={0} y={16} dur={12}>
    <div style={{ display: "inline-block", padding: "10px 18px", background: beat.accent || "#111", color: "#fff", fontFamily: inter, fontWeight: 800, fontSize: 22, letterSpacing: "0.08em" }}>
      {(beat.kicker || "AI TESTED").toUpperCase()}
    </div>
  </FadeSlide>
);

const Headline: React.FC<{ beat: Beat; dark: boolean; center?: boolean; maxW?: number }> = ({ beat, dark, center, maxW = 940 }) => {
  const frame = useCurrentFrame();
  const ink = dark ? "#FAFAF8" : "#111";
  const muted = dark ? "rgba(250,250,248,0.72)" : "#555";
  const hl = String(beat.headline || "");
  const size = hl.length > 24 ? 72 : hl.length > 18 ? 84 : hl.length > 12 ? 104 : 122;
  const barW = interpolate(frame, [2, 20], [0, Math.min(860, maxW)], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <FadeSlide delay={2} y={30} dur={16}>
    <div style={{ textAlign: center ? "center" : "left", maxWidth: maxW, width: "100%", margin: center ? "0 auto" : undefined, overflow: "hidden" }}>
      <div style={{ fontFamily: sg, fontWeight: 800, fontSize: size, lineHeight: 0.88, letterSpacing: "-0.04em", color: ink, textTransform: "uppercase", overflowWrap: "anywhere", wordBreak: "break-word", maxWidth: "100%" }}>{hl}</div>
      <div style={{ marginTop: 20, width: barW, maxWidth: "100%", height: 10, background: beat.accent || "#111", marginLeft: center ? "auto" : undefined, marginRight: center ? "auto" : undefined }} />
      {beat.sub ? <div style={{ marginTop: 20, fontFamily: inter, fontWeight: 700, fontSize: 38, lineHeight: 1.22, color: muted, maxWidth: 920, overflowWrap: "anywhere", marginLeft: center ? "auto" : undefined, marginRight: center ? "auto" : undefined }}>{beat.sub}</div> : null}
    </div>
  </FadeSlide>;
};

const Logos: React.FC<{ logos?: string[]; dark: boolean; size?: number }> = ({ logos = [], dark, size = 108 }) => {
  if (!logos.length) return null;
  return <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
    {logos.map((l: any, i) => { const ls = typeof l === "string" ? l : (l?.file || l?.src || l?.name || ""); const src = logoSrc(l); const isWhiteLogo = typeof src === "string" && src.includes("-white.svg"); return <FadeSlide key={`${ls}-${i}`} delay={i * 3} y={18} dur={12}>
      <div style={{ width: size, height: size, borderRadius: 28, background: dark ? "rgba(255,255,255,0.08)" : "#fff", border: `2px solid ${dark ? "rgba(255,255,255,0.14)" : "#E2E2DC"}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: dark ? "none" : "0 10px 30px rgba(17,17,17,0.06)" }}>
        <Img src={src} style={{ width: size * 0.56, height: size * 0.56, objectFit: "contain", filter: isWhiteLogo && !dark ? "brightness(0)" : undefined }} />
      </div>
    </FadeSlide>; })}
  </div>;
};

const Photo: React.FC<{ src: string; dark: boolean; accent: string; credit?: string; h?: number; cutout?: boolean }> = ({ src, dark, accent, credit, h = 980, cutout = true }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const y = interpolate(frame, [0, durationInFrames], [10, -10], { extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 18], [0.985, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const resolved = resolveAsset(src);
  if (!resolved) return null;
  return <div style={{ width: "100%", height: h, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
    <div style={{ position: "absolute", width: Math.min(760, h * 0.72), height: Math.min(760, h * 0.72), borderRadius: 999, background: accent, opacity: dark ? 0.12 : 0.07 }} />
    <Img src={resolved} style={{ maxWidth: "96%", maxHeight: "96%", objectFit: "contain", transform: `translateY(${y}px) scale(${scale})`, filter: cutout ? "drop-shadow(0 30px 44px rgba(17,17,17,0.18))" : "none", borderRadius: cutout ? 0 : 24 }} />
    {credit ? <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center", fontFamily: inter, fontSize: 18, color: dark ? "rgba(250,250,248,0.55)" : "#666" }}>{credit}</div> : null}
  </div>;
};

const Stat: React.FC<{ beat: Beat; dark: boolean }> = ({ beat, dark }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, Math.min(18, durationInFrames - 1)], [0, 1], { extrapolateRight: "clamp" });
  const numMatches = beat.headline.match(/-?\d[\d,.]*/g) || [];
  const simpleNumber = numMatches.length === 1;
  const raw = numMatches[0]?.replace(/,/g, "") || "";
  const target = Number(raw);
  const decimals = (raw.split(".")[1] || "").length;
  const animatedNum = decimals > 0 ? target.toFixed(decimals) : Math.round(target * p).toLocaleString();
  const display = simpleNumber && Number.isFinite(target)
    ? beat.headline.replace(numMatches[0], animatedNum)
    : beat.headline;
  const fs = display.length > 22 ? 72 : display.length > 14 ? 96 : display.length > 10 ? 120 : 160;
  return <div style={{ textAlign: "center", width: "100%", maxWidth: "100%", overflow: "hidden" }}>
    <div style={{ fontFamily: sg, fontWeight: 800, fontSize: fs, lineHeight: 0.95, color: beat.accent || "#111", letterSpacing: "-0.03em", overflowWrap: "anywhere", wordBreak: "break-word", maxWidth: "100%", padding: "0 8px", whiteSpace: "pre-line" }}>{display}</div>
    {beat.sub ? <div style={{ marginTop: 22, fontFamily: inter, fontWeight: 800, fontSize: 40, color: dark ? "#FAFAF8" : "#111", lineHeight: 1.2, overflowWrap: "anywhere", padding: "0 8px" }}>{beat.sub}</div> : null}
    <div style={{ marginTop: 28 }}><Logos logos={beat.assets} dark={dark} size={112} /></div>
  </div>;
};

const BarChart: React.FC<{ beat: Beat; dark: boolean }> = ({ beat, dark }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pts = (beat.chart?.points || []).slice(0, 6);
  const max = Math.max(1, num(beat.chart?.max, 0), ...pts.map(p => num(p.value, 0)));
  const prog = interpolate(frame, [0, Math.min(24, durationInFrames - 1)], [0, 1], { extrapolateRight: "clamp" });
  const ink = dark ? "#FAFAF8" : "#111"; const muted = dark ? "rgba(250,250,248,0.68)" : "#555";
  return <div style={{ width: "100%" }}>
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, height: 560, padding: "10px 10px 0" }}>
      {pts.map((p, i) => { const h = (num(p.value) / max) * 480 * prog; return <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 28, color: ink }}>{p.value}{beat.chart?.unit || ""}</div>
        <div style={{ width: "100%", maxWidth: 120, height: 480, display: "flex", alignItems: "flex-end", background: dark ? "rgba(255,255,255,0.06)" : "#EFEFEA", borderRadius: 18, overflow: "hidden" }}>
          <div style={{ width: "100%", height: h, background: p.color || beat.accent || "#111", borderRadius: 18 }} />
        </div>
        <div style={{ fontFamily: inter, fontWeight: 700, fontSize: 24, color: muted, textAlign: "center", lineHeight: 1.2, minHeight: 56 }}>{p.label}</div>
      </div>; })}
    </div>
  </div>;
};

const LineChart: React.FC<{ beat: Beat; dark: boolean }> = ({ beat, dark }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pts = (beat.chart?.points || []).slice(0, 8);
  const W = 920, H = 520, padL = 70, padR = 30, padT = 30, padB = 70;
  const vals = pts.map(p => num(p.value, 0));
  const max = Math.max(1, num(beat.chart?.max, 0), ...vals);
  const min = Math.min(0, ...vals);
  const range = Math.max(1, max - min);
  const xFor = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, pts.length - 1);
  const yFor = (v: number) => padT + (H - padT - padB) - ((v - min) / range) * (H - padT - padB);
  const prog = interpolate(frame, [0, Math.min(28, durationInFrames - 1)], [0, 1], { extrapolateRight: "clamp" });
  const visible = Math.max(1, Math.ceil(prog * pts.length));
  const partial = pts.slice(0, visible);
  const partD = partial.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(num(p.value, 0)).toFixed(1)}`).join(" ");
  const ink = dark ? "#FAFAF8" : "#111"; const muted = dark ? "rgba(250,250,248,0.68)" : "#555"; const grid = dark ? "rgba(255,255,255,0.12)" : "#E2E2DC";
  return <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%", height: "auto" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => { const y = padT + (H - padT - padB) * t; const val = (max - range * t); return <g key={i}><line x1={padL} x2={W - padR} y1={y} y2={y} stroke={grid} strokeWidth="2" /><text x={padL - 12} y={y + 8} textAnchor="end" fontSize="22" fill={muted} fontFamily={inter}>{Math.round(val)}{beat.chart?.unit || ""}</text></g>; })}
      <path d={partD} fill="none" stroke={beat.accent || "#111"} strokeWidth="8" strokeLinecap="round" />
      {partial.map((p, i) => { const x = xFor(i), y = yFor(num(p.value, 0)); return <g key={i}><circle cx={x} cy={y} r="10" fill={p.color || beat.accent || "#111"} /><text x={x} y={y - 18} textAnchor="middle" fontSize="24" fontWeight="800" fill={ink} fontFamily={inter}>{p.value}{beat.chart?.unit || ""}</text><text x={x} y={H - 24} textAnchor="middle" fontSize="24" fill={muted} fontFamily={inter}>{p.label}</text></g>; })}
    </svg>
  </div>;
};

const Timeline: React.FC<{ beat: Beat; dark: boolean }> = ({ beat, dark }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const raw = beat.timeline as any;
  const steps = (Array.isArray(raw) ? raw : (raw?.steps || [])).slice(0, 6).map((s: any) => typeof s === "string" ? s : (s?.label || s?.text || JSON.stringify(s)));
  const reveal = Math.floor(interpolate(frame, [0, Math.min(30, durationInFrames - 1)], [1, steps.length + 0.99], { extrapolateRight: "clamp" }));
  const ink = dark ? "#FAFAF8" : "#111";
  return <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
    {steps.map((s: string, i: number) => { const on = i < reveal; return <div key={i} style={{ display: "flex", gap: 18, alignItems: "center", opacity: on ? 1 : 0.18, transform: `translateY(${on ? 0 : 8}px)` }}>
      <div style={{ width: 54, height: 54, borderRadius: 999, background: on ? (beat.accent || "#111") : (dark ? "rgba(255,255,255,0.12)" : "#DDD"), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: inter, fontWeight: 800, fontSize: 24 }}>{i + 1}</div>
      <div style={{ flex: 1, padding: "20px 22px", background: dark ? "rgba(255,255,255,0.06)" : "#fff", border: `2px solid ${dark ? "rgba(255,255,255,0.12)" : "#E2E2DC"}`, fontFamily: inter, fontWeight: 700, fontSize: 32, color: ink, lineHeight: 1.2 }}>{s}</div>
    </div>; })}
  </div>;
};

const ProgressBarViz: React.FC<{ beat: Beat; dark: boolean }> = ({ beat, dark }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pts = (beat.chart?.points || [{ label: beat.sub || "Progress", value: 100 }]).slice(0, 4);
  const prog = interpolate(frame, [0, Math.min(24, durationInFrames - 1)], [0, 1], { extrapolateRight: "clamp" });
  const ink = dark ? "#FAFAF8" : "#111";
  return <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 28 }}>
    {pts.map((p, i) => { const max = Math.max(1, num(beat.chart?.max, 100)); const w = (num(p.value) / max) * 100 * prog; return <div key={i}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: inter, fontWeight: 800, fontSize: 30, color: ink, marginBottom: 10 }}><span>{p.label}</span><span>{p.value}{beat.chart?.unit || ""}</span></div>
      <div style={{ height: 34, background: dark ? "rgba(255,255,255,0.08)" : "#EAEAE4", borderRadius: 999, overflow: "hidden" }}><div style={{ height: "100%", width: `${w}%`, background: p.color || beat.accent || "#111" }} /></div>
    </div>; })}
  </div>;
};

const Split: React.FC<{ beat: Beat; dark: boolean }> = ({ beat, dark }) => (
  <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
    {[{ t: beat.left || "", a: beat.assets?.[0] }, { t: beat.right || "", a: beat.assets?.[1] }].map((side, i) => (
      <FadeSlide key={i} delay={i * 4} y={24} dur={14}>
        <div style={{ background: dark ? "rgba(255,255,255,0.06)" : "#fff", border: `2px solid ${dark ? "rgba(255,255,255,0.12)" : "#E2E2DC"}`, padding: "30px 22px", minHeight: 420, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
          {side.a ? (() => { const src = logoSrc(side.a); const isWhite = typeof src === "string" && src.includes("-white.svg"); return <Img src={src} style={{ width: 112, height: 112, objectFit: "contain", filter: isWhite && !dark ? "brightness(0)" : undefined }} />; })() : null}
          <div style={{ fontFamily: sg, fontWeight: 800, fontSize: 46, lineHeight: 0.95, color: i === 0 ? (beat.accent || "#111") : (dark ? "#FAFAF8" : "#111"), textAlign: "center", textTransform: "uppercase" }}>{side.t}</div>
          {side.sub ? <div style={{ fontFamily: inter, fontWeight: 700, fontSize: 28, lineHeight: 1.2, color: dark ? "rgba(250,250,248,0.72)" : "#555", textAlign: "center" }}>{side.sub}</div> : null}
        </div>
      </FadeSlide>
    ))}
  </div>
);

const EvidenceBoard: React.FC<{ beat: Beat; dark: boolean }> = ({ beat, dark }) => {
  const raw = beat.timeline as any;
  const steps = (Array.isArray(raw) ? raw : (raw?.steps || [])).slice(0, 5).map((s: any) => typeof s === "string" ? s : (s?.label || s?.text || ""));
  const items = steps.length ? steps : (beat.sub || "").split(/[·|]/).map(s => s.trim()).filter(Boolean).slice(0, 5);
  return <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
    {items.map((s: string, i: number) => <FadeSlide key={i} delay={i * 3} y={18} dur={12}>
      <div style={{ padding: "22px 20px", background: dark ? "rgba(255,255,255,0.06)" : "#fff", border: `2px solid ${dark ? "rgba(255,255,255,0.12)" : "#E2E2DC"}`, borderTop: `6px solid ${beat.accent || "#111"}`, fontFamily: inter, fontWeight: 700, fontSize: 28, lineHeight: 1.25, color: dark ? "#FAFAF8" : "#111", minHeight: 140 }}>{s}</div>
    </FadeSlide>)}
  </div>;
};

const BeatView: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const dark = isDarkBg(beat.bg);
  const bg = beat.bg || "#FAFAF8";
  const accent = beat.accent || "#111";
  const exit = interpolate(frame, [durationInFrames - 4, durationInFrames], [1, 0.92], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const v = beat.visual;
  const hasPhoto = !!beat.photo;
  const selfComposed = ["warning_panel", "quote_card", "stamp_document", "legal_stack", "product_card", "tool_card", "evidence_board"].includes(v);
  const topType = !["hero_cutout", "stat_counter", "bar_chart", "line_graph", "timeline", "progress_bar", "kinetic_type", "full_bleed_type", "final_question"].includes(v);

  return <AbsoluteFill style={{ opacity: exit }}>
    <Bg bg={bg} accent={accent} dark={dark} bgImage={beat.bg_image} />
    <div style={{ position: "absolute", inset: 0, padding: "64px 56px 84px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontFamily: sg, fontWeight: 700, fontSize: 28, letterSpacing: "0.14em", color: dark ? "#FAFAF8" : "#111" }}>AI TESTED</div>
        <div style={{ fontFamily: inter, fontWeight: 700, fontSize: 20, color: dark ? "rgba(250,250,248,0.62)" : "#666", textTransform: "uppercase" }}>{(beat.kicker && beat.kicker.toUpperCase() !== "AI TESTED") ? beat.kicker : "SHORT"}</div>
      </div>
      {(topType && !selfComposed) ? <Headline beat={beat} dark={dark} /> : <Kicker beat={beat} dark={dark} />}
      <div style={{ position: "absolute", left: 56, right: 56, top: (topType && !selfComposed) ? 340 : 190, bottom: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {hasPhoto && (v === "hero_cutout" || v === "photo" || v === "full_bleed_photo") ? <Photo src={beat.photo!} dark={dark} accent={accent} credit={beat.photo_credit} h={1080} cutout={v !== "full_bleed_photo"} /> : null}
        {v === "stat_counter" ? <Stat beat={beat} dark={dark} /> : null}
        {v === "bar_chart" ? <div style={{ width: "100%" }}><Headline beat={{ ...beat, sub: beat.sub }} dark={dark} center /><div style={{ marginTop: 24 }}><BarChart beat={beat} dark={dark} /></div></div> : null}
        {v === "line_graph" ? <div style={{ width: "100%" }}><Headline beat={{ ...beat, sub: beat.sub }} dark={dark} center /><div style={{ marginTop: 24 }}><LineChart beat={beat} dark={dark} /></div></div> : null}
        {v === "timeline" ? <div style={{ width: "100%" }}><Headline beat={beat} dark={dark} /><div style={{ marginTop: 24 }}><Timeline beat={beat} dark={dark} /></div></div> : null}
        {v === "progress_bar" ? <div style={{ width: "100%" }}><Headline beat={beat} dark={dark} /><div style={{ marginTop: 28 }}><ProgressBarViz beat={beat} dark={dark} /></div></div> : null}
        {v === "split_compare" ? <div style={{ width: "100%" }}><Headline beat={beat} dark={dark} center /><div style={{ marginTop: 24 }}><Split beat={beat} dark={dark} /></div></div> : null}
        {v === "logo_grid" ? <div style={{ width: "100%", textAlign: "center" }}><Headline beat={beat} dark={dark} center /><div style={{ marginTop: 36 }}><Logos logos={beat.assets} dark={dark} size={148} /></div></div> : null}
        {v === "evidence_board" ? <div style={{ width: "100%" }}><Headline beat={{...beat, sub: ""}} dark={dark} /><div style={{ marginTop: 24 }}><EvidenceBoard beat={beat} dark={dark} /></div><div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}><Logos logos={beat.assets} dark={dark} size={120} /></div></div> : null}
        {v === "warning_panel" ? <div style={{ width: "100%", padding: "40px", background: accent, color: "#fff" }}><div style={{ fontFamily: sg, fontWeight: 800, fontSize: 90, lineHeight: 0.9, textTransform: "uppercase" }}>{beat.headline}</div><div style={{ marginTop: 20, fontFamily: inter, fontWeight: 700, fontSize: 40, lineHeight: 1.2 }}>{beat.sub}</div><div style={{ marginTop: 24 }}><Logos logos={beat.assets} dark={true} /></div></div> : null}
        {v === "quote_card" ? <div style={{ width: "100%", padding: "42px", background: dark ? "rgba(255,255,255,0.06)" : "#fff", border: `2px solid ${dark ? "rgba(255,255,255,0.12)" : "#E2E2DC"}`, borderLeft: `16px solid ${accent}` }}><div style={{ fontFamily: sg, fontWeight: 800, fontSize: 96, lineHeight: 0.8, color: accent }}>"</div><div style={{ fontFamily: inter, fontWeight: 800, fontSize: 46, lineHeight: 1.2, color: dark ? "#FAFAF8" : "#111" }}>{beat.sub}</div><div style={{ marginTop: 26 }}><Logos logos={beat.assets} dark={dark} /></div></div> : null}
        {["stamp_document", "legal_stack", "product_card", "tool_card"].includes(v) ? <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
          {hasPhoto ? <Photo src={beat.photo!} dark={dark} accent={accent} credit={beat.photo_credit} h={520} /> : null}
          {(v === "stamp_document" || v === "legal_stack") ? <div style={{ padding: "22px 30px", border: `8px solid ${accent}`, color: accent, fontFamily: sg, fontWeight: 800, fontSize: 62, transform: "rotate(-3deg)", textTransform: "uppercase" }}>{beat.headline}</div> : <Logos logos={beat.assets} dark={dark} size={132} />}
          <div style={{ width: "100%", padding: "32px", background: dark ? "rgba(255,255,255,0.06)" : "#fff", border: `2px solid ${dark ? "rgba(255,255,255,0.12)" : "#E2E2DC"}`, borderLeft: `14px solid ${accent}` }}><div style={{ fontFamily: inter, fontWeight: 800, fontSize: 42, lineHeight: 1.22, color: dark ? "#FAFAF8" : "#111", textAlign: "center" }}>{beat.sub}</div></div>
        </div> : null}
        {["kinetic_type", "full_bleed_type", "final_question"].includes(v) ? <div style={{ width: "100%", textAlign: "center" }}>
          {hasPhoto ? <div style={{ marginBottom: 24 }}><Photo src={beat.photo!} dark={dark} accent={accent} credit={beat.photo_credit} h={420} /></div> : null}
          <div style={{ fontFamily: sg, fontWeight: 800, fontSize: beat.headline.length > 14 ? 100 : 122, lineHeight: 0.88, letterSpacing: "-0.04em", color: dark ? "#FAFAF8" : "#111", textTransform: "uppercase", textWrap: "balance" as any }}>{beat.headline}</div>
          <div style={{ marginTop: 26, height: 10, width: 680, maxWidth: "100%", marginLeft: "auto", marginRight: "auto", background: accent }} />
          <div style={{ marginTop: 26, fontFamily: inter, fontWeight: 700, fontSize: 40, lineHeight: 1.22, color: dark ? "rgba(250,250,248,0.76)" : "#555" }}>{beat.sub}</div>
          <div style={{ marginTop: 36 }}><Logos logos={beat.assets} dark={dark} size={v === "final_question" ? 136 : 116} /></div>
        </div> : null}
        {!["hero_cutout","photo","full_bleed_photo","stat_counter","bar_chart","line_graph","timeline","progress_bar","split_compare","logo_grid","evidence_board","warning_panel","quote_card","stamp_document","legal_stack","product_card","tool_card","kinetic_type","full_bleed_type","final_question"].includes(v) ? <div style={{ width: "100%", textAlign: "center" }}><Headline beat={beat} dark={dark} center /><div style={{ marginTop: 32 }}><Logos logos={beat.assets} dark={dark} size={128} /></div>{hasPhoto ? <div style={{ marginTop: 24 }}><Photo src={beat.photo!} dark={dark} accent={accent} credit={beat.photo_credit} h={520} /></div> : null}</div> : null}
      </div>
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 46, display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-end" }}>
        <div style={{ fontFamily: inter, fontSize: 18, color: dark ? "rgba(250,250,248,0.58)" : "#666", maxWidth: 640, lineHeight: 1.3 }}>{beat.photo_credit && !hasPhoto ? beat.photo_credit : ""}</div>
        {beat.cta ? <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 22, color: accent, maxWidth: 360, textAlign: "right" }}>{beat.cta}</div> : null}
      </div>
    </div>
  </AbsoluteFill>;
};

export const AIShort: React.FC<AIShortProps> = ({ plan, audioSrc, audioDurationSec }) => {
  const { fps } = useVideoConfig();
  const total = Math.max(audioDurationSec + 0.6, plan.duration_target_sec || 30);
  const sfxEvents = (plan.audio?.sfx || []).filter(s => s && s.src);
  const music = plan.audio?.music?.src;
  const musicVol = num(plan.audio?.music?.volume, 0.08);
  const lastBg = plan.beats?.[plan.beats.length - 1]?.bg || "#FAFAF8";
  return <AbsoluteFill style={{ background: lastBg }}>
    {music ? <Audio src={resolveAsset(music)!} volume={musicVol} /> : null}
    <Audio src={staticFile(audioSrc)} />
    {sfxEvents.map((s, i) => {
      const src = resolveAsset(s.src);
      if (!src) return null;
      return <Sequence key={`sfx-${i}`} from={Math.round(num(s.t, 0) * fps)} durationInFrames={Math.max(1, Math.round(num(s.dur, 0.4) * fps))}><Audio src={src} volume={clamp(num(s.volume, 0.25), 0, 1)} /></Sequence>;
    })}
    {plan.beats.map((b, i) => (
      <Sequence key={i} from={Math.round((b.t || 0) * fps)} durationInFrames={Math.max(1, Math.round((b.dur || 2) * fps))}>
        <BeatView beat={b} />
      </Sequence>
    ))}
  </AbsoluteFill>;
};
