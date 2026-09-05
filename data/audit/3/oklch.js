/**
 * data/audit/3/oklch.js — shared OKLCH / WCAG math for the Stage 3 colour
 * audit. PURE module: no deps, runs in node and in the bundle.
 *
 * Conversions follow Björn Ottosson's public-domain Oklab implementation
 * (bottosson.github.io/posts/oklab — 2020). WCAG relative luminance uses the
 * current 0.04045 threshold (w3.org/TR/WCAG22 — 2024-12-12).
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** sRGB 0-255 → OKLab L,a,b (0-1). */
export function srgbToOklab(r8, g8, b8) {
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const R = lin(r), G = lin(g), B = lin(b);
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** OKLab L,a,b (0-1) → sRGB 0-255, gamma-encoded, rounded. */
export function oklabToSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b2 = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const linToSrgb = (c) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return [
    Math.round(clamp01(linToSrgb(r)) * 255),
    Math.round(clamp01(linToSrgb(g)) * 255),
    Math.round(clamp01(linToSrgb(b2)) * 255),
  ];
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, "0")).join("");
}

/** OKLCH polar from a hex. h in degrees [0,360). */
export function oklchFromHex(hex) {
  const [r, g, b] = hexToRgb(hex);
  const { L, a, b: b_ } = srgbToOklab(r, g, b);
  const C = Math.hypot(a, b_);
  let h = (Math.atan2(b_, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

/** hex from OKLCH. C and h(deg). */
export function hexFromOklch(L, C, h) {
  const rad = (h * Math.PI) / 180;
  const [r, g, b] = oklabToSrgb(L, C * Math.cos(rad), C * Math.sin(rad));
  return rgbToHex([r, g, b]);
}

/** WCAG relative luminance — 0.04045 threshold (current spec). */
export function luminance(hex) {
  const rgb = hexToRgb(hex) || [0, 0, 0];
  const [rs, gs, bs] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** WCAG contrast ratio — NOT rounded. */
export function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Shortest hue distance on the OKLCH hue circle, degrees [0,180].
 * Rounded to 1e-9 to suppress IEEE-754 noise from subtracting decimal-rounded
 * hue values (mirrors tokens.js — audit == shipped).
 */
export function hueDistance(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return Math.round(d * 1e9) / 1e9;
}

/** Mix two hexes by t in gamma-encoded sRGB (matches mg-style A2.1). */
export function mixHex(a, b, t) {
  const ra = hexToRgb(a) || [0, 0, 0];
  const rb = hexToRgb(b) || [0, 0, 0];
  return rgbToHex(ra.map((v, i) => v + (rb[i] - v) * Math.max(0, Math.min(1, t))));
}

/** Round a hue to 1 decimal, wrapped to [0,360). */
export function roundHue(h) {
  return ((Math.round(h * 10) / 10) % 360 + 360) % 360;
}
