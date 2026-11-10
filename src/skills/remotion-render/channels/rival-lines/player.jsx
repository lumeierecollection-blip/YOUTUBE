// Rival Lines player documentary (Format A): premium editorial sports documentary built on the layered collage engine (sport theme).
// Layered photographs and sticker cut-outs, big club-coloured type, a career timeline, pass-origin heatmaps and a per-90 comparison.
// Photographs are real Commons images. Event-data figures come from a limited, labelled sample and are credited to StatsBomb.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { Caps, Collage, THEMES } from "../court-and-spotlight/collage-engine.jsx";
import { StatsBombAttribution } from "./attribution.jsx";
import { staticFile } from "remotion";

const T = THEMES.sport, P = T.pop;
const FACE = `@font-face{font-family:"Archivo Black";font-weight:400;src:url("${staticFile("fonts/ArchivoBlack-400.woff2")}") format("woff2");}`;
const AB = '"Archivo Black", sans-serif';
const credit = (text) => ({ k: "type", x: 50, y: 1566, w: 980, h: 30, size: 19, weight: 400, font: T.body, color: T.dim, upper: false, text, d: 0, at: 0, from: "none", lh: 1.2 });

const P0 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 21, contour: true }}
  layers={[
    { k: "type", x: -20, y: 250, w: 1120, h: 360, size: 330, font: AB, color: P[0], text: "MESSI", at: 4, d: 0.3, from: "l", ls: "-0.03em" },
    { k: "scrap", x: 540, y: 520, w: 560, h: 960, c: P[1], r: 4, d: 0.25, from: "r", at: 2 },
    { k: "photo", src: images.p2011, x: 40, y: 760, w: 470, h: 620, r: -5, d: 0.5, from: "l", at: 8, pos: "center 20%", frame: "#fff", border: 14 },
    { k: "photo", src: images.p2007, x: 60, y: 1120, w: 460, h: 330, r: 3, d: 0.6, from: "b", at: 12, pos: "center 25%", frame: "#fff", border: 12 },
    { k: "cut", src: images.p2022cut, x: 290, y: 400, w: 720, h: 1090, r: 1.2, d: 0.85, from: "b", at: 6 },
    { k: "tag", x: 60, y: 140, w: 700, h: 84, r: -2, d: 0.6, at: 16, text: "Most decorated player in football history", size: 32, c: "#fff" },
    { k: "badge", x: 790, y: 1180, w: 230, h: 230, c: P[2], color: T.ink, text: "FC Barcelona", size: 30, at: 28, d: 0.6 },
    credit(`Photos: ${credits.p2022cut}; ${credits.p2011}; ${credits.p2007}`),
  ]} />;

const P1 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 22, contour: true }}
  layers={[
    { k: "scrap", x: 20, y: 120, w: 1040, h: 780, c: P[3], r: -1.5, d: 0.2, from: "t", at: 0 },
    { k: "photo", src: images.p2007, x: 60, y: 190, w: 560, h: 640, r: -3, d: 0.6, from: "l", at: 4, pos: "center 25%", frame: "#fff", border: 14 },
    { k: "photo", src: images.p2010, x: 540, y: 300, w: 480, h: 590, r: 3, d: 0.7, from: "r", at: 10, pos: "center 18%", frame: "#fff", border: 14 },
    { k: "scrap", x: 40, y: 960, w: 1000, h: 540, c: "#fff", r: 0.6, d: 0.3, from: "b", at: 6 },
    { k: "bar", x: 110, y: 1090, w: 860, h: 14, value: 1, c: T.ink, at: 14, dur: 30, d: 0 },
    { k: "num", x: 90, y: 1000, w: 380, h: 100, size: 96, font: AB, color: P[0], text: "2004", at: 18, d: 0.3 },
    { k: "type", x: 90, y: 1130, w: 400, h: 200, size: 40, font: T.label, upper: false, weight: 800, color: T.ink, text: "Barcelona debut, aged 17", at: 24, d: 0.3 },
    { k: "num", x: 560, y: 1000, w: 380, h: 100, size: 96, font: AB, color: P[1], text: "2009", at: 52, d: 0.3 },
    { k: "type", x: 560, y: 1130, w: 440, h: 200, size: 40, font: T.label, upper: false, weight: 800, color: T.ink, text: "First treble in Spanish football", at: 58, d: 0.3 },
    { k: "badge", x: 840, y: 1300, w: 190, h: 190, c: P[2], color: T.ink, text: "2008–09", size: 30, at: 64, d: 0.5 },
    credit(`Photos (2007, 2010): ${credits.p2007}; ${credits.p2010}`),
  ]} />;

const P2 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 23, contour: true }}
  layers={[
    { k: "tag", x: 60, y: 120, w: 960, h: 90, r: -1, d: 0.4, at: 2, text: "Where his passes began · 12 league starts each", size: 34, c: "#fff" },
    { k: "photo", src: images.heat2009, x: 120, y: 250, w: 800, h: 560, r: -1.5, d: 0.5, from: "l", at: 6, fit: "cover", frame: "#fff", border: 10 },
    { k: "type", x: 60, y: 270, w: 300, h: 120, size: 78, font: AB, color: P[0], text: "2009/10", at: 14, d: 0.4, r: -3 },
    { k: "photo", src: images.heat2018, x: 160, y: 850, w: 800, h: 560, r: 1.5, d: 0.5, from: "r", at: 12, fit: "cover", frame: "#fff", border: 10 },
    { k: "type", x: 560, y: 1290, w: 460, h: 120, size: 78, font: AB, color: P[1], text: "2018/19", at: 20, d: 0.4, r: 3 },
    { k: "type", x: 60, y: 1430, w: 960, h: 90, size: 26, font: T.body, weight: 400, color: T.dim, upper: false, text: "Pass-start locations from recorded events: darker means more passes began there. Not tracking data.", at: 24, d: 0.2, from: "none" },
  ]} />;

