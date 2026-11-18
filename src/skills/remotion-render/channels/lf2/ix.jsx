// Rival Lines "paper" kit: the football explainer look measured from intrcpt gp4cftwGLcQ (docs: channel-reverse/spec/CLONE-SPEC.md).
// What is copied is the FORMULA, not their art: cream paper background with a serif headline, one animated diagram per idea, evidence cards for
// every cited study, framed footage windows with a soft shadow, and a background swap per section (cream = idea, navy = data, green = verdict).
// Our own palette (config/longform-v2.json rival-lines.ix), our own tagline, our own charts. No broadcast clips: footage windows take free-licence clips only.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { F, Fonts, clamp, eo, expo, lerp, ramp } from "./kit.jsx";

const SERIF = F.display;           // Playfair Display: the high-contrast serif headline
const src = (p) => (p.startsWith("data:") || p.startsWith("http") ? p : staticFile(p));
const fmt = (v, d = 0) => v.toFixed(d);
/** Colours come from the theme (config/longform-v2.json rival-lines.ix): scenes name a tone ("home", "away", "draw", "accent") instead of a hex. */
const col = (t, c, bg) => { const k = (c && t.ix[c]) || c || t.ix.accent; return bg && bg !== "cream" && c === "away" ? "#E9E4D6" : k; };   // "away" is near-black: on navy/green it must be light or it vanishes

/** Paper background. bg: cream | navy | green. A fixed grain (SVG turbulence, no animation) keeps it from looking like a flat fill. */
function Paper({ t, bg = "cream", children }) {
  const c = t.ix, base = bg === "navy" ? c.navy : bg === "green" ? c.green : c.cream;
  return (
    <AbsoluteFill style={{ background: base, color: bg === "cream" ? c.ink : "#F5F2EA" }}>
      <Fonts />
      <AbsoluteFill style={{ background: bg === "cream" ? `radial-gradient(120% 90% at 50% 40%, ${c.cream} 40%, ${c.cream2} 100%)` : "none" }} />
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, opacity: bg === "cream" ? 0.07 : 0.1, mixBlendMode: "multiply", pointerEvents: "none" }}>
        <filter id="pn"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="1920" height="1080" filter="url(#pn)" />
      </svg>
      {children}
    </AbsoluteFill>
  );
}
const ink = (t, bg) => (bg === "cream" ? t.ix.ink : "#F5F2EA");
const mute = (t, bg) => (bg === "cream" ? t.ix.mute : "rgba(245,242,234,0.62)");
/** Small mark, top-left, on every scene (their tiny logo mark; ours is the channel name). */
const Mark = ({ t, bg }) => <div style={{ position: "absolute", left: 56, top: 38, fontFamily: SERIF, fontStyle: "italic", fontSize: 30, color: mute(t, bg) }}>rival lines</div>;
const Source = ({ t, bg, text }) => text ? <div style={{ position: "absolute", left: 56, bottom: 34, right: 56, fontFamily: F.sans, fontSize: 21, color: mute(t, bg) }}>{text}</div> : null;
/** Headline: lowercase serif with one bold word, the thumbnail's type carried into the video. */
const Head = ({ t, bg, text, bold, size = 74, top = 96, from = 0 }) => {
  const f = useCurrentFrame(), a = ramp(f, from, from + 14, expo);
  const parts = text.split(bold ? new RegExp(`(${bold})`) : /$^/);
  return <div style={{ position: "absolute", left: 90, right: 90, top, fontFamily: SERIF, fontSize: size, lineHeight: 1.08, color: ink(t, bg), opacity: a, transform: `translateY(${(1 - a) * 22}px)` }}>
    {parts.map((p, i) => <span key={i} style={{ fontWeight: bold && p === bold ? 800 : 400 }}>{p}</span>)}
  </div>;
};

