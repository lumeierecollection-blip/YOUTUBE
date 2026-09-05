/**
 * src/skills/remotion-render/styles/tokens.js
 *
 * audit-color lane (Stage 3) — single derivation point for every channel
 * palette.
 *
 * REBUILT for the motion-graphics-rebuild-v2 pass (see MOTION-GRAPHICS-
 * MANUAL.md / CHECK-REGISTER.md DEL-17 retirement note): the previous
 * design derived `bg` as a dark, per-channel-hue-tinted OKLCH tone
 * (E0 = 0.16 lightness at the channel's baseHue, chroma 0.03). Measured
 * against real reference frames this produced a visible colour wash (a
 * green cast measured at mean RGB (9,38,23) on a channel whose accent hue
 * is green) instead of a neutral dark background — the chroma was never
 * zero, so every "dark" background carried its accent's hue at low
 * intensity. Reference material is flat pure white or flat pure black with
 * black/white ink and an accent used ONLY on shapes, never as a background
 * or text tint.
 *
 * `bg` is now literally #FFFFFF or #000000, chosen per channel via
 * `channels.json`'s `bg_mode` field — no hue, no chroma, no elevation
 * ladder. `surface`/`raised` collapse to `bg` (panels/chips separate from
 * the background with a hairline `stroke` border, never a tonal fill —
 * MOTION-GRAPHICS-MANUAL A5.2 "no shadows, no bevels, no glass"). `accent`
 * is still derived from the channel's `accentHue` (OKLCH hue circle) so
 * each channel keeps a distinct, meaningful accent colour, but its
*    lightness is now solved numerically per bg polarity so accent/bg
 *    contrast clears COL-02 (>=4.5:1) measured against the actual rendered
 *    background (pure bg + CanvasGrain) — the 5.3-vs-pure solve target
 *    leaves headroom for the grained white bg, which measures a mode of
 *    rgb(248-253) on real frames (see data/audit/16/color.ledger.md
 *    CLAIM-color-16-001); a 4.6-vs-pure solve drops to ~4.45:1 there.
 *
 * Provenance (see data/audit/3/audit-color.ledger.md for the original claim
 * cards; superseded where noted above):
 *  - Role lightness/chroma constants were selected so COL-01..06 pass on
 *    every channel (computed on the quantised hexes; WCAG relative
 *    luminance, no rounding, 0.04045 threshold).
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
// Palette derivation — flat bg_mode system
// ---------------------------------------------------------------------------

/** The only two backgrounds that exist. Pure, flat, zero chroma. */
export const BG_WHITE = "#FFFFFF";
export const BG_BLACK = "#000000";

/**
 * Text/line-work lightness. Never the literal bg-polarity extreme for TEXT
 * (pure #FFF-on-black reads harshly, pure #000 body text is standard but
 * near-black reads warmer) — "near-black" / "~92% white" per the reference
 * material read. Line work (stroke) reuses the same value: both are ink,
 * not fill, and both need to be unmistakably foreground against a pure
 * bg — a further-reduced stroke tone would just reintroduce a soft grey
 * wash by another name.
 */
export const INK = Object.freeze({
  white: { textPrimary: "#111111", stroke: "#111111" }, // white-mode ink (bg #FFFFFF)
  black: { textPrimary: "#EBEBEB", stroke: "#EBEBEB" }, // black-mode ink (bg #000000), ~92% white
});

/** Accent saturation. Lightness is solved per-bg by pickAccentL(), never fixed. */
export const C_ACC = 0.17;

/**
 * Binary-search the OKLCH lightness (fixed hue/chroma) that clears a target
 * WCAG contrast ratio against a flat bg, biased toward the MOST VIVID
 * (closest-to-mid-lightness) colour that still passes — i.e. the darkest
 * passing tone on a white bg, the lightest passing tone on a black bg —
 * rather than the extreme end of the search range. Falls back to whichever
 * bound has more contrast if no candidate clears the target (very low-
 * chroma hues at extreme lightness can fail to reach 4.5:1 at all).
 *
 * The default target is 5.3, NOT the 4.5 floor. First hardened pass
 * (data/audit/16 run 1) used 5.0 — that left every full-coverage role at
 * >=4.64:1 on the grained bg but the frame-03 vertical-line pixel (a
 * textDim hairline at ~96% AA coverage spanning both probe bands) still
 * measured 4.40:1 on the darkest draw (bg 248). 5.3 is the smallest
 * target whose ~96%-coverage blend clears 4.5 there (rgb(112) -> ~4.66:1;
 * full-coverage roles measure ~4.9-5.1:1 vs grained 248-253). The AA-
 * blended pixels at ~55% opacity or ~80% coverage stay unfixable by ANY
 * ink (convex blend bound) — those are geometry/FRM-02, filed as SFRs in
 * data/audit/16/color.ledger.md.
 */
