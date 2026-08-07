/**
 * src/skills/remotion-render/styles/tokens.js
 *
 * audit-color lane (Stage 3) — single derivation point for every channel
 * palette. Replaces per-channel hex `thumbnail_spec.color_palette` arrays:
 * channels.json now carries numeric `baseHue` / `accentHue` (degrees on the
 * OKLCH hue circle) and every role colour is derived HERE, at runtime.
 *
 * Provenance (see data/audit/3/audit-color.ledger.md for the full claim
 * cards and evidence):
 *
 *  - Elevation ladder E0/E1/E2 = B1 of DETAIL-REFERENCE (0.16 / 0.23 / 0.29).
 *  - Stroke L is AMENDED from B1's 0.40 to 0.50: with 8-bit quantisation,
 *    L 0.40 gives min stroke/bg contrast 2.075:1 (COL-04 requires >= 3:1);
 *    L 0.50 gives min 3.177:1. B1.1's intent (outline clearly separated from
 *    every elevation) is preserved — ΔL from E2 grows 0.11 -> 0.21.
 *  - Role lightness/chroma constants were selected so COL-01..06 pass on all
 *    50 channels with the margins in the ledger (computed on the quantised
 *    hexes; WCAG relative luminance, no rounding, 0.04045 threshold).
 *  - The 0–16% overlay mechanism of Material M2 was replaced by tonal
 *    surfaces (material-components Dark.md); an absolute-L ladder against
 *    `baseHue` is the current-approach implementation.
 *
 * This module is dependency-free ESM so any render/verify tool can import it.
 */

// ---------------------------------------------------------------------------
// OKLCH <-> sRGB and WCAG math (self-contained; audit harness in
// data/audit/3/oklch.js mirrors it, and verify-final imports THIS module).
// ---------------------------------------------------------------------------

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) throw new Error(`tokens: invalid hex "${hex}"`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  return `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1).toUpperCase()}`;
}

export function srgbToOklab({ r, g, b }) {
  const f = (v) => {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  };
  const [r1, g1, b1] = [f(r), f(g), f(b)];
  const l = 0.4122214708 * r1 + 0.5363325363 * g1 + 0.0514459929 * b1;
  const m = 0.2119034982 * r1 + 0.6806995451 * g1 + 0.1073969566 * b1;
  const s = 0.0883024619 * r1 + 0.2817188376 * g1 + 0.6299787005 * b1;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklabToSrgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b2 = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const linToSrgb = (c) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return {
    r: 255 * clamp(linToSrgb(r)),
    g: 255 * clamp(linToSrgb(g)),
    b: 255 * clamp(linToSrgb(b2)),
  };
}

export function oklchFromHex(hex) {
  const { L, a, b } = srgbToOklab(hexToRgb(hex));
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

export function hexFromOklch(L, C, h) {
  const hr = (h * Math.PI) / 180;
  const { r, g, b } = oklabToSrgb({ L, a: C * Math.cos(hr), b: C * Math.sin(hr) });
  return rgbToHex({ r, g, b });
}

export function roundHue(h) {
  let v = h % 360;
  if (v < 0) v += 360;
  return Math.round(v * 10) / 10;
}

export function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  // round to 1e-9: suppresses binary float noise when both hues are
  // decimal-rounded values whose mathematical difference is exact (e.g.
  // 127.1 - 67.1 = 59.99999999999999 in IEEE-754)
  return Math.round(Math.min(d, 360 - d) * 1e9) / 1e9;
}

export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05); // WCAG 2.2; NOT rounded (WAI 1.4.3)
}

// ---------------------------------------------------------------------------
// Palette derivation
// ---------------------------------------------------------------------------

/** Elevation ladder — B1 of DETAIL-REFERENCE (unchanged). */
export const ELEVATION = Object.freeze({ E0: 0.16, E1: 0.23, E2: 0.29 });

