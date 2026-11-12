// AI Tested long form (1920x1080), white motion-graphics base (approved default). The reference (AI Search) is almost all screen capture of the real
// tool, so the main scene is a real browser capture in a real window frame with a cursor and a zoom into the part that matters. Charts are drawn from
// the run's own counted data. Nothing here invents a result: every figure arrives in the scene record.
import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, ramp, W, H } from "./kit.jsx";

const C = { bg: "#FFFFFF", ink: "#0F172A", dim: "#64748B", line: "#E2E8F0", blue: "#1D4ED8", red: "#DC2626", ok: "#16A34A", soft: "#F1F5F9" };
const SANS = '"Inter", sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace', COND = '"Roboto Condensed", "Arial Narrow", sans-serif';

const Head = ({ kicker, children, delay = 0 }) => { const f = useCurrentFrame(); return (<div style={abs(120, 70, 1680, 150, { opacity: ramp(f, delay, delay + 12) })}>
  {kicker && <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase", color: C.blue }}>{kicker}</div>}
  <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 64, lineHeight: 1.08, color: C.ink, marginTop: 8 }}>{children}</div></div>); };

/** A real capture in a browser window. shot = data URI; zoom = { x, y, scale } in image fractions: the camera pushes in on the part that matters. */
function BrowserScene({ s, images }) {
  const f = useCurrentFrame(), z = s.zoom || { x: 0.5, y: 0.5, scale: 1.5 }, k = interpolate(f, [20, 110], [1, z.scale], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const cx = interpolate(f, [10, 90], [0.15, z.x], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), cy = interpolate(f, [10, 90], [0.9, z.y], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (<>
    <Head kicker={s.kicker} delay={0}>{s.title}</Head>
    <div style={abs(120, 240, 1680, 770, { background: C.bg, border: `2px solid ${C.line}`, borderRadius: 14, boxShadow: "0 30px 80px rgba(15,23,42,0.18)", overflow: "hidden", opacity: ramp(f, 4, 18) })}>
      <div style={{ height: 52, background: C.soft, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 10, padding: "0 18px" }}>
        {["#F87171", "#FBBF24", "#34D399"].map((c) => <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />)}
        <div style={{ marginLeft: 24, flex: 1, height: 32, borderRadius: 16, background: "#fff", border: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 18, color: C.dim, lineHeight: "32px", padding: "0 16px" }}>{s.url}</div></div>
      <div style={{ position: "relative", width: "100%", height: 716, overflow: "hidden", background: "#fff" }}>
        <Img src={images[s.image]} style={{ position: "absolute", left: 0, top: 0, width: "100%", transformOrigin: `${cx * 100}% ${cy * 100}%`, transform: `scale(${k})` }} />
        <div style={abs(`${cx * 100 - 1}%`, `${cy * 100 - 1}%`, 26, 26, { borderRadius: 13, background: "rgba(220,38,38,0.85)", boxShadow: "0 0 0 10px rgba(220,38,38,0.2)", opacity: ramp(f, 8, 16) })} />
      </div></div>
    <div style={abs(120, 1020, 1680, 40, { fontFamily: MONO, fontSize: 20, color: C.dim })}>{s.source}</div>
  </>);
}
/** Real command output typed out line by line, in a plain terminal frame. s.lines are the real lines. */
function TerminalScene({ s }) {
  const f = useCurrentFrame(), chars = Math.floor(ramp(f, 6, 6 + s.lines.join("\n").length * 0.5, (x) => x) * s.lines.join("\n").length);
  let left = chars; const shown = s.lines.map((l) => { const t = l.slice(0, Math.max(0, left)); left -= l.length + 1; return t; });
  return (<>
    <Head kicker={s.kicker}>{s.title}</Head>
    <div style={abs(120, 250, 1680, 740, { background: "#0B1220", borderRadius: 14, boxShadow: "0 30px 80px rgba(15,23,42,0.25)", padding: "34px 44px", boxSizing: "border-box", overflow: "hidden" })}>
      {shown.map((l, i) => <div key={i} style={{ fontFamily: MONO, fontSize: 30, lineHeight: 1.5, color: /^\$/.test(s.lines[i]) ? "#7DD3FC" : /fail|error|made up/i.test(s.lines[i]) ? "#FCA5A5" : "#E2E8F0", whiteSpace: "pre" }}>{l}{i === shown.findIndex((x, j) => x.length < s.lines[j].length) || (i === shown.length - 1 && l.length === s.lines[i].length && f % 20 < 10) ? <span style={{ background: "#7DD3FC", color: "#7DD3FC" }}>_</span> : null}</div>)}
    </div>
  </>);
}
/** Benchmark bars from one scale starting at zero. s.items: [{ label, value, display, hot? }]. */
function BenchScene({ s }) {
  const f = useCurrentFrame(), max = s.max ?? Math.max(...s.items.map((i) => i.value));
  return (<>
    <Head kicker={s.kicker}>{s.title}</Head>
    {s.items.map((it, i) => { const y = 280 + i * 150, w = (1050 * it.value) / max * ramp(f, 8 + i * 8, 40 + i * 8); return (<div key={i}>
      <div style={abs(120, y, 520, 100, { fontFamily: SANS, fontWeight: 700, fontSize: 36, lineHeight: "100px", color: C.ink })}>{it.label}</div>
      <div style={abs(660, y + 14, 1050, 72, { background: C.soft, borderRadius: 8 })} />
      <div style={abs(660, y + 14, Math.max(4, w), 72, { background: it.hot ? C.red : C.blue, borderRadius: 8 })} />
      <div style={abs(660 + Math.max(4, w) + 18, y, 300, 100, { fontFamily: COND, fontWeight: 700, fontSize: 64, lineHeight: "100px", color: it.hot ? C.red : C.ink, opacity: ramp(f, 24 + i * 8, 36 + i * 8) })}>{it.display}</div></div>); })}
    {s.footer && <div style={abs(120, 990, 1680, 50, { fontFamily: MONO, fontSize: 22, color: C.dim })}>{s.footer}</div>}
  </>);
}
/** Side-by-side results, each cell a counted outcome. s.rows: [{ label, cells: [{ text, hot? }] }], s.cols: [model names] */
function CompareScene({ s }) {
  const f = useCurrentFrame(), colW = Math.floor(1100 / s.cols.length);
  return (<>
    <Head kicker={s.kicker}>{s.title}</Head>
    <div style={abs(120, 270, 1680, 70, {})}>{s.cols.map((c, i) => <div key={i} style={abs(520 + i * colW, 0, colW, 70, { fontFamily: SANS, fontWeight: 800, fontSize: 34, color: C.blue, textAlign: "center", opacity: ramp(f, 4 + i * 6, 16 + i * 6) })}>{c}</div>)}</div>
    {s.rows.map((r, ri) => { const y = 360 + ri * 120, a = ramp(f, 14 + ri * 8, 28 + ri * 8); return (<div key={ri} style={{ opacity: a }}>
      <div style={abs(120, y, 1680, 100, { background: ri % 2 ? "#fff" : C.soft, borderRadius: 8 })} />
      <div style={abs(150, y, 360, 100, { fontFamily: SANS, fontWeight: 600, fontSize: 30, lineHeight: "100px", color: C.ink })}>{r.label}</div>
      {r.cells.map((c, ci) => <div key={ci} style={abs(520 + ci * colW, y, colW, 100, { textAlign: "center", fontFamily: COND, fontWeight: 700, fontSize: 56, lineHeight: "100px", color: c.hot ? C.red : C.ok })}>{c.text}</div>)}</div>); })}
    {s.footer && <div style={abs(120, 990, 1680, 50, { fontFamily: MONO, fontSize: 22, color: C.dim })}>{s.footer}</div>}
  </>);
}
/** A labelled pipeline: boxes joined by arrows that draw in order. s.nodes: [{ label, sub }] */
function DiagramScene({ s }) {
  const f = useCurrentFrame(), n = s.nodes.length, bw = 300, gap = (1680 - n * bw) / (n - 1);
  return (<>
    <Head kicker={s.kicker}>{s.title}</Head>
    {s.nodes.map((nd, i) => { const x = 120 + i * (bw + gap), a = ramp(f, 8 + i * 14, 22 + i * 14); return (<div key={i}>
      <div style={abs(x, 420, bw, 220, { background: i === n - 1 ? C.blue : C.soft, color: i === n - 1 ? "#fff" : C.ink, border: `2px solid ${i === n - 1 ? C.blue : C.line}`, borderRadius: 14, opacity: a, transform: `translateY(${(1 - a) * 24}px)`, padding: 24, boxSizing: "border-box" })}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 36 }}>{nd.label}</div><div style={{ fontFamily: MONO, fontSize: 20, marginTop: 10, opacity: 0.8 }}>{nd.sub}</div></div>
      {i < n - 1 && <svg style={abs(x + bw, 500, gap, 60, {})} viewBox={`0 0 ${gap} 60`}><path d={`M6 30 H${gap - 16}`} stroke={C.ink} strokeWidth="5" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - ramp(f, 18 + i * 14, 34 + i * 14)} /><path d={`M${gap - 30} 14 L${gap - 8} 30 L${gap - 30} 46`} fill="none" stroke={C.ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity={ramp(f, 30 + i * 14, 36 + i * 14)} /></svg>}</div>); })}
  </>);
}
/** The claim being tested, large, with its scope: the opening of an AI Search style video. */
function ClaimScene({ s }) {
  const f = useCurrentFrame();
  return (<>
    <div style={abs(160, 250, 1600, 80, { fontFamily: MONO, fontSize: 28, letterSpacing: "0.16em", textTransform: "uppercase", color: C.blue, opacity: ramp(f, 0, 10) })}>{s.kicker}</div>
    <div style={abs(160, 340, 1600, 420, { fontFamily: SANS, fontWeight: 800, fontSize: 112, lineHeight: 1.04, color: C.ink, opacity: ramp(f, 4, 18), transform: `translateY(${(1 - ramp(f, 4, 22)) * 30}px)` })}>{s.title}</div>
    <div style={abs(160, 800, 1600, 160, { fontFamily: SANS, fontSize: 40, lineHeight: 1.35, color: C.dim, opacity: ramp(f, 24, 38) })}>{s.scope}</div>
  </>);
}
const KINDS = { browser: BrowserScene, terminal: TerminalScene, bench: BenchScene, compare: CompareScene, diagram: DiagramScene, claim: ClaimScene };
export function AiTestedSceneOnly({ scene, images = {} }) {
  const B = KINDS[scene.kind];
  return <AbsoluteFill style={{ background: C.bg }}><style>{FONT_FACES}</style>{B ? <B s={scene} images={images} /> : null}</AbsoluteFill>;
}
export const AI_COLORS = C;
