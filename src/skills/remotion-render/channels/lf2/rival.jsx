// Rival Lines long form v2. Built from Football Made Simple (N8PZt_9_adI, KC2Vgjw282s, Nx8h403Sj_s, oZaPKaIVIA0, Dki5tjN0rDE):
// dark vignetted pitch seen at a tilt, team-coloured dots, big-number opener, scoreline card reused as the minute marker, one capital
// callout per moment, a "COMING UP" tag, a timeline spine. Difference from the references, stated: they cut to broadcast footage we do not
// hold rights to, so the proof layer here is the match's own event data (StatsBomb open data) animated on the pitch.
// The pitch is a real 3D plane: every point is projected through a camera (focus, yaw, tilt, distance) that can move per frame.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { F, Fonts, Finish, clamp, eio, eo, expo, lerp, ramp } from "./kit.jsx";

const L = 120, Wd = 80;
/** Camera keyframes -> camera at frame. cam: [{ f, fx, fy, yaw (deg), tilt (deg, 0 = top-down), dist, scale }] */
function camAt(cams, frame) {
  if (!Array.isArray(cams)) return cams;
  let i = 0; while (i < cams.length - 2 && frame > cams[i + 1].f) i++;
  const a = cams[i], b = cams[Math.min(i + 1, cams.length - 1)], t = a === b ? 0 : interpolate(frame, [a.f, b.f], [0, 1], { ...clamp, easing: eio }), m = (k, d) => (a[k] ?? d) + ((b[k] ?? d) - (a[k] ?? d)) * t;
  return { fx: m("fx", 60), fy: m("fy", 40), yaw: m("yaw", 0), tilt: m("tilt", 38), dist: m("dist", 170), scale: m("scale", 12.5), cx: m("cx", 960), cy: m("cy", 560) };
}
const projector = (c) => (x, y, z = 0) => {
  const px = x - c.fx, py = (Wd - y) - (Wd - c.fy), a = (c.yaw * Math.PI) / 180, t = (c.tilt * Math.PI) / 180;
  const xr = px * Math.cos(a) - py * Math.sin(a), yr = px * Math.sin(a) + py * Math.cos(a), k = c.dist / (c.dist + yr * Math.sin(t));
  return [c.cx + c.scale * xr * k, c.cy - c.scale * (yr * Math.cos(t) + z * Math.sin(t)) * k, k];
};
const path = (P, pts, close) => pts.map(([x, y], i) => { const [sx, sy] = P(x, y); return `${i ? "L" : "M"}${sx.toFixed(1)} ${sy.toFixed(1)}`; }).join(" ") + (close ? " Z" : "");
const arc = (cx, cy, r, a0, a1, n = 28) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

/** The pitch plane: turf bands, markings, vignette. Children get the projector via render prop. */
export function Pitch({ cam, t, children, dim = 0, reveal = 1 }) {
  const f = useCurrentFrame(), c = camAt(cam, f), P = projector(c);
  const line = { stroke: t.line, strokeWidth: 2.6, fill: "none", strokeLinejoin: "round", opacity: 0.92 * reveal };
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const bands = Array.from({ length: 12 }, (_, i) => rect(i * 10, 0, i * 10 + 10, 80));
  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <Fonts />
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
        <defs><radialGradient id="pv" cx="50%" cy="48%" r="62%"><stop offset="0%" stopColor="#000" stopOpacity="0" /><stop offset="62%" stopColor="#000" stopOpacity="0.12" /><stop offset="100%" stopColor="#000" stopOpacity="0.9" /></radialGradient></defs>
        {bands.map((b, i) => <path key={i} d={path(P, b, true)} fill={i % 2 ? t.turfA : t.turfB} />)}
        <g {...line}>
          <path d={path(P, rect(0, 0, 120, 80), true)} /><path d={path(P, [[60, 0], [60, 80]])} /><path d={path(P, arc(60, 40, 10, 0, Math.PI * 2, 56), true)} />
          <path d={path(P, [[0, 18], [18, 18], [18, 62], [0, 62]])} /><path d={path(P, [[120, 18], [102, 18], [102, 62], [120, 62]])} />
          <path d={path(P, [[0, 30], [6, 30], [6, 50], [0, 50]])} /><path d={path(P, [[120, 30], [114, 30], [114, 50], [120, 50]])} />
          <path d={path(P, arc(12, 40, 10, -0.93, 0.93))} /><path d={path(P, arc(108, 40, 10, Math.PI - 0.93, Math.PI + 0.93))} />
          <path d={path(P, [[0, 36], [-2.2, 36], [-2.2, 44], [0, 44]])} strokeWidth="3.5" /><path d={path(P, [[120, 36], [122.2, 36], [122.2, 44], [120, 44]])} strokeWidth="3.5" />
        </g>
        {[[12, 40], [108, 40], [60, 40]].map(([x, y], i) => { const [sx, sy] = P(x, y); return <circle key={i} cx={sx} cy={sy} r="3.2" fill={t.line} opacity={reveal} />; })}
        {typeof children === "function" ? children(P, c) : children}
        <rect width="1920" height="1080" fill="url(#pv)" />
        {dim > 0 && <rect width="1920" height="1080" fill="#000" opacity={dim} />}
      </svg>
    </AbsoluteFill>
  );
}

/** One player dot: ellipse shadow on the turf, team disc, optional number and name tag. Sized by depth. */
function Dot({ P, x, y, team, t, num, name, hi, op = 1, r = 15, keeper }) {
  const [sx, sy, k] = P(x, y), col = t.teams[team] || { fill: "#888", ring: "#fff", ink: "#fff" }, R = r * k * (hi ? 1.18 : 1);
  return (
    <g opacity={op}>
      <ellipse cx={sx} cy={sy + R * 0.55} rx={R * 1.05} ry={R * 0.42} fill="#000" opacity="0.5" />
      {hi && <circle cx={sx} cy={sy} r={R + 9} fill="none" stroke={t.accent} strokeWidth="3.5" />}
      <circle cx={sx} cy={sy} r={R} fill={keeper ? t.keeper : col.fill} stroke={col.ring} strokeWidth={3 * k} />
      {num != null && <text x={sx} y={sy + R * 0.36} textAnchor="middle" fontFamily={F.cond} fontWeight="700" fontSize={R * 1.02} fill={col.ink}>{num}</text>}
      {name && <g><rect x={sx - name.length * 6.6 - 10} y={sy - R - 38} width={name.length * 13.2 + 20} height="28" rx="3" fill={hi ? t.accent : "rgba(8,10,12,0.82)"} /><text x={sx} y={sy - R - 18} textAnchor="middle" fontFamily={F.cond} fontWeight="700" fontSize="20" letterSpacing="1.5" fill={hi ? "#0a0a0a" : "#fff"}>{name.toUpperCase()}</text></g>}
    </g>
  );
}

// Any team other than Spain/England gets a plain club disc (theme colours + initials) instead of the England flag (added for club stories, 14 Nov 2026).
const ClubDisc = ({ team, x, y, s, t }) => { const c = (t && t.teams && t.teams[team]) || { fill: "#444", ring: "#ddd", ink: "#fff" }, ini = team.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return <g transform={`translate(${x},${y})`}><circle cx={s / 2} cy={s / 2} r={s / 2} fill={c.fill} /><circle cx={s / 2} cy={s / 2} r={s / 2 - 8} fill="none" stroke={c.ring} strokeWidth="6" /><text x={s / 2} y={s / 2 + s * 0.14} textAnchor="middle" fontFamily="Oswald, Impact, sans-serif" fontWeight="700" fontSize={s * 0.38} fill={c.ink}>{ini}</text></g>; };
const Flag = ({ team, x, y, s = 150, t }) => team !== "Spain" && team !== "England" ? <ClubDisc team={team} x={x} y={y} s={s} t={t} /> : team === "Spain"
  ? <g transform={`translate(${x},${y})`}><clipPath id="fs"><circle cx={s / 2} cy={s / 2} r={s / 2} /></clipPath><g clipPath="url(#fs)"><rect width={s} height={s} fill="#AA151B" /><rect y={s / 4} width={s} height={s / 2} fill="#F1BF00" /></g><circle cx={s / 2} cy={s / 2} r={s / 2} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="3" /></g>
  : <g transform={`translate(${x},${y})`}><clipPath id="fe"><circle cx={s / 2} cy={s / 2} r={s / 2} /></clipPath><g clipPath="url(#fe)"><rect width={s} height={s} fill="#fff" /><rect x={s * 0.42} width={s * 0.16} height={s} fill="#CE1124" /><rect y={s * 0.42} width={s} height={s * 0.16} fill="#CE1124" /></g><circle cx={s / 2} cy={s / 2} r={s / 2} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="3" /></g>;

