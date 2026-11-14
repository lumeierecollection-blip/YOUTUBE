// AI Tested: Gemini 4 Hydrogen vs the older model. Faceless, serious news-card look: near-black ground, one serif for the big numbers, a ranked table card with its
// "Source:" line, one accent colour per meaning (green = right, red = wrong, gold = the row to read). No characters, no stock footage, no third-party images:
// every picture is built from the stored test (gemini4-data.json). Look and pacing follow the faceless explainer Shorts measured on 14 Nov 2026 (card grammar only).
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, clamp } from "../_shared/parts.jsx";

const SERIF = '"Playfair Display", "Noto Serif", serif', SANS = '"Inter", "DM Sans", sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace';
const C = { bg: "#090C12", card: "#121823", line: "#232C3B", text: "#F2EFE8", dim: "#8D97A8", good: "#3DD68C", bad: "#F0555B", gold: "#E3B85C" };
const out = Easing.out(Easing.cubic);
const ramp = (f, a, b, e = out) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

const Fade = ({ delay = 0, dy = 24, children, style }) => { const f = useCurrentFrame(), a = ramp(f, delay, delay + 10); return <div style={{ ...style, opacity: a, transform: `translateY(${(1 - a) * dy}px)` }}>{children}</div>; };
const Label = ({ y, children, color = C.dim, size = 34, delay = 0 }) => <Fade delay={delay} style={abs(80, y, 920, size * 2.4, { fontFamily: SANS, fontWeight: 600, fontSize: size, letterSpacing: "0.16em", textTransform: "uppercase", color, lineHeight: 1.25 })}>{children}</Fade>;
const Big = ({ y, size = 360, color = C.text, children, delay = 0, align = "left", x = 80, w = 920 }) => <Fade delay={delay} dy={40} style={abs(x, y, w, size * 1.1, { fontFamily: SERIF, fontWeight: 800, fontSize: size, lineHeight: 1, color, textAlign: align })}>{children}</Fade>;
const Rule = ({ y, delay = 0, color = C.gold }) => { const f = useCurrentFrame(); return <div style={abs(80, y, 920 * ramp(f, delay, delay + 14), 5, { background: color })} />; };
const Source = ({ children }) => <div style={abs(80, 1500, 920, 40, { fontFamily: SANS, fontSize: 28, color: C.dim, letterSpacing: "0.04em" })}>Source: {children}</div>;

function Digits({ text, against, size = 56, delay = 0, good = true }) {
  const f = useCurrentFrame();
  return <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: size, letterSpacing: "0.05em", lineHeight: 1.25, wordBreak: "break-all" }}>
    {[...text].map((c, i) => { const bad = against && c !== against[i]; return <span key={i} style={{ opacity: ramp(f, delay + i * 1.1, delay + i * 1.1 + 5), color: bad ? C.bad : good ? C.good : C.text }}>{c}</span>; })}
  </div>;
}

