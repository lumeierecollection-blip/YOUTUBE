/**
 * The studio ground: uniform white — the DEFAULT on every beat of every video on
 * every channel (owner's decision, 2026-09-30 — it replaced the per-channel
 * gradients and the dark hook / CTA variant, which were wrong).
 *
 * No tint, no gradient, no vignette, no shadow overlay, no darkening: one
 * solid colour. Charts, maps and type render on it; a full-bleed photo beat
 * covers it for its own beat and the white returns on the next beat.
 *
 * A beat may now DECLARE a different ground (the planner's `ground` field, see
 * resolveGround below): the plan decides, white is what a beat gets when it says
 * nothing. The white path is untouched — a beat with no declared ground is drawn,
 * measured and audited exactly as before.
 *
 * Pure JS so the renderer (full-canvas.jsx, studio-bg.jsx), the render verify
 * (scripts/render-and-qa.js) and the audit read the same value.
 */
export const GROUND = "#FFFFFF";

/** Relative luminance (WCAG) of "#RRGGBB", 0 (black) .. 1 (white). */
export function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** A ground at or below this luminance takes the light-ink theme (white type reads better than black). */
export const DARK_LUMINANCE = 0.18;

// Colour words a planner description may use. Deliberately small: a word not here is
// "unparsed" and the beat keeps the default ground, logged — nothing is guessed.
const NAMED = {
  "off-white": "#F6F4F0", "off white": "#F6F4F0", "ivory": "#FAF7EE", "cream": "#F5EFE0", "beige": "#E9DFCB", "newsprint": "#E8E6E1",
  "paper": "#F2EFE8", "light grey": "#E6E6E8", "light gray": "#E6E6E8", "pale grey": "#ECECEE", "pale gray": "#ECECEE",
  "grey": "#8A8A8E", "gray": "#8A8A8E", "slate": "#3A4250", "dark grey": "#2A2A2D", "dark gray": "#2A2A2D", "charcoal": "#2A2A2D",
  "graphite": "#1F2023", "black": "#0B0B0C", "near-black": "#0E0E0E", "near black": "#0E0E0E", "dark": "#161618", "midnight": "#0B1020",
  "navy": "#0F1B33", "dark blue": "#0F1B33", "deep blue": "#10244A", "maroon": "#3A0F14", "dark red": "#3A0F14", "dark green": "#0E2A1C",
};
const NAMED_KEYS = Object.keys(NAMED).sort((a, b) => b.length - a.length);

/**
 * Resolve a planner `ground` value to a concrete ground.
 *   absent / "white" / "default"        -> { hex: null }            the house white, unchanged
 *   "#RRGGBB" / "#RGB" (or inside text) -> { hex }
 *   "transparent"                       -> { hex: null }            an MP4 has no alpha: the house ground shows
 *   a colour description ("deep navy")  -> { hex } via the table above
 *   anything else                       -> { hex: null, source: "unparsed" }
 * `hex: null` always means "draw the default GROUND". `dark` says the beat takes the light-ink theme.
 */
export function resolveGround(value) {
  const raw = value == null ? "" : String(value).trim();
  const out = (hex, source, note) => {
    const h = hex && hex.toUpperCase() !== GROUND ? hex.toUpperCase() : null;
    return { hex: h, source, dark: h ? luminance(h) <= DARK_LUMINANCE : false, ...(note ? { note } : {}) };
  };
  if (!raw) return out(null, "default");
  const s = raw.toLowerCase();
  if (/^(white|default|house|studio|plain white|#fff(?:fff)?)$/.test(s)) return out(null, "default");
  if (/transparent|see[- ]through/.test(s)) return out(null, "transparent", "an MP4 has no alpha channel; the house ground shows");
  const hex6 = /#([0-9a-f]{6})\b/i.exec(raw);
  if (hex6) return out(`#${hex6[1]}`, "hex");
  const hex3 = /#([0-9a-f])([0-9a-f])([0-9a-f])\b/i.exec(raw);
  if (hex3) return out(`#${hex3[1]}${hex3[1]}${hex3[2]}${hex3[2]}${hex3[3]}${hex3[3]}`, "hex");
  const name = NAMED_KEYS.find((k) => new RegExp(`(^|[^a-z])${k.replace(/[-\s]/g, "[-\\s]")}([^a-z]|$)`).test(s));
  if (name) return out(NAMED[name], "named", `"${name}"`);
  if (/\bwhite\b/.test(s)) return out(null, "default");
  return out(null, "unparsed", `no colour recognised in "${raw.slice(0, 60)}"`);
}
