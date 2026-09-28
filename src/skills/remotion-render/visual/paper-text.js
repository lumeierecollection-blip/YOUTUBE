/**
 * Paper-style text sizing, pure JS (no JSX): paper-stage.jsx and
 * paper-caption.jsx lay text out with it, and render.js records the same
 * sizes in the render manifest, so the audit (local-audit.cjs
 * shapes-clear-of-text) knows how thick each beat's real text strokes can
 * be — a big bold headline's strokes are thicker than a small caption's.
 *
 * Where this stops: widths are estimated from character counts (bold
 * grotesk ~0.68 em per uppercase character, ~0.58 lowercase; italic serif
 * ~0.5 em), not measured glyphs. The zone margins absorb the error, and the
 * frame checks fail the render if text still leaves its zone.
 */
import { ZONES } from "./paper-layout.js";

const DATA_TYPES = ["COUNTER", "BAR", "PIE", "LINE", "GAUGE", "MAP"];
export const HEADLINE_ZONE_PAD = 10;
export const CAPTION_MAX_SIZE = 26;

export function fitSize(text, width, max, min) {
  return Math.round(Math.max(min, Math.min(max, width / Math.max(1, String(text).length * 0.56))));
}
// The size at which the LONGEST word still fits the width; allowed to go
// under fitSize's minimum — a word that runs off its box is a failure, a
// smaller word is not.
export function fitLongestWord(text, width, size, upper) {
  const longest = Math.max(1, ...String(text || "").split(/\s+/).map((w) => w.length));
  return Math.min(size, Math.floor(width / (longest * (upper ? 0.68 : 0.58))));
}
// Height of the lead-in + headline block (greedy wrap like the browser's,
// plus 0.2 em for glyphs that overhang the 1.04 line box).
export function headlineBlock(words, lead, size, width, upper) {
  const em = upper ? 0.68 : 0.58;
  let lines = words.length ? 1 : 0, used = 0;
  for (const w of words) {
    const ww = (w.length * em + 0.24) * size;
    if (used > 0 && used + ww > width) { lines++; used = ww; } else used += ww;
  }
  const leadSize = leadInSize(size);
  const leadLines = lead ? Math.max(1, Math.ceil((lead.length * 0.5 * leadSize) / width)) : 0;
  const leadH = lead ? leadLines * leadSize * 1.36 + 6 : 0;
  return leadH + lines * size * 1.04 + size * 0.2;
}
export function leadInSize(headlineSize) {
  return Math.round(headlineSize * 0.42 + 8);
}

/**
 * The headline's layout for one beat's paper content `c`: in the HEADLINE
 * zone, the size shrunk until the whole block fits the zone less 10 px top
 * and bottom, the block centred in the zone.
 */
export function headlineLayout(c) {
  const ZH = ZONES.HEADLINE;
  const hasCutout = !!c?.cutout?.asset;
  const vtype = String(c?.visual_type || (hasCutout ? "CUTOUT" : "TYPE")).toUpperCase();
  const chart = DATA_TYPES.includes(vtype) && c?.data ? vtype : null;
  const center = c?.layout === "center" || (!hasCutout && !chart);
  const words = String(c?.headline || "").split(/\s+/).filter(Boolean);
  const upper = words.length <= 3;
  const lead = String(c?.lead_in || "").trim();
  const textLeft = center ? ZH.x + 4 : ZH.x + 22;
  const textWidth = center ? ZH.w - 8 : ZH.w - 44;
  let size = fitLongestWord(c?.headline, textWidth,
    !hasCutout && !chart ? fitSize(c?.headline, textWidth * 0.93, 84, 34) : fitSize(c?.headline, textWidth * 0.86, 56, 26), upper);
  while (size > 14 && headlineBlock(words, lead, size, textWidth, upper) > ZH.h - 2 * HEADLINE_ZONE_PAD) size -= 2;
  const blockH = headlineBlock(words, lead, size, textWidth, upper);
  const top = ZH.y + Math.max(HEADLINE_ZONE_PAD, (ZH.h - blockH) / 2);
  return { vtype, chart, hasCutout, center, words, upper, lead, textLeft, textWidth, size, leadSize: leadInSize(size), blockH, top };
}

// The caption's font size for a beat's timed words (italic serif ~0.52 em
// per character, plus the emphasis word's 1.08 pop), in a box of `width`.
export function captionSize(words, width = ZONES.CAPTION.w - 8) {
  const longest = Math.max(1, ...(words || []).map((w) => String(w?.text ?? w).length));
  return Math.min(CAPTION_MAX_SIZE, Math.floor(width / (longest * 0.52 * 1.08)));
}
