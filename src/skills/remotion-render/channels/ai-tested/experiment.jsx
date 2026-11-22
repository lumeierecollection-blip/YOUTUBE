// AI Tested: a real model test. Every number and reply comes from the experiment run during this render;
// scene timing and captions come from the measured narration.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";

const C = { bg: "#FFFFFF", surface: "#F1F4F8", ink: "#0F172A", dim: "#526072", stroke: "#CBD5E1", accent: "#0E7490", good: "#15803D", bad: "#C2410C", term: "#0F172A", termHead: "#1E293B", termText: "#E2E8F0", prompt: "#67E8F9" };
const SANS = '"Space Grotesk", sans-serif', MONO = '"JetBrains Mono", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const ease = Easing.out(Easing.cubic);
const useIn = (delay = 0, len = 12) => interpolate(useCurrentFrame(), [delay, delay + len], [0, 1], { ...clamp, easing: ease });
const abs = (x, y, w, h, extra) => ({ position: "absolute", left: x, top: y, width: w, height: h, ...extra });
const From = ({ dx = 0, dy = 40, delay = 0, style, children }) => { const t = useIn(delay); return <div style={{ opacity: t, transform: `translate(${(1 - t) * dx}px, ${(1 - t) * dy}px)`, ...style }}>{children}</div>; };
const Title = ({ children, top = 220, size = 76 }) => <From dy={30} style={abs(70, top, 940, 200, { fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.05, color: C.ink })}>{children}</From>;

function Scene({ dur, children }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(f, [0, 5, dur - 4, dur], [0, 1, 1, 0], clamp) }}>{children}</AbsoluteFill>;
}

/** Letter tiles. Each matching letter lights up in turn, and the count rises with it. */
function LetterRow({ word, letter, y, size, start, step }) {
  const f = useCurrentFrame();
  const gap = 8, w = word.length * (size + gap) - gap, x0 = (1080 - w) / 2;
  let n = 0;
  return word.split("").map((c, i) => {
    const hit = c === letter, at = start + (hit ? n++ : 0) * step;
    const on = hit && f >= at;
    return <div key={i} style={abs(x0 + i * (size + gap), y, size, size * 1.25, { background: on ? C.accent : C.surface, color: on ? "#fff" : C.ink, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 800, fontSize: size * 0.68, transform: on ? `translateY(${interpolate(f, [at, at + 6], [-18, 0], clamp)}px)` : undefined })}>{c.toUpperCase()}</div>;
  });
}

function Hook({ dur, d }) {
  const f = useCurrentFrame();
  const { word, letter } = d.example, size = Math.min(96, Math.floor(960 / word.length) - 8);
  const hits = [...word].filter((c) => c === letter).length, start = 22, step = Math.max(10, Math.floor((dur * 0.55) / hits));
  const counted = Math.min(hits, Math.floor(Math.max(0, f - start + step) / step));
  return (
    <Scene dur={dur}>
      <From dy={30} style={abs(70, 260, 940, 260, { fontFamily: SANS, fontWeight: 800, fontSize: 104, lineHeight: 1.03, color: C.ink, textAlign: "center" })}>Can AI count letters?</From>
      <From delay={8} style={abs(70, 610, 940, 70, { fontFamily: SANS, fontSize: 48, fontWeight: 600, color: C.dim, textAlign: "center" })}>How many “{letter.toUpperCase()}”s in this word?</From>
      <LetterRow word={word} letter={letter} y={740} size={size} start={start} step={step} />
      <div style={abs(0, 980, 1080, 300, { textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 280, lineHeight: 1, color: C.accent })}>{counted}</div>
      <From delay={dur * 0.5} style={abs(70, 1320, 940, 90, { fontFamily: SANS, fontWeight: 700, fontSize: 56, color: C.ink, textAlign: "center" })}>{d.models.length} AI models. {d.total} questions.</From>
    </Scene>
  );
}