/** Title / chapter card. */
export function IxTitle({ t, bg = "cream", line, sub, num }) {
  const f = useCurrentFrame(), a = ramp(f, 4, 22, expo);
  return <Paper t={t} bg={bg}>
    {num != null && <div style={{ position: "absolute", left: 140, top: 330, fontFamily: SERIF, fontSize: 200, fontStyle: "italic", opacity: 0.22 * a, color: ink(t, bg) }}>{String(num).padStart(2, "0")}</div>}
    <div style={{ position: "absolute", left: 140, right: 140, top: 420, fontFamily: SERIF, fontSize: 112, lineHeight: 1.04, opacity: a, transform: `translateY(${(1 - a) * 30}px)`, color: ink(t, bg) }}>{line}</div>
    {sub && <div style={{ position: "absolute", left: 144, top: 420 + 250, fontFamily: F.sans, fontSize: 34, color: mute(t, bg), opacity: ramp(f, 16, 32) }}>{sub}</div>}
    <Mark t={t} bg={bg} />
  </Paper>;
}

/** One big number that counts up (the stat opener). value counts from `from`; label sits above, sub below. */
export function IxStat({ t, bg = "cream", value, from = 0, decimals = 0, prefix = "", suffix = "", label, sub, source, accent }) {
  const f = useCurrentFrame(), k = ramp(f, 6, 54, expo), v = from + (value - from) * k, c = t.ix;
  return <Paper t={t} bg={bg}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 190, textAlign: "center", fontFamily: F.sans, fontSize: 40, letterSpacing: "0.04em", color: mute(t, bg), opacity: ramp(f, 0, 12) }}>{label}</div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 270, textAlign: "center", fontFamily: SERIF, fontWeight: 800, fontSize: 380, lineHeight: 1, color: accent ? c.accent : ink(t, bg), transform: `scale(${lerp(f, 0, 40, 0.94, 1)})` }}>{prefix}{fmt(v, decimals)}{suffix}</div>
    {sub && <div style={{ position: "absolute", left: 160, right: 160, top: 720, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 54, lineHeight: 1.2, color: ink(t, bg), opacity: ramp(f, 44, 62) }}>{sub}</div>}
    <Mark t={t} bg={bg} /><Source t={t} bg={bg} text={source} />
  </Paper>;
}

/** Animated line chart. xs: category labels. series: [{ name, color, vals, dash? }]. mark: { from, to, label } index band. callouts: [{ i, s (series index), text, at (frame) }]. */
export function IxLine({ t, bg = "cream", title, bold, xs, series, ymin, ymax, unit = "%", mark, callouts = [], source, draw = 90, xstep = 4 }) {
  const f = useCurrentFrame(), c = t.ix, X0 = 200, X1 = 1560, Y0 = 330, Y1 = 900, n = xs.length;
  const px = (i) => X0 + ((X1 - X0) * i) / (n - 1), py = (v) => Y1 - ((Y1 - Y0) * (v - ymin)) / (ymax - ymin);
  const prog = ramp(f, 12, 12 + draw, eo), upto = prog * (n - 1);
  const ticks = []; for (let v = Math.ceil(ymin / 10) * 10; v <= ymax; v += 10) ticks.push(v);
  const pathFor = (vals) => { let d = ""; for (let i = 0; i < n; i++) { if (i > upto) { const fr = upto - (i - 1); if (fr > 0 && i - 1 <= upto) { const x = px(i - 1) + (px(i) - px(i - 1)) * fr, y = py(vals[i - 1]) + (py(vals[i]) - py(vals[i - 1])) * fr; d += ` L${x.toFixed(1)} ${y.toFixed(1)}`; } break; } d += `${i ? " L" : "M"}${px(i).toFixed(1)} ${py(vals[i]).toFixed(1)}`; } return d; };
  const tip = (s) => { const i = Math.min(n - 1, Math.floor(upto)), fr = Math.min(1, upto - i), j = Math.min(n - 1, i + 1); return [px(i) + (px(j) - px(i)) * fr, py(s.vals[i] + (s.vals[j] - s.vals[i]) * fr)]; };
  return <Paper t={t} bg={bg}>
    <Head t={t} bg={bg} text={title} bold={bold} />
    <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
      {mark && <rect x={px(mark.from) - 14} y={Y0 - 20} width={px(mark.to) - px(mark.from) + 28} height={Y1 - Y0 + 20} fill={c.accent} opacity={0.14 * ramp(f, 30, 50)} />}
      {ticks.map((v) => <g key={v}><line x1={X0} x2={X1} y1={py(v)} y2={py(v)} stroke={mute(t, bg)} strokeWidth={1} opacity={0.35} /><text x={X0 - 18} y={py(v) + 8} textAnchor="end" fontFamily={F.sans} fontSize={24} fill={mute(t, bg)}>{v}{unit}</text></g>)}
      {xs.map((x, i) => i % xstep === 0 && <text key={i} x={px(i)} y={Y1 + 44} textAnchor="middle" fontFamily={F.sans} fontSize={22} fill={mute(t, bg)}>{x}</text>)}
      {series.map((s, k) => { const [tx, ty] = tip(s); return <g key={k}>
        <path d={pathFor(s.vals)} fill="none" stroke={col(t, s.color, bg)} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dash || undefined} />
        <circle cx={tx} cy={ty} r={9} fill={col(t, s.color, bg)} />
        <text x={tx + 18} y={ty + 8} fontFamily={F.sans} fontWeight={700} fontSize={28} fill={col(t, s.color, bg)} opacity={ramp(f, 20, 34)}>{s.name}</text></g>; })}
    </svg>
    {mark && <div style={{ position: "absolute", left: px(mark.from) - 14, top: Y0 - 62, fontFamily: F.sans, fontWeight: 700, fontSize: 26, color: c.accent, opacity: ramp(f, 36, 52) }}>{mark.label}</div>}
    {callouts.map((co, i) => { const a = ramp(f, co.at, co.at + 12, expo), x = px(co.i); return <div key={i} style={{ position: "absolute", left: Math.max(120, x - 470), top: Y0 - 128, width: 440, textAlign: "right", fontFamily: SERIF, fontStyle: "italic", fontSize: 34, lineHeight: 1.18, color: ink(t, bg), opacity: a, transform: `translateY(${(1 - a) * 12}px)` }}>{co.text}</div>; })}
    <Mark t={t} bg={bg} /><Source t={t} bg={bg} text={source} />
  </Paper>;
}

