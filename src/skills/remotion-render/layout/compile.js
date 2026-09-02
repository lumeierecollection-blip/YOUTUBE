/**
 * LAYOUT-SYSTEM.md Part 4 — the compiler. ShotSpec[] → ResolvedFrame[].
 *
 * Pure layout math, synchronous, runs in Node. Text measurement is NOT
 * performed here (ESCLAY-5-1, resolved 2026-08-07 option 1): the
 * @remotion/layout-utils functions throw outside a browser (machine-verified
 * on the installed 4.0.506), so measurement runs in the browser once, before
 * render, through layout/measure.js (font gate armed); its results are passed
 * into compile() as input (R3) and compile resolves geometry from them.
 *
 * The four rules (Part 4.1):
 *   R1 — Absolute only: every rect is emitted as { x, y, w, h } in frame px.
 *   R2 — Bottom-up for anything that grows: captions resolve their bottom edge
 *        from the safe bottom (1248) and extend upward; chart bars sit exactly
 *        on the axis (L8 by construction).
 *   R3 — Measure before place (browser-time): text rect geometry comes from
 *        the `fonts` (resolved fontSize per layer) and `measured`
 *        (width/lines per text|fontSize|fontFamily) inputs.
 *   R4 — Round then assert: snap to 8 px (displacement ≤ 4), assert every
 *        rect inside its slot (the §3.7 caption growth is the one exception),
 *        assert the slot inside the safe rect, assert atFrame resolution
 *        inside [0, durationInFrames]. Any failure THROWS with the beat id
 *        and role — a layout error becomes a build error, not a bad frame.
 *
 * Inputs:
 *   specs    — validated ShotSpec[] (schema.js). Per beat:
 *              { id, archetype, startFrame, durationInFrames,
 *                anchorTokenIndex, layers: [{ role, slot, align?, content,
 *                fit?, enter, exit }] }
 *   opts.fonts       — { [specId:layerIndex]: { fontSize, fontFamily } }
 *                      (browser fit, §5.2)
 *   opts.measured    — { [text|fontSize|fontFamily]: { width, lines } }
 *                      (browser measure step; compile-lint.measuredKey)
 *   opts.anchorFrame — { [specId]: beat-relative anchor frame } — the anchor
 *                      the spec's "anchor±n" atFrames resolve against
 *                      (beat.anchorFrame − beat.startFrame, mirrors
 *                      motion-graphics.jsx tA).
 *   opts.slots / opts.safe — slot + safe tables (defaults: Shorts).
 *
 * Output: ResolvedFrame[] — { beatId, startFrame, durationInFrames,
 *   rects: [{ role, slot, x, y, w, h, fontSize?, lines?, persistent,
 *            from, to, structural?, chart? }] }. `from`/`to` are the
 *   beat-relative resolved atFrames (inclusive). `chart` carries the
 *   resolved interior geometry L8–L10 verify: { axisY, gridX, barAreaTop,
 *   barW, gutter, bars: [{ x, w, h, bottom, highlight }], gutters,
 *   highlightIndex, axisLabelRight }.
 */

import {
  ACCENT_ROLE,
  PERSISTENT_ROLES,
  ROLE_FLOORS,
  STRUCTURAL_ROLES,
  TEXT_ROLES,
  anchoredRect,
  effectiveSlotFor,
  headlineContentBox,
  measuredKey,
  rectsOverlap,
  renderedTextForContent,
  resolveAtFrame,
  textBlockHeight,
} from "./compile-lint.js";
import {
  GRID,
  SAFE_LONGFORM,
  SAFE_SHORTS,
  SLOTS_LONGFORM,
  SLOTS_SHORTS,
  slotBounds,
  snapToGrid,
} from "./slots.js";

const DEFAULT_ALIGN = { kicker: "top-left", headline: "top-left", caption: "bottom", support: "top-left" };
const within = (v, min, max) => v >= min && v <= max;
const isNone = (p) => typeof p === "string" && /^none$/i.test(p);

