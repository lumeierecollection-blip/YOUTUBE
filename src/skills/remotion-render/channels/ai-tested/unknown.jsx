// AI Tested: "Will AI admit when it doesn't know?" Same layered look as the privacy video. Twelve invented names, three models, one square per answer.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, clamp } from "../_shared/parts.jsx";
import { K, COND, MONO, ramp, over, Board, Card, Logo, Title, Strip, Stamp, Cap } from "./privacy.jsx";

const logoOf = (m, images) => (/gpt|openai/i.test(m.name) ? images.openai : images.gemini);

function Hook({ images, d }) {
  return (<>
    <Title size={190} delay={0}>{d.made} of {d.all}</Title>
    <Strip x={60} y={420} w={960} delay={6} size={46}>invented things described as real</Strip>
    <Card x={60} y={660} w={420} h={230} rot={-4} from="left" delay={4} tapes={[[130, -18, -6, 150]]} pad={30}><Logo src={images.gemini} w={360} h={170} /></Card>
    <Card x={560} y={740} w={420} h={230} rot={3} from="right" delay={8} tapes={[[130, -18, 5, 150]]} pad={30}><Logo src={images.openai} w={360} h={170} /></Card>
    <Stamp x={250} y={1040} w={580} rot={-5} delay={14} size={72} color={K.hot}>Made up</Stamp>
  </>);
}
function Fakes({ d }) {
  const f = useCurrentFrame(), tilt = [-2, 1.5, -1, 2, -2, 1, -1.5, 2, -1, 1.5, -2, 1];
  return (<>
    <Title size={92} delay={0} w={960}>{d.fakes} things that do not exist</Title>
    {d.fakeLabels.map((t, i) => { const c = i % 3, r = Math.floor(i / 3), a = ramp(f, 3 + i * 2, 11 + i * 2, over); return (
      <div key={i} style={abs(60 + c * 322, 330 + r * 255, 300, 215, { background: i % 2 ? "#FDE68A" : "#FFFFFF", boxShadow: "8px 12px 0 rgba(15,23,42,0.14)", padding: "22px 20px", boxSizing: "border-box", fontFamily: COND, fontWeight: 700, fontSize: 40, lineHeight: 1.05, color: K.ink, textTransform: "uppercase", transform: `rotate(${tilt[i]}deg) scale(${0.5 + 0.5 * a})`, opacity: a })}>{t}</div>); })}
    <Stamp x={300} y={1300} w={480} rot={-6} delay={30} size={64} color={K.hot}>Invented</Stamp>
  </>);
}
function Models({ images, d }) {
  return (<>
    <Title size={100} delay={0} w={960}>Same question, {d.models.length} models</Title>
    {d.models.map((m, i) => <Card key={m.id + i} x={d.models.length === 2 ? 110 + i * 460 : 70 + i * 320} y={360 + (i % 2) * 40} w={d.models.length === 2 ? 400 : 300} h={d.models.length === 2 ? 260 : 210} rot={[-3, 2, -2][i]} from={["left", "right", "bottom"][i]} delay={3 + i * 4} pad={22}><Logo src={logoOf(m, images)} w={d.models.length === 2 ? 356 : 256} h={d.models.length === 2 ? 210 : 160} /></Card>)}
    <Card x={110} y={760} w={860} h={330} rot={-1} from="bottom" delay={14} pad={36} bg={K.frame} style={{ color: K.paper }}>
      <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: "0.1em", opacity: 0.8 }}>YOU</div>
      <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 64, lineHeight: 1.06, marginTop: 10 }}>Tell me about … Keep it to two sentences.</div>
    </Card>
  </>);
}
function Results({ images, d }) {
  const f = useCurrentFrame(), n = d.models.length, rowH = Math.min(420, 1080 / n);
  return (<>
    <Title size={92} delay={0} w={960}>Did it admit it?</Title>
    {d.models.map((m, mi) => { const y0 = 330 + mi * rowH, at = 6 + mi * 20, cell = 66, shown = Math.floor(interpolate(f, [at, at + 24], [0, m.seq.length], clamp)); return (
      <div key={m.id + mi}>
        <Card x={60} y={y0} w={250} h={130} rot={-2} from="left" delay={at - 4} pad={16}><Logo src={logoOf(m, images)} w={218} h={98} /></Card>
        <div style={abs(340, y0 + 40, 680, 60, { fontFamily: COND, fontWeight: 700, fontSize: 46, color: K.ink, textTransform: "uppercase" })}>{m.name}</div>
        {m.seq.map((o, i) => <div key={i} style={abs(60 + i * (cell + 8), y0 + 160, cell, cell, { borderRadius: 10, background: i < shown ? (o === "made_up" ? K.hot : K.frame) : K.soft })} />)}
        <div style={abs(60, y0 + 235, 960, 130, { display: "flex", alignItems: "baseline", gap: 22, opacity: ramp(f, at + 22, at + 32) })}>
          <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 130, lineHeight: 1, color: m.made_up ? K.hot : K.frame }}>{m.made_up}</span>
          <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 48, color: K.ink, textTransform: "uppercase" }}>of {m.fakes} made up</span>
        </div>
      </div>); })}
    <div style={abs(60, 1456, 960, 40, { display: "flex", gap: 34, fontFamily: COND, fontWeight: 700, fontSize: 28, color: K.dim, textTransform: "uppercase" })}>
      <span><span style={{ display: "inline-block", width: 24, height: 24, background: K.hot, marginRight: 10, verticalAlign: "-3px" }} />described it as real</span>
      <span><span style={{ display: "inline-block", width: 24, height: 24, background: K.frame, marginRight: 10, verticalAlign: "-3px" }} />admitted not knowing</span>
    </div>
  </>);
}
function Control({ d }) {
  const f = useCurrentFrame();
  return (<>
    <Title size={100} delay={0} w={960}>The control: real topics</Title>
    {d.realLabels.map((t, i) => { const a = ramp(f, 4 + i * 6, 12 + i * 6, over); return (
      <div key={i} style={abs(80, 360 + i * 190, 920, 150, { background: K.white, boxShadow: "8px 12px 0 rgba(15,23,42,0.14)", padding: "0 36px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: COND, fontWeight: 700, fontSize: 54, textTransform: "uppercase", color: K.ink, transform: `translateX(${(1 - a) * 800}px) rotate(${i % 2 ? 0.8 : -0.8}deg)`, opacity: a })}>
        <span>{t}</span><span style={{ color: K.frame, fontSize: 76 }}>✓</span>
      </div>); })}
    <Strip x={80} y={1150} w={920} delay={30} size={32}>Answered as normal, not flagged as unknown</Strip>
  </>);
}
function Example({ d }) {
  const e = d.example, f = useCurrentFrame();
  if (!e) return null;
  const reply = String(e.reply || "").replace(/\s+/g, " ").trim(), cut = reply.length > 280 ? `${reply.slice(0, 279)}…` : reply, made = e.outcome === "made_up";
  return (<>
    <Title size={96} delay={0} w={960}>{made ? "A real invented answer" : "A real answer"}</Title>
    <Card x={70} y={330} w={800} h={230} rot={-1.2} from="left" delay={2} pad={30} bg={K.frame} style={{ color: K.paper }}>
      <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.1em", opacity: 0.8 }}>YOU</div>
      <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 50, lineHeight: 1.08, marginTop: 10 }}>{e.ask}</div>
    </Card>
    <Card x={170} y={640} w={840} h={560} rot={1} from="right" delay={14} pad={30}>
      <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.1em", color: K.dim }}>{e.speak.toUpperCase()}</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 36, lineHeight: 1.4, marginTop: 10, color: K.ink, opacity: ramp(f, 18, 30) }}>{cut}</div>
    </Card>
    <Stamp x={600} y={1250} w={400} rot={-6} delay={34} size={62} color={made ? K.hot : K.frame}>{made ? "Made up" : "Admitted"}</Stamp>
  </>);
}
function Tip({ d }) {
  return (<>
    <Title size={130} delay={0}>{d.anyMade ? "Confident is not true" : "Check anyway"}</Title>
    <Stamp x={110} y={640} w={860} rot={-4} delay={10} size={92}>Ask for<br />the source</Stamp>
    <Strip x={110} y={1000} w={620} delay={18} size={44} bg={K.ink}>Then click it</Strip>
    <Strip x={110} y={1160} w={860} delay={34} size={44}>Has AI made things up for you?</Strip>
  </>);
}

const BEATS = { hook: Hook, fakes: Fakes, models: Models, results: Results, control: Control, example: Example, tip: Tip };
export function AiTestedUnknown({ durationInFrames, scenes, captions, images, data }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: K.frame }}><style>{FONT_FACES}</style>
      <Board f={f} />
      <div style={abs(80, 1516, 920, 40, { fontFamily: COND, fontWeight: 700, fontSize: 26, letterSpacing: "0.12em", color: K.dim, textTransform: "uppercase" })}>AI Tested · Will AI admit when it doesn't know?</div>
      {scenes.map((s) => { const B = BEATS[s.kind]; return B ? <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><AbsoluteFill><B images={images} d={data} /></AbsoluteFill></Sequence> : null; })}
      <Cap captions={captions} />
      <div style={abs(36, 1884, 1008 * (f / durationInFrames), 8, { background: K.ink })} />
    </AbsoluteFill>
  );
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 960, defaultProps: { durationInFrames: 960, scenes: [], captions: [], images: {}, data: { models: [], fakeLabels: [], realLabels: [], example: null, fakes: 12, anyMade: false } } };
export const unknownCompositions = [{ id: "AiTestedUnknown", component: AiTestedUnknown, ...base }];
