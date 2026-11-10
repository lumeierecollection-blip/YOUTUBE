// Court & Spotlight entertainment feature: the same living-collage language as the case board, in a bright magazine key
// (warm white paper, pastel torn scraps, washi tape, star stickers, serif headlines). Real, licensed photographs sit inside the page.
import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { Caps, Collage, THEMES } from "./collage-engine.jsx";

const T = THEMES.mag, P = T.pop;
const credit = (text) => ({ k: "type", x: 50, y: 1572, w: 980, h: 30, size: 19, weight: 400, font: T.body, color: T.dim, upper: false, text, d: 0, at: 0, from: "none", lh: 1.2 });
const SERIF_I = { font: '"Playfair Display", serif' };

const S0 = ({ dur, images, credits }) => <Collage th="mag" dur={dur} ground={{ seed: 11, contour: false }}
  layers={[
    { k: "scrap", x: -40, y: 90, w: 720, h: 800, c: P[0], r: -4, d: 0.2, from: "l", at: 0 },
    { k: "scrap", x: 470, y: 50, w: 640, h: 560, c: P[1], r: 5, d: 0.3, from: "r", at: 4, tape: [{ x: 250, y: -12, r: -4 }] },
    { k: "scrap", x: 90, y: 940, w: 930, h: 520, c: P[2], r: -2, d: 0.3, from: "b", at: 8 },
    { k: "photo", src: images.p2023, x: 170, y: 250, w: 760, h: 940, r: 2.2, d: 0.65, from: "b", at: 6, pos: "center 12%", tape: [{ x: 40, y: -14, r: -28 }, { x: 560, y: -14, r: 24 }], tapeC: "rgba(255,255,255,0.8)", frame: "#fff", border: 18 },
    { k: "type", x: 70, y: 110, w: 800, h: 200, size: 112, font: '"Playfair Display", serif', upper: false, weight: 700, color: T.ink, text: "The most\nGrammys ever", at: 14, d: 0.5, r: -2, lh: 0.95 },
    { k: "badge", x: 760, y: 1010, w: 270, h: 270, c: P[1], color: T.ink, text: "New record", size: 40, at: 36, d: 0.6 },
    { k: "tag", x: 80, y: 1290, w: 620, h: 90, r: -2, d: 0.6, at: 28, text: "Grammy Awards · Feb 2023", size: 36, c: "#fff" },
    credit(`Photo: ${credits.p2023}`),
  ]} />;

const S1 = ({ dur, images, credits }) => <Collage th="mag" dur={dur} ground={{ seed: 12, contour: false }}
  layers={[
    { k: "scrap", x: -20, y: 110, w: 1120, h: 1000, c: P[1], r: -1.5, d: 0.2, from: "t", at: 0 },
    { k: "tag", x: 60, y: 160, w: 520, h: 84, r: -2, d: 0.6, at: 6, text: "The old record", size: 38, c: "#fff" },
    { k: "num", x: 40, y: 240, w: 560, h: 560, size: 560, color: T.ink, count: [0, 31], dur: 20, at: 4, d: 0.5, r: -2, font: '"Archivo Black", sans-serif' },
    { k: "type", x: 70, y: 820, w: 480, h: 80, size: 56, color: T.ink, text: "Grammy wins", at: 20, d: 0.4, font: T.label, upper: false },
    { k: "photo", src: images.solti, x: 560, y: 260, w: 450, h: 660, r: 3, d: 0.7, from: "r", at: 10, pos: "center 12%", frame: "#fff", border: 16, grade: "sepia(0.2)", tape: [{ x: 150, y: -14, r: -6 }] },
    { k: "tag", x: 540, y: 950, w: 490, h: 90, r: 2, d: 0.6, at: 26, text: "Georg Solti, conductor", size: 32, c: P[0] },
    { k: "scrap", x: 70, y: 1150, w: 940, h: 340, c: P[2], r: -1.5, d: 0.4, from: "b", at: 18, tape: [{ x: 60, y: -12, r: -10 }] },
    { k: "type", x: 120, y: 1200, w: 840, h: 250, size: 50, color: T.ink, font: T.label, upper: false, weight: 700, text: "The previous record of 31 wins was set by the late Hungarian-born conductor Georg Solti.", at: 26, d: 0.4, r: -1.5, lh: 1.15 },
    credit(`Portrait (1974): ${credits.solti}`),
  ]} />;

const S2 = ({ dur, images, credits }) => <Collage th="mag" dur={dur} ground={{ seed: 13, contour: false }}
  layers={[
    { k: "scrap", x: -40, y: 90, w: 780, h: 860, c: P[3], r: -3, d: 0.2, from: "l", at: 0 },
    { k: "scrap", x: 420, y: 600, w: 700, h: 900, c: P[0], r: 4, d: 0.3, from: "r", at: 5 },
    { k: "num", x: 60, y: 120, w: 520, h: 560, size: 540, color: T.accent, count: [0, 9], dur: 14, at: 4, d: 0.5, r: -2, font: '"Archivo Black", sans-serif' },
    { k: "type", x: 70, y: 690, w: 560, h: 90, size: 64, color: T.ink, text: "nominations", at: 14, d: 0.4, font: T.label, upper: false },
    { k: "cut", src: images.p2011cut, x: 560, y: 110, w: 480, h: 700, r: 2, d: 0.85, from: "r", at: 8 },
    ...Array.from({ length: 9 }, (_, i) => ({ k: "badge", x: 70 + (i % 5) * 88 + (i >= 5 ? 44 : 0), y: 820 + Math.floor(i / 5) * 80, w: 76, h: 76, c: P[1], text: "", at: 14 + i * 3, d: 0.3 })),
    { k: "tag", x: 440, y: 1010, w: 600, h: 100, r: -2, d: 0.6, at: 40, text: "Half an hour in · best R&B song", size: 32, c: "#fff" },
    { k: "type", x: 470, y: 1120, w: 560, h: 160, size: 120, color: T.ink, text: "“Cuff It”", at: 46, d: 0.5, r: -2, upper: false, font: '"Playfair Display", serif', weight: 700 },
    { k: "stamp", x: 450, y: 1300, w: 580, h: 130, r: 3, d: 0.4, at: 62, text: "Tied the record", size: 54, bg: "#fff" },
    credit(`Photo (2011): ${credits.p2011cut}`),
  ]} />;

