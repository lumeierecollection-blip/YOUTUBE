// AI Tested: "Does AI agree when you say you are an expert?" Same layered look as the unknown/privacy videos. Result first, then one real pair of replies.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, clamp } from "../_shared/parts.jsx";
import { K, COND, MONO, ramp, over, Board, Card, Logo, Title, Strip, Stamp, Cap } from "./privacy.jsx";

const logoOf = (m, images) => (/gpt|openai/i.test(m.name) ? images.openai : images.gemini);
const clean = (t, n) => { const s = String(t || "").replace(/[*_`#]+/g, "").replace(/\s+/g, " ").trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

function Hook({ images, d }) {
  return (<>
    <Title size={190} delay={0}>{d.caved} of {d.base}</Title>
    <Strip x={60} y={420} w={960} delay={6} size={44}>{d.anyCaved ? "false claims agreed with after “I’m an expert”" : "false claims still rejected after “I’m an expert”"}</Strip>
    <Card x={60} y={680} w={420} h={230} rot={-4} from="left" delay={4} tapes={[[130, -18, -6, 150]]} pad={30}><Logo src={images.gemini} w={360} h={170} /></Card>
    <Card x={560} y={760} w={420} h={230} rot={3} from="right" delay={8} tapes={[[130, -18, 5, 150]]} pad={30}><Logo src={images.openai} w={360} h={170} /></Card>
    <Stamp x={250} y={1060} w={580} rot={-5} delay={14} size={72} color={d.anyCaved ? K.hot : K.frame}>{d.anyCaved ? "Agreed" : "Held firm"}</Stamp>
  </>);
}
function Example({ d }) {
  const e = d.example, f = useCurrentFrame();
  if (!e) return null;
  const agreed = e.outcome === "caved";
  return (<>
    <Title size={88} delay={0} w={960}>{e.label}</Title>
    <Card x={60} y={290} w={900} h={380} rot={-0.8} from="left" delay={2} pad={26}>
      <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.1em", color: K.dim }}>ASKED PLAINLY · {e.speak.toUpperCase()}</div>
      <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 40, lineHeight: 1.08, marginTop: 8, color: K.frame, textTransform: "uppercase" }}>{clean(e.ask_plain.replace(/ Reply with.*$/, ""), 120)}</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 32, lineHeight: 1.35, marginTop: 14, color: K.ink, opacity: ramp(f, 8, 18) }}>{clean(e.plain_reply, 150)}</div>
    </Card>
    <Card x={120} y={720} w={900} h={560} rot={1} from="right" delay={16} pad={26} bg={K.frame} style={{ color: K.paper }}>
      <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.1em", opacity: 0.85 }}>“I’M {e.who.replace(/^an? /, "A ").toUpperCase()}” · {e.speak.toUpperCase()}</div>
      <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 40, lineHeight: 1.08, marginTop: 8, textTransform: "uppercase" }}>{clean(e.ask_pressed.replace(/ Reply with.*$/, ""), 170)}</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 32, lineHeight: 1.35, marginTop: 14, opacity: ramp(f, 26, 36) }}>{clean(e.pressed_reply, 150)}</div>
    </Card>
    <Stamp x={640} y={1310} w={380} rot={-6} delay={40} size={58} color={agreed ? K.hot : K.frame}>{agreed ? "Gave in" : "Held"}</Stamp>
  </>);
}
function Design({ images, d }) {
  const f = useCurrentFrame(), tilt = [-2, 1.5, -1, 2, -2, 1, -1.5, 2, -1, 1.5, -2, 1];
  return (<>
    <Title size={92} delay={0} w={960}>{d.myths} false myths, asked twice</Title>
    {d.labels.map((t, i) => { const c = i % 3, r = Math.floor(i / 3), a = ramp(f, 3 + i * 2, 11 + i * 2, over); return (
      <div key={i} style={abs(60 + c * 322, 330 + r * 215, 300, 185, { background: i % 2 ? "#FDE68A" : "#FFFFFF", boxShadow: "8px 12px 0 rgba(15,23,42,0.14)", padding: "18px 18px", boxSizing: "border-box", fontFamily: COND, fontWeight: 700, fontSize: 36, lineHeight: 1.05, color: K.ink, textTransform: "uppercase", transform: `rotate(${tilt[i]}deg) scale(${0.5 + 0.5 * a})`, opacity: a })}>{t}</div>); })}
    <Strip x={60} y={1220} w={440} delay={26} size={36}>1 · Plain question</Strip>
    <Strip x={540} y={1220} w={480} delay={32} size={36} bg={K.ink}>2 · “I’m an expert”</Strip>
  </>);
}
function Results({ images, d }) {
  const f = useCurrentFrame(), n = d.models.length, rowH = Math.min(420, 1080 / n);
  return (<>
    <Title size={92} delay={0} w={960}>Did it give in?</Title>
    {d.models.map((m, mi) => { const y0 = 330 + mi * rowH, at = 6 + mi * 20, cell = 66, shown = Math.floor(interpolate(f, [at, at + 24], [0, m.seq.length], clamp)); return (
      <div key={m.id + mi}>
        <Card x={60} y={y0} w={250} h={130} rot={-2} from="left" delay={at - 4} pad={16}><Logo src={logoOf(m, images)} w={218} h={98} /></Card>
        <div style={abs(340, y0 + 40, 680, 60, { fontFamily: COND, fontWeight: 700, fontSize: 46, color: K.ink, textTransform: "uppercase" })}>{m.name}</div>
        {m.seq.map((o, i) => <div key={i} style={abs(60 + i * (cell + 8), y0 + 160, cell, cell, { borderRadius: 10, background: i < shown ? (o === "caved" ? K.hot : o === "held" ? K.frame : K.soft) : K.soft, opacity: o === "skip" ? 0.5 : 1 })} />)}
        <div style={abs(60, y0 + 235, 960, 130, { display: "flex", alignItems: "baseline", gap: 22, opacity: ramp(f, at + 22, at + 32) })}>
          <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 130, lineHeight: 1, color: m.caved ? K.hot : K.frame }}>{m.caved}</span>
          <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 48, color: K.ink, textTransform: "uppercase" }}>of {m.plain_right} agreed</span>
        </div>
      </div>); })}
    <div style={abs(60, 1456, 960, 40, { display: "flex", gap: 34, fontFamily: COND, fontWeight: 700, fontSize: 28, color: K.dim, textTransform: "uppercase" })}>
      <span><span style={{ display: "inline-block", width: 24, height: 24, background: K.hot, marginRight: 10, verticalAlign: "-3px" }} />agreed with myth</span>
      <span><span style={{ display: "inline-block", width: 24, height: 24, background: K.frame, marginRight: 10, verticalAlign: "-3px" }} />held firm</span>
    </div>
  </>);
}
function Tip({ d }) {
  return (<>
    <Title size={120} delay={0}>A title is not a fact</Title>
    <Stamp x={110} y={640} w={860} rot={-4} delay={10} size={88}>Ask AI to<br />check you</Stamp>
    <Strip x={110} y={1000} w={700} delay={18} size={44} bg={K.ink}>Not to agree with you</Strip>
    <Strip x={110} y={1160} w={860} delay={34} size={44}>Has AI ever just agreed?</Strip>
  </>);
}

const BEATS = { hook: Hook, example: Example, design: Design, results: Results, tip: Tip };
export function AiTestedExpert({ durationInFrames, scenes, captions, images, data }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: K.frame }}><style>{FONT_FACES}</style>
      <Board f={f} />
      <div style={abs(80, 1516, 920, 40, { fontFamily: COND, fontWeight: 700, fontSize: 26, letterSpacing: "0.12em", color: K.dim, textTransform: "uppercase" })}>AI Tested · Does AI agree when you say you are an expert?</div>
      {scenes.map((s) => { const B = BEATS[s.kind]; return B ? <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><AbsoluteFill><B images={images} d={data} /></AbsoluteFill></Sequence> : null; })}
      <Cap captions={captions} />
      <div style={abs(36, 1884, 1008 * (f / durationInFrames), 8, { background: K.ink })} />
    </AbsoluteFill>
  );
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 960, defaultProps: { durationInFrames: 960, scenes: [], captions: [], images: {}, data: { models: [], labels: [], example: null, myths: 12, caved: 0, base: 0, anyCaved: false } } };
export const expertCompositions = [{ id: "AiTestedExpert", component: AiTestedExpert, ...base }];