/** §2.1.3 — resolve one enter/exit bound to a beat-relative frame. */
function rangeBound(motion, dur, anchorFrame, which, id, role) {
  if (!motion || isNone(motion.pattern)) return which === "enter" ? 0 : dur;
  const { frame, error } = resolveAtFrame(motion.atFrame, { anchorFrame, durationInFrames: dur });
  if (error) throw new Error(`${id} ${role}: ${which}.atFrame ${error} (R4)`);
  return frame;
}

/** R4 — atFrame resolution must land inside the beat (L12 at build time). */
function assertRange(id, role, from, to, dur) {
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    throw new Error(`${id} ${role}: resolved atFrame is not an integer (R4)`);
  }
  if (from < 0 || from > dur) {
    throw new Error(`${id} ${role}: enter resolves to ${from}, outside [0, ${dur}] (R4/L12)`);
  }
  if (to < 0 || to > dur) {
    throw new Error(`${id} ${role}: exit resolves to ${to}, outside [0, ${dur}] (R4/L12)`);
  }
  if (from > to) {
    throw new Error(`${id} ${role}: enter ${from} after exit ${to} (R4)`);
  }
}

/** R4 — assert the rect is inside its slot (effectiveSlotFor: §3.7 caption). */
function assertInsideSlot(id, rect, slot) {
  const b = slotBounds(effectiveSlotFor(rect, slot));
  const ok =
    within(rect.x, b.left, b.right) &&
    within(rect.x + rect.w, b.left, b.right) &&
    within(rect.y, b.top, b.bottom) &&
    within(rect.y + rect.h, b.top, b.bottom);
  if (!ok) {
    throw new Error(
      `${id} ${rect.role}: rect (${rect.x},${rect.y}) ${rect.w}×${rect.h} is outside slot ${rect.slot} ` +
        `(${b.left},${b.top})–(${b.right},${b.bottom}) (R4)`
    );
  }
}

/** R4 — every non-structural coordinate snaps to 8 with displacement ≤ 4
 *  (§3.5; §3.1 exempts the structural 4 px strokes from the grid). */
function assertGrid(id, rect) {
  if (rect.structural === true) return;
  for (const key of ["x", "y", "w", "h"]) {
    const v = rect[key];
    if (!Number.isFinite(v)) throw new Error(`${id} ${rect.role}: ${key}=${String(v)} not finite (R4)`);
    const { displacement } = snapToGrid(v, GRID.base);
    if (displacement > GRID.base / 2) {
      throw new Error(`${id} ${rect.role}: ${key}=${v} rounds more than ${GRID.base / 2}px (R4)`);
    }
  }
}

/** R3 — a text layer resolves from the browser-fed inputs; missing input is
 *  a build error, not a bad rect. §3.7/§5.3 — headline height is capped by
 *  the slot's published content box (slot.h − 48), which is why a headline
 *  is always 1 line at ≥84 px. */
function textRect(spec, layer, slot, layerKey, fonts, measured, from, to) {
  const role = layer.role;
  const text = renderedTextForContent(layer.content);
  if (!text) throw new Error(`${spec.id} ${role}: content has no text to measure (R3)`);
  const font = fonts[layerKey];
  if (!font || !Number.isFinite(font.fontSize)) {
    throw new Error(`${spec.id} ${role}: no resolved fontSize for layer ${layerKey} — browser measurement missing (R3)`);
  }
  const key = measuredKey(text, font.fontSize, font.fontFamily);
  const m = measured[key];
  if (!m || !Number.isFinite(m.width)) {
    throw new Error(
      `${spec.id} ${role}: no measured size for "${text}" (${font.fontSize}px/${font.fontFamily}) (R3/L5)`
    );
  }
  if (!Number.isInteger(m.lines) || m.lines < 1) {
    throw new Error(
      `${spec.id} ${role}: no measured line count for "${text}" (${font.fontSize}px/${font.fontFamily}) — ` +
        `a partial measured entry (width without lines) is a build error, not a bad rect (R3/L5)`
    );
  }
  const lines = m.lines;
  const w = snapToGrid(Math.min(m.width, slot.w), GRID.base).snapped;
  const h = textBlockHeight(font.fontSize, lines);
  if (role === "headline" && h > headlineContentBox(slot)) {
    throw new Error(
      `${spec.id} headline: ${h}px tall exceeds the ${headlineContentBox(slot)}px content box (§3.7/§5.3) — ` +
        `a headline can only be 1 line at ≥${ROLE_FLOORS.headline}px`
    );
  }
  const align = layer.align || DEFAULT_ALIGN[role] || "top-left";
  const { x, y } = anchoredRect(slot, align, w, h);
  return {
    role,
    slot: layer.slot,
    x,
    y,
    w,
    h,
    fontSize: font.fontSize,
    fontFamily: font.fontFamily,
    lines,
    persistent: PERSISTENT_ROLES.includes(role),
    from,
    to,
  };
}

