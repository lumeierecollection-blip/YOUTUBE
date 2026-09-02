/**
 * LAYOUT-SYSTEM.md §8.4 step 1 verification — "L1–L3 pass on hand-written
 * fixtures" (stage 1) extended by Stage 6 to L1–L12 with compiler-shaped
 * fixtures. Pure Node. Exits non-zero if any expectation is violated.
 *
 * Stage 1 sections (unchanged):
 *   - L1/L2/L3 pass on hand-written Shorts and Longform frames
 *   - L1 catches a rect crossing its slot
 *   - L2 catches an out-of-safe slot (including the original documented
 *     caption values {150,1148,780,100}, whose right edge 930 exceeds the
 *     safe right 888 — the bug that motivated the correction)
 *   - L3 records off-grid roundings and rejects non-finite coordinates
 *
 * Stage 6 sections:
 *   - L4 catches two non-persistent rects overlapping in a frame range and
 *     lets range-separated or persistent rects coexist
 *   - L5 catches a text rect without a measured size or resolved fontSize
 *   - L6 catches fontSize below the role floors (84 headline / 64 caption /
 *     44 support)
 *   - L7 catches zero or two accent elements per frame
 *   - L8 catches a bar floating off the axis (Δ ≠ 0)
 *   - L9 catches unequal chart gutters (the 42/84 split)
 *   - L10 catches an axis label mis-positioned from the gridline
 *   - L11 catches beats with 0 or >5 layers
 *   - L12 catches an atFrame range outside [0, durationInFrames]
 *   - lintAll passes the compiler-shaped good frame across all 12 checks
 */

import { ATMOSPHERE_HORIZON_Y, SAFE_LONGFORM, SAFE_SHORTS, SLOTS_LONGFORM, SLOTS_SHORTS } from "./slots.js";
import {
  lintAll,
  lintL1,
  lintL10,
  lintL11,
  lintL12,
  lintL18,
  lintL19,
  lintL2,
  lintL3,
  lintL4,
  lintL5,
  lintL6,
  lintL7,
  lintL8,
  lintL9,
  lintTier1,
} from "./lint.js";

let failed = 0;
let passed = 0;

function check(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function failuresOf(result) {
  return result.failures.length ? result.failures.join(" | ") : "";
}

// ── Stage 1 fixtures ─────────────────────────────────────────────────────────

const goodShorts = {
  beatId: "b07",
  rects: [
    { role: "kicker", slot: "kicker", x: 48, y: 296, w: 160, h: 40 },
    { role: "chart", slot: "stage", x: 88, y: 456, w: 760, h: 424 },
    { role: "headline", slot: "headline", x: 48, y: 1008, w: 800, h: 96 },
    { role: "caption", slot: "caption", x: 88, y: 1176, w: 760, h: 72 },
  ],
};

const goodLongform = {
  beatId: "l07",
  rects: [
    { role: "kicker", slot: "kicker", x: 160, y: 108, w: 240, h: 40 },
    { role: "chart", slot: "stage", x: 160, y: 196, w: 1600, h: 560 },
    { role: "headline", slot: "headline", x: 160, y: 812, w: 1200, h: 80 },
    { role: "caption", slot: "caption", x: 456, y: 908, w: 1008, h: 72 },
  ],
};

const badRectCrossesSlot = {
  beatId: "b08",
  rects: [
    { role: "headline", slot: "headline", x: 48, y: 1140, w: 800, h: 40 },
  ],
};

const badRectUnknownSlot = {
  beatId: "b09",
  rects: [{ role: "ghost", slot: "ghost", x: 48, y: 288, w: 8, h: 8 }],
};

const originalDocCaptionSlots = {
  ...SLOTS_SHORTS,
  caption: { x: 150, y: 1148, w: 780, h: 100 },
};

const offGridFrame = {
  beatId: "b10",
  rects: [
    { role: "chart", slot: "stage", x: 150, y: 456, w: 760, h: 424 },
  ],
};

const nanFrame = {
  beatId: "b11",
  rects: [{ role: "caption", slot: "caption", x: NaN, y: 1152, w: 760, h: 96 }],
};

// ── Stage 6 fixtures (compiler-shaped frames) ────────────────────────────────

/** A well-formed compiler-shaped Shorts frame: persistent kicker/rail/caption
 *  + non-persistent headline + the 4 px accent rule beneath it (L7's one
 *  accent). Ranges [0, dur]; headline [0, dur−6]; accent [0, dur−6]. */
const goodFull = {
  beatId: "b20",
  startFrame: 300,
  durationInFrames: 90,
  rects: [
    { role: "kicker", slot: "kicker", x: 48, y: 288, w: 160, h: 32, fontSize: 28, lines: 1, persistent: true, from: 0, to: 90 },
    { role: "rail", slot: "rail", x: 48, y: 288, w: 4, h: 960, structural: true, persistent: true, from: 0, to: 90 },
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, fontSize: 84, lines: 1, persistent: false, from: 0, to: 84 },
    { role: "accent", slot: "headline", x: 48, y: 1060, w: 800, h: 4, structural: true, persistent: false, from: 0, to: 84 },
    { role: "caption", slot: "caption", x: 88, y: 1176, w: 760, h: 72, fontSize: 64, lines: 1, persistent: true, from: 0, to: 90 },
  ],
};

