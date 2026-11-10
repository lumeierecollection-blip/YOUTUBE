// Court & Spotlight investigation: a layered case-file board (aged paper, torn scraps, taped photographs, typed documents, stamps, string).
// Look reference: the paper-collage documentary style the owner approved. Convictions, acquittals and allegations stay visibly apart.
// String only ever joins items about the same subject and the same claim, never two people.
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { Caps, Collage, THEMES, abs } from "./collage-engine.jsx";

const T = THEMES.case;
const Credit = ({ children }) => ({ k: "type", x: 50, y: 1572, w: 980, h: 30, size: 19, weight: 400, font: T.body, color: T.dim, upper: false, text: children, d: 0, at: 0, from: "none", lh: 1.2 });

const S0 = ({ dur, images, credits }) => <Collage th="case" dur={dur} ground={{ seed: 1, columns: true }}
  layers={[
    { k: "scrap", x: -30, y: 120, w: 1140, h: 960, c: T.paper, r: -1.5, d: 0.15, from: "b", at: 0, lines: true },
    { k: "scrap", x: 560, y: 80, w: 500, h: 500, c: T.paper2, r: 4, d: 0.3, from: "r", at: 4, tape: [{ x: 180, y: -14, r: -6 }] },
    { k: "cut", src: images.portrait, x: 60, y: 210, w: 560, h: 860, r: -2.5, d: 0.8, from: "l", at: 8, outline: false },
    { k: "tag", x: 580, y: 120, w: 440, h: 84, r: 3, d: 0.6, at: 14, text: "Case file · Tax", size: 40 },
    { k: "type", x: 600, y: 250, w: 440, h: 200, size: 190, color: T.accent, text: "3 YEARS", at: 18, d: 0.5, r: -3 },
    { k: "type", x: 604, y: 450, w: 420, h: 120, size: 50, color: T.ink, text: "for unfiled tax returns", at: 26, d: 0.5, r: -3 },
    { k: "stamp", x: 600, y: 820, w: 430, h: 150, r: -7, d: 0.4, at: 36, text: "Sentenced\nApril 2008", size: 44 },
    { k: "doc", x: 60, y: 1090, w: 960, h: 440, r: 0.6, d: 0.4, from: "b", at: 22, head: "US JUSTICE DEPARTMENT RELEASE (REPUBLISHED)", size: 29, lines: [{ t: "U.S. District Judge Wm. Terrell Hodges" }, { t: "sentenced Wesley Trent Snipes to three", hl: true }, { t: "years imprisonment Thursday for charges", hl: true }, { t: "of failing to file income tax returns." }] },
    Credit({ children: `Photo: ${credits.portrait}` }),
  ]} strings={[{ x1: 215, y1: 262, x2: 600, y2: 170, at: 30, sag: 50 }]} />;

const S1 = ({ dur, images }) => <Collage th="case" dur={dur} ground={{ seed: 2, columns: true }}
  layers={[
    { k: "scrap", x: 20, y: 130, w: 1040, h: 1000, c: T.paper2, r: 1.2, d: 0.15, from: "l", at: 0 },
    { k: "doc", x: 70, y: 190, w: 940, h: 640, r: -0.8, d: 0.35, from: "t", at: 4, head: "US JUSTICE DEPARTMENT RELEASE, 25 APR 2008", size: 33, lines: [{ t: "Snipes was found guilty by a jury", hl: true }, { t: "on February 1." }, { t: " " }, { t: "Sentenced: three years imprisonment" }, { t: "for charges of failing to file income" }, { t: "tax returns." }] },
    { k: "stamp", x: 520, y: 760, w: 500, h: 170, r: -8, d: 0.4, at: 36, text: "Convicted\nfailure to file", size: 50 },
    { k: "tag", x: 70, y: 990, w: 560, h: 96, r: -2, d: 0.6, at: 20, text: "Count: failure to file", size: 40 },
    { k: "cut", src: images.portrait, x: 560, y: 940, w: 440, h: 640, r: 2, d: 0.8, from: "r", at: 12, outline: false },
    { k: "scrap", x: 60, y: 1150, w: 470, h: 380, c: T.paper, r: -2, d: 0.5, at: 24, tape: [{ x: 160, y: -14, r: 5 }] },
    { k: "type", x: 90, y: 1190, w: 420, h: 300, size: 46, weight: 700, color: T.ink, text: "The verdict that counted", at: 30, d: 0.5, r: -2 },
  ]} strings={[{ x1: 120, y1: 1038, x2: 300, y2: 330, at: 34, sag: -60 }]} />;

