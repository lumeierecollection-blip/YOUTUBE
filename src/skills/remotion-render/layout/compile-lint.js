/**
 * layout/compile-lint.js — the geometry + assertion helpers shared by
 * compile.js (LAYOUT-SYSTEM.md Part 4, rules R1–R4) and lint.js (Part 6,
 * checks L1–L12). Pure Node: no React, no Remotion, no browser — importable
 * in the bundle, in verify-compositions.js, and in stage6/build-shots.js.
 *
 * Every number here is either a constant named after its spec section
 * (LINE_HEIGHT ← §3.7, ROLE_FLOORS ← Part 6 L6) or derived arithmetic on
 * slot-table values (slots.js). There are no magic layout numbers.
 */

import { GRID, anchorPoint, snapToGrid } from "./slots.js";

/** §3.7 — line height. The caption maths "2 × 64 × 1.12 ≈ 143" → snapped 144,
 *  and round8(84 × 1.12) = 96 matches the resolved headline fixture. One
 *  constant so the text-block height and the slot-content rule can never drift. */
export const LINE_HEIGHT = 1.12;

/** Part 6 L6 — the three role-named type floors (MANUAL A3.2 / beats.js TYPE). */
export const ROLE_FLOORS = { headline: 84, caption: 64, support: 44 };

/** Roles whose rect is a measured text block (§5.2 — the text box contract). */
export const TEXT_ROLES = ["kicker", "headline", "caption", "support"];

/** The one accent role — L7 / MANUAL A2.3 accent budget. */
export const ACCENT_ROLE = "accent";

/** §2.3 — the persistent roles, exempt from L4 (they may share frame ranges). */
export const PERSISTENT_ROLES = ["kicker", "caption", "rail"];

/** §3.1 / TYP-18 — structural 4 px stroke constants, exempt from the 8 px grid
 *  (grid multiples apply to resolved rects, not to these structural strokes).
 *  The rail (full-slot stroke) and the accent rule (4 px TYP-18 underline)
 *  are the two structural rects the compiler emits; the lint consults the
 *  rect's `structural` flag (set by compile from this constant), so the
 *  exemption can never drift between compile and lint. */
export const STRUCTURAL_ROLES = ["rail", "accent"];

/** §3.7 / §5.3 — the headline slot publishes its occupied height = slot.h − 48
 *  (the 48 px two-line-caption growth allowance). Shorts: 176 − 48 = 128;
 *  Longform: 144 − 48 = 96 (the documented longform content box 780–876). */
export function headlineContentBox(slot) {
  return slot.h - 48;
}

/** §3.7 — effective bounds a rect is checked against. The one exception to
 *  "every rect lies inside its slot" is the two-line caption, which grows
 *  upward from the slot bottom into the headline's lower 48 px: for a caption
 *  taller than its slot, the effective slot is re-anchored to the bottom. */
export function effectiveSlotFor(rect, slot) {
  if (rect.role === "caption" && rect.h > slot.h) {
    return { ...slot, y: slot.y + slot.h - rect.h, h: rect.h };
  }
  return slot;
}

/** §3.3 — resolve a w×h rect inside a slot for one of the nine anchors.
 *  R2: anything that grows resolves its bottom edge from the slot bottom. */
export function anchoredRect(slot, anchor, w, h) {
  const p = anchorPoint(slot, anchor);
  switch (anchor) {
    case "top-left":
      return { x: p.x, y: p.y };
    case "top":
      return { x: p.x - w / 2, y: p.y };
    case "top-right":
      return { x: p.x - w, y: p.y };
    case "left":
      return { x: p.x, y: p.y - h / 2 };
    case "center":
      return { x: p.x - w / 2, y: p.y - h / 2 };
    case "right":
      return { x: p.x - w, y: p.y - h / 2 };
    case "bottom-left":
      return { x: p.x, y: p.y - h };
    case "bottom":
      return { x: p.x - w / 2, y: p.y - h };
    case "bottom-right":
      return { x: p.x - w, y: p.y - h };
    default:
      throw new Error(`unknown anchor: ${anchor}`);
  }
}

/** §3.5 — a text block's resolved height: lines × fontSize × LINE_HEIGHT,
 *  snapped to the 8 px grid. round8(64 × 1.12) = 72, round8(84 × 1.12) = 96,
 *  round8(2 × 64 × 1.12) = 144 — the §3.7 numbers. */
export function textBlockHeight(fontSize, lines) {
  return snapToGrid(lines * fontSize * LINE_HEIGHT, GRID.base).snapped;
}

/** §2.1 — the exact string a text layer renders, so the browser measure step
 *  (layout/measure.js consumers) and compile() agree on what gets measured.
 *  Kicker content { index, label } renders as "02 THE DEEP DIVE"-style
 *  "NN label" (§A3.2 — kicker is all-caps, tracked; case is a render concern,
 *  the measured string is the data string). */
export function renderedTextForContent(content) {
  if (!content || typeof content !== "object") return "";
  if (typeof content.text === "string") return content.text;
  if (content.label !== undefined) {
    const idx =
      content.index !== undefined
        ? String(content.index).padStart(2, "0")
        : "";
    return idx ? `${idx} ${content.label}` : String(content.label);
  }
  return "";
}

/** R3 — the canonical measured-metrics key. The browser measure step emits
 *  `{ [measuredKey(text, fontSize, fontFamily)]: { width, lines } }` and
 *  compile() looks the layer's rendered text up under the same key, so a text
 *  measured once serves every layer that renders the same string. */
export function measuredKey(text, fontSize, fontFamily) {
  return `${text}|${fontSize}|${fontFamily}`;
}

/** §2.1.3 — resolve an atFrame ("anchor±n", "end−n", or an integer) against
 *  the beat. Returns { frame } on success or { error } on an unparseable or
 *  out-of-range value; the caller (compile R4) throws on error, and lintL12
 *  re-verifies the resolved ranges on arbitrary ResolvedFrame[]. */
export function resolveAtFrame(atFrame, { anchorFrame = 0, durationInFrames }) {
  if (Number.isInteger(atFrame)) return { frame: atFrame };
  if (typeof atFrame === "string") {
    const m = atFrame.match(/^anchor([+-])(\d+)$/);
    if (m) return { frame: anchorFrame + (m[1] === "+" ? +m[2] : -m[2]) };
    const e = atFrame.match(/^end-(\d+)$/);
    if (e) return { frame: durationInFrames - +e[1] };
  }
  return { error: `unparseable atFrame ${JSON.stringify(atFrame)}` };
}

/** Rect-vs-rect geometric overlap. Touching edges do not overlap. */
export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    b.x < a.x + a.w &&
    a.y < b.y + b.h &&
    b.y < a.y + a.h
  );
}

/** Frame-range overlap, inclusive endpoints ([from, to] both count as
 *  on-screen frames — an element is still visible during its exit window). */
export function rangesOverlap(a, b) {
  return a.from <= b.to && b.from <= a.to;
}
