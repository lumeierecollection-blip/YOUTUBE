// Pilot B kit, rebuilt 20 Nov 2026 from MEASURED reference frames (faceless-breakout-experiment/research/conchaser/full-sheet.jpg), after the owner's
// note that the first kit looked nothing like the channel. The grammar measured there:
//   solid black round heads with a thin cream rim light, big simple white eyes; clothes carry identity (hoodies, blazers, tracksuits) over thin black limbs;
//   mostly close-ups and medium shots; detailed, warm-lit sets drawn behind the characters and BLURRED (shallow depth of field) with lamp glows and a vignette;
//   rounded pill tags (green high / red low) with white text and outline; a dark pill lower-third with spaced caps for names.
// Ours keeps that production grammar with our own characters, names, sets and story. Code-drawn SVG: no lip sync, no 3D.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { F, Fonts, clamp, eio, expo, ramp } from "./kit.jsx";

const D2R = Math.PI / 180, INK = "#0D0D10", RIM = "#F3E3C2";
const pt = (x, y, l, a) => [x + l * Math.sin(a * D2R), y + l * Math.cos(a * D2R)];
// pose angles in degrees from straight down; positive swings toward screen right. [upper, lower(absolute)]
export const KPOSE = {
  stand: { la: [10, 6], ra: [-10, -6], ll: [3, 2], rl: [-3, -2] },
  hips: { la: [40, -30], ra: [-40, 30], ll: [5, 3], rl: [-5, -3] },
  wave: { la: [10, 6], ra: [-120, -165], ll: [3, 2], rl: [-3, -2] },
  point: { la: [10, 6], ra: [-80, -95], ll: [4, 2], rl: [-4, -2] },
  shrug: { la: [40, 120], ra: [-40, -120], ll: [3, 2], rl: [-3, -2] },
  cheer: { la: [140, 170], ra: [-140, -170], ll: [8, 4], rl: [-8, -4] },
  facepalm: { la: [10, 6], ra: [-25, -170], ll: [3, 2], rl: [-3, -2] },
  think: { la: [25, 100], ra: [-20, -165], ll: [3, 2], rl: [-3, -2] },
  slump: { la: [4, 2], ra: [-4, -2], ll: [2, 1], rl: [-2, -1], drop: 14, tilt: 12 },
  sit: { la: [20, 70], ra: [-20, -70], ll: [-85, 0], rl: [-80, 0], sit: true },
};
// moods: eyes (white rings with black pupils, or shapes) + mouth (white)
function Face({ mood = "neutral", look = 0 }) {
  const px = look * 6, E = (s) => {
    if (mood === "happy") return <path d={`M ${s * 26 - 14} -2 Q ${s * 26} -18 ${s * 26 + 14} -2`} stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" />;
    if (mood === "smug") return <g><ellipse cx={s * 26} cy={-4} rx={15} ry={9} fill="#fff" /><circle cx={s * 26 + px} cy={-2} r={5} fill={INK} /><rect x={s * 26 - 17} y={-18} width={34} height={11} fill={INK} /></g>;
    if (mood === "sad") return <g><ellipse cx={s * 26} cy={-2} rx={13} ry={15} fill="#fff" /><circle cx={s * 26 + px} cy={2} r={6} fill={INK} /><path d={`M ${s * 26 - 16} ${-20 + (s > 0 ? -6 : 6) * -1} L ${s * 26 + 16} ${-20 + (s > 0 ? 6 : -6) * -1}`} stroke={INK} strokeWidth={8} /></g>;
    const r = mood === "shock" ? 19 : 15;
    return <g><circle cx={s * 26} cy={-4} r={r} fill="#fff" /><circle cx={s * 26 + px} cy={-3} r={mood === "shock" ? 6 : 7} fill={INK} />{mood === "angry" && <path d={`M ${s * 26 - 18} ${-24 - (s < 0 ? 6 : -6)} L ${s * 26 + 18} ${-24 + (s < 0 ? 6 : -6)}`} stroke={INK} strokeWidth={9} />}</g>;
  };
  const M = { neutral: <path d="M -12 34 L 12 34" stroke="#fff" strokeWidth={5} strokeLinecap="round" />, happy: <path d="M -18 28 Q 0 46 18 28 Z" fill="#fff" />, sad: <path d="M -14 40 Q 0 28 14 40" stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" />, shock: <ellipse cx={0} cy={36} rx={10} ry={14} fill="#fff" />, smug: <path d="M -14 34 Q 4 42 18 28" stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" />, angry: <path d="M -14 38 L 14 34" stroke="#fff" strokeWidth={5} strokeLinecap="round" /> };
  return <g>{E(-1)}{E(1)}{M[mood] || M.neutral}</g>;
}
const HAIR = {
  none: null,
  bun: <circle cx={0} cy={-74} r={22} fill={INK} stroke={RIM} strokeWidth={3} strokeOpacity={0.7} />,
  curls: <g>{[-50, -25, 0, 25, 50].map((x, i) => <circle key={i} cx={x} cy={-58 + Math.abs(x) * 0.3} r={16} fill="none" stroke="#3A3A44" strokeWidth={4} />)}</g>,
  band: <rect x={-62} y={-36} width={124} height={12} rx={6} fill="#F2C94C" />,
  cap: <path d="M -60 -30 Q 0 -96 60 -30 L 92 -24 L 60 -16 Z" fill="#2E6F4E" />,
  bob: <path d="M -66 10 Q -72 -66 0 -68 Q 72 -66 66 10 L 52 10 Q 54 -40 0 -44 Q -54 -40 -52 10 Z" fill="#1A1A20" />,
};

/** A Kid: feet at (x, y). Clothing colours come from the theme cast entry { top, pants, accent, hair }. */
export function Kid({ x = 0, y = 960, s = 1, look = 0, mood = "neutral", pose = "stand", pose2, poseAt = 0, flip = 1, walk, from = 0, c = {} }) {
  const f = useCurrentFrame(), k2 = pose2 ? ramp(f, poseAt, poseAt + 10, eio) : 0, A = KPOSE[pose] || KPOSE.stand, B = KPOSE[pose2] || A;
  const P = Object.fromEntries(["la", "ra", "ll", "rl"].map((n) => [n, A[n].map((v, i) => v + (B[n][i] - v) * k2)]));
  let X = x, step = 0; if (walk) { const w = ramp(f, walk.from, walk.from + walk.dur, eio); X = x + (walk.to - x) * w; if (w > 0 && w < 1) step = Math.sin(f * 0.42); }
  const drop = (A.drop || 0), br = Math.sin(f / 18) * 2, pop = ramp(f, from, from + 10, expo), sit = A.sit;
  const hipY = -150 + drop + (sit ? 60 : 0), shY = -262 + drop + br, headY = -340 + drop + br;
  const top = c.top || "#E9B52F", pants = c.pants || "#2B2F3A";
  const limb = (o, a, l1, l2, w, col, end) => { const k = pt(o[0], o[1], l1, a[0]), e = pt(k[0], k[1], l2, a[1]); return <g><path d={`M ${o[0]} ${o[1]} L ${k[0]} ${k[1]} L ${e[0]} ${e[1]}`} stroke={col} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />{end === "hand" ? <circle cx={e[0]} cy={e[1]} r={10} fill={INK} /> : end === "shoe" ? <ellipse cx={e[0] + 12} cy={e[1] + 2} rx={22} ry={10} fill={INK} /> : null}</g>; };
  const ll = [P.ll[0] + step * 22, P.ll[1] + step * 30], rl = [P.rl[0] - step * 22, P.rl[1] - step * 30];
  return <g transform={`translate(${X} ${y}) scale(${s * flip * pop} ${s * pop})`} opacity={pop}>
    <ellipse cx={0} cy={4} rx={60} ry={10} fill="rgba(0,0,0,0.22)" />
    {/* legs: thin black limbs, trousers on the thigh */}
    {limb([-16, hipY], rl, 78, 80, 15, INK, "shoe")}{limb([16, hipY], ll, 78, 80, 15, INK, "shoe")}
    {limb([-16, hipY], [rl[0], rl[0]], 70, 0, 26, pants)}{limb([16, hipY], [ll[0], ll[0]], 70, 0, 26, pants)}
    {/* torso: a hoodie / jacket shape in the clothing colour, rim light on the lit edge */}
    <path d={`M -44 ${shY} Q 0 ${shY - 12} 44 ${shY} L 50 ${hipY + 8} Q 0 ${hipY + 18} -50 ${hipY + 8} Z`} fill={top} stroke={RIM} strokeOpacity={0.35} strokeWidth={3} />
    {c.accent && <path d={`M -8 ${shY} L 0 ${hipY} L 8 ${shY}`} fill={c.accent} />}
    <path d={`M -44 ${shY} Q 0 ${shY - 12} 44 ${shY} L 50 ${hipY + 8} Q 0 ${hipY + 18} -50 ${hipY + 8} Z`} fill="url(#kshade)" />
    {/* arms: sleeves in the top colour, black hands */}
    {limb([-40, shY + 10], [P.ra[0], P.ra[1]], 74, 68, 24, top, "hand")}{limb([40, shY + 10], [P.la[0], P.la[1]], 74, 68, 24, top, "hand")}
    {/* head */}
    <g transform={`translate(0 ${headY}) rotate(${A.tilt || 0})`}>
      <path d={`M -70 70 Q 0 30 70 70 Q 60 104 0 100 Q -60 104 -70 70 Z`} fill={top} stroke={RIM} strokeOpacity={0.3} strokeWidth={3} />   {/* hood collar */}
      <rect x={-16} y={50} width={32} height={30} fill={INK} />
      <circle r={66} fill={INK} />
      <path d="M -54 -38 A 66 66 0 0 1 30 -59" stroke={RIM} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.9} />
      {HAIR[c.hair || "none"]}
      <Face mood={mood} look={look} />
    </g>
  </g>;
}

