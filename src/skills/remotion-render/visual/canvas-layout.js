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
import { markWords, fitWords, fitNumberBleed } from "./kinetic.js";
import { resolveGround } from "./backgrounds.js";
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
/**
 * Three-zone separation (owner's rule, 2026-10-02): every beat stacks three
 * zones and each element lives in exactly one; no two element TYPES share a
 * zone (a number may sit over the chart whose value it is). Charts and maps
 * crossed through headlines and captions before this.
 *   top     y 0-620     the header (kicker, headline) — or, NUMBER-FULL
 *                       with headline_zone "middle", the number
 *   middle  y 620-1340  the body: chart / map / nodes / list / number /
 *                       statement
 *   bottom  y 1340-1920 the word caption (1450-1610) and nothing else
 * An element may cross into a neighbouring zone by < ZONE_TOL px (a border
 * case). TOP moved 180 -> 130 and BOTTOM 1400 -> 1340 so the header + body
 * still span >= 60% of the frame height (canvas-coverage) inside the zones.
 */
export const ZONES = Object.freeze({ top: [0, 620], middle: [620, 1340], bottom: [1340, 1920] });
export const ZONE_TOL = 8;
export const BODY_TOP = 640;     // first body pixel: 20 px under the top zone, room for Fraunces descenders
export const HEADER_MAX_Y = 600; // the header's last pixel
// Fraunces numerals are old-style: 3 4 5 7 9 descend ~0.2 em below the
// number box (box = cap line .. baseline + 0.1 em). A number anchored to a
// zone's bottom edge sits NUM_DESC x size above it (QA render 2026-10-02:
// "1938" crossed y 1340 into the caption's zone).
export const NUM_DESC = 0.2;
/**
 * A hero number's ink below its box top, in px, MEASURED on CI frames (run
 * 36944700437 ch-1): the figures are lining (no digit descends — the old
 * "3 4 5 7 9 descend" model was wrong and cost coverage). A quantity (it
 * rolls) ends at 0.81 em ("70", size 518: ink to box.y + 421). A
 * non-quantity — a year or identifier, which pops (SNAP_IN) and never rolls —
 * renders 0.12 em LOWER ("2026", size 438: cap line at box.y + 0.20 em, ink
 * to box.y + 0.92 em; "1938" in the QA render the same). The cause of that
 * offset is not found in full-canvas.jsx NumberHero; it is reproduced here as
 * measured so the ink ends ON the zone's edge, never across it and never so
 * far above it that canvas-coverage fails.
 */
export const numberInk = (text, size) => {
  const p = numberParts(String(text ?? ""));
  // A separator ("7382.85", "1,400") drops ~0.10 em below the baseline
  // (CI run 36950257339 ch-48: its tail crossed y 1340 by 30 px at size 302).
  // A COMMA only: a decimal POINT sits on the baseline with the lining figures — "3.5" at
  // size 518 ended 70 px above its box (y 1270, not 1340), and the beat failed canvas-coverage
  // at 58.4% (CI run 37102013192 ch-9; "$387.5", "$2.7 million" the same in 37086054975 /
  // 37102013192 ch-26). The "7382.85" crossing that added "." was measured under the old
  // camera push, as the 0.82 below was.
  const sep = /\d,/.test(String(text ?? "")) ? 0.12 : 0;   // also a trailing "2," (CI run 36953236514 ch-48)
  // "%" (set at 0.8x on the baseline) drops its lower circle and slash ~0.1 em
  // below it (CI run 36976172356 ch-44 GAUGE "50%": crossed y 1340 by ~25 px).
  // 0.03, was 0.1: "10%" ended ~73 px above its box and the beat failed canvas-coverage at
  // 59.2% (CI run 37108869325 ch-9). The 0.1 was measured under the old camera push, like the
  // separator reserve (a0b1763); 0.03 keeps a small allowance for the % sign's overshoot.
  const pct = /%/.test(String(text ?? "")) && !sep ? 0.03 : 0;
  // 0.94 for EVERY figure — the WORST case, so the ink never crosses the edge it is
  // anchored on. Measured depths vary per render between 0.805 em ("7515", CI run
  // 37149091704 ch-2; "3.5", "10%" earlier) and 0.92 em ("30", "16", run 37152783591
  // ch-48, which crossed y 1340 when quantities were anchored at 0.81 — reverted). The
  // cause of the 0.12 em difference is not found in NumberHero. NUMBER-FULL's coverage no
  // longer depends on it: the label (or a floor rule) holds the zone's floor, the figure
  // stands above it.
  void p;
  return Math.ceil(size * (0.94 + sep + pct));
};
// Fraunces descenders (g j p q y , ;) reach ~1.07 em below a line's top, past
// a 0.95 (headline) or 0.90 (emphasis) line box: a text block anchored to a
// zone's bottom edge sits (1.07 - lineHeight) em above it — ONLY when its last
// line has a descender (CI runs 36944700437 / 36947929123: statements and an
// emphasis word crossed y 1340; an offset on a line without descenders just
// cost coverage).
export const TEXT_DESC = 0.12;
export const descOffset = (lastLine, size, lineHeight) => (/[gjpqy,;Q]/.test(String(lastLine || "")) ? Math.ceil(Math.max(0, 1.20 - lineHeight) * size) : 0);   // 1.07 -> 1.20: a "q" tail measured 0.25 em past a 0.95 box (CI run 36950257339 ch-44 "inequities")
export const TOP = 130;          // row 0 top (150 -> 130: coverage headroom inside the zones, CI run 36944700437)
export const BOTTOM = 1340;      // the body's bottom edge = the middle zone's bottom
export const COMP = { x: 48, y: 100, w: 984, h: 1320 };
// The word caption (required on every beat) fills the grid's caption row. Its
// box stays clear of the Shorts UI (right-hand buttons from x ~960): 48..928
// left-aligned, or 64..944 right-aligned (CAPTION_R).
export const CAPTION = { x: 48, y: 1450, w: 880, h: 160 };
export const CAPTION_R = { x: 64, y: 1450, w: 880, h: 160 };
export const COMPOSITIONS = ["TYPE-FULL", "TYPE-SPLIT", "NUMBER-FULL", "DATA-FULL", "SCENE-FULL", "ARCHITECTURE", "PORTRAIT", "DOCUMENT", "MONEY", "MAP-CENTERED", "PROCESS-FULL", "TIMELINE", "COMPARISON-SPLIT", "LIST-BUILD",
  "SCENE-LOW", "PHOTO-BAND", "PHOTO-EDGE", "PHOTO-CARD", "PHOTO-INSET", "PHOTO-STRIP", "HERO-LOW", "HERO-SCATTER", "HERO-OVER",
  "TYPE-TITLE", "TYPE-CHAPTER", "TYPE-DEFINITION", "NUMBER-STAT"];

// ── SHOTS: the reference's shot grammar (docs/REFERENCE-SHOT-GRAMMAR.md) ─────────────────
// The compositions above used to be one per CONTENT kind (a photo is SCENE-FULL, a person
// PORTRAIT, a cutout TYPE-FULL): the content decided the frame, so a video had a handful of frame
// divisions whatever the planner wanted. A shot is how the frame is divided around that content,
// taken from the reference (research/motion-graphics-ref/ref-01..03). Gemini names one per beat
// (`shot`); shotComposition() draws it when the beat's content is something that shot frames, and
// otherwise the content's own composition stands (logged by the caller). Code decides legality only.
//   a photo:  SCENE-FULL (headline top, full bleed) | SCENE-LOW | PHOTO-BAND | PHOTO-EDGE |
//             PHOTO-CARD | PHOTO-INSET | PHOTO-STRIP | PORTRAIT (a person: the photo standing)
//   an object (cutout, logo, symbol): HERO-STACK (TYPE-FULL with its hero) | HERO-LOW | HERO-SCATTER | HERO-OVER
// Figures (number, chart, map, process, list, timeline, comparison) and plain statements keep the
// composition their content draws: a shot does not reframe a chart.
export const FULL_PHOTO_COMPS = ["SCENE-FULL", "ARCHITECTURE", "DOCUMENT", "MONEY", "SCENE-LOW"];
export const FRAMED_PHOTO_COMPS = ["PHOTO-BAND", "PHOTO-EDGE", "PHOTO-CARD", "PHOTO-INSET", "PHOTO-STRIP"];
export const HERO_COMPS = ["HERO-LOW", "HERO-SCATTER", "HERO-OVER"];
/**
 * Where a composition puts its words: "top" (text drawn in the top band — a label to the template
 * rule, scripts/template-check.js labelsDrawn) or "low" (the top band holds only a picture / rule).
 * The planner is told this so it can keep the words moving (no device on three beats in a row).
 */
export const TEXT_AT = Object.freeze({
  "PHOTO-BAND": "low", "SCENE-LOW": "low", "HERO-OVER": "low", "TYPE-FULL": "low", "DOCUMENT": "low", "MONEY": "low",
  "PHOTO-EDGE": "top", "PHOTO-CARD": "top", "PHOTO-INSET": "top", "PHOTO-STRIP": "top", "SCENE-FULL": "top", "ARCHITECTURE": "top", "PORTRAIT": "top",
  "HERO-STACK": "top", "HERO-LOW": "top", "HERO-SCATTER": "top",
  "TITLE": "low", "CHAPTER": "low", "DEFINITION": "low", "STAT": "low",
});
// WORDS-ONLY cards (docs/REFERENCE-SHOT-GRAMMAR.md "Text-only cards"): a statement with no picture,
// framed four ways the reference frames its type. Each is type-led to the template rule — a run of
// three words-only beats still fails, however different they look (owner, 2026-10-09: keep strict).
export const TYPE_CARD_COMPS = ["TYPE-TITLE", "TYPE-CHAPTER", "TYPE-DEFINITION"];
export const TYPE_LED_COMPS = ["TYPE-FULL", "TYPE-SPLIT", ...TYPE_CARD_COMPS];
export const SHOT_COMPOSITIONS = [...FRAMED_PHOTO_COMPS, "SCENE-LOW", ...HERO_COMPS, ...TYPE_CARD_COMPS, "NUMBER-STAT"];
export const PHOTO_SHOTS = ["SCENE-FULL", "SCENE-LOW", ...FRAMED_PHOTO_COMPS, "PORTRAIT"];
export const HERO_SHOTS = ["HERO-STACK", ...HERO_COMPS];
// FIGURE / STATEMENT: the content's own frame (a chart, a number, a map; a plain statement), named
// so every beat carries a shot the planner chose.
export const CARD_SHOTS = ["TITLE", "CHAPTER", "DEFINITION"];
export const SHOTS = [...PHOTO_SHOTS, ...HERO_SHOTS, "FIGURE", "STATEMENT", ...CARD_SHOTS, "STAT"];
// Offered at render time, once the content is known (scripts/render-and-qa.js chooseShots):
// STATEMENT-SPLIT — a statement in two halves, top and low (TYPE-SPLIT); FIGURE-LOW — a number in the
// top band, its headline low in the middle band (NUMBER-FULL with the zones swapped).
export const CONTENT_SHOTS = ["STATEMENT-SPLIT", "FIGURE-LOW", "MAP-BAND"];
/** A shot name as the planner wrote it, or null ("photo band" / "photo_band" -> PHOTO-BAND). */
export function shotName(s) {
  const n = String(s || "").trim().toUpperCase().replace(/[\s_]+/g, "-");
  return SHOTS.includes(n) || CONTENT_SHOTS.includes(n) ? n : null;
}
/**
 * The composition a beat is drawn as: `shot` when the content is something it frames, else `base`.
 *   -> { composition, shot, used: bool, why }
 * A MONEY beat keeps its own frame (its figure is drawn over the photo); a person (PORTRAIT) or a
 * document may take any photo shot; a TYPE-FULL beat with a hero object any hero shot.
 */
export function shotComposition(base, shot, c = {}) {
  const s = shotName(shot);
  if (!s) return { composition: base, shot: null, used: false, why: shot ? `"${shot}" is not a shot` : "no shot" };
  if (s === "FIGURE" || s === "STATEMENT" || CONTENT_SHOTS.includes(s)) return { composition: base, shot: s, used: true, why: null };
  // Words-only cards frame a plain statement (no photo, object, name card); STAT a number with its label.
  if (CARD_SHOTS.includes(s)) {
    const plain = ["TYPE-FULL", "TYPE-SPLIT"].includes(base) && !c.photo && !(c.concept_visuals || []).length && !c.name_card?.name && !!String(c.headline || "").trim();
    return plain ? { composition: `TYPE-${s}`, shot: s, used: true, why: null } : { composition: base, shot: s, used: false, why: `${s} frames a words-only statement; this beat draws ${base}${c.name_card?.name ? " (a name card)" : ""}` };
  }
  if (s === "STAT") {
    const ok = base === "NUMBER-FULL" && String(c.visual_type || "").toUpperCase() === "COUNTER" && !!c.data?.value && !!String(c.data?.label || "").trim();
    return ok ? { composition: "NUMBER-STAT", shot: s, used: true, why: null } : { composition: base, shot: s, used: false, why: `STAT frames a stated number with its label; this beat draws ${base}` };
  }
  const photoBase = !!c.photo && ["SCENE-FULL", "ARCHITECTURE", "DOCUMENT", "PORTRAIT"].includes(base);
  const heroBase = base === "TYPE-FULL" && Array.isArray(c.concept_visuals) && c.concept_visuals.length > 0;
  if (PHOTO_SHOTS.includes(s)) {
    if (!photoBase) return { composition: base, shot: s, used: false, why: `${s} frames a photo; this beat draws ${base}${c.photo ? " (its own frame)" : ""}` };
    // SCENE-FULL keeps a building's facade tilt and a document's callout: the content's own full-bleed frame.
    if (s === "SCENE-FULL") return { composition: base === "PORTRAIT" ? "SCENE-FULL" : base, shot: s, used: true, why: null };
    if (s === "PORTRAIT") return { composition: "PORTRAIT", shot: s, used: true, why: null };
    return { composition: s, shot: s, used: true, why: null };
  }
  if (!heroBase) return { composition: base, shot: s, used: false, why: `${s} frames an object (cutout, logo, symbol); this beat draws ${base}` };
  return { composition: s === "HERO-STACK" ? "TYPE-FULL" : s, shot: s, used: true, why: null };
}
export const TRANSITION_SEC = 0.5;
export const CONTENT_TOP = TOP;

