/**
 * layout/measure.js — measurement gate + shared fontStyle (LAYOUT-SYSTEM §5.1/§5.2).
 *
 * Owned by: audit-type lane.
 *
 * Purpose — the two Stage-5 measurement rules, enforced in one place:
 *
 *  Rule 5.1 (font gate): every measurement call routed through this module
 *  passes validateFontIsLoaded: true, so an unloaded font THROWS instead of
 *  silently returning fallback metrics. The flag is forced LAST (after the
 *  caller's options) so no call site can accidentally or deliberately
 *  disable the gate. This is browser-only behaviour: the underlying
 *  @remotion/layout-utils functions throw "measureText() can only be called
 *  in a browser." when document is undefined (index.mjs:13-15), and the
 *  gate throws a second, more specific error when the font family is not
 *  loaded at call time (index.mjs:77-100).
 *
 *  Scope: the PRODUCTION measurement call sites (motion-graphics.jsx:491
 *  and :503) are outside this lane's ownership and are rewired to this
 *  module by the orchestrator via SHARED-FILE REQUEST type-002; until that
 *  is applied, this module is exercised by the audit probe
 *  (data/audit/5/font-gate-probe.mjs) which is the only in-tree caller.
 *
 *  Rule 5.2 (shared fontStyle): measurement and render must use IDENTICAL
 *  font properties. HEADLINE_FONT holds the fixed properties (weight,
 *  letter-spacing); fontStyleFor(fontFamily, HEADLINE_FONT) builds the ONE
 *  object that is spread into both the measurement call and the element's
 *  style, exactly as the first-party rule demonstrates
 *  (remotion-dev/skills, skills/remotion/rules/measuring-text.md:
 *  "Match font properties: Use the same properties for measurement and
 *  rendering"). fontSize is fit-computed once and passed to both sites
 *  from the same variable.
 *
 * PURE module — no React, no Remotion. Importable in Node (compile.js,
 * lint.js, verify) as long as the wrappers are not CALLED in Node (the
 * underlying functions require a browser DOM).
 *
 * The underlying cache (index.mjs:63) keys on text/fontFamily/fontWeight/
 * fontSize/letterSpacing/textTransform/additionalStyles — note that
 * validateFontIsLoaded is NOT part of the key, which is exactly why the
 * gate must be on every call: a cache hit from an un-gated measurement
 * would bypass the throw. Gating in the wrappers makes that impossible.
 */

import {
  measureText as rawMeasureText,
  fitText as rawFitText,
  fitTextOnNLines as rawFitTextOnNLines,
  fillTextBox as rawFillTextBox,
} from "@remotion/layout-utils";

/**
 * Rule 5.1 — the font gate. Spread LAST so it cannot be overridden:
 *   rawMeasureText({ ...opts, ...FONT_GATE })
 */
export const FONT_GATE = { validateFontIsLoaded: true };

/**
 * Rule 5.2 — fixed font properties per role. fontWeight/letterSpacing are
 * the properties that must be identical between measurement and render.
 * fontFamily is injected per channel (resolveFontFamily); fontSize is
 * fit-computed at the call site and passed to both measurement and render
 * from the same variable.
 */
export const HEADLINE_FONT = {
  fontWeight: 800,
  letterSpacing: "normal",
};

/**
 * Build the single fontStyle object shared by measurement and render.
 * Callers spread the SAME object into measureText()/fitTextOnNLines() AND
 * into the element's style, per Rule 5.2 / the first-party measuring-text
 * rule.
 *
 *   const fontStyle = fontStyleFor(fontFamily, HEADLINE_FONT);
 *   fitTextOnNLines({ text, ...fontStyle, maxFontSize });
 *   <div style={{ ...fontStyle, fontSize }}>…</div>
 */
export function fontStyleFor(fontFamily, overrides = {}) {
  return { fontFamily, ...overrides };
}

/** Rule 5.1-gated measureText(). */
export function measureText(opts) {
  return rawMeasureText({ ...opts, ...FONT_GATE });
}

/** Rule 5.1-gated fitText(). Cap the returned fontSize at the call site. */
export function fitText(opts) {
  return rawFitText({ ...opts, ...FONT_GATE });
}

/** Rule 5.1-gated fitTextOnNLines(). */
export function fitTextOnNLines(opts) {
  return rawFitTextOnNLines({ ...opts, ...FONT_GATE });
}

/**
 * Rule 5.1-gated fillTextBox(). The underlying box takes the font options
 * per-word on add(), so the gate is injected into every add() call.
 */
export function fillTextBox(boxOpts) {
  const box = rawFillTextBox(boxOpts);
  return {
    add: (wordOpts) => box.add({ ...wordOpts, ...FONT_GATE }),
  };
}

/**
 * Stage-11 counter construction — DETAIL-REFERENCE A1.1/A1.3.
 *
 * A1.3 (machine-readable flag): the two motion-graphics families that are
 * binary-verified to LACK the `tnum` OpenType feature in the vendored
 * subsets (data/audit/2/tnum-features.txt) AND are proportional — so their
 * digit advances differ and a content-sized counter JITTERS as the count
 * passes through 1/8/9-heavy strings (rendered proof: data/audit/11/
 * type-d14-report.json — DM Sans offsetWidth swings 449→646 on "1,000"→
 * "2,000", while Inter stays byte-identical at 770). JetBrains Mono is
 * deliberately NOT flagged: monospace digits are equal-width by
 * construction, tnum is irrelevant there. All other vendored families
 * (Inter, Fira Sans, Roboto Condensed, …) carry tnum and are safe.
 *
 * Stage-2 dependency claim-type-003 (audit/2/audit-type.ledger.md:88-124)
 * recorded the need for "a machine-readable flag (candidate: …computed
 * constant in the counter/measure module — layout/measure.js when it
 * exists)". This is that computed constant.
 */
export const FIXED_SLOT_FAMILIES = new Set(["DM Sans", "Nunito"]);

/**
 * A1.3 machine-readable flag. True when the channel's font cannot do
 * equal-width digits (no tnum AND not monospace), so the counter must
 * render per-digit fixed slots (each digit in its own width: 0.62em
 * centred box) to keep the bounding box byte-identical across the count.
 * Consumption lives in the beats (SHARED-FILE REQUEST SFR-T-11-1) and the
 * legacy scene (SFR-T-11-2); this module only publishes the flag.
 */
export function needsFixedSlots(fontFamily) {
  return FIXED_SLOT_FAMILIES.has(fontFamily);
}

/** Round up to the next 8px (the render grid step, A1.1:88). */
export function ceil8(n) {
  return Math.ceil(n / 8) * 8;
}

/**
 * A1.1 reserved-width measurement: measure the FINAL formatted counter
 * string (the widest the count will ever need) with the shared fontStyle,
 * the counter's RENDER fontSize (fit-computed at the call site — this
 * module's convention, see header: "fontSize is fit-computed once and
 * passed to both sites from the same variable") and this module's Rule 5.1-
 * gated measureText, then round up to the grid. A fixed-slot counter
 * reserves this width from frame 0 so the numeral box never moves.
 * Browser-only like every other measurement in this module.
 *
 *   const fontStyle = fontStyleFor(fontFamily, HEADLINE_FONT);
 *   const slot = reserveCounterWidth("13,600", fontStyle, fontSize); // fontSize = the numeral's render size
 *   rect.w = slot; // reserved, never changes
 */
export function reserveCounterWidth(finalStr, fontStyle, fontSize) {
  const slot = measureText({ text: finalStr, ...fontStyle, fontSize });
  return ceil8(slot.width);
}
