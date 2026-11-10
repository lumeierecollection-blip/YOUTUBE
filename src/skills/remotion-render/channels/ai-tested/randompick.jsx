// AI Tested: "Can AI pick a random number?" Same look and scene grammar as the other AI Tested tests: white page, one cyan accent,
// terminal inserts, bars that start at zero. Every count is measured in the run.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { SHARED } from "./experiment.jsx";

const { C, SANS, MONO, abs, From, Title, Scene, Caption, clamp } = SHARED;
const hash = (n) => ((Math.imul(n + 7, 2654435761) >>> 0) % 997);

function Hook3({ dur }) {
  const f = useCurrentFrame(), lit = Math.floor(f / 5), hot = hash(lit) % 10;
  return (
    <Scene dur={dur}>
      <From dy={30} style={abs(70, 250, 940, 260, { fontFamily: SANS, fontWeight: 800, fontSize: 100, lineHeight: 1.03, color: C.ink, textAlign: "center" })}>Can AI pick a random number?</From>
      <div style={abs(70, 640, 940, 420, { display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center" })}>
        {Array.from({ length: 10 }, (_, i) => <div key={i} style={{ width: 168, height: 190, borderRadius: 24, background: i === hot ? C.accent : C.surface, color: i === hot ? "#fff" : C.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: 110 }}>{i + 1}</div>)}
      </div>
      <From delay={14} style={abs(70, 1160, 940, 120, { fontFamily: SANS, fontWeight: 700, fontSize: 56, color: C.dim, textAlign: "center" })}>Every number has the same chance. Does AI act like it?</From>
    </Scene>
  );
}

function Setup3({ dur, d }) {
  const f = useCurrentFrame(), stage = (i) => 6 + i * Math.max(18, Math.floor(dur * 0.2)), g = (a, b) => interpolate(f, [a, b], [0, 1], clamp);
  return (
    <Scene dur={dur}>
      <Title top={230}>The test</Title>
      <From delay={stage(0)} dx={-100} dy={0} style={abs(80, 400, 920, 260, { background: C.term, borderRadius: 26, padding: "30px 40px", boxSizing: "border-box" })}><div style={{ fontFamily: MONO, fontSize: 36, lineHeight: 1.4, color: C.prompt }}>&gt; {d.prompt10}</div></From>
      <From delay={stage(1)} dx={100} dy={0} style={abs(80, 700, 920, 170, { background: C.accent, borderRadius: 26, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: 50, color: "#fff", textAlign: "center", padding: "0 30px" })}>{d.models.length} models × {d.asks} asks</From>
      <From delay={stage(2)} style={abs(80, 910, 920, 470, { background: C.surface, borderRadius: 26 })}>
        <div style={abs(40, 28, 840, 60, { fontFamily: SANS, fontWeight: 800, fontSize: 44, color: C.ink })}>A fair pick, in {d.asks} asks</div>
        {Array.from({ length: 10 }, (_, i) => { const t = g(stage(2) + 8 + i * 2, stage(2) + 20 + i * 2); return <div key={i}><div style={abs(40 + i * 84, 380 - 170 * t, 62, 170 * t, { background: C.stroke, borderRadius: 8 })} /><div style={abs(40 + i * 84, 394, 62, 40, { textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 28, color: C.dim })}>{i + 1}</div></div>; })}
        <div style={abs(40, 160, 840, 40, { fontFamily: SANS, fontWeight: 700, fontSize: 32, color: C.dim, textAlign: "right", opacity: g(stage(2) + 24, stage(2) + 34) })}>about {d.fair} each</div>
      </From>
    </Scene>
  );
}

function Hist({ dur, d }) {
  const f = useCurrentFrame(), n = d.models.length, blockH = Math.min(520, 1040 / n), maxC = Math.max(...d.models.flatMap((m) => m.h10), d.fair + 1), barH = blockH - 250;
  return (
    <Scene dur={dur}>
      <Title top={200} size={64}>What each model picked</Title>
      {d.models.map((m, mi) => { const y0 = 330 + mi * (blockH + 20), at = 8 + mi * Math.floor(dur * 0.25); return (
        <div key={m.id}>
          <div style={abs(80, y0, 920, 60, { fontFamily: SANS, fontWeight: 800, fontSize: 42, color: C.ink })}>{m.name}</div>
          {m.h10.map((c, i) => { const t = interpolate(f, [at + i * 2, at + 22 + i * 2], [0, 1], clamp), top = c === Math.max(...m.h10), x = 80 + i * 92; return (
            <div key={i}>
              <div style={abs(x, y0 + 70 + barH - (barH * c) / maxC * t, 78, Math.max(2, (barH * c) / maxC * t), { background: top ? C.bad : C.accent, borderRadius: 8 })} />
              <div style={abs(x - 6, y0 + 70 + barH - ((barH * c) / maxC) * t - 44, 90, 40, { textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 32, color: top ? C.bad : C.ink, opacity: t })}>{Math.round(c * t)}</div>
              <div style={abs(x, y0 + 80 + barH, 78, 40, { textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 30, color: C.dim })}>{i + 1}</div>
            </div>); })}
          <div style={abs(70, y0 + 70 + barH - (barH * d.fair) / maxC, 940, 4, { background: C.ink, opacity: 0.5 })} />
          <div style={abs(700, y0 + 70 + barH - (barH * d.fair) / maxC - 40, 310, 34, { fontFamily: SANS, fontWeight: 700, fontSize: 26, color: C.dim, textAlign: "right" })}>fair = {d.fair}</div>
        </div>); })}
    </Scene>
  );
}

function Hist100({ dur, d }) {
  const f = useCurrentFrame(), n = d.models.length, rowH = Math.min(460, 1000 / n);
  return (
    <Scene dur={dur}>
      <Title top={200} size={64}>Now, one to a hundred</Title>
      {d.models.map((m, mi) => { const y0 = 360 + mi * rowH, at = 8 + mi * Math.floor(dur * 0.25); return (
        <div key={m.id}>
          <div style={abs(80, y0, 920, 60, { fontFamily: SANS, fontWeight: 800, fontSize: 42, color: C.ink })}>{m.name}: most common replies</div>
          {m.top100.map((t, i) => { const a = interpolate(f, [at + i * 6, at + 14 + i * 6], [0, 1], clamp); return (
            <div key={i} style={abs(80 + i * 316, y0 + 80, 296, rowH - 140, { background: i === 0 ? "#FFF4ED" : C.surface, borderRadius: 26, opacity: a, transform: `translateY(${(1 - a) * 40}px)`, textAlign: "center" })}>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 130, color: i === 0 ? C.bad : C.ink, lineHeight: 1.1, marginTop: 26 }}>{t.value}</div>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: C.dim }}>×{t.count} of {d.asks}</div>
            </div>); })}
        </div>); })}
    </Scene>
  );
}

