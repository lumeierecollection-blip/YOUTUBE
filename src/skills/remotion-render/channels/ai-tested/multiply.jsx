// AI Tested: "Can AI multiply big numbers?" The same layered look as the expert / unknown / privacy videos (saturated frame, paper panel, taped cards, stamps,
// giant numerals). Result first, then the digit-by-digit proof, then the sizes, the collapse, the fix. Every number comes from the stored test (multiply-data.json).
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs } from "../_shared/parts.jsx";
import { K, COND, MONO, ramp, over, Board, Card, Title, Num, Strip, Stamp, Cap } from "./privacy.jsx";

const GOOD = "#15803D";
// one digit per cell; digits that differ from the correct product are marked red
const Digits = ({ text, against, size = 54, delay = 0, color = K.ink }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: size, letterSpacing: "0.04em", lineHeight: 1.15, display: "flex", flexWrap: "wrap" }}>
      {[...text].map((c, i) => { const bad = against && c !== against[i], a = ramp(f, delay + i * 1.2, delay + i * 1.2 + 6); return <span key={i} style={{ color: bad ? K.hot : color, opacity: a, background: bad ? "rgba(194,65,12,0.14)" : "none" }}>{c}</span>; })}
    </div>
  );
};

function Hook({ d }) {
  return (<>
    <Title size={120} delay={0} w={960}>The first 4 digits were right</Title>
    <Num x={60} y={520} size={420} delay={4} color={GOOD}>4</Num>
    <Strip x={420} y={640} w={600} delay={10} size={50}>of 16 digits right</Strip>
    <Card x={80} y={1000} w={920} h={290} rot={-1.5} from="left" delay={8} tapes={[[380, -20, -3, 170]]} pad={28}>
      <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: "0.1em", color: K.dim }}>{d.model.toUpperCase()} · ASKED TO MULTIPLY</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 60, marginTop: 14, color: K.ink }}>{d.miss.a} × {d.miss.b}</div>
    </Card>
    <Stamp x={560} y={1320} w={420} rot={-6} delay={26} size={60} color={K.hot}>Wrong</Stamp>
  </>);
}
function Example({ d }) {
  return (<>
    <Title size={96} delay={0} w={960}>Same length. Wrong number.</Title>
    <Card x={60} y={330} w={960} h={430} rot={-1} from="left" delay={2} pad={28} tapes={[[400, -20, -2, 170]]}>
      <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: "0.1em", color: K.dim }}>THE MODEL SAID · {d.miss.answer.length} DIGITS</div>
      <div style={{ marginTop: 24 }}><Digits text={d.miss.answer} against={d.miss.correct} size={70} delay={6} /></div>
      <div style={{ fontFamily: MONO, fontSize: 24, color: K.hot, marginTop: 20 }}>red = a digit that differs</div>
    </Card>
    <Card x={60} y={850} w={960} h={430} rot={1} from="right" delay={16} pad={28} bg={K.frame} style={{ color: K.paper }}>
      <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: "0.1em", opacity: 0.9 }}>THE CORRECT PRODUCT (COMPUTED BY CODE)</div>
      <div style={{ marginTop: 24 }}><Digits text={d.miss.correct} size={70} delay={20} color={K.paper} /></div>
    </Card>
    <Stamp x={120} y={1380} w={560} rot={-4} delay={40} size={50} color={K.hot}>5th digit: first miss</Stamp>
  </>);
}
function Design() {
  const f = useCurrentFrame(), sizes = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (<>
    <Title size={96} delay={0} w={960}>Two to ten digits</Title>
    {sizes.map((n, i) => { const c = i % 3, r = Math.floor(i / 3), a = ramp(f, 3 + i * 2, 11 + i * 2, over); return (
      <div key={n} style={abs(60 + c * 322, 360 + r * 250, 300, 215, { background: i % 2 ? "#FDE68A" : "#FFFFFF", boxShadow: "8px 12px 0 rgba(15,23,42,0.14)", padding: 20, boxSizing: "border-box", transform: `scale(${0.6 + 0.4 * a}) rotate(${[-2, 1.5, -1][c]}deg)`, opacity: a })}>
        <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 120, lineHeight: 1, color: K.frame }}>{n}</div>
        <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 34, color: K.ink, textTransform: "uppercase" }}>digits</div>
        <div style={{ fontFamily: MONO, fontSize: 26, color: K.dim, marginTop: 6 }}>10 problems</div>
      </div>); })}
    <Strip x={60} y={1170} w={900} delay={26} size={42}>One attempt each · temperature 0</Strip>
    <Strip x={60} y={1290} w={900} delay={32} size={42} bg={K.ink}>Code checked every digit</Strip>
  </>);
}
function Results({ d }) {
  const f = useCurrentFrame(), sizes = Object.keys(d.direct).map(Number).sort((a, b) => a - b), W = 98, H = 640, x0 = 70, base = 950;
  return (<>
    <Title size={84} delay={0} w={960}>Right answers by size</Title>
    {sizes.map((n, i) => { const r = d.direct[n], hgt = (r.right / r.of) * H, grow = ramp(f, 6 + i * 4, 18 + i * 4), x = x0 + i * (W + 12); return (
      <div key={n}>
        <div style={abs(x, base - H, W, H, { background: K.soft })} />
        <div style={abs(x, base - Math.max(hgt * grow, r.right ? 0 : 6), W, Math.max(hgt * grow, r.right ? 0 : 6), { background: r.right === r.of ? GOOD : r.right ? K.frame : K.hot })} />
        <div style={abs(x, base + 12, W, 60, { fontFamily: COND, fontWeight: 700, fontSize: 52, color: K.ink, textAlign: "center" })}>{n}</div>
        <div style={abs(x, base - H - 64, W, 60, { fontFamily: COND, fontWeight: 700, fontSize: 46, color: r.right ? K.ink : K.hot, textAlign: "center", opacity: ramp(f, 14 + i * 4, 24 + i * 4) })}>{r.right}</div>
      </div>); })}
    <div style={abs(x0, base + 90, 960, 50, { fontFamily: COND, fontWeight: 700, fontSize: 32, color: K.dim, textTransform: "uppercase", letterSpacing: "0.08em" })}>digits in each number · right out of 10</div>
    <Stamp x={470} y={1210} w={520} rot={-5} delay={44} size={56} color={K.hot}>Zero from 6 digits</Stamp>
  </>);
}
function Fix({ d }) {
  const f = useCurrentFrame(), sizes = ["6", "7", "8", "9", "10"], BH = 480, base = 900;
  return (<>
    <Title size={96} delay={0} w={960}>Show your working</Title>
    {sizes.map((n, i) => { const w = d.worked[n], grow = ramp(f, 6 + i * 4, 20 + i * 4), x = 80 + i * 188, h = (w.right / w.of) * BH * grow; return (
      <div key={n}>
        <div style={abs(x, base - h, 70, h, { background: GOOD })} />
        <div style={abs(x + 76, base - 6, 70, 6, { background: K.hot })} />
        <div style={abs(x, base + 14, 150, 56, { fontFamily: COND, fontWeight: 700, fontSize: 48, color: K.ink })}>{n}</div>
        <div style={abs(x, base - h - 56, 100, 50, { fontFamily: COND, fontWeight: 700, fontSize: 40, color: GOOD, opacity: ramp(f, 16 + i * 4, 26 + i * 4) })}>{w.right}/{w.of}</div>
      </div>); })}
    <div style={abs(80, base + 90, 940, 40, { fontFamily: COND, fontWeight: 700, fontSize: 30, color: K.dim, textTransform: "uppercase" })}><span style={{ color: GOOD }}>■</span> working shown <span style={{ color: K.hot, marginLeft: 22 }}>■</span> number only: 0 of 5 at every size</div>
    <Num x={60} y={1080} size={220} delay={30} color={GOOD}>{d.wRight}</Num>
    <Strip x={380} y={1175} w={640} delay={34} size={52}>of {d.wOf} right</Strip>
  </>);
}
function Tip() {
  return (<>
    <Title size={120} delay={0}>Make AI show its working</Title>
    <Stamp x={110} y={700} w={860} rot={-4} delay={10} size={80}>Or check<br />it with code</Stamp>
    <Strip x={110} y={1100} w={860} delay={30} size={46}>Would you have checked?</Strip>
  </>);
}

const BEATS = { hook: Hook, example: Example, design: Design, results: Results, fix: Fix, tip: Tip };
export function AiTestedMultiply({ durationInFrames, scenes, captions, data }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: K.frame }}><style>{FONT_FACES}</style>
      <Board f={f} />
      <div style={abs(80, 1516, 920, 40, { fontFamily: COND, fontWeight: 700, fontSize: 26, letterSpacing: "0.12em", color: K.dim, textTransform: "uppercase" })}>AI Tested · Can AI multiply big numbers?</div>
      {scenes.map((s) => { const B = BEATS[s.kind]; return B ? <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><AbsoluteFill><B d={data} /></AbsoluteFill></Sequence> : null; })}
      <Cap captions={captions} />
      <div style={abs(36, 1884, 1008 * (f / durationInFrames), 8, { background: K.ink })} />
    </AbsoluteFill>
  );
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 1100, defaultProps: { durationInFrames: 1100, scenes: [], captions: [], data: null } };
export const multiplyCompositions = [{ id: "AiTestedMultiply", component: AiTestedMultiply, ...base }];
