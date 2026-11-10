// Hidden Past, Vox mixed-media collage (grammar from CK42BB/vox-explainer-skill, MIT, references/vox-style-guide.md):
// saturated outer frame, cream paper panel with halftone and grain, archival photographs as sticker cut-outs with white borders and
// soft shadows, washi tape, one accent colour with flat geometric accents, a stamp, bold condensed type, outlined captions.
// Photographs are real and never scaled or panned (channel rule): elements slide in from an edge and settle, and the background
// halftone drifts slowly for parallax. Nothing is generated.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, clamp, Scene } from "../_shared/parts.jsx";

const COND = '"Roboto Condensed", sans-serif';
const K = { frame: "#B4451F", paper: "#EFE6D2", ink: "#1A1713", dim: "#6B604E", white: "#FFFFFF", tape: "rgba(226,206,160,0.82)" };
const out = Easing.out(Easing.cubic);
const t = (f, a, b) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: out });

const Paper = ({ drift = 0 }) => (
  <AbsoluteFill style={{ background: K.frame }}>
    <div style={abs(36, 36, 1008, 1848, { background: K.paper, boxShadow: "0 0 0 6px rgba(0,0,0,0.12) inset", overflow: "hidden" })}>
      <div style={abs(-40 + drift, -40, 520, 520, { backgroundImage: `radial-gradient(${K.frame} 22%, transparent 24%)`, backgroundSize: "26px 26px", opacity: 0.22, WebkitMaskImage: "radial-gradient(circle at 20% 20%, #000 0%, transparent 70%)" })} />
      <div style={abs(500 - drift, 1330, 520, 520, { backgroundImage: `radial-gradient(${K.ink} 22%, transparent 24%)`, backgroundSize: "26px 26px", opacity: 0.12, WebkitMaskImage: "radial-gradient(circle at 80% 80%, #000 0%, transparent 70%)" })} />
    </div>
  </AbsoluteFill>
);
const Tape = ({ x, y, rot, w = 190 }) => <div style={abs(x, y, w, 56, { background: K.tape, transform: `rotate(${rot}deg)`, boxShadow: "0 2px 4px rgba(0,0,0,0.18)", backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 6px, transparent 6px 12px)" })} />;
const Tri = ({ x, y, s = 120, rot = 0 }) => <div style={abs(x, y, s, s, { background: K.frame, clipPath: "polygon(50% 0, 100% 100%, 0 100%)", transform: `rotate(${rot}deg)` })} />;
const Dot = ({ x, y, s = 70 }) => <div style={abs(x, y, s, s, { background: K.frame, borderRadius: s })} />;
/** A photograph or document as a sticker: white border, soft shadow, slight rotation. It slides in from the edge and settles; it is never scaled. */
const Sticker = ({ src, x, y, w, h, rot = 0, from = "left", delay = 0, fit = "cover" }) => {
  const f = useCurrentFrame(), a = t(f, delay, delay + 16);
  const dx = from === "left" ? -(1 - a) * 700 : from === "right" ? (1 - a) * 700 : 0, dy = from === "bottom" ? (1 - a) * 500 : 0;
  return <div style={abs(x, y, w, h, { background: K.white, padding: 16, boxSizing: "border-box", boxShadow: "10px 16px 0 rgba(26,23,19,0.18), 0 22px 40px rgba(26,23,19,0.25)", transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: Math.min(1, a * 3) })}><div style={{ width: "100%", height: "100%", backgroundImage: `url(${src})`, backgroundSize: fit, backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundColor: "#d8cfbb" }} /></div>;
};
const Title = ({ children, y = 110, size = 128, delay = 0, color = K.ink, w = 920 }) => { const f = useCurrentFrame(), a = t(f, delay, delay + 12); return <div style={abs(80, y, w, 420, { fontFamily: COND, fontWeight: 700, fontSize: size, lineHeight: 0.95, textTransform: "uppercase", letterSpacing: "-0.01em", color, opacity: a, transform: `translateX(${(1 - a) * -80}px)` })}>{children}</div>; };
const Stamp = ({ children, x, y, rot = -6, delay = 10 }) => { const f = useCurrentFrame(), a = t(f, delay, delay + 8); return <div style={abs(x, y, 520, 100, { border: `7px solid ${K.frame}`, color: K.frame, fontFamily: COND, fontWeight: 700, fontSize: 56, letterSpacing: "0.1em", display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${rot}deg) scale(${1.35 - 0.35 * a})`, opacity: a, background: "rgba(239,230,210,0.9)" })}>{children}</div>; };
const Small = ({ children, y, x = 80, w = 920, color = K.dim, size = 26 }) => <div style={abs(x, y, w, 70, { fontFamily: COND, fontWeight: 400, fontSize: size, lineHeight: 1.3, color })}>{children}</div>;

function Press({ dur, images, credits }) {
  const f = useCurrentFrame();
  return (<Scene dur={dur}><Paper drift={f * 0.4} />
    <Tri x={860} y={90} s={110} rot={14} /><Title>It was announced<br />too early</Title>
    <Sticker src={images.press} x={90} y={640} w={900} h={640} rot={-1.6} from="left" delay={4} fit="contain" />
    <Tape x={70} y={620} rot={-34} /><Tape x={820} y={1250} rot={-30} />
    <Stamp x={470} y={1330} delay={14}>9 NOV 1989</Stamp>
    <Small y={1475}>Photo: {credits.press}</Small></Scene>);
}
function Note({ dur, images, credits }) {
  const f = useCurrentFrame();
  return (<Scene dur={dur}><Paper drift={f * 0.4} />
    <Title>The note</Title><Dot x={860} y={120} />
    <Sticker src={images.note} x={230} y={330} w={620} h={880} rot={2.2} from="right" delay={4} fit="contain" />
    <Tape x={410} y={300} rot={-4} /><Tape x={640} y={1170} rot={6} w={170} />
    <div style={abs(110, 1250, 640, 96, { background: K.frame, color: K.paper, fontFamily: COND, fontWeight: 700, fontSize: 46, letterSpacing: "0.04em", textTransform: "uppercase", display: "flex", alignItems: "center", padding: "0 28px", boxSizing: "border-box", transform: "rotate(-2deg)" })}>Handed to him, no instructions</div>
    <Small y={1475}>Image: {credits.note}</Small></Scene>);
}
const TIMES = [["18:00", "Press conference starts, live on TV"], ["18:53", "Asked when the rules begin"], ["19:04", "West German agency: borders open"]];
function Quote({ dur }) {
  const f = useCurrentFrame();
  return (<Scene dur={dur}><Paper drift={f * 0.4} />
    <div style={abs(80, 120, 920, 700, { background: K.frame, transform: `rotate(-1.2deg) translateX(${(1 - t(f, 0, 14)) * -900}px)`, boxShadow: "10px 16px 0 rgba(26,23,19,0.2)" })} />
    <div style={abs(130, 190, 820, 440, { fontFamily: COND, fontWeight: 700, fontSize: 150, lineHeight: 0.95, textTransform: "uppercase", color: K.paper, opacity: t(f, 8, 20) })}>“Immediately, without delay.”</div>
    <div style={abs(130, 700, 820, 70, { fontFamily: COND, fontWeight: 400, fontSize: 30, color: K.paper, opacity: t(f, 14, 26) })}>Günter Schabowski, 9 Nov 1989 (English rendering, Wikipedia)</div>
    {TIMES.map(([tm, label], i) => { const a = t(f, 20 + i * 12, 32 + i * 12); return (
      <div key={tm} style={abs(100, 900 + i * 190, 880, 150, { opacity: a, transform: `translateX(${(1 - a) * 500}px) rotate(${i % 2 ? 1 : -1}deg)`, background: K.white, boxShadow: "8px 12px 0 rgba(26,23,19,0.16)", display: "flex", alignItems: "center", gap: 28, padding: "0 30px", boxSizing: "border-box" })}>
        <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 84, color: i === 2 ? K.frame : K.ink }}>{tm}</div>
        <div style={{ fontFamily: COND, fontWeight: 400, fontSize: 38, lineHeight: 1.1, color: K.dim }}>{label}</div>
      </div>); })}
  </Scene>);
}
function Night({ dur, images, credits }) {
  const f = useCurrentFrame();
  return (<Scene dur={dur}><Paper drift={f * 0.4} />
    <Title>That night</Title><Tri x={850} y={110} s={120} rot={-10} />
    <Sticker src={images.gate} x={90} y={330} w={900} h={640} rot={1.4} from="bottom" delay={4} />
    <Tape x={90} y={310} rot={-30} /><Tape x={810} y={940} rot={-28} />
    <Small y={1000} color={K.frame} size={30}>LATER PHOTO: BRANDENBURG GATE, DECEMBER 1989</Small>
    <div style={abs(100, 1090, 880, 190, { background: K.white, boxShadow: "8px 12px 0 rgba(26,23,19,0.16)", display: "flex", alignItems: "center", gap: 28, padding: "0 30px", boxSizing: "border-box", opacity: t(f, 16, 28), transform: `translateX(${(1 - t(f, 16, 28)) * 500}px) rotate(-1deg)` })}>
      <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 96, color: K.frame }}>22:45</div>
      <div style={{ fontFamily: COND, fontWeight: 400, fontSize: 38, lineHeight: 1.1, color: K.dim }}>Bornholmer Straße checkpoint opens<br /><span style={{ fontSize: 28 }}>(some accounts: 23:30)</span></div>
    </div>
    <Small y={1475}>Photo: {credits.gate}</Small></Scene>);
}
const KINDS = { press: Press, note: Note, quote: Quote, night: Night };

function Cap({ captions }) {
  const f = useCurrentFrame(); const c = captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  return <div style={abs(70, 1590, 940, 220, { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "0 14px", fontFamily: COND, fontWeight: 700, fontSize: 70, lineHeight: 1.05, textAlign: "center" })}>
    {(c.words || [{ text: c.text, from: c.from }]).map((w, i) => <span key={i} style={{ color: f >= w.from ? K.white : "rgba(255,255,255,0.55)", WebkitTextStroke: "9px #111", paintOrder: "stroke fill", textShadow: "4px 5px 0 #111" }}>{w.text}</span>)}
  </div>;
}

export function HiddenPastCollageShort({ durationInFrames, scenes, captions, images, credits }) {
  const f = useCurrentFrame();
  return (<AbsoluteFill style={{ background: K.frame }}><style>{FONT_FACES}</style>
    {scenes.map((s) => { const C = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><C dur={s.to - s.from} images={images} credits={credits} /></Sequence>; })}
    <Cap captions={captions} />
    <div style={abs(36, 1884, 1008 * (f / durationInFrames), 8, { background: K.ink })} />
  </AbsoluteFill>);
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 780, defaultProps: { durationInFrames: 780, scenes: [], captions: [] } };
export const collageCompositions = [{ id: "HiddenPastCollageShort", component: HiddenPastCollageShort, ...base, defaultProps: { ...base.defaultProps, images: {}, credits: {} } }];