/** Good chart beat — one highlight bar (the accent element, L7), bars sitting
 *  exactly on the axis (L8), equal gutters (L9), label 12 px from the
 *  gridline (L10). 4 layers (kicker/rail/caption/chart). */
const goodChart = {
  beatId: "b21",
  startFrame: 400,
  durationInFrames: 90,
  rects: [
    { role: "kicker", slot: "kicker", x: 48, y: 288, w: 160, h: 32, fontSize: 28, lines: 1, persistent: true, from: 0, to: 90 },
    { role: "rail", slot: "rail", x: 48, y: 288, w: 4, h: 960, structural: true, persistent: true, from: 0, to: 90 },
    {
      role: "chart", slot: "stage", x: 88, y: 432, w: 760, h: 464, persistent: false, from: 0, to: 90,
      chart: {
        axisY: 896, gridX: 88, barAreaTop: 432, barW: 376, gutter: 8,
        bars: [
          { label: "2019", value: 12, x: 88, w: 376, h: 80, y: 816, bottom: 896, highlight: false },
          { label: "2024", value: 47, x: 472, w: 376, h: 304, y: 592, bottom: 896, highlight: true },
        ],
        gutters: [8],
        highlightIndex: 1,
        axisLabelRight: 76,
      },
    },
    { role: "caption", slot: "caption", x: 88, y: 1176, w: 760, h: 72, fontSize: 64, lines: 1, persistent: true, from: 0, to: 90 },
  ],
};

/** L4-bad — headline and accent geometrically overlap in the same range. */
const l4Overlap = {
  beatId: "b22",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, fontSize: 84, lines: 1, persistent: false, from: 0, to: 60 },
    { role: "accent", slot: "headline", x: 48, y: 1000, w: 800, h: 8, structural: true, persistent: false, from: 0, to: 60 },
  ],
};

/** L4-good — same geometry, but the accent's range starts after the
 *  headline's ends: never on screen together. */
const l4RangeSeparated = {
  ...l4Overlap,
  beatId: "b23",
  rects: [
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, fontSize: 84, lines: 1, persistent: false, from: 0, to: 40 },
    { role: "accent", slot: "headline", x: 48, y: 1000, w: 800, h: 8, structural: true, persistent: false, from: 50, to: 60 },
  ],
};

/** L5-bad — text rects without a resolved fontSize / measured line count. */
const l5Bad = {
  beatId: "b24",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, lines: 1, persistent: false, from: 0, to: 60 },
    { role: "support", slot: "stage", x: 48, y: 432, w: 400, h: 48, fontSize: 44, persistent: false, from: 0, to: 60 },
  ],
};