export const INK = "#0B0B0C";
export const INK_SOFT = "#8E8E93";
export const MID = "#A7A7AD";
export const LIGHT = "#DADADF";
// The studio ground: uniform white, the one value in backgrounds.js (the
// off-white #F6F4F0 and the per-channel gradients are gone).
export { GROUND as STUDIO } from "./backgrounds.js";
export const DARK_BG = "#0E0E0E";
export const INK_ON_DARK = "#F2F0EB";
export const SANS = "Inter";
export { SERIF };

// TREND (scripts/composition-variety.js, owner's spec 2026-10-03 B.4): a stated rise or fall
// with no figures — drawn in the chart box as a line to one dot, no values.
const DATA_TYPES = ["BAR", "PIE", "LINE", "GAUGE", "TREND"];

/**
 * The composition a checked visual type is drawn as. `hasPhoto`: the image the
 * type needs (photo, scan) was resolved — an unresolved one is drawn
 * as typography, never as a stand-in. `extra.view === "building"`: a PHOTO
 * whose real photo shows a building is ARCHITECTURE; `extra.split`: a TYPE
 * beat drawn as TYPE-SPLIT.
 */
export function compositionFor(visualType, hasPhoto, extra = {}) {
  const t = String(visualType || "TYPE").toUpperCase();
  // A person is a PORTRAIT (owner's scene-resolver spec 2026-10-02, task 3.2): the
  // verified photo in the middle zone, the name above. A building / an
  // organization's building is ARCHITECTURE and a place SCENE-FULL, full-bleed.
  if (t === "PHOTO") return hasPhoto ? (extra.view === "person" ? "PORTRAIT" : extra.view === "building" ? "ARCHITECTURE" : "SCENE-FULL") : "TYPE-FULL";
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
/**
 * The beat's background variation (owner's spec 2026-10-03, part C.3) — subtle, on the
 * white ground: every 3rd beat a faint paper texture (opacity 0.04), every 5th beat a thin
 * horizontal rule above the headline zone. A full-bleed photo beat covers the ground: none.
 * The renderer (full-canvas.jsx) and the manifest both read this, so the report counts
 * what was drawn.
 */
// 2026-10-03 (later spec, E.4): texture opacity 0.03 on every 3rd beat; every 5th beat a very
// subtle vertical gradient (white to #F8F7F4 — luma ~247, above canvas-ground's 245 floor)
// instead of the thin rule; every other beat pure white.
export const PAPER_OPACITY = 0.03;
export const BG_RULE = Object.freeze({ y: TOP - 40, h: 2, color: "#DADADF" });
export const BG_GRADIENT = "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 35%, #F8F7F4 100%)";
export function backgroundOf(idx, composition = "", customGround = false) {
  // A full-bleed photo covers the ground; a beat that declared its own ground is drawn on that
  // colour as it is — the white-only paper texture / gradient variation does not apply to it.
  if (customGround || FULL_PHOTO_COMPS.includes(composition)) return { paper: false, rule: false, gradient: false };
  const gradient = (idx + 1) % 5 === 0;
  return { paper: !gradient && (idx + 1) % 3 === 0, rule: false, gradient };
}

export function normalizeCanvas(c, idx = 0) {
  // The ground is the beat's own: `ground_color` is a hex the planner chose (resolveGround), or
  // absent for the default white. `dark` follows from it — light ink on a dark ground — and is
  // never set any other way, so a plan resolved while the old retired dark beats existed
  // (c.dark with no ground_color) still cannot draw light ink on white.
  const g = resolveGround(c?.ground_color);
  return { ...c, beat_index: Number.isInteger(c?.beat_index) ? c.beat_index : idx, variant: Number.isInteger(c?.variant) ? c.variant : idx, ground_color: g.hex, dark: g.dark };
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
// A label never ends on a function word: "VESSELS TO DISMANTLE THE" (ch-9 beat 5, board 37901614633) was a
// sentence fragment cut one word late. The trailing article / preposition / conjunction is dropped from
// what is DRAWN (nothing is added, no fact changes); a single word is left as it is.
const DANGLING = new Set(["the", "a", "an", "of", "to", "and", "or", "but", "in", "on", "for", "with", "by", "at", "from", "that", "which", "as", "into", "than", "is", "are", "was", "were", "its", "their", "his", "her", "our", "your", "this", "these", "those", "has", "have", "had", "will", "would", "be", "been"]);
export function trimDangling(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && DANGLING.has(words[words.length - 1].toLowerCase().replace(/[^a-z']/g, ""))) words.pop();
  return words.join(" ");
}
function dataBox(text, { width = 560, size = 40, maxLines = 2, x, y, flip = 0, bottom = null, weight = 600, center = false } = {}) {
  const t = trimDangling(text).toUpperCase();
  const f = fitText(t, width, { max: size, min: ROLE_DATA.sizeBand[0], maxLines, lineH: ROLE_DATA.lineHeight, weight });
  const w = Math.min(width, Math.max(...f.lines.map((l) => textWidth(l, f.size, false, weight)))) + 2;
  const h = f.lines.length * f.size * ROLE_DATA.lineHeight;
  const bx = x ?? (center ? Math.round((FRAME.w - w) / 2) : anchorX(w, flip));
  return { ...box(bx, bottom != null ? bottom - h : y, w, h), size: f.size, lines: f.lines, align: center ? "center" : flip ? "right" : "left", role: "data", upper: true, weight };
}
// The planner's emphasis words for the canvas being laid out (set by canvasLayout).
let MARKS = [];
// Headline scale (owner's spec 2026-10-03, part C.2): the hero headline — a TYPE-FULL
// statement, where the headline IS the beat (the hook, the CTA, at most 3 a video under the
// variety rule) — is 120-160 px; every other headline (a header over a chart, photo, map,
// number, process or cutout) is 80-110 px. Two sizes, never one for all. A 110 px statement
// alone in the middle zone left it ~85% empty (QA render 2026-10-03), so the hero tier is the
// statement's. Set per beat by canvasLayout; the plain-statement branch passes hero: true.
// A name card's NAME is exempt (it is the entity, drawn like a hero number, not a headline).
// Later spec the same day (E.2): ONE beat per video carries the hero headline (140 px —
// canvas.hero_headline, the hook); every other headline is 80-110 px, varied beat by beat
// (HEADLINE_STEPS by variant). A headline that is its zone's subject (a TYPE-FULL / TYPE-SPLIT
// statement, the swapped counter's headline) is set in a narrower 640 px column off the hero
// beat, so at <= 110 px it still wraps to fill the zone (middle-zone-filled >= 15%).
export const HERO_HEADLINE = Object.freeze({ min: 120, max: 140 });
export const HEADLINE_SIZE = Object.freeze({ min: 80, max: 110 });
export const HEADLINE_STEPS = Object.freeze([110, 96, 104, 88]);
let BEAT_HERO = false, BEAT_MAX = 110;
const SUBJECT_W = 640;
/**
 * A ROLE_HEADLINE block, left- or right-anchored; top at `y`, or bottom at
 * `bottom`. Kinetic: the text is a list of words, each with its own weight
 * (mixed 500 / 700 within the phrase) and a colour role; the fit is done on
 * that layout (bold words are wider), and the box carries `words` with their
 * measured x / y / width.
 */
function headlineBox(text, { width = 984, y, bottom = null, flip = 0, maxLines = 4, maxHeight = Infinity, max = ROLE_HEADLINE.sizeBand[1], marks = MARKS, center = false, tier = true, hero = false, minLines = 1, min = null } = {}) {
  const TIER = BEAT_HERO ? HERO_HEADLINE : { min: HEADLINE_SIZE.min, max: BEAT_MAX };
  void hero;
  // center (part C.1): a TYPE-FULL statement, centred on the frame's axis.
  const align = center ? "center" : flip ? "right" : "left";
  const words = markWords(text, marks);
  // `min` (untiered only): a deliberately SMALL line — the chapter mark (TYPE-CHAPTER) — below the 88 px floor.
  const hi = tier ? Math.min(max, TIER.max) : max, lo = tier ? Math.min(hi, TIER.min) : Math.min(hi, min ?? 88);
  let f = fitWords(words, width, { maxLines, maxHeight, max: hi, min: lo, align });
  // The hero's 120 px floor never overflows its zone: a text that does not fit falls back to the 80 px floor.
  // The hero's floor never overflows its zone: a text that does not fit shrinks (to 80 px at
  // most) and the box says so — render.js logs it ('[layout] … hero headline shrunk').
  let shrunk = false;
  if (tier && lo > HEADLINE_SIZE.min && (f.lines.length > maxLines || f.height > maxHeight)) { f = fitWords(words, width, { maxLines, maxHeight, max: lo, min: HEADLINE_SIZE.min, align }); shrunk = BEAT_HERO; }
  // A statement that is its zone's SUBJECT wraps to >= minLines lines: one 110 px line filled 12-13%
  // of the middle zone (< 15%, CI run 37141128792 ch-9 / ch-48 / ch-26 TYPE-SPLIT). The column
  // narrows (never below 280 px) until the text wraps; the size band is unchanged.
  if (minLines > 1 && words.length >= minLines && f.lines.length < minLines) {
    for (let w2 = Math.floor(f.width * 0.75); w2 >= 280; w2 = Math.floor(w2 * 0.85)) {
      const g = fitWords(words, w2, { maxLines, maxHeight, max: hi, min: tier ? HEADLINE_SIZE.min : 88, align });
      if (g.lines.length >= minLines && g.lines.length <= maxLines && g.height <= maxHeight) { f = g; break; }
    }
  }
  const ax = (w) => (center ? Math.round((FRAME.w - w) / 2) : anchorX(w, flip));
  if (!f.lines.length) return { ...box(ax(0), bottom != null ? bottom : y, 0, 0), size: f.size, lines: [], words: [], align, role: "headline", inBand: false };
  const w = Math.min(width, Math.ceil(f.width) + 4);
  const h = f.height;
  const lines = f.lines.map((ln) => ln.map((i) => f.words[i].text).join(" "));
  // Bottom-anchored: the last line's descenders stay above `bottom` (TEXT_DESC).
  const desc = bottom != null ? descOffset(lines[lines.length - 1], f.size, ROLE_HEADLINE.lineHeight) : 0;
  // The descender lift counts against maxHeight: a 3-line TYPE-SPLIT half at
  // 360 px rose to y 600, across the top/middle zone edge (CI run 37010325344
  // ch-2 beat 3). Refit smaller until text + lift fits.
  if (bottom != null && Number.isFinite(maxHeight) && h + desc > maxHeight && f.size > (tier ? HEADLINE_SIZE.min : (min ?? 88))) {
    return headlineBox(text, { width, y, bottom, flip, maxLines, maxHeight, max: Math.min(hi, f.size - 4), marks, center, tier, hero, min });
  }
  const by = bottom != null ? bottom - h - desc : y;
  // desc: how far the last line's descenders reach below the box (contentBounds counts it as content).
  return { ...box(ax(w), by, w, h), size: f.size, lines, rows: f.lines, words: f.words, align, role: "headline", inBand: f.size >= ROLE_HEADLINE.sizeBand[0], desc, ...(shrunk ? { shrunk: true } : {}) };
}
const rule = (flip, y = TOP, w = 96) => ({ ...box(anchorX(w, flip), y, w, 6), role: "rule", anchor: flip ? "right" : "left" });

/** Kicker (lead-in) + headline at the top of a data / process / object beat. */
function dataHeader(c, flip, { maxSize = 168, maxHeight = 300 } = {}) {
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
// OFF (owner, 2026-10-08 "kill the template"): a folio on every beat is a repeating device. Only a
// canvas that explicitly asks for one (folio: true) gets it.
export const folioOf = (c) => (c?.folio === true && Number.isInteger(c?.beat_total) && c.beat_total > 0 ? `${pad2((c.beat_index ?? 0) + 1)} / ${pad2(c.beat_total)}` : null);

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
/**
 * The beat's layout: the plan's own when it gives one and it is legal, the composition table's
 * otherwise.
 *
 * A planned layout is checked BEFORE render against the geometry Layer 1 audits after it
 * (layoutViolations: zones, overlapping text, text on the centre line, the 60% height span). A
 * layout that breaks a rule the table's own layout for this beat does not break is not used for
 * that beat — the table is — and why is recorded (plan_layout.rejected, logged by render-and-qa).
 * This is the grounding gate's pattern applied to layout: the planner decides, a choice that cannot
 * pass falls back, and every legal choice is the planner's. (CI runs 37707115528, 37708554035,
 * 37715658530: planner layouts rendered and failed canvas-coverage / zones / canvas-fit — the video
 * was lost, not just the beat.)
 */
// ── CHROME (owner, 2026-10-08 "kill the template") ─────────────────────
// The corner label (kicker + hairline rule), the bottom phrase (the live word caption) and the
// label + headline + phrase chassis were drawn on nearly every beat — the device a viewer could
// name. Chrome is now the PLANNER's, per beat, and absent unless it asks:
//   label:       { text, position: "top-left" | "top-right" | "beside-headline" | "bottom-left" } —
//                a dateline or an attribution; null = no label, no rule.
//   pull_phrase: { text, position: "top" | "middle" | "bottom", case: "as-written" | "upper",
//                tone: "ink" | "accent" } — a phrase worth pulling; null = none (no live caption).
// Code only removes chrome that breaks the three-beat window rule (scripts/template-check.js);
// it never adds any.
export const LABEL_POSITIONS = ["top-left", "top-right", "beside-headline", "bottom-left"];
export const PULL_POSITIONS = ["top", "middle", "bottom"];
const chromeIn = (c) => ({ ...c, lead_in: c?.label?.text ? String(c.label.text) : null });
function finalizeChrome(L, c) {
  const boxes = { ...L.boxes };
  delete boxes.folio;
  const label = c?.label?.text ? c.label : null;
  // The hairline rule is kept only where Layer 1's canvas-coverage needs it: a statement alone
  // spans ~12% of the frame, and the rule at the top is what carries a type-led beat to the 60%
  // span (test-canvas-layout.mjs "TYPE-FULL [no header]"). Without a label it goes from every
  // beat whose content spans 60% without it — photo, chart, map, number beats.
  if (boxes.rule && !label) {
    const without = { ...L, boxes: Object.fromEntries(Object.entries(boxes).filter(([k]) => k !== "rule" && k !== "kicker")) };
    // A full-bleed photo is the whole frame; anything else must span 62% without the rule (the
    // table's own box margin over Layer 1's 60%, test-canvas-layout.mjs 61%).
    const fullBleed = !!boxes.photo && FULL_PHOTO_COMPS.includes(L.composition);
    if (!boxes.rule.keep && (fullBleed || (contentBounds(without)?.h ?? 0) / 1920 >= 0.62)) delete boxes.rule;
  }
  if (!label && !boxes.kicker?.subject) delete boxes.kicker;
  else if (label && boxes.kicker) {
    const k = boxes.kicker, pos = LABEL_POSITIONS.includes(label.position) ? label.position : "top-left";
    const head = boxes.headline || boxes.statement;
    if (pos === "top-right") boxes.kicker = { ...k, x: 1032 - k.w, align: "right" };
    else if (pos === "top-left") boxes.kicker = { ...k, x: 48, align: "left" };
    else if (pos === "bottom-left") boxes.kicker = { ...k, x: 48, y: 1368, align: "left" };
    else if (pos === "beside-headline" && head && head.x + head.w + 32 + k.w <= 1032 && head.y + k.h <= HEADER_MAX_Y) boxes.kicker = { ...k, x: head.x + head.w + 32, y: head.y + 8, align: "left" };
    // A label that lands ON the headline (board 37925838913 ch-6 beat 2: "HAMILTON COUNTY" top-left over a
    // TYPE-SPLIT's top-left "Highway", canvas-fit) goes under the headline, else to the other top corner.
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    if (head && head.w && boxes.kicker && hit(boxes.kicker, head)) {
      const kk = boxes.kicker, below = head.y + head.h + (head.desc || 0) + 18;
      const right = { ...kk, x: 1032 - kk.w, align: "right" }, left = { ...kk, x: 48, align: "left" };
      if (below + kk.h <= HEADER_MAX_Y) boxes.kicker = { ...kk, y: below };
      else if (!hit(kk.align === "left" ? right : left, head)) boxes.kicker = kk.align === "left" ? right : left;
    }
  }
  let pull = null;
  const pp = c?.pull_phrase?.text ? c.pull_phrase : null;
  if (pp) {
    const text = pp.case === "upper" ? String(pp.text).toUpperCase() : String(pp.text);
    const f = fitText(text, 880, { max: 58, min: 34, maxLines: 2, lineH: 1.18, weight: 700 });
    const w = Math.min(880, Math.max(...f.lines.map((l) => textWidth(l, f.size, false, 700)))) + 2, h = f.lines.length * f.size * 1.18;
    const head = boxes.headline || boxes.statement;
    const middleFree = !flattenBoxes(boxes).some(([k, b]) => elementType(k, b) && zonesOf(b).includes("middle"));
    let pos = PULL_POSITIONS.includes(pp.position) ? pp.position : "bottom";
    let y = CAPTION.y;
    if (pos === "top") { y = head ? head.y + head.h + 28 : TOP + 40; if (y + h > HEADER_MAX_Y) pos = "bottom"; }
    if (pos === "middle") { if (middleFree) y = 900; else pos = "bottom"; }
    if (pos === "bottom") y = CAPTION.y;
    const x = L.flip && pos !== "middle" ? 1032 - w : 48;
    pull = { x, y, w, h, size: f.size, lines: f.lines, position: pos, tone: pp.tone === "accent" ? "accent" : "ink", align: x > 48 ? "right" : "left", role: "data" };
  }
  return { ...L, boxes, pull };
}

export function canvasLayout(c) {
  return finalizeChrome(layoutCore(chromeIn(c)), c);
}
function layoutCore(c) {
  const table = tableLayout(c);
  if (!c?.layout) return { ...table, layout: null };
  // A shot IS the beat's arrangement (the planner chose it): its grid layout would move the shot's
  // photo / object out of the frame division it names. Recorded as not used, with the reason.
  if (SHOT_COMPOSITIONS.includes(table.composition)) return { ...table, layout: { used: false, axes: null, moved: [], rejected: [`shot: ${table.composition} is the beat's arrangement`] } };
  const base = new Set(layoutViolations(table).map((v) => v.rule));
  const tablePos = new Map(flattenBoxes(table.boxes).map(([k, b]) => [k, `${b.x},${b.y}`]));
  // Boxes overstate ink (line height, padding), so a planned layout keeps within 1 point of the default's
  // own box span while that is under 66%. CI run 37743696701 beat 1: box span 60.3% passed the 60% box
  // rule; the rendered pixels spanned 58.9% and canvas-coverage failed the video (default: 63.0%).
  const spanOf = (L) => (L.boxes?.photo ? null : (contentBounds(L)?.h ?? 0) / 1920);
  const tSpan = spanOf(table);
  // The planner's layout on both axes; if that breaks a Layer 1 rule the table keeps, its horizontal
  // placement alone (the table's vertical kept), then its vertical alone — before the whole beat goes
  // to the table. Most fallbacks were vertical (CI run 37723570093: a headline centred or dropped into
  // row 1 broke the 60% span or put two kinds in one zone) while the planner's sides and columns were
  // legal; throwing both away drew the table where the planner's arrangement could have stood.
  const attempt = (axes, yBlend = 1) => {
    const L = tableLayout(c);
    const applied = applyPlanLayout(L.boxes, c.layout, { hero: L.hero, axes, yBlend });
    const added = layoutViolations(L).filter((v) => !base.has(v.rule));
    const ps = spanOf(L);
    if (tSpan !== null && ps !== null && ps < Math.min(tSpan, 0.66) - 0.01) added.push({ rule: "span-margin", detail: `content spans ${(ps * 100).toFixed(1)}% of the height by its boxes, the default ${(tSpan * 100).toFixed(1)}% — kept within 1 point of the default` });
    const moved = flattenBoxes(L.boxes).filter(([k, b]) => tablePos.get(k) !== `${b.x},${b.y}`).map(([k]) => k);
    return { L, applied, added, moved };
  };
  const full = attempt("xy");
  if (!full.added.length) return { ...full.L, layout: { ...full.applied, used: true, axes: "xy", moved: full.moved, rejected: [] } };
  const rejected = full.added.map((v) => `${v.rule}: ${v.detail}`);
  // The planner's horizontal placement, and its vertical placement moved toward the default only as
  // far as the rules need — the nearest legal position to what it asked for (y_blend = the share of
  // the planned vertical move kept). CI run 37739128920: two NUMBER-FULL beats went wholly to the
  // table because the planned vertical missed the 60% span by 2.3% (beat 0) or dropped the headline
  // into the number's zone (beat 4), while their horizontal placement was the planner's.
  for (let k = 9; k >= 1; k--) {
    const part = attempt("xy", k / 10);
    if (!part.added.length && part.moved.length) return { ...part.L, layout: { ...part.applied, used: true, axes: "xy", y_blend: k / 10, moved: part.moved, rejected } };
  }
  for (const axes of ["x", "y"]) {
    const part = attempt(axes);
    if (!part.added.length && part.moved.length) return { ...part.L, layout: { ...part.applied, used: true, axes, moved: part.moved, rejected } };
  }
  return { ...table, layout: { ...full.applied, used: false, axes: null, moved: [], rejected } };
}

const TEXT_ROLES_L1 = new Set(["headline", "number", "data", "emphasis"]);
const TEXT_KEYS_L1 = ["kicker", "headline", "statement", "number", "label", "emphasis"];
const COVER_MIN_L1 = 0.6;
/**
 * The geometric rules Layer 1 (local-audit.cjs) audits, read from the boxes: zoneReport (one zone
 * per element, one element type per zone), canvas-fit's text overlap, canvas-type's centre line
 * (|centre - 540| < 24 px on a box under 700 px wide), canvas-coverage's 60% span. Boxes, not
 * pixels: the audit's pixel checks remain the authority; this only keeps a planned layout from
 * walking into a rule the table already keeps.
 */
export function layoutViolations(L) {
  const out = [];
  const z = zoneReport(L);
  if (!z.ok) out.push({ rule: "zones", detail: [...z.spans, ...z.clashes].join("; ") });
  const flat = flattenBoxes(L.boxes || {}).filter(([, b]) => b && b.w > 0 && b.h > 0);
  const texts = flat.filter(([k, b]) => TEXT_ROLES_L1.has(b.role) || TEXT_KEYS_L1.includes(k.replace(/\d+$/, "")));
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const [ka, a] = texts[i], [kb, b] = texts[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push({ rule: "overlap", detail: `${ka} and ${kb}` });
  }
  for (const [k, b] of flat) {
    // A statement set centred on purpose — TYPE-FULL and the words-only cards (C.1, extended to the
    // cards 2026-10-09) — is on the centre line by design; Layer 1 canvas-type refuses two in a row.
    const byDesign = k === "statement" && b.align === "center" && (L.composition === "TYPE-FULL" || TYPE_CARD_COMPS.includes(L.composition));
    if (["headline", "statement", "number", "emphasis"].includes(k) && !b.rotate && !byDesign && Math.abs(b.x + b.w / 2 - 540) < 24 && b.w < 700) out.push({ rule: "centred", detail: `${k} on the centre line` });
  }
  const cb = L.boxes?.photo ? null : contentBounds(L);
  if (cb && cb.h / 1920 < COVER_MIN_L1) out.push({ rule: "span", detail: `content spans ${(cb.h / 19.2).toFixed(1)}% of the height` });
  return out;
}

/**
 * The ink's extent of a cutout drawn `a` px wide and rotated `deg` (rising to the right) about its
 * centre, from its ink outline (v.ink.pts, scripts/cutout-ink.mjs; the PNG's corners without one).
 */
export function inkExtent(v, a, deg) {
  const r = Math.max(0.2, Math.min(5, (v.w || 1) / (v.h || 1)));
  const pts = Array.isArray(v.ink?.pts) && v.ink.pts.length ? v.ink.pts : [[0, 0], [1, 0], [0, 1], [1, 1]];
  const t = (deg * Math.PI) / 180, co = Math.cos(t), si = Math.sin(t), ih = a / r;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [fx, fy] of pts) {
    const px = (fx - 0.5) * a, py = (fy - 0.5) * ih, X = px * co + py * si, Y = -px * si + py * co;
    x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
  }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
}

/**
 * One hero object placed by its INK (the box is the ink's box, `img` the image rectangle relative
 * to it, as the TYPE-FULL hero is): as large as fits maxW x maxH at `deg`, its ink standing on
 * `floor`, against `side` ("left" | "right" | "center") of [x0, x1]. A logo, a bill or a drawn
 * symbol is never tilted (owner's spec 2026-10-03, parts B and G; symbols draw upright).
 */
function placeHero(v, { maxW, maxH, deg = 0, floor, x0 = L_EDGE + 12, x1 = R_EDGE - 12, side = "center" }) {
  const upright = !!(v.logo || v.money) || v.class !== "cutout" || !v.asset;
  const d = upright ? 0 : deg;
  const r = Math.max(0.2, Math.min(5, (v.w || 1) / (v.h || 1)));
  const u = inkExtent(v, 1, d);
  const a = Math.min(maxW / u.w, maxH / u.h, (x1 - x0) / u.w);
  const e = inkExtent(v, a, d), ih = a / r;
  const bw = Math.round(e.w), bh = Math.round(e.h);
  const bx = side === "left" ? x0 : side === "right" ? x1 - bw : Math.round((x0 + x1 - bw) / 2);
  const by = Math.round(floor - bh);
  const icx = bx + bw / 2 - (e.x0 + e.x1) / 2, icy = by + bh / 2 - (e.y0 + e.y1) / 2;
  return { ...box(bx, by, bw, bh), role: "concept", concept: v.name, class: v.class, asset: v.asset || null, align: side, logo: !!v.logo, money: !!v.money,
    ...(v.asset && v.class === "cutout" ? { img: [Math.round(icx - a / 2 - bx), Math.round(icy - ih / 2 - by), Math.round(a), Math.round(ih)] } : {}), ...(d ? { tilt: d } : {}) };
}

/**
 * The shot compositions (SHOT_COMPOSITIONS), laid out. Each keeps Layer 1's geometry by
 * construction — one element type per zone, nothing across y 620 / 1340 but a full-bleed photo,
 * text never centred, content spanning >= 60% of the height — because a shot that breaks a gate is
 * a wrong render, not a reason to loosen the gate. The photo is the `photo` box (the one element
 * allowed to bleed off the frame, canvas-fit); `frame` names how it is drawn (full-canvas.jsx).
 */
function shotLayout(c, comp, flip) {
  const boxes = {};
  const text = String(c.headline || c.photo?.entity || "");
  const kick = c.lead_in ? String(c.lead_in) : null;
  // The header in the top band: an optional label, then the headline, on the `flip` side.
  const header = (width = 900, max = 150) => {
    // The hairline rule holds the frame's top, as on the content compositions: a one-line headline's
    // ink starts well under its box (board 37859862716 ch-2 PHOTO-CARD: 58.6% coverage without it).
    // finalizeChrome drops it wherever the content spans 62% without it.
    boxes.rule = { ...rule(flip, TOP), keep: true };
    if (kick) boxes.kicker = dataBox(kick, { width: 700, size: 34, maxLines: 1, y: TOP + 30, flip });
    const y = kick ? boxes.kicker.y + boxes.kicker.h + 22 : TOP + 38;
    boxes.headline = headlineBox(text, { width, y, flip, maxLines: 3, maxHeight: HEADER_MAX_Y - y, max });
  };
  // A photo's own proportions inside maxW x maxH (a person or a document is portrait-shaped).
  const fitPhoto = (maxW, maxH) => {
    const r = Math.max(0.4, Math.min(2.5, (Number(c.photo?.w) || 3) / (Number(c.photo?.h) || 4)));
    let w = maxW, h = Math.round(w / r);
    if (h > maxH) { h = maxH; w = Math.round(h * r); }
    return [w, h];
  };
  const person = c.photo?.view === "person" || c.photo?.kind === "person";
  const focus = person ? "50% 22%" : c.photo?.view === "document" ? "50% 0%" : "50% 40%";
  let hero = "photo";
  if (comp === "PHOTO-BAND") {
    // Shot 2: the photo is a band across the CENTRE of the frame (owner, 2026-10-09: the visual is the hero,
    // never stranded in the top third) — it bleeds off both sides, y 640-1110, centred on y 875; the words
    // stand under it in the same middle band (zoneReport lets text and a visual share a zone).
    // The hairline rule holds the frame's top so the beat's content spans >= 60% of the height (canvas-coverage).
    boxes.rule = { ...rule(flip, TOP), keep: true };
    boxes.photo = { ...box(0, LOW_VISUAL.top, FRAME.w, LOW_VISUAL.h), frame: "band", focus };
    if (kick) boxes.kicker = dataBox(kick, { width: 700, size: 34, maxLines: 1, y: LOW_VISUAL.top + LOW_VISUAL.h + 20, flip });
    const top = kick ? boxes.kicker.y + boxes.kicker.h + 24 : LOW_VISUAL.top + LOW_VISUAL.h + 20;
    boxes.headline = headlineBox(text, { width: 940, bottom: BOTTOM - 12, flip, maxLines: 3, maxHeight: BOTTOM - 12 - top, max: 170 });
    hero = "headline";
  } else if (comp === "PHOTO-EDGE") {
    // Shots 5 / 25: the photo cropped by the frame edge opposite the headline's side.
    header(900, 150);
    const w = 700;
    boxes.photo = { ...box(flip ? 0 : FRAME.w - w, BODY_TOP - 6, w, 690), frame: "edge", side: flip ? "left" : "right", focus };
  } else if (comp === "PHOTO-CARD") {
    // Shots 4 / 19: a matted card with a soft shadow, centred, standing on the middle band's floor.
    header(984, 150);
    const [w, h] = fitPhoto(760, 660);
    boxes.photo = { ...box(Math.round((FRAME.w - w) / 2), 1312 - h, w, h), frame: "card", focus };
  } else if (comp === "PHOTO-INSET") {
    // Shot 18: a smaller rounded card with a hard offset shadow, on the side away from the headline.
    header(860, 140);
    const [w, h] = fitPhoto(560, 640);
    boxes.photo = { ...box(flip ? L_EDGE : R_EDGE - w - 14, 1300 - h, w, h), frame: "inset", focus };
  } else if (comp === "PHOTO-STRIP") {
    // Shot 17: a torn-paper strip across the middle band showing the photo; accent bars on its edges.
    header(984, 150);
    boxes.photo = { ...box(0, 800, FRAME.w, 524), frame: "strip", focus, seed: Number(c.beat_index) || 0 };
  } else if (comp === "SCENE-LOW") {
    // Shots 11 / 16: full bleed, the words low in the middle band over a darkened foot.
    boxes.photo = { ...box(0, 0, FRAME.w, FRAME.h), frame: "full", focus };
    // A label rides just above the words, so the top band stays the photo's (a "low" shot, TEXT_AT).
    const kb = kick ? dataBox(kick, { width: 700, size: 34, maxLines: 1, y: 0, flip }) : null;
    boxes.headline = headlineBox(text, { width: 920, bottom: BOTTOM - 12, flip, maxLines: 3, maxHeight: BOTTOM - 12 - BODY_TOP - (kb ? kb.h + 22 : 0), max: 180 });
    if (kb) boxes.kicker = { ...kb, y: boxes.headline.y - 22 - kb.h };
    hero = "photo";
  }
  return { composition: comp, boxes, hero, flip };
}

/**
 * WORDS-ONLY CARDS (TYPE_CARD_COMPS), the reference's type frames (docs/REFERENCE-SHOT-GRAMMAR.md):
 *   TYPE-TITLE       ref-03 0:02-0:10 ("MONEY", "ENDLESSLY", "FEW EVER SPEEK"): the words very large and
 *                    heavy, two lines, in the upper middle band; the planner's label (if any) as a
 *                    letterspaced strapline under them; a heavy accent bar on the band's floor.
 *   TYPE-CHAPTER     ref-01 0:14 "It made me wonder", ref-03 0:15 "they own it.": one SMALL line low on
 *                    one side, the frame otherwise empty; the label (if any) letterspaced above it.
 *   TYPE-DEFINITION  ref-01 0:20-0:26 (the page: "'Puck'" / TYPOGRAPHICAL ART / its paragraph): the words
 *                    as the term, a double rule, the beat's own sentence set as body text under it.
 * Every card keeps the hairline rule at the frame's top (keep: the span holds on pixels) and its words
 * in the middle band — none of them puts words in the top band. What varies beat to beat: the type
 * scale (very large / small / medium + body), the stroke (heavy bar / none / double hairline), the
 * negative space (dense / empty / packed), the accent (on the bar / on the label / on the rules), and
 * the side (`flip`). Nothing is added that the beat does not say: the strapline is the planner's label
 * or nothing, the body is the sentence itself.
 */
function typeCardLayout(c, comp, flip) {
  const boxes = {};
  const text = String(c.headline || "");
  const kick = c.lead_in ? String(c.lead_in) : null;
  boxes.rule = { ...rule(flip, TOP), keep: true };
  if (comp === "TYPE-TITLE") {
    boxes.statement = headlineBox(text, { width: 984, y: BODY_TOP + 30, flip, maxLines: 2, maxHeight: 560, max: 260, tier: false, center: true });
    if (kick) boxes.kicker = dataBox(kick, { width: 700, size: 30, maxLines: 1, y: boxes.statement.y + boxes.statement.h + (boxes.statement.desc || 0) + 28, center: true });
    // The heavy accent bar on the middle band's floor (stroke: thick).
    boxes.bar = { ...box(Math.round((FRAME.w - 420) / 2), BOTTOM - 30, 420, 18), role: "rule", anchor: "center", accent: true };
  } else if (comp === "TYPE-CHAPTER") {
    const kb = kick ? dataBox(kick, { width: 600, size: 28, maxLines: 1, y: 0, center: true }) : null;
    boxes.statement = headlineBox(text, { width: 760, bottom: BOTTOM - 12, flip, maxLines: 2, maxHeight: 200, max: 68, min: 48, tier: false, center: true });
    if (kb) boxes.kicker = { ...kb, y: boxes.statement.y - 26 - kb.h };
  } else {
    // TYPE-DEFINITION: the term, the double rule, the sentence as body text.
    boxes.statement = headlineBox(text, { width: 940, y: BODY_TOP + 20, flip, maxLines: 2, maxHeight: 300, max: 150, tier: false, center: true });
    const ry = boxes.statement.y + boxes.statement.h + (boxes.statement.desc || 0) + 26;
    boxes.rule_a = { ...box(L_EDGE, ry, R_EDGE - L_EDGE, 3), role: "rule", accent: true };
    boxes.rule_b = { ...box(L_EDGE, ry + 10, R_EDGE - L_EDGE, 3), role: "rule", accent: true };
    const sentence = String(c.sentence || "").trim();
    const room = BOTTOM - 12 - (ry + 40);
    const f = fitText(sentence, 940, { max: 46, min: 32, maxLines: 7, maxHeight: room, lineH: 1.32, weight: 400 });
    const w = Math.min(940, Math.max(0, ...f.lines.map((l) => textWidth(l, f.size, false, 400)))) + 2;
    const h = Math.round(f.lines.length * f.size * 1.32);
    // "lead_" so the zone bookkeeping counts it as text, as the name card's key phrase is.
    if (f.lines.length && h <= room) boxes.lead_body = { ...box(Math.round((FRAME.w - w) / 2), BOTTOM - 12 - h, w, h), size: f.size, lines: f.lines, align: "center", role: "data", body: true };
  }
  return { composition: comp, boxes, hero: "statement", flip };
}

/**
 * NUMBER-STAT (ref-02 "You're Making / 1 MILLION / dollar", ref-01 "1881", "Then, in 1998"): the figure is
 * the visual — the number layout with no headline, the figure filling the middle band over its label
 * (the supporting line), the planner's label (if any) letterspaced in the top band.
 */
function statCardLayout(c, flip) {
  const base = tableLayout({ ...c, composition: "NUMBER-FULL", headline: null, headline_zone: "top", chart_zone: "middle" });
  const boxes = { ...base.boxes };
  delete boxes.headline;
  boxes.rule = { ...rule(flip, TOP), keep: true };
  if (c.lead_in) boxes.kicker = dataBox(String(c.lead_in), { width: 700, size: 30, maxLines: 1, y: TOP + 30, flip });
  return { composition: "NUMBER-STAT", boxes, hero: "number", flip };
}

// CAMERA (owner, 2026-10-09: "real camera moves of 8% or more", photos and graphs only; full-canvas.jsx).
// A photo pushes in `photo` (1.00 -> 1.10); a graph grows from 1/(1+graph) to its laid-out size about its
// floor. `endAt`: the move eases over the first 90% of the beat. The manifest declares each beat's move.
export const CAMERA = Object.freeze({ photo: 0.10, graph: 0.10, endAt: 0.9, min: 0.08 });
// The visual of a "words low" arrangement (owner, 2026-10-09: "the visual is the hero of the beat ... not a strip at
// the top"): a band across the upper MIDDLE band — y 640-1110, centred on 875 — with its words under it in the same
// band. zoneReport lets a visual and text share a zone; text-on-text overlap and the safe area are unchanged.
export const LOW_VISUAL = Object.freeze({ top: 640, h: 470 });
const HERO_FLOOR = 1296;
// A bill / coin stands on y 1310, not 1330: its 20 px drop shadow reads as ink and crossed the middle band's edge at
// y 1340 in 466 columns (board 37901614633 ch-1 beat 5, zones-no-overlap). 1310 keeps the beat's span above 60%.
const MONEY_FLOOR = 1310;
/** HERO-LOW / HERO-SCATTER / HERO-OVER: the TYPE-FULL hero beat, its object re-placed. */
function heroShotLayout(c, comp, flip) {
  const base = tableLayout({ ...c, composition: "TYPE-FULL", emphasis_beat: false, vertical: false });
  const cv = (c.concept_visuals || []).filter(Boolean);
  if (!base.boxes.cutout0 || !cv.length) return { ...base, composition: comp };
  const boxes = { ...base.boxes };
  delete boxes.cutout0; delete boxes.cutout1; delete boxes.cutout2; delete boxes.cutout_name;
  const text = String(c.headline || "");
  // The object's side is away from the headline's.
  const away = flip ? "left" : "right", near = flip ? "right" : "left";
  if (comp === "HERO-OVER") {
    // Shot 1, its lower words (ref-01 0:04): the object in the top band, the words under it in the
    // middle band — the top band holds no text.
    delete boxes.kicker; delete boxes.statement;
    // The hairline rule holds the frame's top (not text — the top band still has no words): a wide
    // object's ink started low and the beat's pixels spanned 59.0% (board 37866941228 ch-2 beat 8).
    // keep: the object's ink extent is not its box — finalizeChrome must not drop it.
    boxes.rule = { ...rule(flip, TOP), keep: true };
    // The object is the hero, centred in the frame's upper middle (y ~660-1100), its words under it (owner, 2026-10-09).
    const under = LOW_VISUAL.top + LOW_VISUAL.h + 20;
    if (c.lead_in) boxes.kicker = dataBox(String(c.lead_in), { width: 700, size: 34, maxLines: 1, y: under, flip });
    const top = boxes.kicker ? boxes.kicker.y + boxes.kicker.h + 22 : under;
    boxes.statement = headlineBox(text, { width: 940, bottom: BOTTOM - 12, flip, maxLines: 3, maxHeight: BOTTOM - 12 - top, max: 170 });
    // Its ink stands 34 px above the band's floor: the drop shadow (20 px blur) must not reach the words under it.
    boxes.cutout0 = { ...placeHero(cv[0], { maxW: 940, maxH: 440, floor: LOW_VISUAL.top + LOW_VISUAL.h - 10, side: "center" }), primary: true };
  } else if (comp === "HERO-LOW") {
    // Shot 8: a short line high up, air, then the object large on the middle band's floor.
    const y = boxes.kicker ? boxes.kicker.y + boxes.kicker.h + 22 : TOP + 6;
    boxes.statement = headlineBox(text, { width: 760, y, flip, maxLines: 2, maxHeight: Math.min(300, HEADER_MAX_Y - y), max: 104 });
    // The ink stands on y 1296, as the TYPE-FULL hero's does: its drop shadow (20 px blur) reads as ink
    // and crossed y 1340 from a 1326 floor (shot-proof run 37859081660, zones-no-overlap, 143 columns).
    boxes.cutout0 = { ...placeHero(cv[0], { maxW: 940, maxH: 650, floor: HERO_FLOOR, side: "center" }), primary: true };   // centred (owner, 2026-10-09: the visual is the hero)
  } else {
    // Shot 13: the objects off-centre at opposing angles; a second object smaller, high on the other side.
    const tilt = flip ? 9 : -9;
    boxes.cutout0 = { ...placeHero(cv[0], { maxW: cv[1] ? 560 : 640, maxH: 600, deg: tilt, floor: HERO_FLOOR, side: away }), primary: true };
    if (cv[1]) {
      const second = placeHero(cv[1], { maxW: 400, maxH: 360, deg: -tilt, floor: BODY_TOP + 380, side: near });
      // Kept only where it stays clear of the first object's box.
      const a = boxes.cutout0, b = second;
      if (!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) && b.y >= BODY_TOP) boxes.cutout1 = second;
    }
  }
  return { composition: comp, boxes, hero: "cutout0", flip };
}

function tableLayout(c) {
  MARKS = Array.isArray(c?.emphasis_words) ? c.emphasis_words : c?.emphasis_word ? [c.emphasis_word] : [];
  BEAT_HERO = !!c?.hero_headline;
  BEAT_MAX = HEADLINE_STEPS[((Number(c?.variant) || 0) % HEADLINE_STEPS.length + HEADLINE_STEPS.length) % HEADLINE_STEPS.length];
  const comp = c?.composition || compositionFor(c?.visual_type, !!c?.photo);
  const vt = String(c?.visual_type || "TYPE").toUpperCase();
  const flip = (Number(c?.variant) || 0) % 2 === 1 ? 1 : 0;
  // A shot composition draws only the content it frames (shotComposition); without it the
  // content's own composition stands — never an empty frame.
  if (FRAMED_PHOTO_COMPS.includes(comp) || comp === "SCENE-LOW") {
    if (c?.photo) return shotLayout(c, comp, flip);
    return tableLayout({ ...c, composition: compositionFor(c?.visual_type, false) });
  }
  if (HERO_COMPS.includes(comp)) return heroShotLayout(c, comp, flip);
  if (TYPE_CARD_COMPS.includes(comp)) return typeCardLayout(c, comp, flip);
  if (comp === "NUMBER-STAT") return statCardLayout(c, flip);
  const boxes = {};
  let hero = null;

  if (comp === "TYPE-FULL" || comp === "NUMBER-FULL" || comp === "TYPE-SPLIT") {
    const folio = c?.lead_in ? null : folioOf(c);
    const split = comp === "TYPE-SPLIT" ? splitHeadline(c?.headline) : null;
    if (split) {
      // The statement in two: the first half top, the second bottom, on opposite sides.
      const opp = flip ? 0 : 1;
      boxes.headline = headlineBox(split[0], { width: 640, y: TOP, flip, maxLines: 3, maxHeight: HEADER_MAX_Y - TOP, max: 200 });
      // The second half is the middle zone's subject: up to 360 px across the
      // full width. At 760 px / max 200 a short half ("the rule") filled 154 of
      // the zone's 720 rows (CI run 36995441688 ch-44 beat 7) — an empty middle.
      boxes.statement = headlineBox(split[1], { minLines: 2, width: BEAT_HERO ? 984 : SUBJECT_W, bottom: BOTTOM, flip: opp, maxLines: 3, maxHeight: Math.floor((BOTTOM - BODY_TOP) * 0.94), max: 360, hero: true });
      const kk = c?.lead_in || folio;
      if (kk) boxes.kicker = dataBox(kk, { width: 300, size: 34, maxLines: 1, y: TOP + 10, flip: opp });
      hero = "statement";
    } else if (vt === "COUNTER" && c?.data?.value) {
      const parts = numberParts(c.data.value);
      // Kinetic scale: as large as the frame allows. The digits are never
      // cropped (a cropped digit misstates the figure); the trailing unit
      // ("%", "M", "B") may run off the frame edge by up to half its width.
      // The scale word once ("$127 million" + label "million Ponzi scheme").
      const lab = String(c.data.label || "").trim();
      const label = parts.scaleWord && lab.toLowerCase().startsWith(parts.scaleWord) ? lab : [parts.scaleWord, lab].filter(Boolean).join(" ");
      const LABEL_BLOCK = label ? 130 : 0;                                  // 2 lines of 40 px data type + the 28 px gap
      // Zones (the planner's headline_zone / chart_zone): the number in the
      // middle zone under a top headline, or — headline_zone "middle" — the
      // number in the top zone over a middle headline. `variant` only mirrors.
      const swap = !!c.headline && c.headline_zone === "middle" && c.chart_zone === "top";
      // swap (FIGURE-LOW): the number in the upper part of the MIDDLE band (y 650-1110), its headline under
      // it — never stranded in the top third (owner, 2026-10-09).
      const roomH = swap ? LOW_VISUAL.h - 10 - (c.number_label_off ? 0 : LABEL_BLOCK) : BOTTOM - BODY_TOP - LABEL_BLOCK;
      const fit = fitNumberBleed((s) => numberSlots(parts, s), R_EDGE - L_EDGE, { max: Math.min(1100, Math.floor(roomH / (ROLE_NUMBER.lineHeight + NUM_DESC))), min: 96 });
      const size = fit.size;
      const nw = Math.ceil(fit.width);
      const nh = Math.round(size * ROLE_NUMBER.lineHeight);
      const nx = Math.max(L_EDGE, anchorX(nw, flip));
      const bleed = Math.max(0, nx + nw - R_EDGE);      // wider than the frame: digits start at the left margin, the unit bleeds off the right
      if (!swap) {
        // headline in the top zone (or a hairline rule when there is none),
        // the hero number at the middle zone's bottom, its label just above it
        if (c.headline) boxes.headline = headlineBox(c.headline, { width: 900, y: TOP, flip, maxLines: 3, maxHeight: HEADER_MAX_Y - TOP, max: 200 });
        else boxes.rule = rule(flip, TOP);
        // The middle zone's FLOOR is held by something whose ink is predictable — the label
        // (caps Inter, bottom-anchored on y 1340), or with no label a hairline rule there — and
        // the figure stands above it at its worst-case depth (numberInk, 0.94 em). The figure
        // used to hold the floor itself, and its ink depth is not one number: "7515" ended at
        // 0.805 em below its box top (CI run 37149091704 ch-2, coverage 58.9-59.2%), "30" / "16"
        // at 0.92 em (run 37152783591 ch-48, crossed y 1340 once anchored at 0.81). Anchored
        // for the deep case the shallow one left the beat under 60%; anchored for the shallow
        // case the deep one crossed into the caption zone.
        const ink = numberInk(c.data.value, size);
        if (label) {
          boxes.label = dataBox(label, { width: 620, size: 40, maxLines: 2, x: flip ? undefined : nx, bottom: BOTTOM, flip });   // right-anchored when the number is (it ran off the frame: CI run 36947929123 ch-44)
          boxes.number = { ...box(nx, boxes.label.y - 28 - ink, nw, ink), size, parts, align: flip ? "right" : "left", role: "number", flip, bleed };
        } else {
          boxes.floor_rule = rule(flip, BOTTOM - 6);
          boxes.number = { ...box(nx, BOTTOM - 6 - 28 - ink, nw, ink), size, parts, align: flip ? "right" : "left", role: "number", flip, bleed };
        }
      } else {
        // the hero number in the top zone, its label under it; the headline at the middle zone's bottom
        boxes.rule = rule(flip, TOP);
        boxes.number = { ...box(nx, LOW_VISUAL.top + 10, nw, nh), size, parts, align: flip ? "right" : "left", role: "number", flip, bleed };
        // FIGURE-LOW (render-time shot, Gemini's pick): the number alone in the upper middle band (centred on
        // ~880), no words in the top band — its small caption label is left out.
        if (label && !c.number_label_off) boxes.label = dataBox(label, { width: 620, size: 40, maxLines: 2, y: boxes.number.y + nh + 28, flip });
        // Its headline under the number in the same band.
        boxes.headline = headlineBox(c.headline, { width: 940, bottom: BOTTOM - 12, flip, maxLines: 3, maxHeight: BOTTOM - 12 - (boxes.label ? boxes.label.y + boxes.label.h + 16 : boxes.number.y + boxes.number.h + 24), max: 170 });
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
        if (text) boxes.headline = headlineBox(text, { width: 700, y: TOP + 40, flip, maxLines: 3, maxHeight: HEADER_MAX_Y - TOP - 40, max: 120 });
        // Anchored on the word's REAL descender: descOffset reserves 0.3 em, but Fraunces' "p"
        // ends ~0.15 em under the baseline — the ink stopped at y 1275 and the beat spanned
        // 59.5% (CI run 37126933290 ch-44 beat 4). 0.17 em keeps the ink inside the zone.
        const eDesc = /[gjpqy]/.test(shown) ? Math.ceil(emph.size * 0.17) : 0;
        boxes.emphasis = { ...box(anchorX(ew, flip ? 0 : 1), BOTTOM - eh - eDesc, ew, eh), desc: eDesc, size: emph.size, text: shown, align: flip ? "left" : "right", role: "emphasis" };
        hero = "emphasis";
      } else if (c?.vertical) {
        // One beat a video: the statement rotated 90 degrees along the left edge.
        const st = fitHeadline(text, BOTTOM - BODY_TOP, { maxLines: 1, max: 200, min: 96 });   // the rotated line's length is its height: the middle zone
        const tw = Math.ceil(measure(st.lines[0] || "", st.size, { family: ROLE_HEADLINE.family, weight: ROLE_HEADLINE.weight, tracking: ROLE_HEADLINE.tracking }));
        const th = Math.round(st.size * ROLE_HEADLINE.lineHeight);
        boxes.rule = rule(1, TOP);
        if (c?.lead_in || folio) boxes.kicker = dataBox(c.lead_in || folio, { width: 560, size: 34, maxLines: 1, y: TOP + 24, flip: 1 });
        boxes.statement = { ...box(L_EDGE, BOTTOM - tw, th, tw), size: st.size, lines: st.lines, align: "left", role: "headline", rotate: -90, textW: tw };
        hero = "statement";
      } else {
        // A statement, bottom-anchored, on one side; a rule (and the lead-in
        // as a small label) at the top: the empty middle is the composition.
        const cv = Array.isArray(c?.concept_visuals) ? c.concept_visuals.slice(0, 2) : [];
        boxes.rule = rule(flip ? 0 : 1, TOP);
        if (c?.lead_in || folio) {
          // With a hero cutout the kicker is small and muted (owner's spec 2026-10-02: 24-32 px).
          boxes.kicker = { ...dataBox(c.lead_in || folio, { width: 640, size: cv.length ? 28 : 34, maxLines: 1, y: TOP + 30, flip: flip ? 0 : 1 }), muted: !!cv.length };
        }
        if (c?.name_card?.name && !cv.length) {
          // A named person / place / building / organization with no verified
          // photo in any source (owner's scene-resolver spec 2026-10-02, task
          // 4.3): its NAME large in the middle zone, the sentence's number or
          // key phrase below it — never a stand-in photo, and never an empty
          // middle zone.
          const sub = String(c.name_card.sub || "").trim();
          const subBox = sub ? dataBox(sub, { width: 900, size: 40, maxLines: 2, bottom: BOTTOM, flip }) : null;
          const floor = subBox ? subBox.y - 28 : BOTTOM;
          boxes.statement = headlineBox(c.name_card.name, { width: 984, bottom: floor, flip, maxLines: 3, maxHeight: floor - BODY_TOP, max: 240, tier: false });
          // "lead_" so the zone bookkeeping counts it as text (elementType ^lead).
          if (subBox) boxes.lead_phrase = { ...subBox, role: "data" };
          hero = "statement";
        } else if (cv.length) {
          // THE CUTOUT IS THE HERO (owner's spec 2026-10-02): the object the
          // sentence names is the subject; the type supports it.
          //   top zone     kicker (28 px, muted) + headline (90-140 px serif)
          //   middle zone  the cutout, centred on x 540, 500-700 px on its
          //                longest side; two cutouts side by side (primary
          //                left 500-700, secondary right 300-450), never stacked
          //   bottom zone  the caption
          // Vertical centre: as low as fits in 980-1060 (the spec's y 980
          // +- 80): its ink must reach ~y 1272 for canvas-coverage. A wide
          // object (a gavel, a banknote) grows past 700 px — up to 944 —
          // until it is >= 450 px tall; never smaller than the spec.
          const sy = (boxes.kicker ? boxes.kicker.y + boxes.kicker.h : TOP + 6) + 32;
          boxes.statement = headlineBox(text, { width: 984, y: sy, flip, maxLines: 3, maxHeight: HEADER_MAX_Y - sy, max: 140 });
          const ar = (v) => Math.max(0.2, Math.min(5, (v.w || 1) / (v.h || 1)));
          // fit: inside maxW x maxH; a wide object may widen up to `widen` px to reach minH.
          const fit = (v, maxW, maxH, minH = 0, widen = maxW) => {
            const r = ar(v);
            let w = Math.min(maxW, maxH * r), h = w / r;
            if (h < minH) { h = Math.min(maxH, minH); w = Math.min(widen, h * r); h = w / r; }
            return [Math.round(w), Math.round(h)];
          };
          const centreY = (h) => Math.round(Math.max(980, Math.min(1060, BOTTOM - 10 - h / 2)));
          // Two side by side only when each stays in its half and the pair is
          // tall enough to fill the zone; otherwise the primary alone is the hero.
          const pair = cv.length === 2 ? [fit(cv[0], 480, 640), fit(cv[1], 420, 450)] : null;
          const pairOk = pair && Math.max(pair[0][1], pair[1][1]) >= 440 && pair[0][1] >= 300 && Math.max(pair[0][0], pair[0][1]) >= 480;
          if (!pairOk) {
            // Sized and placed by the cutout's INK (v.ink, scripts/cutout-ink.mjs),
            // not its PNG rectangle: the frame checks measure ink, and a PNG's
            // transparent margin left a tilted banknote's ink 94 px short of
            // its box (local QA render 2026-10-02). With no ink outline the
            // rectangle's corners stand in. The box is the ink's box; `img` is
            // the image rectangle relative to it.
            // 12 px inside each margin: the 20 px drop shadow ran 4 px past R_EDGE on a full-width cutout.
            const v = cv[0], r = ar(v), W = R_EDGE - L_EDGE - 24;
            const ext = (a, deg) => inkExtent(v, a, deg);
            // 470 px of ink centred at most at y 1060 reaches y 1295; canvas-coverage needs ~1272.
            const MIN_H = 470;
            const u0 = ext(1, 0);
            // Upright: the longest ink side up to 700 inside 984 x 640; a wide object widens to 984 to reach MIN_H.
            let deg = 0, crop = false, a = Math.min(700 / Math.max(u0.w, u0.h), 640 / u0.h);
            if (u0.h * a < MIN_H) a = Math.min(MIN_H / u0.h, W / u0.w, 640 / u0.h);
            // A logo or a bill / coin (owner's spec 2026-10-03, parts B and G) is never tilted or
            // cropped: upright, whole, as large as fits (a logo within 900 x 560), standing on the
            // middle zone's floor so a wide wordmark or bill still reaches it (canvas-coverage).
            const flatHero = !!(v.logo || v.money);
            if (flatHero) a = v.logo ? Math.min(900 / u0.w, 560 / u0.h) : Math.min(W / u0.w, 640 / u0.h);
            if (!flatHero && u0.h * a < MIN_H - 1) {
              // Still under 470 px tall at full width: a door key was 378 px and
              // the beat's content stopped at 57.9% of the frame (CI run
              // 36999095271 ch-48 beat 2). A scene with a horizon (a skyline, a
              // road) grows past the frame and is cropped at the sides, never
              // tilted; an object is set on the smallest diagonal (12-30 deg)
              // that reaches MIN_H. Never shrunk.
              const LEVEL = /skyline|landscape|horizon|road|street|highway|bridge|train|river|coast|beach|mountain|field|crowd|city|town|village|harbou?r|port/;
              if (LEVEL.test(String(v.name || ""))) { crop = true; a = MIN_H / u0.h; }
              else for (const d of [12, 15, 18, 21, 24, 27, 30]) {
                const u = ext(1, d);
                deg = d; a = Math.min(W / u.w, 640 / u.h);
                if (u.h * a >= MIN_H) break;
              }
            }
            const e = ext(a, deg), ih = a / r, inkW = Math.min(W, e.w), cy = flatHero ? Math.round(Math.max(980, (v.logo ? 1270 : MONEY_FLOOR) - e.h / 2)) : centreY(e.h);
            const bx = Math.round(540 - inkW / 2), by = Math.round(cy - e.h / 2);
            const icx = 540 - (e.x0 + e.x1) / 2, icy = cy - (e.y0 + e.y1) / 2;   // the image's centre: its ink centred on (540, cy)
            // Part D.2 (logo): the company's name types on BELOW the logo — the logo stands 60 px
            // higher (floor 1270) and the name label sits under it, inside the middle zone.
            if (v.logo && v.name) boxes.cutout_name = dataBox(v.name, { width: 900, size: 34, maxLines: 1, y: 1290, flip });
            boxes.cutout0 = { ...box(bx, by, Math.round(inkW), Math.round(e.h)), role: "concept", concept: v.name, class: v.class, asset: v.asset || null, primary: true, align: "center", logo: !!v.logo, money: !!v.money,
              // [x, y, w, h] — an array, so flattenBoxes does not read it as an element box
              img: [Math.round(icx - a / 2 - bx), Math.round(icy - ih / 2 - by), Math.round(a), Math.round(ih)], ...(deg ? { tilt: deg } : {}), ...(crop ? { crop } : {}) };
          } else {
            const [[w0, h0], [w1, h1]] = pair;
            const cy = centreY(Math.max(h0, h1));
            boxes.cutout0 = { ...box(48 + (492 - w0) / 2, cy - h0 / 2, w0, h0), role: "concept", concept: cv[0].name, class: cv[0].class, asset: cv[0].asset || null, primary: true, align: "center" };
            boxes.cutout1 = { ...box(560 + (472 - w1) / 2, cy - h1 / 2, w1, h1), role: "concept", concept: cv[1].name, class: cv[1].class, asset: cv[1].asset || null, primary: false, align: "center" };
          }
          hero = "cutout0";
        } else {
          // The statement is the body: the middle zone only (it used to rise to y 430, through the top zone).
          // Part C.1 (owner's spec 2026-10-03): TYPE-FULL is the one centred composition — the
          // headline on the frame's axis, full width. The hairline rule (and folio) stays at the
          // top: without it a one-zone beat spans ~37% of the frame and fails canvas-coverage.
          // Part D.2: a thin rule draws under the statement at 60% of the beat — the statement
          // sits 26 px up so the rule stays inside the middle zone.
          boxes.statement = headlineBox(text, { minLines: 2, width: BEAT_HERO ? 984 : SUBJECT_W, bottom: BOTTOM - 26, flip, maxLines: 5, maxHeight: Math.floor((BOTTOM - BODY_TOP) * 0.94) - 26, max: 360, center: true, hero: true });
          if (boxes.statement.w) {
            const uw = Math.min(boxes.statement.w, 360);
            boxes.underline = { ...box(Math.round(540 - uw / 2), BOTTOM - 12, uw, 4), role: "rule", anchor: "center" };
          }
          hero = "statement";
        }
      }
    }
  } else if (comp === "DATA-FULL") {
    // PIE / GAUGE carry their own number + label: with a kicker that made 4
    // text elements (kinetic-rules max 3 — CI run 36944700437 ch-44 beat 3),
    // so the kicker (lead-in) is dropped when the figure has a label.
    const ownLabel = (vt === "PIE" || vt === "GAUGE") && !!c?.data?.label;
    // FIGURE-LOW for a chart (render-time shot, Gemini's pick; the number's and the map's counterpart): the chart
    // fills the TOP band and its headline stands low in the middle band, so no words sit in the top band —
    // the other half of a shot sequence that three chart beats in a row could not be arranged without.
    const chartTop = !!c?.headline && c.headline_zone === "middle" && c.chart_zone === "top" && ["BAR", "LINE", "TREND"].includes(vt);
    if (chartTop) {
      // The chart in the upper part of the MIDDLE band (y 640-1110, centred on 875), its headline under it —
      // not stranded in the top third (owner, 2026-10-09).
      const cTop = LOW_VISUAL.top, cBot = LOW_VISUAL.top + LOW_VISUAL.h, W2 = R_EDGE - L_EDGE;
      boxes.rule = rule(flip, TOP);
      if (vt === "BAR") {
        const bars = c?.data?.bars || [];
        const longLabel = bars.some((b) => String(b.label || "").length > 12);
        boxes.chart = bars.length >= 4 || longLabel ? { ...box(L_EDGE, cTop, W2, cBot - cTop), orient: "h" } : { ...box(L_EDGE, cTop, W2, cBot - cTop), orient: "v", baseline: cBot - 45 };
      } else boxes.chart = box(L_EDGE, cTop, W2, cBot - cTop);
      boxes.headline = headlineBox(c.headline, { width: 940, bottom: BOTTOM - 12, flip, maxLines: 3, maxHeight: BOTTOM - 12 - (cBot + 20), max: 170 });
      hero = "chart";
      return { composition: comp, boxes, hero, flip };
    }
    Object.assign(boxes, dataHeader(ownLabel ? { ...c, lead_in: null } : c, flip));
    if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
    // Charts start at y >= 460 with or without a header and reach the
    // composition's bottom edge.
    // 70 px under the header: Fraunces' descenders / ascenders run past the
    // line box (run of 2026-09-29: "goes" touched the tallest bar's value).
    // Zones: the chart is the middle zone, whatever the header's height.
    const top = Math.max(boxes.bottom + 70, BODY_TOP);
    const W = R_EDGE - L_EDGE;
    if (vt === "BAR") {
      const bars = c?.data?.bars || [];
      const longLabel = bars.some((b) => String(b.label || "").length > 12);
      if (bars.length >= 4 || longLabel) boxes.chart = { ...box(L_EDGE, top, W, BOTTOM - top), orient: "h" };
      else boxes.chart = { ...box(L_EDGE, top, W, BOTTOM - top), orient: "v", baseline: BOTTOM - 45 };
    } else if (vt === "PIE") {
      // The donut on one side, the hero percentage on the other, above it.
      const r = Math.min(300, Math.floor((BOTTOM - top - 20) / 2));
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
      const parts = numberParts(`${c?.data?.percent ?? 0}%`);
      const fit = fitNumber(parts, 600, { max: 300, min: 200 });
      const nslots = numberSlots(parts, fit.size);
      const nw = Math.ceil(nslots.width), nh = Math.round(fit.size * ROLE_NUMBER.lineHeight);
      // The number hangs from the bottom of the middle zone; the arc's base
      // sits 90 px above it, and the arc is as large as the zone above that allows.
      const ink = numberInk(`${c?.data?.percent ?? 0}`, fit.size);
      const ny = BOTTOM - ink;
      const r = Math.max(200, Math.min(470, ny - 90 - top - 10));
      const cy = Math.max(top + r + 10, ny - 90);
      boxes.chart = { ...box(540 - r, cy - r, 2 * r, r + 60), r, cy };
      boxes.number = { ...box(anchorX(nw, flip), ny, nw, ink), size: fit.size, parts, align: flip ? "right" : "left", role: "number", flip };
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
    if (c?.map_band && c?.headline) {
      // MAP-BAND (render-time shot, the PHOTO-BAND of a map): the map is a band across the CENTRE of the
      // frame (y 640-1110, edge to edge), the headline under it in the same middle band — the words are not
      // at the top and the map is not stranded there either (owner, 2026-10-09).
      boxes.rule = { ...rule(flip, TOP), keep: true };   // holds the top: the span is >= 60% (canvas-coverage)
      boxes.map = box(0, LOW_VISUAL.top, FRAME.w, LOW_VISUAL.h);
      const kb = c.lead_in ? dataBox(String(c.lead_in), { width: 700, size: 34, maxLines: 1, y: 0, flip }) : null;
      boxes.headline = headlineBox(c.headline, { width: 940, bottom: BOTTOM - 12, flip, maxLines: 3, maxHeight: BOTTOM - 12 - (LOW_VISUAL.top + LOW_VISUAL.h + 20) - (kb ? kb.h + 22 : 0), max: 170 });
      if (kb) boxes.kicker = { ...kb, y: boxes.headline.y - 22 - kb.h };
      hero = "map";
    } else {
    Object.assign(boxes, dataHeader(c, flip));
    if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
    // Zones: the map is the middle zone (its edges still feather), not the
    // whole frame behind the header — its linework crossed the headline.
    boxes.map = box(0, BODY_TOP, FRAME.w, BOTTOM - BODY_TOP);
    hero = "map";
    }
  } else if (comp === "LIST-BUILD") {
    Object.assign(boxes, dataHeader(c, flip));
    if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
    const items = (c?.data?.items || []).slice(0, 5);
    const top = Math.max(boxes.bottom + 40, BODY_TOP);
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
        index: { ...box(flip ? R_EDGE - nw : L_EDGE, y + 22, nw, Math.min(120, rowH - 30)), size: Math.min(120, rowH - 30), text: String(i + 1).padStart(2, "0"), role: "number", align: flip ? "right" : "left" },
        rule: { ...box(L_EDGE, y, R_EDGE - L_EDGE, 4), role: "rule", anchor: flip ? "right" : "left" } };
    });
    // The list closes on a hairline at the composition's bottom edge.
    boxes.end = { ...box(L_EDGE, BOTTOM - 4, R_EDGE - L_EDGE, 4), role: "rule", anchor: flip ? "right" : "left" };
    hero = "items";
  } else if (comp === "TIMELINE") {
    Object.assign(boxes, dataHeader(c, flip));
    if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
    const mk = (c?.data?.markers || []).slice(0, 4);
    const top = Math.max(boxes.bottom + 50, BODY_TOP);
    const rowH = (BOTTOM - top) / Math.max(1, mk.length);
    const lineX = flip ? R_EDGE - 60 : L_EDGE + 60;
    boxes.line = { ...box(lineX - 3, top, 6, BOTTOM - top), role: "rule" };
    // Each row holds its date, a 14 px gap and up to two label lines; the
    // date shrinks to fit (it used to floor at 120 px and push the last label
    // past the composition's bottom).
    const LABEL_RESERVE = Math.ceil(2 * 38 * ROLE_DATA.lineHeight) + 14 + 10;
    let size = Math.max(56, Math.min(260, Math.floor((rowH - LABEL_RESERVE) / ROLE_NUMBER.lineHeight)));
    // Every date also fits BESIDE the line: "October 1, 2026" at the row's size ran through
    // the line and its dot (CI run 37082751699 ch-2) — its width was capped, not fitted.
    const sideW = (flip ? lineX - 60 - L_EDGE : R_EDGE - lineX - 60) - 8;
    const fam = { family: "Fraunces", weight: ROLE_NUMBER.weight, tracking: ROLE_NUMBER.tracking };
    // x1.12: measure() read "October 1, 2026" at 760 px where the browser drew ~827
    // (Fraunces' optical sizing at display sizes), and right-aligned overflow spills right.
    while (size > 56 && mk.some((m) => measure(String(m.date), size, fam) * 1.12 > sideW)) size -= 4;
    // Rows measured first, then spread: the first starts at the zone's top,
    // the last label ends on its bottom edge (top-anchored rows left the
    // bottom of the zone empty: canvas-coverage 58%, QA render 2026-10-02).
    const dh = Math.round(size * ROLE_NUMBER.lineHeight);
    const desc = Math.ceil(size * NUM_DESC);                  // old-style date numerals descend into the gap
    const labs = mk.map((m) => dataBox(m.label, { width: 640, size: 38, maxLines: 2, x: undefined, y: 0, flip }));
    const rowsH = labs.map((lb) => 10 + dh + desc + 14 + lb.h);
    const gap = mk.length > 1 ? Math.max(0, (BOTTOM - top - rowsH.reduce((a, b) => a + b, 0)) / (mk.length - 1)) : 0;
    let yAt = top;
    boxes.markers = mk.map((m, i) => {
      const y = yAt;
      yAt += rowsH[i] + gap;
      const parts = numberParts(m.date);
      const dText = String(m.date);
      const dw = Math.min(760, Math.ceil(measure(dText, size, { family: "Fraunces", weight: ROLE_NUMBER.weight, tracking: ROLE_NUMBER.tracking })));
      const dx = flip ? lineX - 60 - dw : lineX + 60;
      const lab = { ...labs[i], y: Math.round(y + 10 + dh + desc + 14) };
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
    if (c?.headline) boxes.headline = headlineBox(c.headline, { width: 520, y: TOP, flip: 0, maxLines: 3, maxHeight: cmp.subject ? HEADER_MAX_Y - TOP - 64 : HEADER_MAX_Y - TOP, max: 120 });
    if (!c?.headline && !c?.lead_in && !cmp.subject) boxes.rule = rule(0, TOP);
    const pa = numberParts(cmp.a?.value ?? ""), pb = numberParts(cmp.b?.value ?? "");
    // A in the upper light half, B hung from the bottom of the dark half.
    const wa = Math.floor(lineAt(900) - L_EDGE - 30), wb = Math.floor(R_EDGE - lineAt(1250) - 30);
    const sz = Math.min(fitNumber(pa, wa, { max: 280, min: 110 }).size, fitNumber(pb, wb, { max: 280, min: 110 }).size);
    const sa = numberSlots(pa, sz), sb = numberSlots(pb, sz);
    const nh = Math.round(sz * ROLE_NUMBER.lineHeight);
    boxes.numberA = { ...box(L_EDGE, BODY_TOP, Math.ceil(sa.width), nh), size: sz, parts: pa, align: "left", role: "number", side: "a" };
    const inkB = numberInk(cmp.b?.value ?? "", sz);
    boxes.numberB = { ...box(R_EDGE - Math.ceil(sb.width), BOTTOM - inkB, Math.ceil(sb.width), inkB), size: sz, parts: pb, align: "right", role: "number", side: "b" };
    if (cmp.a?.label) boxes.labelA = dataBox(cmp.a.label, { width: Math.max(160, wa), size: 36, maxLines: 3, x: L_EDGE, y: boxes.numberA.y + nh + 24, flip: 0 });
    if (cmp.b?.label) boxes.labelB = dataBox(cmp.b.label, { width: Math.max(160, wb), size: 36, maxLines: 3, bottom: boxes.numberB.y - 20, flip: 1 });
    if (cmp.subject) boxes.kicker = { ...dataBox(cmp.subject, { width: 480, size: 34, maxLines: 1, y: TOP + (boxes.headline ? boxes.headline.h + 24 : 0), flip: 0 }), subject: true };   // the comparison's subject: chart data, not chrome
    hero = "numberA";
  } else if (comp === "PORTRAIT" && c?.photo) {
    // A named person's VERIFIED portrait (owner's scene-resolver spec
    // 2026-10-02, task 3.2): the name above it in the top zone (a lead-in
    // small and muted over it), the portrait in the middle zone at its own
    // aspect — not cropped to a circle or a square — 700-900 px on its longest
    // side, centred; the caption (the quote) in the bottom zone.
    boxes.rule = rule(flip ? 0 : 1, TOP);
    if (c.lead_in) boxes.kicker = { ...dataBox(c.lead_in, { width: 640, size: 28, maxLines: 1, y: TOP + 30, flip: flip ? 0 : 1 }), muted: true };
    const sy = (boxes.kicker ? boxes.kicker.y + boxes.kicker.h : TOP + 6) + 32;
    boxes.headline = headlineBox(String(c.photo.entity || c.headline || ""), { width: 984, y: sy, flip, maxLines: 2, maxHeight: HEADER_MAX_Y - sy, max: 140 });
    const r = Math.max(0.4, Math.min(2.5, (Number(c.photo.w) || 3) / (Number(c.photo.h) || 4)));
    let h = 700, w = Math.round(h * r);
    if (w > 900) { w = 900; h = Math.round(w / r); }
    // Standing on the middle zone's floor (y 1330): a landscape photo centred at
    // y 980 left the beat's content at 59.4% of the frame (canvas-coverage).
    const y = 1330 - h;
    boxes.portrait = { ...box(Math.round(540 - w / 2), y, w, h), role: "portrait", asset: c.photo.asset, align: "center" };
    hero = "portrait";
  } else if (comp === "SCENE-FULL" || comp === "ARCHITECTURE" || comp === "DOCUMENT" || comp === "MONEY") {
    if (c?.photo) {
      boxes.photo = box(0, 0, FRAME.w, FRAME.h);
      // The label over the picture: the entity / document named in the
      // sentence; a MONEY beat has none (its picture is an object, not a name).
      // The entity's name as a kicker on every photo beat was the corner-label device: only the
      // planner's label (chromeIn -> lead_in) is drawn now.
      const kicker = comp !== "MONEY" && c.lead_in ? String(c.lead_in) : null;
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
      if (comp === "SCENE-FULL" || comp === "ARCHITECTURE") {
        // Full-bleed place / building (owner's spec 2026-10-02, task 3.1): the
        // headline over the photo in the TOP zone, the caption in the bottom
        // zone; the photo is the middle (it covers every zone).
        const sy = (boxes.kicker ? boxes.kicker.y + boxes.kicker.h : TOP + 6) + 28;
        boxes.headline = headlineBox(c.headline || "", { width: 920, y: sy, flip, maxLines: 3, maxHeight: HEADER_MAX_Y - sy, max: 160 });
      } else boxes.headline = { ...headlineBox(c.headline || "", { width: 920, bottom: BOTTOM, flip, maxLines: 4, maxHeight: comp === "MONEY" ? 520 : BOTTOM - BODY_TOP, max: 200 }), callout: comp === "DOCUMENT" };
      hero = "photo";
    } else {
      // No image resolved: the beat is typography (compositionFor never routes here without a photo).
      Object.assign(boxes, dataHeader(c, flip, { maxSize: 112 }));
      if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
      hero = "headline";
    }
  } else if (comp === "PROCESS-FULL") {
    Object.assign(boxes, dataHeader(c, flip));
    if (!c?.headline && !c?.lead_in) boxes.rule = rule(flip, TOP);
    const nodes = (c?.data?.nodes || []).slice(0, 3);
    const top = Math.max(boxes.bottom + 70, BODY_TOP);
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
  // The plan's own layout, when the planner gave one (applyPlanLayout below): the composition
  // above computed every element — its size, its text fit, its lines — and the plan now says
  // WHERE each named element goes. Without a plan layout this is the old table, unchanged.
  return { composition: comp, boxes, hero, flip };
}

/**
 * Plan-controlled placement (the planner's per-beat `layout`).
 *
 * The composition table above used to be the only thing that decided where an element sat: every
 * PROCESS-FULL beat on every channel put its nodes at the same two cells, every NUMBER-FULL its
 * number at y 781. The plan can now say where. Its `layout` is
 *
 *   { cols, rows,                                 the beat's OWN grid over the content area
 *     slots: [{ id, col, row, col_span, row_span,  a cell span on that grid
 *               align, v_align }                  left|center|right, top|center|bottom
 *            | { id, x, y, w, h }] }              or a rectangle in 1080x1920 px
 *
 * `id` names an element the composition drew: headline, kicker, statement, number, label,
 * lead_phrase, emphasis, chart, map, nodes, items, markers, portrait, cutout0..2, numberA/B,
 * labelA/B — or "hero" / "visual" for the composition's hero element. An element the plan does
 * not name keeps the table's position; an id the beat does not have is reported, not guessed.
 *
 * Where it stops, on purpose: the plan moves elements, it does not resize them. Each element's
 * size comes from its content (a headline fitted to its words, a number to its digits), so a
 * move cannot crop a word or misstate a figure. The only clamp is the frame itself — an element
 * is kept inside the 48 px safe edge and above the caption's zone (y 1340), which renders on
 * every beat; a group that would straddle the top / middle zone edge is moved wholly into the zone
 * holding most of it (logged in plan_layout.adjusted). The header furniture (kicker, rule) and a
 * figure's label travel with the element they belong to. Overlaps and zone crossings are not prevented here: Layer 1 (local-audit.cjs
 * canvas-fit, zones-no-overlap) judges what the plan asked for.
 */
export const LAYOUT_AREA = Object.freeze({ x0: 48, x1: 1032, y0: 130, y1: 1340 });
// The bottom zone (ZONES.bottom, y >= 1340) is the caption's on every beat: a placed element ends above it.
const CONTENT_BOTTOM = 1340;
const LAYOUT_ALIASES = { visual: "hero", body: "hero", title: "headline", text: "statement", figure: "number", graph: "chart", diagram: "nodes", list: "items", timeline: "markers", image: "portrait", photo: "portrait", cutout: "cutout0", icon: "cutout0", symbol: "cutout0" };
// What belongs to an element and goes where it goes (unless the plan placed it separately):
//   STACK_ABOVE  the header furniture — the kicker, then the hairline rule — is restacked directly
//                above the text it introduces (CI run 37707115528: the plan moved the headline and
//                left the kicker where the table had put it; canvas-fit failed on 5 beats).
//   MOVE_WITH    parts that keep their position relative to the element (a figure's label, a
//                statement's lead phrase and underline, a timeline's spine).
const STACK_ABOVE = { headline: ["kicker", "rule"], statement: ["kicker", "rule"] };
const MOVE_WITH = { number: ["label", "floor_rule"], statement: ["lead_phrase", "underline"], headline: ["lead_phrase"], numberA: ["labelA"], numberB: ["labelB"], cutout0: ["cutout1", "cutout2", "cutout_name"], markers: ["line"] };
const HEADER_GAP = 20;
function translateBox(v, dx, dy) {
  if (Array.isArray(v)) { v.forEach((el) => translateBox(el, dx, dy)); return; }
  if (!v || typeof v !== "object") return;
  if (isBox(v)) { v.x = Math.round(v.x + dx); v.y = Math.round(v.y + dy); if (Number.isFinite(v.baseline)) v.baseline = Math.round(v.baseline + dy); }
  for (const [k, sv] of Object.entries(v)) if (sv && typeof sv === "object" && k !== "parts" && k !== "lines") translateBox(sv, dx, dy);
}
function unionOf(list) {
  const bs = list.flatMap((v) => flattenBoxes({ v }).map(([, b]) => b));
  if (!bs.length) return null;
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  const h = Math.max(...bs.map((b) => b.y + b.h)) - y;
  // Ink below the box: Fraunces descenders (the table's `desc`), which the box height leaves out.
  const desc = Math.max(0, Math.max(...bs.map((b) => b.y + b.h + (b.desc || 0))) - (y + h));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h, desc };
}
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
export function slotRect(layout, slot) {
  const A = LAYOUT_AREA;
  if (["x", "y", "w", "h"].every((k) => Number.isFinite(Number(slot?.[k])))) return { x: Number(slot.x), y: Number(slot.y), w: Math.max(1, Number(slot.w)), h: Math.max(1, Number(slot.h)) };
  const cols = int(layout?.cols, 1, 12, 1), rows = int(layout?.rows, 1, 12, 1);
  const col = int(slot?.col, 0, cols - 1, 0), row = int(slot?.row, 0, rows - 1, 0);
  const cs = int(slot?.col_span, 1, cols - col, 1), rs = int(slot?.row_span, 1, rows - row, 1);
  const cw = (A.x1 - A.x0) / cols, rh = (A.y1 - A.y0) / rows;
  return { x: A.x0 + col * cw, y: A.y0 + row * rh, w: cs * cw, h: rs * rh };
}
// Names for "the beat's visual". The planner names the visual it PLANNED (a number, a map, a chart);
// the grounding gate and the scene translation may draw a different one (a statement, a photo, a
// cutout). A slot naming a visual the beat does not have places the visual the beat does have — the
// composition's hero. (CI run 37723570093 attempt 2: 9 of 10 beats named a visual the rendered beat
// lacked — "number" on a statement beat, "map" on a photo beat, "nodes" on a cutout beat — and those
// slots silently placed nothing.)
const VISUAL_IDS = new Set(["number", "chart", "map", "nodes", "items", "markers", "portrait", "cutout0", "hero", "visual", "body", "figure", "graph", "diagram", "list", "timeline", "image", "photo", "cutout", "icon", "symbol"]);
const canon = (id, boxes, hero) => {
  const raw = String(id || "").trim();
  let k = LAYOUT_ALIASES[raw.toLowerCase()] || raw;
  if (k === "hero") k = hero || "";
  if (k === "headline" && !boxes.headline && boxes.statement) k = "statement";
  if (k === "statement" && !boxes.statement && boxes.headline) k = "headline";
  if (!boxes[k] && (VISUAL_IDS.has(raw.toLowerCase()) || VISUAL_IDS.has(k)) && hero) k = hero;
  return k;
};
export function applyPlanLayout(boxes, layout, { hero = null, axes = "xy", yBlend = 1 } = {}) {
  const placed = [], unknown = [], adjusted = [];
  const slots = Array.isArray(layout?.slots) ? layout.slots : [];
  const usable = (k) => !!boxes[k] && k !== "bottom" && k !== "split" && k !== "photo";
  // Elements the plan names itself never ride along with another element.
  const explicit = new Set(slots.map((sl) => canon(sl?.id, boxes, hero)).filter(usable));
  const moved = new Set();
  for (const slot of slots) {
    const id = canon(slot?.id, boxes, hero);
    if (!usable(id) || moved.has(id)) { unknown.push(String(slot?.id)); continue; }
    if (id !== String(slot?.id || "").trim() && !LAYOUT_ALIASES[String(slot?.id || "").trim().toLowerCase()]) adjusted.push(`${slot.id} -> ${id}`);
    const keys = [id, ...(MOVE_WITH[id] || []).filter((k) => usable(k) && !explicit.has(k) && !moved.has(k))];
    const header = (STACK_ABOVE[id] || []).filter((k) => usable(k) && !explicit.has(k) && !moved.has(k));
    const E = unionOf(keys.map((k) => boxes[k]));
    if (!E) { unknown.push(String(slot?.id)); continue; }
    const headH = header.reduce((t, k) => t + boxes[k].h + HEADER_GAP, 0);
    const R = slotRect(layout, slot);
    // A slot is a REGION. With an explicit align / v_align the element is anchored in it that way;
    // without one it keeps its own position, moved only as far as it takes to sit inside the slot.
    // (CI run 37708554035: the planner answered a 1x1 grid with one slot on every beat — the whole
    // content area — and anchoring to the slot's top-left corner by default piled every beat's
    // element at the top: canvas-coverage 35-55%, headline onto number.)
    const inside = (p, lo, size, span) => Math.max(lo, Math.min(lo + Math.max(0, span - size), p));
    const align = slot?.align || null, va = slot?.v_align || null;
    let x = align === "right" ? R.x + R.w - E.w : align === "center" ? R.x + (R.w - E.w) / 2 : align === "left" ? R.x : inside(E.x, R.x, E.w, R.w);
    let y = va === "bottom" ? R.y + R.h - E.h : va === "center" ? R.y + (R.h - E.h) / 2 : va === "top" ? R.y : inside(E.y, R.y, E.h, R.h);
    // The frame: the safe edge at the sides; above, the content area's top (y 130 — the table never
    // draws above it, and the render's ground check samples the corners: CI run 37714244283, a
    // restacked rule near y 50 read #F7F7F7 in the top-left patch), header included; below, the
    // caption's zone.
    // An element wider than the safe width is drawn edge to edge by design (a map, a full-width
    // chart): it keeps its own x — clamping it to the 48 px edge pushed a 1080 px map off the right
    // of the frame (replay of CI run 37723570093 beat 1).
    x = E.w > FRAME.w - 2 * SAFE.x ? E.x : Math.max(SAFE.x, Math.min(FRAME.w - SAFE.x - E.w, x));
    // Below: the caption's zone — and an element's own margin above it. The table leaves a cutout
    // 23 px clear of y 1340 for its drop shadow; a plan that bottom-aligned the same cutout to 1340
    // put the shadow across the zone edge (CI run 37746025773, zones-no-overlap). So a placed element
    // goes no lower than the table puts it, or than 24 px above the edge, whichever is lower.
    // The descenders count: CI run 37764608991 put an emphasis word's box bottom at 1316, and its
    // 60 px of descenders crossed y 1340; the table ends box + descenders at 1340 exactly.
    const inkH = E.h + (E.desc || 0);
    const bottomLimit = Math.min(CONTENT_BOTTOM, Math.max(E.y + inkH, CONTENT_BOTTOM - 24));
    y = Math.max(LAYOUT_AREA.y0 + headH, Math.min(bottomLimit - inkH, y));
    // One axis only (canvasLayout's partial fallback): the other axis keeps the table's position.
    if (axes === "x") y = E.y;
    if (axes === "y") x = E.x;
    if (yBlend < 1) y = Math.round(E.y + (y - E.y) * yBlend);
    // One zone per element (ZONES, owner's rule 2026-10-02): a group that would straddle the top /
    // middle edge is moved wholly into the zone holding most of it, when it fits there. Logged.
    const edge = ZONES.top[1], top = y - headH, bot = y + E.h;
    if (axes !== "x" && top < edge - ZONE_TOL && bot > edge + ZONE_TOL) {
      const intoMiddle = bot - edge >= edge - top;
      const fitsMiddle = edge + headH + E.h <= CONTENT_BOTTOM, fitsTop = LAYOUT_AREA.y0 + headH + E.h <= edge;
      // The zone holding most of it first; the other when that one is too small (CI run 37715658530:
      // a 487 px number mostly in the top zone, which it does not fit, was left straddling).
      if ((intoMiddle || !fitsTop) && fitsMiddle) { y = edge + headH; adjusted.push(`${id}: straddled y ${edge} -> middle zone`); }
      else if (fitsTop) { y = edge - E.h; adjusted.push(`${id}: straddled y ${edge} -> top zone`); }
      else adjusted.push(`${id}: straddles y ${edge} and fits neither zone — left as planned`);
    }
    const dx = x - E.x, dy = y - E.y;
    if (dx || dy) for (const k of keys) translateBox(boxes[k], dx, dy);
    // The header furniture, restacked directly above its text: the kicker, then the rule above it.
    let cursor = boxes[id].y;
    const side = (align || boxes[id].align) === "right" ? "right" : "left";
    for (const k of header) {
      const f = boxes[k];
      const fx = axes === "y" ? f.x : side === "right" ? boxes[id].x + boxes[id].w - f.w : boxes[id].x;
      const fy = axes === "x" ? f.y : cursor - HEADER_GAP - f.h;
      translateBox(f, fx - f.x, fy - f.y);
      cursor = fy;
    }
    keys.concat(header).forEach((k) => moved.add(k));
    placed.push({ id: [...keys, ...header].join("+"), x: Math.round(x), y: Math.round(y), w: Math.round(E.w), h: Math.round(E.h) });
  }
  return { cols: layout?.cols ?? null, rows: layout?.rows ?? null, placed, unknown, adjusted };
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
  const x2 = Math.max(...all.map((b) => b.x + b.w)), y2 = Math.max(...all.map((b) => b.y + b.h + (b.desc || 0)));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Zone bookkeeping (ZONES). Element types: "headline" (kicker, headline,
 * statement, emphasis, folio), "number" (a hero number and its label),
 * "chart" (chart, map, nodes, list, timeline, comparison values) and
 * "caption" (the word caption, fixed at CAPTION). Not elements: the photo
 * (a full-bleed ground), a diagonal split shape, and hairline rules (page
 * furniture).
 */
export function elementType(key, b) {
  const k = String(key);
  if (/^(photo|split)$/.test(k) || b?.role === "shape" || b?.role === "rule" || /^(rule|end|line)$/.test(k) || /_(rule|dot)$/.test(k)) return null;
  // The planner's pull phrase / label in the bottom zone is caption-class text; above it, headline-class.
  if (k === "pull" || k === "kicker") return b && b.y >= ZONES.bottom[0] - ZONE_TOL ? "caption" : "headline";
  if (/^(headline|statement|emphasis|folio|lead)/.test(k)) return "headline";
  if (k === "number" || k === "label") return "number";
  return "chart";
}
/** The zones a box occupies (crossing a zone edge by < ZONE_TOL is a border case, not occupancy). */
export function zonesOf(b) {
  return Object.entries(ZONES).filter(([, [y0, y1]]) => b.y + b.h > y0 + ZONE_TOL && b.y < y1 - ZONE_TOL).map(([n]) => n);
}
/**
 * Zone check on a layout's boxes. Fails when an element spans two zones or
 * two element types share a zone. Exception (owner's rule 1.5): a number in
 * the chart's zone is allowed only when it is that chart's own value — the
 * PIE / GAUGE percentage (DATA-FULL boxes.number). The caption always holds
 * the bottom zone, so nothing else may enter it.
 */
export function zoneReport(layout) {
  const occ = { top: new Set(), middle: new Set(), bottom: new Set(["caption"]) };
  const spans = [];
  const valueOfChart = layout.composition === "DATA-FULL" && !!layout.boxes?.chart;
  for (const [k, b] of flattenBoxes(layout.boxes || {})) {
    const t = elementType(k, b);
    if (!t || !b || !(b.w > 0 && b.h > 0)) continue;
    const z = zonesOf(b);
    if (z.length > 1) spans.push(`${k} (y ${b.y}-${b.y + b.h}) spans ${z.join("+")}`);
    for (const n of z) occ[n].add(valueOfChart && t === "number" ? "chart" : t);
  }
  // Words may sit with the visual — under it, over it, beside it — in one zone (owner, 2026-10-09: "text sits with
  // the visual ... the zone rule that keeps visual and text strictly apart is what forced the visual to the top").
  // What stays: no element across a zone edge (`spans`), the bottom zone is the caption's alone, and text-on-text
  // overlap (layoutViolations "overlap") and the safe area (canvas-fit) are untouched.
  const clashes = Object.entries(occ).filter(([n, s]) => n === "bottom" && s.size > 1).map(([n, s]) => `${n} zone holds ${[...s].sort().join(" + ")}`);
  const zones = Object.fromEntries(Object.entries(occ).map(([n, s]) => [n, [...s]]));
  return { ok: !spans.length && !clashes.length, spans, clashes, zones };
}

/** The box a camera_focus target names, or null (full frame). */
export function focusBox(layout, target) {
  const b = layout.boxes || {};
  const t = String(target || "full").toLowerCase();
  if (t === "full") return null;
  if (t === "number") return b.number || b.emphasis || b.statement || b.chart || null;
  if (t === "chart" || t === "data") return b.chart || b.number || null;
  // The camera moves only the BODY (full-canvas.jsx BeatCanvas); the header —
  // rule, kicker, headline — is pinned. Framing b.headline therefore moved
  // the body by the headline's offset: on TYPE-SPLIT (headline top, statement
  // bottom) a 1.35x push "onto the headline" threw the statement to x -313,
  // y 1337-1890 — off the left edge, over the captions, onto the ground the
  // audit samples (run 36915319430 ch-26 beats 1 and 3: "ground luma 137",
  // coverage 6%). "headline" / "text" now frame the body's own text.
  if (t === "headline" || t === "text") return b.statement || b.emphasis || null;
  if (t === "map") return b.map ? { x: 140, y: 380, w: 800, h: 1000 } : null;
  if (t === "photo" || t === "subject") return b.photo ? { x: 140, y: 380, w: 800, h: 1000 } : null;
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
  const meta = (n) => ({ x: n.x, y: n.y, w: n.w, h: n.h, role: n.role || null, align: n.align || null, rotate: n.rotate || null, size: n.size || null, bleed: n.bleed || 0, parts: n.parts ? { isQuantity: !!n.parts.isQuantity, text: n.parts.text } : undefined });
  for (const [k, v] of flattenBoxes(L.boxes)) flat[k] = meta(v);
  // The pull phrase is drawn by full-canvas.jsx PullPhrase, outside L.boxes (so the pop bands, the
  // camera and the zone clamps never treat it as a body element); the audit still sees its box.
  if (L.pull) flat.pull = meta(L.pull);
  const shown = (k) => (L.boxes[k]?.lines ? L.boxes[k].lines.join(" ") : L.boxes[k]?.text || null);
  // Every text box DRAWN at the top of the frame (its top edge in the top zone), whatever the
  // layout calls it — kicker, headline, statement, chart label, a comparison's subject. That is
  // what a viewer reads as a corner label. The record used to be the planner's kicker only, so a
  // headline pinned top-left on 7 of 9 beats counted as 0 labels (board 37837731824 ch-26).
  // scripts/template-check.js labelsDrawn measures the same thing from the manifest's boxes.
  const topText = [...Object.entries(L.boxes).filter(([, b]) => b?.lines?.length && b.y < ZONES.top[1]).map(([k]) => k), ...(L.pull && L.pull.y < ZONES.top[1] ? ["pull"] : [])];
  const plannerLabel = L.boxes.kicker && !L.boxes.kicker.subject;
  return {
    composition: L.composition, hero: L.hero, boxes: flat, content: contentBounds(L), zones: zoneReport(L).zones, motion_tier: c.motion_tier || "medium",
    camera: c.photo && (FULL_PHOTO_COMPS.includes(L.composition) || FRAMED_PHOTO_COMPS.includes(L.composition)) ? { subject: "photo", move: CAMERA.photo, from_frame: Number.isFinite(c.entity_pop?.frame) ? Math.max(0, c.entity_pop.frame) : 0 }
      : L.composition === "DATA-FULL" ? { subject: "graph", move: CAMERA.graph } : null,
    camera_focus: c.camera_focus || null, persists_from: Number.isInteger(c.persists_from) ? c.persists_from : null, match_cut_prev: !!c.match_cut_prev,
    // Provenance (verified_as = the Wikipedia title + description it was verified against,
    // place_check = the same-place verdict) is what the pre-ship place gate reads.
    photo: c.photo ? { asset: c.photo.asset, entity: c.photo.entity || null, kind: c.photo.kind || null, view: c.photo.view || null,
      verified_as: c.photo.verified_as || null, seen: c.photo.seen || null, source_url: c.photo.source_url || null, place_check: c.photo.place_check || null } : null,
    // The chrome actually drawn (scripts/template-check.js reads these three devices).
    chrome: {
      label: plannerLabel || topText.length ? {
        text: plannerLabel ? (L.boxes.kicker.lines || []).join(" ") || null : topText[0] === "pull" ? L.pull.lines.join(" ") : (L.boxes[topText[0]].lines || []).join(" ") || null,
        position: plannerLabel ? c.label?.position || "top-left" : "top", drawn: topText, planner: !!plannerLabel } : null,
      pull_phrase: L.pull ? { text: L.pull.lines.join(" "), position: L.pull.position, tone: L.pull.tone } : null,
      type_led: TYPE_LED_COMPS.includes(L.composition) && !c.photo && !(c.concept_visuals || []).length && !c.hero_cutout,
    },
    // What the beat drew and the sentence it was drawn for (scripts/place-gate.js).
    visual_type: c.visual_type || null, data: c.data || null, sentence: c.sentence || null,
    // Word-level sync (render.js / entity-sync.js): the frame (beat-relative) the entity visual pops at, and its word.
    entity_pop: c.entity_pop || null,
    // "Source: <domain>" drawn bottom-right on a fetched-image beat (part C).
    source_credit: c.source_credit || null,
    // The hero object and the name card, so the reviewers' frame labels say what is drawn.
    concept_visuals: (c.concept_visuals || []).map((v) => ({ name: v.name || null, class: v.class || null, logo: !!v.logo, money: !!v.money, asset: v.asset || null })),
    name_card: c.name_card?.name ? { name: c.name_card.name } : null,
    // Part C: the entrance style and the background variation this beat was drawn with.
    entrance_style: c.entrance_style || null,
    background: backgroundOf(idx, L.composition, !!c.ground_color),
    headline_size: (L.boxes.headline || L.boxes.statement)?.size || null,
    headline_align: (L.boxes.headline || L.boxes.statement)?.align || null,
    // Where the accent is drawn: chart values / arrows, the hero number (unless the
    // sentence is neutral: number_accent === false), the latest date, the last list
    // index, the larger comparison value, the map's region, a document's callout band.
    accent_used: ["DATA-FULL", "PROCESS-FULL", "TIMELINE", "LIST-BUILD", "COMPARISON-SPLIT", "MAP-CENTERED", "DOCUMENT"].includes(L.composition)
      || ((L.composition === "NUMBER-FULL" || L.composition === "MONEY") && c.number_accent !== false && !!L.boxes.number),
    variant: c.variant, flip: L.flip, dark: !!c.dark,
    // The planner's own layout and what it moved (applyPlanLayout); null = the composition table.
    plan_layout: L.layout || null,
    // What is behind the beat: the ground (white unless the beat declared another — then
    // `ground_color` is its hex, null for the default), or a full-bleed photo covering it.
    // `ground` keeps its old meaning ("a ground is visible": "white" | "photo") so every reader
    // that classifies photo beats is unchanged.
    // A shot's partial photo (PHOTO-BAND / -EDGE / -CARD / -INSET / -STRIP) leaves the ground showing:
    // "white", so canvas-ground and the pixel zone checks still run on it (local-audit.cjs fullBleed).
    ground: c.photo && FULL_PHOTO_COMPS.includes(L.composition) ? "photo" : "white",
    // The shot the planner named and whether it is the one drawn (shotComposition).
    shot: c.shot || null,
    ground_color: c.ground_color || null,
    headline_text: shown("headline") || shown("statement") || null, emphasis_text: shown("emphasis"),
    // The headline's entrance: the words fly in on a major TYPE-FULL statement,
    // otherwise mask-reveal / slide-land / crop-open rotating on the beat index.
    // Fix 2: c.anim (visual/animation-plan.js) names the animation of every element.
    animations: c.anim || null,
    kinetic: c.kinetic || null,
    words: Object.fromEntries(Object.entries(L.boxes).filter(([, b]) => b?.lines?.length).map(([k, b]) => [k, b.words ? b.words.map((w) => ({ t: w.text, weight: w.weight, accent: !!w.accent, emph: !!w.emph })) : b.lines.join(" ").split(" ").filter(Boolean).map((t) => ({ t }))])),
    headline_motion: c.anim?.headline ? c.anim.headline : (c.motion_tier === "major" && L.composition === "TYPE-FULL" && L.boxes.statement && !L.boxes.statement.rotate) ? "words"
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
/**
 * The accent as it is DRAWN on a ground: the channel's own hue, moved in lightness only as far as it takes to
 * reach `min` (3:1, WCAG large text) against that ground — lighter on a dark ground, darker on a light one.
 * A beat's accent word can then never be dark-on-dark or pale-on-white (owner, 2026-10-09). An accent that
 * already reads is returned unchanged; nothing but lightness moves.
 */
export function readableAccent(accent, groundHex, min = 3) {
  const rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const a = rgb(accent), g = rgb(groundHex || "#FFFFFF");
  if (!a || !g) return accent;
  const cr = (c) => { const x = lum(c), y = lum(g); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  if (cr(a) >= min) return accent;
  const toHsl = ([r, gg, b]) => { r /= 255; gg /= 255; b /= 255; const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn; let h = 0, s = 0; const l = (mx + mn) / 2; if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (gg - b) / d + (gg < b ? 6 : 0) : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4; h /= 6; } return [h, s, l]; };
  const fromHsl = ([h, s, l]) => { const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255)); };
  const [h, s, l0] = toHsl(a);
  const up = lum(g) < 0.18;   // a dark ground wants a lighter accent
  for (let l = l0; up ? l <= 0.97 : l >= 0.03; l += up ? 0.02 : -0.02) {
    const c = fromHsl([h, s, l]);
    if (cr(c) >= min) return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }
  return up ? "#F2F0EB" : "#111111";
}
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
