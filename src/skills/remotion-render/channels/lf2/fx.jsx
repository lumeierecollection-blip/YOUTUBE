// Faceless-breakout experiment kits (20 Nov 2026): ORIGINAL characters and sets for two formats learned from public channels, without copying them.
//   B "stick": flat 2D line-limb figures ("Pegs": a coloured rounded-square head, dark round-capped limbs, no clothes) in detailed flat rooms, with hexagonal
//              value badges tethered above heads (the format's "see a hidden number" premise drawn our own way: ConChaser uses black round heads and pill tags).
//   C "toon":  soft-shaded 2.5D "Beans" (one capsule body, no neck, big eyes, rim light, ground shadow) on mood-lit gradient sets with game-UI widgets
//              (Jeremy Bearimy uses Blender characters with big spherical heads; ours are 2D-drawn and shaped differently).
// Limits, stated: these are code-drawn SVG rigs (joint angles per pose, procedural walk), not Blender or Rive; no lip sync; no 3D camera.
// Colours come from the theme (config/longform-v2.json "fx-*".fx), never from an episode file.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { F, Fonts, clamp, eio, expo, ramp } from "./kit.jsx";

const R = Math.PI / 180;
const seg = (x, y, len, a) => [x + len * Math.sin(a * R), y + len * Math.cos(a * R)];
// pose: angles in degrees from straight down; positive swings the limb to the figure's right side of the screen. [upper, lower(relative)]
export const POSE = {
  stand: { la: [8, 4], ra: [-8, -4], ll: [4, 0], rl: [-4, 0] },
  wave: { la: [8, 4], ra: [-150, -40], ll: [4, 0], rl: [-4, 0] },
  point: { la: [8, 4], ra: [-95, 0], ll: [6, 0], rl: [-6, 0] },
  shrug: { la: [55, 95], ra: [-55, -95], ll: [5, 0], rl: [-5, 0] },
  cheer: { la: [150, 20], ra: [-150, -20], ll: [10, 0], rl: [-10, 0] },
  facepalm: { la: [8, 4], ra: [-30, -150], ll: [4, 0], rl: [-4, 0] },
  think: { la: [8, 4], ra: [-25, -160], ll: [4, 0], rl: [-4, 0] },
  sit: { la: [20, 30], ra: [-20, -30], ll: [-80, 85], rl: [-75, 85] },
  slump: { la: [2, 2], ra: [-2, -2], ll: [3, 0], rl: [-3, 0], lean: 10, drop: 10 },
};
const mix = (a, b, k) => ({ la: a.la.map((v, i) => v + (b.la[i] - v) * k), ra: a.ra.map((v, i) => v + (b.ra[i] - v) * k), ll: a.ll.map((v, i) => v + (b.ll[i] - v) * k), rl: a.rl.map((v, i) => v + (b.rl[i] - v) * k), lean: (a.lean || 0) + ((b.lean || 0) - (a.lean || 0)) * k, drop: (a.drop || 0) + ((b.drop || 0) - (a.drop || 0)) * k });

function Face({ mood = "neutral", look = 0, ink, w = 120 }) {
  const ex = 24, ey = -8, px = look * 5;
  const brow = { neutral: [0, 0], happy: [-4, -4], sad: [10, -10], angry: [-12, 12], shock: [-10, -10], smug: [-6, 6] }[mood] || [0, 0];
  const mouth = { neutral: "M -14 30 L 14 30", happy: "M -20 24 Q 0 46 20 24", sad: "M -16 38 Q 0 24 16 38", angry: "M -16 34 L 16 30", shock: null, smug: "M -16 30 Q 6 40 20 24" }[mood] ?? "M -14 30 L 14 30";
  return <g>
    {[-1, 1].map((s) => <g key={s}>
      <ellipse cx={s * ex} cy={ey} rx={mood === "shock" ? 13 : 11} ry={mood === "shock" ? 15 : 13} fill="#fff" />
      <circle cx={s * ex + px} cy={ey + 2} r={mood === "shock" ? 4 : 6} fill={ink} />
      <line x1={s * ex - 13} y1={ey - 22 + (s < 0 ? brow[0] : brow[1]) * 0.5} x2={s * ex + 13} y2={ey - 22 + (s < 0 ? brow[1] : brow[0]) * 0.5} stroke={ink} strokeWidth={5} strokeLinecap="round" transform={`rotate(${s * (s < 0 ? brow[0] : -brow[1]) * 0.8} ${s * ex} ${ey - 22})`} />
    </g>)}
    {mouth ? <path d={mouth} stroke={ink} strokeWidth={6} fill="none" strokeLinecap="round" /> : <ellipse cx={0} cy={32} rx={10} ry={13} fill={ink} />}
  </g>;
}

