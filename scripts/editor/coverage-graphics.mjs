/**
 * Deterministic motion-graphics diagrams for the coverage pass.
 *
 * Every diagram is pure SVG/text/solid layers drawn by the same renderer that
 * draws photos, so the QA measures diagrams and photographs by the same pixel
 * rules. Each diagram states exactly the figure the sentence states: a date,
 * a version, a figure count, a clock position, a relation (who saw what, who
 * influenced whom), a causal chain (refusal -> crushing), a flow (AI connects
 * workflows), a negotiation (driver <-> system), a plea (refused to enter a
 * plea), or a label card.
 *
 * No decorative dots, sweeps, halftones, corners, grids or grid drift.
 * Every path, every number, every line has a start frame, an end frame and a
 * reason the sentence demands it.
 */
import { frames, textLayer, solidLayer, svgLayer, reveal } from "./coverage-layers.mjs";

const W = 1080, H = 1920;
const INK = "#101114";
const CARD = "#0B0C10";
const ACCENT = "#D4A574";
const WHITE = "#F5EFE6";
const MUTED = "#B9B0A4";

const kf = (...pairs) => pairs.map(([f, v, e]) => ({ f, v, ...(e ? { e } : {}) }));

/** A soft scrim behind any text on a photograph/document, so text reads at phone size. */
export function scrimLayer({ id, rect = { x: 0, y: 0, w: W, h: H }, inF, outF, z }) {
  return solidLayer({ id, rect, background: "rgba(0,0,0,0.55)", inF, outF, z, opacity: 1 });
}

/** A small text tag crediting a photo/document, bottom-left of its frame. */
export function creditLayer({ id, text, rect, inF, outF, z, size = 14 }) {
  return textLayer({ id, text, rect, size, color: WHITE, align: "left", valign: "bottom", weight: 500, lineHeight: 1.15, inF, outF, z, shadow: true, font: "Inter" });
}

/** Staggered concept labels, one per beat concept, drawn in reading order. */
export function labelLayers({ idBase, labels, rects, inF, outF, z, size = 26, color = WHITE, delay = 8 }) {
  const layers = [];
  const span = Math.max(1, outF - inF);
  labels.forEach((label, k) => {
    const r = rects[k] || { x: 90, y: 300 + k * 130, w: 900, h: 110 };
    layers.push(textLayer({
      id: `${idBase}-label-${k}`, text: label, rect: r, size, color, align: "left", valign: "top",
      lineHeight: 1.15, weight: 700, font: "Cormorant Garamond", shadow: true, inF, outF,
      z: z + k * 2,
      keyframes: { opacity: [{ f: 0, v: 0, e: "outCubic" }, { f: Math.min(span, delay + k * 7), v: 1, e: "outCubic" }, { f: span, v: 1 }] },
    }));
  });
  return layers;
}

/** ------------------------------------------------------------------ DIAGRAMS */

/** Date diagram: a year on a horizontal timeline with a tick at its date. */
export function dateDiagram({ id, value, label, inF, outF, z, rect = { x: 90, y: 600, w: 900, h: 700 } }) {
  const span = Math.max(1, outF - inF);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2 - 60;
  return [
    solidLayer({ id: `${id}-plate`, rect: { x: rect.x, y: rect.y - 110, w: rect.w, h: 220 }, background: CARD, inF, outF, z: z, opacity: 1 }),
    textLayer({ id: `${id}-label`, text: label, rect: { x: rect.x, y: rect.y - 100, w: rect.w, h: 70 }, size: 40, color: WHITE, align: "center", valign: "top", weight: 700, font: "Cormorant Garamond", shadow: true, inF, outF, z: z + 1 }),
    textLayer({ id: `${id}-year`, text: String(value), rect: { x: rect.x, y: rect.y - 20, w: rect.w, h: 200 }, size: 150, color: ACCENT, align: "center", valign: "middle", weight: 900, font: "Cormorant Garamond", shadow: true, inF, outF, z: z + 2 }),
    svgLayer({ id: `${id}-line`, rect: { x: rect.x + 60, y: rect.y + rect.h - 120, w: rect.w - 120, h: 40 }, paths: [{ d: `M0 20 L${rect.w - 120} 20`, stroke: MUTED, strokeWidth: 4 }], inF, outF, z: z + 3, drawFrames: 12 }),
    svgLayer({ id: `${id}-tick`, rect: { x: rect.x + 60 + (rect.w - 120) * 0.5 - 6, y: rect.y + rect.h - 130, w: 12, h: 30 }, paths: [{ d: "M6 0 L6 30", stroke: ACCENT, strokeWidth: 5 }], inF, outF, z: z + 4, drawFrames: 10 }),
  ];
}

