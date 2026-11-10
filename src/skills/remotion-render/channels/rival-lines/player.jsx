// Rival Lines player documentary (Format A): premium editorial sports documentary on the layered collage engine (sport theme).
// This cut poses a question ("is he the greatest of all time?") and shows the evidence with REAL photographs: eight Ballon d'Or trophy
// photographs for the count of eight, a Golden Shoe, real Argentina shirts, the 2022 World Cup trophy. Charts are drawn from verified
// career statistics (Wikipedia) and a limited, labelled StatsBomb sample. No drawn shirts or trophies are used.
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, interpolate, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { Caps, Collage, THEMES } from "../court-and-spotlight/collage-engine.jsx";
import { StatsBombAttribution } from "./attribution.jsx";

const T = THEMES.sport, P = T.pop, GOLD = "#EDBB00";
const FACE = `@font-face{font-family:"Archivo Black";font-weight:400;src:url("${staticFile("fonts/ArchivoBlack-400.woff2")}") format("woff2");}`;
const AB = '"Archivo Black", sans-serif';
const credit = (list) => ({ k: "type", x: 50, y: 1556, w: 980, h: 40, size: 17, weight: 400, font: T.body, color: T.dim, upper: false, text: `Photos: ${list.filter(Boolean).join("; ")}`, d: 0, at: 0, from: "none", lh: 1.15 });
const clampI = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const ph = (src, x, y, w, h, r, at, o = {}) => ({ k: "photo", src, x, y, w, h, r, d: 0.6, from: o.from || "b", at, pos: o.pos || "center", fit: o.fit || "cover", frame: "#fff", border: o.border ?? 12, tape: o.tape });

const Q0 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 41, contour: true }}
  layers={[
    { k: "scrap", x: -30, y: 640, w: 1140, h: 900, c: P[0], r: -1.5, d: 0.2, from: "b", at: 0 },
    { k: "type", x: 60, y: 120, w: 960, h: 150, size: 140, font: AB, color: T.ink, text: "IS HE THE", at: 2, d: 0.3, from: "l", ls: "-0.02em" },
    { k: "type", x: 50, y: 262, w: 1010, h: 180, size: 160, font: AB, color: P[1], text: "GREATEST?", at: 8, d: 0.3, from: "r", ls: "-0.03em" },
    ph(images.shirtArg, 10, 540, 380, 590, -7, 10, { from: "l", pos: "center 40%" }),
    ph(images.shirtShop, 690, 580, 380, 520, 7, 14, { from: "r", pos: "40% 50%" }),
    { k: "cut", src: images.p2022cut, x: 270, y: 430, w: 560, h: 1110, r: 1, d: 0.85, from: "b", at: 6 },
    { k: "tag", x: 60, y: 1480, w: 520, h: 84, r: -2, d: 0.5, at: 20, text: "Lionel Messi", size: 38, c: "#fff" },
    credit([credits.p2022cut, credits.shirtArg, credits.shirtShop]),
  ]} />;

const crops = [
  ["bo0", "cover", "center 55%"], ["bo1", "cover", "center 55%"], ["bo2", "cover", "center 38%"], ["bo3", "cover", "center 45%"],
  ["bo4", "cover", "center 45%"], ["bo5", "190%", "58% 62%"], ["bo6", "200%", "50% 62%"], ["bo5", "230%", "14% 38%"],
];
const Q1 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 42, contour: true }}
  layers={[
    { k: "scrap", x: 20, y: 120, w: 1040, h: 1410, c: "#fff", r: -0.6, d: 0.15, from: "t", at: 0 },
    { k: "num", x: 50, y: 140, w: 420, h: 460, size: 440, font: AB, color: P[1], count: [0, 8], dur: 14, at: 4, d: 0.3, r: -2 },
    { k: "type", x: 440, y: 270, w: 600, h: 120, size: 70, font: AB, color: T.ink, text: "Ballons d'Or", at: 12, d: 0.3 },
    { k: "type", x: 444, y: 380, w: 560, h: 90, size: 34, font: T.label, upper: false, weight: 700, color: T.dim, text: "eight photographs of the trophy", at: 20, d: 0.2 },
    ...crops.map(([k, fit, pos], i) => ph(images[k], 56 + (i % 4) * 242, 640 + Math.floor(i / 4) * 400, 226, 372, (i % 3 - 1) * 1.6, 14 + i * 5, { pos, fit, border: 8, from: i % 2 ? "b" : "t" })),
    { k: "type", x: 56, y: 1450, w: 960, h: 70, size: 22, font: T.body, weight: 400, upper: false, color: T.dim, text: "Photographs of Ballon d'Or trophies: Barcelona museum, Camp Nou Experience and the FIFA Museum (seven photographs; the eighth tile is a second crop).", at: 40, d: 0, from: "none", lh: 1.2 },
    credit([credits.bo0, credits.bo2, credits.bo3]),
  ]} />;