/** A Peg: feet at (x, y). walk {from, dur, to} moves it with a procedural gait. */
export function Peg({ x = 0, y = 0, s = 1, color = "#F2B134", ink = "#1F2433", pose = "stand", pose2, poseAt = 0, mood = "neutral", look = 0, flip = 1, walk, from = 0 }) {
  const f = useCurrentFrame();
  let P = POSE[pose] || POSE.stand; if (pose2) P = mix(P, POSE[pose2], ramp(f, poseAt, poseAt + 10, eio));
  let X = x, step = 0;
  if (walk) { const k = ramp(f, walk.from, walk.from + walk.dur, eio); X = x + (walk.to - x) * k; if (k > 0 && k < 1) step = Math.sin(f * 0.45); }
  const br = Math.sin(f / 16) * 2.5, pop = ramp(f, from, from + 10, expo);
  const L = { ...P, ll: [P.ll[0] + step * 24, P.ll[1] + Math.max(0, -step) * 20], rl: [P.rl[0] - step * 24, P.rl[1] + Math.max(0, step) * 20], la: [P.la[0] - step * 16, P.la[1]], ra: [P.ra[0] + step * 16, P.ra[1]] };
  const hip = [0, -170 + (P.drop || 0)], neck = [0, -320 + br + (P.drop || 0)], sh = [0, -300 + br + (P.drop || 0)];
  const limb = (o, [a1, a2], l1, l2, foot) => { const k = seg(o[0], o[1], l1, a1), e = seg(k[0], k[1], l2, a1 + a2); return <g><path d={`M ${o[0]} ${o[1]} L ${k[0]} ${k[1]} L ${e[0]} ${e[1]}`} stroke={ink} strokeWidth={13} fill="none" strokeLinecap="round" strokeLinejoin="round" />{foot ? <ellipse cx={e[0] + 10} cy={e[1]} rx={18} ry={8} fill={ink} /> : <circle cx={e[0]} cy={e[1]} r={10} fill={ink} />}</g>; };
  return <g transform={`translate(${X} ${y}) scale(${s * flip * pop} ${s * pop})`} opacity={pop}>
    <ellipse cx={0} cy={4} rx={70} ry={12} fill="rgba(0,0,0,0.12)" />
    <g transform={`rotate(${P.lean || 0} 0 ${hip[1]})`}>
      {limb(hip, L.rl, 90, 86, true)}{limb(hip, L.ll, 90, 86, true)}
      <line x1={hip[0]} y1={hip[1]} x2={neck[0]} y2={neck[1]} stroke={ink} strokeWidth={14} strokeLinecap="round" />
      {limb(sh, L.ra, 80, 74)}{limb(sh, L.la, 80, 74)}
      <g transform={`translate(0 ${neck[1] - 74})`}>
        <rect x={-62} y={-66} width={124} height={132} rx={38} fill={color} stroke={ink} strokeWidth={7} />
        <Face mood={mood} look={look} ink={ink} />
      </g>
    </g>
  </g>;
}

/** Hexagonal value badge tethered above a head. tone: low | mid | high (colours from theme). */
export function Badge({ x, y, value, label, tone = "mid", t, from = 0, to }) {
  // to: { value, tone?, at } ticks the badge to a new value with a pop (a lie counted on screen)
  const f = useCurrentFrame(), a = ramp(f, from, from + 12, expo), bob = Math.sin((f + x) / 18) * 4, on = to && f >= to.at, pulse = to ? Math.max(0, 1 - Math.abs(f - to.at) / 8) : 0;
  if (on) { value = to.value; tone = to.tone || tone; }
  const c = t.fx.tone[tone] || t.fx.tone.mid;
  const hx = (r) => [0, 1, 2, 3, 4, 5].map((i) => `${r * Math.cos((60 * i - 90) * R) * 1.6},${r * Math.sin((60 * i - 90) * R)}`).join(" ");
  return <g transform={`translate(${x} ${y + bob - (1 - a) * 30}) scale(${1 + pulse * 0.25})`} opacity={a}>
    <line x1={0} y1={46} x2={0} y2={92} stroke={c} strokeWidth={3} strokeDasharray="5 6" />
    <polygon points={hx(48)} fill={c} stroke="#fff" strokeWidth={5} />
    <text x={0} y={label ? 4 : 14} textAnchor="middle" fontFamily={F.grot} fontWeight={800} fontSize={label ? 38 : 44} fill="#fff">{value}</text>
    {label && <text x={0} y={30} textAnchor="middle" fontFamily={F.grot} fontWeight={700} fontSize={15} letterSpacing="0.12em" fill="#fff" opacity={0.92}>{label.toUpperCase()}</text>}
  </g>;
}

