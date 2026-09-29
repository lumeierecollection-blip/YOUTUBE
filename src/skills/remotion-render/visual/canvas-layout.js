/**
 * Full-canvas layout, pure JS (no JSX). full-canvas.jsx draws from these
 * numbers and render.js records them in the render manifest, so the audit
 * (local-audit.cjs canvas-fit / canvas-coverage) checks the renderer's own
 * element boxes — the pattern paper-text.js used for the paper.
 *
 * There is no container. Every beat is composed for the whole 1080x1920
 * frame (owner's full-canvas rebuild, 2026-09-29):
 *   TYPE-FULL     the statement (or one number) IS the composition
 *   DATA-FULL     the chart IS the composition (bars ~60% of frame height)
 *   SCENE-FULL    a real photo fills the frame (objectFit cover), type over it
 *   PROCESS-FULL  2-3 nodes with thick arrows across the frame
 *
 * Regions (design px):
 *   COMPOSITION  y 100..1420 — everything but the caption lives here
 *   CAPTION      y 1450..1610, x 64..944 — the word caption; clear of the
 *                Shorts UI (right-hand buttons from x ~960, title below 1620)
 *   SAFE         the frame less 48 px on every side — no element box leaves it
 *
 * Where this stops: text widths are estimated from character counts (bold
 * grotesk ~0.62 em per uppercase character, ~0.56 lowercase, digits 0.6),
 * not measured glyphs; sizes are chosen with margin, and the audit checks
 * the boxes against the frame, not against the glyphs actually drawn.
 */
export const FRAME = { w: 1080, h: 1920 };
export const SAFE = { x: 48, y: 48, w: 1080 - 96, h: 1920 - 96 };
export const COMP = { x: 64, y: 100, w: 952, h: 1320 };
export const CAPTION = { x: 64, y: 1450, w: 880, h: 160 };
export const COMPOSITIONS = ["TYPE-FULL", "DATA-FULL", "SCENE-FULL", "PROCESS-FULL"];
export const TRANSITION_SEC = 0.5;
// TYPE-FULL's closing rule sits on the composition region's bottom edge.
export const RULE_Y = 1390;
// Where a data / process / object composition starts when it has no header.
export const CONTENT_TOP = 180;

export const INK = "#0B0B0C";
export const INK_SOFT = "#8E8E93";
export const MID = "#A7A7AD";
export const LIGHT = "#DADADF";
// Off-white studio ground: luma ~244, so with soft-light grain (mean-
// neutral) the white-ground verify (> 240 in the top-left corner) holds —
// run 36498049819 ch-44 measured 232.7 with #F3F1EC + multiply grain.
export const STUDIO = "#F6F4F0";
export const SANS = "Inter";
export const SERIF = "'Playfair Display', Georgia, serif";

const DATA_TYPES = ["BAR", "PIE", "LINE", "GAUGE", "MAP"];

/** The composition a checked visual type is drawn as. */
export function compositionFor(visualType, hasPhoto) {
  const t = String(visualType || "TYPE").toUpperCase();
  if (t === "PHOTO" || t === "CUTOUT") return hasPhoto ? "SCENE-FULL" : "TYPE-FULL";
  if (t === "PROCESS") return "PROCESS-FULL";
  if (DATA_TYPES.includes(t)) return "DATA-FULL";
  return "TYPE-FULL";                       // TYPE and COUNTER (a number with a label)
}

