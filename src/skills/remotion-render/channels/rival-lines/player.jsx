// Rival Lines player documentary (Format A), cinematic cut: a question-led story ("why is he called the greatest?") told in short beats,
// on the layered collage engine (sport theme): photographs, a sticker portrait, drawn club and national shirts, a goals-per-season chart,
// trophy counts and a per-90 comparison. Verified career figures come from Wikipedia, the key-pass comparison from a limited, labelled
// StatsBomb sample. Shirts are original artwork with no crest, sponsor or manufacturer mark.
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, interpolate, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { Caps, Collage, THEMES } from "../court-and-spotlight/collage-engine.jsx";
import { StatsBombAttribution } from "./attribution.jsx";
import { Jersey } from "./jersey.jsx";

const T = THEMES.sport, P = T.pop, GOLD = "#EDBB00";
const FACE = `@font-face{font-family:"Archivo Black";font-weight:400;src:url("${staticFile("fonts/ArchivoBlack-400.woff2")}") format("woff2");}`;
const AB = '"Archivo Black", sans-serif';
const credit = (text) => ({ k: "type", x: 50, y: 1566, w: 980, h: 30, size: 19, weight: 400, font: T.body, color: T.dim, upper: false, text, d: 0, at: 0, from: "none", lh: 1.2 });
const shirt = (kit, x, y, w, r, at, id, number = "10", name = "MESSI") => ({ k: "custom", x, y, w, h: Math.round(w * 1.1), r, d: 0.6, at, from: "pop", node: <Jersey kit={kit} id={id} number={number} name={name} /> });
const clampI = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

const Q0 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 31, contour: true }}
  layers={[
    { k: "scrap", x: -30, y: 640, w: 1140, h: 900, c: P[0], r: -1.5, d: 0.2, from: "b", at: 0 },
    { k: "type", x: 60, y: 120, w: 960, h: 150, size: 150, font: AB, color: T.ink, text: "WHY THE", at: 2, d: 0.3, from: "l", ls: "-0.02em" },
    { k: "type", x: 50, y: 270, w: 1010, h: 180, size: 160, font: AB, color: P[1], text: "GREATEST?", at: 8, d: 0.3, from: "r", ls: "-0.03em" },
    shirt("barca", 10, 560, 400, -9, 10, "jb0"),
    shirt("arg", 670, 600, 400, 8, 14, "ja0"),
    { k: "cut", src: images.p2022cut, x: 270, y: 430, w: 560, h: 1110, r: 1, d: 0.85, from: "b", at: 6 },
    { k: "tag", x: 60, y: 1480, w: 520, h: 84, r: -2, d: 0.5, at: 20, text: "Lionel Messi", size: 38, c: "#fff" },
    credit(`Photo: ${credits.p2022cut}`),
  ]} />;

