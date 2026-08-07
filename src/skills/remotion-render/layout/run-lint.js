/**
 * LAYOUT-SYSTEM.md §8.4 step 1 verification — "L1–L3 pass on hand-written
 * fixtures". Pure Node. Exits non-zero if any expectation is violated.
 *
 * Covers:
 *   - L1/L2/L3 pass on hand-written Shorts and Longform frames
 *   - L1 catches a rect crossing its slot
 *   - L2 catches an out-of-safe slot (including the original documented
 *     caption values {150,1148,780,100}, whose right edge 930 exceeds the
 *     safe right 888 — the bug that motivated the correction)
 *   - L3 records off-grid roundings and rejects non-finite coordinates
 */

import { SAFE_LONGFORM, SAFE_SHORTS, SLOTS_LONGFORM, SLOTS_SHORTS } from "./slots.js";
import { lintL1, lintL2, lintL3, lintTier1 } from "./lint.js";

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

// ── Fixtures ────────────────────────────────────────────────────────────────

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

// ── L1: rect inside slot ────────────────────────────────────────────────────

console.log("L1 — rect inside slot");
check("good Shorts frame passes", lintL1([goodShorts], SLOTS_SHORTS).failures.length === 0);
check("good Longform frame passes", lintL1([goodLongform], SLOTS_LONGFORM).failures.length === 0);
const l1 = lintL1([badRectCrossesSlot], SLOTS_SHORTS);
check("crossing rect is caught", l1.failures.length === 1 && /b08 headline/.test(l1.failures[0]), failuresOf(l1));
const l1u = lintL1([badRectUnknownSlot], SLOTS_SHORTS);
check("unknown slot is caught", l1u.failures.length === 1 && /does not exist/.test(l1u.failures[0]), failuresOf(l1u));

// ── L2: slot inside safe rect ───────────────────────────────────────────────

console.log("L2 — slot inside safe rect");
check("Shorts table passes", lintL2(SLOTS_SHORTS, SAFE_SHORTS).failures.length === 0);
check("Longform table passes", lintL2(SLOTS_LONGFORM, SAFE_LONGFORM).failures.length === 0);
const l2 = lintL2(originalDocCaptionSlots, SAFE_SHORTS);
check("documented caption {150,1148,780,100} fails (right 930 > 888)", l2.failures.length === 1 && /caption/.test(l2.failures[0]), failuresOf(l2));

// ── L3: 8 px grid ───────────────────────────────────────────────────────────

console.log("L3 — grid multiples");
check("good Shorts frame is exactly on-grid", lintL3([goodShorts]).rounding.length === 0);
const l3 = lintL3([offGridFrame]);
check("off-grid x=150 is recorded, not failed", l3.failures.length === 0 && l3.rounding.length === 1 && l3.rounding[0].key === "x" && l3.rounding[0].displacement === 2, JSON.stringify(l3.rounding));
const l3n = lintL3([nanFrame]);
check("NaN coordinate is rejected", l3n.failures.length === 1 && /not a finite number/.test(l3n.failures[0]), failuresOf(l3n));

// ── Combined ────────────────────────────────────────────────────────────────

console.log("tier1 combined");
const t1 = lintTier1([goodShorts]);
check("good Shorts frame passes L1–L3", t1.pass === true, JSON.stringify(t1.results.map((r) => r.failures)));
const t1bad = lintTier1([badRectCrossesSlot]);
check("bad rect fails the combined run", t1bad.pass === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