/** Bottom-right "COMING UP..." tag and data credit, as in KC2Vgjw282s / Nx8h403Sj_s. */
function Tags({ t, coming, credit, note }) {
  const f = useCurrentFrame();
  return (<>
    {coming && <div style={{ position: "absolute", right: 70, bottom: 86, fontFamily: F.cond, fontWeight: 700, fontSize: 34, letterSpacing: "0.14em", color: "#fff", opacity: ramp(f, 6, 18) * (0.72 + 0.28 * Math.sin(f / 5)) }}>{coming}</div>}
    <div style={{ position: "absolute", left: 40, bottom: 26, fontFamily: F.sans, fontSize: 16, color: "rgba(255,255,255,0.55)" }}>{credit || (t && t.credit) || "Data: StatsBomb open data"}{note ? ` · ${note}` : ""}</div>
  </>);
}
/** Capital callout on the grass with an accent bar (one per moment). */
function Callout({ t, text, x = 110, y = 880, from = 0, size = 58 }) {
  const f = useCurrentFrame(), a = ramp(f, from, from + 12, expo);
  return <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "stretch", gap: 18, opacity: a, transform: `translateX(${(1 - a) * -40}px)` }}><div style={{ width: 8, background: t.accent }} /><div style={{ fontFamily: F.cond, fontWeight: 700, fontSize: size, lineHeight: 1.05, letterSpacing: "0.02em", color: "#fff", textTransform: "uppercase", whiteSpace: "pre-line", textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>{text}</div></div>;
}

/** Section-coded looks, the system the reference uses (teal with white line art, cream paper with grain, plum with pale pitch lines); our own colours, drawings and type.
 * Type is a high-contrast serif everywhere (Playfair Display), bold for titles and numbers, italic lower-case for labels, as in the reference. */
const PAL = {
  dark: { bg: "radial-gradient(80% 80% at 50% 40%, #17191c 0%, #08090a 75%)", fg: "#fff", mute: "rgba(255,255,255,0.7)", faint: "rgba(255,255,255,0.5)", track: "rgba(255,255,255,0.07)", tile: "rgba(255,255,255,0.05)", a: "#C8F04B", b: "#C9CED8", bad: "#E8323F", ink: "#0a0a0a", grain: 0.05, grid: false, seal: false },
  paper: { bg: "radial-gradient(90% 90% at 50% 40%, #EDE9DC 0%, #DAD5C4 100%)", fg: "#17161B", mute: "rgba(23,22,27,0.7)", faint: "rgba(23,22,27,0.5)", track: "rgba(23,22,27,0.10)", tile: "rgba(23,22,27,0.05)", a: "#E0158F", b: "#2B2A33", bad: "#B3202A", ink: "#fff", grain: 0.16, grid: false, seal: true },
  teal: { bg: "radial-gradient(85% 85% at 50% 40%, #0F4A44 0%, #062A27 85%)", fg: "#fff", mute: "rgba(255,255,255,0.8)", faint: "rgba(255,255,255,0.55)", track: "rgba(255,255,255,0.12)", tile: "rgba(255,255,255,0.07)", a: "#B9A2FF", b: "#CFE6E0", bad: "#FF8A8A", ink: "#0a1a18", grain: 0.07, grid: true, seal: false },
  plum: { bg: "radial-gradient(85% 85% at 50% 40%, #6B0F4A 0%, #3F0830 85%)", fg: "#fff", mute: "rgba(255,255,255,0.82)", faint: "rgba(255,200,235,0.6)", track: "rgba(255,255,255,0.14)", tile: "rgba(255,255,255,0.09)", a: "#FFC2E6", b: "#E8D5E2", bad: "#FFD166", ink: "#2a0820", grain: 0.07, grid: false, seal: false, pitch: true },
};
PAL.green = PAL.teal;
const pal = (v) => PAL[v] || PAL.dark;
const SER = F.display;
const isCaps = (s) => String(s) === String(s).toUpperCase();
const sentence = (s) => (isCaps(s) ? String(s).toLowerCase().replace(/^\s*\S/, (c) => c.toUpperCase()) : String(s));
const titleCase = (s) => (isCaps(s) ? String(s).toLowerCase().replace(/(^|[\s(·])(\S)/g, (m, a, c) => a + c.toUpperCase()) : String(s));

/** The look's backdrop: gradient, optional lattice (teal), optional faint seal (paper), optional pale pitch lines (plum), film grain. */
function Backdrop({ v, children }) {
  const P = pal(v);
  return (
    <AbsoluteFill style={{ background: v ? P.bg : "#000", fontVariantNumeric: "lining-nums" }}><Fonts /><style>{"*{font-variant-numeric:lining-nums;font-feature-settings:\"lnum\" 1}"}</style>
      {P.grid && <svg width="1920" height="1080" style={{ position: "absolute", opacity: 0.18 }}>{Array.from({ length: 33 }, (_, i) => <line key={"v" + i} x1={i * 60} y1="0" x2={i * 60} y2="1080" stroke="#fff" strokeWidth="1" />)}{Array.from({ length: 19 }, (_, i) => <line key={"h" + i} x1="0" y1={i * 60} x2="1920" y2={i * 60} stroke="#fff" strokeWidth="1" />)}</svg>}
      {P.seal && <svg width="1920" height="1080" style={{ position: "absolute", opacity: 0.09 }}><circle cx="1390" cy="430" r="250" fill="none" stroke="#17161B" strokeWidth="3" /><circle cx="1390" cy="430" r="215" fill="none" stroke="#17161B" strokeWidth="1.5" strokeDasharray="4 6" /><circle cx="1390" cy="430" r="120" fill="none" stroke="#17161B" strokeWidth="2" /></svg>}
      {P.pitch && <svg width="1920" height="1080" style={{ position: "absolute", opacity: 0.2 }}><g fill="none" stroke="#FFC2E6" strokeWidth="3"><rect x="160" y="120" width="1600" height="840" /><line x1="960" y1="120" x2="960" y2="960" /><circle cx="960" cy="540" r="130" /><rect x="160" y="320" width="230" height="440" /><rect x="1530" y="320" width="230" height="440" /><rect x="160" y="430" width="90" height="220" /><rect x="1670" y="430" width="90" height="220" /></g></svg>}
      {children}
      <Finish grain={P.grain} vignette={0.4} />
    </AbsoluteFill>
  );
}

/** Our own wireframe figure (original drawing): a jointed mannequin with a glowing outline, as the hero visual on the teal look.
 * pose: swing 0..1 (kicking leg back to follow-through); scale s; rot degrees; arms: "kick" | "up". */
function Mannequin({ x, y, s = 1, rot = 0, swing = 0, arms = "kick", col = "#fff", glow = "#7FE3D6" }) {
  const rad = (d) => (d * Math.PI) / 180, pt = (o, len, deg) => [o[0] + len * Math.sin(rad(deg)), o[1] + len * Math.cos(rad(deg))];
  const hip = [0, 0], chest = [0, -150], neck = [0, -185], head = [0, -225];
  const thighA = -20 + 95 * swing, kneeA = thighA - (70 - 55 * swing), plantHipA = 8, plantKneeA = 4;
  const k1 = pt(hip, 95, thighA), f1 = pt(k1, 92, kneeA), k2 = pt(hip, 95, plantHipA), f2 = pt(k2, 92, plantKneeA);
  const shL = [-24, -168], shR = [24, -168];
  const armsPts = arms === "up" ? [[shL, [-70, -250], [-85, -320]], [shR, [70, -250], [85, -320]]] : [[shL, pt(shL, 72, -62 - 22 * swing), pt(pt(shL, 72, -62 - 22 * swing), 66, -88 - 22 * swing)], [shR, pt(shR, 72, 70 + 26 * swing), pt(pt(shR, 72, 70 + 26 * swing), 66, 104 + 26 * swing)]];
  const line = (a, b, w = 9) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={col} strokeWidth={w} strokeLinecap="round" />;
  const body = (
    <g>
      <path d={`M ${shL[0]} ${shL[1]} Q -34 -90 -20 0 L 20 0 Q 34 -90 ${shR[0]} ${shR[1]} Z`} fill="none" stroke={col} strokeWidth="7" strokeLinejoin="round" />
      <path d={`M ${-14} -150 Q 0 -120 14 -150 M -18 -118 Q 0 -96 18 -118 M -20 -86 Q 0 -66 20 -86`} fill="none" stroke={col} strokeWidth="2.5" opacity="0.7" />
      {line(neck, chest, 8)}<ellipse cx={head[0]} cy={head[1]} rx="30" ry="36" fill="none" stroke={col} strokeWidth="7" /><ellipse cx={head[0]} cy={head[1]} rx="30" ry="12" fill="none" stroke={col} strokeWidth="2.5" opacity="0.6" />
      {armsPts.map(([a, b, c], i) => <g key={i}>{line(a, b)}{line(b, c)}<circle cx={b[0]} cy={b[1]} r="8" fill="none" stroke={col} strokeWidth="4" /><circle cx={c[0]} cy={c[1]} r="10" fill="none" stroke={col} strokeWidth="4" /></g>)}
      {[[hip, k1, f1], [hip, k2, f2]].map(([a, b, c], i) => <g key={i}>{line(a, b, 12)}{line(b, c, 10)}<circle cx={b[0]} cy={b[1]} r="10" fill="none" stroke={col} strokeWidth="4" /><ellipse cx={c[0] + 12} cy={c[1] + 4} rx="26" ry="9" fill="none" stroke={col} strokeWidth="5" /></g>)}
      <circle cx={hip[0]} cy={hip[1]} r="14" fill="none" stroke={col} strokeWidth="5" />
    </g>
  );
  return <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}><g style={{ filter: `drop-shadow(0 0 14px ${glow})` }}>{body}</g></g>;
}

/** Framed pictures on a section look, with a drop shadow (the reference shows its clips as framed cards on the plum pitch). cards: [{ image, credit, pos }] */
export function Cards({ t, cards, title, v = "plum", callout, dur = 300 }) {
  const P = pal(v), f = useCurrentFrame(), n = cards.length, W = n === 1 ? 1100 : 780, H = Math.round(W * 0.5625), gap = 70, x0 = (1920 - (n * W + (n - 1) * gap)) / 2;
  return (
    <Backdrop v={v}>
      {title && <div style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center", fontFamily: SER, fontWeight: 700, fontSize: 52, color: P.fg }}>{titleCase(title)}</div>}
      {cards.map((c, i) => { const a = ramp(f, 6 + i * 10, 22 + i * 10, expo), s = interpolate(f, [0, dur], [1.02, 1.1], clamp); return (
        <div key={i} style={{ position: "absolute", left: x0 + i * (W + gap), top: 250, width: W, height: H, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.55)", border: "3px solid rgba(255,255,255,0.85)", opacity: a, transform: `translateY(${(1 - a) * 30}px) rotate(${(i % 2 ? 0.6 : -0.6)}deg)` }}>
          <Img src={staticFile(c.image)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: c.pos || "50% 50%", transform: `scale(${s})` }} />
          <div style={{ position: "absolute", right: 10, bottom: 8, fontFamily: F.sans, fontSize: 15, color: "rgba(255,255,255,0.85)", textShadow: "0 1px 3px #000" }}>{c.credit}</div>
        </div>); })}
      {callout && <div style={{ position: "absolute", left: 0, right: 0, bottom: 90, textAlign: "center", fontFamily: SER, fontStyle: "italic", fontWeight: 600, fontSize: 56, color: P.fg, whiteSpace: "pre-line" }}>{callout}</div>}
    </Backdrop>
  );
}

/** Hero: the mannequin kicks while a counted figure is called out beside it with a leader line, like the reference's wireframe figure with its "8.1%" call-outs. */
export function Hero({ t, value, countFrom, label, sub, v = "teal", figure = "kick", callout2 }) {
  const P = pal(v), f = useCurrentFrame(), sw = 0.5 - 0.5 * Math.cos(ramp(f, 4, 80, eio) * Math.PI), n = countFrom == null || f >= 40 ? value : Math.round(lerp(f, 0, 40, countFrom, Number(value), expo));
  return (
    <Backdrop v={v}>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        <circle cx="600" cy="560" r="400" fill="none" stroke={P.fg} strokeWidth="2" opacity="0.35" /><circle cx="600" cy="560" r="330" fill="none" stroke={P.fg} strokeWidth="1" opacity="0.2" strokeDasharray="6 10" />
        <Mannequin x={600} y={690} s={1.5} swing={figure === "kick" ? sw : 0.2} arms={figure === "keeper" ? "up" : "kick"} glow={P.a} />
        <line x1="820" y1="420" x2="1070" y2="330" stroke={P.fg} strokeWidth="2" opacity={ramp(f, 14, 30)} /><circle cx="820" cy="420" r="8" fill="none" stroke={P.fg} strokeWidth="2" opacity={ramp(f, 14, 30)} />
      </svg>
      <div style={{ position: "absolute", left: 1090, top: 190, fontFamily: SER, fontWeight: 700, fontSize: 250, lineHeight: 1, color: P.fg, opacity: ramp(f, 8, 24) }}>{n}</div>
      <div style={{ position: "absolute", left: 1100, top: 450, fontFamily: SER, fontStyle: "italic", fontSize: 58, color: P.a, maxWidth: 700, opacity: ramp(f, 20, 36) }}>{sentence(label)}</div>
      {sub && <div style={{ position: "absolute", left: 1100, top: 560, fontFamily: SER, fontSize: 30, color: P.mute, maxWidth: 700, opacity: ramp(f, 30, 46) }}>{sub}</div>}
      {callout2 && <div style={{ position: "absolute", left: 1100, top: 700, fontFamily: SER, fontStyle: "italic", fontSize: 44, color: P.fg, opacity: ramp(f, 60, 80) }}>{callout2}</div>}
    </Backdrop>
  );
}

/** 1. Big-number opener (N8PZt_9_adI "168"): a counted figure alone on black, then its unit line. With a look (v): serif figure, italic unit. */
export function NumberOpen({ t, value, unit, sub, countFrom, v }) {
  const P = pal(v), f = useCurrentFrame(), n = countFrom == null || f >= 26 ? value : Math.round(lerp(f, 0, 26, countFrom, Number(value), expo)), a = ramp(f, 0, 8);
  if (v) return (
    <Backdrop v={v}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: SER, fontWeight: 700, fontSize: 430, lineHeight: 0.95, color: P.fg, opacity: a, transform: `scale(${lerp(f, 0, 40, 0.94, 1) + f * 0.00018})` }}>{n}</div>
        {unit && <div style={{ fontFamily: SER, fontStyle: "italic", fontWeight: 600, fontSize: 62, color: P.a, marginTop: 8, opacity: ramp(f, 14, 26) }}>{sentence(unit)}</div>}
        {sub && <div style={{ fontFamily: SER, fontSize: 30, color: P.mute, marginTop: 22, opacity: ramp(f, 24, 38), maxWidth: 1500, textAlign: "center" }}>{sub}</div>}
      </AbsoluteFill>
    </Backdrop>
  );
  return (
    <AbsoluteFill style={{ background: "#000", alignItems: "center", justifyContent: "center" }}><Fonts />
      <div style={{ fontFamily: F.cond, fontWeight: 700, fontSize: 470, lineHeight: 0.9, color: "#fff", letterSpacing: "-0.02em", opacity: a, transform: `scale(${lerp(f, 0, 40, 0.94, 1) + f * 0.00018})` }}>{n}</div>
      {unit && <div style={{ fontFamily: F.cond, fontWeight: 700, fontSize: 54, letterSpacing: "0.3em", color: t.accent, marginTop: 12, opacity: ramp(f, 14, 26), textTransform: "uppercase" }}>{unit}</div>}
      {sub && <div style={{ fontFamily: F.sans, fontSize: 30, color: "rgba(255,255,255,0.72)", marginTop: 22, opacity: ramp(f, 24, 38) }}>{sub}</div>}
      <Finish grain={0.06} vignette={0.6} />
    </AbsoluteFill>
  );
}