const Q2 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 43, contour: true }}
  layers={[
    { k: "scrap", x: -20, y: 150, w: 1120, h: 1250, c: GOLD, r: 1.5, d: 0.2, from: "r", at: 0 },
    { k: "num", x: 40, y: 180, w: 460, h: 520, size: 520, font: AB, color: T.ink, count: [0, 6], dur: 12, at: 4, d: 0.3, r: -2 },
    { k: "type", x: 70, y: 700, w: 560, h: 200, size: 66, font: AB, color: T.ink, text: "European\nGolden Shoes", at: 14, d: 0.3, lh: 1 },
    ph(images.shoe, 440, 240, 600, 760, 3, 8, { from: "r", pos: "center 55%" }),
    { k: "tag", x: 70, y: 1000, w: 700, h: 90, r: -2, d: 0.5, at: 26, text: "A real Golden Shoe", size: 38, c: "#fff" },
    credit([credits.shoe]),
  ]} />;

function GoalsChart({ seasons }) {
  const f = useCurrentFrame(), x0 = 70, bw = 46, gap = 8.6, base = 900, k = 8.6, best = seasons.reduce((a, b) => (b.goals > a.goals ? b : a));
  return (<div style={{ position: "relative", width: 940, height: 1000 }}>
    <svg width="940" height="1000" style={{ position: "absolute", left: 0, top: 0 }}>
      {[0, 25, 50, 75].map((v) => <g key={v}><line x1="50" x2="930" y1={base - v * k} y2={base - v * k} stroke="#0B1220" strokeOpacity="0.1" strokeWidth="2" /><text x="40" y={base - v * k + 8} textAnchor="end" fontFamily='"Inter", sans-serif' fontWeight="700" fontSize="22" fill="#5B677A">{v}</text></g>)}
      {seasons.map((s, i) => {
        const t = interpolate(f, [8 + i * 3, 22 + i * 3], [0, 1], { ...clampI, easing: Easing.out(Easing.cubic) }), x = x0 + i * (bw + gap), hl = s.league_goals * k * t, ho = (s.goals - s.league_goals) * k * t, top = s.goals === best.goals;
        return (<g key={s.season}>
          <rect x={x} y={base - hl} width={bw} height={hl} fill={P[1]} rx="3" />
          <rect x={x} y={base - hl - ho} width={bw} height={ho} fill={P[0]} rx="3" />
          {top ? <rect x={x - 4} y={base - (s.goals * k * t) - 4} width={bw + 8} height={s.goals * k * t + 4} fill="none" stroke={GOLD} strokeWidth="6" rx="5" /> : null}
          <text x={x + bw / 2} y={base + 34} textAnchor="middle" fontFamily='"Inter", sans-serif' fontWeight="800" fontSize="22" fill="#0B1220">{s.season.slice(-2)}</text>
        </g>);
      })}
    </svg>
    <div style={{ position: "absolute", left: 50, top: 940, display: "flex", gap: 26, fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: 24, color: "#0B1220" }}>
      <span><span style={{ display: "inline-block", width: 22, height: 22, background: P[1], marginRight: 8, verticalAlign: "middle" }} />La Liga</span>
      <span><span style={{ display: "inline-block", width: 22, height: 22, background: P[0], marginRight: 8, verticalAlign: "middle" }} />Cups and Europe</span>
    </div>
  </div>);
}
const Q3 = ({ dur, images, credits, data }) => { const best = data.barcelona_la_liga.reduce((a, b) => (b.goals > a.goals ? b : a)), bi = data.barcelona_la_liga.findIndex((s) => s.season === best.season); return <Collage th="sport" dur={dur} ground={{ seed: 44, contour: true }}
  layers={[
    { k: "scrap", x: 20, y: 110, w: 1040, h: 1440, c: "#fff", r: 0.6, d: 0.15, from: "b", at: 0 },
    { k: "type", x: 70, y: 150, w: 940, h: 60, size: 30, font: T.label, upper: true, weight: 800, color: T.dim, text: "Goals for Barcelona, season by season", at: 2, d: 0.1, ls: "0.08em" },
    { k: "num", x: 60, y: 210, w: 520, h: 230, size: 210, font: AB, color: P[1], count: [0, 474], dur: 30, at: 4, d: 0.2 },
    { k: "type", x: 70, y: 430, w: 520, h: 80, size: 38, font: T.label, upper: false, weight: 800, color: T.ink, text: "La Liga goals: a record", at: 14, d: 0.1 },
    { k: "num", x: 600, y: 210, w: 420, h: 230, size: 210, font: AB, color: "#C99700", text: `${data.barcelona_la_liga[bi].goals}`, at: 56, d: 0.3, r: -2 },
    { k: "type", x: 610, y: 430, w: 420, h: 80, size: 38, font: T.label, upper: false, weight: 800, color: T.ink, text: `in ${best.season.replace("-", "–")} alone`, at: 62, d: 0.1 },
    { k: "custom", x: 70, y: 520, w: 940, h: 1000, r: 0, d: 0, at: 0, from: "none", node: <GoalsChart seasons={data.barcelona_la_liga} /> },
    { k: "type", x: 70, y: 1530, w: 940, h: 30, size: 19, font: T.body, weight: 400, upper: false, color: T.dim, text: "Barcelona career statistics, all competitions, from the Wikipedia career-statistics table.", at: 0, d: 0, from: "none" },
  ]} pens={[{ cx: 140 + bi * 54.6 + 23, cy: 520 + 900 - best.goals * 8.6 - 10, rx: 62, ry: 70, at: 58, c: "#0B1220" }]} />; };