// Inter at weight 800, measured on rendered frames (2026-09-29: "$105M" at
// 460 px ran past a 952 px box with the lighter estimates).
const em = (ch, upper) => (/[$%]/.test(ch) ? 0.74 : /\d/.test(ch) ? 0.68 : /[MW]/.test(ch) ? 0.92 : /[A-Z]/.test(ch) || upper ? 0.74 : /[ilj.,'!|:;]/.test(ch) ? 0.3 : 0.6);
/** Estimated width of `text` at `size` px, bold grotesk. */
export function textWidth(text, size, upper = false) {
  let w = 0;
  for (const ch of String(text || "")) w += ch === " " ? 0.28 : em(ch, upper);
  return w * size;
}
/** Greedy wrap of words into lines no wider than `width` at `size`. */
export function wrap(words, size, width, upper = false) {
  const lines = [];
  let cur = [];
  for (const w of words) {
    const next = [...cur, w].join(" ");
    if (cur.length && textWidth(next, size, upper) > width) { lines.push(cur.join(" ")); cur = [w]; } else cur.push(w);
  }
  if (cur.length) lines.push(cur.join(" "));
  return lines;
}
/** Largest size (step 4) in [min, max] at which `text` wraps into <= maxLines lines of `width` and no word overflows. */
export function fitText(text, width, { max = 200, min = 28, maxLines = 3, maxHeight = Infinity, lineH = 1.02, upper = false } = {}) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  for (let s = max; s >= min; s -= 4) {
    if (words.some((w) => textWidth(w, s, upper) > width)) continue;
    const lines = wrap(words, s, width, upper);
    if (lines.length <= maxLines && lines.length * s * lineH <= maxHeight) return { size: s, lines };
  }
  return { size: min, lines: wrap(words, min, width, upper) };
}

const box = (x, y, w, h) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });

// Split a quantity string for the big-number layout: "$105M" / "1.4 billion" / "50%".
export function splitNumber(value) {
  const s = String(value || "").trim();
  const m = s.match(/^(.*?)(\d[\d,]*(?:\.\d+)?\s*(?:%|[kKmMbB]\b)?)(?:\s*(thousand|million|billion|trillion))?(.*)$/);
  if (!m) return { big: s, scale: "", rest: "" };
  return { big: `${m[1]}${m[2]}`.trim(), scale: (m[3] || "").trim(), rest: (m[4] || "").trim() };
}

/** Header (kicker + headline) at the top of the composition region. */
function header(c, y0 = COMP.y + 10, maxSize = 64) {
  const out = {};
  let y = y0;
  if (c.lead_in) {
    const k = fitText(c.lead_in, COMP.w, { max: 38, min: 24, maxLines: 1 });
    out.kicker = { ...box(COMP.x, y, COMP.w, k.size * 1.3), size: k.size, lines: k.lines };
    y += k.size * 1.3 + 6;
  }
  if (c.headline) {
    const upper = String(c.headline).split(/\s+/).length <= 4;
    const h = fitText(c.headline, COMP.w, { max: maxSize, min: 32, maxLines: 2, upper });
    out.headline = { ...box(COMP.x, y, COMP.w, h.lines.length * h.size * 1.05), size: h.size, lines: h.lines, upper };
    y += h.lines.length * h.size * 1.05;
  }
  out.bottom = y;
  return out;
}

/**
 * Every element box for one beat's canvas content `c`, in design px.
 * Returns { composition, boxes: {name: {x,y,w,h,...}}, hero } — hero is the
 * element a camera push or a match cut targets.
 */
