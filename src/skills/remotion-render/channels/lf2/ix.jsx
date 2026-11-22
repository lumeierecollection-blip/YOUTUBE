// Rival Lines "intrcpt" kit, rebuilt 18 Nov 2026 frame-by-frame against intrcpt gp4cftwGLcQ (reference frames: channel-reverse/spec/carbon/ix-a.jpg, ix-b.jpg).
// Measured grammar copied: three grounds (grey paper with grain; dark teal with a soft central glow and a faint grid; plum for footage windows), a camera that
// keeps pushing in through every scene, serif type everywhere (centred title-case headline with one italic-bold word; small serif labels; small-caps axis titles),
// tall glowing bars with a darker side face on a thin baseline, star-marker scatter plots with tiny serif name labels, black silhouette pictograms, callouts on
// thin leader lines ("8.1% (left-handed)"), cut-out photos with a drop shadow, footage in shadowed windows. Their art, clips, crests and seal are NOT used:
// our data, Commons/Pixabay pictures, our own drawing. Colours: config/longform-v2.json rival-lines.ix (scenes name tones: home, away, draw, accent, red).
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { F, Fonts, clamp, eio, eo, expo, lerp, ramp } from "./kit.jsx";

const SERIF = F.display;   // Playfair Display: closest licensed match to their high-contrast serif
const src = (p) => (p.startsWith("data:") || p.startsWith("http") ? p : staticFile(p));
const fmt = (v, d = 0) => v.toFixed(d);
const col = (t, c) => (c && t.ix[c]) || c || t.ix.accent;
const ALIAS = { cream: "paper", navy: "teal", green: "plum" };   // older scene specs
const dark = (bg) => bg !== "paper";
const ink = (t, bg) => (dark(bg) ? "#F2EFE8" : t.ix.ink), mute = (t, bg) => (dark(bg) ? "rgba(242,239,232,0.6)" : t.ix.mute);

/** Ground + camera. The whole layer pushes in slowly and drifts (their scenes never hold still); paper has grain, teal a glow and a faint grid, plum a glow. */
function Ground({ t, bg: bg0 = "paper", children, push = 0.12 }) {
  const bg = ALIAS[bg0] || bg0, c = t.ix, f = useCurrentFrame(), { durationInFrames: D } = useVideoConfig();
  const k = interpolate(f, [0, Math.max(60, D)], [0, 1], { ...clamp, easing: eio });
  const cam = { transform: `scale(${1 + push * k}) translate(${-18 * k}px, ${-8 * k}px)`, transformOrigin: "50% 48%" };
  const base = bg === "teal" ? `radial-gradient(70% 70% at 50% 48%, ${c.teal2} 0%, ${c.teal} 70%)` : bg === "plum" ? `radial-gradient(70% 70% at 50% 45%, ${c.plum2} 0%, ${c.plum} 75%)` : `radial-gradient(110% 100% at 50% 40%, ${c.paper} 55%, ${c.paper2} 100%)`;
  return (
    <AbsoluteFill style={{ background: base, color: ink(t, bg) }}>
      <Fonts />
      {bg === "teal" && <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, opacity: 0.07 }}>{Array.from({ length: 33 }, (_, i) => <line key={`v${i}`} x1={i * 60} x2={i * 60} y1={0} y2={1080} stroke="#fff" strokeWidth={1} />)}{Array.from({ length: 19 }, (_, i) => <line key={`h${i}`} y1={i * 60} y2={i * 60} x1={0} x2={1920} stroke="#fff" strokeWidth={1} />)}</svg>}
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, opacity: bg === "paper" ? 0.16 : 0.09, mixBlendMode: bg === "paper" ? "multiply" : "overlay", pointerEvents: "none" }}>
        <filter id="ixg"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="5" /><feColorMatrix type="saturate" values="0" /></filter><rect width="1920" height="1080" filter="url(#ixg)" />
      </svg>
      <AbsoluteFill style={cam}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(85% 85% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.22) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
}
const Source = ({ t, bg, text }) => text ? <div style={{ position: "absolute", left: 60, bottom: 30, right: 60, fontFamily: SERIF, fontStyle: "italic", fontSize: 20, color: mute(t, ALIAS[bg] || bg) }}>{text}</div> : null;
/** Centred title-case serif headline; the `bold` word is set italic and heavy ("The Left-Footed Revolution"). */
const Head = ({ t, bg, text, bold, size = 76, top = 70, from = 0 }) => {
  const f = useCurrentFrame(), a = ramp(f, from, from + 16, expo), parts = text.split(bold ? new RegExp(`(${bold})`) : /$^/);
  return <div style={{ position: "absolute", left: 80, right: 80, top, textAlign: "center", fontFamily: SERIF, fontSize: size, lineHeight: 1.08, color: ink(t, ALIAS[bg] || bg), opacity: a, transform: `translateY(${(1 - a) * 18}px)` }}>
    {parts.map((p, i) => <span key={i} style={bold && p === bold ? { fontWeight: 800, fontStyle: "italic" } : {}}>{p}</span>)}
  </div>;
};
/** Callout on a thin leader line: value in serif, caption in brackets below, like "8.1% (left-handed)". */
const Callout = ({ t, bg, x, y, tx, ty, value, caption, from = 20, size = 64, wide }) => {
  const f = useCurrentFrame(), a = ramp(f, from, from + 14, expo), L = ramp(f, from - 10, from + 6), c = ink(t, ALIAS[bg] || bg);
  return <>
    <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}><polyline points={`${x},${y} ${x + (tx - x) * L},${y + (ty - y) * L} ${tx - 10 > x ? tx + 40 * L : tx - 40 * L},${ty}`} fill="none" stroke={c} strokeWidth={2} opacity={0.85} /><circle cx={x} cy={y} r={7} fill="none" stroke={c} strokeWidth={2.5} opacity={L} /></svg>
    <div style={{ position: "absolute", left: tx > x ? tx + 52 : tx - 52 - (wide ? 640 : 420), width: wide ? 640 : 420, whiteSpace: wide ? "nowrap" : "normal", top: ty - size * 0.62, textAlign: tx > x ? "left" : "right", opacity: a, color: c }}>
      <div style={{ fontFamily: SERIF, fontSize: size, lineHeight: 1 }}>{value}</div>
      {caption && <div style={{ fontFamily: SERIF, fontSize: 24, marginTop: 6, opacity: 0.8 }}>({caption})</div>}
    </div>
  </>;
};

