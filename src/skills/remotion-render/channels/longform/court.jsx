// Court & Spotlight long form (1920x1080): an investigation, not a gossip reel. Dark navy case desk; sources shown as real documents; every claim
// carries a status chip drawn differently so an allegation can never look like a finding. Sample text in previews is real excerpts from fetched
// sources (DOJ release via Blast Magazine, CBS News, 2008) and says so on the card. Nothing is invented.
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, ramp, W, H } from "./kit.jsx";

const C = { bg: "#0B1018", desk: "#101826", paper: "#F2EEE4", ink: "#14161A", mute: "#8C97A8", line: "rgba(255,255,255,0.14)", red: "#D9352B", amber: "#E8A317", blue: "#4C8DFF", green: "#3FB27F", hl: "rgba(232,163,23,0.45)" };
const SERIF = '"Playfair Display", Georgia, serif', TEXT = '"Noto Serif", Georgia, serif', COND = '"Roboto Condensed", "Arial Narrow", sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace';
// One look per status. Filled = decided by a court or confirmed in the record. Outlined = claimed, said or disputed.
export const STATUS = { finding: { label: "Court finding", c: C.green, fill: true }, record: { label: "On the record", c: C.blue, fill: true }, statement: { label: "Statement", c: C.mute, fill: false }, allegation: { label: "Allegation", c: C.amber, fill: false }, disputed: { label: "Disputed", c: C.red, fill: false } };
const Chip = ({ st, x, y, delay = 0, size = 34 }) => { const f = useCurrentFrame(), k = STATUS[st], a = ramp(f, delay, delay + 8); return (<div style={abs(x, y, "auto", "auto", { opacity: a, transform: `scale(${1.3 - 0.3 * a})`, transformOrigin: "0 50%", fontFamily: COND, fontWeight: 700, fontSize: size, letterSpacing: "0.1em", textTransform: "uppercase", padding: "6px 18px", background: k.fill ? k.c : "transparent", color: k.fill ? "#fff" : k.c, border: `4px ${k.fill ? "solid" : "dashed"} ${k.c}`, whiteSpace: "nowrap" })}>{k.label}</div>); };
const Kick = ({ children, delay = 0 }) => { const f = useCurrentFrame(); return <div style={abs(110, 64, 1700, 40, { fontFamily: MONO, fontSize: 24, letterSpacing: "0.18em", textTransform: "uppercase", color: C.mute, opacity: ramp(f, delay, delay + 10) })}><span style={{ color: C.red }}>■ </span>{children}</div>; };
const Hl = ({ text, hl, delay = 14, step = 22 }) => { const f = useCurrentFrame(); let rest = text; const out = []; hl.forEach((h, n) => { const i = rest.indexOf(h); if (i < 0) return; if (i) out.push(<span key={`p${n}`}>{rest.slice(0, i)}</span>); const m = ramp(f, delay + n * step, delay + n * step + 16); out.push(<span key={`h${n}`} style={{ backgroundImage: `linear-gradient(${C.hl},${C.hl})`, backgroundRepeat: "no-repeat", backgroundSize: `${m * 100}% 100%` }}>{h}</span>); rest = rest.slice(i + h.length); }); out.push(<span key="r">{rest}</span>); return <>{out}</>; };