function Say({ x, y, text, from = 0, t, w = 380 }) {
  const f = useCurrentFrame(), a = ramp(f, from, from + 8, expo);
  return <div style={{ position: "absolute", left: x - w / 2, top: y, width: w, padding: "14px 20px", background: "#fff", border: `4px solid ${t.fx.ink}`, borderRadius: 26, fontFamily: F.grot, fontWeight: 700, fontSize: 30, color: t.fx.ink, textAlign: "center", opacity: a, transform: `scale(${0.8 + 0.2 * a})` }}>{text}</div>;
}

// ---- flat rooms for B (1920x1080 user units). Detailed enough that the frame is never an empty colour field.
function Room({ kind = "classroom", t }) {
  const c = t.fx.room, ink = t.fx.ink, floorY = 820;
  const win = (x, y, w, h) => <g><rect x={x} y={y} width={w} height={h} fill={c.sky} stroke={ink} strokeWidth={6} /><line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke={ink} strokeWidth={5} /><line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={ink} strokeWidth={5} /><circle cx={x + w * 0.75} cy={y + h * 0.28} r={26} fill={c.sun} /></g>;
  const base = <><rect width={1920} height={floorY} fill={c.wall} /><rect y={floorY} width={1920} height={260} fill={c.floor} /><rect y={floorY - 14} width={1920} height={16} fill={c.trim} />{[...Array(9)].map((_, i) => <line key={i} x1={i * 240} y1={floorY} x2={i * 240 - 120} y2={1080} stroke={c.floorLine} strokeWidth={3} />)}</>;
  if (kind === "classroom") return <>{base}
    <rect x={560} y={150} width={800} height={380} rx={10} fill={c.board} stroke={c.trim} strokeWidth={16} />
    {[0, 1, 2].map((i) => <path key={i} d={`M ${620} ${230 + i * 80} q 120 -26 240 0 t 240 0`} stroke="rgba(255,255,255,0.55)" strokeWidth={5} fill="none" />)}
    <text x={1240} y={500} fontFamily={F.grot} fontWeight={700} fontSize={36} fill="rgba(255,255,255,0.6)">x = ?</text>
    {win(100, 170, 300, 300)}{win(1520, 170, 300, 300)}
    <circle cx={1440} cy={110} r={44} fill="#fff" stroke={ink} strokeWidth={6} /><line x1={1440} y1={110} x2={1440} y2={82} stroke={ink} strokeWidth={5} /><line x1={1440} y1={110} x2={1462} y2={118} stroke={ink} strokeWidth={5} />
    {[260, 1660].map((dx) => <g key={dx}><rect x={dx - 140} y={760} width={280} height={26} fill={c.desk} stroke={ink} strokeWidth={5} /><rect x={dx - 120} y={786} width={16} height={60} fill={ink} /><rect x={dx + 104} y={786} width={16} height={60} fill={ink} /></g>)}
  </>;
  if (kind === "kitchen") return <>{base}
    {win(760, 150, 400, 300)}
    <rect x={0} y={600} width={1920} height={220} fill={c.counter} stroke={ink} strokeWidth={6} /><rect x={0} y={590} width={1920} height={20} fill={c.trim} />
    {[...Array(8)].map((_, i) => <rect key={i} x={40 + i * 240} y={640} width={200} height={150} rx={8} fill="none" stroke={ink} strokeWidth={4} />)}
    {[...Array(4)].map((_, i) => <rect key={i} x={120 + i * 180 + (i > 1 ? 840 : 0)} y={120} width={150} height={220} rx={8} fill={c.desk} stroke={ink} strokeWidth={5} />)}
    <rect x={1640} y={250} width={220} height={570} rx={18} fill="#E9EEF2" stroke={ink} strokeWidth={6} /><line x1={1640} y1={450} x2={1860} y2={450} stroke={ink} strokeWidth={5} />
  </>;
  if (kind === "street") return <>
    <rect width={1920} height={1080} fill={c.sky} /><circle cx={1600} cy={170} r={70} fill={c.sun} />
    {[[0, 260, 330], [340, 160, 260], [610, 300, 380], [1000, 200, 300], [1310, 120, 340], [1660, 240, 260]].map(([x, top, w], i) => <g key={i}><rect x={x} y={top} width={w} height={820 - top} fill={i % 2 ? c.wall : c.desk} stroke={ink} strokeWidth={6} />{[...Array(Math.floor((760 - top) / 110))].map((_, r) => [...Array(Math.floor(w / 90))].map((_, q) => <rect key={`${r}-${q}`} x={x + 24 + q * 90} y={top + 30 + r * 110} width={50} height={64} fill={c.sky} stroke={ink} strokeWidth={4} />))}</g>)}
    <rect y={820} width={1920} height={70} fill={c.trim} /><rect y={890} width={1920} height={190} fill={c.floor} />{[...Array(10)].map((_, i) => <rect key={i} x={i * 210 + 40} y={975} width={110} height={14} fill="#fff" opacity={0.7} />)}
    <line x1={300} y1={820} x2={300} y2={480} stroke={ink} strokeWidth={10} /><rect x={262} y={450} width={76} height={40} rx={10} fill={c.sun} stroke={ink} strokeWidth={6} />
  </>;
  // bedroom
  return <>{base}
    {win(1300, 150, 360, 300)}
    <rect x={160} y={560} width={720} height={200} rx={20} fill={c.desk} stroke={ink} strokeWidth={6} /><rect x={160} y={480} width={120} height={140} rx={20} fill={c.counter} stroke={ink} strokeWidth={6} /><rect x={300} y={520} width={540} height={90} rx={30} fill="#fff" stroke={ink} strokeWidth={6} />
    <rect x={560} y={140} width={240} height={300} fill={c.board} stroke={ink} strokeWidth={6} /><path d="M 600 400 L 680 260 L 760 400 Z" fill={c.sun} />
    <rect x={1000} y={600} width={140} height={220} fill={c.counter} stroke={ink} strokeWidth={6} /><path d="M 1030 600 L 1110 600 L 1140 520 L 1000 520 Z" fill={c.sun} stroke={ink} strokeWidth={6} />
  </>;
}