function Why({ dur }) {
  const f = useCurrentFrame(), q = "a purported statistical majority of people in the US choose the color blue and number seven when asked to randomly select a color and a single digit number.", shown = q.slice(0, Math.floor(interpolate(f, [8, Math.floor(dur * 0.7)], [0, q.length], clamp)));
  return (
    <Scene dur={dur}>
      <Title top={230}>People do it too</Title>
      <div style={abs(60, 440, 960, 760, { background: C.surface, borderRadius: 30, padding: "50px 54px", boxSizing: "border-box" })}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 130, lineHeight: 0.8, color: C.accent }}>“</div>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 52, lineHeight: 1.25, color: C.ink, marginTop: 8 }}>{shown}</div>
      </div>
      <From delay={Math.floor(dur * 0.5)} style={abs(60, 1230, 960, 200, { fontFamily: SANS, fontWeight: 700, fontSize: 38, lineHeight: 1.3, color: C.dim })}>The “blue–seven phenomenon”, Wikipedia. Its existence is disputed.</From>
    </Scene>
  );
}

function Tip({ dur, d }) {
  const t = SHARED.useIn(0, 14);
  const rows = [["Giveaway winner", "✗ ask AI", C.bad], ["Fair draw", "✓ dice", "#fff"], ["Fair draw", "✓ ask AI for code", "#fff"]];
  return (
    <Scene dur={dur}>
      <div style={abs(60, 240, 960, 1240, { background: C.accent, borderRadius: 34, transform: `translateY(${(1 - t) * 160}px)`, opacity: t })} />
      <From delay={6} style={abs(120, 330, 840, 600, { fontFamily: SANS, fontWeight: 800, fontSize: 92, lineHeight: 1.08, color: "#fff" })}>Use dice, or code that rolls them.</From>
      <div style={abs(120, 1000, 840, 400, { display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 18 })}>
        {rows.map(([a, b, col], i) => <From key={i} delay={12 + i * 6} dy={20} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: SANS, color: "#fff", fontSize: 44, fontWeight: 600, borderTop: "2px solid rgba(255,255,255,0.35)", paddingTop: 14 }}><span>{a}</span><span style={{ fontWeight: 800, color: col === C.bad ? "#FFD2BF" : "#fff" }}>{b}</span></From>)}
      </div>
    </Scene>
  );
}

const KINDS3 = { hook3: Hook3, setup3: Setup3, hist: Hist, hist100: Hist100, why: Why, tip: Tip };
function AiTestedRandom({ durationInFrames, scenes, captions, data }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <style>{FONT_FACES}</style>
      <div style={abs(0, 130, 1080, 50, { textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.24em", color: C.accent })}>AI  TESTED</div>
      {scenes.map((s) => { const K = KINDS3[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} d={data} scene={s} /></Sequence>; })}
      <Caption captions={captions} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: C.accent })} />
    </AbsoluteFill>
  );
}
export const randomCompositions = [{ id: "AiTestedRandom", component: AiTestedRandom, durationInFrames: 1140, fps: 30, width: 1080, height: 1920, defaultProps: { durationInFrames: 1140, scenes: [], captions: [], data: { models: [], asks: 30, fair: 3, prompt10: "" } } }];
