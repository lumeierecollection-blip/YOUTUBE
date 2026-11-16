// AI Tested Short for the long-form "We Gave Free AIs the Same 5 Jobs. One Took 7 Minutes."
// Same look as the other AI Tested Shorts (white page, one blue accent). The pictures are the real screen recordings of each AI's app
// (lf2/ai-tested/clips/ai-tested-four-ais) and every number is read from data/clone/runs/ai-tested-four-ais by fourais.mjs.
import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { SHARED } from "./experiment.jsx";

const { C, SANS, MONO, abs, From, Caption, clamp, ease } = SHARED;
const CLIPS = "lf2/ai-tested/clips/ai-tested-four-ais";
const logoOf = (who, images) => (who === "gemini" ? images.gemini : images.openai);

/** Scene wrapper: the first scene starts fully visible and the last ends fully visible, so the replay joins up. */
const Sc = ({ dur, first, last, children }) => {
  const f = useCurrentFrame();
  const a = first ? 1 : interpolate(f, [0, 4], [0, 1], clamp), b = last ? 1 : interpolate(f, [dur - 3, dur], [1, 0], clamp);
  return <AbsoluteFill style={{ opacity: Math.min(a, b) }}>{children}</AbsoluteFill>;
};
const Logo = ({ src, w, h }) => <img src={src} style={{ width: w, height: h, objectFit: "contain" }} />;

/** One recorded app, cropped by the per-clip zoom measured in FRAMES.json. start = seconds into the recording where the page is already running. */
function Clip({ x, y, w, h, clip, zoom, focus, start = 1.5, dur, delay = 0, tag, ok }) {
  const f = useCurrentFrame(), z = interpolate(f, [0, dur], zoom, clamp);
  return (
    <From delay={delay} dy={30} style={abs(x, y, w, h, { background: "#0d0e10", borderRadius: 26, overflow: "hidden", border: `4px solid ${ok === false ? C.bad : C.accent}` })}>
      <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: focus }}>
        <Sequence from={-Math.round(start * 30)}><OffthreadVideo src={staticFile(`${CLIPS}/${clip}.mp4`)} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /></Sequence>
      </AbsoluteFill>
      {tag ? <div style={abs(w - 330, h - 84, 300, 62, { background: ok === false ? C.bad : C.good, color: "#fff", borderRadius: 14, fontFamily: SANS, fontWeight: 800, fontSize: 40, display: "flex", alignItems: "center", justifyContent: "center" })}>{tag}</div> : null}
    </From>
  );
}
const Label = ({ y, who, images, name, right, delay = 0, color = C.ink }) => (
  <From delay={delay} dx={-60} dy={0} style={abs(70, y, 940, 70, { display: "flex", alignItems: "center", gap: 20 })}>
    <div style={{ background: C.surface, borderRadius: 14, padding: "6px 16px" }}><Logo src={logoOf(who, images)} w={120} h={46} /></div>
    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 44, color: C.ink }}>{name}</span>
    <span style={{ marginLeft: "auto", fontFamily: SANS, fontWeight: 800, fontSize: 44, color }}>{right}</span>
  </From>
);

const M = (d, id) => d.models.find((m) => m.id === id);

/** First frame and last frame: the same picture (the replay loops on it). Three AIs, each with its measured total time and a bar on one shared scale. */
function HookF({ dur, d, images, scene }) {
  const f = useCurrentFrame(), last = !!scene.loop, max = d.models[0].seconds;
  return (
    <Sc dur={dur} first={!last} last={last}>
      <div style={abs(70, 215, 940, 330, { fontFamily: SANS, fontWeight: 800, fontSize: 100, lineHeight: 1.03, color: C.ink })}>Which AI would you trust?</div>
      {d.models.map((m, i) => { const y = 560 + i * 330, grow = last ? 1 : interpolate(f, [0, 22], [0.0, 1], { ...clamp, easing: ease }); return (
        <div key={m.id}>
          <div style={abs(70, y, 940, 120, { display: "flex", alignItems: "center", gap: 24 })}>
            <div style={{ background: C.surface, borderRadius: 18, padding: "10px 18px" }}><Logo src={logoOf(m.who, images)} w={150} h={64} /></div>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 34, color: C.dim, lineHeight: 1.1, whiteSpace: "nowrap" }}>{m.name}</span>
            <span style={{ marginLeft: "auto", fontFamily: SANS, fontWeight: 800, fontSize: 104, lineHeight: 1, color: i === 0 ? C.bad : C.accent, whiteSpace: "nowrap" }}>{Math.round(m.seconds)}<span style={{ fontSize: 44 }}> s</span></span>
          </div>
          <div style={abs(70, y + 150, 940, 44, { background: C.surface, borderRadius: 22 })} />
          <div style={abs(70, y + 150, Math.max(14, 940 * (m.seconds / max)) * grow, 44, { background: i === 0 ? C.bad : C.accent, borderRadius: 22 })} />
        </div>); })}
      <div style={abs(70, 1550, 940, 40, { fontFamily: MONO, fontWeight: 700, fontSize: 28, color: C.dim })}>time to write all 5 jobs · {d.date}</div>
    </Sc>
  );
}

