// Court & Spotlight living-collage engine. A scene is a stack of layers (ground, torn paper, photographs on tape, sticker cut-outs, tags,
// stamps, typed documents, string between pins). Every layer enters from an edge or pops in, then keeps swaying and drifting at its own
// depth so the whole page reads as one living thing. Two themes share the engine: "case" (aged paper, red string, for investigations)
// and "mag" (bright paper, pastel scraps and stickers, for entertainment features). Photographs are real and licensed; the texture,
// scraps, tape and type are drawn here. Nothing is AI-generated, and no newspaper text is faked: columns are plain grey bars.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";

export const THEMES = {
  case: { ground: "#CDBB93", ground2: "#B9A57B", paper: "#E9DFC4", paper2: "#DCCFAE", ink: "#2A2018", dim: "#6E5F48", accent: "#B0302A", accent2: "#E3B341", tape: "rgba(222,205,150,0.85)", shadow: "rgba(30,20,10,0.38)", stamp: "#B0302A", head: '"Roboto Condensed", sans-serif', body: '"JetBrains Mono", monospace', label: '"Roboto Condensed", sans-serif' },
  mag: { ground: "#FFF1DE", ground2: "#FFE0C2", paper: "#FFFFFF", paper2: "#FFF8EC", ink: "#1D1A2F", dim: "#6A6580", accent: "#F0306E", accent2: "#FFD43B", tape: "rgba(255,200,221,0.88)", shadow: "rgba(60,30,60,0.28)", stamp: "#F0306E", head: '"Playfair Display", serif', body: '"DM Sans", sans-serif', label: '"DM Sans", sans-serif', pop: ["#FFC8DD", "#FFE066", "#9FE6D8", "#CDB4F7"] },
  // Rival Lines player documentaries: white editorial page, club colours (blue and garnet) with a gold accent.
  sport: { ground: "#F4F6F9", ground2: "#DCE3EC", paper: "#FFFFFF", paper2: "#EEF2F7", ink: "#0B1220", dim: "#5B677A", accent: "#A50044", accent2: "#004D98", tape: "rgba(0,77,152,0.22)", shadow: "rgba(11,18,32,0.30)", stamp: "#A50044", head: '"Archivo Black", "Inter", sans-serif', body: '"Inter", sans-serif', label: '"Inter", sans-serif', pop: ["#004D98", "#A50044", "#EDBB00", "#75AADB"] },
};
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const back = Easing.out(Easing.back(1.25)), eo = Easing.out(Easing.cubic);
const tw = (f, a, b, e = eo) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const abs = (x, y, w, h, extra) => ({ position: "absolute", left: x, top: y, width: w, height: h, ...extra });

/** Torn-edge polygon inside a w x h box (deterministic from the seed). */
const jag = (w, h, seed, amp = 9, step = 38) => {
  const r = rng(seed), pts = [], n = (len) => Math.max(2, Math.round(len / step));
  for (let i = 0; i <= n(w); i++) pts.push([(w * i) / n(w), r() * amp]);
  for (let i = 1; i <= n(h); i++) pts.push([w - r() * amp, (h * i) / n(h)]);
  for (let i = n(w) - 1; i >= 0; i--) pts.push([(w * i) / n(w), h - r() * amp]);
  for (let i = n(h) - 1; i > 0; i--) pts.push([r() * amp, (h * i) / n(h)]);
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(",")})`;
};

/** Textured ground: paper tone, fibre noise, map contour lines, grey text-column bars (never readable text), edge shading. */
export function Ground({ th, seed = 1, columns = false, contour = true }) {
  const f = useCurrentFrame(), T = THEMES[th], r = rng(seed * 97);
  const bars = columns ? Array.from({ length: 70 }, (_, i) => ({ x: 40 + (i % 5) * 205, y: 60 + Math.floor(i / 5) * 128 + r() * 20, w: 120 + r() * 70, o: 0.06 + r() * 0.05 })) : [];
  return (<AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 35%, ${T.ground} 40%, ${T.ground2} 100%)` }}>
    <AbsoluteFill style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(40,28,14,0.10) 1px, transparent 0), radial-gradient(circle at 3px 2px, rgba(40,28,14,0.07) 1px, transparent 0), repeating-linear-gradient(97deg, rgba(60,40,20,0.035) 0 2px, transparent 2px 7px)", backgroundSize: "3px 3px, 5px 5px, auto", opacity: th === "case" ? 1 : 0.5 }} />
    <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, transform: `translate(${Math.sin(f / 90) * 3}px, ${f * 0.04}px)` }}>
      {contour && Array.from({ length: 9 }, (_, i) => <ellipse key={i} cx={300 + seed * 70} cy={700 + seed * 40} rx={90 + i * 85} ry={60 + i * 70} fill="none" stroke={T.ink} strokeOpacity={0.06} strokeWidth="2" />)}
      {bars.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height="9" fill={T.ink} opacity={b.o} />)}
    </svg>
    <AbsoluteFill style={{ background: th === "case" ? "radial-gradient(ellipse at center, transparent 50%, rgba(30,18,8,0.45) 100%)" : "radial-gradient(ellipse at 30% 10%, rgba(255,255,255,0.55), transparent 55%)" }} />
  </AbsoluteFill>);
}