/** B: a room with a cast. cast: [{ id (theme cast key), x, y?, s?, pose, pose2, poseAt, mood, look, flip, walk, from, badge:{value,label,tone,from}, say:{text,from} }] */
export function FxRoom({ t, room = "classroom", cast = [], caption, push = 0.05 }) {
  const f = useCurrentFrame(), { durationInFrames: D } = useVideoConfig(), z = 1 + push * interpolate(f, [0, D], [0, 1], clamp);
  return <AbsoluteFill style={{ background: t.fx.room.wall, overflow: "hidden" }}>
    <Fonts />
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, transform: `scale(${z})`, transformOrigin: "50% 60%" }}>
      <Room kind={room} t={t} />
      {cast.map((m, i) => <Peg key={i} {...m} y={m.y ?? 960} color={t.fx.cast[m.id]?.color} ink={t.fx.ink} />)}
      {cast.filter((m) => m.badge).map((m, i) => <Badge key={`b${i}`} t={t} x={m.walk ? m.walk.to : m.x} y={(m.y ?? 960) - 590 * (m.s || 1)} {...m.badge} />)}
    </svg>
    {cast.filter((m) => m.say).map((m, i) => <Say key={`s${i}`} t={t} x={m.x} y={(m.y ?? 960) - 560 * (m.s || 1) - 260} {...m.say} />)}
    {caption && <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, textAlign: "center" }}><span style={{ background: t.fx.ink, color: "#fff", fontFamily: F.grot, fontWeight: 700, fontSize: 34, padding: "10px 24px", borderRadius: 14 }}>{caption}</span></div>}
  </AbsoluteFill>;
}