const Q1 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 32, contour: true }}
  layers={[
    { k: "scrap", x: 20, y: 130, w: 1040, h: 1380, c: "#fff", r: -0.8, d: 0.15, from: "t", at: 0 },
    { k: "num", x: 40, y: 150, w: 500, h: 560, size: 560, font: AB, color: P[1], count: [0, 8], dur: 14, at: 4, d: 0.3, r: -2 },
    { k: "type", x: 70, y: 720, w: 600, h: 120, size: 74, font: AB, color: T.ink, text: "Ballons d'Or", at: 14, d: 0.3 },
    { k: "photo", src: images.p2011, x: 570, y: 190, w: 440, h: 560, r: 3, d: 0.6, from: "r", at: 8, pos: "center 18%", frame: "#fff", border: 14 },
    ...Array.from({ length: 8 }, (_, i) => ({ k: "badge", x: 90 + (i % 4) * 230, y: 900 + Math.floor(i / 4) * 230, w: 190, h: 190, c: GOLD, color: T.ink, star: false, text: "BALLON D'OR", size: 24, at: 16 + i * 4, d: 0.4 })),
    credit(`Photo (2011): ${credits.p2011}`),
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
const Q2 = ({ dur, images, credits, data }) => { const best = data.barcelona_la_liga.reduce((a, b) => (b.goals > a.goals ? b : a)), bi = data.barcelona_la_liga.findIndex((s) => s.season === best.season); return <Collage th="sport" dur={dur} ground={{ seed: 33, contour: true }}
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

const Q3 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 34, contour: true }}
  layers={[
    { k: "scrap", x: -20, y: 150, w: 1120, h: 700, c: P[1], r: -1.5, d: 0.2, from: "l", at: 0 },
    { k: "photo", src: images.p2010, x: 60, y: 200, w: 560, h: 650, r: -3, d: 0.6, from: "l", at: 4, pos: "center 18%", frame: "#fff", border: 14 },
    shirt("barca", 650, 250, 370, 7, 12, "jb3"),
    { k: "type", x: 60, y: 930, w: 960, h: 140, size: 120, font: AB, color: T.ink, text: "TWO TREBLES", at: 16, d: 0.3, r: -1.5 },
    { k: "scrap", x: 50, y: 1090, w: 460, h: 330, c: "#fff", r: -2, d: 0.4, from: "b", at: 22, tape: [{ x: 150, y: -14, r: 4 }] },
    { k: "type", x: 80, y: 1130, w: 400, h: 120, size: 100, font: AB, color: P[0], text: "2009", at: 28, d: 0.3 },
    { k: "type", x: 80, y: 1250, w: 400, h: 120, size: 32, font: T.label, upper: false, weight: 800, color: T.ink, text: "The first treble in Spanish football", at: 34, d: 0.3 },
    { k: "scrap", x: 560, y: 1090, w: 460, h: 330, c: "#fff", r: 2, d: 0.4, from: "b", at: 40, tape: [{ x: 160, y: -14, r: -5 }] },
    { k: "type", x: 590, y: 1130, w: 400, h: 120, size: 100, font: AB, color: P[1], text: "2015", at: 46, d: 0.3 },
    { k: "type", x: 590, y: 1250, w: 400, h: 120, size: 32, font: T.label, upper: false, weight: 800, color: T.ink, text: "A historic second treble", at: 52, d: 0.3 },
    credit(`Photo (2010): ${credits.p2010}`),
  ]} />;

const Q4 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 35, contour: true }}
  layers={[
    { k: "scrap", x: -20, y: 130, w: 1120, h: 1100, c: P[3], r: 1.5, d: 0.2, from: "r", at: 0 },
    { k: "photo", src: images.p2018, x: 40, y: 190, w: 560, h: 600, r: -4, d: 0.6, from: "l", at: 4, pos: "center 30%", frame: "#fff", border: 14 },
    { k: "cut", src: images.p2022cut, x: 470, y: 240, w: 580, h: 920, r: 2, d: 0.85, from: "r", at: 10 },
    shirt("arg", 20, 860, 360, -7, 18, "ja4"),
    { k: "num", x: 370, y: 1030, w: 660, h: 260, size: 230, font: AB, color: T.ink, text: "2022", at: 22, d: 0.3, r: -2 },
    { k: "tag", x: 380, y: 1300, w: 640, h: 96, r: 2, d: 0.5, at: 34, text: "World Cup winner", size: 44, c: GOLD, color: T.ink },
    credit(`Photos: ${credits.p2018} (2018, not the final); ${credits.p2022cut}`),
  ]} />;

