/**
 * LAYOUT-SYSTEM.md Part 6 — Tier 1 spec lint. Pure Node, no browser, runs on
 * every build in milliseconds. Operates on ResolvedFrame[].
 *
 * Step 1 implements L1–L3 (the checks that need only the slot tables + a
 * resolved rect). L4–L12 land with compile.js (build order step 4).
 *
 * A frame is { beatId, rects: [{ role, slot, x, y, w, h, ... }] } — the
 * compiler's flat list of absolutely-positioned rects (Part 4). Every failure
 * names the beat, the role, and the constraint, so it is machine-actionable
 * (§6.1): "b07 headline: ... outside slot headline".
 */

import { GRID, SAFE_SHORTS, SLOTS_SHORTS, snapToGrid, slotBounds } from "./slots.js";

const within = (v, min, max) => v >= min && v <= max;

/** L1 — every rect lies inside its slot. */
export function lintL1(frames, slots) {
  const failures = [];
  for (const frame of frames) {
    for (const rect of frame.rects) {
      const slot = slots[rect.slot];
      if (!slot) {
        failures.push(`${frame.beatId} ${rect.role}: slot "${rect.slot}" does not exist in the table`);
        continue;
      }
      const ok =
        within(rect.x, slot.x, slot.x + slot.w) &&
        within(rect.x + rect.w, slot.x, slot.x + slot.w) &&
        within(rect.y, slot.y, slot.y + slot.h) &&
        within(rect.y + rect.h, slot.y, slot.y + slot.h);
      if (!ok) {
        failures.push(
          `${frame.beatId} ${rect.role}: rect (${rect.x},${rect.y}) ${rect.w}×${rect.h} is outside slot ${rect.slot} ` +
            `(${slot.x},${slot.y}) ${slot.w}×${slot.h}`
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
 */
export function lintL3(frames, grid = GRID.base) {
  const failures = [];
  const rounding = [];
  for (const frame of frames) {
    for (const rect of frame.rects) {
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

/** Run every implemented Tier 1 check. Returns { pass, results }. */
export function lintTier1(frames, opts = {}) {
  const slots = opts.slots || SLOTS_SHORTS;
  const safe = opts.safe || SAFE_SHORTS;
  const results = [lintL1(frames, slots), lintL2(slots, safe), lintL3(frames, opts.grid)];
  const pass = results.every((r) => r.failures.length === 0);
  return { pass, results };
}
