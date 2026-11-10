// AI Tested follow-up: "Why do some AI models fail at counting letters, and what fixes it?" Same look and the same scene grammar as the
// letter-counting video (white page, one cyan accent, terminal inserts, bars that start at zero). Every number is measured in the run.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { SHARED } from "./experiment.jsx";

const { C, SANS, MONO, abs, From, Title, Scene, LetterRow, Bars, Caption, clamp } = SHARED;

function Hook2({ dur, d }) {
  const f = useCurrentFrame(), { word, letter } = d.example, size = Math.min(96, Math.floor(960 / word.length) - 8);
  const hits = [...word].filter((c) => c === letter).length, start = 26, step = Math.max(10, Math.floor((dur * 0.5) / hits));
  const counted = Math.min(hits, Math.floor(Math.max(0, f - start + step) / step));
  return (
    <Scene dur={dur}>
      <From dy={30} style={abs(70, 230, 940, 400, { fontFamily: SANS, fontWeight: 800, fontSize: 88, lineHeight: 1.05, color: C.ink, textAlign: "center" })}>Why do some AI models fail at counting letters?</From>
      <From delay={10} style={abs(70, 690, 940, 70, { fontFamily: SANS, fontSize: 44, fontWeight: 600, color: C.dim, textAlign: "center" })}>How many “{letter.toUpperCase()}”s in this word?</From>
      <LetterRow word={word} letter={letter} y={820} size={size} start={start} step={step} />
      <div style={abs(0, 1040, 1080, 300, { textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 240, lineHeight: 1, color: C.accent })}>{counted}</div>
    </Scene>
  );
}

function Ask2({ dur, d }) {
  const stage = (i) => 6 + i * Math.max(18, Math.floor(dur * 0.24));
  const card = (i, label, text, bg, fg, y, h) => <From key={label} delay={stage(i)} dx={i % 2 ? 100 : -100} dy={0} style={abs(80, y, 920, h, { background: bg, borderRadius: 26, padding: "28px 40px", boxSizing: "border-box" })}><div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 40, color: fg === "#fff" ? "#CFFAFE" : C.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div><div style={{ fontFamily: MONO, fontSize: 32, lineHeight: 1.35, color: fg, marginTop: 14 }}>{text}</div></From>;
  return (
    <Scene dur={dur}>
      <Title top={230}>Same questions, asked twice</Title>
      {card(0, "1 · Plain", d.example.plain_prompt, C.surface, C.ink, 430, 250)}
      {card(1, "2 · Spell it out first", d.example.spell_prompt, C.accent, "#fff", 760, 360)}
      <From delay={stage(2)} style={abs(80, 1180, 920, 150, { background: C.term, borderRadius: 26, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: 46, color: C.termText })}>{d.models.length} models · 20 questions · code marks each reply</From>
    </Scene>
  );
}