function Hook({ d }) {
  const hb = d.hydrogen.big, ob = d.older.big;
  return (<>
    <Label y={150} delay={0}>Multiplying 6 to 10 digit numbers</Label>
    <Label y={260} size={30} delay={4} color={C.dim}>Number only · 50 problems each</Label>
    <Rule y={340} delay={6} />
    <Big y={420} size={300} color={C.bad} delay={6}>{ob.right}<span style={{ fontSize: 130, color: C.dim }}> / {ob.of}</span></Big>
    <Label y={790} delay={12} color={C.text}>{d.old_model}</Label>
    <Big y={900} size={300} color={C.good} delay={20}>{hb.right}<span style={{ fontSize: 130, color: C.dim }}> / {hb.of}</span></Big>
    <Label y={1290} delay={26} color={C.text}>{d.new_model}</Label>
    <Source>AI Tested · GitHub Actions · {d.date}</Source>
  </>);
}
function Example({ d }) {
  const e = d.example;
  return (<>
    <Label y={150} delay={0}>One 10-digit × 10-digit problem</Label>
    <Fade delay={3} style={abs(80, 250, 920, 130, { fontFamily: MONO, fontWeight: 700, fontSize: 40, color: C.text, lineHeight: 1.35, wordBreak: "break-all" })}>{e.a} × {e.b}</Fade>
    <Fade delay={8} style={abs(60, 470, 960, 420, { background: C.card, borderLeft: `8px solid ${C.bad}`, padding: "30px 36px", boxSizing: "border-box" })}>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 30, letterSpacing: "0.12em", color: C.dim, textTransform: "uppercase", marginBottom: 18 }}>{d.old_model}</div>
      <Digits text={e.older} against={e.correct} size={66} delay={12} good={false} />
      <div style={{ fontFamily: SANS, fontSize: 30, color: C.bad, marginTop: 18 }}>Digits after the fourth are wrong</div>
    </Fade>
    <Fade delay={30} style={abs(60, 960, 960, 420, { background: C.card, borderLeft: `8px solid ${C.good}`, padding: "30px 36px", boxSizing: "border-box" })}>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 30, letterSpacing: "0.12em", color: C.dim, textTransform: "uppercase", marginBottom: 18 }}>{d.new_model}</div>
      <Digits text={e.hydrogen} size={66} delay={34} />
      <div style={{ fontFamily: SANS, fontSize: 30, color: C.good, marginTop: 18 }}>All 20 digits match the code's answer</div>
    </Fade>
    <Source>AI Tested · GitHub Actions · {d.date}</Source>
  </>);
}
function Design({ d }) {
  return (<>
    <Label y={150} delay={0}>The test</Label>
    <Rule y={230} delay={2} />
    <Big y={300} size={420} delay={4}>{d.hydrogen.all.of}</Big>
    <Label y={760} delay={10} color={C.text} size={46}>multiplications, 2 to 10 digits</Label>
    {[["Same problems for both models", 18], ["Code checked every digit", 26], ["One attempt each · temperature 0", 34]].map(([t, dl]) => <Fade key={t} delay={dl} style={abs(80, 900 + (dl - 18) * 22, 920, 100, { fontFamily: SANS, fontWeight: 600, fontSize: 44, color: C.text, borderTop: `2px solid ${C.line}`, paddingTop: 22 })}>{t}</Fade>)}
    <Source>AI Tested · GitHub Actions · {d.date}</Source>
  </>);
}
function Results({ d }) {
  const f = useCurrentFrame(), sizes = [2, 3, 4, 5, 6, 7, 8, 9, 10], RH = 92, top = 400;
  return (<>
    <Label y={150} delay={0}>Right answers · out of 10</Label>
    <Fade delay={2} style={abs(80, 290, 920, 90, { display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: 30, letterSpacing: "0.1em", color: C.dim, textTransform: "uppercase", alignItems: "flex-end" })}>
      <div style={{ width: 240 }}>Digits</div><div style={{ width: 340 }}>{d.new_model.replace("Gemini 4 ", "")}</div><div style={{ width: 340 }}>{d.old_model.replace("Gemini ", "")}</div>
    </Fade>
    {sizes.map((n, i) => { const a = ramp(f, 8 + i * 3, 16 + i * 3), hr = d.hydrogen.by[n], orr = d.older.by[n], hot = n >= 6; return (
      <div key={n} style={abs(60, top + i * RH, 960, RH - 8, { display: "flex", alignItems: "center", background: hot ? "rgba(227,184,92,0.13)" : C.card, borderLeft: `6px solid ${hot ? C.gold : C.line}`, opacity: a, transform: `translateX(${(1 - a) * 60}px)`, fontFamily: SERIF, fontWeight: 800, fontSize: 58, boxSizing: "border-box", paddingLeft: 24 })}>
        <div style={{ width: 240, color: C.text }}>{n}</div>
        <div style={{ width: 340, color: hr.right === hr.of ? C.good : C.gold }}>{hr.right}</div>
        <div style={{ width: 340, color: orr.right === orr.of ? C.good : orr.right ? C.gold : C.bad }}>{orr.right}</div>
      </div>); })}
    <Source>AI Tested · GitHub Actions · {d.date} and {d.earlier_date} · same 90 problems</Source>
  </>);
}
function Empty({ d }) {
  return (<>
    <Label y={150} delay={0}>{d.new_model} missed</Label>
    <Rule y={230} delay={2} color={C.bad} />
    <Big y={320} size={560} color={C.bad} delay={4}>{d.hydrogen.empty}</Big>
    <Label y={940} delay={12} color={C.text} size={46}>empty replies</Label>
    <Fade delay={20} style={abs(80, 1100, 920, 200, { fontFamily: SANS, fontWeight: 600, fontSize: 54, color: C.text, lineHeight: 1.25 })}>Wrong numbers: <span style={{ color: C.good }}>{d.hydrogen.wrong_numbers}</span></Fade>
    <Source>AI Tested · GitHub Actions · {d.date}</Source>
  </>);
}
function Close({ d }) {
  const rows = ["One run · temperature 0", `${d.token_cap.toLocaleString("en-US")}-token reply limit`, "Two other Gemini 4 models: not tested"];
  return (<>
    <Label y={150} delay={0}>What this does not show</Label>
    <Rule y={230} delay={2} />
    {rows.map((t, i) => <Fade key={t} delay={8 + i * 8} style={abs(80, 330 + i * 190, 920, 160, { fontFamily: SERIF, fontWeight: 700, fontSize: 64, color: C.text, lineHeight: 1.15, borderTop: `2px solid ${C.line}`, paddingTop: 26 })}>{t}</Fade>)}
    <Fade delay={40} style={abs(80, 1000, 920, 300, { fontFamily: SERIF, fontWeight: 800, fontSize: 92, color: C.gold, lineHeight: 1.08 })}>Would you trust it with your sums?</Fade>
  </>);
}

function Cap({ captions }) {
  const f = useCurrentFrame(), c = captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  return <div style={abs(60, 1590, 960, 230, { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "0 16px", fontFamily: SANS, fontWeight: 800, fontSize: 62, lineHeight: 1.12, textAlign: "center", zIndex: 9000 })}>
    {(c.words || [{ text: c.text, from: c.from }]).map((w, i, all) => { const on = f >= w.from && (i === all.length - 1 || f < all[i + 1].from); return <span key={i} style={{ color: on ? "#0B0E14" : f >= w.from ? C.text : "rgba(242,239,232,0.5)", background: on ? C.gold : "none", padding: "0 8px", borderRadius: 6 }}>{w.text}</span>; })}
  </div>;
}

const BEATS = { hook: Hook, example: Example, design: Design, results: Results, empty: Empty, close: Close };
export function AiTestedGemini4({ durationInFrames, scenes, captions, data }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}><style>{FONT_FACES}</style>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,52,76,0.55) 0%, rgba(9,12,18,0) 62%)" }} />
      <div style={abs(80, 70, 920, 50, { fontFamily: SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 40, color: C.gold })}>AI Tested</div>
      {scenes.map((s) => { const B = BEATS[s.kind]; return B ? <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><AbsoluteFill><B d={data} /></AbsoluteFill></Sequence> : null; })}
      <Cap captions={captions} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: C.gold })} />
    </AbsoluteFill>
  );
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 1700, defaultProps: { durationInFrames: 1700, scenes: [], captions: [], data: null } };
export const gemini4Compositions = [{ id: "AiTestedGemini4", component: AiTestedGemini4, ...base }];