/** B: explainer chart on paper (bell curve with a marker, or bars). */
export function FxChart({ t, title, kind = "bell", marker, bars = [], note }) {
  const f = useCurrentFrame(), a = ramp(f, 6, 40, eio), ink = t.fx.ink;
  const pts = [...Array(121)].map((_, i) => { const x = -3 + i / 20, y = Math.exp(-x * x / 2); return [960 + x * 230, 840 - y * 520]; });
  const cut = Math.max(2, Math.round(pts.length * a));
  return <AbsoluteFill style={{ background: t.fx.paper }}>
    <Fonts />
    <div style={{ position: "absolute", left: 0, right: 0, top: 60, textAlign: "center", fontFamily: F.grot, fontWeight: 800, fontSize: 64, color: ink }}>{title}</div>
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <line x1={220} y1={840} x2={1700} y2={840} stroke={ink} strokeWidth={6} />
      {kind === "bell" ? <><path d={`M ${pts.slice(0, cut).map((p) => p.join(" ")).join(" L ")} L ${pts[cut - 1][0]} 840 L ${pts[0][0]} 840 Z`} fill={t.fx.tone.mid} opacity={0.35} /><path d={`M ${pts.slice(0, cut).map((p) => p.join(" ")).join(" L ")}`} stroke={ink} strokeWidth={7} fill="none" /></>
        : bars.map((b, i) => { const h = b.v * 520 * a, w = 1200 / bars.length; return <g key={i}><rect x={260 + i * w + 20} y={840 - h} width={w - 40} height={h} fill={t.fx.tone[b.tone || "mid"]} stroke={ink} strokeWidth={5} /><text x={260 + i * w + w / 2} y={890} textAnchor="middle" fontFamily={F.grot} fontWeight={700} fontSize={30} fill={ink}>{b.label}</text></g>; })}
      {marker && (() => { const m = ramp(f, 40, 56, expo), x = 960 + marker.x * 230; return <g opacity={m}><line x1={x} y1={840} x2={x} y2={280} stroke={t.fx.tone[marker.tone || "low"]} strokeWidth={6} strokeDasharray="14 10" /><text x={x} y={260} textAnchor="middle" fontFamily={F.grot} fontWeight={800} fontSize={38} fill={t.fx.tone[marker.tone || "low"]}>{marker.label}</text></g>; })()}
    </svg>
    {note && <div style={{ position: "absolute", left: 0, right: 0, bottom: 60, textAlign: "center", fontFamily: F.sans, fontSize: 26, color: ink, opacity: 0.7 }}>{note}</div>}
  </AbsoluteFill>;
}

export function FxTitle({ t, text, sub, dark = true }) {
  const f = useCurrentFrame(), a = ramp(f, 4, 22, expo), bg = dark ? t.fx.ink : t.fx.paper, fg = dark ? "#fff" : t.fx.ink;
  return <AbsoluteFill style={{ background: bg, alignItems: "center", justifyContent: "center" }}><Fonts />
    <div style={{ fontFamily: F.grot, fontWeight: 800, fontSize: 96, color: fg, opacity: a, transform: `scale(${0.94 + 0.06 * a})`, textAlign: "center", maxWidth: 1500 }}>{text}</div>
    {sub && <div style={{ fontFamily: F.grot, fontWeight: 600, fontSize: 40, color: t.fx.tone.mid, marginTop: 24, opacity: ramp(f, 16, 30) }}>{sub}</div>}
  </AbsoluteFill>;
}