const S2 = ({ dur }) => <Collage th="case" dur={dur} ground={{ seed: 3, columns: true }}
  layers={[
    { k: "scrap", x: 30, y: 110, w: 1020, h: 1380, c: T.paper, r: -1, d: 0.15, from: "r", at: 0 },
    { k: "num", x: 70, y: 150, w: 400, h: 400, size: 440, color: T.ink, count: [0, 5], dur: 14, at: 4, d: 0.5, from: "l", r: -3 },
    { k: "type", x: 440, y: 230, w: 560, h: 300, size: 74, color: T.accent, text: "other charges, the jury said no", at: 10, d: 0.5, r: 1.5 },
    ...["Felony tax fraud", "Conspiracy", "Other charge", "Other charge", "Other charge"].map((t, i) => ({ k: "tag", x: 130 + (i % 2) * 70, y: 640 + i * 118, w: 780, h: 100, r: (i % 2 ? 1.6 : -1.6), d: 0.6, at: 12 + i * 7, from: i % 2 ? "r" : "l", text: t, size: 44 })),
    { k: "stamp", x: 180, y: 1240, w: 720, h: 190, r: -5, d: 0.3, at: 52, text: "Acquitted", size: 110, bw: 12 },
    { k: "type", x: 70, y: 1450, w: 940, h: 50, size: 28, font: T.body, weight: 400, color: T.dim, upper: false, text: "Source: CBS News, \"Wesley Snipes Gets 3 Years In Prison\"", at: 20, d: 0.2, from: "none" },
  ]} strings={[{ x1: 120, y1: 690, x2: 120, y2: 1000, at: 60, sag: -30, c: T.dim }]} />;

const S3 = ({ dur }) => <Collage th="case" dur={dur} ground={{ seed: 4, columns: true }}
  layers={[
    { k: "scrap", x: 40, y: 150, w: 1000, h: 740, c: "#E9B948", r: -2, d: 0.25, from: "t", at: 0, tape: [{ x: 60, y: -10, r: -18 }, { x: 800, y: -10, r: 14 }] },
    { k: "type", x: 100, y: 210, w: 880, h: 80, size: 40, color: T.ink, font: T.label, text: "What the government alleged", at: 8, d: 0.4 },
    { k: "num", x: 90, y: 270, w: 900, h: 400, size: 330, color: T.ink, text: "$13.8M", at: 10, d: 0.5, r: -1 },
    { k: "type", x: 100, y: 640, w: 880, h: 120, size: 44, color: T.ink, text: "at least, in earnings for the years in question", at: 20, d: 0.4, upper: false, font: T.label, weight: 600 },
    { k: "stamp", x: 150, y: 790, w: 780, h: 150, r: -3, d: 0.4, at: 36, text: "Alleged · not a finding", size: 62 },
    { k: "tag", x: 560, y: 1000, w: 450, h: 90, r: 2, d: 0.6, at: 44, text: "$2.7M back taxes, alleged", size: 34 },
    { k: "doc", x: 60, y: 1110, w: 960, h: 420, r: -0.6, d: 0.4, from: "b", at: 30, head: "CBS NEWS, 25 APR 2008", size: 30, lines: [{ t: "The government alleged Snipes made", hl: true }, { t: "at least $13.8 million for the years in", hl: true }, { t: "question and owed $2.7 million in" }, { t: "back taxes." }] },
  ]} strings={[{ x1: 140, y1: 870, x2: 190, y2: 1170, at: 50, sag: 20 }]} />;