/** 2. Scoreline card, reused as the minute marker (oZaPKaIVIA0, KC2Vgjw282s). scorers: [{ team, text }] */
export function ScoreCard({ t, home, away, score, minute, title, scorers = [], date, strike }) {
  const f = useCurrentFrame(), a = ramp(f, 0, 14, expo);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(70% 70% at 50% 45%, #1b1d20 0%, #0a0b0c 70%, #000 100%)" }}><Fonts />
      {title && <div style={{ position: "absolute", top: 60, left: 0, right: 0, textAlign: "center", fontFamily: F.cond, fontWeight: 700, fontSize: 190, letterSpacing: "0.06em", color: "rgba(255,255,255,0.06)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{title}</div>}
      <svg width="1920" height="1080" style={{ position: "absolute" }}><g opacity={a}><Flag t={t} team={home} x={lerp(f, 0, 16, 300, 380, expo)} y={390} s={240} /><Flag t={t} team={away} x={lerp(f, 0, 16, 1380, 1300, expo)} y={390} s={240} /></g></svg>
      <div style={{ position: "absolute", top: 330, left: 0, right: 0, textAlign: "center", fontFamily: F.cond, fontWeight: 700, fontSize: 60, color: t.accent, letterSpacing: "0.08em", opacity: ramp(f, 8, 18) }}>{minute}</div>
      <div style={{ position: "absolute", top: 400, left: 0, right: 0, textAlign: "center", fontFamily: F.cond, fontWeight: 700, fontSize: 230, lineHeight: 1, color: "#fff", opacity: a, transform: `scale(${lerp(f, 0, 14, 1.15, 1, expo)})` }}>{score}</div>
      {strike && <div style={{ position: "absolute", top: 640, left: 760, width: 400 * ramp(f, 16, 28), height: 8, background: t.accent }} />}
      {date && <div style={{ position: "absolute", top: 668, left: 0, right: 0, textAlign: "center", fontFamily: F.cond, fontSize: 34, letterSpacing: "0.2em", color: "rgba(255,255,255,0.7)", opacity: ramp(f, 12, 24) }}>{date}</div>}
      <div style={{ position: "absolute", top: 760, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 240 }}>
        {[home, away].map((tm) => <div key={tm} style={{ width: 520, textAlign: tm === home ? "right" : "left", fontFamily: F.cond, fontSize: 36, color: "#fff", lineHeight: 1.5 }}>{scorers.filter((s) => s.team === tm).map((s, i) => <div key={i} style={{ opacity: ramp(f, 20 + i * 6, 30 + i * 6) }}>{s.text}</div>)}</div>)}
      </div>
      <Finish grain={0.05} vignette={0.45} />
    </AbsoluteFill>
  );
}

/** 3. Formation from real average on-ball positions; optional lines joining units and a highlighted player. mirror: draw team attacking left. */
export function Formation({ t, cam, sides, links = [], callout, coming, note, labelAll, highlight = [] }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill><Pitch cam={cam} t={t}>{(P) => (<>
      {links.map((l, i) => { const pts = l.ids.map((id) => { for (const s of sides) { const p = s.players.find((q) => q.id === id); if (p) return s.mirror ? [120 - p.avg[0], 80 - p.avg[1]] : p.avg; } return null; }).filter(Boolean), a = ramp(f, l.from || 20, (l.from || 20) + 16);
        const d = path(P, pts); return <path key={i} d={d} fill="none" stroke={l.color || "#fff"} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - a} opacity="0.95" />; })}
      {sides.flatMap((s, si) => s.players.filter((p) => p.avg).map((p, i) => { const a = ramp(f, si * 8 + i * 2, si * 8 + i * 2 + 12, expo), [x, y] = s.mirror ? [120 - p.avg[0], 80 - p.avg[1]] : p.avg, hi = highlight.includes(p.id);
        return <g key={`${si}-${p.id}`} transform={`translate(0 ${(1 - a) * -26})`}><Dot P={P} x={x} y={y} team={s.team} t={t} num={p.number} name={labelAll || hi ? p.name.split(" ").slice(-1)[0] : null} hi={hi} op={a} keeper={p.position === "Goalkeeper"} /></g>; }))}
    </>)}</Pitch>
      {callout && <Callout t={t} text={callout} from={30} />}
      <Tags t={t} coming={coming} note={note || "dots = average on-ball position, first half"} />
    </AbsoluteFill>
  );
}

/** Player state at time tau (seconds) of a prepared goal sequence: interpolates each tracked dot between the freeze-frames around tau. */
function dotsAt(frames, tau) {
  let i = 0; while (i < frames.length - 1 && frames[i + 1].t <= tau) i++;
  const A = frames[i], B = frames[Math.min(i + 1, frames.length - 1)], span = Math.max(0.001, B.t - A.t), k = A === B ? 0 : Math.min(1, Math.max(0, (tau - A.t) / span)), e = k * k * (3 - 2 * k), out = [];
  for (const d of A.dots) { const m = B.dots.find((q) => q.id === d.id && q.mate === d.mate); out.push(m ? { ...d, x: d.x + (m.x - d.x) * e, y: d.y + (m.y - d.y) * e, op: 1, actor: k < 0.5 ? d.actor : m.actor } : { ...d, op: 1 - e }); }
  for (const d of B.dots) if (!A.dots.find((q) => q.id === d.id && q.mate === d.mate)) out.push({ ...d, op: e });
  return { dots: out, i, A };
}
function ballAt(frames, tau) {
  let cur = frames[0];
  for (const fr of frames) { if (fr.t > tau) break; if (fr.to && fr.type !== "Ball Receipt*") cur = fr; }
  if (!cur.to) return { pos: cur.from, ev: cur };
  const next = frames.find((x) => x.t > cur.t && x.type !== "Carry" && x.type !== "Ball Receipt*"), dur = Math.max(0.25, cur.duration || (next ? next.t - cur.t : 0.8)), k = Math.min(1, Math.max(0, (tau - cur.t) / dur));
  return { pos: [cur.from[0] + (cur.to[0] - cur.from[0]) * k, cur.from[1] + (cur.to[1] - cur.from[1]) * k], ev: cur, k, lift: cur.type === "Pass" ? Math.sin(k * Math.PI) * 1.2 : 0 };
}

/**
 * 4. Animated passage of play from event + 360 data. Players move between the recorded freeze-frames, the ball travels each pass and carry
 * in its recorded time, finished passes stay as trails, the player on the ball carries a name tag. speed: playback rate (1 = real time).
 * start/end: seconds of the sequence to play; camera can follow the ball (follow: true) on top of the keyframed camera.
 */
export function Sequence360({ t, seq, cam, speed = 1, start = 0, callout, calloutAt = 0, clock = true, follow = 0.5, attack = "right", teamName, oppName, note, coming, freezeAt }) {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), tau = Math.min(freezeAt ?? 1e9, start + (f / fps) * speed), fr = seq.frames, ball = ballAt(fr, tau), state = dotsAt(fr, tau);
  const base = camAt(cam, f), c = { ...base, fx: base.fx + (ball.pos[0] - base.fx) * follow, fy: base.fy + (ball.pos[1] - base.fy) * follow * 0.6 };
  const trails = fr.filter((e) => e.type === "Pass" && e.to && e.t <= tau);
  const shot = fr.find((e) => e.type === "Shot"), shotOn = shot && tau >= shot.t;
  return (
    <AbsoluteFill><Pitch cam={c} t={t}>{(P) => (<>
      {trails.map((e, i) => { const k = Math.min(1, (tau - e.t) / Math.max(0.25, e.duration || 0.8)), age = tau - e.t, to = [e.from[0] + (e.to[0] - e.from[0]) * k, e.from[1] + (e.to[1] - e.from[1]) * k];
        return <path key={i} d={path(P, [e.from, to])} stroke={t.accent} strokeWidth="5" strokeLinecap="round" fill="none" opacity={Math.max(0.28, 1 - age / 9)} />; })}
      {shotOn && <path d={path(P, [shot.from, [shot.from[0] + (shot.to[0] - shot.from[0]) * Math.min(1, (tau - shot.t) / 0.5), shot.from[1] + (shot.to[1] - shot.from[1]) * Math.min(1, (tau - shot.t) / 0.5)]])} stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" />}
      {state.dots.slice().sort((a, b) => a.y - b.y).map((d, i) => <Dot key={`${d.mate}-${d.id}-${i}`} P={P} x={d.x} y={d.y} team={d.mate ? teamName : oppName} t={t} op={d.op} hi={d.actor} name={d.actor ? ball.ev.player.split(" ").slice(-1)[0] : null} keeper={d.keeper} r={14} />)}
      {(() => { const [bx, by, k] = P(ball.pos[0], ball.pos[1], ball.lift || 0), [gx, gy] = P(ball.pos[0], ball.pos[1], 0); return <g><ellipse cx={gx} cy={gy + 4} rx={7 * k} ry={3 * k} fill="#000" opacity="0.6" /><circle cx={bx} cy={by} r={7.5 * k} fill="#fff" stroke="#111" strokeWidth="1.5" /></g>; })()}
    </>)}</Pitch>
      {clock && <div style={{ position: "absolute", left: 70, top: 56, display: "flex", alignItems: "center", gap: 20, fontFamily: F.cond, fontWeight: 700 }}>
        <div style={{ background: t.accent, color: "#0a0a0a", fontSize: 40, padding: "4px 18px" }}>{seq.clock}</div>
        <div style={{ color: "#fff", fontSize: 34, letterSpacing: "0.12em" }}>{teamName.toUpperCase()} ATTACK {attack === "right" ? "→" : "←"}</div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 30, fontFamily: F.mono }}>{Math.min(tau, seq.seconds).toFixed(1)}s / {seq.seconds.toFixed(1)}s</div>
      </div>}
      <div style={{ position: "absolute", right: 70, top: 60, textAlign: "right", fontFamily: F.cond, fontSize: 30, color: "#fff", letterSpacing: "0.06em" }}>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 22, letterSpacing: "0.2em" }}>{ball.ev.type === "Ball Receipt*" ? "RECEIVES" : ball.ev.type.toUpperCase()}</div>
        <div style={{ fontWeight: 700, fontSize: 40 }}>{ball.ev.player}</div>
        <div style={{ color: t.accent, fontSize: 26 }}>pass {trails.length} of {fr.filter((e) => e.type === "Pass").length}</div>
      </div>
      {callout && <Callout t={t} text={callout} from={calloutAt} />}
      <Tags t={t} coming={coming} note={note || "positions at each event from 360 freeze-frames (only players inside the broadcast camera view are recorded); movement between events interpolated"} />
    </AbsoluteFill>
  );
}