// ---- sets: detailed and warm, drawn at 1920x1080, then blurred behind the cast
const win = (x, y, w, h, sky = "#BFD8E6") => <g><rect x={x} y={y} width={w} height={h} fill={sky} /><rect x={x} y={y} width={w} height={h} fill="url(#kglass)" /><rect x={x} y={y} width={w} height={h} fill="none" stroke="#6E5A45" strokeWidth={10} /><line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#6E5A45" strokeWidth={7} /></g>;
const lamp = (x, y, r = 260, col = "rgba(255,214,150,0.55)") => <circle cx={x} cy={y} r={r} fill="url(#kglow)" style={{ mixBlendMode: "screen" }} />;
function SetArt({ kind }) {
  if (kind === "classroom") return <g>
    <rect width={1920} height={760} fill="#E6D9A8" /><rect y={760} width={1920} height={320} fill="#A87A55" /><rect y={740} width={1920} height={24} fill="#7A5A40" />
    <rect x={120} y={190} width={620} height={330} fill="#2E4B3F" stroke="#6E5A45" strokeWidth={14} /><path d="M 190 470 L 330 280 L 330 470 Z" fill="none" stroke="#E8E4D8" strokeWidth={5} />
    <text x={420} y={290} fontFamily={F.sans} fontSize={30} fill="#E8E4D8">Homework:</text><text x={420} y={340} fontFamily={F.sans} fontSize={26} fill="#E8E4D8">p. 58, 1-12</text><text x={420} y={400} fontFamily={F.sans} fontSize={24} fill="#E8E4D8">QUIZ THURSDAY</text>
    {win(1080, 150, 620, 360)}<circle cx={960} cy={120} r={44} fill="#F6F1E5" stroke="#3A3A3A" strokeWidth={6} /><path d="M 960 120 L 960 92 M 960 120 L 980 128" stroke="#222" strokeWidth={5} />
    <rect x={800} y={230} width={120} height={160} fill="#2D5DA8" /><circle cx={860} cy={290} r={30} fill="#F2C94C" /><text x={860} y={370} textAnchor="middle" fontFamily={F.sans} fontWeight={700} fontSize={20} fill="#fff">THINK!</text>
    <rect x={1760} y={250} width={120} height={150} fill="#E8B7B0" /><rect x={1770} y={420} width={100} height={70} fill="#9BC4A6" />
    {[180, 620, 1060, 1500].map((x, i) => <g key={i}><rect x={x} y={770} width={320} height={26} fill="#C99B6D" stroke="#6E5038" strokeWidth={4} /><rect x={x + 20} y={796} width={14} height={110} fill="#4A3A2C" /><rect x={x + 286} y={796} width={14} height={110} fill="#4A3A2C" /><rect x={x + 120} y={748} width={60} height={22} fill="#C0392B" /></g>)}
    {lamp(500, 0)}{lamp(1400, 0)}
  </g>;
  if (kind === "hallway") return <g>
    <rect width={1920} height={1080} fill="#E9E1D2" /><polygon points="0,1080 1920,1080 1180,620 740,620" fill="#C9B8A0" /><polygon points="0,0 1920,0 1180,300 740,300" fill="#F3EEE6" />
    <rect x={740} y={300} width={440} height={320} fill="#D9CDBB" /><rect x={880} y={380} width={160} height={240} fill="#8C6B4F" />
    {[0, 1, 2, 3, 4].map((i) => { const x0 = i * 150, w = 140 - i * 18, h0 = 760 - i * 90; return <g key={i}><rect x={x0} y={1080 - h0 - 120 + i * 40} width={w} height={h0} fill={["#3E8E5C", "#E3B33B", "#3E8E5C", "#E3B33B", "#3E8E5C"][i]} stroke="#2A2A2A" strokeWidth={3} />{[0, 1, 2].map((r) => <line key={r} x1={x0 + 20} x2={x0 + w - 20} y1={1080 - h0 - 80 + i * 40 + r * 18} y2={1080 - h0 - 80 + i * 40 + r * 18} stroke="#222" strokeWidth={3} />)}</g>; })}
    {[0, 1, 2, 3, 4].map((i) => { const w = 140 - i * 18, x0 = 1920 - i * 150 - w, h0 = 760 - i * 90; return <rect key={i} x={x0} y={1080 - h0 - 120 + i * 40} width={w} height={h0} fill={["#E3B33B", "#C0392B", "#E3B33B", "#C0392B", "#E3B33B"][i]} stroke="#2A2A2A" strokeWidth={3} />; })}
    <rect x={800} y={250} width={320} height={40} fill="#22325E" /><text x={960} y={279} textAnchor="middle" fontFamily={F.sans} fontWeight={800} fontSize={22} fill="#F2C94C">GO RAVENS</text>
    {lamp(960, 120, 300)}
  </g>;
  if (kind === "kitchen") return <g>
    <rect width={1920} height={1080} fill="#D8C9AC" /><rect y={760} width={1920} height={320} fill="#8E6A4C" />
    {win(700, 140, 520, 330, "#F6D3A0")}<rect x={0} y={560} width={1920} height={200} fill="#B9A58A" /><rect x={0} y={540} width={1920} height={26} fill="#6E5A45" />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={30 + i * 240} y={590} width={210} height={150} rx={6} fill="none" stroke="#6E5A45" strokeWidth={5} />)}
    {[0, 1, 2].map((i) => <rect key={i} x={80 + i * 190} y={110} width={160} height={250} fill="#C7B08E" stroke="#6E5A45" strokeWidth={5} />)}
    <rect x={1500} y={170} width={300} height={590} rx={14} fill="#ECEAE4" stroke="#7A7A7A" strokeWidth={6} /><line x1={1500} y1={400} x2={1800} y2={400} stroke="#7A7A7A" strokeWidth={5} /><rect x={1560} y={260} width={50} height={60} fill="#E07A5F" /><rect x={1630} y={460} width={60} height={50} fill="#81B29A" />
    <rect x={1260} y={230} width={160} height={100} fill="#2A2A30" /><rect x={1270} y={240} width={140} height={80} fill="#3E6D8E" />
    {lamp(960, 160, 340, "rgba(255,200,140,0.6)")}
  </g>;
  if (kind === "street") return <g>
    <rect width={1920} height={1080} fill="#9FB4C2" />
    {[[0, 140, 420, "#5E6670"], [420, 220, 360, "#8A7F72"], [780, 90, 480, "#4E5866"], [1260, 180, 340, "#7C6A5A"], [1600, 120, 320, "#5A6472"]].map(([x, top, w, col], i) => <g key={i}><rect x={x} y={top} width={w} height={820 - top} fill={col} />{[...Array(Math.floor((520 - top) / 100))].map((_, r) => [...Array(Math.floor(w / 110))].map((_, q) => <rect key={`${r}${q}`} x={x + 30 + q * 110} y={top + 40 + r * 100} width={60} height={70} fill="#2E3440" opacity={0.85} />))}<rect x={x + 20} y={600} width={w - 40} height={220} fill="#2B2F36" /><rect x={x + 20} y={560} width={w - 40} height={44} fill={["#B0413E", "#2E6F4E", "#C9A23B", "#2D5DA8", "#7A3E8E"][i]} /><text x={x + w / 2} y={591} textAnchor="middle" fontFamily={F.sans} fontWeight={800} fontSize={24} fill="#fff">{["CUP", "BOOKS", "BANK", "VOLT", "DELI"][i]}</text><rect x={x + 40} y={620} width={w / 2 - 50} height={150} fill="#7FA7BF" opacity={0.6} /></g>)}
    <rect y={820} width={1920} height={70} fill="#A8A29A" /><rect y={890} width={1920} height={190} fill="#4A4C52" />{[...Array(9)].map((_, i) => <rect key={i} x={i * 230 + 30} y={980} width={120} height={12} fill="#EDE6D6" />)}
    <rect x={300} y={500} width={12} height={320} fill="#2A2A2A" /><rect x={276} y={470} width={60} height={40} rx={8} fill="#2A2A2A" /><circle cx={306} cy={512} r={10} fill="#FFE2A0" />
    <rect x={1420} y={760} width={40} height={60} rx={6} fill="#C0392B" />
  </g>;
  if (kind === "auditorium") return <g>
    <rect width={1920} height={1080} fill="#2A2D3E" />{[...Array(5)].map((_, r) => [...Array(16)].map((_, q) => <circle key={`${r}${q}`} cx={q * 125 + (r % 2) * 60} cy={260 + r * 120} r={44} fill={["#E07A9F", "#F2C94C", "#6FA8DC", "#E8E1D2", "#9B7FD1"][(q + r) % 5]} opacity={0.65} />))}
    {[...Array(14)].map((_, q) => <rect key={q} x={q * 140} y={800} width={120} height={180} rx={12} fill="#7E1F2A" />)}{lamp(960, 0, 500, "rgba(255,230,180,0.4)")}
  </g>;
  // bedroom
  return <g>
    <rect width={1920} height={1080} fill="#6E5A4A" /><rect y={780} width={1920} height={300} fill="#3E3029" />
    {win(1250, 130, 460, 330, "#25324F")}{[...Array(14)].map((_, i) => <circle key={i} cx={1270 + (i * 67) % 430} cy={150 + (i * 41) % 290} r={3} fill="#FFF3C4" />)}
    <rect x={120} y={600} width={760} height={230} rx={24} fill="#2F3D63" /><rect x={120} y={540} width={140} height={140} rx={20} fill="#C6B9A6" />
    <rect x={960} y={620} width={160} height={210} fill="#5A4636" /><path d="M 1000 620 L 1080 620 L 1110 520 L 970 520 Z" fill="#F2D49B" /><rect x={1036} y={520} width={8} height={100} fill="#3A2A20" />
    <rect x={420} y={180} width={260} height={300} fill="#3E5E7A" stroke="#2A2A2A" strokeWidth={6} /><text x={550} y={350} textAnchor="middle" fontFamily={F.sans} fontWeight={800} fontSize={36} fill="#F2C94C">7 x 8 = ?</text>
    {lamp(1040, 540, 380, "rgba(255,210,140,0.7)")}
  </g>;
}

