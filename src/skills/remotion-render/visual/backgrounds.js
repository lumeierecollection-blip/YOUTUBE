/**
 * Per-channel gradient grounds (owner's spec, 2026-09-30). Pure JS so the
 * renderer (full-canvas.jsx) and the render verify (scripts/render-and-qa.js)
 * read the same numbers.
 *
 * The ground is the studio wall, softly lit: two stops, low saturation, light
 * enough that dark ink reads on every part of it. It never animates. The
 * studio shadow overlay (studio-bg.jsx) is drawn over it; charts, maps and
 * cutouts sit directly on it; a full-bleed photo (SCENE-FULL) covers it for
 * its beat only.
 *
 * Dark variant: the same stops at 15% HSL lightness, for ONE dramatic hook
 * or CTA beat per video (the planner marks it `ground: "dark"`;
 * canvas-style.js assignEdgeDark keeps it to one hook / CTA beat that is not
 * a photo or map). Ink flips to light on it (full-canvas.jsx themeFor) —
 * dark ink on a 15% ground would be unreadable.
 *
 * Where this stops: only the six channels the spec named have their own
 * gradient. Every other channel gets DEFAULT_GRADIENT (the old off-white
 * studio tone as a two-stop gradient) until a gradient is specified for it.
 * Colour belongs in channels.json (CLAUDE.md); these six are kept here
 * because the owner's spec put them here, keyed by the channel's numeric id.
 */
const GRADIENT_ANGLE = 160;

const CHANNEL_GRADIENTS = {
  1: ["#F8F6F2", "#EDE9E1"],   // Money Mind
  2: ["#F5F2EC", "#E8E2D8"],   // Legal Brief
  9: ["#F4F6F8", "#E6EAEE"],   // Geopolitical / Border Lines
  26: ["#F6F4F5", "#EAE4E7"],  // Fraud Files
  44: ["#F8F6F0", "#EDE7D9"],  // Skill Stack
  48: ["#F2F4F4", "#E3E8E8"],  // Manufacturing / Factory Floor
};
export const DEFAULT_GRADIENT = ["#F7F5F1", "#EBE8E2"];

/** "ch-01" | "1" | 1 -> 1 (NaN when it has no number). */
function channelNumber(id) {
  const m = String(id ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : NaN;
}

export function gradientStops(channelId) {
  return CHANNEL_GRADIENTS[channelNumber(channelId)] || DEFAULT_GRADIENT;
}

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();

function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function fromHsl([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** The same stops at `lightness` (0..1) — the dark hook/CTA variant at 0.15. */
export function darkOf(stops, lightness = 0.15) {
  return stops.map((hex) => {
    const [h, s] = toHsl(hex2rgb(hex));
    return rgb2hex(fromHsl([h, s, lightness]));
  });
}

export function gradientCss(stops, angle = GRADIENT_ANGLE) {
  return `linear-gradient(${angle}deg, ${stops[0]} 0%, ${stops[stops.length - 1]} 100%)`;
}

/** The colour halfway along the gradient (a solid stand-in where one is needed: map dot strokes). */
export function gradientMid(stops) {
  const a = hex2rgb(stops[0]), b = hex2rgb(stops[stops.length - 1]);
  return rgb2hex(a.map((v, i) => (v + b[i]) / 2));
}

/** Rec. 601 luma of a hex colour, 0..255 (what ffmpeg's gray conversion measures). */
export function luma(hex) {
  const [r, g, b] = hex2rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