/** 5. Pass network on the pitch: line weight = completed passes between two starters (first half), node = average position. */
export function PassNetwork({ t, cam, side, pairs, callout, note }) {
  const f = useCurrentFrame(), max = Math.max(...pairs.map((p) => p.n)), by = Object.fromEntries(side.players.map((p) => [p.id, p]));
  return (
    <AbsoluteFill><Pitch cam={cam} t={t}>{(P) => (<>
      {pairs.filter((p) => by[p.a]?.avg && by[p.b]?.avg).sort((a, b) => a.n - b.n).map((p, i) => { const a = ramp(f, 10 + i * 1.2, 24 + i * 1.2); return <path key={i} d={path(P, [by[p.a].avg, by[p.b].avg])} stroke={p.n >= max * 0.6 ? t.accent : "#fff"} strokeWidth={2 + (p.n / max) * 13} strokeLinecap="round" opacity={a * (0.35 + 0.6 * (p.n / max))} fill="none" />; })}
      {side.players.filter((p) => p.avg).map((p, i) => <Dot key={p.id} P={P} x={p.avg[0]} y={p.avg[1]} team={side.team} t={t} num={p.number} name={p.name.split(" ").slice(-1)[0]} op={ramp(f, i * 2, i * 2 + 10)} r={13 + Math.min(9, p.touches / 9)} keeper={p.position === "Goalkeeper"} />)}
    </>)}</Pitch>
      {callout && <Callout t={t} text={callout} from={36} />}
      <Tags t={t} note={note || "line = completed passes between two players, first half (4 or more shown)"} />
    </AbsoluteFill>
  );
}