/** Rounded pill tag (green high / red low / amber mid) with white text and outline. */
function Pill({ x, y, text, tone = "mid", t, from = 0, to, k = 1 }) {   // k: counter-scale so tags keep a readable size in close-ups
  const f = useCurrentFrame(), a = ramp(f, from, from + 10, expo), on = to && f >= to.at, pulse = to ? Math.max(0, 1 - Math.abs(f - to.at) / 8) : 0;
  const txt = on ? to.text : text, c = t.fx.tone[(on && to.tone) || tone] || t.fx.tone.mid, w = 40 + txt.length * 26, bob = Math.sin((f + x) / 20) * 3;
  return <g transform={`translate(${x} ${y + bob}) scale(${k * (0.7 + 0.3 * a) * (1 + pulse * 0.2)})`} opacity={a}>
    <rect x={-w / 2} y={-32} width={w} height={64} rx={32} fill={c} stroke="#fff" strokeWidth={5} />
    <text x={0} y={14} textAnchor="middle" fontFamily={F.grot} fontWeight={800} fontSize={40} letterSpacing="0.06em" fill="#fff">{txt}</text>
  </g>;
}

/** B scene. room: classroom | hallway | kitchen | street | auditorium | bedroom. cast: [{ id, x, pose, mood, look, flip, walk, from, tag:{text,tone,from,to:{text,tone,at}}, say:{text,from} }]
 *  shot: close | medium | wide (default from cast size); focus: cast index for close-ups; name: { text, from } lower-third; ots: true adds a blurred foreground head. */
