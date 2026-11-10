// Rival Lines match analysis (Format B): professional tactical broadcast graphics. The pitch is the environment. Every graphic is computed
// from StatsBomb Open Data event data (locations are where events were recorded, never continuous tracking) and credited to StatsBomb.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing, staticFile } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { StatsBombAttribution } from "./attribution.jsx";

const C = { navy: "#0A1628", navy2: "#10233F", panel: "#141B26", line: "rgba(255,255,255,0.14)", white: "#FFFFFF", dim: "#9AA7BA", arg: "#75AADB", fra: "#D7263D", gold: "#F5C518" };
const FACE = `@font-face{font-family:"Archivo Black";font-weight:400;src:url("${staticFile("fonts/ArchivoBlack-400.woff2")}") format("woff2");}`;
const HEAD = '"Archivo Black", "Inter", sans-serif', BODY = '"Inter", sans-serif';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const eo = Easing.out(Easing.cubic);
const tw = (f, a, b, e = eo) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
const abs = (x, y, w, h, extra) => ({ position: "absolute", left: x, top: y, width: w, height: h, ...extra });

const Bg = () => (<AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.navy} 0%, ${C.navy2} 100%)` }}>
  <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, opacity: 0.1 }}>
    <rect x="60" y="260" width="960" height="1300" fill="none" stroke="#fff" strokeWidth="3" /><line x1="60" y1="910" x2="1020" y2="910" stroke="#fff" strokeWidth="3" /><circle cx="540" cy="910" r="150" fill="none" stroke="#fff" strokeWidth="3" />
    <rect x="290" y="260" width="500" height="200" fill="none" stroke="#fff" strokeWidth="3" /><rect x="290" y="1360" width="500" height="200" fill="none" stroke="#fff" strokeWidth="3" />
  </svg>
</AbsoluteFill>);
const Scene = ({ dur, children }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ opacity: interpolate(f, [0, 5, dur - 5, dur], [0, 1, 1, 0], clamp) }}><Bg />{children}</AbsoluteFill>; };
const Head = ({ kicker, title }) => { const f = useCurrentFrame(), a = tw(f, 0, 12); return (<div style={abs(50, 70, 980, 150, { opacity: a, transform: `translateX(${(1 - a) * -60}px)` })}>
  <div style={{ display: "flex", alignItems: "center", gap: 14 }}><div style={{ width: 8, height: 38, background: C.gold }} /><div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 28, letterSpacing: "0.18em", color: C.gold, textTransform: "uppercase" }}>{kicker}</div></div>
  <div style={{ fontFamily: HEAD, fontSize: 64, color: C.white, marginTop: 8, lineHeight: 1, textTransform: "uppercase" }}>{title}</div></div>); };
const Panel = ({ src, x, y, w, h, color, label, big, delay = 0, from = "l" }) => { const f = useCurrentFrame(), a = tw(f, delay, delay + 14); const dx = (1 - a) * (from === "l" ? -700 : 700);
  return (<div style={abs(x, y, w, h, { opacity: a, transform: `translateX(${dx}px)` })}>
    <div style={{ width: "100%", height: "100%", borderRadius: 16, overflow: "hidden", boxShadow: "0 14px 30px rgba(0,0,0,0.45)", border: `3px solid ${color}` }}><img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></div>
    <div style={abs(-6, -26, 360, 56, { background: color, color: color === C.arg ? "#0A1628" : "#fff", fontFamily: HEAD, fontSize: 30, display: "flex", alignItems: "center", padding: "0 20px", letterSpacing: "0.02em", textTransform: "uppercase" })}>{label}</div>
    {big ? <div style={abs(w - 330, -26, 330, 56, { background: C.panel, color: C.white, fontFamily: HEAD, fontSize: 30, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", textTransform: "uppercase" })}>{big}</div> : null}
  </div>); };
const Note = ({ children, y, delay = 20 }) => { const a = tw(useCurrentFrame(), delay, delay + 12); return <div style={abs(50, y, 980, 60, { opacity: a, fontFamily: BODY, fontWeight: 500, fontSize: 24, lineHeight: 1.3, color: C.dim })}>{children}</div>; };

function Intro({ dur, data }) {
  const f = useCurrentFrame(), a = tw(f, 4, 20), b = tw(f, 10, 26), n = tw(f, 22, 36);
  const s = data.score, p = data.penalties;
  return (<Scene dur={dur}><Head kicker="FIFA World Cup 2022 · Final" title="Tactical breakdown" />
    <div style={abs(50, 400, 980, 330, { background: C.panel, borderRadius: 18, boxShadow: "0 18px 40px rgba(0,0,0,0.5)", overflow: "hidden", opacity: a, transform: `translateY(${(1 - a) * 80}px)` })}>
      <div style={abs(0, 0, 14, 330, { background: C.arg })} /><div style={abs(966, 0, 14, 330, { background: C.fra })} />
      <div style={abs(40, 60, 380, 80, { fontFamily: HEAD, fontSize: 56, color: C.arg, textTransform: "uppercase" })}>Argentina</div>
      <div style={abs(560, 60, 380, 80, { fontFamily: HEAD, fontSize: 56, color: C.fra, textAlign: "right", textTransform: "uppercase" })}>France</div>
      <div style={abs(0, 120, 980, 200, { display: "flex", alignItems: "center", justifyContent: "center", gap: 50, fontFamily: HEAD, fontSize: 210, color: C.white, lineHeight: 1 })}><span>{s.Argentina}</span><span style={{ fontSize: 110, color: C.dim }}>–</span><span>{s.France}</span></div>
    </div>
    <div style={abs(250, 760, 580, 84, { background: C.gold, color: "#0A1628", fontFamily: HEAD, fontSize: 42, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 42, opacity: b, transform: `scale(${0.7 + 0.3 * b})` })}>{p.Argentina}–{p.France} on penalties</div>
    <div style={abs(50, 960, 980, 330, { opacity: n, transform: `translateY(${(1 - n) * 40}px)`, background: "rgba(255,255,255,0.06)", borderLeft: `8px solid ${C.gold}`, borderRadius: 8, padding: "34px 40px", boxSizing: "border-box" })}>
      <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 26, letterSpacing: "0.16em", color: C.gold }}>THE QUESTION</div>
      <div style={{ fontFamily: HEAD, fontSize: 62, color: C.white, lineHeight: 1.05, marginTop: 14, textTransform: "uppercase" }}>How did a controlled final end 3–3?</div></div>
    <div style={abs(50, 1340, 980, 300, { display: "flex", flexWrap: "wrap", gap: 18, opacity: tw(f, 34, 50) })}>
      {["Starting formations", "Passing networks", "Shot map", "Expected goals"].map((t, i) => <div key={t} style={{ background: C.panel, borderLeft: `8px solid ${i % 2 ? C.fra : C.arg}`, borderRadius: 8, padding: "18px 26px", fontFamily: BODY, fontWeight: 800, fontSize: 30, letterSpacing: "0.08em", color: C.white, textTransform: "uppercase" }}>{t}</div>)}
      <div style={{ width: "100%", fontFamily: BODY, fontWeight: 500, fontSize: 24, color: C.dim, marginTop: 6 }}>All graphics are computed from StatsBomb event data, not tracking data.</div>
    </div>
  </Scene>);
}
function Formation({ dur, images, data }) {
  return (<Scene dur={dur}><Head kicker="Starting formations" title="Two shapes" />
    <Panel src={images.formArg} x={60} y={330} w={960} h={600} color={C.arg} label={`Argentina ${data.formation.Argentina.split("").join("-")}`} delay={4} />
    <Panel src={images.formFra} x={60} y={1010} w={960} h={600} color={C.fra} label={`France ${data.formation.France.split("").join("-")}`} delay={14} from="r" />
  </Scene>);
}
function Network({ dur, images, data }) {
  const f = useCurrentFrame(), c = (t) => Math.round(data.stats[t].first_40_completed_passes * tw(f, 16, 40));
  return (<Scene dur={dur}><Head kicker="First 40 minutes · before any substitution" title="Passing networks" />
    <Panel src={images.netArg} x={60} y={330} w={960} h={600} color={C.arg} label="Argentina" big={`${c("Argentina")} completed`} delay={4} />
    <Panel src={images.netFra} x={60} y={1010} w={960} h={600} color={C.fra} label="France" big={`${c("France")} completed`} delay={14} from="r" />
    <Note y={1640}>Dots sit at the average start of each player's completed passes. Lines are pairs with 3 or more passes between them.</Note>
  </Scene>);
}
function Shots({ dur, images, data }) {
  const f = useCurrentFrame(), a = data.stats.Argentina, r = data.stats.France, k = (v) => Math.round(v * tw(f, 14, 40));
  return (<Scene dur={dur}><Head kicker="Up to the 78th minute" title="Shot map" />
    <Panel src={images.shotmap} x={60} y={330} w={960} h={640} color={C.gold} label="Size = xG" delay={4} />
    <div style={abs(60, 1020, 960, 150, { display: "flex", gap: 24 })}>
      {[["Argentina", C.arg, k(a.shots_before_79), "#0A1628"], ["France", C.fra, k(r.shots_before_79), "#fff"]].map(([n, col, v, tc]) => (<div key={n} style={{ flex: 1, background: C.panel, borderTop: `10px solid ${col}`, borderRadius: 12, padding: "14px 24px", boxSizing: "border-box" }}><div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 24, letterSpacing: "0.14em", color: col, textTransform: "uppercase" }}>{n}</div><div style={{ fontFamily: HEAD, fontSize: 80, color: C.white, lineHeight: 1 }}>{v} <span style={{ fontSize: 30, color: C.dim }}>shots</span></div></div>))}
    </div>
    <div style={abs(60, 1200, 960, 140, { background: "rgba(245,197,24,0.12)", border: `2px solid ${C.gold}`, borderRadius: 12, padding: "20px 28px", boxSizing: "border-box", fontFamily: BODY, fontWeight: 700, fontSize: 34, color: C.white, lineHeight: 1.25, opacity: tw(f, 30, 44) })}>France's first shot: minute {r.first_shot_minute}.<br /><span style={{ color: C.dim, fontWeight: 500, fontSize: 26 }}>Stars are goals. France is drawn attacking the left goal.</span></div>
    <Note y={1400}>Penalty shootout excluded. Shot locations are where StatsBomb recorded each shot.</Note>
  </Scene>);
}
const yAt = (series, m) => { let y = 0; for (const [mm, v] of series) if (mm <= m) y = v; return y; };
function XgChart({ dur, data }) {
  const f = useCurrentFrame(), W = 900, H = 640, X = (m) => (m / 122) * W, Y = (v) => H - (v / 3) * H, p = tw(f, 8, Math.min(dur - 20, 70), Easing.inOut(Easing.cubic));
  const line = (t, col) => { const s = data.stats[t].xg_series; return <polyline points={s.map(([m, v]) => `${X(m).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")} fill="none" stroke={col} strokeWidth="9" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} />; };
  const goals = (t, col) => data.stats[t].goal_minutes.map((m, i) => { const shown = X(m) / W <= p + 0.001; return shown ? <g key={`${t}${i}`}><circle cx={X(m)} cy={Y(yAt(data.stats[t].xg_series, m))} r="17" fill={col} stroke="#fff" strokeWidth="4" /><text x={X(m)} y={Y(yAt(data.stats[t].xg_series, m)) + (t === "France" ? (i % 2 ? 52 : -28) : -28)} textAnchor="middle" fontFamily={BODY} fontWeight="800" fontSize="26" fill="#fff">{m}'</text></g> : null; });
  return (<Scene dur={dur}><Head kicker="Cumulative expected goals" title="The match in one line" />
    <div style={abs(60, 330, 960, 760, { background: C.panel, borderRadius: 16, boxShadow: "0 14px 30px rgba(0,0,0,0.45)" })}>
      <svg width="960" height="760" style={{ position: "absolute", left: 0, top: 0 }}><g transform="translate(40,50)">
        {[0, 1, 2, 3].map((v) => <g key={v}><line x1="0" x2={W} y1={Y(v)} y2={Y(v)} stroke={C.line} strokeWidth="2" /><text x="-8" y={Y(v) + 8} textAnchor="end" fontFamily={BODY} fontWeight="700" fontSize="22" fill={C.dim} style={{ display: "none" }}>{v}</text></g>)}
        {[0, 45, 90, 120].map((m) => <g key={m}><line x1={X(m)} x2={X(m)} y1={0} y2={H} stroke={C.line} strokeWidth="2" /><text x={X(m)} y={H + 40} textAnchor="middle" fontFamily={BODY} fontWeight="800" fontSize="26" fill={C.dim}>{m}'</text></g>)}
        <rect x={X(79)} y={0} width={X(122) - X(79)} height={H} fill="rgba(215,38,61,0.10)" />
        {line("Argentina", C.arg)}{line("France", C.fra)}{goals("Argentina", C.arg)}{goals("France", C.fra)}
      </g></svg>
      <div style={abs(60, 20, 400, 40, { fontFamily: BODY, fontWeight: 800, fontSize: 24, color: C.dim, letterSpacing: "0.1em" })}>xG 0 – 3</div>
    </div>
    <div style={abs(60, 1130, 960, 120, { display: "flex", gap: 24 })}>
      {[["Argentina", C.arg, data.stats.Argentina.xg], ["France", C.fra, data.stats.France.xg]].map(([n, col, v]) => (<div key={n} style={{ flex: 1, background: C.panel, borderLeft: `10px solid ${col}`, borderRadius: 10, padding: "12px 22px", boxSizing: "border-box" }}><span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 24, color: col, textTransform: "uppercase", letterSpacing: "0.1em" }}>{n}</span><div style={{ fontFamily: HEAD, fontSize: 62, color: C.white, lineHeight: 1.05 }}>{(v * tw(f, 20, 70)).toFixed(2)} <span style={{ fontSize: 24, color: C.dim }}>xG</span></div></div>))}
    </div>
    <Note y={1290}>Shaded: from France's first goal (79'). Regulation and extra time; penalty shootout excluded. Goals: dots.</Note>
  </Scene>);
}
function Close({ dur, data }) {
  const f = useCurrentFrame(), A = data.stats.Argentina, R = data.stats.France;
  const rows = [["Shots", A.shots, R.shots], ["Expected goals", A.xg, R.xg], ["Completed passes, first 40'", A.first_40_completed_passes, R.first_40_completed_passes]];
  return (<Scene dur={dur}><Head kicker="The analysis" title="Two halves of a final" />
    <div style={abs(60, 330, 960, 560, {})}>{rows.map(([name, a, r], i) => { const t = tw(f, 6 + i * 8, 26 + i * 8), tot = a + r; return (<div key={name} style={{ marginBottom: 34, opacity: t }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: HEAD, fontSize: 44, color: C.white }}><span style={{ color: C.arg }}>{a}</span><span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 26, letterSpacing: "0.12em", color: C.dim, textTransform: "uppercase", alignSelf: "center" }}>{name}</span><span style={{ color: C.fra }}>{r}</span></div>
      <div style={{ display: "flex", height: 26, borderRadius: 13, overflow: "hidden", marginTop: 8 }}><div style={{ width: `${(a / tot) * 100 * t}%`, background: C.arg }} /><div style={{ flex: 1 }} /><div style={{ width: `${(r / tot) * 100 * t}%`, background: C.fra }} /></div></div>); })}</div>
    <div style={abs(60, 940, 960, 520, { background: C.panel, borderRadius: 16, borderTop: `10px solid ${C.gold}`, padding: "44px 48px", boxSizing: "border-box", opacity: tw(f, 30, 46), transform: `translateY(${(1 - tw(f, 30, 46)) * 40}px)` })}>
      <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 26, letterSpacing: "0.16em", color: C.gold }}>THE THESIS</div>
      <div style={{ fontFamily: HEAD, fontSize: 70, lineHeight: 1.05, color: C.white, marginTop: 18, textTransform: "uppercase" }}><span style={{ color: C.arg }}>Argentina built the lead.</span><br /><span style={{ color: C.fra }}>France built the comeback.</span></div></div>
    <Note y={1490}>Shots and expected goals: regulation and extra time, shootout excluded.</Note>
  </Scene>);
}
const KINDS = { intro: Intro, formation: Formation, network: Network, shots: Shots, xg: XgChart, close: Close };

function Cap({ captions }) {
  const f = useCurrentFrame(), c = captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  const words = c.words || [{ text: c.text, from: c.from }];
  return <div style={abs(40, 1716, 1000, 120, { zIndex: 1000, background: "rgba(10,22,40,0.92)", borderLeft: `10px solid ${C.gold}`, borderRadius: 6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0 12px", padding: "0 28px", boxSizing: "border-box", fontFamily: BODY, fontWeight: 800, fontSize: 48, lineHeight: 1.1 })}>
    {words.map((w, i, arr) => { const on = f >= w.from && (i === arr.length - 1 || f < arr[i + 1].from); return <span key={i} style={{ color: on ? C.gold : C.white, opacity: f >= w.from ? 1 : 0.4 }}>{w.text}</span>; })}
  </div>;
}
export function RivalMatchShort({ durationInFrames, scenes, captions, images, data }) {
  const f = useCurrentFrame();
  return (<AbsoluteFill style={{ background: C.navy }}><style>{FONT_FACES + FACE}</style>
    {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} data={data} /></Sequence>; })}
    <Cap captions={captions} />
    <StatsBombAttribution logo={images.sbLogo} y={1860} dark />
    <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: C.gold })} />
  </AbsoluteFill>);
}
