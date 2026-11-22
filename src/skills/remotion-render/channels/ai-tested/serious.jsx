// AI Tested, serious cut: "Will AI admit when it doesn't know?" on the dark kit (channels/_shared/serious.jsx). Fully motion graphics: counted cells,
// a mono index of the invented names, the real reply on a document card. Every number comes from the run's own experiment (plan(exp).data).
// `cues` are the scene-local frames at which each spoken phrase starts, so layers land on the words.
import React from "react";
import { useCurrentFrame } from "remotion";
import { abs } from "../_shared/parts.jsx";
import { COND, MONO, SANS, ramp, Kicker, Head, Count, Rule, Chip, Doc, Shell, WideShell, baseComp, wideComp } from "../_shared/serious.jsx";

export const T = { bg: "#090B0F", glow: "rgba(64,84,130,0.30)", line: "rgba(255,255,255,0.035)", ink: "#F3F5F8", dim: "#8D95A3", accent: "#FF3B30", rule: "rgba(255,255,255,0.22)", paper: "#F4F1EA", mark: "rgba(255,59,48,0.34)", ok: "#3DDC97", cell: "rgba(255,255,255,0.10)" };
const CELL = 66, GAP = 13.45;

function Cells({ seq, x = 70, y, delay = 0, step = 2 }) {
  const f = useCurrentFrame();
  return seq.map((o, i) => { const a = ramp(f, delay + i * step, delay + i * step + 6); return <div key={i} style={abs(x + i * (CELL + GAP), y, CELL, CELL, { background: a > 0.5 ? (o === "made_up" ? T.accent : T.ok) : T.cell, opacity: 0.35 + 0.65 * a, transform: `scale(${0.6 + 0.4 * a})` })} />; });
}