export function FxStickScene({ t, room = "classroom", cast = [], shot, focus = 0, name, ots, caption, push = 0.04 }) {
  const f = useCurrentFrame(), { durationInFrames: D } = useVideoConfig();
  const S = shot || (cast.length <= 1 ? "close" : cast.length === 2 ? "medium" : "wide"), Z = { close: 2.8, medium: 1.85, wide: 1.0 }[S];
  const tgt = cast[Math.min(focus, cast.length - 1)], xs = cast.map((m) => (m.walk ? m.walk.to : m.x));
  const fx = S === "close" && tgt ? (tgt.walk ? tgt.walk.to : tgt.x) : xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 960;
  const fy = S === "close" ? 590 : S === "medium" ? 640 : 540;
  const z = Z * (1 + push * interpolate(f, [0, D], [0, 1], clamp));
  const ox = Math.min(Math.max(fx, 960 / Z), 1920 - 960 / Z), oy = Math.min(Math.max(fy, 540 / Z), 1080 - 540 / Z);
  const cam = { position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: `translate(${960 - ox}px, ${540 - oy}px) scale(${z})`, transformOrigin: `${ox}px ${oy}px` };
  const blur = { close: 7, medium: 4, wide: 1.5 }[S];
  const defs = <defs>
    <linearGradient id="kshade" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fff" stopOpacity={0.12} /><stop offset="55%" stopColor="#000" stopOpacity={0} /><stop offset="100%" stopColor="#000" stopOpacity={0.3} /></linearGradient>
    <linearGradient id="kglass" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity={0.35} /><stop offset="50%" stopColor="#fff" stopOpacity={0} /><stop offset="60%" stopColor="#fff" stopOpacity={0.18} /><stop offset="100%" stopColor="#fff" stopOpacity={0} /></linearGradient>
    <radialGradient id="kglow"><stop offset="0%" stopColor="#FFD9A0" stopOpacity={0.55} /><stop offset="100%" stopColor="#FFD9A0" stopOpacity={0} /></radialGradient>
  </defs>;
  return <AbsoluteFill style={{ background: "#1A1714", overflow: "hidden" }}>
    <Fonts />
    <div style={{ ...cam, filter: `blur(${blur}px) saturate(0.9)` }}><svg width={1920} height={1080}>{defs}<SetArt kind={room} /></svg></div>
    <div style={cam}><svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>{defs}
      {cast.map((m, i) => <Kid key={i} {...m} y={m.y ?? 990} c={t.fx.cast[m.id] || {}} />)}
      {cast.filter((m) => m.tag).map((m, i) => <Pill key={`p${i}`} t={t} k={Math.min(1, 1.5 / Z)} x={m.walk ? m.walk.to : m.x} y={(m.y ?? 990) - (S === "close" ? 445 : 470) * (m.s || 1)} {...m.tag} />)}
    </svg>
      {cast.filter((m) => m.say).map((m, i) => { const a = ramp(f, m.say.from || 0, (m.say.from || 0) + 8, expo); return <div key={`s${i}`} style={{ position: "absolute", left: m.x + (m.flip === -1 ? -330 : 90), top: (m.y ?? 990) - 520, width: 240, padding: "10px 14px", background: "#fff", borderRadius: 18, fontFamily: F.grot, fontWeight: 700, fontSize: 24, color: INK, textAlign: "center", opacity: a, boxShadow: "0 6px 16px rgba(0,0,0,0.3)" }}>{m.say.text}</div>; })}
    </div>
    {ots && <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, filter: "blur(10px)" }}><circle cx={ots === "right" ? 1780 : 140} cy={760} r={330} fill={INK} /><path d={ots === "right" ? "M 1500 1080 Q 1640 860 1920 880 L 1920 1080 Z" : "M 0 880 Q 280 860 420 1080 L 0 1080 Z"} fill="#2E3E66" /></svg>}
    <AbsoluteFill style={{ background: "radial-gradient(110% 95% at 50% 45%, rgba(0,0,0,0) 55%, rgba(10,6,2,0.55) 100%)", pointerEvents: "none" }} />
    {name && (() => { const a = ramp(f, name.from ?? 12, (name.from ?? 12) + 10, expo); return <div style={{ position: "absolute", left: 120, bottom: 70, opacity: a, transform: `translateY(${(1 - a) * 16}px)`, background: "rgba(18,16,14,0.88)", border: "3px solid rgba(255,255,255,0.85)", borderRadius: 40, padding: "10px 28px", fontFamily: F.grot, fontWeight: 800, fontSize: 32, letterSpacing: "0.12em", color: "#fff" }}>{name.text.toUpperCase()}</div>; })()}
    {caption && <div style={{ position: "absolute", left: 0, right: 0, top: 60, textAlign: "center" }}><span style={{ background: "rgba(18,16,14,0.88)", border: "3px solid rgba(255,255,255,0.85)", borderRadius: 40, color: "#fff", fontFamily: F.grot, fontWeight: 800, fontSize: 34, letterSpacing: "0.12em", padding: "10px 28px" }}>{caption.toUpperCase()}</span></div>}
  </AbsoluteFill>;
}
