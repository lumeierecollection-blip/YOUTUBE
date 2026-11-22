// Rival Lines, serious cut: a dark tactics board. Formations drawn from the lineup, bars and counters for the counted events, an expected-goals step
// chart from the match's own xg_series. All numbers come from match-data.json (StatsBomb Open Data); the attribution is on every frame.
// RivalSeriousClips is the same film over match footage (`plates`: scene kind to a video URL). Footage is NOT in this repository: it is rights-holder
// material, supplied locally for a look test only.
import React from "react";
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, interpolate } from "remotion";
import { abs, clamp } from "../_shared/parts.jsx";
import { COND, MONO, ramp, Kicker, Head, Count, Rule, Chip, Shell, WideShell, baseComp, wideComp } from "../_shared/serious.jsx";
import { StatsBombAttribution } from "./attribution.jsx";

export const T = { bg: "#07100C", glow: "rgba(40,110,80,0.28)", line: "rgba(255,255,255,0.03)", ink: "#F2F5F3", dim: "#93A19A", accent: "#F2C94C", rule: "rgba(255,255,255,0.22)", onAccent: "#10140F", a: "#6EC1F2", b: "#FF5A4F" };
const POS = { "Goalkeeper": [0.5, 0.05], "Right Back": [0.88, 0.3], "Right Center Back": [0.65, 0.2], "Center Back": [0.5, 0.2], "Left Center Back": [0.35, 0.2], "Left Back": [0.12, 0.3], "Right Wing Back": [0.9, 0.42], "Left Wing Back": [0.1, 0.42],
  "Center Defensive Midfield": [0.5, 0.44], "Right Defensive Midfield": [0.66, 0.46], "Left Defensive Midfield": [0.34, 0.46], "Right Center Midfield": [0.72, 0.6], "Center Midfield": [0.5, 0.58], "Left Center Midfield": [0.28, 0.6],
  "Right Midfield": [0.88, 0.62], "Left Midfield": [0.12, 0.62], "Right Attacking Midfield": [0.7, 0.72], "Center Attacking Midfield": [0.5, 0.7], "Left Attacking Midfield": [0.3, 0.72], "Right Wing": [0.86, 0.8], "Left Wing": [0.14, 0.8],
  "Right Center Forward": [0.62, 0.92], "Center Forward": [0.5, 0.94], "Left Center Forward": [0.38, 0.92], "Secondary Striker": [0.5, 0.8] };
const PX = 90, PY = 250, PW = 900, PH = 1110;

function Pitch({ delay = 0, opacity = 1 }) {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 14), s = { fill: "none", stroke: "rgba(255,255,255,0.5)", strokeWidth: 4 };
  return (
    <svg style={abs(PX, PY, PW, PH, { opacity: a * opacity })} viewBox={`0 0 ${PW} ${PH}`}>
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={0} y={i * PH / 10} width={PW} height={PH / 10} fill={i % 2 ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.0)"} />)}
      <rect x={2} y={2} width={PW - 4} height={PH - 4} {...s} /><line x1={0} y1={PH / 2} x2={PW} y2={PH / 2} {...s} /><circle cx={PW / 2} cy={PH / 2} r={105} {...s} />
      {[0, 1].map((k) => <g key={k} transform={k ? `translate(0 ${PH}) scale(1 -1)` : undefined}><rect x={PW * 0.2} y={2} width={PW * 0.6} height={PH * 0.155} {...s} /><rect x={PW * 0.365} y={2} width={PW * 0.27} height={PH * 0.052} {...s} /></g>)}
    </svg>
  );
}
function Team({ players, color, top, delay = 0, ink = "#07100C" }) {
  const f = useCurrentFrame(), half = PH / 2;
  return players.map((p, i) => { const [u, v] = POS[p.position] || [0.5, 0.5], x = PX + (top ? 1 - u : u) * PW, y = top ? PY + v * half * 0.9 + 14 : PY + PH - v * half * 0.9 - 14, a = ramp(f, delay + i * 2, delay + i * 2 + 10); return (
    <div key={i} style={abs(x - 100, y - 30, 200, 100, { opacity: a, transform: `scale(${0.4 + 0.6 * a})`, textAlign: "center" })}>
      <div style={{ width: 58, height: 58, borderRadius: 29, background: color, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: COND, fontWeight: 700, fontSize: 30, color: ink, boxShadow: "0 6px 16px rgba(0,0,0,0.5)" }}>{p.number}</div>
      <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 24, color: T.ink, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.02em", textShadow: "0 2px 6px rgba(0,0,0,0.9)", whiteSpace: "nowrap" }}>{p.short}</div>
    </div>); });
}
const fmt = (s) => String(s).split("").join("-");
const Tag = ({ x, y, color, children, delay = 0, w = 300, align = "left" }) => { const f = useCurrentFrame(); return <div style={abs(x, y, w, 50, { fontFamily: COND, fontWeight: 700, fontSize: 44, color, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: align, opacity: ramp(f, delay, delay + 10) })}>{children}</div>; };