export function pickAccentL(hue, chroma, bgHex, target = 5.3) {
  const bgIsLight = luminance(bgHex) > 0.5;
  const contrastAt = (L) => contrastRatio(hexFromOklch(L, chroma, hue), bgHex);
  let lo = 0.15,
    hi = 0.92;
  if (contrastAt(bgIsLight ? lo : hi) < target) return bgIsLight ? lo : hi;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const ok = contrastAt(mid) >= target;
    if (bgIsLight) {
      if (ok) lo = mid;
      else hi = mid;
    } else {
      if (ok) hi = mid;
      else lo = mid;
    }
  }
  return bgIsLight ? lo : hi;
}

/**
 * textDim: a muted secondary ink that still clears COL-05 (textDim/bg
 * >= 4.5:1) against the grained rendered bg — the 4.5 floor is not the
 * solve target, see pickAccentL's 5.0 note. Solved the same way as the
 * accent (chroma 0 — pure grey, never a hue tint) so it works identically
 * in both bg modes.
 */
function pickTextDimL(bgHex, target = 5.3) {
  return pickAccentL(0, 0, bgHex, target);
}

/**
 * Derive all seven role colours for a channel. `bg` is flat #FFFFFF or
 * #000000 per `bgMode` ("white" | "black") — no hue, no chroma, no
 * elevation. `surface`/`raised` collapse to `bg`: panels and chips
 * separate from the background with a hairline `stroke` border, never a
 * tonal fill (MOTION-GRAPHICS-MANUAL A5.2). `accent` keeps the channel's
 * `accentHue` (OKLCH hue circle) but its lightness is solved per bg
 * polarity so COL-02 (accent/bg >= 4.5:1) holds when measured against the
 * actual rendered (grained) bg — see pickAccentL's 5.3 target note.
 *
 * PASS `accent` TO KEEP THE CHANNEL'S DECLARED COLOUR. Solving the accent
 * from `accentHue` re-derives a colour that is NOT the one channels.json
 * declares in `colors.accent`: measured across all 17 channels, 17 of 17
 * differed, some heavily (ch-31 declares #FBBF24 and this solved #AF7400;
 * ch-35 declares #60A5FA and this solved #006BC9). `thumbnail_spec.accentHue`
 * is numeric on every channel, so every render took the derived value. The bg
 * and ink roles here are right and stay; only the accent was wrong.
 *
 * @param {{accentHue:number, bgMode?: "white"|"black", baseHue?:number,
 *          accent?:string}} hues
 *   accentHue is required; bgMode defaults to "black" when omitted (legacy
 *   callers / fixtures). baseHue is accepted but unused — bg no longer
 *   carries a hue (kept in the signature so old call sites don't throw).
 *   accent, when a hex string, is used VERBATIM instead of being solved from
 *   accentHue — that is how a caller supplies channels.json's own colour.
 * @returns {{bg:string, surface:string, raised:string, stroke:string,
 *            textPrimary:string, textDim:string, accent:string}} 8-bit hexes.
 */
