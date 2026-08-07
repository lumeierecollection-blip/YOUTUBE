# STAGE 5 — Measurement — GATE

**Date:** 2026-08-07
**Lanes:** `audit-type` (fonts, measurement, caption, crispness) + `audit-layout` (slots, compiler, measurement semantics)
**Protocol row:** Part 4, Stage 5 — `measureText` throws on unloaded font; measure and render share one `fontStyle` object
**Verdict:** PASS

---

## Gate checks

| # | Check | Result | Evidence |
|---|---|---|---|
| G1 | `measureText` throws on unloaded font | PASS | Browser E2E probe on the **installed `@remotion/layout-utils@4.0.506`** (audit-layout `probe-font-gate.html`, 5 cases): unloaded family + gate ON → THROWS; gate OFF → silent fallback width; real vendored Inter + gate ON → no throw (positive control); short-text (2 unique chars) → no throw (installed `new Set(text).size > 4` guard, absent from public docs). Mechanism armed in `layout/measure.js` (audit-type): `FONT_GATE = { validateFontIsLoaded: true }` spread LAST in all four wrappers (measureText/fitText/fitTextOnNLines/fillTextBox.add) — non-overridable. |
| G2 | measure and render share one `fontStyle` object | PASS | `layout/measure.js` exports `HEADLINE_FONT` + `fontStyleFor(fontFamily, overrides)`; `fontStyleFor("Inter", HEADLINE_FONT)` = `{fontFamily, fontWeight: 800, letterSpacing: "normal"}` — identical to prior inline renderer props. Post-SFR: `HeadlineBox` builds ONE `fontStyle` via `useMemo` and spreads it into `fitTextOnNLines` (:499), `measureText` (:506), and the render div (:515). |

## Shared-file requests applied

| ID | File | Action | Status |
|---|---|---|---|
| SFR-type-002 (audit-type) + SFR-LAY-5-1 (audit-layout) | `src/skills/remotion-render/compositions/motion-graphics.jsx` | Import :18 → `../layout/measure.js` (gated wrappers + HEADLINE_FONT + fontStyleFor); HeadlineBox builds one shared `fontStyle` (useMemo) spread into fitTextOnNLines / measureText / render div; deps updated | APPLIED via `data/audit/5/apply-sfr-type-002.mjs` (5 replacements, exact-match, idempotent). Zero `@remotion/layout-utils` references remain in `compositions/**` (grep-verified) |
| SFR-LAY-5-2 (audit-layout note) | — | Role constants (kicker/caption/chip) extend the `fontStyleFor` pattern when layers land (stages 6–7) | NOTED — no action this stage |

## Lane outcomes

- **audit-type:** claims type-006 (font gate) + type-007 (shared fontStyle) → attempt-1 **REJECT** on type-006 (module was reachable only from probe; renderer still un-gated; header overclaimed) → returned to Phase 1 (P3.5), re-scoped to (a)+(b) delivered + (c) via SFR → attempt-2 **CONFIRM** (verifier re-derived from installed binary + first-party docs + skills rule). Chrome probe legs A–G (gate throws through wrapper; cache-key trap demonstrated — un-gated call poisons cache because key omits the flag). Ledger `data/audit/5/audit-type.ledger.md`.
- **audit-layout:** 4 claims (LAY-012 font gate, LAY-013 shared fontStyle, LAY-014 cache hazard, LAY-015 useCurrentScale) all **RE-VERIFIED**, 0 WRONG, 0 owned-file changes (Stage-4 precedent: zero-diff lane, evidence in ledger). Ledger `data/audit/5/audit-layout.ledger.md`.
- **Counter-check rejections:** exactly one — type-006 attempt 1 (dead-code/overclaim). Resolved by re-scope + SFR mechanism, CONFIRM on attempt 2. Both lanes independently corroborate the same remaining gap (renderer wiring), which the SFR closed.

## Post-application verification (orchestrator)

- `node layout/run-lint.js` → **12 passed, 0 failed** (unchanged)
- `node spec/run-spec.js` → **15 passed, 0 failed** (unchanged)
- `node verify-compositions.js` → **ALL STYLES OK**; mg gate palette PASS; bg/accent/caption OK; alive (f60 vs f1500 DIFFERENT)
- `node data/audit/5/probe-node-browser-only.cjs` → all four functions THROW in Node ("can only be called in a browser") — confirms compile-in-Node tension (ESCLAY-5-1)
- Post-SFR grep: `motion-graphics.jsx:18` imports only from `../layout/measure.js`; no raw `@remotion/layout-utils` in `compositions/**`

## Escalations (need attention)

1. **ESCLAY-5-1 (decide BEFORE Stage 6):** LAYOUT-SYSTEM §4/R3 says `compile.js` calls `measureText()` at compile time in Node — but the installed package AND docs throw in Node ("Only works in the browser, not in Node.js or Bun", machine-proven). Stage-6 compiler needs: (a) browser-time measurement feeding the compiler, (b) woff2 metric parsing in Node, or (c) spec amendment. **Orchestrator decision requested before dispatching Stage 6.**
2. **ESCLAY-5-2 (carried):** `FINISH-SPEC.md` absent — escalations 0–5. Stage-15 delete-list sweep + Stage-16 full render depend on it.
3. **Deferred observations (audit-type §6, not Stage-5 scope):** HeadlineBox renders `fit.lines.join(" ")` under `whiteSpace: "nowrap"` (2-line fit collapses to one overflowing line — measure-vs-render bug of the class the gate targets; belongs to compiler/Layer work, stages 6–7); `fontSize` floor clamp `Math.max(fit.fontSize, TYPE.support)` can overflow the 780 box (same bucket); cache key omits `fontVariantNumeric` (affects tabular-nums, Stage 11).

## Completion criteria

- [x] Both ledgers read (`data/audit/5/audit-type.ledger.md`, `data/audit/5/audit-layout.ledger.md`)
- [x] Shared-file requests applied (SFR-type-002 / SFR-LAY-5-1)
- [x] Gate checks G1–G2 pass (mechanism + system arming + post-SFR wiring)
- [x] GATE.md written

**STAGE 5 CLOSED — verdict PASS. Next: Stage 6 (Compiler, lane `audit-layout`) — PENDING ESCLAY-5-1 resolution.**
