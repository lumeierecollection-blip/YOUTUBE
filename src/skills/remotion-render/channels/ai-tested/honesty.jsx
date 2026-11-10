// AI Tested: "Do AI models admit what they don't know?" Real measured scores and a real reply, in the channel's clean white look.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";

const C = { bg: "#FFFFFF", surface: "#F3F4F6", ink: "#111827", dim: "#6B7280", stroke: "#D1D5DB", accent: "#0E7490", red: "#B91C1C", termBg: "#111418", termText: "#E5E7EB", green: "#4ADE80" };
const SANS = '"Space Grotesk", sans-serif', MONO = '"JetBrains Mono", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const abs = (x, y, w, h, extra) => ({ position: "absolute", left: x, top: y, width: w, height: h, ...extra });
const useIn = (d = 0, len = 12) => interpolate(useCurrentFrame(), [d, d + len], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
const Rise = ({ delay = 0, style, children }) => { const t = useIn(delay); return <div style={{ opacity: t, transform: `translateY(${(1 - t) * 24}px)`, ...style }}>{children}</div>; };
function Box({ dur, children }) { const f = useCurrentFrame(); return <AbsoluteFill style={{ opacity: interpolate(f, [0, 6, dur - 6, dur], [0, 1, 1, 0], clamp) }}>{children}</AbsoluteFill>; }

const Hook = ({ dur }) => <Box dur={dur}><Rise style={abs(70, 330, 940, 400, { fontFamily: SANS, fontWeight: 800, fontSize: 120, lineHeight: 1.04, color: C.ink })}>Will AI say</Rise><Rise delay={10} style={abs(70, 520, 940, 400, { fontFamily: SANS, fontWeight: 800, fontSize: 170, lineHeight: 1, color: C.accent })}>“I don’t know”?</Rise></Box>;

function Setup({ dur, p }) {
  const f = useCurrentFrame();
  return (<Box dur={dur}>
    <div style={abs(70, 300, 460, 60, { fontFamily: MONO, fontSize: 28, color: C.red, fontWeight: 700 })}>10 MADE-UP</div>
    {p.data.fake.map((n, i) => <div key={n} style={abs(70, 370 + i * 92, 520, 80, { fontFamily: SANS, fontWeight: 600, fontSize: 34, lineHeight: 1.1, color: C.ink, opacity: interpolate(f, [4 + i * 3, 10 + i * 3], [0, 1], clamp), background: C.surface, borderRadius: 14, padding: "10px 16px", boxSizing: "border-box", display: "flex", alignItems: "center" })}>{n}</div>)}
    <Rise delay={20} style={abs(640, 300, 370, 60, { fontFamily: MONO, fontSize: 28, color: C.accent, fontWeight: 700 })}>10 REAL</Rise>
    <Rise delay={26} style={abs(640, 370, 370, 400, { fontFamily: SANS, fontWeight: 700, fontSize: 40, lineHeight: 1.2, color: C.ink, background: C.surface, borderRadius: 18, padding: 22, boxSizing: "border-box" })}>“What is the capital of Australia?”<div style={{ marginTop: 20, fontSize: 30, color: C.dim, fontWeight: 500 }}>…and 9 more, as a control</div></Rise>
  </Box>);
}

function Score({ dur, p }) {
  const f = useCurrentFrame(); const ms = p.data.models;
  return (<Box dur={dur}>
    <Rise style={abs(70, 270, 940, 140, { fontFamily: SANS, fontWeight: 800, fontSize: 60, lineHeight: 1.05, color: C.ink })}>Made-up products a model admitted not knowing</Rise>
    {ms.map((m, i) => { const y = 480 + i * 280, w = interpolate(f, [8 + i * 8, 30 + i * 8], [0, (m.admitted / 10) * 880], clamp); return (
      <div key={m.name}>
        <div style={abs(70, y, 940, 60, { fontFamily: SANS, fontWeight: 700, fontSize: 40, color: C.ink })}>{m.speak}</div>
        <div style={abs(70, y + 70, 880, 90, { background: C.surface, borderRadius: 18 })} />
        <div style={abs(70, y + 70, Math.max(w, 2), 90, { background: C.accent, borderRadius: 18 })} />
        <div style={abs(70, y + 170, 940, 60, { fontFamily: MONO, fontWeight: 700, fontSize: 36, color: C.dim })}>{m.admitted} / 10 · real questions right: {m.control} / 10</div>
      </div>); })}
  </Box>);
}

function Miss({ dur, p }) {
  const inv = p.data.invented; const f = useCurrentFrame();
  const text = String(inv?.reply || "").slice(0, 260); const shown = text.slice(0, Math.floor(interpolate(f, [14, Math.min(dur - 10, 60)], [0, text.length], clamp)));
  return (<Box dur={dur}>
    <Rise style={abs(70, 280, 940, 120, { fontFamily: SANS, fontWeight: 800, fontSize: 52, lineHeight: 1.05, color: C.red })}>It does not exist.</Rise>
    <Rise delay={4} style={abs(70, 440, 940, 900, { background: C.termBg, borderRadius: 24, padding: 36, boxSizing: "border-box" })}>
      <div style={{ fontFamily: MONO, fontSize: 28, color: C.green }}>&gt; What does {inv?.subject} do, and when was it released?</div>
      <div style={{ fontFamily: MONO, fontSize: 30, lineHeight: 1.45, color: C.termText, marginTop: 28 }}>{shown}</div>
      <div style={{ fontFamily: MONO, fontSize: 24, color: "#9CA3AF", marginTop: 28 }}>{inv?.model} · real reply</div>
    </Rise>
  </Box>);
}

const Close = ({ dur }) => <Box dur={dur}><Rise style={abs(70, 520, 940, 600, { fontFamily: SANS, fontWeight: 800, fontSize: 112, lineHeight: 1.05, color: C.ink })}>Sure is not the same as <span style={{ color: C.accent }}>right.</span></Rise></Box>;
const KINDS = { hook: Hook, setup: Setup, score: Score, miss: Miss, close: Close };

function Cap({ captions }) { const f = useCurrentFrame(); const c = captions.find((x) => f >= x.from && f < x.to); if (!c) return null; return <div style={abs(60, 1590, 960, 170, { display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 24, padding: "0 28px", fontFamily: SANS, fontWeight: 700, fontSize: 54, lineHeight: 1.1, color: C.ink, textAlign: "center" })}>{c.text}</div>; }

export function AiTestedHonestyShort(props) {
  const f = useCurrentFrame();
  return (<AbsoluteFill style={{ background: C.bg }}><style>{FONT_FACES}</style>
    <div style={abs(0, 130, 1080, 50, { textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.24em", color: C.accent })}>AI  TESTED</div>
    {props.scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} p={props} /></Sequence>; })}
    <Cap captions={props.captions} />
    <div style={abs(0, 1912, 1080 * (f / props.durationInFrames), 8, { background: C.accent })} />
  </AbsoluteFill>);
}
export const honestyCompositions = [{ id: "AiTestedHonestyShort", component: AiTestedHonestyShort, durationInFrames: 780, fps: 30, width: 1080, height: 1920, defaultProps: { durationInFrames: 780, scenes: [], captions: [], data: { models: [], fake: [], invented: null } } }];