/** §3.6 — chart interior geometry, pure math on the 12-column stage grid.
 *  The plot area is inset by GRID.pad; the axis sits 44 px above the stage
 *  bottom (40 pad + 4 axis-stroke clearance — chosen so the axis lands
 *  exactly on the 8 px grid: 392 + 548 − 44 = 896). Bars are bottom-up
 *  (R2): every bar's bottom IS the axis (L8 by construction); gutters are
 *  one constant, so every gutter is equal (L9 by construction); the axis
 *  label right edge is gridX − 12 (L10 by construction). */
function chartRect(spec, layer, slot, from, to) {
  const content = layer.content || {};
  const series = Array.isArray(content.series) ? content.series : [];
  if (series.length < 1) throw new Error(`${spec.id} chart: requires series data (R4)`);
  const pad = GRID.pad;
  const x = slot.x + pad;
  const plotW = slot.w - 2 * pad;
  const axisY = slot.y + slot.h - (pad + GRID.base / 2);
  const barAreaTop = slot.y + pad;
  const plotH = axisY - barAreaTop;
  const gridX = x;
  const max = Math.max(...series.map((s) => Math.abs(Number(s.value) || 0)), 1);
  const n = series.length;
  const gutter = GRID.gutter;
  const barW = snapToGrid((plotW - (n - 1) * gutter) / n, GRID.base).snapped;
  const bars = series.map((s, i) => {
    const v = Math.abs(Number(s.value) || 0);
    const hRaw = (v / max) * plotH;
    const h = Math.max(snapToGrid(hRaw, GRID.base).snapped, GRID.base);
    return {
      label: s.label,
      value: s.value,
      x: snapToGrid(x + i * (barW + gutter), GRID.base).snapped,
      w: barW,
      h,
      y: axisY - h,
      bottom: axisY,
      highlight: s.highlight === true,
    };
  });
  const highlightIndex = series.findIndex((s) => s.highlight === true);
  return {
    role: "chart",
    slot: layer.slot,
    x,
    y: barAreaTop,
    w: plotW,
    h: plotH,
    persistent: false,
    from,
    to,
    chart: {
      axisY,
      gridX,
      barAreaTop,
      barW,
      gutter,
      bars,
      gutters: bars.map(() => gutter),
      highlightIndex,
      axisLabelRight: gridX - 12,
    },
  };
}