function Reply({ dur, d }) {
  const f = useCurrentFrame(), e = d.example, p = e.spell_prompt, typeEnd = Math.floor(dur * 0.3), shown = p.slice(0, Math.floor(interpolate(f, [4, typeEnd], [0, p.length], clamp)));
  const r = e.reply, rShown = r.slice(0, Math.floor(interpolate(f, [typeEnd, Math.floor(dur * 0.8)], [0, r.length], clamp)));
  return (
    <Scene dur={dur}>
      <Title top={230}>A real reply</Title>
      <div style={abs(60, 400, 960, 1100, { background: C.term, borderRadius: 26, overflow: "hidden" })}>
        <div style={abs(0, 0, 960, 62, { background: C.termHead, display: "flex", alignItems: "center", gap: 10, padding: "0 24px" })}>{["#EF4444", "#F59E0B", "#22C55E"].map((c) => <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />)}<span style={{ fontFamily: MONO, fontSize: 26, color: "#94A3B8", marginLeft: 16 }}>{e.reply_model}</span></div>
        <div style={abs(40, 90, 880, 290, { fontFamily: MONO, fontSize: 30, lineHeight: "44px", color: C.prompt })}>&gt; {shown}</div>
        <div style={abs(40, 420, 880, 480, { fontFamily: MONO, fontSize: 40, lineHeight: "58px", color: C.termText, whiteSpace: "pre-wrap" })}>{rShown}</div>
        <div style={abs(40, 930, 880, 130, { display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid #334155", opacity: interpolate(f, [Math.floor(dur * 0.8), Math.floor(dur * 0.8) + 8], [0, 1], clamp) })}><span style={{ fontFamily: SANS, fontSize: 40, color: C.termText }}>Correct count: {e.correct}</span><span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 80, color: e.reply_ok ? "#4ADE80" : "#FB923C" }}>{e.reply_answer ?? "?"} {e.reply_ok ? "✓" : "✗"}</span></div>
      </div>
    </Scene>
  );
}

function PlainScore({ dur, d }) {
  const n = d.models.length, rowH = Math.min(310, 960 / n);
  return (
    <Scene dur={dur}>
      <Title>Asked plainly</Title>
      <Bars rows={d.models.map((m) => ({ label: m.name, value: m.plain }))} total={d.total} y={440} rowH={rowH} delay={8} spread={Math.max(10, Math.floor(dur * 0.16))} />
      <From delay={dur * 0.5} style={abs(70, 1420, 940, 60, { fontFamily: SANS, fontSize: 36, color: C.dim, textAlign: "center" })}>Correct answers out of {d.total}. Bars start at zero.</From>
    </Scene>
  );
}

function FixScore({ dur, d }) {
  const f = useCurrentFrame(), n = d.models.length, rowH = Math.min(340, 1000 / n), full = 760;
  const t = (a, b) => interpolate(f, [a, b], [0, 1], clamp);
  return (
    <Scene dur={dur}>
      <Title top={200}>Spell it out first</Title>
      {d.models.map((m, i) => { const y = 380 + i * rowH, at = 8 + i * 10, pv = t(at, at + 22), sv = t(at + Math.floor(dur * 0.25), at + Math.floor(dur * 0.25) + 26); return (
        <div key={m.id}>
          <div style={abs(80, y, 920, 60, { fontFamily: SANS, fontWeight: 700, fontSize: 44, color: C.ink, opacity: Math.min(1, pv * 3) })}>{m.name}</div>
          <div style={abs(80, y + 70, full, 54, { background: C.surface, borderRadius: 27 })} /><div style={abs(80, y + 70, (m.plain / d.total) * full * pv, 54, { background: "#94A3B8", borderRadius: 27 })} />
          <div style={abs(860, y + 56, 140, 70, { fontFamily: SANS, fontWeight: 800, fontSize: 56, color: C.dim, textAlign: "right" })}>{Math.round(m.plain * pv)}</div>
          <div style={abs(80, y + 138, full, 54, { background: C.surface, borderRadius: 27 })} /><div style={abs(80, y + 138, (m.spelled / d.total) * full * sv, 54, { background: C.accent, borderRadius: 27 })} />
          <div style={abs(860, y + 124, 140, 70, { fontFamily: SANS, fontWeight: 800, fontSize: 56, color: C.accent, textAlign: "right" })}>{Math.round(m.spelled * sv)}</div>
        </div>); })}
      <div style={abs(80, 380 + n * rowH + 10, 920, 40, { display: "flex", gap: 36, fontFamily: SANS, fontWeight: 700, fontSize: 30, color: C.dim })}><span><span style={{ display: "inline-block", width: 22, height: 22, background: "#94A3B8", borderRadius: 11, marginRight: 8 }} />Plain</span><span><span style={{ display: "inline-block", width: 22, height: 22, background: C.accent, borderRadius: 11, marginRight: 8 }} />Spell it out first · out of {d.total}</span></div>
      <From delay={Math.floor(dur * 0.62)} style={abs(160, 380 + n * rowH + 80, 760, 130, { background: C.accent, color: "#fff", borderRadius: 28, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: 56 })}>+{d.sum.gain} right answers</From>
    </Scene>
  );
}

function Why({ dur, d }) {
  const f = useCurrentFrame(), { word, letters, tokens } = d.tokens, tile = Math.min(78, Math.floor(920 / letters) - 8), a = interpolate(f, [4, 16], [0, 1], clamp), b = interpolate(f, [Math.floor(dur * 0.45), Math.floor(dur * 0.45) + 14], [0, 1], clamp);
  const w = letters * (tile + 8) - 8, x0 = (1080 - w) / 2, blockW = (w - (tokens - 1) * 12) / tokens;
  return (
    <Scene dur={dur}>
      <Title top={220}>Models read tokens</Title>
      <div style={abs(0, 420, 1080, 90, { textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 64, color: C.ink, opacity: a })}>“{word}” has {letters} letters</div>
      {word.split("").map((c, i) => <div key={i} style={abs(x0 + i * (tile + 8), 560, tile, tile * 1.25, { background: C.surface, color: C.ink, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 800, fontSize: tile * 0.66, opacity: a })}>{c}</div>)}
      <div style={abs(0, 760, 1080, 90, { textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 64, color: C.accent, opacity: b })}>The model sees {tokens} tokens</div>
      {Array.from({ length: tokens }, (_, i) => <div key={i} style={abs(x0 + i * (blockW + 12), 900, blockW, 150, { background: C.accent, borderRadius: 18, opacity: b, transform: `scaleX(${b})`, transformOrigin: "left" })} />)}
      <div style={abs(80, 1130, 920, 150, { opacity: b, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 38, lineHeight: 1.25, color: C.dim })}>Token count measured with Gemini's tokenizer. The split itself is not shown: the model cannot see the letters inside a token.</div>
    </Scene>
  );
}

function Close2({ dur, d }) {
  const t = SHARED.useIn(0, 14);
  return (
    <Scene dur={dur}>
      <div style={abs(60, 240, 960, 1240, { background: C.accent, borderRadius: 34, transform: `translateY(${(1 - t) * 160}px)`, opacity: t })} />
      <From delay={6} style={abs(120, 330, 840, 560, { fontFamily: SANS, fontWeight: 800, fontSize: 92, lineHeight: 1.08, color: "#fff" })}>Make the model spell it out first.</From>
      <div style={abs(120, 960, 840, 460, { display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 18 })}>
        {d.models.map((m, i) => <From key={m.id} delay={12 + i * 6} dy={20} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: SANS, color: "#fff", fontSize: 44, fontWeight: 600, borderTop: "2px solid rgba(255,255,255,0.35)", paddingTop: 14 }}><span>{m.name}</span><span style={{ fontWeight: 800 }}>{m.plain} → {m.spelled}</span></From>)}
      </div>
    </Scene>
  );
}

const KINDS2 = { hook2: Hook2, ask2: Ask2, reply: Reply, plainscore: PlainScore, fixscore: FixScore, why: Why, close2: Close2 };
function AiTestedSpellout({ durationInFrames, scenes, captions, data }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <style>{FONT_FACES}</style>
      <div style={abs(0, 130, 1080, 50, { textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.24em", color: C.accent })}>AI  TESTED</div>
      {scenes.map((s) => { const K = KINDS2[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} d={data} scene={s} /></Sequence>; })}
      <Caption captions={captions} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: C.accent })} />
    </AbsoluteFill>
  );
}
export const spelloutCompositions = [{ id: "AiTestedSpellout", component: AiTestedSpellout, durationInFrames: 1140, fps: 30, width: 1080, height: 1920, defaultProps: { durationInFrames: 1140, scenes: [], captions: [], data: { models: [], example: { word: "", letter: "", correct: 0, plain_prompt: "", spell_prompt: "", reply: "", reply_model: "" }, tokens: { word: "", letters: 1, tokens: 1 }, sum: { gain: 0 }, total: 20 } } }];