/** Version diagram: two stacked version bars with a plus arrow between them. */
export function versionDiagram({ id, a, b, inF, outF, z, rect = { x: 90, y: 560, w: 900, h: 660 } }) {
  const span = Math.max(1, outF - inF);
  const rowH = 130, gap = 160;
  return [
    textLayer({ id: `${id}-kicker`, text: "Version upgrade", rect: { x: rect.x, y: rect.y - 70, w: rect.w, h: 50 }, size: 28, color: MUTED, align: "left", valign: "top", weight: 600, font: "Inter", shadow: true, inF, outF, z: z }),
    textLayer({ id: `${id}-a`, text: a, rect: { x: rect.x, y: rect.y, w: rect.w, h: rowH }, size: 80, color: WHITE, align: "left", valign: "middle", weight: 800, font: "Cormorant Garamond", shadow: true, inF, outF, z: z + 1 }),
    svgLayer({ id: `${id}-bar-a`, rect: { x: rect.x + 20, y: rect.y + 110, w: rect.w - 40, h: 6 }, paths: [{ d: `M0 3 L${rect.w - 40} 3`, stroke: MUTED, strokeWidth: 4 }], inF, outF, z: z + 2, drawFrames: 14 }),
    textLayer({ id: `${id}-b`, text: b, rect: { x: rect.x, y: rect.y + gap, w: rect.w, h: rowH }, size: 80, color: ACCENT, align: "left", valign: "middle", weight: 800, font: "Cormorant Garamond", shadow: true, inF, outF, z: z + 3 }),
    svgLayer({ id: `${id}-bar-b`, rect: { x: rect.x + 20, y: rect.y + gap + 110, w: rect.w - 40, h: 6 }, paths: [{ d: `M0 3 L${rect.w - 40} 3`, stroke: ACCENT, strokeWidth: 4 }], inF, outF, z: z + 4, drawFrames: 14 }),
    svgLayer({ id: `${id}-arrow`, rect: { x: rect.x + rect.w / 2 - 30, y: rect.y + rowH + 20, w: 60, h: gap - 40 }, paths: [{ d: `M30 0 L30 ${gap - 40} M20 ${gap - 50} L30 ${gap - 40} L40 ${gap - 50}`, stroke: ACCENT, strokeWidth: 6 }], inF, outF, z: z + 5, drawFrames: 12 }),
  ];
}

/** Figure-count diagram: one big number plus a subtitle saying what it counts. */
export function numberDiagram({ id, number, label, inF, outF, z, rect = { x: 90, y: 520, w: 900, h: 700 } }) {
  const span = Math.max(1, outF - inF);
  return [
    textLayer({ id: `${id}-number`, text: String(number), rect: { x: rect.x, y: rect.y - 40, w: rect.w, h: 260 }, size: 170, color: ACCENT, align: "left", valign: "top", weight: 900, font: "Cormorant Garamond", shadow: true, inF, outF, z: z + 1 }),
    textLayer({ id: `${id}-label`, text: label, rect: { x: rect.x, y: rect.y + 240, w: rect.w, h: 140 }, size: 34, color: WHITE, align: "left", valign: "top", weight: 700, lineHeight: 1.2, font: "Cormorant Garamond", shadow: true, inF, outF, z: z + 2 }),
  ];
}

