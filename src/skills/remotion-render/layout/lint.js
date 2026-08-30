/**
 * LAYOUT-SYSTEM.md Part 6 — Tier 1 spec lint. Pure Node, no browser, runs on
 * every build in milliseconds. Operates on ResolvedFrame[].
 *
 * Step 1 implemented L1–L3 (the checks that need only the slot tables + a
 * resolved rect). Stage 6 adds L4–L12 (LAYOUT-SYSTEM Part 6 table, lines
 * 594–607) and the compiler (layout/compile.js) that emits the frames.
 *
 * A frame is
 *   { beatId, startFrame, durationInFrames, rects: [{ role, slot, x, y, w, h,
 *     fontSize?, lines?, persistent?, from?, to?, structural?, chart? }] } —
 *   the compiler's flat list of absolutely-positioned rects (Part 4). Every
 *   failure names the beat, the role, and the constraint, so it is
 *   machine-actionable (§6.1): "b07 headline: … outside slot headline".
 *
 * Rects that carry no motion range (hand-written frames) only exercise the
 * geometric checks L1–L3; the range checks L4/L12 skip pairs that declare no
 * range, and L11 counts what is present. The compiler always emits the full
 * shape, so compile → lintAll is the complete gate.
 */

import {
  ACCENT_ROLE,
  ROLE_FLOORS,
  TEXT_ROLES,
  effectiveSlotFor,
  rangesOverlap,
  rectsOverlap,
} from "./compile-lint.js";
import { GRID, SAFE_SHORTS, SLOTS_SHORTS, slotBounds, snapToGrid } from "./slots.js";

const within = (v, min, max) => v >= min && v <= max;

/** L1 — every rect lies inside its slot (§3.7: the two-line caption grows
 *  upward from the slot bottom — its effective slot is re-anchored). */
export function lintL1(frames, slots) {
  const failures = [];
  for (const frame of frames) {
    for (const rect of frame.rects) {
      const slot = slots[rect.slot];
      if (!slot) {
        failures.push(`${frame.beatId} ${rect.role}: slot "${rect.slot}" does not exist in the table`);
        continue;
      }
      const b = slotBounds(effectiveSlotFor(rect, slot));
      const ok =
        within(rect.x, b.left, b.right) &&
        within(rect.x + rect.w, b.left, b.right) &&
        within(rect.y, b.top, b.bottom) &&
        within(rect.y + rect.h, b.top, b.bottom);
      if (!ok) {
        failures.push(
          `${frame.beatId} ${rect.role}: rect (${rect.x},${rect.y}) ${rect.w}×${rect.h} is outside slot ${rect.slot} ` +
            `(${b.left},${b.top})–(${b.right},${b.bottom})`
        );
      }
    }
  }
  return { id: "L1", failures };
}

/** L2 — every slot lies inside the safe rect. */
export function lintL2(slots, safe = SAFE_SHORTS) {
  const failures = [];
  for (const [name, slot] of Object.entries(slots)) {
    const b = slotBounds(slot);
    const ok =
      within(b.left, safe.left, safe.right) &&
      within(b.right, safe.left, safe.right) &&
      within(b.top, safe.top, safe.bottom) &&
      within(b.bottom, safe.top, safe.bottom);
    if (!ok) {
      failures.push(
        `slot ${name}: (${b.left},${b.top})–(${b.right},${b.bottom}) is outside the safe rect ` +
          `(${safe.left},${safe.top})–(${safe.right},${safe.bottom})`
      );
    }
  }
  return { id: "L2", failures };
}

/**
 * L3 — every x, y, w, h is a multiple of 8; the rounding displacement is
 * recorded. Because the grid period is 8, the nearest multiple is always
 * within 4 px of any real value, so the fail branch fires only for non-finite
 * numbers — the recorded `rounding` list is the real signal: a nonzero
 * displacement means a coordinate arrived off-grid (float noise, an
 * un-snapped measurement) and should be traced back to the slot or measure
 * step rather than accepted silently.
 *
 * §3.1 / TYP-18 — structural 4 px strokes (rail, accent rule) are exempt:
 * grid multiples apply to resolved rects, not to these structural constants.
 */
export function lintL3(frames, grid = GRID.base) {
  const failures = [];
  const rounding = [];
  for (const frame of frames) {
    for (const rect of frame.rects) {
      if (rect.structural === true) continue;
      for (const key of ["x", "y", "w", "h"]) {
        const v = rect[key];
        if (!Number.isFinite(v)) {
          failures.push(`${frame.beatId} ${rect.role}: ${key}=${String(v)} is not a finite number`);
          continue;
        }
        const { snapped, displacement } = snapToGrid(v, grid);
        if (displacement > grid / 2) {
          failures.push(
            `${frame.beatId} ${rect.role}: ${key}=${v} rounds to ${snapped} (moved ${displacement}px, grid ${grid}px)`
          );
        } else if (displacement > 0) {
          rounding.push({ beatId: frame.beatId, role: rect.role, key, value: v, snapped, displacement });
        }
      }
    }
  }
  return { id: "L3", failures, rounding };
}

