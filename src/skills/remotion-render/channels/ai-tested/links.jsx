// AI Tested: "If you ask AI for a source, will the link work?" Same look and scene grammar as the other AI Tested tests: white page, one cyan accent,
// terminal inserts. Every count is measured in the run; every link and every server answer shown is the real one.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { SHARED } from "./experiment.jsx";

const { C, SANS, MONO, abs, From, Title, Scene, Caption, clamp } = SHARED;
const COLOR = { opened: C.accent, dead: C.bad, unchecked: C.stroke };

const Bubble = ({ who, y, h, delay, size = 46, mono = false, children }) => (
  <From delay={delay} dx={who === "you" ? 80 : -80} dy={0} style={abs(who === "you" ? 200 : 70, y, 810, h, { background: who === "you" ? C.accent : C.surface, color: who === "you" ? "#fff" : C.ink, borderRadius: 30, padding: "0 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", fontFamily: mono ? MONO : SANS, fontWeight: 700, fontSize: size, lineHeight: 1.2, wordBreak: "break-all" })}>
    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, letterSpacing: "0.1em", opacity: 0.7, marginBottom: 8 }}>{who === "you" ? "YOU" : "AI"}</div>
    {children}
  </From>
);
const verdict = (e) => (!e ? null : e.outcome === "dead" ? { text: `HTTP ${e.status || "?"} · NOT FOUND`, color: C.bad } : e.outcome === "opened" ? { text: `HTTP ${e.status || 200} · OPENS`, color: C.accent } : { text: "COULD NOT BE CHECKED", color: C.dim });

