// AI Tested: "If you tell AI it's wrong, will it change a right answer?" Same look and scene grammar as the other AI Tested tests:
// white page, one cyan accent, terminal inserts. Every count is measured in the run, and every message shown is the real text sent or received.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { SHARED } from "./experiment.jsx";

const { C, SANS, MONO, abs, From, Title, Scene, Caption, clamp } = SHARED;
const short = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** A chat bubble. who: "you" (right, accent) or "ai" (left, grey). */
const Bubble = ({ who, y, h, delay, size = 50, children }) => (
  <From delay={delay} dx={who === "you" ? 80 : -80} dy={0} style={abs(who === "you" ? 200 : 70, y, 810, h, { background: who === "you" ? C.accent : C.surface, color: who === "you" ? "#fff" : C.ink, borderRadius: 30, padding: "0 40px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1.18 })}>
    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, letterSpacing: "0.1em", opacity: 0.7, marginBottom: 8 }}>{who === "you" ? "YOU" : "AI"}</div>
    {children}
  </From>
);

function HookP({ dur, d }) {
  const f = useCurrentFrame(), s = d.sample, dots = ".".repeat(1 + (Math.floor(f / 8) % 3));
  return (
    <Scene dur={dur}>
      <From dy={30} style={abs(70, 230, 940, 330, { fontFamily: SANS, fontWeight: 800, fontSize: 84, lineHeight: 1.05, color: C.ink })}>Will AI <span style={{ color: C.accent }}>agree with you</span> just to be nice?</From>
      <Bubble who="ai" y={640} h={190} delay={8} size={76}>{s.correct} <span style={{ color: C.good, fontSize: 54 }}>✓ correct</span></Bubble>
      <Bubble who="you" y={870} h={220} delay={Math.floor(dur * 0.3)}>No, that's wrong. It's {s.wrong}.</Bubble>
      <Bubble who="ai" y={1130} h={190} delay={Math.floor(dur * 0.55)} size={76}>{dots}</Bubble>
    </Scene>
  );
}

function SetupP({ dur, d }) {
  const s = d.sample, step = Math.max(16, Math.floor(dur * 0.22));
  return (
    <Scene dur={dur}>
      <Title top={220}>The test</Title>
      <Bubble who="you" y={370} h={210} delay={4} size={46}>{s.ask}</Bubble>
      <Bubble who="ai" y={610} h={170} delay={4 + step} size={64}>{s.correct} <span style={{ color: C.good, fontSize: 44 }}>✓</span></Bubble>
      <Bubble who="you" y={810} h={330} delay={4 + step * 2} size={44}>{s.push}</Bubble>
      <From delay={4 + step * 3} style={abs(70, 1180, 940, 190, { background: C.surface, borderRadius: 26, padding: "34px 40px", boxSizing: "border-box", fontFamily: SANS, fontWeight: 700, fontSize: 42, lineHeight: 1.25, color: C.ink })}>
        {d.models.length} models · {d.total} questions<br /><span style={{ color: C.dim }}>The real answer is {s.correct}. We said {s.wrong}.</span>
      </From>
    </Scene>
  );
}

/** One square per pushed question, in question order: held or switched. The count is written out beside the grid. */
function Grid({ dur, d, round, title, sub }) {
  const f = useCurrentFrame(), n = d.models.length, blockH = Math.min(520, 1080 / n);
  const col = { held: C.accent, switched: C.bad, other: C.stroke };
  return (
    <Scene dur={dur}>
      <Title top={200} size={64}>{title}</Title>
      <From delay={4} style={abs(70, 300, 940, 60, { fontFamily: MONO, fontWeight: 700, fontSize: 30, color: C.dim })}>{sub}</From>
      {d.models.map((m, mi) => { const y0 = 400 + mi * (blockH + 10), at = 8 + mi * Math.floor(dur * 0.3), seq = m[`${round}Seq`], c = m[round], cols = Math.max(seq.length, 1), cell = Math.min(70, Math.floor((940 - (cols - 1) * 8) / cols)), shown = Math.floor(interpolate(f, [at, at + 24], [0, seq.length], clamp)); return (
        <div key={m.id}>
          <div style={abs(70, y0, 940, 60, { fontFamily: SANS, fontWeight: 800, fontSize: 44, color: C.ink })}>{m.name}</div>
          {seq.map((o, i) => <div key={i} style={abs(70 + i * (cell + 8), y0 + 80, cell, cell, { borderRadius: 12, background: i < shown ? col[o] : C.surface })} />)}
          <div style={abs(70, y0 + 100 + cell, 940, 130, { display: "flex", alignItems: "baseline", gap: 24, fontFamily: SANS, opacity: interpolate(f, [at + 20, at + 30], [0, 1], clamp) })}>
            <span style={{ fontWeight: 800, fontSize: 110, lineHeight: 1, color: c.switched ? C.bad : C.accent }}>{c.switched}</span>
            <span style={{ fontWeight: 700, fontSize: 44, color: C.ink }}>of {m.n} switched to the wrong answer</span>
          </div>
        </div>); })}
      <div style={abs(70, 1470, 940, 50, { display: "flex", gap: 40, fontFamily: SANS, fontWeight: 700, fontSize: 30, color: C.dim })}>
        {[["held", "kept the right answer"], ["switched", "switched to ours"], ...(d.models.some((m) => m[round].other) ? [["other", "neither"]] : [])].map(([k, label]) => <span key={k}><span style={{ display: "inline-block", width: 26, height: 26, borderRadius: 6, background: col[k], marginRight: 10, verticalAlign: "-3px" }} />{label}</span>)}
      </div>
    </Scene>
  );
}
const PlainP = (p) => <Grid {...p} round="plain" title="Told “that's wrong”" sub="one square = one question it had right" />;
const TeacherP = (p) => <Grid {...p} round="teacher" title="“I'm a maths teacher”" sub="same questions, same false answer" />;

function ReplyP({ dur, d }) {
  const f = useCurrentFrame(), e = d.example;
  if (!e) return <Scene dur={dur} />;
  const final = short(e.final, 150), typed = final.slice(0, Math.floor(interpolate(f, [Math.floor(dur * 0.12), Math.floor(dur * 0.5)], [0, final.length], clamp)));
  const line = (label, text, color, delay) => <From delay={delay} dy={16} style={{ marginBottom: 26 }}><span style={{ color: C.prompt }}>{label} </span><span style={{ color }}>{text}</span></From>;
  return (
    <Scene dur={dur}>
      <Title top={200} size={64}>A real reply</Title>
      <div style={{ ...abs(60, 330, 960, 1010, { background: C.term, borderRadius: 26, padding: "40px 44px", boxSizing: "border-box", fontFamily: MONO, fontSize: 40, lineHeight: 1.35 }), height: "auto", minHeight: 620, maxHeight: 1010, overflow: "hidden" }}>
        {line("you:", e.ask, C.termText, 2)}
        {line("ai:", short(e.first, 40), "#FDE68A", 8)}
        {line("you:", e.push, C.termText, 14)}
        <div><span style={{ color: C.prompt }}>ai: </span><span style={{ color: "#FDE68A" }}>{typed}</span></div>
        <div style={{ marginTop: 34, paddingTop: 26, borderTop: "2px solid rgba(255,255,255,0.18)", fontFamily: SANS, fontWeight: 700, fontSize: 34, lineHeight: 1.25, color: "#94A3B8" }}>{e.model}. The correct answer is {e.correct}. {e.outcome === "switched" ? "It switched." : "It held."}</div>
      </div>
    </Scene>
  );
}

function TipP({ dur, d }) {
  const t = SHARED.useIn(0, 14);
  const rows = [["AI agrees with you", "✗ not proof"], ["Same question, new chat", "✓"], ["Check it yourself", "✓"]];
  if (!d.anySwitch) return (
    <Scene dur={dur}>
      <div style={abs(60, 240, 960, 1240, { background: C.accent, borderRadius: 34, transform: `translateY(${(1 - t) * 160}px)`, opacity: t })} />
      <From delay={4} style={abs(120, 310, 840, 400, { fontFamily: SANS, color: "#fff" })}>
        <div style={{ fontWeight: 800, fontSize: 230, lineHeight: 1 }}>{d.switches}<span style={{ fontSize: 84, opacity: 0.8 }}> of {d.pushes}</span></div>
        <div style={{ fontWeight: 700, fontSize: 46, lineHeight: 1.2, marginTop: 12 }}>pushes changed a right answer</div>
      </From>
      <From delay={Math.floor(dur * 0.35)} dy={30} style={abs(120, 800, 840, 560, { fontFamily: SANS, fontWeight: 800, fontSize: 86, lineHeight: 1.08, color: "#fff", borderTop: "3px solid rgba(255,255,255,0.4)", paddingTop: 40 })}>Would it back down on a question with <span style={{ color: "#FDE68A" }}>no right answer</span>?</From>
    </Scene>
  );
  return (
    <Scene dur={dur}>
      <div style={abs(60, 240, 960, 1240, { background: C.accent, borderRadius: 34, transform: `translateY(${(1 - t) * 160}px)`, opacity: t })} />
      <From delay={6} style={abs(120, 320, 840, 230, { fontFamily: SANS, fontWeight: 800, fontSize: 92, lineHeight: 1.08, color: "#fff" })}>{d.anySwitch ? "Agreement is not proof." : "It held. Still check."}</From>
      {d.pushes ? <From delay={10} style={abs(120, 570, 840, 400, { fontFamily: SANS, color: "#fff" })}>
        <div style={{ fontWeight: 800, fontSize: 250, lineHeight: 1 }}>{d.switches}<span style={{ fontSize: 90, opacity: 0.8 }}> of {d.pushes}</span></div>
        <div style={{ fontWeight: 700, fontSize: 46, lineHeight: 1.2, marginTop: 14 }}>pushes changed a right answer</div>
      </From> : null}
      <div style={abs(120, 1000, 840, 400, { display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 18 })}>
        {rows.map(([a, b], i) => <From key={i} delay={12 + i * 6} dy={20} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: SANS, color: "#fff", fontSize: 44, fontWeight: 600, borderTop: "2px solid rgba(255,255,255,0.35)", paddingTop: 14 }}><span>{a}</span><span style={{ fontWeight: 800, color: i === 0 ? "#FFD2BF" : "#fff" }}>{b}</span></From>)}
      </div>
    </Scene>
  );
}

const KINDS_P = { hookP: HookP, setupP: SetupP, plainP: PlainP, teacherP: TeacherP, replyP: ReplyP, tipP: TipP };
function AiTestedPushback({ durationInFrames, scenes, captions, data }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <style>{FONT_FACES}</style>
      <div style={abs(0, 130, 1080, 50, { textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.24em", color: C.accent })}>AI  TESTED</div>
      {scenes.map((s) => { const K = KINDS_P[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} d={data} scene={s} /></Sequence>; })}
      <Caption captions={captions} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: C.accent })} />
    </AbsoluteFill>
  );
}
export const pushbackCompositions = [{ id: "AiTestedPushback", component: AiTestedPushback, durationInFrames: 1140, fps: 30, width: 1080, height: 1920, defaultProps: { durationInFrames: 1140, scenes: [], captions: [], data: { models: [], total: 12, anySwitch: false, example: null, sample: { ask: "", correct: 0, wrong: 0, push: "", teacher: "" } } } }];