function Setup({ dur, d }) {
  const stage = (i) => 6 + i * Math.max(16, Math.floor(dur * 0.2));
  const Arrow = ({ y, i }) => { const t = useIn(stage(i) + 4, 10); return <div style={abs(536, y, 8, 74 * t, { background: C.accent, borderRadius: 4 })} />; };
  return (
    <Scene dur={dur}>
      <Title>The test</Title>
      <From delay={stage(0)} dx={-100} dy={0} style={abs(90, 380, 900, 200, { background: C.surface, borderRadius: 26, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 44px" })}>
        <div style={{ fontFamily: SANS, fontSize: 56, fontWeight: 800, color: C.ink }}>{d.total} counting questions</div>
        <div style={{ fontFamily: SANS, fontSize: 40, color: C.dim, marginTop: 8 }}>10 real words, 10 random letter strings</div>
      </From>
      <Arrow y={590} i={0} />
      <div style={abs(90, 672, 900, 250, { display: "flex", gap: 20 })}>
        {d.models.map((m, i) => <From key={m.id} delay={stage(1) + i * 5} style={{ flex: 1, background: "#fff", border: `3px solid ${C.stroke}`, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", padding: 14, textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 40, color: C.ink, boxShadow: "0 10px 26px rgba(15,23,42,0.10)" }}>{m.name}</From>)}
      </div>
      <Arrow y={932} i={1} />
      <From delay={stage(2)} dx={100} dy={0} style={abs(90, 1014, 900, 170, { background: C.term, borderRadius: 26, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 44, color: C.termText })}>Reply: only the number</From>
      <Arrow y={1194} i={2} />
      <From delay={stage(3)} style={abs(90, 1276, 900, 170, { background: C.accent, borderRadius: 26, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: 52, color: "#fff" })}>Code marks every reply</From>
    </Scene>
  );
}

function Terminal({ dur, d }) {
  const f = useCurrentFrame();
  const p = d.example.prompt, typeEnd = Math.floor(dur * 0.4), shown = p.slice(0, Math.floor(interpolate(f, [4, typeEnd], [0, p.length], clamp)));
  return (
    <Scene dur={dur}>
      <Title>Real prompt. Real replies.</Title>
      <div style={abs(60, 420, 960, 1000, { background: C.term, borderRadius: 26, overflow: "hidden" })}>
        <div style={abs(0, 0, 960, 62, { background: C.termHead, display: "flex", alignItems: "center", gap: 10, padding: "0 24px" })}>{["#EF4444", "#F59E0B", "#22C55E"].map((c) => <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />)}<span style={{ fontFamily: MONO, fontSize: 26, color: "#94A3B8", marginLeft: 14 }}>test run, {d.date}</span></div>
        <div style={abs(40, 100, 880, 340, { fontFamily: MONO, fontSize: 44, lineHeight: "62px", color: C.prompt })}>&gt; {shown}</div>
        {d.example.replies.map((r, i) => { const at = typeEnd + 6 + i * Math.max(8, Math.floor(dur * 0.1)); const t = interpolate(f, [at, at + 6], [0, 1], clamp); return (
          <div key={r.model} style={abs(40, 480 + i * 160, 880, 140, { opacity: t, display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid #334155" })}>
            <span style={{ fontFamily: SANS, fontSize: 44, color: C.termText }}>{r.model}</span>
            <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 84, color: r.ok ? "#4ADE80" : "#FB923C" }}>{r.answer ?? "?"} {r.ok ? "✓" : "✗"}</span>
          </div>); })}
      </div>
    </Scene>
  );
}

function Bars({ rows, total, y, rowH, delay, spread, full = 900, thick = 66 }) {
  const f = useCurrentFrame();
  return rows.map((r, i) => {
    const at = delay + i * spread, t = interpolate(f, [at, at + 22], [0, 1], { ...clamp, easing: ease });
    return (
      <div key={r.label}>
        <div style={abs(90, y + i * rowH, 680, 70, { fontFamily: SANS, fontSize: 48, fontWeight: 700, color: C.ink, opacity: Math.min(1, t * 3) })}>{r.label}</div>
        <div style={abs(700, y + i * rowH - 8, 290, 80, { fontFamily: SANS, fontSize: 68, fontWeight: 800, color: i === 0 ? C.accent : C.ink, textAlign: "right" })}>{Math.round(r.value * t)}<span style={{ fontSize: 40, color: C.dim }}> /{total}</span></div>
        <div style={abs(90, y + i * rowH + 84, full, thick, { background: C.surface, borderRadius: thick / 2 })} />
        <div style={abs(90, y + i * rowH + 84, ((r.value / total) * full) * t, thick, { background: i === 0 ? C.accent : C.ink, borderRadius: thick / 2 })} />
      </div>
    );
  });
}

function Score({ dur, d }) {
  const n = d.models.length, rowH = Math.min(310, 960 / n);
  return (
    <Scene dur={dur}>
      <Title>The score</Title>
      <Bars rows={d.models.map((m) => ({ label: m.name, value: m.correct }))} total={d.total} y={440} rowH={rowH} delay={8} spread={Math.max(10, Math.floor(dur * 0.16))} />
      <From delay={dur * 0.55} style={abs(70, 1420, 940, 60, { fontFamily: SANS, fontSize: 36, color: C.dim, textAlign: "center" })}>Correct answers out of {d.total}. Bars start at zero.</From>
    </Scene>
  );
}

function Split({ dur, d }) {
  const f = useCurrentFrame();
  const halves = [["Real words", "real", -80], ["Random letters", "random", 80]];
  return (
    <Scene dur={dur}>
      <Title>Words vs. random letters</Title>
      {halves.map(([title, key, dx], h) => { const delay = 6 + h * Math.floor(dur * 0.3), x = 60 + h * 490; return (
        <From key={key} delay={delay} dx={dx} dy={0} style={abs(x, 420, 470, 1000, { background: C.surface, borderRadius: 26 })}>
          <div style={abs(30, 34, 410, 70, { fontFamily: SANS, fontWeight: 800, fontSize: 48, color: C.ink })}>{title}</div>
          {d.models.map((m, i) => { const t = interpolate(f, [delay + 10 + i * 8, delay + 30 + i * 8], [0, 1], { ...clamp, easing: ease }); const v = m[key]; return (
            <div key={m.id}>
              <div style={abs(30, 140 + i * 280, 410, 90, { fontFamily: SANS, fontSize: 36, fontWeight: 600, color: C.dim, lineHeight: 1.1 })}>{m.name}</div>
              <div style={abs(30, 228 + i * 280, 410, 70, { fontFamily: SANS, fontWeight: 800, fontSize: 62, color: C.ink })}>{Math.round(v * t)}<span style={{ fontSize: 36, color: C.dim }}> /10</span></div>
              <div style={abs(30, 302 + i * 280, 410, 26, { background: "#fff", borderRadius: 13 })} />
              <div style={abs(30, 302 + i * 280, 41 * v * t, 26, { background: key === "real" ? C.accent : C.bad, borderRadius: 13 })} />
            </div>); })}
        </From>); })}
    </Scene>
  );
}

function Miss({ dur, d }) {
  const f = useCurrentFrame();
  const m = d.miss, size = Math.floor(960 / m.word.length) - 6, reveal = Math.floor(dur * 0.45);
  const shown = interpolate(f, [reveal, reveal + 8], [0, 1], clamp);
  return (
    <Scene dur={dur}>
      <Title>The widest miss</Title>
      <From delay={6} style={abs(70, 380, 940, 70, { fontFamily: SANS, fontSize: 46, fontWeight: 600, color: C.dim })}>{m.model}, counting “{m.letter.toUpperCase()}”</From>
      <LetterRow word={m.word} letter={m.letter} y={500} size={size} start={10} step={Math.max(3, Math.floor(reveal / Math.max(1, m.correct)))} />
      <div style={abs(70, 720, 450, 640, { background: C.surface, borderRadius: 26, textAlign: "center" })}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, color: C.dim, marginTop: 60 }}>Correct</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 280, color: C.good, lineHeight: 1.2 }}>{m.correct}</div>
      </div>
      <div style={abs(560, 720, 450, 640, { background: "#FFF4ED", borderRadius: 26, textAlign: "center", opacity: shown, transform: `translateX(${(1 - shown) * 80}px)` })}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, color: C.dim, marginTop: 60 }}>It said</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 280, color: C.bad, lineHeight: 1.2 }}>{m.answer}</div>
      </div>
    </Scene>
  );
}