/** Clock diagram: a steering-wheel face with two marked zones at 10 and 2 o'clock. */
export function clockDiagram({ id, positions = [10, 2], label, inF, outF, z, rect = { x: 90, y: 420, w: 900, h: 1000 } }) {
  const span = Math.max(1, outF - inF);
  const cx = rect.w / 2, cy = rect.h / 2 - 40, r = Math.min(rect.w, rect.h) * 0.34;
  const degToXY = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const zones = positions.map((p) => ({ deg: p * 30, xy: degToXY(p * 30) }));
  const ring = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy - r + 0.1} Z`;
  const paths = [{ d: ring, stroke: MUTED, strokeWidth: 18 }];
  zones.forEach((zc, k) => {
    paths.push({ d: `M ${cx} ${cy} L ${zc.xy.x} ${zc.xy.y}`, stroke: ACCENT, strokeWidth: 10 });
    paths.push({ d: `M ${zc.xy.x} ${zc.xy.y} L ${cx + (zc.xy.x - cx) * 1.25} ${cy + (zc.xy.y - cy) * 1.25}`, stroke: ACCENT, strokeWidth: 10 });
  });
  return [
    solidLayer({ id: `${id}-plate`, rect: { x: rect.x, y: rect.y - 90, w: rect.w, h: 130 }, background: CARD, inF, outF, z: z, opacity: 1 }),
    textLayer({ id: `${id}-label`, text: label || "Haptic zones at 10 and 2 o'clock", rect: { x: rect.x, y: rect.y - 80, w: rect.w, h: 70 }, size: 28, color: MUTED, align: "center", valign: "top", weight: 600, font: "Inter", shadow: true, inF, outF, z: z + 1 }),
    svgLayer({ id: `${id}-wheel`, rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, viewBox: [0, 0, rect.w, rect.h], paths, inF, outF, z: z + 2, drawFrames: 30 }),
    textLayer({ id: `${id}-zones`, text: positions.map((p) => `${p} o'clock`).join("   +   "), rect: { x: rect.x, y: rect.y + rect.h - 60, w: rect.w, h: 50 }, size: 36, color: ACCENT, align: "center", valign: "top", weight: 800, font: "Inter", shadow: true, inF, outF, z: z + 3 }),
  ];
}

/** Relation diagram: two named boxes with an arrow between them. */
export function relationDiagram({ id, a, b, link, inF, outF, z, rect = { x: 90, y: 480, w: 900, h: 700 } }) {
  const span = Math.max(1, outF - inF);
  const ay = rect.y + 140, by = rect.y + rect.h - 260;
  return [
    solidLayer({ id: `${id}-a-box`, rect: { x: rect.x, y: ay - 70, w: rect.w, h: 140 }, background: CARD, inF, outF, z: z, opacity: 1 }),
    textLayer({ id: `${id}-a`, text: a, rect: { x: rect.x + 20, y: ay - 70, w: rect.w - 40, h: 140 }, size: 36, color: WHITE, align: "center", valign: "middle", weight: 800, font: "Cormorant Garamond", shadow: true, inF, outF, z: z + 1 }),
    solidLayer({ id: `${id}-b-box`, rect: { x: rect.x, y: by - 70, w: rect.w, h: 140 }, background: CARD, inF, outF, z: z + 4, opacity: 1 }),
    textLayer({ id: `${id}-b`, text: b, rect: { x: rect.x + 20, y: by - 70, w: rect.w - 40, h: 140 }, size: 36, color: WHITE, align: "center", valign: "middle", weight: 800, font: "Cormorant Garamond", shadow: true, inF, outF, z: z + 5 }),
    svgLayer({ id: `${id}-arrow`, rect: { x: rect.x, y: ay + 20, w: rect.w, h: by - ay - 40 }, paths: [{ d: `M${rect.w / 2} 0 L${rect.w / 2} ${by - ay - 40} M${rect.w / 2 - 14} ${by - ay - 54} L${rect.w / 2} ${by - ay - 40} L${rect.w / 2 + 14} ${by - ay - 54}`, stroke: ACCENT, strokeWidth: 8 }], inF, outF, z: z + 2, drawFrames: 20 }),
    textLayer({ id: `${id}-link`, text: link, rect: { x: rect.x, y: ay + 30, w: rect.w, h: by - ay - 60 }, size: 26, color: MUTED, align: "center", valign: "middle", lineHeight: 1.25, font: "Inter", shadow: true, inF, outF, z: z + 3 }),
  ];
}

/** Causal diagram: cause box -> arrow -> effect box. */
export function causalDiagram({ id, cause, effect, inF, outF, z, rect = { x: 90, y: 460, w: 900, h: 740 } }) {
  return relationDiagram({ id, a: cause, b: effect, link: "leads to", inF, outF, z, rect });
}