/** Compile one ShotSpec into one ResolvedFrame. Throws on any R4 violation. */
function compileBeat(spec, ctx) {
  const { slots, safe, measured, fonts, anchorFrame } = ctx;
  const dur = spec.durationInFrames;
  const rects = [];
  const accentLayers = [];

  for (let i = 0; i < spec.layers.length; i++) {
    const layer = spec.layers[i];
    const role = layer.role;
    const slot = slots[layer.slot];
    if (!slot) throw new Error(`${spec.id} ${role}: slot "${layer.slot}" does not exist in the table (R4)`);
    const b = slotBounds(slot);
    const safeOk =
      within(b.left, safe.left, safe.right) &&
      within(b.right, safe.left, safe.right) &&
      within(b.top, safe.top, safe.bottom) &&
      within(b.bottom, safe.top, safe.bottom);
    if (!safeOk) throw new Error(`${spec.id} ${role}: slot ${layer.slot} is outside the safe rect (R4)`);

    const from = rangeBound(layer.enter, dur, anchorFrame, "enter", spec.id, role);
    const to = rangeBound(layer.exit, dur, anchorFrame, "exit", spec.id, role);
    assertRange(spec.id, role, from, to, dur);

    if (role === "chart") {
      rects.push(chartRect(spec, layer, slot, from, to));
    } else if (role === "rail") {
      // §3.1 / TYP-18 — the structural 4 px stroke rule, exempt from the grid.
      rects.push({
        role,
        slot: layer.slot,
        x: slot.x,
        y: slot.y,
        w: slot.w,
        h: slot.h,
        structural: STRUCTURAL_ROLES.includes(role),
        persistent: true,
        from: 0,
        to: dur,
      });
    } else if (TEXT_ROLES.includes(role)) {
      rects.push(textRect(spec, layer, slot, `${spec.id}:${i}`, fonts, measured, from, to));
    } else if (role === ACCENT_ROLE) {
      accentLayers.push({ layer, from, to });
    } else {
      throw new Error(`${spec.id} ${role}: unknown role (R4)`);
    }
  }

  // L7 — one accent per frame: the accent rule sits beneath the headline.
  if (accentLayers.length > 1) {
    throw new Error(`${spec.id}: ${accentLayers.length} accent layers — L7 wants exactly one (R4)`);
  }
  if (accentLayers.length === 1) {
    const headline = rects.find((r) => r.role === "headline");
    if (!headline) throw new Error(`${spec.id} accent: accent rule requires a headline to sit beneath (R4)`);
    const a = accentLayers[0];
    if (a.layer.slot !== headline.slot) {
      throw new Error(
        `${spec.id} accent: declared slot "${a.layer.slot}" differs from the headline's "${headline.slot}" — ` +
          `the accent rule sits beneath the headline term (R4)`
      );
    }
    rects.push({
      role: ACCENT_ROLE,
      slot: a.layer.slot,
      x: headline.x,
      y: headline.y + headline.h,
      w: headline.w,
      h: GRID.base / 2, // 4 px TYP-18 stroke
      structural: STRUCTURAL_ROLES.includes(ACCENT_ROLE),
      persistent: false,
      from: a.from,
      to: a.to,
      accent: true,
    });
  }

  // §3.7 / §5.3 — the headline and the caption must never collide (the
  // headline slot publishes its occupied height; a two-line caption grows
  // into the slot's lower 48 px, never over the headline text).
  const headline = rects.find((r) => r.role === "headline");
  const caption = rects.find((r) => r.role === "caption");
  if (headline && caption && rectsOverlap(headline, caption)) {
    throw new Error(
      `${spec.id}: headline rect collides with the caption rect (§3.7/§5.3) — use a 1-line headline or a 1-line caption`
    );
  }

  // R4 — final assertions on every emitted rect.
  for (const rect of rects) {
    assertInsideSlot(spec.id, rect, slots[rect.slot]);
    assertGrid(spec.id, rect);
  }

  return { beatId: spec.id, startFrame: spec.startFrame, durationInFrames: dur, rects };
}

/**
 * ShotSpec[] → ResolvedFrame[]. Throws on the first R4 violation (a layout
 * error becomes a build error). The returned frames are the exact input
 * lintAll() verifies — compile guarantees R1–R4, lint verifies L1–L12 on any
 * ResolvedFrame[] including hand-written ones.
 */
export function compile(specs, opts = {}) {
  const slots = opts.slots || SLOTS_SHORTS;
  const safe = opts.safe || SAFE_SHORTS;
  const measured = opts.measured || {};
  const fonts = opts.fonts || {};
  const anchorFrames = opts.anchorFrame || {};
  if (!Array.isArray(specs)) throw new Error("compile: specs must be an array (R4)");
  return specs.map((spec) =>
    compileBeat(spec, {
      slots,
      safe,
      measured,
      fonts,
      anchorFrame: anchorFrames[spec.id] ?? 0,
    })
  );
}