/** Stroke lightness — AMENDED from B1's 0.40 (see header + ledger COL-04 card). */
export const STROKE_L = 0.5;

/**
 * Locked role parameters (audit-color Stage 3; margins in ledger appendix).
 * C_BG/ L_TEXT/ C_TEXT / L_DIM / L_ACC / C_ACC selected so COL-01..06 pass on
 * all 50 channels; L_STROKE is the minimal value passing COL-04 (>= 3:1).
 */
export const PALETTE_PARAMS = Object.freeze({
  C_BG: 0.03,
  L_TEXT: 0.9,
  C_TEXT: 0.02,
  L_DIM: 0.61,
  L_ACC: 0.6,
  C_ACC: 0.17,
});

/**
 * Derive all seven role colours from a channel's baseHue/accentHue.
 * @param {{baseHue:number, accentHue:number}} hues degrees on the OKLCH hue
 * circle (values as authored in channels.json).
 * @returns {{bg:string, surface:string, raised:string, stroke:string,
 *            textPrimary:string, textDim:string, accent:string}} 8-bit hexes.
 */
export function paletteFromHues({ baseHue, accentHue }) {
  const { C_BG, L_TEXT, C_TEXT, L_DIM, L_ACC, C_ACC } = PALETTE_PARAMS;
  return {
    bg: hexFromOklch(ELEVATION.E0, C_BG, baseHue),
    surface: hexFromOklch(ELEVATION.E1, C_BG, baseHue),
    raised: hexFromOklch(ELEVATION.E2, C_BG, baseHue),
    stroke: hexFromOklch(STROKE_L, C_BG, baseHue),
    textPrimary: hexFromOklch(L_TEXT, C_TEXT, baseHue),
    textDim: hexFromOklch(L_DIM, C_TEXT, baseHue),
    accent: hexFromOklch(L_ACC, C_ACC, accentHue),
  };
}

/**
 * Provenance only: recover baseHue/accentHue from a legacy 3-hex palette
 * (the pre-Stage-3 `thumbnail_spec.color_palette` arrays). The 60° rule is
 * applied here, but the COL-09 duplicate tiebreak is NOT — it depends on the
 * global channel set and was applied once when the values were authored into
 * channels.json, so the stored values are authoritative.
 */
export function deriveHuesFromHexes(palette) {
  if (!Array.isArray(palette) || palette.length < 3) {
    throw new Error("tokens: deriveHuesFromHexes needs a 3-element hex palette");
  }
  let baseHue = null;
  for (const hex of [palette[0], palette[2], palette[1]]) {
    const { C, h } = oklchFromHex(hex);
    if (C >= 0.005) { baseHue = roundHue(h); break; }
  }
  if (baseHue === null) baseHue = 265; // fully achromatic palette fallback
  const accentHue = roundHue(oklchFromHex(palette[1]).h);
  const d = ((accentHue - baseHue) % 360 + 360) % 360;
  if (d < 60) return { baseHue: roundHue(accentHue - 60), accentHue };
  if (d > 300) return { baseHue: roundHue(accentHue + 60), accentHue };
  return { baseHue, accentHue };
}

/**
 * COL-01..06 gate values for a derived palette (returns raw ratios, unrounded).
 * Consumers may use this in place of the legacy verifyPalette, which lacked
 * the 17:1 ceiling and the hue-separation check.
 */
export function checkPaletteGates({ baseHue, accentHue }, roles) {
  return {
    c01: contrastRatio(roles.textPrimary, roles.bg), // 7:1 <= r <= 17:1
    c02: contrastRatio(roles.accent, roles.bg), // >= 4.5:1
    c03: contrastRatio(roles.accent, roles.textPrimary), // >= 2.5:1
    c04: contrastRatio(roles.stroke, roles.bg), // >= 3:1
    c05: contrastRatio(roles.textDim, roles.bg), // >= 4.5:1
    c06: hueDistance(accentHue, baseHue), // >= 60°
  };
}