/** L6-bad — headline at 46 (< 84), caption at 40 (< 64), support at 28 (< 44). */
const l6Bad = {
  beatId: "b25",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, fontSize: 46, lines: 1, persistent: false, from: 0, to: 60 },
    { role: "caption", slot: "caption", x: 88, y: 1176, w: 760, h: 72, fontSize: 40, lines: 1, persistent: true, from: 0, to: 60 },
    { role: "support", slot: "stage", x: 48, y: 432, w: 400, h: 48, fontSize: 28, lines: 1, persistent: false, from: 0, to: 60 },
  ],
};

/** L7-bad — two accent rects in one frame. */
const l7TwoAccents = {
  beatId: "b26",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, fontSize: 84, lines: 1, persistent: false, from: 0, to: 60 },
    { role: "accent", slot: "headline", x: 48, y: 1060, w: 400, h: 4, structural: true, persistent: false, from: 0, to: 60 },
    { role: "accent", slot: "headline", x: 456, y: 1060, w: 400, h: 4, structural: true, persistent: false, from: 0, to: 60 },
  ],
};

/** L7-bad — zero accents (no accent role, no chart highlight). */
const l7ZeroAccents = {
  beatId: "b27",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, fontSize: 84, lines: 1, persistent: false, from: 0, to: 60 },
  ],
};

/** L7-bad — accent rule AND a chart highlight bar: two accents (A2.3). */
const l7AccentPlusHighlight = {
  beatId: "b28",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, fontSize: 84, lines: 1, persistent: false, from: 0, to: 60 },
    { role: "accent", slot: "headline", x: 48, y: 1060, w: 400, h: 4, structural: true, persistent: false, from: 0, to: 60 },
    {
      role: "chart", slot: "stage", x: 88, y: 432, w: 760, h: 464, persistent: false, from: 0, to: 60,
      chart: { axisY: 896, gridX: 88, highlightIndex: 0, bars: [], gutters: [], axisLabelRight: 76 },
    },
  ],
};

/** L8-bad — bar floats 36 px above the axis (the documented defect). */
const l8FloatingBar = {
  beatId: "b29",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    {
      role: "chart", slot: "stage", x: 88, y: 432, w: 760, h: 464, persistent: false, from: 0, to: 60,
      chart: {
        axisY: 896, gridX: 88, bars: [{ label: "2024", value: 47, x: 88, w: 760, h: 268, y: 592, bottom: 860, highlight: true }],
        gutters: [], highlightIndex: 0, axisLabelRight: 76,
      },
    },
  ],
};

/** L9-bad — the 42/84 split (the documented defect). */
const l9UnevenGutters = {
  beatId: "b30",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    {
      role: "chart", slot: "stage", x: 88, y: 432, w: 760, h: 464, persistent: false, from: 0, to: 60,
      chart: { axisY: 896, gridX: 88, bars: [], gutters: [42, 84], highlightIndex: 0, axisLabelRight: 76 },
    },
  ],
};

/** L10-bad — axis label 20 px from the gridline (want 12). */
const l10BadLabelGap = {
  beatId: "b31",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    {
      role: "chart", slot: "stage", x: 88, y: 432, w: 760, h: 464, persistent: false, from: 0, to: 60,
      chart: { axisY: 896, gridX: 88, bars: [], gutters: [], highlightIndex: 0, axisLabelRight: 68 },
    },
  ],
};

/** L11-bad — six layers in one beat. */
const l11SixLayers = {
  beatId: "b32",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    { role: "kicker", slot: "kicker", x: 48, y: 288, w: 160, h: 32, fontSize: 28, lines: 1, persistent: true, from: 0, to: 60 },
    { role: "rail", slot: "rail", x: 48, y: 288, w: 4, h: 960, structural: true, persistent: true, from: 0, to: 60 },
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, fontSize: 84, lines: 1, persistent: false, from: 0, to: 60 },
    { role: "accent", slot: "headline", x: 48, y: 1060, w: 800, h: 4, structural: true, persistent: false, from: 0, to: 60 },
    { role: "caption", slot: "caption", x: 88, y: 1176, w: 760, h: 72, fontSize: 64, lines: 1, persistent: true, from: 0, to: 60 },
    { role: "support", slot: "stage", x: 48, y: 432, w: 400, h: 48, fontSize: 44, lines: 1, persistent: false, from: 0, to: 60 },
  ],
};