const Q4 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 45, contour: true }}
  layers={[
    { k: "scrap", x: -20, y: 150, w: 1120, h: 760, c: P[1], r: -1.5, d: 0.2, from: "l", at: 0 },
    ph(images.p2010, 50, 200, 520, 640, -3, 4, { from: "l", pos: "center 18%" }),
    ph(images.bo1, 560, 270, 470, 600, 3, 12, { from: "r", pos: "center 55%" }),
    { k: "type", x: 60, y: 940, w: 960, h: 140, size: 120, font: AB, color: T.ink, text: "TWO TREBLES", at: 16, d: 0.3, r: -1.5 },
    { k: "scrap", x: 50, y: 1100, w: 460, h: 330, c: "#fff", r: -2, d: 0.4, from: "b", at: 22, tape: [{ x: 150, y: -14, r: 4 }] },
    { k: "type", x: 80, y: 1140, w: 400, h: 120, size: 100, font: AB, color: P[0], text: "2009", at: 28, d: 0.3 },
    { k: "type", x: 80, y: 1260, w: 400, h: 120, size: 32, font: T.label, upper: false, weight: 800, color: T.ink, text: "The first treble in Spanish football", at: 34, d: 0.3 },
    { k: "scrap", x: 560, y: 1100, w: 460, h: 330, c: "#fff", r: 2, d: 0.4, from: "b", at: 40, tape: [{ x: 160, y: -14, r: -5 }] },
    { k: "type", x: 590, y: 1140, w: 400, h: 120, size: 100, font: AB, color: P[1], text: "2015", at: 46, d: 0.3 },
    { k: "type", x: 590, y: 1260, w: 400, h: 120, size: 32, font: T.label, upper: false, weight: 800, color: T.ink, text: "A historic second treble", at: 52, d: 0.3 },
    credit([credits.p2010, credits.bo1]),
  ]} />;

const Q5 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 46, contour: true }}
  layers={[
    { k: "scrap", x: -20, y: 130, w: 1120, h: 1180, c: P[3], r: 1.5, d: 0.2, from: "r", at: 0 },
    ph(images.otamendi, 40, 180, 700, 820, -3, 4, { from: "l", pos: "center 35%", border: 14 }),
    { k: "cut", src: images.p2022cut, x: 560, y: 300, w: 500, h: 800, r: 2, d: 0.85, from: "r", at: 12 },
    ph(images.shirtShop, 30, 1030, 340, 430, -6, 20, { from: "b", pos: "40% 50%", border: 10 }),
    { k: "num", x: 360, y: 1050, w: 700, h: 260, size: 230, font: AB, color: T.ink, text: "2022", at: 24, d: 0.3, r: -2 },
    { k: "tag", x: 400, y: 1330, w: 640, h: 96, r: 2, d: 0.5, at: 36, text: "World Cup winners", size: 44, c: GOLD, color: T.ink },
    credit([credits.otamendi, credits.shirtShop, credits.p2022cut]),
  ]} />;