function HookL({ dur, d }) {
  const e = d.example, v = verdict(e);
  return (
    <Scene dur={dur}>
      <From dy={30} style={abs(70, 220, 940, 330, { fontFamily: SANS, fontWeight: 800, fontSize: 84, lineHeight: 1.05, color: C.ink })}>If you ask AI for a source, will the <span style={{ color: C.accent }}>link work</span>?</From>
      <Bubble who="you" y={620} h={250} delay={6} size={38}>{e ? e.ask : d.sampleAsk}</Bubble>
      <Bubble who="ai" y={910} h={180} delay={Math.floor(dur * 0.32)} size={34} mono>{d.shortUrl || "..."}</Bubble>
      {v ? <From delay={Math.floor(dur * 0.58)} dy={20} style={abs(200, 1140, 810, 150, { border: `8px solid ${v.color}`, color: v.color, borderRadius: 24, fontFamily: SANS, fontWeight: 800, fontSize: 56, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", transform: "rotate(-2deg)" })}>{v.text}</From> : null}
    </Scene>
  );
}

function SetupL({ dur, d }) {
  const step = Math.max(2, Math.floor(dur * 0.04)), f = useCurrentFrame();
  return (
    <Scene dur={dur}>
      <Title top={210}>The test</Title>
      <div style={abs(70, 330, 940, 560, { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px", alignContent: "start" })}>
        {d.topics.map((t, i) => <div key={t} style={{ background: C.surface, borderRadius: 18, padding: "12px 20px", fontFamily: SANS, fontWeight: 700, fontSize: 30, lineHeight: 1.15, color: C.ink, opacity: interpolate(f, [4 + i * step, 12 + i * step], [0, 1], clamp), height: 76, display: "flex", alignItems: "center" }}>{t}</div>)}
      </div>
      <Bubble who="you" y={940} h={250} delay={6 + step * 12} size={36}>Give me one direct link to a news article or study about …. Reply with only the link.</Bubble>
      <From delay={10 + step * 14} style={abs(70, 1230, 940, 190, { background: C.surface, borderRadius: 26, padding: "30px 40px", boxSizing: "border-box", fontFamily: SANS, fontWeight: 700, fontSize: 40, lineHeight: 1.25, color: C.ink })}>{d.models.length} models · {d.total} topics<br /><span style={{ color: C.dim }}>Then we requested every link.</span></From>
    </Scene>
  );
}

function GridL({ dur, d }) {
  const f = useCurrentFrame(), n = d.models.length, blockH = Math.min(520, 1000 / n);
  const legend = [["opened", "opened"], ["dead", "dead (404 or no such address)"], ...(d.models.some((m) => m.unchecked) ? [["unchecked", "unchecked"]] : [])];
  return (
    <Scene dur={dur}>
      <Title top={200} size={64}>Every link, requested</Title>
      <From delay={4} style={abs(70, 300, 940, 60, { fontFamily: MONO, fontWeight: 700, fontSize: 30, color: C.dim })}>one square = one link</From>
      {d.models.map((m, mi) => { const y0 = 390 + mi * (blockH + 10), at = 8 + mi * Math.floor(dur * 0.3), cell = Math.min(66, Math.floor((940 - 11 * 8) / 12)), shown = Math.floor(interpolate(f, [at, at + 26], [0, m.seq.length], clamp)); return (
        <div key={m.id}>
          <div style={abs(70, y0, 940, 60, { fontFamily: SANS, fontWeight: 800, fontSize: 44, color: C.ink })}>{m.name}</div>
          {m.seq.map((o, i) => <div key={i} style={abs(70 + i * (cell + 8), y0 + 80, cell, cell, { borderRadius: 12, background: i < shown ? COLOR[o] : C.surface })} />)}
          <div style={abs(70, y0 + 100 + cell, 940, 130, { display: "flex", alignItems: "baseline", gap: 24, fontFamily: SANS, opacity: interpolate(f, [at + 24, at + 34], [0, 1], clamp) })}>
            <span style={{ fontWeight: 800, fontSize: 110, lineHeight: 1, color: m.dead ? C.bad : C.accent }}>{m.dead}</span>
            <span style={{ fontWeight: 700, fontSize: 44, color: C.ink }}>of {m.n} links were dead</span>
          </div>
        </div>); })}
      <div style={abs(70, 1470, 940, 50, { display: "flex", gap: 34, fontFamily: SANS, fontWeight: 700, fontSize: 28, color: C.dim })}>
        {legend.map(([k, label]) => <span key={k}><span style={{ display: "inline-block", width: 26, height: 26, borderRadius: 6, background: COLOR[k], marginRight: 10, verticalAlign: "-3px" }} />{label}</span>)}
      </div>
    </Scene>
  );
}

function ExampleL({ dur, d }) {
  const f = useCurrentFrame(), e = d.example;
  if (!e) return <Scene dur={dur} />;
  const v = verdict(e), line = (label, text, color, delay) => <From delay={delay} dy={16} style={{ marginBottom: 30 }}><span style={{ color: C.prompt }}>{label} </span><span style={{ color, wordBreak: "break-all" }}>{text}</span></From>;
  return (
    <Scene dur={dur}>
      <Title top={200} size={64}>A real answer</Title>
      <div style={abs(60, 330, 960, 900, { background: C.term, borderRadius: 26, padding: "40px 44px", boxSizing: "border-box", fontFamily: MONO, fontSize: 36, lineHeight: 1.35 })}>
        {line("you:", e.ask, C.termText, 2)}
        {line("ai:", e.url, "#FDE68A", 10)}
        {line("check:", v.text, e.outcome === "dead" ? "#FCA5A5" : "#86EFAC", Math.floor(dur * 0.5))}
      </div>
      <From delay={Math.floor(dur * 0.62)} style={abs(60, 1270, 960, 190, { fontFamily: SANS, fontWeight: 700, fontSize: 38, lineHeight: 1.25, color: C.dim })}>{e.model}. Requested on {d.date}, from a server. {e.outcome === "dead" ? "A page that does not exist." : e.outcome === "opened" ? "A page opened. It may still not say what the AI claimed." : "The site did not answer."}</From>
    </Scene>
  );
}

function TipL({ dur, d }) {
  const t = SHARED.useIn(0, 14);
  return (
    <Scene dur={dur}>
      <div style={abs(60, 240, 960, 1240, { background: C.accent, borderRadius: 34, transform: `translateY(${(1 - t) * 160}px)`, opacity: t })} />
      <From delay={4} style={abs(120, 310, 840, 420, { fontFamily: SANS, color: "#fff" })}>
        <div style={{ fontWeight: 800, fontSize: 250, lineHeight: 1 }}>{d.dead}<span style={{ fontSize: 90, opacity: 0.8 }}> of {d.all}</span></div>
        <div style={{ fontWeight: 700, fontSize: 48, lineHeight: 1.2, marginTop: 12 }}>{d.anyDead ? "links were dead" : "links were dead: none"}</div>
      </From>
      <From delay={Math.floor(dur * 0.4)} dy={30} style={abs(120, 860, 840, 480, { fontFamily: SANS, fontWeight: 800, fontSize: 82, lineHeight: 1.08, color: "#fff", borderTop: "3px solid rgba(255,255,255,0.4)", paddingTop: 40 })}>How many links have you trusted <span style={{ color: "#FDE68A" }}>without clicking</span>?</From>
    </Scene>
  );
}

const KINDS_L = { hookL: HookL, setupL: SetupL, gridL: GridL, exampleL: ExampleL, tipL: TipL };
function AiTestedLinks({ durationInFrames, scenes, captions, data }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <style>{FONT_FACES}</style>
      <div style={abs(0, 130, 1080, 50, { textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.24em", color: C.accent })}>AI  TESTED</div>
      {scenes.map((s) => { const K = KINDS_L[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} d={data} scene={s} /></Sequence>; })}
      <Caption captions={captions} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: C.accent })} />
    </AbsoluteFill>
  );
}
export const linksCompositions = [{ id: "AiTestedLinks", component: AiTestedLinks, durationInFrames: 1140, fps: 30, width: 1080, height: 1920, defaultProps: { durationInFrames: 1140, scenes: [], captions: [], data: { models: [], total: 12, all: 24, dead: 0, anyDead: false, example: null, topics: [], date: "", sampleAsk: "", shortUrl: "" } } }];