export function paletteFromHues({ accentHue, bgMode, accent }) {
  const mode = bgMode === "white" ? "white" : "black";
  const bg = mode === "white" ? BG_WHITE : BG_BLACK;
  const ink = INK[mode];
  const accentL = pickAccentL(accentHue, C_ACC, bg);
  const textDimL = pickTextDimL(bg);
  return {
    bg,
    surface: bg,
    raised: bg,
    stroke: ink.stroke,
    textPrimary: ink.textPrimary,
    textDim: hexFromOklch(textDimL, 0, 0),
    accent: /^#[0-9a-fA-F]{6}$/.test(String(accent)) ? String(accent) : hexFromOklch(accentL, C_ACC, accentHue),
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

// ---------------------------------------------------------------------------
// Background texture — dot grid (DETAIL-REFERENCE Part B2; COL-17/18).
// audit-color lane, Stage 12. Dependency-free like the rest of this module.
//
// Provenance: the per-archetype values and geometry are TABLE-OWNED figures
// from DETAIL-REFERENCE.md B2 (6%/4%/0%, 64 px pitch, 4 px dot). Third-party
// practice grounds the TECHNIQUE (low-opacity dot-grid textures behind
// content — see data/audit/12/audit-color.ledger.md CLAIM COLOR-12-1), not
// the exact numbers; recorded there as a SPEC AMENDMENT (P3.5). The density
// is expressed as the grid layer's opacity, matching the repo convention
// (motion-graphics.jsx line 336 comment "dotGrid (stroke 6%)"). 0% renders
// NO grid layer (PROGRESS: a chart is already a grid; IMAGE_BEAT: the image
// occupies the stage; B2 table Notes column).
// ---------------------------------------------------------------------------

/** B2.3 — absolute pitch, 64 px, square. Never percentage-based. */
export const DOT_GRID_PITCH = 64;

/** B2.4 — dot diameter 4 px. */
export const DOT_DIAMETER = 4;

/**
 * B2 — per-archetype dot-grid density as layer opacity. 6% / 4% / 0%,
 * nothing between (B2.1), decided by the archetype, never by the channel.
 */
export const DOT_GRID = Object.freeze({
  HERO_NUMBER: 0.06,
  TERM_DEFINE: 0.06,
  LIST_ITEM: 0.04,
  CONTRAST: 0.04,
  PROGRESS: 0,
  RELATION: 0.06,
  IMAGE_BEAT: 0,
  STATEMENT: 0.06,
});

/**
 * Density for one archetype. Throws on any archetype not in the table:
 * a beat that reaches the background without a table row is schema drift
 * (COL-17 "exact"), and silently defaulting would paper over it.
 */
export function dotGridDensityForArchetype(archetype) {
  const d = DOT_GRID[archetype];
  if (d === undefined) {
    throw new Error(`dot-grid: no density for archetype "${archetype}" (COL-17) — beat/schema drift; add a B2 table row first`);
  }
  return d;
}

/**
 * B2.2 — one density per section: the minimum of its beats' densities
 * (adjacent beats with different densities resolve DOWN, so the background
 * never flickers mid-section). A section with no beats inherits its
 * predecessor's density — the background changes only at a section wipe.
 * Returns a plain object keyed by numeric sectionIndex.
 */
export function dotGridDensityPerSection(beats) {
  const bySection = new Map();
  for (const b of beats || []) {
    if (!b || typeof b.archetype !== "string") continue;
    const d = dotGridDensityForArchetype(b.archetype);
    const idx = Number(b.sectionIndex);
    if (Number.isNaN(idx)) continue;
    bySection.set(idx, Math.min(bySection.has(idx) ? bySection.get(idx) : d, d));
  }
  const out = {};
  let carry = 0;
  for (const idx of [...bySection.keys()].sort((x, y) => x - y)) {
    out[idx] = carry = bySection.get(idx);
  }
  return out;
}

/**
 * B2.2 — grid state for an absolute frame: the active section is the last
 * one whose `from` is <= frame (so gaps BETWEEN sections and the tail after
 * the last section keep the current density — the background changes only
 * at a section WIPE, never mid-section). Returns `{ opacity, dotSize,
 * gridSize }` or `null` (0% density — no grid layer, or before the first
 * section).
 */
export function dotGridStateForFrame(sectionRanges = {}, beats = [], frame) {
  const density = dotGridDensityPerSection(beats);
  const idxs = Object.keys(sectionRanges).map(Number).filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  if (!idxs.length) return null;
  let active = null;
  for (const idx of idxs) {
    const r = sectionRanges[idx];
    if (r && frame >= r.from) {
      // density[idx] undefined = section with no beats → inherits the
      // previous section's density (B2.2).
      if (density[idx] !== undefined) active = density[idx];
    }
  }
  return active !== null && active > 0
    ? { opacity: active, dotSize: DOT_DIAMETER, gridSize: DOT_GRID_PITCH }
    : null;
}
