// Rival Lines match-analysis Short on the white editorial engine (collage-engine, sport theme): "How does a substitute win a final in under nineteen minutes?"
// Spain v England, UEFA Euro 2024 final. Every figure on screen is read from euro-data.json (analysis_euro.py, StatsBomb Open Data event data).
// The pitch board is drawn here from the recorded locations (StatsBomb units, 120 x 80, each team attacking one way): locations are where events were recorded, not tracking.
// Photographs are real Wikimedia Commons files and are labelled as not being from the final. Nothing is AI-generated.
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, interpolate, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { Caps, Collage, THEMES } from "../court-and-spotlight/collage-engine.jsx";
import { StatsBombAttribution } from "./attribution.jsx";

const T = THEMES.sport, P = T.pop; // P: blue, garnet, gold, sky. Spain is drawn garnet, England blue.
const SPAIN = P[1], ENGLAND = P[0], GOLD = P[2];
const PITCH = { grass: "#1F5B3F", stripe: "#1B5239", line: "#E9F1EC" }; // the same greens as the mplsoccer boards of the channel's other Shorts
const FACE = `@font-face{font-family:"Archivo Black";font-weight:400;src:url("${staticFile("fonts/ArchivoBlack-400.woff2")}") format("woff2");}`;
const AB = '"Archivo Black", sans-serif';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const tw = (f, a, b, e = Easing.out(Easing.cubic)) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const credit = (text) => ({ k: "type", x: 50, y: 1556, w: 980, h: 40, size: 17, weight: 400, font: T.body, color: T.dim, upper: false, text, d: 0, at: 0, from: "none", lh: 1.15 });
const card = (at = 0, from = "t", c = "#fff") => ({ k: "scrap", x: 20, y: 120, w: 1040, h: 1430, c, r: 0, d: 0.15, from, at });
const head = (text, at = 2, color = T.ink, size = 84, y = 160) => ({ k: "type", x: 60, y, w: 960, h: size + 10, size, font: AB, color, text, at, d: 0.3, from: "l", ls: "-0.02em" });
const node = (x, y, w, h, at, n) => ({ k: "custom", x, y, w, h, r: 0, d: 0.2, from: "none", at, node: n });

