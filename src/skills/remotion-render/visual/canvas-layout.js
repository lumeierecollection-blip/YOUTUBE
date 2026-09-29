/**
 * Full-canvas layout, pure JS (no JSX). full-canvas.jsx draws from these
 * numbers and render.js records them in the render manifest, so the audit
 * (local-audit.cjs canvas-fit / canvas-coverage / canvas-type) checks the
 * renderer's own element boxes.
 *
 * There is no container. Every beat is composed for the whole 1080x1920
 * frame. Since the typography rebuild (2026-09-29) it is composed on a 3x4
 * GRID, asymmetrically — nothing is centred:
 *
 *   columns  [48-380] [400-680] [700-1032]        (the brief's 40-1040, inset
 *   rows     [180-560] [600-980] [1020-1400]       to the 48 px safe area)
 *            [1440-1800] = the caption row: the word caption (required on
 *            every beat) sits in it, so content lives in rows 0-2
 *
 * Placement rules (canvasLayout enforces them; scripts/test-canvas-layout.mjs
 * checks them):
 *   - a text box is anchored to a column EDGE (left edge of a column, or the
 *     right edge of one when right-aligned) and to a row edge (top or bottom),
 *     except a label, which attaches to the data it labels;
 *   - headlines are left- or right-aligned, never centred; which side is
 *     decided by canvas.variant (the resolver alternates it beat by beat);
 *   - a number is anchored on one side and overflows across the columns
 *     towards the other; it is never cropped by the frame edge (a cropped
 *     digit misstates the figure — CLAUDE.md hard rule — so the brief's
 *     "may be cropped" is not used);
 *   - a beat with three elements fills three cells and leaves the rest empty.
 *
 * Deviation from the brief, on purpose: its cells are 280-340 px wide, and a
 * 160 px Fraunces word is wider than that, so a headline is anchored to its
 * cell's edge and runs across as many columns as its text needs (typography.js
 * fitHeadline). "1-2 cells" is read as 1-2 grid ROWS deep.
 *
 * Compositions (the planner never picks the same one twice in a row —
 * composition-rotation.js — so the vocabulary has to be wide enough to
 * alternate even when sentences ground nothing but text):
 *   TYPE-FULL         a statement, bottom-anchored, on one side
 *   TYPE-SPLIT        the statement split in two: first half top, second half
 *                     bottom, on opposite sides
 *   NUMBER-FULL       one hero number, its label above, the headline opposite
 *   DATA-FULL         the chart is the composition (bar / donut / line / gauge)
 *   SCENE-FULL        a real photo edge to edge (objectFit cover), type over it;
 *                     or an isolated object, large
 *   ARCHITECTURE      a real photo of a building (an institution or address),
 *                     full-bleed, tilting up the facade
 *   DOCUMENT          a real scan of a named legal instrument, full-bleed, the
 *                     headline as a highlighted callout
 *   MONEY             a real photo of currency / coins / a receipt, full-bleed,
 *                     the sentence's figure over it
 *   MAP-CENTERED      the map fills the frame, zoomed on the region, labelled
 *                     at the region
 *   PROCESS-FULL      2-3 nodes across the frame, thick arrows
 *   TIMELINE          2-4 dated events on a vertical line spanning the frame
 *   COMPARISON-SPLIT  the frame cut on a diagonal: value A / value B
 *   LIST-BUILD        an enumeration, one item at a time as it is spoken
 *
 * NUMBER-FULL and TYPE-SPLIT are additions to the brief's list: a hero number
 * is a different composition from a statement, and a split statement is a
 * different one from a stacked statement — without them two text-only
 * sentences in a row could not both satisfy the no-repeat rule.
 *
 * Where this stops: widths come from the fonts' measured advance tables
 * (type-metrics.js), kerning ignored, +3% margin — text is measured, not
 * rendered; the audit checks boxes against the frame, and canvas-coverage
 * checks the rendered pixels.
 */
import {
  ROLE_HEADLINE, ROLE_NUMBER, ROLE_DATA, ROLE_EMPHASIS, SERIF, SANS_STACK, HEADLINE_FLOOR,
  fitHeadline, fitNumber, numberParts, numberSlots, measure, fitEmphasis, capHeightEm,
} from "./typography.js";

export const FRAME = { w: 1080, h: 1920 };
export const SAFE = { x: 48, y: 48, w: 1080 - 96, h: 1920 - 96 };
export const GRID = Object.freeze({
  cols: Object.freeze([[48, 380], [400, 680], [700, 1032]]),
  rows: Object.freeze([[180, 560], [600, 980], [1020, 1400], [1440, 1800]]),
});
export const L_EDGE = 48;
export const R_EDGE = 1032;
export const TOP = 180;          // row 0 top
export const BOTTOM = 1400;      // row 2 bottom
export const COMP = { x: 48, y: 100, w: 984, h: 1320 };
// The word caption (required on every beat) fills the grid's caption row. Its
// box stays clear of the Shorts UI (right-hand buttons from x ~960): 48..928
// left-aligned, or 64..944 right-aligned (CAPTION_R).
export const CAPTION = { x: 48, y: 1450, w: 880, h: 160 };
export const CAPTION_R = { x: 64, y: 1450, w: 880, h: 160 };
export const COMPOSITIONS = ["TYPE-FULL", "TYPE-SPLIT", "NUMBER-FULL", "DATA-FULL", "SCENE-FULL", "ARCHITECTURE", "DOCUMENT", "MONEY", "MAP-CENTERED", "PROCESS-FULL", "TIMELINE", "COMPARISON-SPLIT", "LIST-BUILD"];
export const TRANSITION_SEC = 0.5;
export const CONTENT_TOP = 180;