export function IxTitle({ t, bg = "paper", line, sub }) {
  const f = useCurrentFrame(), a = ramp(f, 4, 24, expo);
  return <Ground t={t} bg={bg}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 430, textAlign: "center", fontFamily: SERIF, fontWeight: 800, fontSize: 150, letterSpacing: "-0.02em", color: ink(t, ALIAS[bg] || bg), opacity: a }}>{line}</div>
    {sub && <div style={{ position: "absolute", left: 0, right: 0, top: 620, textAlign: "center", fontFamily: SERIF, fontSize: 36, color: mute(t, ALIAS[bg] || bg), opacity: ramp(f, 18, 34) }}>{sub}</div>}
  </Ground>;
}

/** The opening figure: a counted number that ticks up, as a callout on a leader line pointing at a cut-out photo (their "8.1% (left-handed)" frame), or centred. */
export function IxStat({ t, bg = "teal", value, from = 0, decimals = 0, prefix = "", suffix = "", label, sub, source, cut }) {
  const f = useCurrentFrame(), k = ramp(f, 10, 60, expo), v = prefix + fmt(from + (value - from) * k, decimals) + suffix;
  if (cut) return <Ground t={t} bg={bg}>
    <Img src={src(cut.src)} style={{ position: "absolute", left: cut.x, bottom: cut.bottom ?? 0, height: cut.h, filter: "drop-shadow(0 26px 30px rgba(0,0,0,0.45))", opacity: ramp(f, 0, 12) }} />
    <Callout t={t} bg={bg} x={cut.px} y={cut.py} tx={cut.tx} ty={cut.ty} value={v} caption={label} from={14} size={86} />
    {sub && <Callout t={t} bg={bg} x={cut.px2} y={cut.py2} tx={cut.tx2} ty={cut.ty2} value={sub.value} caption={sub.caption} from={70} size={64} />}
    <Source t={t} bg={bg} text={source} />
  </Ground>;
  return <Ground t={t} bg={bg}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", fontFamily: SERIF, fontSize: 260, lineHeight: 1, color: ink(t, ALIAS[bg] || bg) }}>{v}</div>
    {label && <div style={{ position: "absolute", left: 0, right: 0, top: 620, textAlign: "center", fontFamily: SERIF, fontSize: 40, color: mute(t, ALIAS[bg] || bg), opacity: ramp(f, 20, 36) }}>({label})</div>}
    <Source t={t} bg={bg} text={source} />
  </Ground>;
}