/** 6. Pressure map: counted pressure events per 10 x 10 zone, drawn on the plane. */
export function PressMap({ t, cam, grid, team, callout, mirror, note }) {
  const f = useCurrentFrame(), max = Math.max(...grid.flat());
  return (
    <AbsoluteFill><Pitch cam={cam} t={t}>{(P) => grid.flatMap((row, r) => row.map((n, c) => { if (!n) return null; const x0 = mirror ? 110 - c * 10 : c * 10, y0 = mirror ? 70 - r * 10 : r * 10, a = ramp(f, 8 + (c + r) * 1.5, 22 + (c + r) * 1.5), [tx, ty] = P(x0 + 5, y0 + 5);
      return <g key={`${r}-${c}`} opacity={a}><path d={path(P, [[x0 + 0.4, y0 + 0.4], [x0 + 9.6, y0 + 0.4], [x0 + 9.6, y0 + 9.6], [x0 + 0.4, y0 + 9.6]], true)} fill={t.teams[team].heat} opacity={0.12 + 0.78 * (n / max)} />{n >= max * 0.45 && <text x={tx} y={ty + 8} textAnchor="middle" fontFamily={F.cond} fontWeight="700" fontSize="24" fill="#fff">{n}</text>}</g>; }))}</Pitch>
      {callout && <Callout t={t} text={callout} from={30} />}
      <Tags t={t} note={note || `number = pressures by ${team} in that zone, whole match`} />
    </AbsoluteFill>
  );
}

