/**
 * MOTION-GRAPHICS-MANUAL.md — design system, Part A. PURE module (no React,
 * no Remotion): runs in node for verify-compositions.js AND in the bundle.
 *
 * A1 canvas/grid, A2 colour roles + contrast gate, A3 type scale, A4 icon
 * stroke arithmetic. Motion tokens (D) live in beats.js; easing curves (E)
 * are defined in the composition where Remotion's Easing is available.
 */

import {
  D,
  CANVAS,
  SAFE,
  OPTICAL_CENTRE_X,
  OPTICAL_CENTRE_Y,
  MG_TYPE as TYPE,
  CAPTION,
  CAPTION_LIMITS,
} from "./beats.js";

export { D, CANVAS, SAFE, OPTICAL_CENTRE_X, OPTICAL_CENTRE_Y, TYPE, CAPTION, CAPTION_LIMITS };

/** Vertical zones — A1.3. Fixed for every beat. */
import { SLOTS_SHORTS } from "../layout/slots.js";

/** Vertical zones — A1.3. Fixed for every beat. Derived from the slot table
 * (layout/slots.js) so the composition can never drift from the spec again. */
export const ZONES = {
  kicker: { top: SLOTS_SHORTS.kicker.y, bottom: SLOTS_SHORTS.kicker.y + SLOTS_SHORTS.kicker.h },
  stage: { top: SLOTS_SHORTS.stage.y, bottom: SLOTS_SHORTS.stage.y + SLOTS_SHORTS.stage.h },
  headline: { top: SLOTS_SHORTS.headline.y, bottom: SLOTS_SHORTS.headline.y + SLOTS_SHORTS.headline.h },
  caption: { top: SLOTS_SHORTS.caption.y, bottom: SLOTS_SHORTS.caption.y + SLOTS_SHORTS.caption.h },
  rail: { x: SLOTS_SHORTS.rail.x, top: SLOTS_SHORTS.rail.y, bottom: SLOTS_SHORTS.rail.y + SLOTS_SHORTS.rail.h },
};

/** 8px base grid + 12-column grid — A1.1 / A1.2. */
export const GRID = { base: 8, cols: 12, col: 56, gutter: 8, pad: 40 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return (
    "#" +
    [r, g, b].map((v) => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, "0")).join("")
  );
}

/** Mix two hex colours by t ∈ [0,1] — A2.1 textDim / stroke / surface. */
export function mixColor(a, b, t) {
  const ra = hexToRgb(a) || [0, 0, 0];
  const rb = hexToRgb(b) || [0, 0, 0];
  return rgbToHex(ra.map((v, i) => v + (rb[i] - v) * clamp01(t)));
}

/** WCAG relative luminance — A2.4. */
export function luminance(hex) {
  const rgb = hexToRgb(hex) || [0, 0, 0];
  const [rs, gs, bs] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** WCAG contrast ratio (not rounded up) — A2.4. */
export function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

import { paletteFromHues, deriveHuesFromHexes } from "../styles/tokens.js";

/**
 * A2.1 — map a channel's hue pair (or legacy 3-hex palette) onto the fixed
 * role map. Stage 3 moved role derivation into styles/tokens.js
 * (paletteFromHues); the A2.1 mix formulas for textDim/stroke/surface are
 * superseded by OKLCH-derived roles (see audit-color ledger A-2). The legacy
 * hex-array form is still accepted so existing verify fixtures and fallback
 * palettes keep working: it is converted via deriveHuesFromHexes.
 */
export function rolesFromPalette(palette) {
  if (palette && typeof palette === "object" && !Array.isArray(palette)) {
    if (typeof palette.baseHue === "number" && typeof palette.accentHue === "number") {
      return paletteFromHues({ baseHue: palette.baseHue, accentHue: palette.accentHue });
    }
    if (typeof palette.bg === "string" && typeof palette.accent === "string") {
      return palette; // already derived roles
    }
  }
  if (Array.isArray(palette) && palette.length >= 3) {
    return paletteFromHues(deriveHuesFromHexes(palette));
  }
  // No palette / invalid shape: neutral dark default through the same token
  // path, so verifyPalette(null) reports rather than throwing.
  return paletteFromHues(deriveHuesFromHexes(FALLBACK_HEXES));
}

// Fallback 3-hex palette for null/malformed input (motion-graphics FALLBACK_PALETTE).
const FALLBACK_HEXES = ["#0F0F1A", "#E94560", "#F8FAFC"];

// A2.4 — contrast floor (AAA large text, see manual table).
export const CONTRAST_FLOOR = {
  textPrimary: 7,
  accent: 4.5,
  textDim: 4.5,
  stroke: 3,
};

/**
 * A2.4 gate (manual §9 H14) — run once per config change. Returns
 * { pass, results } where results maps pair → { ratio, min, pass }.
 */
export function verifyPalette(palette) {
  const roles = rolesFromPalette(palette);
  const results = {
    textPrimary_on_bg: { ratio: contrastRatio(roles.textPrimary, roles.bg), min: CONTRAST_FLOOR.textPrimary },
    accent_on_bg: { ratio: contrastRatio(roles.accent, roles.bg), min: CONTRAST_FLOOR.accent },
    textDim_on_bg: { ratio: contrastRatio(roles.textDim, roles.bg), min: CONTRAST_FLOOR.textDim },
    stroke_on_bg: { ratio: contrastRatio(roles.stroke, roles.bg), min: CONTRAST_FLOOR.stroke },
  };
  const failures = [];
  for (const [k, v] of Object.entries(results)) {
    v.pass = v.ratio >= v.min;
    if (!v.pass) failures.push(`${k}: ${v.ratio.toFixed(2)} < ${v.min}`);
  }
  return { palette, roles, results, pass: failures.length === 0, failures };
}

/**
 * A4.3 — Lucide stroke arithmetic. Apparent stroke must land between 6px and
 * 12px at 1080-wide; the SVG `stroke-width` attribute compensates for scale.
 */
export function strokeAttr(renderedSizePx, targetStrokePx = 10) {
  return (targetStrokePx * 24) / renderedSizePx;
}

/** A4.4 — icon sizes are fixed to exactly these four steps. */
export const ICON_SIZES = [64, 120, 180, 240];

/** A3.2 — scale factor for a canvas: u = min(w, h) / 1080. */
export function scaleUnit(width, height) {
  return Math.min(width, height) / 1080;
}

/**
 * A4.7 — keyword-driven, channel-scoped icon selection. Longest-key-first
 * against the beat text; falls back to the channel `default`. Never invents
 * an icon name — resolution still must be checked against the vendored set.
 */
export function resolveIcon(iconMap, text) {
  const map = iconMap || {};
  const terms = map.terms || {};
  const keys = Object.keys(terms).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    try {
      if (new RegExp(key, "i").test(String(text || ""))) return terms[key];
    } catch {
      // malformed regex key — skip, never crash a render over an icon map
    }
  }
  return map.default || "sparkles";
}