/** Range helper for L4/L12 — a rect without explicit from/to declares no
 *  range (hand-written frames); the compiler always emits both. */
function rangeOf(rect, dur) {
  if (rect.from === undefined && rect.to === undefined) return null;
  return { from: rect.from ?? 0, to: rect.to ?? dur ?? Infinity };
}

/** L4 — no two non-persistent rects overlap in the same frame range
 *  (register LAY-06; §2.3 persistent roles are exempt). */
export function lintL4(frames) {
  const failures = [];
  for (const frame of frames) {
    const dur = frame.durationInFrames;
    const rects = (frame.rects || []).map((r) => ({ r, range: rangeOf(r, dur) }));
    for (let i = 0; i < rects.length; i++) {
      if (rects[i].r.persistent === true || rects[i].range === null) continue;
      for (let j = i + 1; j < rects.length; j++) {
        if (rects[j].r.persistent === true || rects[j].range === null) continue;
        if (!rangesOverlap(rects[i].range, rects[j].range)) continue;
        if (rectsOverlap(rects[i].r, rects[j].r)) {
          failures.push(
            `${frame.beatId} ${rects[i].r.role} overlaps ${rects[j].r.role} in frame range ` +
              `[${rects[i].range.from},${rects[i].range.to}] ∩ [${rects[j].range.from},${rects[j].range.to}]`
          );
        }
      }
    }
  }
  return { id: "L4", failures };
}

/** L5 — every text rect has a measured size (width/height + line count from
 *  the browser measure step, R3) and a resolved fontSize. */
export function lintL5(frames) {
  const failures = [];
  for (const frame of frames) {
    for (const rect of frame.rects || []) {
      if (!TEXT_ROLES.includes(rect.role)) continue;
      if (!Number.isFinite(rect.fontSize)) {
        failures.push(`${frame.beatId} ${rect.role}: no resolved fontSize (R3 — measurement must feed compile)`);
      }
      if (!Number.isInteger(rect.lines) || rect.lines < 1) {
        failures.push(`${frame.beatId} ${rect.role}: no measured size (lines=${JSON.stringify(rect.lines)})`);
      }
      if (!Number.isFinite(rect.w) || !Number.isFinite(rect.h)) {
        failures.push(`${frame.beatId} ${rect.role}: measured size incomplete (w/h not finite)`);
      }
    }
  }
  return { id: "L5", failures };
}

/** L6 — no fontSize below 84 (headline) / 64 (caption) / 44 (support).
 *  The three floors are the resolved sizes the fit may never go under;
 *  longer text is wrapped to maxLines and truncated, never shrunk below the
 *  floor (§5.2 "Never let it shrink below the Remotion floor"). */
export function lintL6(frames) {
  const failures = [];
  for (const frame of frames) {
    for (const rect of frame.rects || []) {
      const floor = ROLE_FLOORS[rect.role];
      if (floor === undefined) continue;
      if (Number.isFinite(rect.fontSize) && rect.fontSize < floor) {
        failures.push(
          `${frame.beatId} ${rect.role}: resolved to fontSize ${rect.fontSize}, below the ${floor} floor`
        );
      }
    }
  }
  return { id: "L6", failures };
}

/** L7 — exactly one accent element per frame (register COL-11; MANUAL A2.3
 *  accent budget — the highlight bar is the accent element for chart beats). */
export function lintL7(frames) {
  const failures = [];
  const accentCount = (rect) =>
    (rect.role === ACCENT_ROLE ? 1 : 0) +
    (rect.role === "chart" && rect.chart && Number.isInteger(rect.chart.highlightIndex) && rect.chart.highlightIndex >= 0 ? 1 : 0);
  for (const frame of frames) {
    const n = (frame.rects || []).reduce((s, r) => s + accentCount(r), 0);
    if (n !== 1) {
      failures.push(`${frame.beatId}: ${n} accent elements (L7 wants exactly 1 per frame)`);
    }
  }
  return { id: "L7", failures };
}

/** L8 — bar bottoms equal the axis y exactly, Δ = 0 (register LAY-07; guards
 *  the 36 px float defect — a bar must sit on the axis, R2). */
export function lintL8(frames) {
  const failures = [];
  for (const frame of frames) {
    for (const rect of frame.rects || []) {
      const chart = rect.chart;
      if (!chart || !Array.isArray(chart.bars)) continue;
      chart.bars.forEach((bar, i) => {
        if (bar.bottom !== chart.axisY) {
          const delta = chart.axisY - bar.bottom;
          failures.push(`${frame.beatId} chart: bar ${i} bottom ${bar.bottom} != axis y ${chart.axisY} (Δ ${delta}px)`);
        }
      });
    }
  }
  return { id: "L8", failures };
}