/** A document: header names the source, body is the real text, the quoted words are highlighted, a status chip says what kind of statement it is. */
function DocScene({ s }) {
  const f = useCurrentFrame(), a = ramp(f, 0, 16);
  return (<>
    <Kick>{s.kicker}</Kick>
    <div style={abs(300, 150, 1320, 800, { background: C.paper, color: C.ink, boxShadow: "0 40px 100px rgba(0,0,0,0.6)", transform: `translateY(${(1 - a) * 80}px) rotate(${(1 - a) * -1.2}deg)`, opacity: ramp(f, 0, 6) })}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "22px 44px", borderBottom: "2px solid rgba(20,22,26,0.18)", fontFamily: MONO, fontSize: 22, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(20,22,26,0.6)" }}><span>{s.source}</span><span>{s.date}</span></div>
      <div style={{ padding: "50px 70px", fontFamily: TEXT, fontSize: 46, lineHeight: 1.45 }}>{s.title && <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 58, lineHeight: 1.12, marginBottom: 30 }}>{s.title}</div>}“<Hl text={s.text} hl={s.hl} />”</div></div>
    <Chip st={s.status} x={300} y={985} delay={30} />
    {s.sample && <div style={abs(900, 990, 920, 40, { fontFamily: MONO, fontSize: 20, color: C.mute, textAlign: "right" })}>{s.sample}</div>}
  </>);
}
/** A press clipping: masthead, headline, the real standfirst. */
function HeadlineScene({ s }) {
  const f = useCurrentFrame(), a = ramp(f, 0, 14);
  return (<>
    <Kick>{s.kicker}</Kick>
    <div style={abs(380, 160, 1160, 760, { background: "#EDE6D3", color: C.ink, padding: "36px 56px", boxSizing: "border-box", boxShadow: "0 40px 100px rgba(0,0,0,0.6)", transform: `translateY(${(1 - a) * 60}px)`, opacity: ramp(f, 0, 8) })}>
      <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 40, letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "3px double #14161A", paddingBottom: 14, textAlign: "center" }}>{s.masthead}</div>
      <div style={{ fontFamily: MONO, fontSize: 20, textAlign: "center", margin: "10px 0 28px", color: "#555" }}>{s.date}</div>
      <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 70, lineHeight: 1.05 }}>{s.headline}</div>
      <div style={{ fontFamily: TEXT, fontSize: 32, lineHeight: 1.45, marginTop: 28, color: "#222" }}>{s.body}</div></div>
    <Chip st={s.status} x={380} y={960} delay={26} />
  </>);
}
/** The case in dated order. s.events: [{ date, text, status }] drawn down a vertical line. */
function TimelineScene({ s }) {
  const f = useCurrentFrame(), n = s.events.length;
  return (<>
    <Kick>{s.kicker}</Kick>
    <div style={abs(540, 150, 6, (800 * ramp(f, 4, 30 + n * 8)), { background: C.mute })} />
    {s.events.map((e, i) => { const y = 160 + i * (800 / n), a = ramp(f, 10 + i * 10, 22 + i * 10); return (<div key={i} style={{ opacity: a, transform: `translateX(${(1 - a) * 30}px)` }}>
      <div style={abs(520, y + 18, 46, 46, { borderRadius: 23, background: STATUS[e.status].fill ? STATUS[e.status].c : C.bg, border: `5px ${STATUS[e.status].fill ? "solid" : "dashed"} ${STATUS[e.status].c}` })} />
      <div style={abs(110, y, 380, 80, { textAlign: "right", fontFamily: COND, fontWeight: 700, fontSize: 46, lineHeight: "80px", color: "#fff" })}>{e.date}</div>
      <div style={abs(620, y, 1180, 90, { fontFamily: TEXT, fontSize: 34, lineHeight: 1.25, color: "#E8ECF3" })}>{e.text}<span style={{ marginLeft: 16, fontFamily: COND, fontSize: 22, letterSpacing: "0.1em", textTransform: "uppercase", color: STATUS[e.status].c }}>{STATUS[e.status].label}</span></div></div>); })}
  </>);
}
/** A real, licensed photograph on the desk with the caption and its source; never altered. */
function PhotoScene({ s, images, credits }) {
  const f = useCurrentFrame(), a = ramp(f, 0, 16);
  return (<>
    <Kick>{s.kicker}</Kick>
    <div style={abs(180, 140, 700, 840, { background: "#fff", padding: 16, boxSizing: "border-box", boxShadow: "0 30px 90px rgba(0,0,0,0.65)", transform: `rotate(${(1 - a) * -3 - 1}deg) translateY(${(1 - a) * 40}px)`, opacity: ramp(f, 0, 8) })}><Img src={images[s.image]} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.pos || "50% 20%", filter: s.gray ? "grayscale(1) contrast(1.05)" : "none" }} /></div>
    <div style={abs(980, 200, 800, 160, { fontFamily: SERIF, fontWeight: 700, fontSize: 84, lineHeight: 1.04, color: "#fff", opacity: ramp(f, 10, 24) })}>{s.name}</div>
    <div style={abs(980, 420, 800, 300, { fontFamily: TEXT, fontSize: 38, lineHeight: 1.4, color: "#CBD3E1", opacity: ramp(f, 18, 32) })}>{s.caption}</div>
    {s.status && <Chip st={s.status} x={980} y={760} delay={34} />}
    <div style={abs(180, 996, 1500, 30, { fontFamily: MONO, fontSize: 18, color: C.mute })}>{credits[s.image]}</div>
  </>);
}
/** Who is connected to whom, with the kind of link on every edge. s.nodes: [{ id, label, x, y }], s.edges: [{ from, to, label, status }] */
function RelationsScene({ s }) {
  const f = useCurrentFrame(), N = Object.fromEntries(s.nodes.map((n) => [n.id, n]));
  return (<>
    <Kick>{s.kicker}</Kick>
    <svg viewBox="0 0 1920 1080" width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {s.edges.map((e, i) => { const a = N[e.from], b = N[e.to], k = STATUS[e.status], p = ramp(f, 24 + i * 12, 44 + i * 12); return (<g key={i}>
        <line x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * p} y2={a.y + (b.y - a.y) * p} stroke={k.c} strokeWidth="5" strokeDasharray={k.fill ? "0" : "14 10"} />
        <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 16} textAnchor="middle" fontFamily={COND} fontWeight="700" fontSize="30" letterSpacing="2" fill={k.c} opacity={ramp(f, 40 + i * 12, 52 + i * 12)}>{e.label.toUpperCase()}</text></g>); })}
      {s.nodes.map((n, i) => { const a = ramp(f, 4 + i * 8, 18 + i * 8); return (<g key={n.id} opacity={a}><circle cx={n.x} cy={n.y} r="72" fill={C.desk} stroke="#fff" strokeWidth="5" /><text x={n.x} y={n.y + 12} textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="34" fill="#fff">{n.label}</text></g>); })}
    </svg>
  </>);
}
/** Large outcome figure with a status chip: what the record decided. */
function OutcomeScene({ s }) {
  const f = useCurrentFrame();
  return (<>
    <Kick>{s.kicker}</Kick>
    <div style={abs(110, 200, 1700, 420, { fontFamily: COND, fontWeight: 700, fontSize: 380, lineHeight: 1, color: C.red, opacity: ramp(f, 0, 12), transform: `translateY(${(1 - ramp(f, 0, 16)) * 40}px)` })}>{s.big}</div>
    <div style={abs(120, 640, 1680, 150, { fontFamily: SERIF, fontWeight: 700, fontSize: 90, color: "#fff", opacity: ramp(f, 10, 24) })}>{s.label}</div>
    <Chip st={s.status} x={120} y={830} delay={26} size={42} />
    <div style={abs(120, 960, 1680, 60, { fontFamily: MONO, fontSize: 24, color: C.mute })}>{s.source}</div>
  </>);
}
const KINDS = { doc: DocScene, headline: HeadlineScene, timeline: TimelineScene, photo: PhotoScene, relations: RelationsScene, outcome: OutcomeScene };
export function CourtSceneOnly({ scene, images = {}, credits = {} }) {
  const B = KINDS[scene.kind], f = useCurrentFrame();
  return (<AbsoluteFill style={{ background: C.bg }}><style>{FONT_FACES}</style>
    <AbsoluteFill style={{ background: `radial-gradient(90% 80% at 50% 30%, ${C.desk} 0%, ${C.bg} 100%)` }} />
    <AbsoluteFill style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.025) 2px, transparent 2px)", backgroundSize: "90px 90px", backgroundPosition: `0 ${(f * 0.2) % 90}px` }} />
    {B ? <B s={scene} images={images} credits={credits} /> : null}</AbsoluteFill>);
}
export const COURT_COLORS = C;