const S4 = ({ dur, images }) => <Collage th="case" dur={dur} ground={{ seed: 5, columns: true }}
  layers={[
    { k: "scrap", x: 30, y: 170, w: 490, h: 660, c: T.paper, r: -3, d: 0.3, from: "l", at: 0, tape: [{ x: 150, y: -14, r: 4 }] },
    { k: "scrap", x: 560, y: 200, w: 490, h: 660, c: T.paper2, r: 3, d: 0.3, from: "r", at: 4, tape: [{ x: 160, y: -14, r: -5 }] },
    { k: "type", x: 70, y: 250, w: 410, h: 100, size: 38, color: T.dim, text: "Prosecutors sought", at: 14, d: 0.5, r: -3 },
    { k: "type", x: 70, y: 340, w: 410, h: 400, size: 104, color: T.accent, text: "the maximum", at: 18, d: 0.5, r: -3 },
    { k: "type", x: 600, y: 280, w: 410, h: 100, size: 38, color: T.dim, text: "The judge gave", at: 24, d: 0.5, r: 3 },
    { k: "num", x: 620, y: 330, w: 400, h: 420, size: 400, color: T.ink, text: "3", at: 28, d: 0.5, r: 3 },
    { k: "type", x: 700, y: 700, w: 320, h: 100, size: 70, color: T.ink, text: "years", at: 32, d: 0.5, r: 3 },
    { k: "badge", x: 440, y: 440, w: 200, h: 200, c: T.accent, text: "vs", size: 70, star: false, at: 36, d: 0.4 },
    { k: "cut", src: images.portrait, x: 290, y: 880, w: 500, h: 700, r: -1, d: 0.8, from: "b", at: 40, outline: false },
  ]} />;

const S5 = ({ dur, images, credits }) => <Collage th="case" dur={dur} ground={{ seed: 6, columns: true }}
  layers={[
    { k: "scrap", x: 20, y: 120, w: 1040, h: 1400, c: T.paper, r: 1, d: 0.15, from: "b", at: 0, lines: true },
    { k: "photo", src: images.booking, x: 150, y: 190, w: 560, h: 780, r: -2.5, d: 0.6, from: "l", at: 6, pos: "center 20%", grade: "grayscale(1) contrast(1.1)", tape: [{ x: 60, y: -16, r: -24 }, { x: 440, y: -16, r: 22 }] },
    { k: "tag", x: 620, y: 260, w: 410, h: 150, r: 3, d: 0.6, at: 22, text: "Booking photograph", size: 38 },
    { k: "stamp", x: 600, y: 470, w: 420, h: 170, r: -6, d: 0.4, at: 34, text: "24 Apr 2008", size: 52 },
    { k: "type", x: 600, y: 690, w: 430, h: 300, size: 36, font: T.label, weight: 600, color: T.ink, upper: false, text: "US Marshals Service. Date and author as recorded on Wikimedia Commons. Public domain.", at: 40, d: 0.4 },
    { k: "doc", x: 90, y: 1060, w: 900, h: 400, r: -0.6, d: 0.4, from: "b", at: 30, head: "THE RECORD", size: 31, lines: [{ t: "Jury: guilty on failure to file." }, { t: "Jury: not guilty on five other charges." }, { t: "Government figures: alleged, not found." }, { t: "Sentence: three years." }] },
    Credit({ children: `Photo: ${credits.booking}` }),
  ]} strings={[{ x1: 230, y1: 210, x2: 700, y2: 300, at: 44, sag: -30 }]} pens={[]} />;

const KINDS = { cover: S0, doj: S1, acquitted: S2, alleged: S3, sought: S4, booking: S5 };
export function CourtCaseCollageShort({ durationInFrames, scenes, captions, images, credits }) {
  return (<AbsoluteFill style={{ background: T.ground }}><style>{FONT_FACES}</style>
    {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} credits={credits} /></Sequence>; })}
    <Caps th="case" captions={captions} />
  </AbsoluteFill>);
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 780, defaultProps: { durationInFrames: 780, scenes: [], captions: [] } };
export const caseCompositions = [{ id: "CourtCaseCollageShort", component: CourtCaseCollageShort, ...base, defaultProps: { ...base.defaultProps, images: {}, credits: {} } }];