// ---- C: Beans on mood-lit sets
export function Bean({ x, y = 900, s = 1, color = "#6EC6FF", mood = "neutral", look = 0, arm = "down", from = 0, hop = 0 }) {
  const f = useCurrentFrame(), pop = ramp(f, from, from + 12, expo), sq = 1 + Math.sin(f / 14) * 0.015, jump = hop ? Math.abs(Math.sin(f / 7)) * hop : 0, id = `bn${Math.round(x)}${color.slice(1)}`;
  const armA = { down: [18, 18], up: [160, 160], wave: [18, 140], cross: [-35, -35], point: [18, 95] }[arm] || [18, 18];   // outward angles per side [left, right]
  return <g transform={`translate(${x} ${y - jump}) scale(${s * pop} ${s * pop * sq})`} opacity={pop}>
    <defs><radialGradient id={id} cx="38%" cy="30%" r="75%"><stop offset="0%" stopColor="#fff" stopOpacity={0.55} /><stop offset="35%" stopColor={color} /><stop offset="100%" stopColor={color} stopOpacity={1} /></radialGradient>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0"><stop offset="60%" stopColor="#000" stopOpacity={0} /><stop offset="100%" stopColor="#000" stopOpacity={0.28} /></linearGradient></defs>
    <ellipse cx={0} cy={6 + jump} rx={110 - jump * 0.3} ry={20} fill="rgba(0,0,0,0.28)" />
    <rect x={-104} y={-420} width={208} height={420} rx={104} fill={`url(#${id})`} />
    <rect x={-104} y={-420} width={208} height={420} rx={104} fill={`url(#${id}s)`} />
    <rect x={-104} y={-420} width={208} height={420} rx={104} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={4} />
    {[-1, 1].map((sd) => { const a = sd < 0 ? armA[0] : armA[1]; return <rect key={sd} x={-15} y={-6} width={30} height={120} rx={15} fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth={3} transform={`translate(${sd * 100} -220) rotate(${sd < 0 ? a : -a})`} />; })}   {/* arms drawn over the body edge so they read */}
    <g transform="translate(0 -300)">{[-1, 1].map((sd) => <g key={sd}><ellipse cx={sd * 40} cy={0} rx={30} ry={mood === "shock" ? 40 : 34} fill="#fff" /><circle cx={sd * 40 + look * 8} cy={4} r={15} fill="#16131F" /><circle cx={sd * 40 + look * 8 + 6} cy={-4} r={5} fill="#fff" /></g>)}
      <path d={{ happy: "M -34 60 Q 0 92 34 60", sad: "M -30 78 Q 0 54 30 78", shock: "M -14 66 Q 0 92 14 66 Z", smug: "M -30 66 Q 10 80 34 56" }[mood] || "M -24 68 L 24 68"} stroke="#16131F" strokeWidth={8} fill={mood === "shock" ? "#16131F" : "none"} strokeLinecap="round" /></g>
  </g>;
}