/** Horizontal bars that grow in turn. items: [{ label, value, color, sub }]; max sets the scale. */
export function IxBars({ t, bg = "cream", title, bold, items, max = 100, unit = "%", decimals = 1, source }) {
  const f = useCurrentFrame(), W = 1100, top = 330, gap = Math.min(150, 520 / items.length);
  return <Paper t={t} bg={bg}>
    <Head t={t} bg={bg} text={title} bold={bold} />
    {items.map((it, i) => { const k = ramp(f, 10 + i * 12, 46 + i * 12, expo), y = top + i * gap; return <div key={i}>
      <div style={{ position: "absolute", left: 90, top: y + 10, width: 400, textAlign: "right", fontFamily: F.sans, fontSize: 34, fontWeight: 600, color: ink(t, bg) }}>{it.label}{it.sub && <div style={{ fontWeight: 400, fontSize: 22, color: mute(t, bg) }}>{it.sub}</div>}</div>
      <div style={{ position: "absolute", left: 520, top: y, height: gap * 0.62, width: (W * it.value / max) * k, background: col(t, it.color, bg), borderRadius: 4 }} />
      <div style={{ position: "absolute", left: 520 + (W * it.value / max) * k + 18, top: y + 6, fontFamily: SERIF, fontWeight: 800, fontSize: 58, color: ink(t, bg), opacity: ramp(f, 20 + i * 12, 34 + i * 12) }}>{fmt(it.value * k, decimals)}{unit}</div>
    </div>; })}
    <Mark t={t} bg={bg} /><Source t={t} bg={bg} text={source} />
  </Paper>;
}

/** 10x10 dot grid: "out of 100 matches". groups: [{ n, color, label }] fill in order, one dot every frame or so. */
export function IxDots({ t, bg = "cream", title, bold, groups, source, sub }) {
  const f = useCurrentFrame(), dots = []; groups.forEach((g, gi) => { for (let k = 0; k < g.n; k++) dots.push({ gi, color: col(t, g.color, bg) }); });
  const shown = Math.floor(ramp(f, 8, 8 + dots.length * 0.9, eo) * dots.length), R = 30, G = 76, X0 = 190, Y0 = 330;
  return <Paper t={t} bg={bg}>
    <Head t={t} bg={bg} text={title} bold={bold} />
    <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
      {dots.map((d, i) => <circle key={i} cx={X0 + (i % 10) * G} cy={Y0 + Math.floor(i / 10) * (G - 6)} r={i < shown ? R : 6} fill={i < shown ? d.color : mute(t, bg)} opacity={i < shown ? 1 : 0.25} />)}
    </svg>
    <div style={{ position: "absolute", left: 1080, top: 340, width: 680 }}>
      {groups.map((g, i) => { const a = ramp(f, 30 + i * 22, 44 + i * 22); return <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 22, marginBottom: 34, opacity: a }}>
        <span style={{ width: 34, height: 34, borderRadius: 17, background: col(t, g.color), display: "inline-block", transform: "translateY(4px)" }} />
        <span style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 96, color: ink(t, bg) }}>{g.n}</span>
        <span style={{ fontFamily: F.sans, fontSize: 36, color: ink(t, bg) }}>{g.label}</span></div>; })}
      {sub && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 36, color: mute(t, bg), marginTop: 10, opacity: ramp(f, 100, 120) }}>{sub}</div>}
    </div>
    <Mark t={t} bg={bg} /><Source t={t} bg={bg} text={source} />
  </Paper>;
}