export const INK = "#0B0B0C";
export const INK_SOFT = "#8E8E93";
export const MID = "#A7A7AD";
export const LIGHT = "#DADADF";
// Off-white studio ground: luma ~244, so with soft-light grain (mean-
// neutral) the white-ground verify (> 240 in the top-left corner) holds.
export const STUDIO = "#F6F4F0";
export const DARK_BG = "#0E0E0E";
export const INK_ON_DARK = "#F2F0EB";
export const SANS = "Inter";
export { SERIF };

const DATA_TYPES = ["BAR", "PIE", "LINE", "GAUGE"];

/**
 * The composition a checked visual type is drawn as. `hasPhoto`: the image the
 * type needs (photo, cutout, scan) was resolved — an unresolved one is drawn
 * as typography, never as a stand-in. `extra.view === "building"`: a PHOTO
 * whose real photo shows a building is ARCHITECTURE; `extra.split`: a TYPE
 * beat drawn as TYPE-SPLIT.
 */
export function compositionFor(visualType, hasPhoto, extra = {}) {
  const t = String(visualType || "TYPE").toUpperCase();
  if (t === "PHOTO") return hasPhoto ? (extra.view === "building" ? "ARCHITECTURE" : "SCENE-FULL") : "TYPE-FULL";
  if (t === "CUTOUT") return hasPhoto ? "SCENE-FULL" : "TYPE-FULL";
  if (t === "DOCUMENT") return hasPhoto ? "DOCUMENT" : "TYPE-FULL";
  if (t === "MONEY") return hasPhoto ? "MONEY" : "TYPE-FULL";
  if (t === "PROCESS") return "PROCESS-FULL";
  if (t === "MAP") return "MAP-CENTERED";
  if (t === "LIST") return "LIST-BUILD";
  if (t === "TIMELINE") return "TIMELINE";
  if (t === "COMPARE") return "COMPARISON-SPLIT";
  if (DATA_TYPES.includes(t)) return "DATA-FULL";
  if (t === "COUNTER") return "NUMBER-FULL";
  return extra.split ? "TYPE-SPLIT" : "TYPE-FULL";
}

// ── text measuring (Inter, measured advances) ─────────────────────────
/** Estimated width of `text` at `size` px in Inter (weight 700), +3% margin. */
export function textWidth(text, size, upper = false, weight = 700) {
  return measure(upper ? String(text || "").toUpperCase() : text, size, { family: "Inter", weight });
}
/** Greedy wrap of words into lines no wider than `width` at `size`. */
export function wrap(words, size, width, upper = false, weight = 700) {
  const lines = [];
  let cur = [];
  for (const w of words) {
    const next = [...cur, w].join(" ");
    if (cur.length && textWidth(next, size, upper, weight) > width) { lines.push(cur.join(" ")); cur = [w]; } else cur.push(w);
  }
  if (cur.length) lines.push(cur.join(" "));
  return lines;
}
/** Largest size (step 2) in [min, max] at which `text` wraps into <= maxLines lines of `width` (Inter). */
export function fitText(text, width, { max = 200, min = 24, maxLines = 3, maxHeight = Infinity, lineH = 1.1, upper = false, weight = 700 } = {}) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  for (let s = max; s >= min; s -= 2) {
    if (words.some((w) => textWidth(w, s, upper, weight) > width)) continue;
    const lines = wrap(words, s, width, upper, weight);
    if (lines.length <= maxLines && lines.length * s * lineH <= maxHeight) return { size: s, lines };
  }
  return { size: min, lines: wrap(words, min, width, upper, weight) };
}

export const box = (x, y, w, h) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
const clampW = (w) => Math.min(w, R_EDGE - L_EDGE);
/** Left edge for a box of width `w` anchored on the left (flip 0) or right (flip 1). */
const anchorX = (w, flip) => Math.round(flip ? R_EDGE - w : L_EDGE);

/**
 * The canvas content as this beat is drawn: the beat's position stamps the
 * variant (left / right anchoring alternates beat by beat) and the index the
 * headline motion rotates on. Renderer, manifest and audit all go through
 * this, so they see the same layout.
 */
export function normalizeCanvas(c, idx = 0) {
  return { ...c, beat_index: Number.isInteger(c?.beat_index) ? c.beat_index : idx, variant: Number.isInteger(c?.variant) ? c.variant : idx };
}