/** Wrapper: entrance from an edge or a pop, then a living sway and slow drift whose size follows the layer depth d. */
function Live({ x, y, w, h, r = 0, d = 0.5, at = 0, from = "pop", seed = 1, z, children, style }) {
  const f = useCurrentFrame(), p = tw(f, at, at + 16, back), o = Math.min(1, tw(f, at, at + 5));
  const dx = from === "l" ? -(1 - p) * 1000 : from === "r" ? (1 - p) * 1000 : 0, dy = from === "t" ? -(1 - p) * 1100 : from === "b" ? (1 - p) * 1100 : 0;
  const sc = from === "pop" ? 0.55 + 0.45 * p : 1, k = Math.max(0, f - at - 14);
  const sx = Math.sin((f + seed * 17) / 41) * 5 * d, sy = Math.sin((f + seed * 29) / 53) * 4 * d + k * 0.05 * d, sr = Math.sin((f + seed * 11) / 61) * 0.5 * d;
  return <div style={abs(x, y, w, h, { opacity: o, zIndex: z, transform: `translate(${dx + sx}px, ${dy + sy}px) rotate(${r + sr + (1 - p) * (from === "pop" ? -8 : 0)}deg) scale(${sc})`, ...style })}>{children}</div>;
}
const sh = (T, s = 1) => `drop-shadow(${6 * s}px ${10 * s}px ${12 * s}px ${T.shadow})`;