/** Tall glowing bars with a darker side face on a thin baseline, value above in serif, label below in small serif (their bar frames). */
export function IxBars({ t, bg = "teal", title, bold, items, max = 100, unit = "%", decimals = 1, source }) {
  const f = useCurrentFrame(), n = items.length, W = Math.min(1500, 260 * n), X0 = (1920 - W) / 2, slot = W / n, bw = Math.min(150, slot * 0.46), BASE = 850, H = 520, c = ink(t, ALIAS[bg] || bg);
  return <Ground t={t} bg={bg}>
    {title && <Head t={t} bg={bg} text={title} bold={bold} />}
    <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs><filter id="bglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter></defs>
      <line x1={X0 - 40} x2={X0 + W + 40} y1={BASE} y2={BASE} stroke={c} strokeWidth={2} opacity={0.8} />
      {items.map((it, i) => { const k = ramp(f, 12 + i * 10, 52 + i * 10, expo), h = (H * it.value / max) * k, x = X0 + slot * i + (slot - bw) / 2, fill = col(t, it.color), d = 16;
        return <g key={i}>
          <rect x={x} y={BASE - h} width={bw} height={h} fill={fill} opacity={0.55} filter="url(#bglow)" />
          <polygon points={`${x + bw},${BASE - h} ${x + bw + d},${BASE - h - d * 0.6} ${x + bw + d},${BASE - d * 0.6} ${x + bw},${BASE}`} fill={fill} style={{ filter: "brightness(0.6)" }} />
          <polygon points={`${x},${BASE - h} ${x + d},${BASE - h - d * 0.6} ${x + bw + d},${BASE - h - d * 0.6} ${x + bw},${BASE - h}`} fill={fill} style={{ filter: "brightness(1.25)" }} />
          <rect x={x} y={BASE - h} width={bw} height={h} fill={fill} />
          <text x={x + bw / 2} y={BASE - h - 30} textAnchor="middle" fontFamily={SERIF} fontSize={42} fill={c} opacity={ramp(f, 30 + i * 10, 44 + i * 10)}>{fmt(it.value * k, decimals)}{unit}</text>
          <text x={x + bw / 2} y={BASE + 40} textAnchor="middle" fontFamily={SERIF} fontSize={26} fill={c}>{it.label}</text>
          {it.sub && <text x={x + bw / 2} y={BASE + 70} textAnchor="middle" fontFamily={SERIF} fontSize={19} fill={c} opacity={0.6}>({it.sub})</text>}
        </g>; })}
    </svg>
    <Source t={t} bg={bg} text={source} />
  </Ground>;
}