// The cells a box touches: "c<col>r<row>" for every cell it overlaps by
// more than 12% of the smaller side (so a line's overhang is not a cell).
export function cellsOf(b) {
  const out = [];
  GRID.cols.forEach(([x0, x1], ci) => GRID.rows.forEach(([y0, y1], ri) => {
    const ox = Math.min(b.x + b.w, x1) - Math.max(b.x, x0), oy = Math.min(b.y + b.h, y1) - Math.max(b.y, y0);
    if (ox > 0.12 * Math.min(b.w, x1 - x0) && oy > 0.12 * Math.min(b.h, y1 - y0)) out.push(`c${ci}r${ri}`);
  }));
  return out;
}

// Split a quantity string for the big-number layout: "$105M" / "1.4 billion" / "50%".
export function splitNumber(value) {
  const s = String(value || "").trim();
  const m = s.match(/^(.*?)(\d[\d,]*(?:\.\d+)?\s*(?:%|[kKmMbB]\b)?)(?:\s*(thousand|million|billion|trillion))?(.*)$/);
  if (!m) return { big: s, scale: "", rest: "" };
  return { big: `${m[1]}${m[2]}`.trim(), scale: (m[3] || "").trim(), rest: (m[4] || "").trim() };
}

// ── boxes for the four kinds of text ──────────────────────────────────
/** A ROLE_DATA label: uppercase Inter, `size` px, wrapped into `maxLines` lines of `width`. */
function dataBox(text, { width = 560, size = 40, maxLines = 2, x, y, flip = 0, bottom = null, weight = 600 } = {}) {
  const t = String(text || "").toUpperCase();
  const f = fitText(t, width, { max: size, min: ROLE_DATA.sizeBand[0], maxLines, lineH: ROLE_DATA.lineHeight, weight });
  const w = Math.min(width, Math.max(...f.lines.map((l) => textWidth(l, f.size, false, weight)))) + 2;
  const h = f.lines.length * f.size * ROLE_DATA.lineHeight;
  const bx = x ?? anchorX(w, flip);
  return { ...box(bx, bottom != null ? bottom - h : y, w, h), size: f.size, lines: f.lines, align: flip ? "right" : "left", role: "data", upper: true, weight };
}
/** A ROLE_HEADLINE block, left- or right-anchored; top at `y`, or bottom at `bottom`. */
function headlineBox(text, { width = 984, y, bottom = null, flip = 0, maxLines = 4, maxHeight = Infinity, max = ROLE_HEADLINE.sizeBand[1] } = {}) {
  const f = fitHeadline(text, width, { maxLines, maxHeight, max });
  if (!f.lines.length) return { ...box(anchorX(0, flip), bottom != null ? bottom : y, 0, 0), size: f.size, lines: [], align: flip ? "right" : "left", role: "headline", inBand: false };
  const w = Math.min(width, Math.max(...f.lines.map((l) => measure(l, f.size, { family: ROLE_HEADLINE.family, weight: ROLE_HEADLINE.weight, tracking: ROLE_HEADLINE.tracking })))) + 4;
  const h = f.lines.length * f.size * ROLE_HEADLINE.lineHeight;
  return { ...box(anchorX(w, flip), bottom != null ? bottom - h : y, w, h), size: f.size, lines: f.lines, align: flip ? "right" : "left", role: "headline", inBand: f.inBand };
}
const rule = (flip, y = TOP, w = 96) => ({ ...box(anchorX(w, flip), y, w, 6), role: "rule", anchor: flip ? "right" : "left" });

/** Kicker (lead-in) + headline at the top of a data / process / object beat. */
function dataHeader(c, flip, { maxSize = 128, maxHeight = 250 } = {}) {
  const out = {};
  let y = TOP;
  if (c.lead_in) {
    out.kicker = dataBox(c.lead_in, { width: 640, size: 34, maxLines: 1, y, flip });
    y += out.kicker.h + 16;
  }
  if (c.headline) {
    out.headline = headlineBox(c.headline, { width: 900, y, flip, maxLines: 2, maxHeight, max: maxSize });
    y += out.headline.h;
  }
  out.bottom = y;
  return out;
}

const pad2 = (n) => String(n).padStart(2, "0");
/** Section folio ("03 / 08"): page furniture, not a claim — the second type role on a beat that has no lead-in. */
export const folioOf = (c) => (Number.isInteger(c?.beat_total) && c.beat_total > 0 ? `${pad2((c.beat_index ?? 0) + 1)} / ${pad2(c.beat_total)}` : null);

/** Split a headline into two halves at the most natural break near its middle (>= 2 words), or null. */
export function splitHeadline(text) {
  const ws = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (ws.length < 2) return null;
  const total = ws.join(" ").length;
  let best = 1, bestScore = Infinity, acc = 0;
  for (let k = 1; k < ws.length; k++) {
    acc += ws[k - 1].length + 1;
    let score = Math.abs(acc - (total - acc));
    if (/[,;:\u2014-]$/.test(ws[k - 1])) score -= 6;                       // break after punctuation
    if (/^(?:and|or|but|of|to|in|for|with|that|which|as|by|from|on)$/i.test(ws[k])) score -= 4;  // break before a connector
    if (score < bestScore) { bestScore = score; best = k; }
  }
  return [ws.slice(0, best).join(" "), ws.slice(best).join(" ")];
}

/**
 * Every element box for one beat's canvas content `c`, in design px.
 * Returns { composition, boxes: {name: {x,y,w,h,...}}, hero } — hero is the
 * element a camera push or a match cut targets.
 */