const Tape = ({ th, x, y, r = -20, w = 150, c }) => { const T = THEMES[th]; return <div style={abs(x, y, w, 46, { background: c || T.tape, transform: `rotate(${r}deg)`, boxShadow: "0 2px 4px rgba(0,0,0,0.2)", backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 7px, transparent 7px 14px)", opacity: 0.92 })} />; };

/** One layer. kind: scrap | photo | cut | tag | type | stamp | num | doc | badge | pin | strip */
export function Layer({ th, L, i }) {
  const T = THEMES[th], f = useCurrentFrame(), { k, x, y, w, h, r = 0, d = 0.5, at = 0, from = "pop" } = L, seed = L.seed ?? i + 3;
  const live = { x, y, w, h, r, d, at, from, seed, z: i };
  if (k === "scrap") return <Live {...live} style={{ filter: sh(T, 0.7) }}><div style={{ width: w, height: h, background: L.c || T.paper, clipPath: jag(w, h, seed), backgroundImage: L.lines ? "repeating-linear-gradient(0deg, transparent 0 38px, rgba(60,40,20,0.07) 38px 40px)" : undefined }} />{L.tape ? L.tape.map((t, j) => <Tape key={j} th={th} {...t} c={L.tapeC} />) : null}</Live>;
  if (k === "photo") {
    const b = L.border ?? 14;
    return <Live {...live} style={{ filter: sh(T) }}><div style={{ width: w, height: h, background: L.frame || "#FBF8EF", padding: b, boxSizing: "border-box", borderRadius: th === "mag" ? 6 : 2 }}><div style={{ width: "100%", height: "100%", backgroundImage: `url(${L.src})`, backgroundSize: L.fit || "cover", backgroundPosition: L.pos || "center", backgroundRepeat: "no-repeat", backgroundColor: "#cfc6b0", filter: L.grade }} /></div>{(L.tape || []).map((t, j) => <Tape key={j} th={th} {...t} c={L.tapeC} />)}{L.cap ? <div style={abs(0, h + 8, w, 40, { fontFamily: T.body, fontSize: 21, color: T.dim, lineHeight: 1.2 })}>{L.cap}</div> : null}</Live>;
  }
  if (k === "cut") return <Live {...live} style={{ filter: sh(T) }}><img src={L.src} style={{ width: w, height: h, objectFit: "contain", objectPosition: L.pos || "center bottom" }} /></Live>;
  if (k === "tag") return <Live {...live} style={{ filter: sh(T, 0.6) }}><div style={{ width: w, height: h, background: L.c || T.paper2, borderRadius: th === "mag" ? 18 : 6, clipPath: th === "case" ? "polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%)" : undefined, display: "flex", alignItems: "center", padding: "0 30px 0 36px", boxSizing: "border-box", fontFamily: L.font || T.label, fontWeight: 700, fontSize: L.size || 40, color: L.color || T.ink, textTransform: L.upper === false ? "none" : "uppercase", letterSpacing: "0.02em", lineHeight: 1.05 }}><div style={{ position: "absolute", left: 12, top: h / 2 - 7, width: 14, height: 14, borderRadius: 7, background: T.ground2, boxShadow: "inset 1px 2px 2px rgba(0,0,0,0.4)" }} />{L.text}</div></Live>;
  if (k === "type") {
    const n = L.typed ? Math.floor(tw(f, at + 4, at + 4 + L.typed) * String(L.text).length) : String(L.text).length;
    return <Live {...live} style={{}}><div style={{ width: w, fontFamily: L.font || T.head, fontWeight: L.weight || 700, fontSize: L.size || 100, lineHeight: L.lh || 0.98, color: L.color || T.ink, textTransform: L.upper === false ? "none" : "uppercase", letterSpacing: L.ls || "-0.01em", textAlign: L.align || "left", whiteSpace: "pre-wrap", textShadow: L.shadow || "none" }}>{String(L.text).slice(0, n)}</div></Live>;
  }
  if (k === "stamp") { const a = tw(f, at, at + 9); return <Live {...live} from="none" style={{ opacity: a }}><div style={{ width: w, height: h, border: `${L.bw || 8}px solid ${L.color || T.stamp}`, color: L.color || T.stamp, borderRadius: th === "mag" ? 14 : 6, fontFamily: T.label, fontWeight: 700, fontSize: L.size || 56, letterSpacing: "0.1em", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1, transform: `scale(${1.5 - 0.5 * a})`, background: L.bg || "transparent", textTransform: "uppercase", mixBlendMode: th === "case" ? "multiply" : "normal" }}>{L.text}</div></Live>;
  }
  if (k === "num") { const v = L.count ? Math.round(L.count[0] + (L.count[1] - L.count[0]) * tw(f, at + 2, at + 2 + (L.dur || 22), Easing.linear)) : L.text; return <Live {...live} style={{}}><div style={{ fontFamily: L.font || T.head, fontWeight: 700, fontSize: L.size || 300, lineHeight: 1, color: L.color || T.ink }}>{L.fmt === "tenth" ? (v / 10).toFixed(1) : v}{L.strike ? <div style={{ position: "absolute", left: "-4%", right: "-4%", top: "50%", height: "0.1em", background: T.accent, transform: `scaleX(${tw(f, L.strike, L.strike + 14)}) rotate(-3deg)`, transformOrigin: "left center" }} /> : null}</div></Live>;
  }
  if (k === "doc") {
    const lines = L.lines;
    return <Live {...live} style={{ filter: sh(T) }}><div style={{ width: w, height: h, background: T.paper, clipPath: jag(w, h, seed, 7, 34), padding: "36px 38px", boxSizing: "border-box", fontFamily: T.body, fontSize: L.size || 29, lineHeight: 1.45, color: T.ink }}>
      {L.head ? <div style={{ fontFamily: T.label, fontWeight: 700, fontSize: 26, letterSpacing: "0.14em", color: T.accent, marginBottom: 14 }}>{L.head}</div> : null}
      {lines.map((ln, j) => { const a = tw(f, at + 10 + j * 9, at + 22 + j * 9), hl = ln.hl ? tw(f, at + 24 + j * 9, at + 40 + j * 9) : 0; return <div key={j} style={{ opacity: a, position: "relative", marginBottom: 6 }}><span style={{ position: "absolute", left: -6, right: -6, top: "12%", bottom: "6%", background: T.accent2, opacity: 0.8, transform: `scaleX(${hl})`, transformOrigin: "left", zIndex: 0 }} /><span style={{ position: "relative", zIndex: 1 }}>{ln.t}</span></div>; })}
    </div></Live>;
  }
  if (k === "bar") { const g = tw(f, at + 4, at + 4 + (L.dur || 24)); return <Live {...live} from="none" style={{}}><div style={{ width: w, height: h, background: L.track || T.paper2, borderRadius: h / 2, overflow: "hidden", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.12)" }}><div style={{ width: `${Math.max(0.5, L.value * g * 100)}%`, height: "100%", background: L.c || T.accent, borderRadius: h / 2 }} /></div></Live>; }
  if (k === "badge") { const sc = 0.4 + 0.6 * tw(f, at, at + 14, back); return <Live {...live} from="none" style={{ filter: sh(T, 0.7) }}><div style={{ width: w, height: h, transform: `scale(${sc}) rotate(${(1 - sc) * 40}deg)`, background: L.c || T.accent, clipPath: L.star === false ? undefined : "polygon(50% 0,61% 14%,79% 9%,81% 27%,98% 33%,88% 49%,98% 66%,80% 72%,79% 91%,61% 85%,50% 100%,39% 85%,21% 91%,20% 72%,2% 66%,12% 49%,2% 33%,19% 27%,21% 9%,39% 14%)", borderRadius: L.star === false ? "50%" : 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: T.label, fontWeight: 800, fontSize: L.size || 38, color: L.color || "#fff", lineHeight: 1, padding: 24, boxSizing: "border-box", textTransform: "uppercase" }}>{L.text}</div></Live>;
  }
  return null;
}

/** Strings between pins (case theme) or ribbons (mag): drawn on, never swaying, over the layers they join. */
export function Strings({ th, list }) {
  const f = useCurrentFrame(), T = THEMES[th];
  return <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, zIndex: 900, pointerEvents: "none" }}>{list.map((s, i) => { const p = tw(f, s.at, s.at + 18, Easing.inOut(Easing.cubic)), mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2 + (s.sag ?? 40); return (<g key={i}>
    <path d={`M${s.x1},${s.y1} Q${mx},${my} ${s.x2},${s.y2}`} fill="none" stroke={s.c || T.accent} strokeWidth={s.w || 5} strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} style={{ filter: "drop-shadow(2px 3px 2px rgba(0,0,0,0.3))" }} />
    {[[s.x1, s.y1], [s.x2, s.y2]].map(([cx, cy], j) => <g key={j} opacity={Math.min(1, p * 4)}><circle cx={cx + 2} cy={cy + 3} r="13" fill="rgba(0,0,0,0.25)" /><circle cx={cx} cy={cy} r="13" fill={s.pin || "#D8423A"} /><circle cx={cx - 4} cy={cy - 4} r="4" fill="rgba(255,255,255,0.7)" /></g>)}</g>); })}</svg>;
}
/** Rough pen circle around the evidence. */
export function Pen({ cx, cy, rx, ry, at, c = "#C62828" }) {
  const f = useCurrentFrame(), p = tw(f, at, at + 22, Easing.linear), pts = [];
  for (let a = 0; a <= 400; a += 10) { const t = (a * Math.PI) / 180; pts.push(`${(cx + Math.cos(t) * rx * (1 + a / 3500)).toFixed(1)},${(cy + Math.sin(t) * ry * (1 + 0.03 * Math.sin(a * 0.1))).toFixed(1)}`); }
  return <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, zIndex: 950 }}><polyline points={pts.join(" ")} fill="none" stroke={c} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} /></svg>;
}