/** The five jobs, each as the real recording of Gemini's app. */
function JobsF({ dur, d }) {
  const w = 460, h = 259;
  return (
    <Sc dur={dur}>
      <From dy={30} style={abs(70, 215, 940, 130, { fontFamily: SANS, fontWeight: 800, fontSize: 76, lineHeight: 1.05, color: C.ink })}>Same 5 jobs. One try each.</From>
      {d.jobs.map((j, i) => <Clip key={j.id} x={70 + (i % 2) * 480} y={380 + Math.floor(i / 2) * 300} w={w} h={h} clip={`${j.id}-gemini-app`} zoom={j.zoom} focus={j.focus} dur={dur} delay={2 + i * 7} />)}
      <From delay={40} dy={20} style={abs(550, 980, 460, 259, { background: C.accent, borderRadius: 26, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: SANS, fontWeight: 800, textAlign: "center" })}><div style={{ fontSize: 110, lineHeight: 1 }}>5</div><div style={{ fontSize: 38 }}>jobs · 3 AIs</div></From>
      <From delay={52} dy={20} style={abs(70, 1290, 940, 200, { background: C.surface, borderRadius: 26, padding: "26px 36px", boxSizing: "border-box", fontFamily: MONO, fontWeight: 700, fontSize: 34, lineHeight: 1.3, color: C.ink })}>{d.jobs.map((j) => j.label).join(" · ")}<br /><span style={{ color: C.dim }}>same prompt for every AI</span></From>
    </Sc>
  );
}

/** One AI's recording, big, with its verdict. */
function SoloF({ dur, d, images, scene }) {
  const j = d.jobs.find((x) => x.id === scene.job), m = M(d, scene.model), r = j.runs[m.who === "gemini" ? "gemini" : m.key];
  return (
    <Sc dur={dur}>
      <From dy={30} style={abs(70, 215, 940, 110, { fontFamily: SANS, fontWeight: 800, fontSize: 70, lineHeight: 1.05, color: C.ink })}>{j.title}</From>
      <Label y={340} who={m.who} images={images} name={m.name} right={`${r.seconds.toFixed(0)} s`} delay={2} color={C.dim} />
      <Clip x={70} y={430} w={940} h={529 + 70} clip={r.clip} zoom={r.zoom} focus={r.focus} dur={dur} delay={4} tag={r.pass ? "PASS" : "FAIL"} ok={r.pass} />
      <From delay={Math.floor(dur * 0.3)} dy={30} style={abs(70, 1060, 940, 400, { fontFamily: SANS, fontWeight: 800, fontSize: 118, lineHeight: 1.0, color: r.pass ? C.good : C.bad })}>{r.headline}</From>
      <From delay={Math.floor(dur * 0.5)} dy={20} style={abs(70, 1330, 940, 200, { fontFamily: SANS, fontWeight: 700, fontSize: 40, lineHeight: 1.2, color: C.dim })}>{r.note}</From>
    </Sc>
  );
}