const Q5 = ({ dur, images, credits, data }) => { const a = data.seasons["2009/10"], b = data.seasons["2018/19"]; return <Collage th="sport" dur={dur} ground={{ seed: 36, contour: true }}
  layers={[
    { k: "scrap", x: 30, y: 110, w: 1020, h: 1400, c: "#fff", r: -0.8, d: 0.15, from: "b", at: 0 },
    { k: "type", x: 70, y: 160, w: 640, h: 70, size: 54, font: AB, color: T.ink, text: "Key passes per 90", at: 4, d: 0.2 },
    shirt("barca", 740, 130, 270, 6, 8, "jb5"),
    { k: "type", x: 70, y: 300, w: 500, h: 40, size: 28, font: T.body, weight: 800, upper: false, color: T.dim, text: "2009/10", at: 10, d: 0.1, from: "none" },
    { k: "bar", x: 70, y: 350, w: 800, h: 90, value: a.key_passes_per90 / 4, c: P[0], at: 10, dur: 28, d: 0 },
    { k: "num", x: 70, y: 450, w: 400, h: 150, size: 130, font: AB, color: P[0], count: [0, a.key_passes_per90 * 10], text: "", fmt: "tenth", at: 10, dur: 28, d: 0.2 },
    { k: "type", x: 70, y: 700, w: 500, h: 40, size: 28, font: T.body, weight: 800, upper: false, color: T.dim, text: "2018/19", at: 24, d: 0.1, from: "none" },
    { k: "bar", x: 70, y: 750, w: 800, h: 90, value: b.key_passes_per90 / 4, c: P[1], at: 24, dur: 32, d: 0 },
    { k: "num", x: 70, y: 850, w: 400, h: 150, size: 130, font: AB, color: P[1], count: [0, b.key_passes_per90 * 10], text: "", fmt: "tenth", at: 24, dur: 32, d: 0.2 },
    { k: "stamp", x: 520, y: 1010, w: 480, h: 130, r: -4, d: 0.3, at: 56, text: "More than double", size: 42, color: P[1] },
    { k: "tag", x: 70, y: 1230, w: 940, h: 150, r: 0.6, d: 0.3, at: 40, size: 26, upper: false, c: P[3], text: "Limited sample: 12 Barcelona league starts per season, StatsBomb open data. A key pass is a pass that led to a shot." },
  ]} />; };

const chip = (x, y, text, c, at) => ({ k: "tag", x, y, w: 470, h: 96, r: (x > 400 ? 1.5 : -1.5), d: 0.5, at, text, size: 34, c });
const Q6 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 37, contour: true }}
  layers={[
    { k: "scrap", x: 70, y: 120, w: 940, h: 1000, c: P[1], r: 2, d: 0.2, from: "b", at: 0 },
    shirt("barca", 10, 200, 330, -8, 8, "jb6"),
    shirt("arg", 740, 220, 330, 8, 12, "ja6"),
    { k: "cut", src: images.p2022cut, x: 220, y: 120, w: 640, h: 950, r: -1, d: 0.85, from: "b", at: 4 },
    { k: "type", x: 60, y: 1090, w: 960, h: 120, size: 92, font: AB, color: T.ink, text: "THE CASE", at: 16, d: 0.3, r: -1.5 },
    chip(50, 1290, "8 Ballons d'Or", "#fff", 22), chip(560, 1290, "474 La Liga goals", "#fff", 28),
    chip(50, 1410, "73 goals in 2011–12", GOLD, 34), chip(560, 1410, "2022 World Cup", P[3], 40),
    credit(`Photo: ${credits.p2022cut}`),
  ]} />;

const KINDS = { hook: Q0, trophies: Q1, chart: Q2, trebles: Q3, worldcup: Q4, creator: Q5, close: Q6 };
export function RivalPlayerShort({ durationInFrames, scenes, captions, images, credits, data }) {
  const usesSb = scenes.some((s) => s.kind === "creator");
  return (<AbsoluteFill style={{ background: T.ground }}><style>{FONT_FACES + FACE}</style>
    {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} credits={credits} data={data} /></Sequence>; })}
    <Caps th="sport" captions={captions} />
    {usesSb ? <Sequence from={scenes.find((s) => s.kind === "creator").from} durationInFrames={scenes.find((s) => s.kind === "creator").to - scenes.find((s) => s.kind === "creator").from}><StatsBombAttribution logo={images.sbLogo} /></Sequence> : null}
  </AbsoluteFill>);
}