/** Evidence card: a cited study as a paper card (their channel shows article screenshots for every source). The abstract is quoted verbatim from the
 *  retrieved record; text between [[ ]] is marked with a highlighter sweep. */
export function IxCard({ t, bg = "cream", journal, title, authors, abstract, doi, via, side }) {
  const f = useCurrentFrame(), c = t.ix, a = ramp(f, 4, 24, expo);
  const parts = abstract.split(/(\[\[.*?\]\])/g);
  let hi = 0;
  return <Paper t={t} bg={bg}>
    <div style={{ position: "absolute", left: 190, top: 150, width: 1540, background: "#FFFDF8", color: "#1b1712", padding: "64px 84px 56px", borderRadius: 6, boxShadow: "0 30px 70px rgba(0,0,0,0.28)", opacity: a, transform: `translateY(${(1 - a) * 40}px) rotate(${lerp(f, 0, 30, -1.6, -0.4)}deg)` }}>
      <div style={{ fontFamily: F.sans, fontSize: 24, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6a6255" }}>{journal}</div>
      <div style={{ fontFamily: SERIF, fontSize: 60, fontWeight: 700, lineHeight: 1.14, marginTop: 16 }}>{title}</div>
      <div style={{ fontFamily: F.sans, fontSize: 30, color: "#6a6255", marginTop: 16 }}>{authors}</div>
      <div style={{ fontFamily: F.serif, fontSize: 38, lineHeight: 1.45, marginTop: 34 }}>
        {parts.map((p, i) => { if (!p.startsWith("[[")) return <span key={i}>{p}</span>; const k = ramp(f, 34 + hi * 26, 56 + hi * 26); hi++; return <span key={i} style={{ background: `linear-gradient(90deg, ${c.marker} ${k * 100}%, transparent ${k * 100}%)`, padding: "0 4px" }}>{p.slice(2, -2)}</span>; })}
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 20, color: "#8a8174", marginTop: 26 }}>{doi}{via ? `  ·  abstract as retrieved from ${via}` : ""}</div>
    </div>
    {side && <div style={{ position: "absolute", left: 90, right: 90, bottom: 60, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 44, color: ink(t, bg), opacity: ramp(f, 70, 90) }}>{side}</div>}
    <Mark t={t} bg={bg} />
  </Paper>;
}

/** Framed footage window on paper, with a big serif line beside it (their drop-shadow window device). Free-licence clips only; credit drawn under the window. */
export function IxClip({ t, bg = "cream", video, image, ss = 0, head, bold, body, credit, flip }) {
  const f = useCurrentFrame(), a = ramp(f, 2, 20, expo), z = lerp(f, 0, 240, 1.0, 1.1, (x) => x);
  const win = { position: "absolute", [flip ? "left" : "right"]: 90, top: 150, width: 1040, height: 640, borderRadius: 22, overflow: "hidden", boxShadow: "0 36px 80px rgba(0,0,0,0.34)", opacity: a, transform: `translateY(${(1 - a) * 30}px)` };
  return <Paper t={t} bg={bg}>
    <div style={win}>
      {video ? <OffthreadVideo src={src(video)} muted startFrom={Math.round(ss * 30)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` }} /> : <Img src={src(image)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` }} />}
    </div>
    <div style={{ position: "absolute", [flip ? "left" : "right"]: 90, top: 810, width: 1040, fontFamily: F.sans, fontSize: 20, color: mute(t, bg) }}>{credit}</div>
    <div style={{ position: "absolute", [flip ? "right" : "left"]: 90, top: 250, width: 640 }}>
      <Head t={t} bg={bg} text={head} bold={bold} size={72} top={0} />
      {body && <div style={{ position: "absolute", top: 330, width: 640, fontFamily: F.sans, fontSize: 32, lineHeight: 1.4, color: mute(t, bg), opacity: ramp(f, 24, 44) }}>{body}</div>}
    </div>
    <Mark t={t} bg={bg} />
  </Paper>;
}