function Set({ kind = "gym", t }) {
  const c = t.fx.sets[kind] || t.fx.sets.gym;
  return <>
    <defs><linearGradient id="fxw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c.top} /><stop offset="100%" stopColor={c.wall} /></linearGradient>
      <radialGradient id="fxl" cx="50%" cy="25%" r="60%"><stop offset="0%" stopColor={c.light} stopOpacity={0.7} /><stop offset="100%" stopColor={c.light} stopOpacity={0} /></radialGradient>
      <linearGradient id="fxf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c.floor} /><stop offset="100%" stopColor={c.floorDark} /></linearGradient></defs>
    <rect width={1920} height={700} fill="url(#fxw)" /><rect y={700} width={1920} height={380} fill="url(#fxf)" />
    {[...Array(13)].map((_, i) => <line key={i} x1={960} y1={700} x2={-1200 + i * 360} y2={1080} stroke="rgba(255,255,255,0.08)" strokeWidth={3} />)}
    {[760, 840, 950].map((y, i) => <line key={i} x1={0} y1={y} x2={1920} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={3} />)}
    {kind === "gym" && <><rect x={160} y={180} width={360} height={260} rx={10} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth={6} /><line x1={1700} y1={140} x2={1700} y2={520} stroke="rgba(255,255,255,0.3)" strokeWidth={12} /><rect x={1560} y={140} width={280} height={180} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={8} /><circle cx={1700} cy={360} r={50} fill="none" stroke={c.accent} strokeWidth={10} /></>}
    {kind === "classroom" && <><rect x={560} y={150} width={800} height={360} rx={14} fill="rgba(10,40,30,0.75)" stroke="rgba(255,255,255,0.2)" strokeWidth={10} />{[...Array(4)].map((_, i) => <rect key={i} x={120 + i * 480} y={720} width={240} height={30} rx={8} fill="rgba(255,255,255,0.12)" />)}</>}
    {kind === "bedroom" && <><rect x={1300} y={160} width={380} height={300} rx={14} fill="rgba(160,190,255,0.25)" stroke="rgba(255,255,255,0.25)" strokeWidth={8} /><rect x={140} y={560} width={700} height={220} rx={40} fill="rgba(255,255,255,0.12)" /></>}
    {kind === "street" && [...Array(6)].map((_, i) => <rect key={i} x={i * 330} y={160 + (i % 3) * 60} width={290} height={540 - (i % 3) * 60} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.15)" strokeWidth={4} />)}
    <rect width={1920} height={1080} fill="url(#fxl)" />
  </>;
}

function Ui({ u, t, f }) {
  const a = ramp(f, u.from || 0, (u.from || 0) + 12, expo), ac = t.fx.ui;
  const box = { position: "absolute", left: u.x, top: u.y, opacity: a, transform: `translateY(${(1 - a) * 20}px)`, fontFamily: F.grot, color: "#fff" };
  if (u.kind === "counter") { const v = Math.round(interpolate(f, [u.from || 0, (u.from || 0) + (u.dur || 40)], [u.start || 0, u.value], { ...clamp, easing: eio })); return <div style={{ ...box, background: "rgba(10,10,20,0.6)", border: `3px solid ${ac}`, borderRadius: 18, padding: "12px 26px" }}><div style={{ fontSize: 20, letterSpacing: "0.3em", opacity: 0.8 }}>{u.label.toUpperCase()}</div><div style={{ fontSize: 72, fontWeight: 800 }}>{u.prefix || ""}{v.toLocaleString("en-US")}{u.suffix || ""}</div></div>; }
  if (u.kind === "timer") { const k = interpolate(f, [u.from || 0, (u.from || 0) + (u.dur || 150)], [1, 0], clamp); return <svg style={{ ...box, width: 170, height: 170 }} viewBox="0 0 170 170"><circle cx={85} cy={85} r={70} fill="rgba(10,10,20,0.6)" stroke="rgba(255,255,255,0.2)" strokeWidth={12} /><circle cx={85} cy={85} r={70} fill="none" stroke={ac} strokeWidth={12} strokeDasharray={`${440 * k} 440`} transform="rotate(-90 85 85)" strokeLinecap="round" /><text x={85} y={98} textAnchor="middle" fontSize={40} fontWeight={800} fill="#fff" fontFamily={F.grot}>{Math.ceil(k * (u.seconds || 60))}s</text></svg>; }
  if (u.kind === "bar") { const k = ramp(f, u.from || 0, (u.from || 0) + (u.dur || 40), eio) * u.value; return <div style={{ ...box, width: u.w || 520 }}><div style={{ fontSize: 22, letterSpacing: "0.3em", marginBottom: 8 }}>{u.label.toUpperCase()}</div><div style={{ height: 28, borderRadius: 14, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}><div style={{ width: `${k * 100}%`, height: "100%", background: ac, borderRadius: 14 }} /></div></div>; }
  return <div style={{ ...box, background: ac, color: "#111", borderRadius: 40, padding: "10px 28px", fontSize: 28, fontWeight: 800, letterSpacing: "0.18em" }}>{u.label.toUpperCase()}</div>;   // chip
}

/** C: a set with Beans and UI. cast: [{ id, x, y?, s?, mood, look, arm, from, hop }], ui: [{ kind: counter|timer|bar|chip, x, y, ... }], links: [[i, j, from]] glowing lines between cast */
export function FxToon({ t, set = "gym", cast = [], ui = [], links = [], push = 0.06, caption }) {
  const f = useCurrentFrame(), { durationInFrames: D } = useVideoConfig(), z = 1 + push * interpolate(f, [0, D], [0, 1], clamp), ac = t.fx.ui;
  return <AbsoluteFill style={{ background: "#111", overflow: "hidden" }}>
    <Fonts />
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, transform: `scale(${z})`, transformOrigin: "50% 55%" }}>
      <Set kind={set} t={t} />
      {links.map(([i, j, from = 0], n) => { const A = cast[i], B = cast[j], k = ramp(f, from, from + 20, eio); if (!A || !B) return null; const ay = (A.y ?? 900) - 300 * (A.s || 1), by = (B.y ?? 900) - 300 * (B.s || 1), mx = A.x + (B.x - A.x) * k, my = ay + (by - ay) * k; return <g key={n}><line x1={A.x} y1={ay} x2={mx} y2={my} stroke={ac} strokeWidth={14} opacity={0.3} strokeLinecap="round" /><line x1={A.x} y1={ay} x2={mx} y2={my} stroke="#fff" strokeWidth={5} strokeLinecap="round" /></g>; })}
      {cast.map((m, i) => <Bean key={i} {...m} color={t.fx.cast[m.id]?.color} />)}
    </svg>
    {ui.map((u, i) => <Ui key={i} u={u} t={t} f={f} />)}
    {caption && <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, textAlign: "center", fontFamily: F.grot, fontWeight: 800, fontSize: 44, letterSpacing: "0.22em", color: "#fff", textShadow: `0 0 24px ${ac}` }}>{caption.toUpperCase()}</div>}
  </AbsoluteFill>;
}

export const FX = { fxroom: FxRoom, fxchart: FxChart, fxtitle: FxTitle, fxtoon: FxToon };