function Hook({ d, cues }) {
  const c1 = cues[1] ?? 66, hy = 800 + d.models.length * (CELL + GAP) + 30;
  return (<>
    <Kicker t={T} y={190}>One test · {d.models.length} models · {d.all} answers</Kicker>
    <Count t={T} x={60} y={250} w={520} size={470} to={d.made} delay={2} len={26} color={T.accent} />
    <Head t={T} x={d.made > 9 ? 560 : 370} y={470} w={500} size={170} lines={[`of ${d.all}`]} delay={10} color={T.ink} upper={false} />
    <Rule t={T} y={760} delay={8} />
    {d.models.map((m, i) => <Cells key={i} seq={m.seq} y={800 + i * (CELL + GAP)} delay={14 + i * 12} />)}
    <Head t={T} y={hy} size={104} lines={["Invented things", "described as real"]} delay={c1} />
    <Chip t={T} x={70} y={hy + 236} delay={c1 + 22} size={48}>Made up</Chip>
  </>);
}
function Fakes({ d }) {
  const f = useCurrentFrame();
  return (<>
    <Kicker t={T} y={190}>{d.fakes} names we invented</Kicker>
    {d.fakeLabels.map((s, i) => { const a = ramp(f, 4 + i * 3, 12 + i * 3), b = ramp(f, 30 + i * 3, 36 + i * 3); return (
      <div key={i} style={abs(70, 262 + i * 90, 940, 78, { display: "flex", alignItems: "center", gap: 22, borderBottom: `2px solid ${T.cell}`, opacity: a, transform: `translateX(${(1 - a) * -40}px)` })}>
        <span style={{ fontFamily: MONO, fontSize: 24, color: T.dim, width: 44 }}>{String(i + 1).padStart(2, "0")}</span>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 36, color: T.ink, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</span>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 20, letterSpacing: "0.08em", color: T.accent, opacity: b }}>DOES NOT EXIST</span>
      </div>); })}
  </>);
}
function Models({ d }) {
  const f = useCurrentFrame(), q = "Tell me about … Keep it to two sentences.", n = Math.floor(ramp(f, 34, 70, (x) => x) * q.length);
  return (<>
    <Kicker t={T} y={190}>The method</Kicker>
    <Head t={T} y={250} size={128} lines={["Same question,", `${d.models.length} models`]} />
    {d.models.map((m, i) => { const a = ramp(f, 12 + i * 8, 24 + i * 8), n = d.models.length, w = (940 - (n - 1) * 20) / n; return (
      <div key={i} style={abs(70 + i * (w + 20), 600, w, 210, { border: `3px solid ${T.rule}`, background: "rgba(255,255,255,0.04)", padding: "26px 28px", boxSizing: "border-box", opacity: a, transform: `translateY(${(1 - a) * 50}px)` })}>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.12em", color: T.dim }}>MODEL {String.fromCharCode(65 + i)}</div>
        <div style={{ fontFamily: COND, fontWeight: 700, fontSize: n > 2 ? 40 : 54, lineHeight: 1.05, color: T.ink, marginTop: 14, textTransform: "uppercase" }}>{m.name}</div>
      </div>); })}
    <div style={abs(70, 900, 940, 330, { background: T.paper, boxShadow: `14px 14px 0 ${T.accent}`, padding: "30px 36px", boxSizing: "border-box", opacity: ramp(f, 28, 36) })}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: "0.12em", color: "rgba(20,22,26,0.55)" }}>PROMPT</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 50, lineHeight: 1.3, color: "#14161A", marginTop: 16 }}>{q.slice(0, n)}<span style={{ opacity: f % 16 < 8 ? 1 : 0, color: T.accent }}>▌</span></div>
    </div>
  </>);
}
function Results({ d, cues }) {
  const f = useCurrentFrame();
  return (<>
    <Kicker t={T} y={190}>Asked about {d.fakes} invented things</Kicker>
    {d.models.map((m, i) => { const many = d.models.length > 2, at = i ? (cues[i] ?? i * 90) : 4, y = 250 + i * (many ? 372 : 520), cs = many ? 180 : 250; return (
      <div key={i} style={{ opacity: ramp(f, at, at + 8) }}>
        <div style={abs(70, y, 940, 70, { fontFamily: COND, fontWeight: 700, fontSize: 60, color: T.ink, textTransform: "uppercase" })}>{m.name}</div>
        <Cells seq={m.seq} y={y + 84} delay={at + 6} step={2} />
        <Count t={T} x={64} y={y + 168} w={300} size={cs} to={m.made_up} delay={at + 22} len={16} color={m.made_up ? T.accent : T.ok} />
        <Head t={T} x={(m.made_up > 9 ? 1.4 : 0.88) * cs} y={y + 168 + cs * 0.22} w={700} size={cs * 0.28} lines={[`of ${m.fakes}`, "made up"]} delay={at + 26} />
      </div>); })}
    <div style={abs(70, 1378, 940, 40, { display: "flex", gap: 40, fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: "0.08em", color: T.dim, textTransform: "uppercase" })}>
      <span><span style={{ display: "inline-block", width: 22, height: 22, background: T.accent, marginRight: 12, verticalAlign: "-3px" }} />described as real</span>
      <span><span style={{ display: "inline-block", width: 22, height: 22, background: T.ok, marginRight: 12, verticalAlign: "-3px" }} />said it did not know</span>
    </div>
  </>);
}
function Control({ d }) {
  const f = useCurrentFrame();
  return (<>
    <Kicker t={T} y={190}>The control</Kicker>
    <Head t={T} y={250} size={128} lines={["Real topics"]} />
    {d.realLabels.map((s, i) => { const a = ramp(f, 6 + i * 5, 16 + i * 5); return (
      <div key={i} style={abs(70, 470 + i * 150, 940, 120, { display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: `10px solid ${T.ok}`, background: "rgba(255,255,255,0.05)", padding: "0 30px", boxSizing: "border-box", opacity: a, transform: `translateX(${(1 - a) * 80}px)` })}>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: T.ink }}>{s}</span>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, letterSpacing: "0.1em", color: T.ok }}>ANSWERED</span>
      </div>); })}
    <Chip t={T} x={70} y={1110} delay={34} size={40} color={T.ok} filled={false}>None flagged as unknown</Chip>
  </>);
}
const firstWords = (s, max) => { const cut = s.slice(0, max), i = cut.lastIndexOf(" "); return s.length <= max ? s : cut.slice(0, i); };
function Example({ d }) {
  const e = d.example; if (!e) return null;
  const reply = String(e.reply || "").replace(/[*_`#]+/g, "").replace(/\s+/g, " ").trim(), text = reply.length > 210 ? `${firstWords(reply, 210)}…` : reply, made = e.outcome === "made_up";
  return (<>
    <Kicker t={T} y={190}>Asked: {e.label}</Kicker>
    <Doc t={T} y={270} source={e.model} meta="Reply, word for word" text={text} hl={[firstWords(text, 62)]} size={44} font={MONO} hlDelay={8} />
    <Chip t={T} x={70} y={1010} delay={24} size={64} color={made ? T.accent : T.ok}>{made ? "This does not exist" : "Admitted"}</Chip>
  </>);
}
function Tip({ d, cues }) {
  const c1 = cues[1] ?? 50, c2 = cues[2] ?? 110, f = useCurrentFrame();
  return (<>
    <Kicker t={T} y={190}>What to do</Kicker>
    <Head t={T} y={250} size={178} lines={["Confident", "is not true"]} color={f >= c2 ? T.dim : T.ink} />
    <Rule t={T} y={680} delay={c1 - 4} color={T.accent} h={8} />
    <Head t={T} y={720} size={150} lines={["Ask for", "the source"]} delay={c1} color={T.accent} />
    <div style={abs(70, 1110, 940, 250, { borderLeft: `10px solid ${T.ink}`, paddingLeft: 30, boxSizing: "border-box", opacity: ramp(f, c2, c2 + 10) })}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, letterSpacing: "0.12em", color: T.dim }}>TELL US BELOW</div>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 60, lineHeight: 1.12, color: T.ink, marginTop: 12 }}>Has AI ever made something up for you?</div>
    </div>
  </>);
}

const BEATS = { hook: Hook, fakes: Fakes, models: Models, results: Results, control: Control, example: Example, tip: Tip };
export function AiTestedSerious({ durationInFrames, scenes, captions, data }) {
  return <Shell t={T} durationInFrames={durationInFrames} scenes={scenes} captions={captions} beats={BEATS} pass={{ d: data }} label={["AI Tested", data.date || ""]} />;
}
export function AiTestedSeriousWide({ durationInFrames, scenes, captions, data }) {
  return <WideShell t={T} durationInFrames={durationInFrames} scenes={scenes} captions={captions} beats={BEATS} pass={{ d: data }} label={["AI Tested", data.date || ""]} />;
}
const DP = { durationInFrames: 900, scenes: [], captions: [], data: { models: [], fakeLabels: [], realLabels: [], example: null, fakes: 12, made: 0, all: 0 } };
export const seriousCompositions = [{ id: "AiTestedSeriousWide", component: AiTestedSeriousWide, ...wideComp, defaultProps: DP }, { id: "AiTestedSerious", component: AiTestedSerious, ...baseComp, defaultProps: { durationInFrames: 900, scenes: [], captions: [], data: { models: [], fakeLabels: [], realLabels: [], example: null, fakes: 12, made: 0, all: 0 } } }];