/** Statement card for a verdict or a hinge line. */
export function IxQuote({ t, bg = "cream", text, bold, sub, source }) {
  const f = useCurrentFrame();
  return <Paper t={t} bg={bg}>
    <div style={{ position: "absolute", left: 160, right: 160, top: 300 }}><Head t={t} bg={bg} text={text} bold={bold} size={104} top={0} /></div>
    {sub && <div style={{ position: "absolute", left: 164, right: 200, top: 740, fontFamily: F.sans, fontSize: 38, lineHeight: 1.35, color: mute(t, bg), opacity: ramp(f, 30, 50) }}>{sub}</div>}
    <Mark t={t} bg={bg} /><Source t={t} bg={bg} text={source} />
  </Paper>;
}


/** Thumbnail in the channel's measured thumbnail formula (5 of 5 reference hits): paper gradient, lowercase serif headline with one bold word, one real photo with a soft
 *  edge, a hand-drawn red arrow to the subject, a tiny mark top-left and a small italic aside. Rendered at frame 0, exported 1280x720. */
export function IxThumb({ t, headline, bold, aside, image, credit, arrow = { x1: 640, y1: 350, x2: 900, y2: 520 }, imagePos = "50% 50%" }) {
  const c = t.ix, parts = headline.split(bold ? new RegExp(`(${bold})`) : /$^/);
  const a = arrow, mx = (a.x1 + a.x2) / 2 - 80, my = (a.y1 + a.y2) / 2 - 110;
  return <AbsoluteFill style={{ background: `radial-gradient(90% 110% at 30% 20%, #FFFFFF 0%, ${c.cream} 55%, ${c.cream2} 100%)` }}>
    <Fonts />
    <div style={{ position: "absolute", left: 60, top: 36, fontFamily: SERIF, fontStyle: "italic", fontSize: 40, color: c.mute }}>rival lines</div>
    <div style={{ position: "absolute", left: 80, top: 100, right: 80, fontFamily: SERIF, fontSize: 196, lineHeight: 1.0, color: c.ink, whiteSpace: "nowrap" }}>
      {parts.map((p, i) => <span key={i} style={{ fontWeight: bold && p === bold ? 800 : 400 }}>{p}</span>)}
    </div>
    {aside && <div style={{ position: "absolute", left: 96, top: 335, fontFamily: SERIF, fontStyle: "italic", fontSize: 62, color: c.mute }}>{aside}</div>}
    <div style={{ position: "absolute", left: 360, right: 0, bottom: 0, height: 700, WebkitMaskImage: "radial-gradient(ellipse 62% 70% at 55% 60%, #000 55%, transparent 100%)", maskImage: "radial-gradient(ellipse 62% 70% at 55% 60%, #000 55%, transparent 100%)" }}>
      <Img src={src(image)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: imagePos }} />
    </div>
    <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
      <path d={`M${a.x1} ${a.y1} Q${mx} ${my} ${a.x2} ${a.y2}`} fill="none" stroke={c.arrow} strokeWidth={14} strokeLinecap="round" />
      <path d={`M${a.x2 - 58} ${a.y2 - 4} L${a.x2} ${a.y2} L${a.x2 - 12} ${a.y2 - 62}`} fill="none" stroke={c.arrow} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    {credit && <div style={{ position: "absolute", right: 14, bottom: 8, fontFamily: F.sans, fontSize: 15, color: "rgba(0,0,0,0.45)" }}>{credit}</div>}
  </AbsoluteFill>;
}

export const IX = { ixthumb: IxThumb, ixtitle: IxTitle, ixstat: IxStat, ixline: IxLine, ixbars: IxBars, ixdots: IxDots, ixcard: IxCard, ixclip: IxClip, ixquote: IxQuote };