/** L11-bad — zero layers. */
const l11ZeroLayers = { beatId: "b33", startFrame: 0, durationInFrames: 60, rects: [] };

/** L12-bad — exit resolves past the beat and enter before 0. */
const l12OutOfRange = {
  beatId: "b34",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, fontSize: 84, lines: 1, persistent: false, from: 0, to: 70 },
    { role: "support", slot: "stage", x: 48, y: 432, w: 400, h: 48, fontSize: 44, lines: 1, persistent: false, from: -2, to: 60 },
  ],
};

// ── Stage 12: LAY-18 / LAY-19 fixtures (compiler-shaped frames) ──────────────

/** L18-bad — the Stage slot is packed so the painted area exceeds 253,000 px².
 *  Five chart bars each ~59,600 px² (several 56-col×~1064-row units would sum
 *  well past budget without any rect leaving its slot). */
const l18OverOccupied = {
  beatId: "b35",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    { role: "kicker", slot: "kicker", x: 48, y: 288, w: 160, h: 32, fontSize: 28, lines: 1, persistent: true, from: 0, to: 60 },
    { role: "rail", slot: "rail", x: 48, y: 288, w: 4, h: 960, structural: true, persistent: true, from: 0, to: 60 },
    {
      role: "chart", slot: "stage", x: 48, y: 392, w: 840, h: 548, persistent: false, from: 0, to: 60,
      chart: {
        axisY: 940, gridX: 48, barAreaTop: 392,
        bars: [
          { label: "a", value: 50, x: 48, w: 168, h: 540, y: 400, bottom: 940, highlight: false },
          { label: "b", value: 50, x: 216, w: 168, h: 540, y: 400, bottom: 940, highlight: false },
          { label: "c", value: 50, x: 384, w: 168, h: 540, y: 400, bottom: 940, highlight: false },
          { label: "d", value: 50, x: 552, w: 168, h: 540, y: 400, bottom: 940, highlight: true },
        ],
        gutters: [8, 8, 8],
        highlightIndex: 3,
        axisLabelRight: 36,
      },
    },
    { role: "caption", slot: "caption", x: 88, y: 1176, w: 760, h: 72, fontSize: 64, lines: 1, persistent: true, from: 0, to: 60 },
  ],
};

/** L19-bad — two content rects 10 px apart (below the 24 px floor) read as one. */
const l19TooClose = {
  beatId: "b36",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, fontSize: 84, lines: 1, persistent: false, from: 0, to: 60 },
    { role: "support", slot: "stage", x: 48, y: 432, w: 400, h: 48, fontSize: 44, lines: 1, persistent: false, from: 0, to: 60 },
    { role: "support", slot: "stage", x: 48, y: 490, w: 400, h: 48, fontSize: 44, lines: 1, persistent: false, from: 0, to: 60 },
  ],
};

/** L19-good — a headline and a chart genuinely coexist with a real ≥24 px
 *  gap: headline top y=964 vs chart bottom y=896 → 68 px vertical separation,
 *  both non-persistent content participants, same frame range. */
const l19WellSeparated = {
  beatId: "b37",
  startFrame: 0,
  durationInFrames: 60,
  rects: [
    { role: "headline", slot: "headline", x: 48, y: 964, w: 800, h: 96, fontSize: 84, lines: 1, persistent: false, from: 0, to: 60 },
    {
      role: "chart", slot: "stage", x: 88, y: 432, w: 760, h: 464, persistent: false, from: 0, to: 60,
      chart: { axisY: 896, gridX: 88, bars: [], gutters: [], highlightIndex: 0, axisLabelRight: 76 },
    },
  ],
};

// ── Stage 1: L1 — rect inside slot ──────────────────────────────────────────