/** A counting clock, m:ss, from `a` seconds to `b` seconds between scene frames `f0` and `f1`. */
const Clock = ({ a = 0, b, f0 = 4, f1 = 40, size = 300, color = SPAIN, align = "center", fixed = false }) => {
  const f = useCurrentFrame(), s = fixed ? b : a + (b - a) * tw(f, f0, f1, Easing.linear);
  return <div style={{ fontFamily: AB, fontSize: size, lineHeight: 1, color, textAlign: align, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>{mmss(Math.round(s))}</div>;
};

/** The match clock as a bar from 0 to 90 minutes with marks (goals, substitutions) and drawn-on spans. Times are seconds on the match clock. */
const Timeline = ({ w = 920, marks = [], spans = [] }) => {
  const f = useCurrentFrame(), X = (t) => (t / 5400) * w, H = 300, ay = 170;
  return (<svg width={w} height={H} style={{ overflow: "visible" }}>
    <rect x="0" y={ay - 7} width={w} height="14" rx="7" fill="#DCE3EC" />
    {[0, 45, 90].map((m) => <g key={m}><line x1={X(m * 60)} x2={X(m * 60)} y1={ay - 20} y2={ay + 20} stroke={T.dim} strokeWidth="4" /><text x={X(m * 60)} y={ay + 62} textAnchor="middle" fontFamily={T.body} fontWeight="800" fontSize="34" fill={T.dim}>{m}'</text></g>)}
    {spans.map((s, i) => { const p = tw(f, s.at, s.at + (s.dur || 26), Easing.inOut(Easing.cubic)); return <rect key={i} x={X(s.t0)} y={ay - 16} width={Math.max(0, (X(s.t1) - X(s.t0)) * p)} height="32" rx="16" fill={s.color} />; })}
    {marks.map((m, i) => { const p = tw(f, m.at, m.at + 12, Easing.out(Easing.back(2))), up = m.up !== false; return (<g key={i} opacity={Math.min(1, p * 3)}>
      <line x1={X(m.t)} x2={X(m.t)} y1={ay} y2={up ? ay - 70 * p : ay + 70 * p} stroke={m.color} strokeWidth="6" />
      <circle cx={X(m.t)} cy={ay} r={22 * p} fill={m.color} stroke="#fff" strokeWidth="5" />
      <text x={Math.min(w - 60, Math.max(60, X(m.t)))} y={up ? ay - 88 : ay + 120} textAnchor="middle" fontFamily={AB} fontSize="40" fill={m.color}>{m.label}</text></g>); })}
  </svg>);
};

/** The pitch board: the attacking half of the pitch (goal at the top), every mark placed at its recorded StatsBomb location. */
const Board = ({ g, passerLabel, shooterLabel, team, at = 0, w = 940 }) => {
  const f = useCurrentFrame(), S = w / 80, h = 60 * S, X = (y) => y * S, Y = (x) => h - (x - 60) * S;
  const a = tw(f, at, at + 8), b = tw(f, at + 6, at + 22, Easing.inOut(Easing.cubic)), c = tw(f, at + 22, at + 32, Easing.inOut(Easing.cubic)), d = tw(f, at + 32, at + 42, Easing.out(Easing.back(2)));
  const L = (x1, y1, x2, y2) => <line x1={X(y1)} y1={Y(x1)} x2={X(y2)} y2={Y(x2)} stroke={PITCH.line} strokeWidth="5" />;
  const [px0, py0] = g.pass_from, [px1, py1] = g.pass_to, [sx, sy] = g.xy, [ex, ey] = g.end;
  const label = (x, y, text, dy) => <text x={X(y)} y={Y(x) + dy} textAnchor="middle" fontFamily={AB} fontSize="36" fill="#fff" stroke="#0B1B33" strokeWidth="9" paintOrder="stroke" strokeLinejoin="round">{text}</text>;
  return (<svg width={w} height={h + 40} viewBox={`0 -40 ${w} ${h + 40}`} style={{ borderRadius: 14, overflow: "hidden", boxShadow: "0 14px 30px rgba(11,18,32,0.35)", background: PITCH.grass }}>
    <rect x="0" y="-40" width={w} height={h + 40} fill={PITCH.grass} />
    {[0, 2, 4].map((i) => <rect key={i} x="0" y={i * (h / 6)} width={w} height={h / 6} fill={PITCH.stripe} />)}
    <rect x="3" y="3" width={w - 6} height={h - 3} fill="none" stroke={PITCH.line} strokeWidth="5" />
    {L(102, 18, 102, 62)}{L(102, 18, 120, 18)}{L(102, 62, 120, 62)}{L(114, 30, 114, 50)}{L(114, 30, 120, 30)}{L(114, 50, 120, 50)}
    <rect x={X(36)} y="-26" width={X(8)} height="26" fill="none" stroke={PITCH.line} strokeWidth="5" />
    <circle cx={X(40)} cy={Y(108)} r="6" fill={PITCH.line} />
    <path d={`M${X(32)},${Y(102)} A${10 * S},${10 * S} 0 0 0 ${X(48)},${Y(102)}`} fill="none" stroke={PITCH.line} strokeWidth="5" />
    <path d={`M${X(30)},${h} A${10 * S},${10 * S} 0 0 1 ${X(50)},${h}`} fill="none" stroke={PITCH.line} strokeWidth="5" />
    <g opacity={a}><circle cx={X(py0)} cy={Y(px0)} r="24" fill={team} stroke="#fff" strokeWidth="6" />{label(px0, py0, passerLabel, 70)}</g>
    <line x1={X(py0)} y1={Y(px0)} x2={X(py0) + (X(py1) - X(py0)) * b} y2={Y(px0) + (Y(px1) - Y(px0)) * b} stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeDasharray="1 18" />
    <line x1={X(py0)} y1={Y(px0)} x2={X(py0) + (X(py1) - X(py0)) * b} y2={Y(px0) + (Y(px1) - Y(px0)) * b} stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
    <g opacity={b > 0.9 ? 1 : 0}><circle cx={X(sy)} cy={Y(sx)} r="24" fill={team} stroke="#fff" strokeWidth="6" />{label(sx, sy, shooterLabel, -40)}</g>
    <line x1={X(sy)} y1={Y(sx)} x2={X(sy) + (X(ey) - X(sy)) * c} y2={Y(sx) + (Y(ex) - Y(sx)) * c} stroke={GOLD} strokeWidth="9" strokeLinecap="round" />
    <g opacity={d} transform={`translate(${X(ey)},${Y(ex) + 6}) scale(${0.5 + 0.5 * d})`}><polygon points="0,-34 10,-11 35,-11 15,5 22,30 0,15 -22,30 -15,5 -35,-11 -10,-11" fill={GOLD} stroke="#fff" strokeWidth="5" /></g>
  </svg>);
};

const Counter = ({ to, f0 = 0, f1 = 24, digits = 2, size = 100, color = T.ink, prefix = "" }) => { const f = useCurrentFrame(); return <div style={{ fontFamily: AB, fontSize: size, lineHeight: 1, color }}>{prefix}{(to * tw(f, f0, f1, Easing.linear)).toFixed(digits)}</div>; };

const Hook = ({ dur, images, credits, loop }) => { const k = loop ? 0.4 : 1; return <Collage th="sport" dur={dur} ground={{ seed: 61, contour: true }}
  layers={[
    card(0, "t"),
    { k: "type", x: 60, y: 170, w: 960, h: 70, size: 50, font: AB, color: T.dim, text: "Euro 2024 final", at: 1, d: 0.2, from: "l" },
    node(40, 250, 1000, 330, 2, <Clock b={1117} f0={loop ? 0 : 4} f1={loop ? 1 : 40} fixed={loop} />),
    { k: "type", x: 60, y: 590, w: 960, h: 110, size: 92, font: AB, color: T.ink, text: "on the pitch", at: Math.round(14 * k), d: 0.3, from: "l", ls: "-0.02em" },
    { k: "photo", src: images.oya, x: 130, y: 760, w: 820, h: 640, r: -2, d: 0.6, from: "b", at: Math.round(44 * k), pos: "50% 35%", frame: "#fff", border: 12 },
    { k: "tag", x: 100, y: 1340, w: 640, h: 76, r: 0, d: 0.5, at: Math.round(54 * k), text: "Substitute · Oyarzabal", size: 32, c: "#fff" },
    { k: "stamp", x: 600, y: 800, w: 380, h: 110, r: 6, d: 0.3, at: Math.round(70 * k), text: "Winner 86'", size: 44, color: SPAIN, bg: "#fff" },
    credit(`Photo: ${credits.oya} (training session, 2018; not from the final)`),
  ]} />; };

const Score = ({ dur, data }) => { const [w, p] = data.goals; return <Collage th="sport" dur={dur} ground={{ seed: 62, contour: true }}
  layers={[
    card(0, "r"),
    head("Spain 2–1 England", 2, T.ink, 64, 170),
    { k: "type", x: 60, y: 262, w: 960, h: 50, size: 36, font: T.body, weight: 800, upper: false, color: T.dim, text: "Euro 2024 final · the match clock", at: 6, d: 0.1, from: "none" },
    node(80, 380, 920, 300, 6, <Timeline marks={[{ t: w.t, label: "47'", color: SPAIN, at: 16 }, { t: p.t, label: "73'", color: ENGLAND, at: 52 }]} />),
    { k: "tag", x: 80, y: 760, w: 420, h: 110, r: 0, d: 0.5, at: 20, text: "Spain score", size: 40, c: "#fff", color: SPAIN },
    { k: "tag", x: 500, y: 900, w: 500, h: 110, r: 0, d: 0.5, at: 56, text: "England equalise", size: 38, c: "#fff", color: ENGLAND },
    { k: "num", x: 120, y: 1060, w: 840, h: 330, size: 320, font: AB, color: T.ink, text: "1–1", at: 60, d: 0.3, r: 0 },
  ]} />; };

const Palmer = ({ dur, images, credits, data }) => { const g = data.goals[1]; return <Collage th="sport" dur={dur} ground={{ seed: 63, contour: true }}
  layers={[
    card(0, "t"),
    head("Cole Palmer", 2, ENGLAND, 90, 160),
    { k: "photo", src: images.palmer, x: 70, y: 330, w: 430, h: 640, r: -2, d: 0.6, from: "l", at: 4, pos: "50% 30%", frame: "#fff", border: 12 },
    node(520, 400, 520, 200, 8, <Clock b={data.palmer.gap_s} f0={8} f1={34} size={190} color={ENGLAND} align="left" />),
    { k: "type", x: 530, y: 600, w: 500, h: 100, size: 40, font: AB, color: T.ink, text: "after coming on", at: 30, d: 0.2, from: "r" },
    { k: "tag", x: 520, y: 740, w: 520, h: 76, r: 0, d: 0.5, at: 42, text: `On ${mmss(data.palmer.on_t)} · Goal ${mmss(data.palmer.goal_t)}`, size: 28, c: "#fff" },
    { k: "stamp", x: 540, y: 860, w: 440, h: 100, r: 5, d: 0.3, at: 52, text: "Substitute", size: 44, color: ENGLAND, bg: "#fff" },
    credit(`Photo: ${credits.palmer} (Chelsea v Leicester, November 2024; not from the final)`),
    card(70, "r"),
    head("The goal · 73'", 72, ENGLAND, 76, 170),
    node(70, 300, 940, 705, 74, <Board g={g} passerLabel="Bellingham" shooterLabel="Palmer" team={ENGLAND} at={72} />),
    { k: "tag", x: 70, y: 1080, w: 940, h: 84, r: 0, d: 0.4, at: 86, text: "Bellingham's pass, Palmer's left-foot shot", size: 28, c: "#fff" },
    { k: "type", x: 70, y: 1210, w: 940, h: 120, size: 28, font: T.body, weight: 500, upper: false, color: T.dim, text: "Locations are where StatsBomb recorded each event, in the attacking half. The star is where the shot ended.", at: 92, d: 0, from: "none", lh: 1.25 },
  ]} />; };

const Oya = ({ dur, images, credits, data }) => <Collage th="sport" dur={dur} ground={{ seed: 64, contour: true }}
  layers={[
    card(0, "l"),
    head("Spain's answer", 2, SPAIN, 80, 170),
    { k: "photo", src: images.oya, x: 110, y: 320, w: 860, h: 560, r: 2, d: 0.6, from: "b", at: 4, pos: "50% 35%", frame: "#fff", border: 12 },
    { k: "tag", x: 110, y: 910, w: 860, h: 84, r: 0, d: 0.5, at: 24, text: `Morata off · Oyarzabal on · ${mmss(data.oyarzabal.on_t)}`, size: 30, c: "#fff" },
    node(80, 1060, 920, 300, 36, <Timeline marks={[{ t: data.oyarzabal.on_t, label: "ON 67'", color: SPAIN, at: 10 }]} />),
    { k: "stamp", x: 620, y: 1360, w: 360, h: 100, r: -4, d: 0.3, at: 60, text: "Substitute", size: 42, color: SPAIN, bg: "#fff" },
    credit(`Photo: ${credits.oya} (training session, 2018; not from the final)`),
  ]} />;

const Winner = ({ dur, data }) => { const g = data.goals[2]; return <Collage th="sport" dur={dur} ground={{ seed: 65, contour: true }}
  layers={[
    card(0, "b"),
    head("86th minute", 2, SPAIN, 90, 160),
    node(70, 300, 940, 705, 4, <Board g={g} passerLabel="Cucurella" shooterLabel="Oyarzabal" team={SPAIN} at={8} />),
    { k: "tag", x: 70, y: 1060, w: 940, h: 84, r: 0, d: 0.4, at: 30, text: "Cucurella's pass along the ground", size: 34, c: "#fff" },
    { k: "type", x: 70, y: 1190, w: 560, h: 70, size: 34, font: T.body, weight: 800, upper: false, color: T.dim, text: "xG, StatsBomb model", at: 66, d: 0.1, from: "none" },
    node(70, 1240, 480, 130, 66, <Counter to={g.xg} f0={0} f1={22} digits={2} size={120} color={SPAIN} />),
    { k: "stamp", x: 650, y: 1230, w: 330, h: 120, r: 4, d: 0.3, at: 88, text: "Goal", size: 56, color: SPAIN, bg: "#fff" },
    { k: "type", x: 70, y: 1400, w: 940, h: 110, size: 26, font: T.body, weight: 500, upper: false, color: T.dim, text: "Locations are where StatsBomb recorded each event, in the attacking half. xG is a modelled value for the shot, not a measured outcome.", at: 74, d: 0, from: "none", lh: 1.25 },
  ]} />; };

const Gap = ({ dur, data }) => <Collage th="sport" dur={dur} ground={{ seed: 66, contour: true }}
  layers={[
    card(0, "r"),
    head("After coming on", 2, T.ink, 72, 170),
    node(40, 330, 1000, 330, 4, <Clock b={data.oyarzabal.gap_s} f0={6} f1={36} color={SPAIN} />),
    { k: "type", x: 60, y: 690, w: 960, h: 70, size: 44, font: T.body, weight: 800, upper: false, color: T.dim, text: "minutes : seconds on the pitch", at: 30, d: 0.1, from: "none", align: "center" },
    node(80, 800, 920, 300, 10, <Timeline marks={[{ t: data.oyarzabal.on_t, label: "ON", color: SPAIN, at: 4 }, { t: data.oyarzabal.goal_t, label: "GOAL", color: SPAIN, at: 38, up: false }]} spans={[{ t0: data.oyarzabal.on_t, t1: data.oyarzabal.goal_t, color: SPAIN, at: 8, dur: 30 }]} />),
    { k: "stamp", x: 280, y: 1250, w: 520, h: 110, r: -3, d: 0.3, at: 50, text: "Spain's winner", size: 46, color: SPAIN, bg: "#fff" },
  ]} />;

const Two = ({ dur, data }) => { const kind = ["Starter", "Substitute", "Substitute"], col = [T.dim, ENGLAND, SPAIN], name = ["Williams", "Palmer", "Oyarzabal"];
  return <Collage th="sport" dur={dur} ground={{ seed: 67, contour: true }}
  layers={[
    card(0, "l"),
    { k: "num", x: 60, y: 150, w: 960, h: 260, size: 200, font: AB, color: SPAIN, text: "2 of 3", at: 4, d: 0.3, r: 0 },
    { k: "type", x: 70, y: 450, w: 960, h: 90, size: 44, font: AB, color: T.ink, text: "goals came from substitutes", at: 14, d: 0.3, from: "l" },
    ...data.goals.map((g, i) => ({ k: "scrap", x: 50 + i * 330, y: 640, w: 310, h: 560, c: i === 0 ? T.paper2 : "#fff", r: 0, d: 0.4, from: "b", at: 22 + i * 14 })),
    ...data.goals.map((g, i) => ({ k: "type", x: 70 + i * 330, y: 690, w: 270, h: 130, size: 100, font: AB, color: col[i], text: `${g.minute}'`, at: 28 + i * 14, d: 0.2, from: "none", align: "center" })),
    ...data.goals.map((g, i) => ({ k: "type", x: 70 + i * 330, y: 850, w: 270, h: 70, size: 34, font: AB, color: T.ink, text: name[i], at: 32 + i * 14, d: 0.2, from: "none", align: "center", upper: false })),
    ...data.goals.map((g, i) => ({ k: "tag", x: 66 + i * 330, y: 1000, w: 280, h: 80, r: 0, d: 0.4, at: 36 + i * 14, text: kind[i], size: 26, c: i === 0 ? "#fff" : col[i], color: i === 0 ? T.ink : "#fff" })),
    { k: "type", x: 70, y: 1260, w: 940, h: 150, size: 64, font: AB, color: T.ink, text: "Did the changes\ndecide it?", at: 80, d: 0.2, from: "r" },
  ]} />; };

const Cta = ({ dur }) => <Collage th="sport" dur={dur} ground={{ seed: 68, contour: true }}
  layers={[
    { k: "scrap", x: -20, y: 120, w: 1120, h: 1430, c: ENGLAND, r: 0, d: 0.2, from: "b", at: 0 },
    { k: "type", x: 60, y: 300, w: 960, h: 220, size: 130, font: AB, color: "#fff", text: "Full\nbreakdown", at: 3, d: 0.3, from: "l", lh: 1 },
    { k: "type", x: 60, y: 620, w: 960, h: 110, size: 74, font: AB, color: GOLD, text: "on our channel", at: 12, d: 0.3, from: "r" },
    { k: "scrap", x: 60, y: 860, w: 960, h: 360, c: "#fff", r: -1, d: 0.4, from: "b", at: 20 },
    { k: "type", x: 100, y: 900, w: 880, h: 60, size: 30, font: T.body, weight: 800, upper: true, color: T.dim, text: "Rival Lines · long-form", at: 24, d: 0.1, from: "none" },
    { k: "type", x: 100, y: 960, w: 880, h: 230, size: 52, font: AB, color: T.ink, text: "How To Analyse a Football Match (Using the Euro 2024 Final)", at: 26, d: 0.2, from: "none", upper: false, lh: 1.08 },
  ]} />;

const KINDS = { hook: Hook, score: Score, palmer: Palmer, oya: Oya, winner: Winner, gap: Gap, two: Two, cta: Cta, loop: (p) => <Hook {...p} loop />, };
export function RivalAnalyseShort({ durationInFrames, scenes, captions, images, credits, data }) {
  return (<AbsoluteFill style={{ background: T.ground }}><style>{FONT_FACES + FACE}</style>
    {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} credits={credits} data={data} /></Sequence>; })}
    <Caps th="sport" captions={captions} />
    <StatsBombAttribution logo={images.sbLogo} />
  </AbsoluteFill>);
}