function Intro({ m, cues }) {
  const [A, B] = m.teams, c1 = cues[1] ?? 80, c2 = cues[2] ?? 160, f = useCurrentFrame();
  return (<>
    <Pitch opacity={0.22} />
    <Kicker t={T} y={190}>{m.stage} · {m.dateLabel}</Kicker>
    <Head t={T} y={250} size={150} lines={m.title} />
    <Rule t={T} y={c1 ? 730 : 730} delay={c1 - 6} color={T.accent} h={6} />
    <Tag x={70} y={770} color={T.a} delay={c1} w={400}>{A}</Tag><Tag x={610} y={770} color={T.b} delay={c1} w={400} align="right">{B}</Tag>
    <Count t={T} x={70} y={820} w={400} size={330} to={m.score[A]} delay={c1 + 2} len={14} color={T.a} />
    <Count t={T} x={610} y={820} w={400} size={330} to={m.score[B]} delay={c1 + 2} len={14} color={T.b} align="right" />
    <div style={abs(490, 960, 100, 14, { background: T.ink, opacity: ramp(f, c1 + 4, c1 + 12) })} />
    <Chip t={T} x={70} y={1220} delay={c2} size={54}>Penalties {m.pens[A]}–{m.pens[B]} · {m.pens[A] > m.pens[B] ? A : B}</Chip>
  </>);
}
function Formation({ m, at }) {
  const [A, B] = m.teams, d = at(new RegExp(`^${B}`), 60);
  return (<>
    <Kicker t={T} y={190}>Starting shapes</Kicker>
    <Pitch />
    <Team players={m.lineup[A]} color={T.a} delay={6} /><Team players={m.lineup[B]} color={T.b} top delay={d} ink="#fff" />
    <Chip t={T} x={90} y={1368} delay={10} size={32} color={T.a}>{A} {fmt(m.formation[A])}</Chip>
    <Chip t={T} x={90} y={270} delay={d + 4} size={36} color={T.b}>{B} {fmt(m.formation[B])}</Chip>
  </>);
}
function Bars({ m, vals, y, delay, max, h = 150, len = 24 }) {
  const f = useCurrentFrame(), [A, B] = m.teams;
  return [A, B].map((t, i) => { const c = i ? T.b : T.a, d = delay + i * 14, w = 940 * (vals[t] / max) * ramp(f, d, d + len); return (
    <div key={t}><Tag x={70} y={y + i * (h + 170)} color={c} delay={d} w={500}>{t}</Tag>
      <div style={abs(70, y + 62 + i * (h + 170), 940, h, { background: "rgba(255,255,255,0.06)" })} /><div style={abs(70, y + 62 + i * (h + 170), w, h, { background: c })} />
      <Count t={T} x={590} y={y - 44 + i * (h + 170)} w={420} size={104} to={vals[t]} delay={d} len={len} color={T.ink} align="right" /></div>); });
}
function Network({ m }) {
  return (<>
    <Pitch opacity={0.16} />
    <Kicker t={T} y={190}>First 40 minutes</Kicker>
    <Head t={T} y={250} size={128} lines={["Completed", "passes"]} />
    <Bars m={m} vals={m.passes} y={640} delay={36} max={Math.max(...Object.values(m.passes))} />
  </>);
}
function Shots({ m, at }) {
  const f = useCurrentFrame(), [A, B] = m.teams, dA = at(new RegExp(`^${A}`), 28), dB = at(new RegExp(`^${B}`), 100), c = at(/^first/i, dB + 40), X = (min) => 70 + 940 * (min / 80);
  return (<>
    <Pitch opacity={0.16} />
    <Kicker t={T} y={190}>Kick-off to minute 78</Kicker>
    <Head t={T} y={250} size={150} lines={["Shots"]} />
    {[A, B].map((t, i) => { const col = i ? T.b : T.a, d = i ? dB : dA, n = m.shots78[t]; return (
      <div key={t}><Tag x={70} y={480 + i * 280} color={col} delay={d} w={500}>{t}</Tag>
        {Array.from({ length: n }, (_, k) => <div key={k} style={abs(70 + k * 72, 546 + i * 280, 58, 58, { borderRadius: 29, background: col, transform: `scale(${ramp(f, d + 4 + k * 3, d + 12 + k * 3)})` })} />)}
        <Count t={T} x={810} y={470 + i * 280} w={200} size={170} to={n} delay={d} len={n * 3 + 8} color={T.ink} align="right" /></div>); })}
    <div style={{ opacity: ramp(f, c, c + 10) }}>
      <div style={abs(70, 1180, 940, 4, { background: T.rule })} />
      {[0, 20, 40, 60, 78].map((x) => <div key={x} style={abs(X(x) - 40, 1196, 80, 30, { fontFamily: MONO, fontSize: 20, color: T.dim, textAlign: "center" })}>{x}'</div>)}
      <div style={abs(70, 1168, (X(m.first[B]) - 70) * ramp(f, c + 4, c + 34, (x) => x), 28, { background: "rgba(255,90,79,0.25)" })} />
      <div style={abs(X(m.first[B]) - 5, 1130, 10, 104, { background: T.b, opacity: ramp(f, c + 32, c + 36) })} />
      <div style={abs(X(m.first[B]) - 600, 1060, 600, 60, { fontFamily: COND, fontWeight: 700, fontSize: 46, color: T.b, textAlign: "right", textTransform: "uppercase", opacity: ramp(f, c + 32, c + 40) })}>{B}'s first shot · {m.first[B]}'</div>
    </div>
  </>);
}
function Xg({ m, dur, at }) {
  const f = useCurrentFrame(), [A, B] = m.teams, c1 = at(/^Over/i, 62), W = 880, H = 620, x0 = 100, y0 = 1180, maxM = 125, maxX = 3;
  const sx = (mn) => (mn / maxM) * W, sy = (v) => -(v / maxX) * H, path = (s) => s.map(([mn, v], i) => `${i ? "L" : "M"}${sx(mn).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ");
  const mins = interpolate(f, [2, 22, Math.min(46, c1 - 4), c1, Math.max(c1 + 100, dur - 60)], [0, 78, 81, 81, maxM], clamp), val = (s, mn) => { let v = 0; for (const [a, b] of s) if (a <= mn) v = b; return v; };
  return (<>
    <Kicker t={T} y={190}>Expected goals, minute by minute</Kicker>
    <Head t={T} y={250} size={110} lines={f < c1 ? ["Two goals in", "two minutes"] : ["Nearly level", "on chances"]} />
    <svg style={abs(x0, y0 - H - 20, W + 40, H + 80)} viewBox={`0 ${-H - 20} ${W + 40} ${H + 80}`}>
      {[1, 2, 3].map((v) => <g key={v}><line x1={0} y1={sy(v)} x2={W} y2={sy(v)} stroke="rgba(255,255,255,0.12)" strokeWidth={2} /><text x={-12} y={sy(v) + 8} fill={T.dim} fontFamily="JetBrains Mono" fontSize={22} textAnchor="end">{v}</text></g>)}
      <line x1={0} y1={0} x2={W} y2={0} stroke="rgba(255,255,255,0.4)" strokeWidth={3} />
      {[0, 45, 90, 120].map((mn) => <text key={mn} x={sx(mn)} y={36} fill={T.dim} fontFamily="JetBrains Mono" fontSize={22} textAnchor="middle">{mn}'</text>)}
      <defs><clipPath id="xgclip"><rect x={-4} y={-H - 20} width={sx(mins) + 4} height={H + 40} /></clipPath></defs>
      <g clipPath="url(#xgclip)">
        {[[A, T.a], [B, T.b]].map(([t, c]) => <g key={t}><path d={path(m.xg[t])} fill="none" stroke={c} strokeWidth={8} strokeLinejoin="round" />
          {m.goals[t].map((g) => <circle key={g} cx={sx(g)} cy={sy(val(m.xg[t], g))} r={15} fill={T.bg} stroke={c} strokeWidth={7} />)}</g>)}
      </g>
      <line x1={sx(mins)} y1={0} x2={sx(mins)} y2={-H} stroke="rgba(255,255,255,0.35)" strokeWidth={2} strokeDasharray="6 8" />
    </svg>
    {[[A, T.a], [B, T.b]].map(([t, c], i) => <div key={t} style={abs(70 + i * 480, 1250, 460, 110, { display: "flex", alignItems: "baseline", gap: 16, borderTop: `8px solid ${c}`, paddingTop: 8 })}>
      <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 86, color: T.ink, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{val(m.xg[t], mins).toFixed(1)}</span>
      <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 34, color: c, textTransform: "uppercase" }}>{t} xG</span></div>)}
  </>);
}
function Close({ m, cues }) {
  const [A, B] = m.teams, c1 = cues[1] ?? 50;
  return (<>
    <Pitch opacity={0.18} />
    <Kicker t={T} y={190}>{m.score[A]}–{m.score[B]} · {m.stage}</Kicker>
    <Tag x={70} y={300} color={T.a}>{A}</Tag>
    <Head t={T} y={360} size={150} lines={["built", "the lead."]} />
    <Rule t={T} y={760} delay={c1 - 6} color={T.b} h={6} />
    <Tag x={70} y={800} color={T.b} delay={c1}>{B}</Tag>
    <Head t={T} y={860} size={150} lines={["built the", "comeback."]} delay={c1} />
  </>);
}
const BEATS = { intro: Intro, formation: Formation, network: Network, shots: Shots, xg: Xg, close: Close };
const withPlate = (B, src) => function Plated(p) { const f = useCurrentFrame(); return (<>
  <AbsoluteFill style={{ background: "#000" }}><OffthreadVideo src={src} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.8) contrast(1.05)", transform: `scale(${1.02 + 0.04 * f / p.dur})` }} /></AbsoluteFill>
  <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(4,10,8,0.86) 0%, rgba(4,10,8,0.62) 40%, rgba(4,10,8,0.72) 70%, rgba(4,10,8,0.94) 100%)" }} /><B {...p} /></>); };

export function RivalSerious({ durationInFrames, scenes, captions, m, logo, plates }) {
  const beats = plates ? Object.fromEntries(Object.entries(BEATS).map(([k, B]) => [k, plates[k] ? withPlate(B, plates[k]) : B])) : BEATS;
  return (<AbsoluteFill><Shell t={T} durationInFrames={durationInFrames} scenes={scenes} captions={captions} beats={beats} pass={{ m }} label={["Rival Lines", m.competition || ""]} />
    <StatsBombAttribution logo={logo} y={1640} /></AbsoluteFill>);
}
/** Long form. `plates` (scene kind to a video URL) puts match footage on the left; footage is rights-holder material and is never in this repository. */
export function RivalSeriousWide({ durationInFrames, scenes, captions, m, logo, plates }) {
  const side = (s) => (plates && plates[s.kind] ? <OffthreadVideo src={plates[s.kind]} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null);
  return (<AbsoluteFill><WideShell t={T} durationInFrames={durationInFrames} scenes={scenes} captions={captions} beats={BEATS} pass={{ m }} label={["Rival Lines", m.competition || ""]} side={side} />
    <StatsBombAttribution logo={logo} y={1004} /></AbsoluteFill>);
}
const dp = { durationInFrames: 1140, scenes: [], captions: [], logo: "", m: { teams: ["A", "B"], title: [], score: {}, pens: {}, formation: {}, lineup: { A: [], B: [] }, passes: {}, shots78: {}, first: {}, xg: { A: [], B: [] }, goals: { A: [], B: [] } } };
export const seriousCompositions = [{ id: "RivalSeriousWide", component: RivalSeriousWide, ...wideComp, durationInFrames: 1140, defaultProps: dp }, { id: "RivalSerious", component: RivalSerious, ...baseComp, durationInFrames: 1140, defaultProps: dp }];