console.log("L1 — rect inside slot");
check("good Shorts frame passes", lintL1([goodShorts], SLOTS_SHORTS).failures.length === 0);
check("good Longform frame passes", lintL1([goodLongform], SLOTS_LONGFORM).failures.length === 0);
const l1 = lintL1([badRectCrossesSlot], SLOTS_SHORTS);
check("crossing rect is caught", l1.failures.length === 1 && /b08 headline/.test(l1.failures[0]), failuresOf(l1));
const l1u = lintL1([badRectUnknownSlot], SLOTS_SHORTS);
check("unknown slot is caught", l1u.failures.length === 1 && /does not exist/.test(l1u.failures[0]), failuresOf(l1u));

// ── Stage 1: L2 — slot inside safe rect ─────────────────────────────────────

console.log("L2 — slot inside safe rect");
check("Shorts table passes", lintL2(SLOTS_SHORTS, SAFE_SHORTS).failures.length === 0);
check("Longform table passes", lintL2(SLOTS_LONGFORM, SAFE_LONGFORM).failures.length === 0);
const l2 = lintL2(originalDocCaptionSlots, SAFE_SHORTS);
check("documented caption {150,1148,780,100} fails (right 930 > 888)", l2.failures.length === 1 && /caption/.test(l2.failures[0]), failuresOf(l2));

// ── Stage 1: L3 — 8 px grid ─────────────────────────────────────────────────

console.log("L3 — grid multiples");
check("good Shorts frame is exactly on-grid", lintL3([goodShorts]).rounding.length === 0);
const l3 = lintL3([offGridFrame]);
check("off-grid x=150 is recorded, not failed", l3.failures.length === 0 && l3.rounding.length === 1 && l3.rounding[0].key === "x" && l3.rounding[0].displacement === 2, JSON.stringify(l3.rounding));
const l3n = lintL3([nanFrame]);
check("NaN coordinate is rejected", l3n.failures.length === 1 && /not a finite number/.test(l3n.failures[0]), failuresOf(l3n));
const l3s = lintL3([goodFull]);
check(
  "structural strokes (rail 4px, accent 4px) are grid-exempt (§3.1)",
  l3s.failures.length === 0 && !l3s.rounding.some((r) => r.role === "rail" || r.role === "accent"),
  JSON.stringify(l3s.rounding)
);

// ── Stage 1: Combined ───────────────────────────────────────────────────────

console.log("tier1 combined");
const t1 = lintTier1([goodShorts]);
check("good Shorts frame passes L1–L3", t1.pass === true, JSON.stringify(t1.results.map((r) => r.failures)));
const t1bad = lintTier1([badRectCrossesSlot]);
check("bad rect fails the combined run", t1bad.pass === false);

// ── Stage 6: L4 — no two non-persistent rects overlap in a frame range ──────

console.log("L4 — non-persistent overlap");
const l4a = lintL4([l4Overlap]);
check("geometric overlap in a shared range is caught", l4a.failures.length === 1 && /headline overlaps accent/.test(l4a.failures[0]), failuresOf(l4a));
check("range-separated rects pass", lintL4([l4RangeSeparated]).failures.length === 0);
check("good full frame passes (persistent exempt)", lintL4([goodFull]).failures.length === 0);

// ── Stage 6: L5 — text rects have a measured size and resolved fontSize ─────

console.log("L5 — measured size + resolved fontSize");
const l5 = lintL5([l5Bad]);
check("text rect without fontSize/measured size is caught", l5.failures.length === 2 && /b24 headline: no resolved fontSize/.test(l5.failures[0]) && /b24 support: no measured size/.test(l5.failures[1]), failuresOf(l5));
check("good full frame passes", lintL5([goodFull]).failures.length === 0);

// ── Stage 6: L6 — role floors ───────────────────────────────────────────────

console.log("L6 — type floors");
const l6 = lintL6([l6Bad]);
check("46px headline / 40px caption / 28px support are caught", l6.failures.length === 3 && /b25 headline: resolved to fontSize 46, below the 84 floor/.test(l6.failures[0]), failuresOf(l6));
check("floors are respected on the good frame", lintL6([goodFull]).failures.length === 0);

// ── Stage 6: L7 — exactly one accent per frame ──────────────────────────────