/** Scene fade + the layers. */
export function Collage({ th, layers, strings = [], pens = [], dur, ground = {} }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(f, [0, 4, dur - 4, dur], [0, 1, 1, 0], clamp) }}><Ground th={th} {...ground} />{layers.map((L, i) => <Layer key={i} th={th} L={L} i={i} />)}<Strings th={th} list={strings} />{pens.map((p, i) => <Pen key={i} {...p} />)}</AbsoluteFill>;
}

/** Captions: a label-maker strip (case) or a bright pill with a highlighted current word (mag). */
export function Caps({ th, captions }) {
  const f = useCurrentFrame(), T = THEMES[th], c = captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  const words = c.words || [{ text: c.text, from: c.from }];
  return <div style={abs(50, 1610, 980, 230, { zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" })}><div style={{ background: th === "case" ? "rgba(26,18,12,0.88)" : "rgba(255,255,255,0.94)", borderRadius: th === "case" ? 4 : 28, padding: "20px 34px", boxShadow: "0 8px 0 rgba(0,0,0,0.18)", transform: "rotate(-0.6deg)", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 14px", fontFamily: T.label, fontWeight: 700, fontSize: 58, lineHeight: 1.12, textAlign: "center" }}>{words.map((w, i, arr) => { const on = f >= w.from && (i === arr.length - 1 || f < arr[i + 1].from); return <span key={i} style={{ color: th === "case" ? (on ? T.accent2 : "#EDE3CC") : T.ink, background: th !== "case" && on ? (T.pop ? (th === "sport" ? "#EDBB00" : T.accent2) : T.accent2) : "transparent", borderRadius: 8, padding: "0 6px", opacity: f >= w.from ? 1 : 0.4 }}>{w.text}</span>; })}</div></div>;
}