/** Plea diagram: a single box stating what was refused. */
export function pleaDiagram({ id, label, inF, outF, z, rect = { x: 90, y: 560, w: 900, h: 420 } }) {
  const span = Math.max(1, outF - inF);
  return [
    solidLayer({ id: `${id}-box`, rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, background: CARD, inF, outF, z: z, opacity: 1 }),
    textLayer({ id: `${id}-text`, text: label, rect: { x: rect.x + 30, y: rect.y, w: rect.w - 60, h: rect.h }, size: 40, color: WHITE, align: "center", valign: "middle", lineHeight: 1.25, weight: 700, font: "Cormorant Garamond", shadow: true, inF, outF, z: z + 1 }),
  ];
}

/** Flow diagram: a chain of up to four stacked nodes with arrows between. */
export function flowDiagram({ id, nodes, link, inF, outF, z, rect = { x: 90, y: 420, w: 900, h: 900 } }) {
  const span = Math.max(1, outF - inF);
  const n = nodes.length || 1;
  const nodeH = 110, gap = (rect.h - n * nodeH) / Math.max(1, n + 1);
  const layers = [];
  nodes.forEach((node, k) => {
    const y = rect.y + gap + k * (nodeH + gap);
    layers.push(solidLayer({ id: `${id}-node-${k}`, rect: { x: rect.x, y: y - 55, w: rect.w, h: nodeH }, background: CARD, inF, outF, z: z + k * 2, opacity: 1 }));
    layers.push(textLayer({ id: `${id}-node-text-${k}`, text: node, rect: { x: rect.x + 20, y: y - 55, w: rect.w - 40, h: nodeH }, size: 30, color: WHITE, align: "center", valign: "middle", weight: 700, font: "Inter", shadow: true, inF, outF, z: z + k * 2 + 1 }));
    if (k < n - 1) {
      const ay = y + nodeH / 2 + gap / 2;
      layers.push(svgLayer({ id: `${id}-arrow-${k}`, rect: { x: rect.x, y: ay, w: rect.w, h: gap }, paths: [{ d: `M${rect.w / 2} 0 L${rect.w / 2} ${gap} M${rect.w / 2 - 12} ${gap - 16} L${rect.w / 2} ${gap} L${rect.w / 2 + 12} ${gap - 16}`, stroke: ACCENT, strokeWidth: 7 }], inF, outF, z: z + k * 2 + 2, drawFrames: 14 }));
    }
  });
  if (link) {
    layers.push(textLayer({ id: `${id}-link`, text: link, rect: { x: rect.x, y: rect.y + rect.h - 50, w: rect.w, h: 40 }, size: 24, color: MUTED, align: "center", valign: "top", weight: 500, font: "Inter", shadow: true, inF, outF, z: z + n * 2 + 1 }));
  }
  return layers;
}

/** Negotiation diagram: driver box <-> system box with double arrow. */
export function negotiationDiagram({ id, inF, outF, z, rect = { x: 90, y: 500, w: 900, h: 660 } }) {
  return relationDiagram({ id, a: "Driver", b: "Autonomous system", link: "two-way negotiation", inF, outF, z, rect });
}

/** AI diagram: workflow box -> AI tag -> output box. */
export function aiDiagram({ id, inF, outF, z, rect = { x: 90, y: 460, w: 900, h: 740 } }) {
  return flowDiagram({ id, nodes: ["Integration workflows", "Artificial intelligence", "Enterprise agents"], link: "connect using AI", inF, outF, z, rect });
}

/** Label card: a single centred phrase on a card, used when no real image exists. */
export function labelCard({ id, text, inF, outF, z, rect = { x: 90, y: 560, w: 900, h: 340 }, color = CARD, size = 40 }) {
  const span = Math.max(1, outF - inF);
  return [
    solidLayer({ id: `${id}-card`, rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, background: color, inF, outF, z: z, opacity: 1 }),
    textLayer({ id: `${id}-text`, text, rect: { x: rect.x + 30, y: rect.y, w: rect.w - 60, h: rect.h }, size, color: WHITE, align: "center", valign: "middle", lineHeight: 1.3, weight: 700, font: "Cormorant Garamond", shadow: true, inF, outF, z: z + 1 }),
  ];
}