export function canvasLayout(c) {
  const comp = c?.composition || compositionFor(c?.visual_type, !!(c?.photo || c?.cutout));
  const vt = String(c?.visual_type || "TYPE").toUpperCase();
  const flip = (Number(c?.variant) || 0) % 2 === 1 ? 1 : 0;
  const boxes = {};
  let hero = null;

  if (comp === "TYPE-FULL" || comp === "NUMBER-FULL" || comp === "TYPE-SPLIT") {
    const folio = c?.lead_in ? null : folioOf(c);
    const split = comp === "TYPE-SPLIT" ? splitHeadline(c?.headline) : null;
    if (split) {
      // The statement in two: the first half top, the second bottom, on opposite sides.
      const opp = flip ? 0 : 1;
      boxes.headline = headlineBox(split[0], { width: 640, y: TOP, flip, maxLines: 3, maxHeight: 380, max: 200 });
      boxes.statement = headlineBox(split[1], { width: 760, bottom: BOTTOM, flip: opp, maxLines: 3, maxHeight: 420, max: 200 });
      const kk = c?.lead_in || folio;
      if (kk) boxes.kicker = dataBox(kk, { width: 300, size: 34, maxLines: 1, y: TOP + 10, flip: opp });
      hero = "statement";
    } else if (vt === "COUNTER" && c?.data?.value) {
      const parts = numberParts(c.data.value);
      const { size } = fitNumber(parts, R_EDGE - L_EDGE);
      const slots = numberSlots(parts, size);
      const nw = Math.min(R_EDGE - L_EDGE, Math.ceil(slots.width));
      const nh = Math.round(size * ROLE_NUMBER.lineHeight);
      // The scale word once ("$127 million" + label "million Ponzi scheme").
      const lab = String(c.data.label || "").trim();
      const label = parts.scaleWord && lab.toLowerCase().startsWith(parts.scaleWord) ? lab : [parts.scaleWord, lab].filter(Boolean).join(" ");
      const nx = anchorX(nw, flip);
      if (!flip || !c.headline) {
        // headline top (or a hairline rule when there is none), the hero
        // number bottom, its label just above it
        if (c.headline) boxes.headline = headlineBox(c.headline, { width: 900, y: TOP, flip, maxLines: 3, maxHeight: 380, max: 200 });
        else boxes.rule = rule(flip, TOP);
        boxes.number = { ...box(nx, BOTTOM - nh, nw, nh), size, parts, align: flip ? "right" : "left", role: "number", flip };
        if (label) boxes.label = dataBox(label, { width: 620, size: 40, maxLines: 2, x: nx, bottom: boxes.number.y - 28, flip });
      } else {
        // the hero number top, right-anchored; its label under it; the headline bottom-left
        boxes.rule = rule(0, TOP);
        boxes.number = { ...box(nx, TOP + 60, nw, nh), size, parts, align: "right", role: "number", flip };
        if (label) boxes.label = dataBox(label, { width: 620, size: 40, maxLines: 2, y: boxes.number.y + nh + 28, flip });
        if (c.headline) boxes.headline = headlineBox(c.headline, { width: 900, bottom: BOTTOM, flip: 0, maxLines: 3, maxHeight: 420, max: 200 });
      }
      hero = "number";
    } else {
      const text = c?.headline || "";
      // The single emphasis word: one word filling the frame (typography.js
      // ROLE_EMPHASIS), the rest of the headline small and elsewhere.
      const emph = c?.emphasis_beat ? fitEmphasis(c.emphasis_word, R_EDGE - L_EDGE) : null;
      if (emph) {
        const word = String(c.emphasis_word).replace(/[^\p{L}]/gu, "");
        const shown = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        const ew = Math.min(R_EDGE - L_EDGE, Math.ceil(measure(shown, emph.size, { family: ROLE_EMPHASIS.family, weight: ROLE_EMPHASIS.weight, tracking: ROLE_EMPHASIS.tracking })));
        const eh = Math.round(emph.size * ROLE_EMPHASIS.lineHeight);
        boxes.rule = rule(flip ? 0 : 1, TOP);
        if (text) boxes.headline = headlineBox(text, { width: 700, y: TOP + 40, flip, maxLines: 3, maxHeight: 360, max: 120 });
        boxes.emphasis = { ...box(anchorX(ew, flip ? 0 : 1), BOTTOM - eh, ew, eh), size: emph.size, text: shown, align: flip ? "left" : "right", role: "emphasis" };
        hero = "emphasis";
      } else if (c?.vertical) {
        // One beat a video: the statement rotated 90 degrees along the left edge.
        const st = fitHeadline(text, 1180, { maxLines: 1, max: 200, min: 96 });
        const tw = Math.ceil(measure(st.lines[0] || "", st.size, { family: ROLE_HEADLINE.family, weight: ROLE_HEADLINE.weight, tracking: ROLE_HEADLINE.tracking }));
        const th = Math.round(st.size * ROLE_HEADLINE.lineHeight);
        boxes.rule = rule(1, TOP);
        if (c?.lead_in || folio) boxes.kicker = dataBox(c.lead_in || folio, { width: 560, size: 34, maxLines: 1, y: TOP + 24, flip: 1 });
        boxes.statement = { ...box(L_EDGE, BOTTOM - tw, th, tw), size: st.size, lines: st.lines, align: "left", role: "headline", rotate: -90, textW: tw };
        hero = "statement";
      } else {
        // A statement, bottom-anchored, on one side; a rule (and the lead-in
        // as a small label) at the top: the empty middle is the composition.
        boxes.rule = rule(flip ? 0 : 1, TOP);
        let topLimit = 430;
        if (c?.lead_in || folio) {
          boxes.kicker = dataBox(c.lead_in || folio, { width: 640, size: 34, maxLines: 1, y: TOP + 30, flip: flip ? 0 : 1 });
          topLimit = boxes.kicker.y + boxes.kicker.h + 60;
        }
        boxes.statement = headlineBox(text, { width: 984, bottom: BOTTOM, flip, maxLines: 5, maxHeight: BOTTOM - topLimit, max: 260 });
        hero = "statement";
      }
    }
  } else if (comp === "DATA-FULL") {
    Object.assign(boxes, dataHeader(c, flip));
    if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
    // Charts start at y >= 460 with or without a header and reach the
    // composition's bottom edge.
    // 70 px under the header: Fraunces' descenders / ascenders run past the
    // line box (run of 2026-09-29: "goes" touched the tallest bar's value).
    const top = Math.max(boxes.bottom + 70, c?.headline || c?.lead_in ? 500 : TOP);
    const W = R_EDGE - L_EDGE;
    if (vt === "BAR") {
      const bars = c?.data?.bars || [];
      const longLabel = bars.some((b) => String(b.label || "").length > 12);
      if (bars.length >= 4 || longLabel) boxes.chart = { ...box(L_EDGE, top, W, BOTTOM - top), orient: "h" };
      else boxes.chart = { ...box(L_EDGE, top, W, 1400 - top), orient: "v", baseline: 1355 };
    } else if (vt === "PIE") {
      // The donut on one side, the hero percentage on the other, above it.
      const r = 300;
      const cx = flip ? L_EDGE + r : R_EDGE - r, cy = BOTTOM - r - 10;
      boxes.chart = { ...box(cx - r, cy - r, 2 * r, 2 * r), r, cx, cy };
      const parts = numberParts(`${c?.data?.percent ?? 0}%`);
      const fit = fitNumber(parts, 560, { max: 300, min: 200 });
      const nslots = numberSlots(parts, fit.size);
      const nw = Math.ceil(nslots.width), nh = Math.round(fit.size * ROLE_NUMBER.lineHeight);
      const ny = Math.max(top, cy - r - nh - 24);
      boxes.number = { ...box(flip ? R_EDGE - nw : L_EDGE, ny, nw, nh), size: fit.size, parts, align: flip ? "right" : "left", role: "number", flip: flip ? 1 : 0 };
      if (c?.data?.label) boxes.label = dataBox(c.data.label, { width: 340, size: 36, maxLines: 4, x: flip ? R_EDGE - 340 : L_EDGE, y: ny + nh + 24, flip: flip ? 1 : 0 });
    } else if (vt === "GAUGE") {
      // A semicircle across the frame; the hero percentage under it, on one side.
      const r = 470;
      const parts = numberParts(`${c?.data?.percent ?? 0}%`);
      const fit = fitNumber(parts, 600, { max: 300, min: 200 });
      const nslots = numberSlots(parts, fit.size);
      const nw = Math.ceil(nslots.width), nh = Math.round(fit.size * ROLE_NUMBER.lineHeight);
      // The number hangs from the bottom of the composition; the arc's base
      // sits 90 px above it, so the beat spans the frame with or without a header.
      const ny = BOTTOM - nh;
      const cy = Math.max(top + r + 10, ny - 90);
      boxes.chart = { ...box(540 - r, cy - r, 2 * r, r + 60), r, cy };
      boxes.number = { ...box(anchorX(nw, flip), ny, nw, nh), size: fit.size, parts, align: flip ? "right" : "left", role: "number", flip };
      // The label sits beside its number, bottom-aligned to the numeral's baseline.
      if (c?.data?.label) {
        const lb = dataBox(c.data.label, { width: 300, size: 36, maxLines: 4, y: 0, flip });
        const by = ny + Math.round(nh * 0.8) - lb.h;
        boxes.label = flip ? { ...lb, x: boxes.number.x - 40 - lb.w, y: by, align: "right" } : { ...lb, x: boxes.number.x + nw + 40, y: by, align: "left" };
      }
    } else if (vt === "LINE") {
      boxes.chart = box(L_EDGE + 12, top, W - 24, BOTTOM - top);
    } else {
      boxes.chart = box(L_EDGE, top, W, BOTTOM - top);
    }
    hero = "chart";
  } else if (comp === "MAP-CENTERED") {
    // The map fills the frame above the caption row (it bleeds like a photo:
    // its edges feather into the studio), zoomed on the region; the engine
    // labels the region itself. The header floats over it.
    Object.assign(boxes, dataHeader(c, flip));
    if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
    boxes.map = box(0, 0, FRAME.w, 1440);
    hero = "map";
  } else if (comp === "LIST-BUILD") {
    Object.assign(boxes, dataHeader(c, flip));
    if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
    const items = (c?.data?.items || []).slice(0, 5);
    const top = Math.max(boxes.bottom + 40, 470);
    const rowH = (BOTTOM - top) / Math.max(1, items.length);
    boxes.items = items.map((label, i) => {
      const y = top + i * rowH;
      const size = 46;
      const f = fitText(String(label).toUpperCase(), 640, { max: size, min: ROLE_DATA.sizeBand[0], maxLines: 2, lineH: ROLE_DATA.lineHeight });
      const w = Math.min(640, Math.max(...f.lines.map((l) => textWidth(l, f.size, false, 700)))) + 2;
      const h = f.lines.length * f.size * ROLE_DATA.lineHeight;
      // The index numeral sits on one side of the row, the item's text beside it; a hairline above.
      const nw = 150;
      const tx = flip ? R_EDGE - nw - 24 - w : L_EDGE + nw + 24;
      return { ...box(tx, y + rowH * 0.5 - h / 2 + 30, w, h), size: f.size, lines: f.lines, align: flip ? "right" : "left", role: "data", upper: true, weight: 700, label, i,
        index: { ...box(flip ? R_EDGE - nw : L_EDGE, y + 22, nw, 120), size: 120, text: String(i + 1).padStart(2, "0"), role: "number", align: flip ? "right" : "left" },
        rule: { ...box(L_EDGE, y, R_EDGE - L_EDGE, 4), role: "rule", anchor: flip ? "right" : "left" } };
    });
    // The list closes on a hairline at the composition's bottom edge.
    boxes.end = { ...box(L_EDGE, BOTTOM - 4, R_EDGE - L_EDGE, 4), role: "rule", anchor: flip ? "right" : "left" };
    hero = "items";
  } else if (comp === "TIMELINE") {
    Object.assign(boxes, dataHeader(c, flip));
    if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
    const mk = (c?.data?.markers || []).slice(0, 4);
    const top = Math.max(boxes.bottom + 50, 480);
    const rowH = (BOTTOM - top) / Math.max(1, mk.length);
    const lineX = flip ? R_EDGE - 60 : L_EDGE + 60;
    boxes.line = { ...box(lineX - 3, top, 6, BOTTOM - top), role: "rule" };
    const size = Math.max(120, Math.min(260, Math.floor((rowH - 100) / ROLE_NUMBER.lineHeight)));
    boxes.markers = mk.map((m, i) => {
      const y = top + i * rowH;
      const parts = numberParts(m.date);
      const dText = String(m.date);
      const dw = Math.min(760, Math.ceil(measure(dText, size, { family: "Fraunces", weight: ROLE_NUMBER.weight, tracking: ROLE_NUMBER.tracking })));
      const dh = Math.round(size * ROLE_NUMBER.lineHeight);
      const dx = flip ? lineX - 60 - dw : lineX + 60;
      const lab = dataBox(m.label, { width: 640, size: 38, maxLines: 2, x: undefined, y: y + dh + 14, flip });
      return { date: { ...box(dx, y + 10, dw, dh), size, text: dText, parts, align: flip ? "right" : "left", role: "number" },
        label: { ...lab, x: flip ? lineX - 60 - lab.w : lineX + 60 },
        dot: { ...box(lineX - 18, y + 10 + dh / 2 - 18, 36, 36), role: "rule" }, i };
    });
    hero = "markers";
  } else if (comp === "COMPARISON-SPLIT") {
    // The frame is cut on a diagonal (top-right to bottom-left): value A in
    // the light half, value B in the dark half. Both numerals the same size.
    const cmp = c?.data || {};
    const lineAt = (y) => 700 - (440 * y) / 1920;
    boxes.split = { ...box(0, 0, FRAME.w, FRAME.h), role: "shape", x0: 700, x1: 260 };
    if (c?.headline) boxes.headline = headlineBox(c.headline, { width: 520, y: TOP, flip: 0, maxLines: 3, maxHeight: 400, max: 120 });
    if (!c?.headline && !c?.lead_in && !cmp.subject) boxes.rule = rule(0, TOP);
    const pa = numberParts(cmp.a?.value ?? ""), pb = numberParts(cmp.b?.value ?? "");
    // A in the upper light half, B hung from the bottom of the dark half.
    const wa = Math.floor(lineAt(900) - L_EDGE - 30), wb = Math.floor(R_EDGE - lineAt(1250) - 30);
    const sz = Math.min(fitNumber(pa, wa, { max: 280, min: 110 }).size, fitNumber(pb, wb, { max: 280, min: 110 }).size);
    const sa = numberSlots(pa, sz), sb = numberSlots(pb, sz);
    const nh = Math.round(sz * ROLE_NUMBER.lineHeight);
    boxes.numberA = { ...box(L_EDGE, 620, Math.ceil(sa.width), nh), size: sz, parts: pa, align: "left", role: "number", side: "a" };
    boxes.numberB = { ...box(R_EDGE - Math.ceil(sb.width), BOTTOM - nh, Math.ceil(sb.width), nh), size: sz, parts: pb, align: "right", role: "number", side: "b" };
    if (cmp.a?.label) boxes.labelA = dataBox(cmp.a.label, { width: Math.max(160, wa), size: 36, maxLines: 3, x: L_EDGE, y: boxes.numberA.y + nh + 24, flip: 0 });
    if (cmp.b?.label) boxes.labelB = dataBox(cmp.b.label, { width: Math.max(160, wb), size: 36, maxLines: 3, bottom: boxes.numberB.y - 20, flip: 1 });
    if (cmp.subject) boxes.kicker = dataBox(cmp.subject, { width: 480, size: 34, maxLines: 1, y: TOP + (boxes.headline ? boxes.headline.h + 24 : 0), flip: 0 });
    hero = "numberA";
  } else if (comp === "SCENE-FULL" || comp === "ARCHITECTURE" || comp === "DOCUMENT" || comp === "MONEY") {
    if (c?.photo) {
      boxes.photo = box(0, 0, FRAME.w, FRAME.h);
      // The label over the picture: the entity / document named in the
      // sentence; a MONEY beat has none (its picture is an object, not a name).
      const kicker = comp !== "MONEY" && c.photo.entity ? String(c.photo.entity) : null;
      boxes.rule = rule(flip, TOP);
      if (kicker) boxes.kicker = dataBox(kicker, { width: 700, size: 36, maxLines: 1, y: TOP + 26, flip });
      // MONEY: the sentence's figure, large, over the photograph.
      if (comp === "MONEY" && c?.data?.value) {
        const parts = numberParts(c.data.value);
        const { size } = fitNumber(parts, R_EDGE - L_EDGE, { max: 300, min: 160 });
        const slots = numberSlots(parts, size);
        const nw = Math.min(R_EDGE - L_EDGE, Math.ceil(slots.width)), nh = Math.round(size * ROLE_NUMBER.lineHeight);
        boxes.number = { ...box(anchorX(nw, flip), TOP + 60, nw, nh), size, parts, align: flip ? "right" : "left", role: "number", flip };
      }
      boxes.headline = { ...headlineBox(c.headline || "", { width: 920, bottom: BOTTOM, flip, maxLines: 4, maxHeight: comp === "MONEY" ? 520 : 700, max: 200 }), callout: comp === "DOCUMENT" };
      hero = "photo";
    } else {
      Object.assign(boxes, dataHeader(c, flip, { maxSize: 112 }));
      if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
      const top = Math.max(boxes.bottom + 60, CONTENT_TOP + 20);
      // The object fills the far two thirds of the frame, on the side away
      // from the headline; drawn "contain".
      boxes.cutout = flip ? box(L_EDGE, top, 700, BOTTOM - top) : box(R_EDGE - 700, top, 700, BOTTOM - top);
      hero = "cutout";
    }
  } else if (comp === "PROCESS-FULL") {
    Object.assign(boxes, dataHeader(c, flip));
    if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
    const nodes = (c?.data?.nodes || []).slice(0, 3);
    const top = Math.max(boxes.bottom + 70, CONTENT_TOP);
    const place = (x, w) => (flip ? FRAME.w - x - w : x);
    if (nodes.length === 2) {
      const d = 380;
      boxes.nodes = [
        { ...box(place(L_EDGE, d), top, d, d), label: nodes[0] },
        { ...box(place(R_EDGE - d, d), BOTTOM - d, d, d), label: nodes[1] },
      ];
    } else {
      // A staircase across the frame: left, middle, right, descending.
      const d = Math.min(320, (BOTTOM - top - 40) / 3);
      const step = (BOTTOM - top - d) / 2;
      const xs = [L_EDGE, Math.round((FRAME.w - d) / 2) + 40, R_EDGE - d];
      boxes.nodes = nodes.map((label, i) => ({ ...box(place(xs[i], d), top + i * step, d, d), label }));
    }
    hero = "nodes";
  }
  return { composition: comp, boxes, hero, flip };
}