function Close({ dur, d, scene }) {
  const f = useCurrentFrame(), t = useIn(0, 14);
  return (
    <Scene dur={dur}>
      <div style={abs(60, 240, 960, 1240, { background: C.accent, borderRadius: 34, transform: `translateY(${(1 - t) * 160}px)`, opacity: t })} />
      <From delay={6} style={abs(120, 330, 840, 620, { fontFamily: SANS, fontWeight: 800, fontSize: 92, lineHeight: 1.08, color: "#fff" })}>{scene.headline}</From>
      <div style={abs(120, 1000, 840, 420, { display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 18 })}>
        {d.models.map((m, i) => <From key={m.id} delay={12 + i * 6} dy={20} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: SANS, color: "#fff", fontSize: 46, fontWeight: 600, borderTop: "2px solid rgba(255,255,255,0.35)", paddingTop: 14 }}><span>{m.name}</span><span style={{ fontWeight: 800, fontSize: 62 }}>{m.correct}/{d.total}</span></From>)}
      </div>
    </Scene>
  );
}

const KINDS = { hook: Hook, setup: Setup, terminal: Terminal, score: Score, split: Split, miss: Miss, close: Close };

function Caption({ captions }) {
  const f = useCurrentFrame();
  const c = captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  return <div style={abs(60, 1600, 960, 170, { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "0 16px", fontFamily: SANS, fontWeight: 700, fontSize: 56, lineHeight: 1.12, textAlign: "center" })}>{c.words.map((w, i) => <span key={i} style={{ color: f >= w.from ? C.accent : C.ink }}>{w.text}</span>)}</div>;
}

function AiTestedExperiment({ durationInFrames, scenes, captions, data }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <style>{FONT_FACES}</style>
      <div style={abs(0, 130, 1080, 50, { textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.24em", color: C.accent })}>AI  TESTED</div>
      {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} d={data} scene={s} /></Sequence>; })}
      <Caption captions={captions} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: C.accent })} />
    </AbsoluteFill>
  );
}

export const SHARED = { C, SANS, MONO, abs, From, Title, Scene, LetterRow, Bars, Caption, KINDS, useIn, clamp, ease };
export const experimentCompositions = [{ id: "AiTestedExperiment", component: AiTestedExperiment, durationInFrames: 900, fps: 30, width: 1080, height: 1920, defaultProps: { durationInFrames: 900, scenes: [], captions: [], data: { models: [], example: { word: "", letter: "", prompt: "", replies: [] }, total: 20, date: "" } } }];