const bars = (y, label, a, b, max, unit) => [
  { k: "type", x: 70, y, w: 940, h: 70, size: 54, font: AB, color: T.ink, text: label, at: 4, d: 0.2 },
  { k: "bar", x: 70, y: y + 100, w: 700, h: 56, value: a / max, c: P[0], at: 10, dur: 28, d: 0 },
  { k: "num", x: 800, y: y + 82, w: 230, h: 90, size: 80, font: AB, color: P[0], count: [0, a * 10], text: "", at: 10, dur: 28, d: 0.2, fmt: "tenth" },
  { k: "type", x: 70, y: y + 168, w: 400, h: 40, size: 24, font: T.body, weight: 700, upper: false, color: T.dim, text: "2009/10", at: 12, d: 0.1, from: "none" },
  { k: "bar", x: 70, y: y + 220, w: 700, h: 56, value: b / max, c: P[1], at: 22, dur: 28, d: 0 },
  { k: "num", x: 800, y: y + 202, w: 230, h: 90, size: 80, font: AB, color: P[1], count: [0, b * 10], text: "", at: 22, dur: 28, d: 0.2, fmt: "tenth" },
  { k: "type", x: 70, y: y + 288, w: 400, h: 40, size: 24, font: T.body, weight: 700, upper: false, color: T.dim, text: "2018/19", at: 24, d: 0.1, from: "none" },
];
const P3 = ({ dur, images, credits, data }) => { const a = data.seasons["2009/10"], b = data.seasons["2018/19"]; return <Collage th="sport" dur={dur} ground={{ seed: 24, contour: true }}
  layers={[
    { k: "scrap", x: 30, y: 110, w: 1020, h: 1400, c: "#fff", r: -0.8, d: 0.15, from: "b", at: 0 },
    ...bars(170, "Shots per 90", a.shots_per90, b.shots_per90, 6, ""),
    ...bars(640, "Key passes per 90", a.key_passes_per90, b.key_passes_per90, 6, ""),
    { k: "stamp", x: 520, y: 1130, w: 480, h: 130, r: -4, d: 0.3, at: 50, text: "More than double", size: 42, color: P[1] },
    { k: "tag", x: 70, y: 1330, w: 940, h: 130, r: 0.6, d: 0.3, at: 36, size: 26, upper: false, c: P[3], text: "Limited sample: 12 Barcelona league starts per season, StatsBomb open data. Key pass = a pass that led to a shot." },
  ]} />; };

const P4b = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 25, contour: true }}
  layers={[
    { k: "scrap", x: -20, y: 150, w: 1120, h: 900, c: P[0], r: -1.5, d: 0.2, from: "l", at: 0 },
    { k: "photo", src: images.p2018, x: 50, y: 200, w: 620, h: 800, r: -3, d: 0.6, from: "l", at: 6, pos: "center 30%", frame: "#fff", border: 14 },
    { k: "cut", src: images.p2022cut, x: 520, y: 260, w: 520, h: 820, r: 2, d: 0.85, from: "r", at: 12 },
    { k: "num", x: 40, y: 1000, w: 420, h: 440, size: 470, font: AB, color: P[1], count: [0, 8], dur: 16, at: 20, d: 0.3, r: -2 },
    { k: "type", x: 390, y: 1130, w: 640, h: 100, size: 70, font: AB, color: T.ink, text: "Ballons d'Or", at: 28, d: 0.3 },
    { k: "tag", x: 390, y: 1260, w: 640, h: 96, r: 2, d: 0.5, at: 40, text: "2022 World Cup winner", size: 38, c: P[2] },
    credit(`Photos: ${credits.p2018}; ${credits.p2022cut}`),
  ]} />;

const P5 = ({ dur, images, credits }) => <Collage th="sport" dur={dur} ground={{ seed: 26, contour: true }}
  layers={[
    { k: "scrap", x: 80, y: 140, w: 920, h: 1180, c: P[1], r: 2, d: 0.2, from: "b", at: 0 },
    { k: "scrap", x: -30, y: 900, w: 1140, h: 560, c: "#fff", r: -1, d: 0.3, from: "l", at: 6 },
    { k: "cut", src: images.p2022cut, x: 160, y: 130, w: 760, h: 1210, r: -1, d: 0.85, from: "b", at: 4 },
    { k: "type", x: 70, y: 1230, w: 940, h: 140, size: 92, font: AB, color: T.ink, text: "Finisher", at: 18, d: 0.3, r: -2 },
    { k: "type", x: 70, y: 1330, w: 940, h: 140, size: 92, font: AB, color: P[1], text: "to creator", at: 26, d: 0.3, r: -2 },
    { k: "tag", x: 570, y: 1240, w: 450, h: 150, r: 2, d: 0.5, at: 34, size: 26, upper: false, c: P[2], color: T.ink, text: "In this sample of 12 + 12 league starts" },
    credit(`Photo: ${credits.p2022cut}`),
  ]} />;

const KINDS = { intro: P0, timeline: P1, heat: P2, stats: P3, honours: P4b, close: P5 };
export function RivalPlayerShort({ durationInFrames, scenes, captions, images, credits, data }) {
  return (<AbsoluteFill style={{ background: T.ground }}><style>{FONT_FACES + FACE}</style>
    {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} credits={credits} data={data} /></Sequence>; })}
    <Caps th="sport" captions={captions} />
    <StatsBombAttribution logo={images.sbLogo} />
  </AbsoluteFill>);
}