console.log("L7 — one accent per frame");
const l7a = lintL7([l7TwoAccents]);
check("two accent rects are caught", l7a.failures.length === 1 && /b26: 2 accent elements/.test(l7a.failures[0]), failuresOf(l7a));
const l7b = lintL7([l7ZeroAccents]);
check("zero accents are caught", l7b.failures.length === 1 && /b27: 0 accent elements/.test(l7b.failures[0]), failuresOf(l7b));
const l7c = lintL7([l7AccentPlusHighlight]);
check("accent rule + chart highlight are caught", l7c.failures.length === 1 && /b28: 2 accent elements/.test(l7c.failures[0]), failuresOf(l7c));
check("good full frame has exactly one accent", lintL7([goodFull]).failures.length === 0);
check("chart highlight bar counts as the one accent", lintL7([goodChart]).failures.length === 0);

// ── Stage 6: L8 — bar bottoms == axis y exactly ─────────────────────────────

console.log("L8 — bar bottoms on the axis");
const l8 = lintL8([l8FloatingBar]);
check("36px float off the axis is caught", l8.failures.length === 1 && /b29 chart: bar 0 bottom 860 != axis y 896 \(Δ 36px\)/.test(l8.failures[0]), failuresOf(l8));
check("good chart bars sit exactly on the axis", lintL8([goodChart]).failures.length === 0);

// ── Stage 6: L9 — chart gutters equal within 1 px ───────────────────────────

console.log("L9 — equal gutters");
const l9 = lintL9([l9UnevenGutters]);
check("the 42/84 split is caught", l9.failures.length === 1 && /b30 chart: gutters vary 42–84px/.test(l9.failures[0]), failuresOf(l9));
check("good chart gutters are equal", lintL9([goodChart]).failures.length === 0);

// ── Stage 6: L10 — axis label 12 px from the gridline ───────────────────────

console.log("L10 — axis label gap");
const l10 = lintL10([l10BadLabelGap]);
check("label 20px from the gridline is caught", l10.failures.length === 1 && /b31 chart: axis label right edge 68 is 20px from gridline start 88 \(want 12\)/.test(l10.failures[0]), failuresOf(l10));
check("good chart label is exactly 12px out", lintL10([goodChart]).failures.length === 0);

// ── Stage 6: L11 — 1–5 layers per beat ──────────────────────────────────────

console.log("L11 — layer count");
const l11a = lintL11([l11SixLayers]);
check("six layers are caught", l11a.failures.length === 1 && /b32: 6 layers/.test(l11a.failures[0]), failuresOf(l11a));
const l11b = lintL11([l11ZeroLayers]);
check("zero layers are caught", l11b.failures.length === 1 && /b33: 0 layers/.test(l11b.failures[0]), failuresOf(l11b));
check("good full frame (5 layers) passes", lintL11([goodFull]).failures.length === 0);

// ── Stage 6: L12 — atFrame resolves inside [0, durationInFrames] ────────────

console.log("L12 — atFrame range");
const l12 = lintL12([l12OutOfRange]);
check("exit past the beat and enter before 0 are caught", l12.failures.length === 2 && /b34 headline: atFrame range \[0,70\]/.test(l12.failures[0]) && /b34 support: atFrame range \[-2,60\]/.test(l12.failures[1]), failuresOf(l12));
check("good full frame ranges are inside the beat", lintL12([goodFull]).failures.length === 0);

// ── ATMOSPHERE_HORIZON_Y — world-horizon safe-rect clearance ────────────────
//
// The horizon constant is DERIVED (see slots.js): the CinematicStatement
// ridge band (a full-width dark fill whose peaks reach up to 56 px above
// the horizon, at far-plane parallax 0.14) must sit entirely below the
// safe rect's bottom once the settled DRIFT camera maps it to output.
// These fixture checks pin the horizon value under the CURRENT settling
// camera (scale 1.06, far parallax 0.14), the captionless 110 px drop in
// motion-graphics.jsx, and SAFE_SHORTS.bottom — so this bed cannot drift
// back across 1248 while those hold. If a future change touches the camera
// or caption-drop constants, update THIS derivation and the slots.js value
// in the same change; the frame-audit FRM-02 run is the backstop that
// catches drift the fixtures cannot (they hardcode the settled mapping).
//
// Constants: outY = 110 + (d − 960)·1.06 + 960 + dy + offY with
//   dy = −15.36 (camera, settled DRIFT) and offY = +13.21 (far plane,
//   parallax 0.14) → outY = 1.06·d + 50.25. The 3 px term is the audit's
//   blur() edge spread; the ground plane (k=1) settles at 1.06·d + 37.04,
//   so `horizon` itself mapping below 1248 places the whole band below it.