const S3 = ({ dur, images, credits }) => { const flip = Math.round(dur * 0.45); return <Collage th="mag" dur={dur} ground={{ seed: 14, contour: false }}
  layers={[
    { k: "scrap", x: -20, y: 80, w: 1120, h: 960, c: P[0], r: 1.5, d: 0.2, from: "t", at: 0 },
    { k: "tag", x: 60, y: 120, w: 640, h: 84, r: -2, d: 0.6, at: 6, text: "Her fourth win · Renaissance", size: 34, c: "#fff" },
    { k: "num", x: 60, y: 230, w: 460, h: 340, size: 330, color: T.dim, text: "31", strike: flip - 4, at: 8, d: 0.5, r: -2, font: '"Archivo Black", sans-serif' },
    { k: "num", x: 50, y: 520, w: 560, h: 520, size: 470, color: T.accent, text: "32", at: flip, d: 0.5, r: -1, font: '"Archivo Black", sans-serif' },
    { k: "photo", src: images.trophy, x: 640, y: 150, w: 370, h: 600, r: 4, d: 0.7, from: "r", at: 10, pos: "center 30%", frame: "#fff", border: 14, tape: [{ x: 110, y: -14, r: 8 }] },
    { k: "badge", x: 700, y: 700, w: 260, h: 260, c: P[1], color: T.ink, text: "Record", size: 46, at: flip + 8, d: 0.6 },
    { k: "scrap", x: 60, y: 1090, w: 960, h: 200, c: "#fff", r: -1, d: 0.4, from: "b", at: flip - 4, tape: [{ x: 400, y: -12, r: 3 }] },
    { k: "type", x: 100, y: 1130, w: 880, h: 130, size: 54, color: T.ink, font: T.label, upper: false, weight: 700, text: "Best dance/electronic music album", at: flip, d: 0.4, r: -1 },
    credit(`Trophy photo: ${credits.trophy} (Grammy trophies from another artist's collection)`),
  ]} pens={[{ cx: 300, cy: 760, rx: 300, ry: 230, at: flip + 14, c: T.accent2 === "#FFD43B" ? "#1D1A2F" : "#1D1A2F" }]} />; };

const S4 = ({ dur, images, credits }) => <Collage th="mag" dur={dur} ground={{ seed: 15, contour: false }}
  layers={[
    { k: "scrap", x: -30, y: 90, w: 1140, h: 1400, c: P[1], r: -1, d: 0.2, from: "l", at: 0 },
    { k: "type", x: 70, y: 130, w: 940, h: 130, size: 104, color: T.ink, text: "“I'm just trying to", at: 6, d: 0.4, upper: false, font: '"Playfair Display", serif', r: -1 },
    { k: "type", x: 70, y: 245, w: 940, h: 160, size: 150, color: T.accent, text: "receive", at: 12, d: 0.4, upper: false, font: '"Playfair Display", serif', r: -1 },
    { k: "type", x: 70, y: 410, w: 940, h: 130, size: 104, color: T.ink, text: "this night.”", at: 18, d: 0.4, upper: false, font: '"Playfair Display", serif', r: -1 },
    { k: "photo", src: images.p2009, x: 120, y: 640, w: 780, h: 800, r: 2.5, d: 0.65, from: "b", at: 14, pos: "center 18%", frame: "#fff", border: 18, tape: [{ x: 40, y: -14, r: -26 }, { x: 560, y: -14, r: 22 }] },
    { k: "badge", x: 740, y: 560, w: 270, h: 270, c: P[0], color: T.ink, text: "On stage", size: 40, at: 36, d: 0.6 },
    credit(`Photo (2009, not that night): ${credits.p2009}`),
  ]} />;

const KINDS = { cover: S0, solti: S1, nine: S2, record: S3, quote: S4 };
export function CourtMagCollageShort({ durationInFrames, scenes, captions, images, credits }) {
  return (<AbsoluteFill style={{ background: T.ground }}><style>{FONT_FACES + FACE}</style>
    {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} credits={credits} /></Sequence>; })}
    <Caps th="mag" captions={captions} />
  </AbsoluteFill>);
}
const FACE = `@font-face{font-family:"Archivo Black";font-weight:400;src:url("${staticFile("fonts/ArchivoBlack-400.woff2")}") format("woff2");}`;
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 780, defaultProps: { durationInFrames: 780, scenes: [], captions: [] } };
export const magCompositions = [{ id: "CourtMagCollageShort", component: CourtMagCollageShort, ...base, defaultProps: { ...base.defaultProps, images: {}, credits: {} } }];