/** 7. Shot map: circle area = xG, filled = goal. Both teams attack the goal they attacked (home left-to-right, away mirrored). */
export function ShotMap({ t, cam, shots, home, away, callout, note }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill><Pitch cam={cam} t={t}>{(P) => shots.map((s, i) => { const x = s.team === home ? s.x : 120 - s.x, y = s.team === home ? s.y : 80 - s.y, [sx, sy, k] = P(x, y), r = (7 + Math.sqrt(s.xg) * 46) * k, a = ramp(f, 6 + i * 2.2, 16 + i * 2.2, expo), goal = s.outcome === "Goal", col = t.teams[s.team];
      return <g key={i} opacity={a} transform={`translate(${sx} ${sy}) scale(${0.5 + 0.5 * a})`}><circle r={r} fill={goal ? col.fill : "rgba(0,0,0,0.25)"} stroke={goal ? t.accent : col.fill} strokeWidth={goal ? 5 : 3} />{goal && <text x={s.minute > 80 ? 70 : 0} y={-r - 12 - (s.minute > 80 ? 40 : 0)} textAnchor="middle" fontFamily={F.cond} fontWeight="700" fontSize="24" fill="#fff">{s.player.split(" ").slice(-1)[0].toUpperCase()} {s.minute + 1}'</text>}</g>; })}</Pitch>
      {callout && <Callout t={t} text={callout} from={40} />}
      <Tags t={t} note={note || "circle size = expected goals (xG) of the shot; filled = goal"} />
    </AbsoluteFill>
  );
}

/** 8. Head-to-head bars for counted figures. rows: [{ label, a, b, dec }]. With a look (v): serif type, glossy bars, lattice or paper backdrop. */
export function StatBars({ t, home, away, rows, title, v }) {
  const P = pal(v), f = useCurrentFrame(), colA = v ? P.a : t.teams[home].fill, colB = v ? P.b : (t.teams[away].bar || t.teams[away].fill);
  const gloss = (c) => v ? `linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.22) 100%), ${c}` : c;
  const body = (<>
    <div style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center", fontFamily: v ? SER : F.cond, fontWeight: 700, fontSize: v ? 52 : 44, letterSpacing: v ? "0" : "0.24em", color: v ? P.fg : "rgba(255,255,255,0.75)" }}>{v ? titleCase(title) : title}</div>
    <svg width="1920" height="1080" style={{ position: "absolute" }}><Flag t={t} team={home} x={250} y={150} s={110} /><Flag t={t} team={away} x={1560} y={150} s={110} /></svg>
    {rows.map((r, i) => { const a = ramp(f, 10 + i * 8, 34 + i * 8, expo), tot = r.a + r.b, y = 330 + i * 140, wa = (r.a / tot) * 1180 * a, wb = (r.b / tot) * 1180 * a;
      return <div key={i}>
        <div style={{ position: "absolute", top: y - 10, left: 0, right: 0, textAlign: "center", fontFamily: v ? SER : F.cond, fontStyle: v ? "italic" : "normal", fontSize: v ? 34 : 30, letterSpacing: v ? "0" : "0.2em", color: v ? P.mute : "rgba(255,255,255,0.7)", textTransform: v ? "none" : "uppercase" }}>{v ? sentence(r.label) : r.label}</div>
        <div style={{ position: "absolute", top: y + 40, left: 370, width: 1180, height: 36, background: v ? P.track : "rgba(255,255,255,0.07)" }} />
        <div style={{ position: "absolute", top: y + 40, left: 370, width: wa, height: 36, background: gloss(colA), boxShadow: v ? "0 6px 14px rgba(0,0,0,0.35)" : "none" }} /><div style={{ position: "absolute", top: y + 40, left: 370 + 1180 - wb, width: wb, height: 36, background: gloss(colB), boxShadow: v ? "0 6px 14px rgba(0,0,0,0.35)" : "none" }} />
        <div style={{ position: "absolute", top: y + 6, left: 130, width: 220, textAlign: "right", fontFamily: v ? SER : F.cond, fontWeight: 700, fontSize: v ? 72 : 76, color: v ? P.fg : "#fff" }}>{(a > 0.97 ? r.a : r.a * a).toFixed(r.dec || 0)}</div>
        <div style={{ position: "absolute", top: y + 6, left: 1570, width: 220, fontFamily: v ? SER : F.cond, fontWeight: 700, fontSize: v ? 72 : 76, color: v ? P.fg : "#fff" }}>{(a > 0.97 ? r.b : r.b * a).toFixed(r.dec || 0)}</div>
      </div>; })}
    <Tags t={t} />
  </>);
  return v ? <Backdrop v={v}>{body}</Backdrop> : <AbsoluteFill style={{ background: "radial-gradient(80% 80% at 50% 40%, #17191c 0%, #08090a 75%)" }}><Fonts />{body}<Finish grain={0.05} vignette={0.4} /></AbsoluteFill>;
}

/** 9. Match timeline spine (Dki5tjN0rDE): goals above, substitutions below, a playhead that travels. events: [{ minute, kind: goal|sub, team, text }] */
export function MatchTimeline({ t, events, home, away, to = 95, title, focus }) {
  const f = useCurrentFrame(), X = (m) => 160 + (m / 95) * 1600, head = lerp(f, 6, 80, 0, to, eio);
  return (
    <AbsoluteFill style={{ background: "#07080a" }}><Fonts />
      <div style={{ position: "absolute", top: 90, left: 160, fontFamily: F.cond, fontWeight: 700, fontSize: 54, letterSpacing: "0.1em", color: "#fff", textTransform: "uppercase" }}>{title}</div>
      <div style={{ position: "absolute", top: 538, left: 160, width: 1600, height: 4, background: "rgba(255,255,255,0.22)" }} /><div style={{ position: "absolute", top: 536, left: 160, width: X(head) - 160, height: 8, background: t.accent }} />
      {[0, 15, 30, 45, 60, 75, 90].map((m) => <div key={m} style={{ position: "absolute", top: 560, left: X(m) - 30, width: 60, textAlign: "center", fontFamily: F.mono, fontSize: 20, color: "rgba(255,255,255,0.5)" }}>{m}'</div>)}
      {(() => { const rows = []; return events.map((e) => { if (e.kind === "goal") return { ...e, row: 0 }; let r = 0; while ((rows[r] ?? -99) > e.minute - 11) r++; rows[r] = e.minute; return { ...e, row: r }; }); })().map((e, i) => { const on = head >= e.minute, a = on ? ramp(f, 0, 1) * Math.min(1, (head - e.minute) / 3 + 0.2) : 0, up = e.kind === "goal", hi = focus != null && focus === i;
        return <div key={i} style={{ position: "absolute", left: X(e.minute), top: up ? 250 + (i % 2) * 90 : 610 + e.row * 74, opacity: a, transform: "translateX(-50%)", textAlign: "center" }}>
          {up && <div style={{ position: "absolute", left: "50%", top: 70, width: 2, height: 220 - (i % 2) * 90, background: "rgba(255,255,255,0.4)" }} />}
          <div style={{ display: "inline-block", padding: "8px 18px", background: up ? t.teams[e.team].fill : hi ? t.accent : "rgba(255,255,255,0.08)", color: up ? t.teams[e.team].ink : hi ? "#0a0a0a" : "#fff", fontFamily: F.cond, fontWeight: 700, fontSize: up ? 34 : 24, letterSpacing: "0.04em", whiteSpace: "nowrap", border: up ? `3px solid ${t.teams[e.team].ring}` : "none" }}>{e.text}</div>
        </div>; })}
      <div style={{ position: "absolute", top: 500, left: X(head) - 9, width: 18, height: 80, background: "#fff" }} />
      <Tags t={t} /><Finish grain={0.05} vignette={0.5} />
    </AbsoluteFill>
  );
}

/** 10. Substitution card over a dimmed pitch: who left, who came on, and what the data shows they did next. */
export function SubCard({ t, cam, minute, off, on, team, fact }) {
  const f = useCurrentFrame(), a = ramp(f, 4, 18, expo);
  return (
    <AbsoluteFill><Pitch cam={cam} t={t} dim={0.55} />
      <div style={{ position: "absolute", left: 260, top: 300, width: 1400, opacity: a, transform: `translateY(${(1 - a) * 30}px)`, fontFamily: F.cond }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}><div style={{ background: t.accent, color: "#0a0a0a", fontWeight: 700, fontSize: 52, padding: "2px 22px" }}>{minute}'</div><div style={{ color: "rgba(255,255,255,0.7)", fontSize: 34, letterSpacing: "0.24em" }}>{team.toUpperCase()} SUBSTITUTION</div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 40 }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontWeight: 700, fontSize: 110, textDecoration: "line-through", textDecorationColor: "#E5484D", textDecorationThickness: 8 }}>{off}</div>
          <div style={{ color: t.accent, fontSize: 110, transform: `translateX(${lerp(f, 16, 30, -30, 0)}px)`, opacity: ramp(f, 16, 26) }}>→</div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 130, opacity: ramp(f, 22, 34), transform: `translateX(${lerp(f, 22, 36, 40, 0, expo)}px)` }}>{on}</div>
        </div>
        {fact && <div style={{ marginTop: 44, fontFamily: F.sans, fontSize: 40, lineHeight: 1.35, color: "#fff", maxWidth: 1250, opacity: ramp(f, 40, 54) }}>{fact}</div>}
      </div>
      <Tags t={t} />
    </AbsoluteFill>
  );
}

/** Thumbnail: pitch fragment, one giant claim, one figure. */
export function RivalThumb({ t, cam, seq, big, small, figure, teamName, oppName, at = 12, image }) {
  // photo variant (no tracking data): a licensed still behind the same type block
  if (image) return (
    <AbsoluteFill style={{ background: "#000" }}><Fonts />
      <Img src={staticFile(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9) contrast(1.08) brightness(0.8)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 38%, rgba(0,0,0,0) 68%)" }} />
      <div style={{ position: "absolute", left: 90, top: 150, fontFamily: F.cond, fontWeight: 700, fontSize: 210, lineHeight: 0.95, color: "#fff", textTransform: "uppercase", whiteSpace: "pre-line", letterSpacing: "-0.01em" }}>{big}</div>
      {small && <div style={{ position: "absolute", left: 96, top: 800, fontFamily: F.cond, fontWeight: 700, fontSize: 84, color: "#0a0a0a", background: t.accent, padding: "6px 26px", textTransform: "uppercase" }}>{small}</div>}
      {figure && <div style={{ position: "absolute", right: 90, top: 90, fontFamily: F.cond, fontWeight: 700, fontSize: 150, color: "#fff", textShadow: "0 6px 30px #000" }}>{figure}</div>}
    </AbsoluteFill>
  );
  const state = dotsAt(seq.frames, at), trails = seq.frames.filter((e) => e.type === "Pass" && e.to && e.t <= at);
  return (
    <AbsoluteFill><Pitch cam={cam} t={t}>{(P) => (<>{trails.map((e, i) => <path key={i} d={path(P, [e.from, e.to])} stroke={t.accent} strokeWidth="9" strokeLinecap="round" fill="none" />)}{state.dots.map((d, i) => <Dot key={i} P={P} x={d.x} y={d.y} team={d.mate ? teamName : oppName} t={t} r={20} keeper={d.keeper} />)}</>)}</Pitch>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 38%, rgba(0,0,0,0) 68%)" }} />
      <div style={{ position: "absolute", left: 90, top: 150, fontFamily: F.cond, fontWeight: 700, fontSize: 210, lineHeight: 0.95, color: "#fff", textTransform: "uppercase", whiteSpace: "pre-line", letterSpacing: "-0.01em" }}>{big}</div>
      {small && <div style={{ position: "absolute", left: 96, top: 800, fontFamily: F.cond, fontWeight: 700, fontSize: 84, color: "#0a0a0a", background: t.accent, padding: "6px 26px", textTransform: "uppercase" }}>{small}</div>}
      {figure && <div style={{ position: "absolute", right: 90, top: 90, fontFamily: F.cond, fontWeight: 700, fontSize: 150, color: "#fff", textShadow: "0 6px 30px #000" }}>{figure}</div>}
    </AbsoluteFill>
  );
}

/** 11. Real photograph (licensed: Commons / government press photo) with the credit on screen and one capital callout. The proof layer the references
 * get from broadcast clips, which we cannot license; a still is the honest substitute and is labelled as such. */
export function Photo({ t, image, credit, callout, kicker, pos = "50% 35%", dur = 240 }) {
  const f = useCurrentFrame(), s = interpolate(f, [0, dur], [1.02, 1.09], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}><Fonts />
      <Img src={staticFile(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, transform: `scale(${s})`, filter: "saturate(0.95) contrast(1.05)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0) 70%)" }} />
      {kicker && <div style={{ position: "absolute", left: 110, top: 760, fontFamily: F.cond, fontWeight: 700, fontSize: 30, letterSpacing: "0.2em", color: t.accent }}>{kicker}</div>}
      {callout && <Callout t={t} text={callout} y={810} from={10} />}
      <div style={{ position: "absolute", right: 30, bottom: 22, fontFamily: F.sans, fontSize: 17, color: "rgba(255,255,255,0.75)", textShadow: "0 1px 3px #000" }}>Photo: {credit}</div>
      <Finish grain={0.05} vignette={0.35} />
    </AbsoluteFill>
  );
}


/** 12. Every shoot-out we counted, one tile each (our data, StatsBomb open data): top row = the team that kicked first, bottom row = the other team;
 * filled dot = scored, hollow = missed; the tile is accent-edged when the first kicker won. Tiles appear one by one and a counter tallies them.
 * shootouts: [{ first: [bool], second: [bool], firstWon: bool, tag, score }] */
export function ShootoutGrid({ t, shootouts, title, step = 5, hi = [], label, v }) {
  const P = pal(v), f = useCurrentFrame(), cols = 8, W = 205, H = 150, x0 = 118, y0 = 245;
  const shown = Math.min(shootouts.length, Math.max(0, Math.floor((f - 8) / step) + 1));
  const won = shootouts.slice(0, shown).filter((s) => s.firstWon).length;
  return (
    <Backdrop v={v || "dark"}>
      <div style={{ position: "absolute", top: 56, left: 0, right: 0, textAlign: "center", fontFamily: SER, fontWeight: 700, fontSize: 56, color: P.fg }}>{titleCase(title)}</div>
      <div style={{ position: "absolute", top: 138, left: 0, right: 0, textAlign: "center", fontFamily: SER, fontStyle: "italic", fontSize: 28, color: P.faint }}>{sentence(label || "Top row: kicked first · bottom row: kicked second · edged: the first kicker won")}</div>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        {shootouts.map((s, i) => {
          if (i >= shown) return null;
          const a = ramp(f, 8 + i * step, 8 + i * step + 8, expo), x = x0 + (i % cols) * (W + 8), y = y0 + Math.floor(i / cols) * (H + 10);
          const rowDots = (arr, yy, strong) => arr.map((g, k) => <circle key={k} cx={x + 16 + k * 18.5} cy={yy} r="7" fill={g ? P.a : "none"} stroke={g ? P.a : P.bad} strokeWidth="2.6" opacity={strong ? 1 : 0.75} />);
          const edge = s.firstWon ? P.a : P.faint;
          return (<g key={i} opacity={a} transform={`translate(0 ${(1 - a) * 18})`}>
            <rect x={x} y={y} width={W} height={H} rx="6" fill={P.tile} stroke={hi.includes(i) ? P.fg : edge} strokeWidth={hi.includes(i) ? 5 : s.firstWon ? 3.5 : 1.5} />
            <text x={x + 12} y={y + 26} fontFamily="Playfair Display, Georgia, serif" fontStyle="italic" fontSize="17" fill={P.mute}>{s.tag}</text>
            {rowDots(s.first, y + 62, s.firstWon)}{rowDots(s.second, y + 100, !s.firstWon)}
            <text x={x + W - 12} y={y + H - 14} textAnchor="end" fontFamily="Playfair Display, Georgia, serif" fontWeight="700" fontSize="26" fill={s.firstWon ? P.a : P.fg}>{s.score}</text>
          </g>);
        })}
      </svg>
      <div style={{ position: "absolute", bottom: 62, left: 0, right: 0, textAlign: "center", fontFamily: SER, fontWeight: 700, fontSize: 90, color: P.fg }}>{won}<span style={{ color: P.a, fontStyle: "italic", fontWeight: 400 }}> of </span>{shown}<span style={{ fontSize: 36, fontStyle: "italic", fontWeight: 400, color: P.mute, marginLeft: 24 }}>won by the first kicker</span></div>
      <Tags t={t} />
    </Backdrop>
  );
}

/** 13. One real shoot-out, kick by kick, in the order taken (StatsBomb event data). kicks: [{ team, name, result: "GOAL"|"SAVED"|"POST"|"OFF TARGET" }]; home = kicked first. */
export function KickBoard({ t, home, away, kicks, title, date, step = 22, v }) {
  const P = pal(v || "plum"), f = useCurrentFrame(), n = Math.min(kicks.length, Math.max(0, Math.floor((f - 10) / step) + 1));
  const score = { [home]: 0, [away]: 0 }; kicks.slice(0, n).forEach((k) => { if (k.result === "GOAL") score[k.team]++; });
  const rows = { [home]: [], [away]: [] }; kicks.forEach((k, i) => rows[k.team].push({ ...k, i }));
  const col = (team, x) => rows[team].map((k, r) => {
    const a = k.i < n ? ramp(f, 10 + k.i * step, 10 + k.i * step + 10, expo) : 0, ok = k.result === "GOAL";
    return (
      <div key={k.i} style={{ position: "absolute", left: x, top: 380 + r * 108, width: 560, height: 92, display: "flex", alignItems: "center", gap: 20, padding: "0 24px", background: P.tile, borderLeft: `8px solid ${ok ? P.a : P.bad}`, opacity: a, transform: `translateY(${(1 - a) * 22}px)`, boxShadow: "0 8px 20px rgba(0,0,0,0.25)" }}>
        <div style={{ fontFamily: SER, fontStyle: "italic", fontSize: 30, color: P.faint, width: 46 }}>{k.i + 1}</div>
        <div style={{ fontFamily: SER, fontWeight: 700, fontSize: 44, color: P.fg, flex: 1 }}>{k.name}</div>
        <div style={{ fontFamily: SER, fontStyle: "italic", fontWeight: 600, fontSize: 32, color: ok ? P.a : P.bad }}>{sentence(k.result)}</div>
      </div>);
  });
  return (
    <Backdrop v={v || "plum"}>
      <div style={{ position: "absolute", top: 50, left: 0, right: 0, textAlign: "center", fontFamily: SER, fontWeight: 700, fontSize: 48, color: P.fg }}>{titleCase(title)}</div>
      {date && <div style={{ position: "absolute", top: 112, left: 0, right: 0, textAlign: "center", fontFamily: SER, fontStyle: "italic", fontSize: 30, color: P.faint }}>{sentence(date)}</div>}
      <svg width="1920" height="1080" style={{ position: "absolute" }}><Flag t={t} team={home} x={250} y={170} s={120} /><Flag t={t} team={away} x={1550} y={170} s={120} /></svg>
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", fontFamily: SER, fontWeight: 700, fontSize: 160, color: P.fg, lineHeight: 1 }}>{score[home]} – {score[away]}</div>
      <div style={{ position: "absolute", top: 322, left: 280, width: 560, fontFamily: SER, fontStyle: "italic", fontSize: 32, color: P.a }}>{home} · kicked first</div>
      <div style={{ position: "absolute", top: 322, left: 1080, width: 560, fontFamily: SER, fontStyle: "italic", fontSize: 32, color: P.mute }}>{away}</div>
      {col(home, 280)}{col(away, 1080)}
      <Tags t={t} />
    </Backdrop>
  );
}

/** 14. Kick orders drawn as chips: A = team kicking first, B = the other. rows: [{ label, seq: "ABAB...", note }]. */
export function OrderStrip({ t, rows, title, step = 5, v }) {
  const P = pal(v || "plum"), f = useCurrentFrame();
  return (
    <Backdrop v={v || "plum"}>
      <div style={{ position: "absolute", top: 80, left: 0, right: 0, textAlign: "center", fontFamily: SER, fontWeight: 700, fontSize: 56, color: P.fg }}>{titleCase(title)}</div>
      {rows.map((r, ri) => (<div key={ri}>
        <div style={{ position: "absolute", top: 290 + ri * 330, left: 150, fontFamily: SER, fontStyle: "italic", fontWeight: 600, fontSize: 48, color: P.fg }}>{sentence(r.label)}</div>
        {r.seq.split("").map((c, i) => {
          const a = ramp(f, 8 + ri * 70 + i * step, 8 + ri * 70 + i * step + 8, expo), A = c === "A";
          return (<div key={i} style={{ position: "absolute", left: 150 + i * 152, top: 360 + ri * 330, width: 128, height: 128, borderRadius: 64, background: A ? P.a : P.b, color: P.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SER, fontWeight: 700, fontSize: 70, opacity: a, transform: `scale(${0.7 + 0.3 * a})`, boxShadow: "0 10px 22px rgba(0,0,0,0.35)" }}>{c}</div>);
        })}
        {r.note && <div style={{ position: "absolute", top: 510 + ri * 330, left: 150, fontFamily: SER, fontSize: 28, color: P.mute, opacity: ramp(f, 8 + ri * 70 + r.seq.length * step, 8 + ri * 70 + r.seq.length * step + 12) }}>{r.note}</div>}
      </div>))}
      <Tags t={t} credit="Source: Wikipedia, Penalty shoot-out (association football)" />
    </Backdrop>
  );
}

/** 15. Goal seen from the front with the goalkeeper's dive drawn as a wireframe figure (a diagram of the cited percentages, not tracking data).
 * goals: [{ label, right }]  right = percent of dives to the right; the rest is shown as "another way". */
export function GoalDiagram({ t, goals, title, step = 22, v }) {
  const P = pal(v || "plum"), f = useCurrentFrame(), n = goals.length, W = n === 1 ? 760 : 520, gap = 70, x0 = (1920 - (n * W + (n - 1) * gap)) / 2;
  return (
    <Backdrop v={v || "plum"}>
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center", fontFamily: SER, fontWeight: 700, fontSize: 52, color: P.fg }}>{titleCase(title)}</div>
      {goals.map((g, i) => {
        const a = ramp(f, 8 + i * step, 8 + i * step + 12, expo), x = x0 + i * (W + gap), dive = ramp(f, 14 + i * step, 50 + i * step, eio), other = 100 - g.right, Hh = W * 0.52;
        return (<div key={i} style={{ opacity: a }}>
          <svg width="1920" height="1080" style={{ position: "absolute" }}>
            <rect x={x} y={300} width={W} height={Hh} fill="none" stroke={P.fg} strokeWidth="14" />
            {Array.from({ length: 11 }, (_, k) => <line key={k} x1={x + (k + 1) * (W / 12)} y1={300} x2={x + (k + 1) * (W / 12)} y2={300 + Hh} stroke={P.faint} strokeWidth="1.5" />)}
            {Array.from({ length: 6 }, (_, k) => <line key={k} x1={x} y1={300 + (k + 1) * (Hh / 7)} x2={x + W} y2={300 + (k + 1) * (Hh / 7)} stroke={P.faint} strokeWidth="1.5" />)}
            <Mannequin x={x + W / 2 + dive * (g.right / 80) * W * 0.22} y={300 + Hh - 40 - dive * 30} s={W / 1100 + 0.1} rot={dive * (g.right / 80) * 64} swing={0.1} arms="up" glow={P.a} col={P.fg} />
          </svg>
          <div style={{ position: "absolute", left: x, top: 300 + Hh + 30, width: W, textAlign: "center", fontFamily: SER, fontWeight: 700, fontSize: 120, lineHeight: 1, color: P.fg }}>{Math.round(g.right * a)}<span style={{ fontSize: 56 }}>%</span></div>
          <div style={{ position: "absolute", left: x, top: 300 + Hh + 160, width: W, textAlign: "center", fontFamily: SER, fontStyle: "italic", fontSize: 38, color: P.a }}>dived right · {sentence(g.label)}</div>
          <div style={{ position: "absolute", left: x, top: 300 + Hh + 215, width: W, textAlign: "center", fontFamily: SER, fontSize: 26, color: P.mute }}>{other}% went another way</div>
        </div>);
      })}
      <Tags t={t} credit="Source: Wikipedia, 2011 study in Psychological Science · diagram of the reported percentages" />
    </Backdrop>
  );
}

export const RIVAL = { photo: Photo, number: NumberOpen, scorecard: ScoreCard, formation: Formation, sequence: Sequence360, network: PassNetwork, press: PressMap, shots: ShotMap, bars: StatBars, timeline: MatchTimeline, sub: SubCard, thumb: RivalThumb, grid: ShootoutGrid, kicks: KickBoard, order: OrderStrip, goal: GoalDiagram, hero: Hero, cards: Cards };