const Q6 = ({ dur, images, credits, data }) => { const a = data.seasons["2009/10"], b = data.seasons["2018/19"]; return <Collage th="sport" dur={dur} ground={{ seed: 47, contour: true }}
  layers={[
    { k: "scrap", x: 30, y: 110, w: 1020, h: 1400, c: "#fff", r: -0.8, d: 0.15, from: "b", at: 0 },
    { k: "type", x: 70, y: 160, w: 940, h: 70, size: 54, font: AB, color: T.ink, text: "Key passes per 90", at: 4, d: 0.2 },
    { k: "type", x: 70, y: 300, w: 500, h: 40, size: 28, font: T.body, weight: 800, upper: false, color: T.dim, text: "2009/10", at: 10, d: 0.1, from: "none" },
    { k: "bar", x: 70, y: 350, w: 800, h: 90, value: a.key_passes_per90 / 4, c: P[0], at: 10, dur: 28, d: 0 },
    { k: "num", x: 70, y: 450, w: 400, h: 150, size: 130, font: AB, color: P[0], count: [0, a.key_passes_per90 * 10], text: "", fmt: "tenth", at: 10, dur: 28, d: 0.2 },
    { k: "type", x: 70, y: 700, w: 500, h: 40, size: 28, font: T.body, weight: 800, upper: false, color: T.dim, text: "2018/19", at: 24, d: 0.1, from: "none" },
    { k: "bar", x: 70, y: 750, w: 800, h: 90, value: b.key_passes_per90 / 4, c: P[1], at: 24, dur: 32, d: 0 },
    { k: "num", x: 70, y: 850, w: 400, h: 150, size: 130, font: AB, color: P[1], count: [0, b.key_passes_per90 * 10], text: "", fmt: "tenth", at: 24, dur: 32, d: 0.2 },
    { k: "stamp", x: 520, y: 1010, w: 480, h: 130, r: -4, d: 0.3, at: 56, text: "More than double", size: 42, color: P[1] },
    { k: "tag", x: 70, y: 1230, w: 940, h: 150, r: 0.6, d: 0.3, at: 40, size: 26, upper: false, c: P[3], text: "Limited sample: 12 Barcelona league starts per season, StatsBomb open data. A key pass is a pass that led to a shot." },
  ]} />; };

const chip = (x, y, text, c, at) => ({ k: "tag", x, y, w: 470, h: 90, r: x > 400 ? 1.5 : -1.5, d: 0.5, at, text, size: 32, c });
const Q7 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 48, contour: true }}
  layers={[
    { k: "scrap", x: 70, y: 120, w: 940, h: 940, c: P[1], r: 2, d: 0.2, from: "b", at: 0 },
    ph(images.bo0, 30, 170, 330, 430, -6, 8, { from: "l", border: 10 }),
    ph(images.shoe, 730, 190, 320, 410, 6, 12, { from: "r", border: 10, pos: "center 55%" }),
    { k: "cut", src: images.p2022cut, x: 230, y: 110, w: 620, h: 940, r: -1, d: 0.85, from: "b", at: 4 },
    { k: "type", x: 50, y: 1060, w: 980, h: 130, size: 72, font: AB, color: T.ink, text: "GREATEST OF ALL TIME?", at: 16, d: 0.3, r: -1.2 },
    chip(40, 1200, "8 Ballons d'Or", "#fff", 22), chip(570, 1200, "6 Golden Shoes", "#fff", 26),
    chip(40, 1310, "474 La Liga goals", "#fff", 30), chip(570, 1310, "73 goals in 2011–12", GOLD, 34),
    chip(40, 1420, "2 trebles", "#fff", 38), chip(570, 1420, "2022 World Cup", P[3], 42),
    credit([credits.p2022cut, credits.bo0, credits.shoe]),
  ]} />;

const KINDS = { hook: Q0, trophies: Q1, shoes: Q2, chart: Q3, trebles: Q4, worldcup: Q5, creator: Q6, close: Q7 };
export function RivalPlayerShort({ durationInFrames, scenes, captions, images, credits, data }) {
  const sb = scenes.find((s) => s.kind === "creator");
  return (<AbsoluteFill style={{ background: T.ground }}><style>{FONT_FACES + FACE}</style>
    {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} credits={credits} data={data} /></Sequence>; })}
    <Caps th="sport" captions={captions} />
    {sb ? <Sequence from={sb.from} durationInFrames={sb.to - sb.from}><StatsBombAttribution logo={images.sbLogo} /></Sequence> : null}
  </AbsoluteFill>);
}