/** Two recordings stacked: the same prompt, two AIs. */
function DuelF({ dur, d, images, scene }) {
  const j = d.jobs.find((x) => x.id === scene.job), A = j.runs.gemini, B = j.runs[scene.other], mB = d.models.find((m) => m.key === scene.other), mA = M(d, "gemini");
  return (
    <Sc dur={dur}>
      <From dy={30} style={abs(70, 205, 940, 80, { fontFamily: SANS, fontWeight: 800, fontSize: 60, color: C.ink })}>{j.title}</From>
      <Label y={290} who="gemini" images={images} name={mA.name} right={`${A.seconds.toFixed(0)} s`} delay={0} color={C.dim} />
      <Clip x={70} y={370} w={940} h={470} clip={A.clip} zoom={A.zoom} focus={A.focus} dur={dur} delay={0} tag="PASS" ok />
      <Label y={870} who="openai" images={images} name={mB.name} right={`${B.seconds.toFixed(0)} s`} delay={Math.floor(dur * 0.25)} color={C.dim} />
      <Clip x={70} y={950} w={940} h={470} clip={B.clip} zoom={B.zoom} focus={B.focus} dur={dur} delay={Math.floor(dur * 0.25)} tag={B.pass ? "PASS" : "FAIL"} ok={B.pass} />
      <From delay={Math.floor(dur * 0.45)} dy={20} style={abs(70, 1440, 940, 100, { fontFamily: SANS, fontWeight: 800, fontSize: 56, color: B.pass ? C.good : C.bad })}>{B.headline}</From>
    </Sc>
  );
}

/** Total time per AI on one scale. scene.show rows are drawn; rows before scene.animFrom are already full-grown (the picture before it). */
function TimeF({ dur, d, images, scene }) {
  const f = useCurrentFrame(), max = d.models[0].seconds, show = scene.show || 3, from = scene.animFrom || 0, solo = show === 1;
  return (
    <Sc dur={dur}>
      <From dy={30} style={abs(70, 215, 940, 120, { fontFamily: SANS, fontWeight: 800, fontSize: 70, lineHeight: 1.05, color: C.ink })}>Time to write all 5</From>
      {d.models.slice(0, show).map((m, i) => { const t = i < from ? 1 : interpolate(f, [4 + (i - from) * 10, 34 + (i - from) * 10], [0, 1], { ...clamp, easing: ease }), y = solo ? 480 : 400 + i * 330; return (
        <div key={m.id}>
          <div style={abs(70, y, 940, 100, { display: "flex", alignItems: "center", gap: 22 })}>
            <div style={{ background: C.surface, borderRadius: 16, padding: "8px 18px" }}><Logo src={logoOf(m.who, images)} w={150} h={56} /></div>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 36, color: C.dim }}>{m.name}</span>
          </div>
          <div style={abs(70, y + 110, 940, 70, { background: C.surface, borderRadius: 35 })} />
          <div style={abs(70, y + 110, Math.max(16, 940 * (m.seconds / max)) * t, 70, { background: i === 0 ? C.bad : C.accent, borderRadius: 35 })} />
          <div style={abs(70, y + 190, 940, solo ? 260 : 110, { fontFamily: SANS, fontWeight: 800, fontSize: solo ? 250 : 100, lineHeight: 1, color: i === 0 ? C.bad : C.accent })}>{i === 0 ? Math.round(m.seconds * t) : (m.seconds * t).toFixed(1)}<span style={{ fontSize: solo ? 90 : 44 }}> s</span></div>
        </div>); })}
      {solo ? <From delay={Math.floor(dur * 0.45)} dy={30} style={abs(70, 1010, 940, 200, { fontFamily: SANS, fontWeight: 800, fontSize: 80, lineHeight: 1.05, color: C.ink })}>{Math.floor(d.models[0].seconds / 60)} min {Math.round(d.models[0].seconds % 60)} s<br /><span style={{ color: C.dim, fontSize: 48 }}>for all 5 jobs</span></From> : null}
    </Sc>
  );
}

function ScoreF({ dur, d, images }) {
  const f = useCurrentFrame();
  return (
    <Sc dur={dur}>
      <From dy={30} style={abs(70, 215, 940, 120, { fontFamily: SANS, fontWeight: 800, fontSize: 70, lineHeight: 1.05, color: C.ink })}>Jobs that worked</From>
      {d.models.map((m, i) => { const y = 380 + i * 360, shown = Math.floor(interpolate(f, [4 + i * 12, 30 + i * 12], [0, 5], clamp) + 0.001); return (
        <div key={m.id}>
          <div style={abs(70, y, 940, 100, { display: "flex", alignItems: "center", gap: 22 })}>
            <div style={{ background: C.surface, borderRadius: 16, padding: "8px 18px" }}><Logo src={logoOf(m.who, images)} w={150} h={56} /></div>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 36, color: C.dim }}>{m.name}</span>
            <span style={{ marginLeft: "auto", fontFamily: SANS, fontWeight: 800, fontSize: 100, lineHeight: 1, color: m.passed === 5 ? C.good : C.bad }}>{m.passed}<span style={{ fontSize: 48, color: C.dim }}> / 5</span></span>
          </div>
          {m.results.map((r, k) => <div key={r.id} style={abs(70 + k * 192, y + 120, 172, 112, { borderRadius: 18, background: k < shown ? (r.pass ? C.good : C.bad) : C.surface, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: 40 })}>{k < shown ? (r.pass ? "✓" : "✗") : ""}</div>)}
          <div style={abs(70, y + 240, 940, 40, { display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 24, color: C.dim })}>{m.results.map((r) => <span key={r.id} style={{ width: 192 }}>{r.id}</span>)}</div>
        </div>); })}
    </Sc>
  );
}