const isBox = (v) => v && typeof v === "object" && "x" in v && "y" in v && "w" in v && "h" in v;
/**
 * Every box of a layout as [name, box], nested ones included: an array
 * ("items", "markers", "nodes") contributes "<name><i>" for each element and
 * "<name><i>_<sub>" for each box inside it (an item's index numeral, a
 * marker's date / label / dot). "bottom" is a layout coordinate, not a box.
 */
export function flattenBoxes(boxes) {
  const out = [];
  const walk = (name, v) => {
    if (isBox(v)) out.push([name, v]);
    if (v && typeof v === "object") for (const [sk, sv] of Object.entries(v)) if (isBox(sv)) out.push([`${name}_${sk}`, sv]);
  };
  for (const [k, v] of Object.entries(boxes || {})) {
    if (k === "bottom") continue;
    if (Array.isArray(v)) v.forEach((el, j) => walk(`${k}${j}`, el)); else walk(k, v);
  }
  return out;
}

/** Union box of every element (captions excluded). */
export function contentBounds(layout) {
  const all = flattenBoxes(layout.boxes).filter(([k, v]) => k !== "split" && v.role !== "shape").map(([, v]) => v);
  if (!all.length) return null;
  const x1 = Math.min(...all.map((b) => b.x)), y1 = Math.min(...all.map((b) => b.y));
  const x2 = Math.max(...all.map((b) => b.x + b.w)), y2 = Math.max(...all.map((b) => b.y + b.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** The box a camera_focus target names, or null (full frame). */
export function focusBox(layout, target) {
  const b = layout.boxes || {};
  const t = String(target || "full").toLowerCase();
  if (t === "full") return null;
  if (t === "number") return b.number || b.emphasis || b.statement || b.chart || null;
  if (t === "chart" || t === "data") return b.chart || b.number || null;
  if (t === "headline" || t === "text") return b.headline || b.statement || b.emphasis || null;
  if (t === "map") return b.map ? { x: 140, y: 380, w: 800, h: 1000 } : null;
  if (t === "photo" || t === "subject") return b.photo ? { x: 140, y: 380, w: 800, h: 1000 } : b.cutout || null;
  if (t === "left") return { x: 0, y: 300, w: 640, h: 1100 };
  if (t === "right") return { x: 440, y: 300, w: 640, h: 1100 };
  if (t === "top") return { x: 0, y: 100, w: 1080, h: 900 };
  if (t === "bottom") return { x: 0, y: 700, w: 1080, h: 900 };
  if (/^node\s*\d$/.test(t) && Array.isArray(b.nodes)) return b.nodes[Number(t.slice(-1))] || null;
  if (t === "items" || t === "markers") return Array.isArray(b[t]) && b[t].length ? contentBounds({ boxes: { [t]: b[t] } }) : null;
  if (t === "a" || t === "value a") return b.numberA || null;
  if (t === "b" || t === "value b") return b.numberB || null;
  return null;
}

/**
 * The canvas record render.js writes into the manifest for one beat (and the
 * QA harness writes for its test plan): the renderer's own boxes, each with
 * its type role and alignment, plus what the typography rebuild drew — so the
 * audit (local-audit.cjs canvas-fit / canvas-type / canvas-texture) judges
 * what was rendered, not what was planned.
 */
export function canvasManifest(raw, idx) {
  const c = normalizeCanvas(raw, idx);
  const L = canvasLayout(c);
  const flat = {};
  const meta = (n) => ({ x: n.x, y: n.y, w: n.w, h: n.h, role: n.role || null, align: n.align || null, rotate: n.rotate || null });
  for (const [k, v] of flattenBoxes(L.boxes)) flat[k] = meta(v);
  const shown = (k) => (L.boxes[k]?.lines ? L.boxes[k].lines.join(" ") : L.boxes[k]?.text || null);
  return {
    composition: L.composition, hero: L.hero, boxes: flat, content: contentBounds(L), motion_tier: c.motion_tier || "medium",
    camera_focus: c.camera_focus || null, persists_from: Number.isInteger(c.persists_from) ? c.persists_from : null, match_cut_prev: !!c.match_cut_prev,
    photo: c.photo ? { asset: c.photo.asset, entity: c.photo.entity || null, kind: c.photo.kind || null, view: c.photo.view || null } : null,
    // Where the accent is drawn: chart values / arrows, the hero number (unless the
    // sentence is neutral: number_accent === false), the latest date, the last list
    // index, the larger comparison value, the map's region, a document's callout band.
    accent_used: ["DATA-FULL", "PROCESS-FULL", "TIMELINE", "LIST-BUILD", "COMPARISON-SPLIT", "MAP-CENTERED", "DOCUMENT"].includes(L.composition)
      || ((L.composition === "NUMBER-FULL" || L.composition === "MONEY") && c.number_accent !== false && !!L.boxes.number),
    variant: c.variant, flip: L.flip, dark: !!c.dark, grain: true, vignette: true,
    headline_text: shown("headline") || shown("statement") || null, emphasis_text: shown("emphasis"),
    // The headline's entrance: the words fly in on a major TYPE-FULL statement,
    // otherwise mask-reveal / slide-land / crop-open rotating on the beat index.
    headline_motion: (c.motion_tier === "major" && L.composition === "TYPE-FULL" && L.boxes.statement && !L.boxes.statement.rotate) ? "words"
      : L.boxes.headline || L.boxes.statement ? ROLE_HEADLINE.motions[((idx % 3) + 3) % 3] : null,
    vertical: !!c.vertical,
    number_snaps: L.boxes.number ? !L.boxes.number.parts?.isQuantity : null,
  };
}

/**
 * The channel accent, lightened for a dark beat. Several accents (navy
 * #1E3A5F, steel #4A5568, law red #8B1E1E) are too close to #0E0E0E to read
 * there; this keeps the hue and lifts the lightness to `minL`. Derived from
 * the configured colour (channels.json colors.canvas_accent), not a new one.
 */
export function liftAccent(hex, minL = 0.6) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  // Keep the accent's own saturation (steel stays a grey-blue), only avoid a fully grey lift.
  const L = Math.max(l, minL), S = Math.min(1, Math.max(s, 0.12));
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S, p = 2 * L - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  const hx = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${hx(f(h + 1 / 3))}${hx(f(h))}${hx(f(h - 1 / 3))}`;
}