/** Line chart in the same grammar: faint grid, serif ticks, small-caps axis title, glowing lines drawn on, callouts on leader lines. */
export function IxLine({ t, bg = "paper", title, bold, xs, series, ymin, ymax, unit = "%", mark, callouts = [], source, draw = 110, xstep = 4, axis = "SEASON" }) {
  const f = useCurrentFrame(), c = t.ix, X0 = 240, X1 = 1560, Y0 = 260, Y1 = 860, n = xs.length, I = ink(t, ALIAS[bg] || bg);
  const px = (i) => X0 + ((X1 - X0) * i) / (n - 1), py = (v) => Y1 - ((Y1 - Y0) * (v - ymin)) / (ymax - ymin);
  const upto = ramp(f, 14, 14 + draw, eo) * (n - 1);
  const ticks = []; for (let v = Math.ceil(ymin / 10) * 10; v <= ymax; v += 10) ticks.push(v);
  const pathFor = (vals) => { let d = ""; for (let i = 0; i < n; i++) { if (i > upto) { const fr = upto - (i - 1); if (fr > 0) d += ` L${(px(i - 1) + (px(i) - px(i - 1)) * fr).toFixed(1)} ${(py(vals[i - 1]) + (py(vals[i]) - py(vals[i - 1])) * fr).toFixed(1)}`; break; } d += `${i ? " L" : "M"}${px(i).toFixed(1)} ${py(vals[i]).toFixed(1)}`; } return d; };
  const tip = (s) => { const i = Math.min(n - 1, Math.floor(upto)), fr = Math.min(1, upto - i), j = Math.min(n - 1, i + 1); return [px(i) + (px(j) - px(i)) * fr, py(s.vals[i] + (s.vals[j] - s.vals[i]) * fr)]; };
  return <Ground t={t} bg={bg}>
    {title && <Head t={t} bg={bg} text={title} bold={bold} size={64} top={60} />}
    <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
      <defs><filter id="lglow"><feGaussianBlur stdDeviation="6" /></filter></defs>
      {mark && <rect x={px(mark.from) - 16} y={Y0 - 10} width={px(mark.to) - px(mark.from) + 32} height={Y1 - Y0 + 10} fill={c.accent} opacity={0.16 * ramp(f, 40, 60)} />}
      {ticks.map((v) => <g key={v}><line x1={X0} x2={X1} y1={py(v)} y2={py(v)} stroke={I} strokeWidth={1} opacity={0.18} /><text x={X0 - 20} y={py(v) + 8} textAnchor="end" fontFamily={SERIF} fontSize={24} fill={I} opacity={0.7}>{v}{unit}</text></g>)}
      {xs.map((x, i) => i % xstep === 0 && <g key={i}><line x1={px(i)} x2={px(i)} y1={Y0} y2={Y1} stroke={I} strokeWidth={1} opacity={0.1} /><text x={px(i)} y={Y1 + 40} textAnchor="middle" fontFamily={SERIF} fontSize={22} fill={I} opacity={0.7}>{x}</text></g>)}
      <line x1={X0} x2={X1} y1={Y1} y2={Y1} stroke={I} strokeWidth={2} opacity={0.7} />
      <text x={(X0 + X1) / 2} y={Y1 + 86} textAnchor="middle" fontFamily={SERIF} fontSize={22} letterSpacing="0.2em" fill={I} opacity={0.6}>{axis}</text>
      {series.map((s, k) => { const [tx, ty] = tip(s), cc = col(t, s.color); return <g key={k}>
        <path d={pathFor(s.vals)} fill="none" stroke={cc} strokeWidth={10} opacity={0.45} filter="url(#lglow)" strokeDasharray={s.dash || undefined} />
        <path d={pathFor(s.vals)} fill="none" stroke={cc} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dash || undefined} />
        <circle cx={tx} cy={ty} r={8} fill={cc} />
        <text x={tx + 18} y={ty + 8} fontFamily={SERIF} fontStyle="italic" fontSize={30} fill={cc} opacity={ramp(f, 24, 40)}>{s.name}</text></g>; })}
    </svg>
    {mark && <div style={{ position: "absolute", left: px(mark.from) - 80, width: 160, top: Y0 - 50, textAlign: "center", fontFamily: SERIF, fontSize: 26, color: c.accent, opacity: ramp(f, 46, 62) }}>{mark.label}</div>}
    {callouts.map((co, i) => { const s = series[co.s || 0]; return <Callout key={i} t={t} bg={bg} x={px(co.i)} y={py(s.vals[co.i])} tx={Math.max(300, px(co.i) - 300)} ty={Y0 - 40} value={co.text} caption={co.caption} from={co.at} size={34} wide />; })}
    <Source t={t} bg={bg} text={source} />
  </Ground>;
}