/** L9 — chart gutters equal within 1 px (register LAY-08; guards the
 *  42/84 split defect). */
export function lintL9(frames) {
  const failures = [];
  for (const frame of frames) {
    for (const rect of frame.rects || []) {
      const chart = rect.chart;
      if (!chart || !Array.isArray(chart.gutters) || chart.gutters.length < 1) continue;
      const min = Math.min(...chart.gutters);
      const max = Math.max(...chart.gutters);
      if (max - min > 1) {
        failures.push(`${frame.beatId} chart: gutters vary ${min}–${max}px (>1px allowed)`);
      }
    }
  }
  return { id: "L9", failures };
}

/** L10 — axis label right edge is 12 px from gridline start (register LAY-09;
 *  guards the axis-label mis-position defect). Exact: gap = gridX − labelRight. */
export function lintL10(frames) {
  const failures = [];
  for (const frame of frames) {
    for (const rect of frame.rects || []) {
      const chart = rect.chart;
      if (!chart || chart.axisLabelRight === undefined || chart.gridX === undefined) continue;
      const gap = chart.gridX - chart.axisLabelRight;
      if (gap !== 12) {
        failures.push(
          `${frame.beatId} chart: axis label right edge ${chart.axisLabelRight} is ${gap}px from gridline start ${chart.gridX} (want 12)`
        );
      }
    }
  }
  return { id: "L10", failures };
}

/** L11 — every beat has ≥1 layer and ≤5 layers (register LAY-16). */
export function lintL11(frames) {
  const failures = [];
  for (const frame of frames) {
    const n = (frame.rects || []).length;
    if (n < 1) failures.push(`${frame.beatId}: 0 layers (L11 wants ≥1)`);
    if (n > 5) failures.push(`${frame.beatId}: ${n} layers (L11 wants ≤5)`);
  }
  return { id: "L11", failures };
}

/** L12 — no layer's atFrame resolves outside [0, durationInFrames] (register
 *  LAY-17). The compiler resolves "anchor±n"/"end−n" and throws; this check
 *  re-verifies the resolved ranges on any ResolvedFrame[]. */
export function lintL12(frames) {
  const failures = [];
  for (const frame of frames) {
    const dur = frame.durationInFrames;
    if (!Number.isFinite(dur)) continue;
    for (const rect of frame.rects || []) {
      const r = rangeOf(rect, dur);
      if (r === null) continue;
      if (r.from < 0 || r.to < 0 || r.from > dur || r.to > dur) {
        failures.push(
          `${frame.beatId} ${rect.role}: atFrame range [${r.from},${r.to}] resolves outside [0,${dur}]`
        );
      }
    }
  }
  return { id: "L12", failures };
}

/** LAY-18 (register, MINOR, tier 1, stage 12) — Stage occupancy ≤ 253,000 px².
 *  DETAIL-REF B4.1: "At least 45% of the Stage slot must be ground at every
 *  frame. 840 × 548 = 460,320 px²; occupied geometry may not exceed 253,000
 *  px²." B4.2: the rule that varies is Stage density, not the always-occupied
 *  kicker/headline/caption slots — so only stage-slot content counts.
 *
 *  Occupied geometry = the summed painted area of non-structural stage-slot
 *  rects, clipped to the Stage slot bounds: for a `chart` with `chart.bars[]`
 *  the sum of each bar's w×h (the painted figure — a chart's white plot
 *  padding is ground, not occupied, so the container box is never counted;
 *  a container would be 352,640 px² yet visually ~40% occupied), otherwise
 *  the rect's w×h. Persistent chrome (kicker/caption/rail) and the fixed
 *  skeleton (rail/accent) are never stage content and are excluded.
 *
 *  Threshold reconciliation: 55% of 460,320 = 253,176, but B4.1 pins the
 *  operational bound at 253,000 and CHECK-REGISTER keys the check on
 *  "≤253,000" — the strict constant 253,000 is implemented. */
