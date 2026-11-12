// Rival Lines long form (1920x1080): dark tactics board in the grammar of Football Made Simple (one idea per board, data on screen). Every figure arrives
// from StatsBomb Open Data (credited); line-ups are drawn from the recorded starting positions. Arrows are only drawn where a recorded movement
// supports them (a pass, a shot, a substitution); a formation comparison is labelled as the recorded starting shape, not as live movement.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, ramp, W, H } from "./kit.jsx";

const C = { bg: "#070D0A", glow: "rgba(40,110,80,0.30)", line: "rgba(255,255,255,0.55)", ink: "#F2F5F3", dim: "#93A19A", a: "#6EC1F2", b: "#FF5A4F", gold: "#F2C94C", rule: "rgba(255,255,255,0.18)" };
const COND = '"Roboto Condensed", "Arial Narrow", sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace', SANS = '"Inter", sans-serif';
const POS = { "Goalkeeper": [0.5, 0.05], "Right Back": [0.88, 0.3], "Right Center Back": [0.65, 0.2], "Center Back": [0.5, 0.2], "Left Center Back": [0.35, 0.2], "Left Back": [0.12, 0.3], "Right Wing Back": [0.9, 0.42], "Left Wing Back": [0.1, 0.42], "Center Defensive Midfield": [0.5, 0.44], "Right Defensive Midfield": [0.66, 0.46], "Left Defensive Midfield": [0.34, 0.46], "Right Center Midfield": [0.72, 0.6], "Center Midfield": [0.5, 0.58], "Left Center Midfield": [0.28, 0.6], "Right Midfield": [0.88, 0.62], "Left Midfield": [0.12, 0.62], "Right Attacking Midfield": [0.7, 0.72], "Center Attacking Midfield": [0.5, 0.7], "Left Attacking Midfield": [0.3, 0.72], "Right Wing": [0.86, 0.8], "Left Wing": [0.14, 0.8], "Right Center Forward": [0.62, 0.92], "Center Forward": [0.5, 0.94], "Left Center Forward": [0.38, 0.92], "Secondary Striker": [0.5, 0.8] };
// Pitch drawn landscape on the left 1100 px: goal to goal along x.
const PX = 90, PY = 150, PW = 1100, PH = 760;
const Kick = ({ children }) => { const f = useCurrentFrame(); return <div style={abs(90, 56, 1700, 40, { fontFamily: MONO, fontSize: 24, letterSpacing: "0.18em", textTransform: "uppercase", color: C.dim, opacity: ramp(f, 0, 10) })}><span style={{ color: C.gold }}>■ </span>{children}</div>; };
function Pitch({ dim = 1 }) {
  const s = { fill: "none", stroke: C.line, strokeWidth: 3 };
  return (<svg style={abs(PX, PY, PW, PH, { opacity: dim })} viewBox={`0 0 ${PW} ${PH}`}>
    {Array.from({ length: 10 }, (_, i) => <rect key={i} x={i * PW / 10} y={0} width={PW / 10} height={PH} fill={i % 2 ? "rgba(255,255,255,0.03)" : "none"} />)}
    <rect x={2} y={2} width={PW - 4} height={PH - 4} {...s} /><line x1={PW / 2} y1={0} x2={PW / 2} y2={PH} {...s} /><circle cx={PW / 2} cy={PH / 2} r={80} {...s} />
    {[0, 1].map((k) => <g key={k} transform={k ? `translate(${PW} 0) scale(-1 1)` : undefined}><rect x={2} y={PH * 0.2} width={PW * 0.155} height={PH * 0.6} {...s} /><rect x={2} y={PH * 0.37} width={PW * 0.055} height={PH * 0.26} {...s} /></g>)}
  </svg>);
}
// StatsBomb position -> pitch pixels (own team attacking left to right).
const place = (pos, mirror) => { const [u, v] = POS[pos] || [0.5, 0.5]; const x = (mirror ? 1 - v : v) * (PW / 2 - 40) + (mirror ? PW / 2 + 40 : 40), y = (0.08 + 0.84 * (mirror ? 1 - u : u)) * PH; return [PX + x, PY + y]; };
function Players({ players, color, mirror, delay = 0, ink = "#07100C", labels = true }) {
  const f = useCurrentFrame();
  return players.map((p, i) => { const [x, y] = place(p.position, mirror), a = ramp(f, delay + i * 2, delay + 10 + i * 2); return (<div key={i} style={abs(x - 90, y - 34, 180, 100, { opacity: a, transform: `scale(${0.4 + 0.6 * a})`, textAlign: "center" })}>
    <div style={{ width: 54, height: 54, borderRadius: 27, background: color, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: COND, fontWeight: 700, fontSize: 28, color: ink, boxShadow: "0 6px 16px rgba(0,0,0,0.5)" }}>{p.number}</div>
    {labels && <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 22, color: C.ink, marginTop: 2, textTransform: "uppercase", textShadow: "0 2px 6px #000" }}>{p.short}</div>}</div>); });
}
const Side = ({ children, delay = 0 }) => { const f = useCurrentFrame(); return <div style={abs(1260, 150, 560, 760, { opacity: ramp(f, delay, delay + 12), display: "flex", flexDirection: "column", gap: 22 })}>{children}</div>; };
const Big = ({ n, label, color }) => (<div style={{ borderLeft: `8px solid ${color}`, paddingLeft: 22 }}><div style={{ fontFamily: COND, fontWeight: 700, fontSize: 110, lineHeight: 1, color: C.ink }}>{n}</div><div style={{ fontFamily: COND, fontWeight: 700, fontSize: 34, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div></div>);

/** Both starting shapes on one pitch, from the recorded line-ups. */
function FormationScene({ s }) {
  const [A, B] = s.m.teams;
  return (<><Kick>{s.kicker}</Kick><Pitch /><Players players={s.m.lineup[A]} color={C.a} delay={6} /><Players players={s.m.lineup[B]} color={C.b} mirror ink="#fff" delay={22} />
    <Side delay={8}><Big n={s.m.formation[A].split("").join("-")} label={A} color={C.a} /><Big n={s.m.formation[B].split("").join("-")} label={B} color={C.b} /><div style={{ fontFamily: MONO, fontSize: 20, color: C.dim, lineHeight: 1.4 }}>Recorded starting positions, StatsBomb Open Data. Shapes shown at kick-off, not in play.</div></Side></>);
}
/** One number per team, drawn from zero on one scale. s.items: [{ label, a, b }] */
function StatsScene({ s }) {
  const f = useCurrentFrame(), [A, B] = s.m.teams;
  return (<><Kick>{s.kicker}</Kick>
    <div style={abs(90, 120, 1740, 100, { fontFamily: COND, fontWeight: 700, fontSize: 92, color: C.ink, opacity: ramp(f, 0, 10) })}>{s.title}</div>
    {s.items.map((it, i) => { const y = 270 + i * 190, max = Math.max(it.a, it.b), k = ramp(f, 8 + i * 10, 38 + i * 10); return (<div key={i}>
      <div style={abs(90, y, 520, 60, { fontFamily: MONO, fontSize: 28, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim })}>{it.label}</div>
      <div style={abs(90, y + 56, (1500 * it.a) / max * k, 52, { background: C.a })} /><div style={abs(100 + (1500 * it.a) / max * k, y + 46, 260, 70, { fontFamily: COND, fontWeight: 700, fontSize: 60, color: C.ink })}>{it.fa ?? it.a}</div>
      <div style={abs(90, y + 112, (1500 * it.b) / max * k, 52, { background: C.b })} /><div style={abs(100 + (1500 * it.b) / max * k, y + 102, 260, 70, { fontFamily: COND, fontWeight: 700, fontSize: 60, color: C.ink })}>{it.fb ?? it.b}</div></div>); })}
    <div style={abs(90, 1000, 1740, 40, { display: "flex", gap: 40, fontFamily: COND, fontWeight: 700, fontSize: 30, color: C.ink })}><span style={{ color: C.a }}>■ {A}</span><span style={{ color: C.b }}>■ {B}</span></div></>);
}
/** Cumulative expected goals through the match, goals marked. Real xg_series and goal minutes. */
function XgScene({ s }) {
  const f = useCurrentFrame(), [A, B] = s.m.teams, Wd = 1500, Ht = 560, x0 = 200, y0 = 880, maxM = 125, maxX = Math.ceil(Math.max(...s.m.xg[A].map((p) => p[1]), ...s.m.xg[B].map((p) => p[1]))) + 0.5;
  const sx = (m) => (m / maxM) * Wd, sy = (v) => -(v / maxX) * Ht, prog = ramp(f, 6, 90, (x) => x), mins = prog * maxM;
  const path = (ser) => { const pts = ser.filter(([m]) => m <= mins); if (!pts.length) return ""; const last = pts[pts.length - 1]; return pts.map(([m, v], i) => `${i ? "L" : "M"}${sx(m).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ") + ` L${sx(mins).toFixed(1)} ${sy(last[1]).toFixed(1)}`; };
  const val = (ser, m) => { let v = 0; for (const [a, b] of ser) if (a <= m) v = b; return v; };
  return (<><Kick>{s.kicker}</Kick>
    <div style={abs(90, 120, 1740, 100, { fontFamily: COND, fontWeight: 700, fontSize: 92, color: C.ink })}>{s.title}</div>
    <svg style={abs(x0, 0, Wd + 60, H, {})} viewBox={`0 0 ${Wd + 60} ${H}`}><g transform={`translate(0 ${y0})`}>
      {Array.from({ length: Math.floor(maxX) }, (_, i) => i + 1).map((v) => <g key={v}><line x1={0} y1={sy(v)} x2={Wd} y2={sy(v)} stroke={C.rule} strokeWidth="2" /><text x={-14} y={sy(v) + 8} textAnchor="end" fontFamily={MONO} fontSize="22" fill={C.dim}>{v}</text></g>)}
      <line x1={0} y1={0} x2={Wd} y2={0} stroke={C.line} strokeWidth="3" />{[0, 45, 90, 120].map((m) => <text key={m} x={sx(m)} y={38} textAnchor="middle" fontFamily={MONO} fontSize="22" fill={C.dim}>{m}'</text>)}
      <path d={path(s.m.xg[A])} fill="none" stroke={C.a} strokeWidth="8" strokeLinejoin="round" /><path d={path(s.m.xg[B])} fill="none" stroke={C.b} strokeWidth="8" strokeLinejoin="round" />
      {[[A, C.a], [B, C.b]].map(([t, c]) => s.m.goals[t].filter((g) => g <= mins).map((g) => <circle key={t + g} cx={sx(g)} cy={sy(val(s.m.xg[t], g))} r="15" fill={C.bg} stroke={c} strokeWidth="7" />))}
    </g></svg>
    <div style={abs(200, 940, 1500, 100, { display: "flex", gap: 60 })}>{[[A, C.a], [B, C.b]].map(([t, c]) => <div key={t} style={{ borderTop: `8px solid ${c}`, paddingTop: 6, fontFamily: COND, fontWeight: 700, fontSize: 52, color: C.ink }}>{val(s.m.xg[t], mins).toFixed(1)} <span style={{ fontSize: 30, color: c }}>{t.toUpperCase()} xG</span></div>)}</div></>);
}
/** The match on a line: goals by minute for both teams. Real goal minutes. */
function TimelineScene({ s }) {
  const f = useCurrentFrame(), [A, B] = s.m.teams, x0 = 160, Wd = 1600, sx = (m) => x0 + (m / 125) * Wd, k = ramp(f, 4, 50);
  const ev = [...s.m.goals[A].map((m) => [m, A, C.a]), ...s.m.goals[B].map((m) => [m, B, C.b])].sort((p, q) => p[0] - q[0]);
  return (<><Kick>{s.kicker}</Kick>
    <div style={abs(90, 120, 1740, 100, { fontFamily: COND, fontWeight: 700, fontSize: 92, color: C.ink })}>{s.title}</div>
    <div style={abs(x0, 560, Wd * k, 6, { background: C.line })} />
    {[0, 45, 90, 120].map((m) => <div key={m} style={abs(sx(m) - 40, 580, 80, 36, { fontFamily: MONO, fontSize: 22, color: C.dim, textAlign: "center" })}>{m}'</div>)}
    {ev.map(([m, t, c], i) => { const a = ramp(f, 14 + i * 9, 26 + i * 9), up = t === A; return (<div key={i} style={{ opacity: a }}>
      <div style={abs(sx(m) - 14, 549, 30, 30, { borderRadius: 15, background: c, border: `4px solid ${C.bg}` })} />
      <div style={abs(sx(m) - 90, up ? 430 : 640, 180, 100, { textAlign: "center", fontFamily: COND, fontWeight: 700, fontSize: 64, color: C.ink })}>{m}'</div>
      <div style={abs(sx(m) - 120, up ? 400 : 720, 240, 40, { textAlign: "center", fontFamily: COND, fontWeight: 700, fontSize: 28, color: c, textTransform: "uppercase" })}>{t}</div></div>); })}</>);
}
/** Rivalry head-to-head: two columns of one record each. s.cols: [{ name, color, rows: [{ k, v }] }]; every value is sourced in s.source. */
function HeadToHeadScene({ s }) {
  const f = useCurrentFrame();
  return (<><Kick>{s.kicker}</Kick>
    <div style={abs(90, 120, 1740, 100, { fontFamily: COND, fontWeight: 700, fontSize: 92, color: C.ink })}>{s.title}</div>
    {s.cols.map((c, ci) => <div key={ci} style={abs(110 + ci * 880, 260, 800, 700, { opacity: ramp(f, 6 + ci * 10, 20 + ci * 10), borderTop: `10px solid ${c.color}`, paddingTop: 20 })}>
      <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 84, color: c.color, textTransform: "uppercase" }}>{c.name}</div>
      {c.rows.map((r, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", borderBottom: `2px solid ${C.rule}`, padding: "18px 0", opacity: ramp(f, 16 + i * 8, 28 + i * 8) }}><span style={{ fontFamily: SANS, fontSize: 34, color: C.dim }}>{r.k}</span><span style={{ fontFamily: COND, fontWeight: 700, fontSize: 56, color: C.ink }}>{r.v}</span></div>)}</div>)}
    <div style={abs(90, 1000, 1740, 40, { fontFamily: MONO, fontSize: 20, color: C.dim })}>{s.source}</div></>);
}
const KINDS = { formation: FormationScene, stats: StatsScene, xg: XgScene, timeline: TimelineScene, h2h: HeadToHeadScene };
export function RivalSceneOnly({ scene, m, logo }) {
  const B = KINDS[scene.kind];
  return (<AbsoluteFill style={{ background: C.bg }}><style>{FONT_FACES}</style>
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 20%, ${C.glow} 0%, rgba(0,0,0,0) 62%)` }} />
    {B ? <B s={{ ...scene, m }} /> : null}
    <div style={abs(40, 1004, 560, 54, { background: "rgba(255,255,255,0.96)", borderRadius: 27, display: "flex", alignItems: "center", gap: 14, padding: "0 20px 0 10px", boxSizing: "border-box", fontFamily: SANS, fontWeight: 700, fontSize: 22, color: "#0B1220" })}>{logo && <img src={logo} style={{ height: 38 }} />}<span>Event data: StatsBomb Open Data</span></div>
  </AbsoluteFill>);
}
export const RIVAL_COLORS = C;