/** Star-marker scatter with tiny serif name labels and small-caps axis titles (their "AGE" and "Number of Left-Footed Players" plots). */
export function IxScatter({ t, bg = "paper", title, bold, points, xmin, xmax, ymin, ymax, xlab, ylab, diag, source, hi = [] }) {
  const f = useCurrentFrame(), X0 = 300, X1 = 1620, Y0 = 220, Y1 = 900, I = ink(t, ALIAS[bg] || bg);
  const px = (v) => X0 + ((X1 - X0) * (v - xmin)) / (xmax - xmin), py = (v) => Y1 - ((Y1 - Y0) * (v - ymin)) / (ymax - ymin);
  const star = (x, y, r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`; }).join(" ");
  // labels placed greedily so none overlap another label or a marker (the first render had five names stacked on one cluster)
  const boxes = points.map((p) => ({ x: px(p.x) - 13, y: py(p.y) - 13, w: 26, h: 26 })), hit = (b) => boxes.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
  const labels = points.map((p) => { const x = px(p.x), y = py(p.y), w = p.label.length * (hi.includes(p.label) ? 13 : 10.5), h = 24;
    const tries = [[0, -18, "middle"], [0, 34, "middle"], [18, 7, "start"], [-18, 7, "end"], [0, -48, "middle"], [0, 64, "middle"], [40, -30, "start"], [-40, -30, "end"], [40, 44, "start"], [-40, 44, "end"], [0, -80, "middle"], [0, 96, "middle"]];
    for (const [dx, dy, anchor] of tries) { const bx = anchor === "middle" ? x + dx - w / 2 : anchor === "start" ? x + dx : x + dx - w, b = { x: bx, y: y + dy - h + 4, w, h }; if (!hit(b)) { boxes.push(b); return { x: x + dx, y: y + dy, anchor, lead: Math.abs(dy) > 40 || Math.abs(dx) > 30 }; } }
    return { x, y: y - 18, anchor: "middle" }; });
  const gx = [], gy = []; for (let v = Math.ceil(xmin * 4) / 4; v <= xmax + 1e-9; v += 0.25) gx.push(+v.toFixed(2)); for (let v = Math.ceil(ymin * 4) / 4; v <= ymax + 1e-9; v += 0.25) gy.push(+v.toFixed(2));
  return <Ground t={t} bg={bg}>
    {title && <Head t={t} bg={bg} text={title} bold={bold} size={64} top={56} />}
    <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
      {gx.map((v) => <g key={`x${v}`}><line x1={px(v)} x2={px(v)} y1={Y0} y2={Y1} stroke={I} opacity={0.14} /><text x={px(v)} y={Y1 + 34} textAnchor="middle" fontFamily={SERIF} fontSize={20} fill={I} opacity={0.65}>{v.toFixed(2)}</text></g>)}
      {gy.map((v) => <g key={`y${v}`}><line x1={X0} x2={X1} y1={py(v)} y2={py(v)} stroke={I} opacity={0.14} /><text x={X0 - 16} y={py(v) + 7} textAnchor="end" fontFamily={SERIF} fontSize={20} fill={I} opacity={0.65}>{v.toFixed(2)}</text></g>)}
      <line x1={X0} x2={X1} y1={Y1} y2={Y1} stroke={I} strokeWidth={2} opacity={0.7} /><line x1={X0} x2={X0} y1={Y0} y2={Y1} stroke={I} strokeWidth={2} opacity={0.7} />
      {diag && <line x1={px(Math.max(xmin, ymin))} y1={py(Math.max(xmin, ymin))} x2={px(Math.min(xmax, ymax))} y2={py(Math.min(xmax, ymax))} stroke={I} strokeDasharray="8 8" opacity={0.45 * ramp(f, 20, 40)} />}
      <text x={(X0 + X1) / 2} y={Y1 + 80} textAnchor="middle" fontFamily={SERIF} fontSize={26} fill={I} opacity={0.8}>{xlab}</text>
      <text transform={`translate(${X0 - 90} ${(Y0 + Y1) / 2}) rotate(-90)`} textAnchor="middle" fontFamily={SERIF} fontSize={26} fill={I} opacity={0.8}>{ylab}</text>
      {points.map((p, i) => { const a = ramp(f, 16 + i * 4, 26 + i * 4, expo), H = hi.includes(p.label), cc = col(t, H ? "home" : "away"), x = px(p.x), y = py(p.y), L = labels[i]; return <g key={i} opacity={a}>
        <polygon points={star(x, y, H ? 15 : 11)} fill={cc} />
        {L.lead && <line x1={x} y1={y} x2={L.x} y2={L.y - 6} stroke={I} strokeWidth={1} opacity={0.4} />}
        <text x={L.x} y={L.y} textAnchor={L.anchor} fontFamily={SERIF} fontSize={H ? 24 : 19} fontWeight={H ? 700 : 400} fill={I}>{p.label}</text></g>; })}
    </svg>
    {diag && <div style={{ position: "absolute", left: px(Math.min(xmax, ymax)) - 330, top: py(Math.min(xmax, ymax)) - 10, width: 300, textAlign: "right", fontFamily: SERIF, fontStyle: "italic", fontSize: 24, color: I, opacity: 0.7 * ramp(f, 30, 50) }}>{diag}</div>}
    <Source t={t} bg={bg} text={source} />
  </Ground>;
}

/** Isotype pictogram: rows of black silhouettes, one per unit, the counted ones in colour (their figure grids). groups: [{ n, color, label }]. */
export function IxDots({ t, bg = "paper", title, bold, groups, source, per = 10 }) {
  const f = useCurrentFrame(), figs = []; groups.forEach((g) => { for (let k = 0; k < g.n; k++) figs.push(g.color); });
  const shown = Math.floor(ramp(f, 10, 10 + figs.length * 0.8, eo) * figs.length), S = 54, G = 66, X0 = 960 - (per * G) / 2 - 300, Y0 = 290, I = ink(t, ALIAS[bg] || bg);
  const Fig = ({ x, y, fill }) => <g transform={`translate(${x} ${y})`}><circle cx={S / 2} cy={S * 0.16} r={S * 0.15} fill={fill} /><rect x={S * 0.28} y={S * 0.33} width={S * 0.44} height={S * 0.38} rx={4} fill={fill} /><rect x={S * 0.3} y={S * 0.68} width={S * 0.16} height={S * 0.32} fill={fill} /><rect x={S * 0.54} y={S * 0.68} width={S * 0.16} height={S * 0.32} fill={fill} /></g>;
  return <Ground t={t} bg={bg}>
    {title && <Head t={t} bg={bg} text={title} bold={bold} size={64} top={60} />}
    <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
      {figs.map((c, i) => <Fig key={i} x={X0 + (i % per) * G} y={Y0 + Math.floor(i / per) * (G + 4)} fill={i < shown ? col(t, c) : I} />)}
    </svg>
    <div style={{ position: "absolute", left: X0 + per * G + 80, top: 330, width: 560 }}>
      {groups.map((g, i) => <div key={i} style={{ fontFamily: SERIF, fontSize: 30, color: I, marginBottom: 34, opacity: ramp(f, 40 + i * 20, 56 + i * 20) }}><span style={{ fontSize: 76, color: col(t, g.color) }}>{g.n}</span> ({g.label})</div>)}
    </div>
    <Source t={t} bg={bg} text={source} />
  </Ground>;
}

/** Evidence card: the study's own title and abstract (quoted verbatim, [[ ]] highlighted) on a white card, over a dark ground (their article screenshots). */
export function IxCard({ t, bg = "teal", journal, title, authors, abstract, doi, via }) {
  const f = useCurrentFrame(), c = t.ix, a = ramp(f, 4, 24, expo), parts = abstract.split(/(\[\[.*?\]\])/g); let hi = 0;
  return <Ground t={t} bg={bg} push={0.08}>
    <div style={{ position: "absolute", left: 300, top: 130, width: 1320, background: "#FFFFFF", color: "#1b1712", padding: "60px 80px 52px", boxShadow: "0 40px 90px rgba(0,0,0,0.45)", opacity: a, transform: `translateY(${(1 - a) * 40}px)` }}>
      <div style={{ fontFamily: F.sans, fontSize: 22, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7a7266" }}>{journal}</div>
      <div style={{ fontFamily: F.sans, fontWeight: 400, fontSize: 52, lineHeight: 1.18, marginTop: 14 }}>{title}</div>
      <div style={{ fontFamily: F.sans, fontSize: 24, color: "#7a7266", marginTop: 12 }}>{authors}</div>
      <div style={{ fontFamily: F.sans, fontSize: 30, lineHeight: 1.55, marginTop: 30, color: "#3a352e" }}>
        {parts.map((p, i) => { if (!p.startsWith("[[")) return <span key={i}>{p}</span>; const k = ramp(f, 34 + hi * 26, 56 + hi * 26); hi++; return <span key={i} style={{ background: `linear-gradient(90deg, ${c.marker} ${k * 100}%, transparent ${k * 100}%)`, padding: "0 4px", color: "#111" }}>{p.slice(2, -2)}</span>; })}
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 18, color: "#8a8174", marginTop: 26 }}>{doi}{via ? `  ·  abstract as retrieved from ${via}` : ""}</div>
    </div>
  </Ground>;
}

/** Footage in shadowed windows on the plum ground (their clip frames): one window, or two side by side when `video2` is given. Free-licence clips only. */
export function IxClip({ t, bg = "plum", video, video2, image, ss = 0, credit, head, bold }) {
  const f = useCurrentFrame(), a = ramp(f, 2, 20, expo), z = lerp(f, 0, 300, 1.0, 1.08, (x) => x);
  const win = (l, w, h, top) => ({ position: "absolute", left: l, top, width: w, height: h, overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.5)", opacity: a, transform: `translateY(${(1 - a) * 30}px)` });
  const media = (v, im) => v ? <OffthreadVideo src={src(v)} muted startFrom={Math.round(ss * 30)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` }} /> : <Img src={src(im)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` }} />;
  return <Ground t={t} bg={bg} push={0.06}>
    {head && <Head t={t} bg={bg} text={head} bold={bold} size={60} top={70} />}
    {video2 ? <><div style={win(130, 800, 450, 330)}>{media(video)}</div><div style={win(990, 800, 450, 330)}>{media(video2)}</div></> : <div style={win(310, 1300, 731, head ? 220 : 175)}>{media(video, image)}</div>}
    <div style={{ position: "absolute", right: 60, bottom: 26, fontFamily: F.sans, fontSize: 18, color: "rgba(255,255,255,0.7)" }}>{credit}</div>
  </Ground>;
}

/** Statement card: centred serif line, italic-bold emphasis, a smaller line under it. */
export function IxQuote({ t, bg = "paper", text, bold, sub, source }) {
  const f = useCurrentFrame();
  return <Ground t={t} bg={bg}>
    <Head t={t} bg={bg} text={text} bold={bold} size={104} top={360} />
    {sub && <div style={{ position: "absolute", left: 260, right: 260, top: 620, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 34, lineHeight: 1.35, color: mute(t, ALIAS[bg] || bg), opacity: ramp(f, 30, 50) }}>{sub}</div>}
    <Source t={t} bg={bg} text={source} />
  </Ground>;
}

/** Thumbnail, measured intrcpt formula (5 of 5 hits, channel-reverse/spec/thumbs): light grey-white gradient, centred serif headline with one bold word, ONE
 *  background-removed subject with a horizontal motion-blur trail, a red hand-drawn arrow whose tail carries a small serif aside, a tiny mark top-left. */
export function IxThumb({ t, headline, bold, aside, cut, credit, arrow, asideAt = { x: 1500, y: 820 } }) {
  const c = t.ix, parts = headline.split(bold ? new RegExp(`(${bold})`) : /$^/), a = arrow;
  const img = { position: "absolute", left: cut.x, bottom: cut.bottom || 0, height: cut.h };
  const mx = a ? (a.x1 + a.x2) / 2 + (a.bend ?? -70) : 0, my = a ? (a.y1 + a.y2) / 2 + (a.bend ?? -70) : 0;
  return <AbsoluteFill style={{ background: `radial-gradient(90% 100% at 50% 40%, #FFFFFF 0%, ${c.thumbBg} 60%, #DEDDDA 100%)` }}>
    <Fonts />
    <svg width="0" height="0" style={{ position: "absolute" }}><filter id="mblur" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="30 0" /></filter></svg>
    <div style={{ position: "absolute", left: 40, top: 26, fontFamily: SERIF, fontWeight: 800, fontSize: 60, color: c.ink }}>r</div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 40, textAlign: "center", fontFamily: SERIF, fontSize: 140, lineHeight: 1.0, color: c.ink, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
      {parts.map((p, i) => <span key={i} style={{ fontWeight: bold && p === bold ? 800 : 400 }}>{p}</span>)}
    </div>
    {[3, 2, 1].map((k) => <Img key={k} src={src(cut.src)} style={{ ...img, left: cut.x - k * 80, opacity: 0.17 * (4 - k), filter: "url(#mblur) saturate(1.3)" }} />)}
    <Img src={src(cut.src)} style={{ ...img, filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.18))" }} />
    {a && <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
      <path d={`M${a.x1} ${a.y1} Q${mx} ${my} ${a.x2} ${a.y2}`} fill="none" stroke={c.arrow} strokeWidth={12} strokeLinecap="round" />
      {(() => { const ang = Math.atan2(a.y2 - my, a.x2 - mx), L = 50, s = 0.55; return <path d={`M${a.x2 - L * Math.cos(ang - s)} ${a.y2 - L * Math.sin(ang - s)} L${a.x2} ${a.y2} L${a.x2 - L * Math.cos(ang + s)} ${a.y2 - L * Math.sin(ang + s)}`} fill="none" stroke={c.arrow} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />; })()}
    </svg>}
    {aside && <div style={{ position: "absolute", left: asideAt.x, top: asideAt.y, fontFamily: SERIF, fontSize: 52, color: c.ink }}>{aside}</div>}
    {credit && <div style={{ position: "absolute", right: 14, bottom: 8, fontFamily: F.sans, fontSize: 15, color: "rgba(0,0,0,0.45)" }}>{credit}</div>}
  </AbsoluteFill>;
}

/** Thumbnail cloned from intrcpt's best performer ("The Premier League Is Evolving Again", 639k): a league-table list (rank circles, club
 *  names, coloured result pills, a points column), some rows faded, red hand-drawn arrows pointing at rows, and a two-line serif headline on
 *  the right, light then bold. Ours shows OUR data: home vs away points per game, ranked by the home boost. rows: [{ rank, club, h, a, fade }] */
export function IxTableThumb({ t, rows, light, bold, arrows = [] }) {
  const c = t.ix, Y0 = 26, RH = 56;
  const pill = (txt, fill, w) => <div style={{ width: w, height: 42, background: fill, color: "#fff", fontFamily: F.sans, fontWeight: 800, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>{txt}</div>;
  return <AbsoluteFill style={{ background: `radial-gradient(90% 100% at 60% 45%, #FFFFFF 0%, ${c.thumbBg} 60%, #E2E2E0 100%)` }}>
    <Fonts />
    <div style={{ position: "absolute", left: 40, top: 26, fontFamily: SERIF, fontWeight: 800, fontSize: 60, color: c.ink }}>r</div>
    {rows.map((r, i) => <div key={i} style={{ position: "absolute", left: 190, top: Y0 + i * RH, height: RH - 6, display: "flex", alignItems: "center", gap: 22, opacity: r.fade ? 0.42 : 1 }}>
      <div style={{ width: 44, height: 44, borderRadius: 22, background: r.fade ? "#A39E90" : "#1F9D55", color: "#fff", fontFamily: F.sans, fontWeight: 800, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>{r.rank}</div>
      <div style={{ width: 210, fontFamily: F.sans, fontWeight: 600, fontSize: 28, color: "#222" }}>{r.club}</div>
      <div style={{ display: "flex", gap: 3 }}>{pill(`H ${r.h.toFixed(2)}`, "#1F9D55", 120)}{pill(`A ${r.a.toFixed(2)}`, r.fade ? "#9C8F8F" : "#D7263D", 120)}</div>
      <div style={{ width: 70, textAlign: "right", fontFamily: F.sans, fontWeight: 700, fontSize: 26, color: "#222" }}>+{(r.h - r.a).toFixed(2)}</div>
    </div>)}
    <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>{arrows.map((a, i) => { const mx = (a.x1 + a.x2) / 2 + 40, my = (a.y1 + a.y2) / 2 - 50, ang = Math.atan2(a.y2 - my, a.x2 - mx), L = 34, s = 0.55;
      return <g key={i} fill="none" stroke={c.arrow} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round"><path d={`M${a.x1} ${a.y1} Q${mx} ${my} ${a.x2} ${a.y2}`} /><path d={`M${a.x2 - L * Math.cos(ang - s)} ${a.y2 - L * Math.sin(ang - s)} L${a.x2} ${a.y2} L${a.x2 - L * Math.cos(ang + s)} ${a.y2 - L * Math.sin(ang + s)}`} /></g>; })}</svg>
    <div style={{ position: "absolute", right: 70, top: 330, width: 820, textAlign: "left", fontFamily: SERIF, color: c.ink, lineHeight: 0.95 }}>
      <div style={{ fontSize: 150, fontWeight: 400 }}>{light}</div><div style={{ fontSize: 170, fontWeight: 800 }}>{bold}</div>
    </div>
  </AbsoluteFill>;
}

export const IX = { ixtable: IxTableThumb, ixthumb: IxThumb, ixtitle: IxTitle, ixstat: IxStat, ixline: IxLine, ixbars: IxBars, ixscatter: IxScatter, ixdots: IxDots, ixcard: IxCard, ixclip: IxClip, ixquote: IxQuote };