console.log("ATMOSPHERE_HORIZON_Y — world horizon vs safe rect");
check(
  "horizon is an exact 8 px grid multiple (§3.5)",
  ATMOSPHERE_HORIZON_Y % 8 === 0,
  String(ATMOSPHERE_HORIZON_Y)
);
const CREST_H = 56; // CinematicStatement ridge peaks: 10 + seeded·46
const crestOut = 1.06 * (ATMOSPHERE_HORIZON_Y - CREST_H) + 50.25;
check(
  "worst ridge crest maps below SAFE_SHORTS.bottom + blur spread (≥1248+3)",
  crestOut >= SAFE_SHORTS.bottom + 3,
  `crest output ${crestOut.toFixed(1)} vs 1251`
);
const horizonOut = 1.06 * ATMOSPHERE_HORIZON_Y + 37.04;
check(
  "horizon line itself maps below the safe bottom (whole band below)",
  horizonOut > SAFE_SHORTS.bottom,
  `horizon output ${horizonOut.toFixed(1)}`
);

// ── Stage 12: LAY-18 — Stage occupancy ≤ 253,000 px² ────────────────────────

console.log("LAY-18 — stage occupancy");
const l18 = lintL18([l18OverOccupied]);
check(
  "over-packed stage (4 bars × 168×540) is caught",
  l18.failures.length === 1 && /b35: stage occupied geometry 362880px²/.test(l18.failures[0]),
  failuresOf(l18)
);
const l18goodChart = lintL18([goodChart]);
check(
  "a normal chart counts its bars (144,384px²), not the blank container",
  l18goodChart.failures.length === 0 && l18goodChart.observations[0].occupiedPx2 === 144384,
  failuresOf(l18goodChart) + " obs=" + JSON.stringify(l18goodChart.observations)
);
check("good full frame (no stage content) has zero occupancy", lintL18([goodFull]).failures.length === 0);

// ── Stage 12: LAY-19 — no two rects within 24 px ────────────────────────────

console.log("LAY-19 — 24px separation");
const l19 = lintL19([l19TooClose]);
check(
  "two content objects 10px apart are caught",
  l19.failures.length === 1 && /b36 support is 10.0px from support/.test(l19.failures[0]),
  failuresOf(l19)
);
check(
  "a headline and chart genuinely separated by a 68px gap pass",
  lintL19([l19WellSeparated]).failures.length === 0,
  failuresOf(lintL19([l19WellSeparated]))
);
check(
  "goodChart (single content participant, chart only) passes with no pairs",
  lintL19([goodChart]).failures.length === 0
);
check(
  "goodFull (single content participant) has no pairs to collide",
  lintL19([goodFull]).failures.length === 0
);
check(
  "intra-chart bars (8px gutter) are one object, not a LAY-19 pair",
  lintL19([l18OverOccupied]).failures.length === 0,
  failuresOf(lintL19([l18OverOccupied]))
);

// ── Stage 6: lintAll — the complete Tier 1 gate ─────────────────────────────

console.log("lintAll L1–L12 + LAY-18/L19");
const all = lintAll([goodFull, goodChart]);
check("good frames pass all 14 checks", all.pass === true, JSON.stringify(all.results.map((r) => r.id + ":" + r.failures.length)));
const allBad = lintAll([l12OutOfRange]);
check("a bad frame fails the combined run", allBad.pass === false && allBad.results.some((r) => r.failures.length > 0));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