function QuestionF({ dur, d }) {
  const t = SHARED.useIn(0, 14);
  return (
    <Sc dur={dur}>
      <div style={abs(60, 240, 960, 1240, { background: C.accent, borderRadius: 34, transform: `translateY(${(1 - t) * 160}px)`, opacity: t })} />
      <From delay={6} style={abs(120, 330, 840, 300, { fontFamily: SANS, fontWeight: 800, fontSize: 108, lineHeight: 1.05, color: "#fff" })}>Fast, or finished?</From>
      <From delay={Math.floor(dur * 0.3)} dy={30} style={abs(120, 700, 840, 700, { fontFamily: SANS, color: "#fff", borderTop: "3px solid rgba(255,255,255,0.4)", paddingTop: 40 })}>
        <div style={{ fontWeight: 800, fontSize: 150, lineHeight: 1 }}>{d.models[1].passed}<span style={{ fontSize: 70, opacity: 0.8 }}> / 5 in {d.models[1].seconds.toFixed(0)} s</span></div>
        <div style={{ fontWeight: 800, fontSize: 150, lineHeight: 1, marginTop: 30 }}>{d.models[0].passed}<span style={{ fontSize: 70, opacity: 0.8 }}> / 5 in {Math.round(d.models[0].seconds)} s</span></div>
        <div style={{ fontWeight: 700, fontSize: 48, lineHeight: 1.2, marginTop: 40, color: "#E0F2FE" }}>How far do you trust a quick answer?</div>
      </From>
    </Sc>
  );
}

function CtaF({ dur, d }) {
  const f = useCurrentFrame(), pulse = 1 + 0.04 * Math.sin(f / 5);
  return (
    <Sc dur={dur}>
      <From dy={30} style={abs(70, 230, 940, 130, { fontFamily: SANS, fontWeight: 800, fontSize: 84, lineHeight: 1.05, color: C.ink })}>The full test is on our channel</From>
      <From delay={6} dy={50} style={abs(70, 520, 940, 560, { background: C.term, borderRadius: 30, padding: "50px 50px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" })}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, letterSpacing: "0.12em", color: C.prompt }}>AI TESTED · FULL VIDEO</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 68, lineHeight: 1.08, color: "#fff" }}>{d.title}</div>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 28, color: C.termText }}>all 5 jobs, every AI, side by side</div>
      </From>
      <From delay={Math.floor(dur * 0.4)} dy={30} style={abs(70, 1150, 940, 160, { background: C.accent, borderRadius: 30, color: "#fff", fontFamily: SANS, fontWeight: 800, fontSize: 58, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pulse})` })}>▶  Watch it on the channel</From>
    </Sc>
  );
}

const KINDS_F = { hookF: HookF, jobsF: JobsF, soloF: SoloF, duelF: DuelF, timeF: TimeF, fastF: TimeF, scoreF: ScoreF, questionF: QuestionF, ctaF: CtaF };
function AiTestedFourAis({ durationInFrames, scenes, captions, images, data }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <style>{FONT_FACES}</style>
      <div style={abs(0, 130, 1080, 50, { textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.24em", color: C.accent })}>AI  TESTED</div>
      {scenes.map((s) => { const K = KINDS_F[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} d={data} images={images} scene={s} /></Sequence>; })}
      <Caption captions={captions} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: C.accent })} />
    </AbsoluteFill>
  );
}
export const fourAisCompositions = [{ id: "AiTestedFourAis", component: AiTestedFourAis, durationInFrames: 1110, fps: 30, width: 1080, height: 1920, defaultProps: { durationInFrames: 1110, scenes: [], captions: [], images: {}, data: { models: [], jobs: [], date: "", title: "" } } }];