export function lintL18(frames, opts = {}) {
  const failures = [];
  const limit = opts.stageOccupancyLimit ?? 253000;
  const slots = opts.slots || SLOTS_SHORTS;
  const stage = slots.stage;
  if (!stage) return { id: "L18", failures, observations: [] };
  const sb = slotBounds(stage);
  const observations = [];
  for (const frame of frames) {
    let occupied = 0;
    for (const rect of frame.rects || []) {
      if (rect.slot !== "stage") continue;
      if (rect.structural === true) continue;
      // The painted area of the rect that falls inside the Stage slot. A chart
      // is measured by its bars (the figure); anything else by its box.
      const boxes =
        rect.role === "chart" && Array.isArray(rect.chart && rect.chart.bars) && rect.chart.bars.length
          ? rect.chart.bars.map((b) => ({ x: b.x ?? rect.x, y: b.y ?? rect.y, w: b.w, h: b.h }))
          : [{ x: rect.x, y: rect.y, w: rect.w, h: rect.h }];
      for (const box of boxes) {
        const clipW = Math.max(0, Math.min(box.x + box.w, sb.right) - Math.max(box.x, sb.left));
        const clipH = Math.max(0, Math.min(box.y + box.h, sb.bottom) - Math.max(box.y, sb.top));
        occupied += clipW * clipH;
      }
    }
    observations.push({ beatId: frame.beatId, occupiedPx2: occupied, limit });
    if (occupied > limit) {
      const pct = (occupied / (stage.w * stage.h)) * 100;
      failures.push(
        `${frame.beatId}: stage occupied geometry ${occupied}px² (${pct.toFixed(1)}% of the ${stage.w}×${stage.h} slot) exceeds the ${limit}px² (≤55%) budget`
      );
    }
  }
  return { id: "L18", failures, observations };
}

/** LAY-19 (register, MINOR, tier 1, stage 12) — no two rects within 24 px.
 *  DETAIL-REF B4.3: "No element may sit closer than 24 px to another element's
 *  bounding box. Below 24 px, two elements read as one object with a seam."
 *
 *  SCOPE — participants are the emitted content rects: everything that is
 *  neither `persistent` (kicker/caption/rail) nor `structural` (rail/accent),
 *  i.e. headline/chart/support and any non-persistent non-structural object.
 *  The fixed skeleton is held apart by the slot system and MUST NOT be a
 *  participant (the rail stroke overlaps every content box by design; caption
 *  and kicker are intended close to their slots). Bars *within one chart* are
 *  also excluded: a chart's bars share an intentional GRID.gutter (8 px) so
 *  they group as ONE object (Gestalt proximity), and checking them would flag
 *  every chart. "rect" here = one emitted content object.
 *
 *  Distance = the closest approach between two axis-aligned bounding boxes:
 *  sqrt(max(0,hGap)² + max(0,vGap)²), 0 when they overlap. A pair visible in an
 *  overlapping (or undeclared) range closer than 24 px is a failure. */
export function lintL19(frames, opts = {}) {
  const failures = [];
  const minSep = opts.minSeparation ?? 24;
  for (const frame of frames) {
    const dur = frame.durationInFrames;
    const parts = (frame.rects || [])
      .filter((r) => r.persistent !== true && r.structural !== true)
      .map((r) => ({
        r,
        range: r.from === undefined && r.to === undefined ? null : { from: r.from ?? 0, to: r.to ?? dur ?? Infinity },
      }));
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i];
        const b = parts[j];
        if (a.range && b.range && !rangesOverlap(a.range, b.range)) continue;
        const hGap = Math.max(a.r.x, b.r.x) - Math.min(a.r.x + a.r.w, b.r.x + b.r.w);
        const vGap = Math.max(a.r.y, b.r.y) - Math.min(a.r.y + a.r.h, b.r.y + b.r.h);
        const dist = Math.hypot(Math.max(0, hGap), Math.max(0, vGap));
        if (dist < minSep) {
          failures.push(
            `${frame.beatId} ${a.r.role} is ${dist.toFixed(1)}px from ${b.r.role} (want ≥ ${minSep}px; below that two elements read as one object with a seam)`
          );
        }
      }
    }
  }
  return { id: "L19", failures };
}

/** Stage 5 combined — the tier-1 checks that predate Stage 6 (L1–L3). */
export function lintTier1(frames, opts = {}) {
  const slots = opts.slots || SLOTS_SHORTS;
  const safe = opts.safe || SAFE_SHORTS;
  const results = [lintL1(frames, slots), lintL2(slots, safe), lintL3(frames, opts.grid)];
  const pass = results.every((r) => r.failures.length === 0);
  return { pass, results };
}

/** Stage 6 — run every Tier 1 check L1–L12. Returns { pass, results }. */
export function lintAll(frames, opts = {}) {
  const slots = opts.slots || SLOTS_SHORTS;
  const safe = opts.safe || SAFE_SHORTS;
  const results = [
    lintL1(frames, slots),
    lintL2(slots, safe),
    lintL3(frames, opts.grid),
    lintL4(frames),
    lintL5(frames),
    lintL6(frames),
    lintL7(frames),
    lintL8(frames),
    lintL9(frames),
    lintL10(frames),
    lintL11(frames),
    lintL12(frames),
    lintL18(frames, opts),
    lintL19(frames, opts),
  ];
  const pass = results.every((r) => r.failures.length === 0);
  return { pass, results };
}