export function canvasLayout(c) {
  const comp = c?.composition || compositionFor(c?.visual_type, !!(c?.photo || c?.cutout));
  const vt = String(c?.visual_type || "TYPE").toUpperCase();
  const boxes = {};
  let hero = null;

  if (comp === "TYPE-FULL") {
    if (vt === "COUNTER" && c?.data?.value) {
      // One number with a small label: the number at 300-460 px.
      const n = splitNumber(c.data.value);
      const nf = fitText(n.big, COMP.w, { max: 460, min: 160, maxLines: 1 });
      const hd = c.headline ? fitText(c.headline, COMP.w, { max: 96, min: 44, maxLines: 2, upper: true }) : null;
      // Spans the frame (canvas-coverage >= 60%): headline from y 160, the
      // rule at the bottom of the composition region (run 36498049819 ch-48:
      // headline at 230 + rule at 1330 measured 57-58%).
      let y = 160;
      if (hd) { boxes.headline = { ...box(COMP.x, y, COMP.w, hd.lines.length * hd.size * 1.05), size: hd.size, lines: hd.lines, upper: true }; y += hd.lines.length * hd.size * 1.05 + 70; }
      boxes.number = { ...box(COMP.x, hd ? Math.max(y, 520) : 200, COMP.w, nf.size * 0.95), size: nf.size, text: n.big };
      y = boxes.number.y + boxes.number.h + 24;
      // The scale word once: run 36509937804 ch-26 drew "million million
      // Ponzi scheme" (value "$127 million", label "million Ponzi scheme").
      const lab = String(c.data.label || "").trim();
      const label = n.scale && lab.toLowerCase().startsWith(n.scale.toLowerCase()) ? lab : [n.scale, lab].filter(Boolean).join(" ");
      if (label) {
        const lf = fitText(label, COMP.w, { max: 64, min: 36, maxLines: 2 });
        boxes.label = { ...box(COMP.x, y, COMP.w, lf.lines.length * lf.size * 1.15), size: lf.size, lines: lf.lines };
        y += lf.lines.length * lf.size * 1.15;
      }
      boxes.rule = box(540 - 90, Math.max(y + 60, RULE_Y), 180, 14);
      hero = "number";
    } else {
      // The statement fills 70-90% of the width, stacked large.
      const text = c?.headline || "";
      const upper = String(text).split(/\s+/).length <= 5;
      const st = fitText(text, COMP.w * 0.94, { max: 300, min: 72, maxLines: 5, maxHeight: 1060, lineH: 0.98, upper });
      const blockH = st.lines.length * st.size * 0.98;
      if (c?.lead_in) {
        const k = fitText(c.lead_in, COMP.w, { max: 48, min: 28, maxLines: 1 });
        boxes.kicker = { ...box(COMP.x, 150, COMP.w, k.size * 1.3), size: k.size, lines: k.lines };
      }
      // With a kicker at 150 the frame is spanned already, so the statement
      // is centred; without one it starts no lower than y 200, so kicker/
      // statement top -> rule bottom (1404) is >= 60% of the frame height.
      const centred = 780 - blockH / 2;
      const top = boxes.kicker ? Math.max(260, centred) : Math.min(200, Math.max(160, centred));
      boxes.statement = { ...box(COMP.x + COMP.w * 0.03, top, COMP.w * 0.94, blockH), size: st.size, lines: st.lines, upper };
      boxes.rule = box(COMP.x + COMP.w * 0.03, Math.max(top + blockH + 70, RULE_Y), 180, 14);
      hero = "statement";
    }
  } else if (comp === "DATA-FULL") {
    Object.assign(boxes, header(c, COMP.y + 4, 60));
    // Content starts at y >= 180 with or without a header, and every chart
    // reaches the composition region's bottom (scripts/test-canvas-layout.mjs:
    // without a headline PIE spanned 51%, GAUGE 43%, LINE 59%).
    const top = Math.max(boxes.bottom + 40, CONTENT_TOP);
    if (vt === "BAR") {
      const bars = c?.data?.bars || [];
      const longLabel = bars.some((b) => String(b.label || "").length > 12);
      if (bars.length >= 4 || longLabel) {
        boxes.chart = { ...box(COMP.x, top, COMP.w, 1400 - top), orient: "h" };
      } else {
        // Vertical bars: the tallest ~60% of the frame height.
        boxes.chart = { ...box(COMP.x, top, COMP.w, 1432 - top), orient: "v", baseline: 1380 };
      }
    } else if (vt === "PIE") {
      const r = 440;
      boxes.chart = { ...box(540 - r, top + 20, 2 * r, 2 * r), r };
      boxes.label = box(COMP.x, Math.max(boxes.chart.y + 2 * r + 36, 1330), COMP.w, 60);
    } else if (vt === "GAUGE") {
      const r = 470;
      const cy = top + r + 30;
      boxes.chart = { ...box(540 - r, cy - r, 2 * r, r + 60), r, cy };
      boxes.number = box(COMP.x, cy + 50, COMP.w, 220);
      boxes.label = box(COMP.x, Math.max(cy + 290, 1330), COMP.w, 60);
    } else if (vt === "LINE") {
      boxes.chart = box(COMP.x + 20, top, COMP.w - 40, 1400 - top);
    } else if (vt === "MAP") {
      boxes.chart = box(SAFE.x, top, SAFE.w, 1410 - top);
    } else {
      boxes.chart = box(COMP.x, top, COMP.w, 1400 - top);
    }
    hero = "chart";
  } else if (comp === "SCENE-FULL") {
    if (c?.photo) {
      boxes.photo = box(0, 0, FRAME.w, FRAME.h);
      const upper = String(c.headline || "").split(/\s+/).length <= 4;
      const kicker = c.photo.entity ? String(c.photo.entity).toUpperCase() : null;
      if (kicker) boxes.kicker = { ...box(COMP.x, 190, COMP.w, 50), size: 38, lines: [kicker] };
      const hd = fitText(c.headline || "", COMP.w, { max: 124, min: 56, maxLines: 3, upper });
      boxes.headline = { ...box(COMP.x, kicker ? 256 : 210, COMP.w, hd.lines.length * hd.size * 1.04), size: hd.size, lines: hd.lines, upper };
      hero = "photo";
    } else {
      Object.assign(boxes, header(c, COMP.y + 20, 88));
      const top = Math.max(boxes.bottom + 30, CONTENT_TOP + 20);
      // The object's box runs to the composition region's bottom (drawn
      // "contain": a tall object fills it, a wide one is centred in it).
      boxes.cutout = box(COMP.x, top, COMP.w, 1400 - top);
      hero = "cutout";
    }
  } else if (comp === "PROCESS-FULL") {
    Object.assign(boxes, header(c, COMP.y + 4, 60));
    const nodes = (c?.data?.nodes || []).slice(0, 3);
    const top = Math.max(boxes.bottom + 40, CONTENT_TOP);
    if (nodes.length === 2) {
      const d = 380;
      boxes.nodes = [
        { ...box(90, top, d, d), label: nodes[0] },
        { ...box(1080 - 90 - d, 1400 - d, d, d), label: nodes[1] },
      ];
    } else {
      const d = Math.min(330, (1400 - top - 2 * 90) / 3);
      const gap = (1400 - top - 3 * d) / 2;
      boxes.nodes = nodes.map((label, i) => ({ ...box(540 - d / 2, top + i * (d + gap), d, d), label }));
    }
    hero = "nodes";
  }
  return { composition: comp, boxes, hero };
}

/** Union box of every element (captions excluded). */
export function contentBounds(layout) {
  const all = [];
  for (const [k, v] of Object.entries(layout.boxes || {})) {
    if (k === "bottom") continue;
    if (Array.isArray(v)) all.push(...v); else if (v && typeof v === "object" && "x" in v) all.push(v);
  }
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
  if (t === "number") return b.number || b.statement || b.chart || null;
  if (t === "chart" || t === "data") return b.chart || b.number || null;
  if (t === "headline" || t === "text") return b.headline || b.statement || null;
  if (t === "photo" || t === "subject") return b.photo ? { x: 140, y: 380, w: 800, h: 1000 } : b.cutout || null;
  if (t === "left") return { x: 0, y: 300, w: 640, h: 1100 };
  if (t === "right") return { x: 440, y: 300, w: 640, h: 1100 };
  if (t === "top") return { x: 0, y: 100, w: 1080, h: 900 };
  if (t === "bottom") return { x: 0, y: 700, w: 1080, h: 900 };
  if (/^node\s*\d$/.test(t) && Array.isArray(b.nodes)) return b.nodes[Number(t.slice(-1))] || null;
  return null;
}
