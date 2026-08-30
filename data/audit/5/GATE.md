# STAGE 5 GATE — Measurement

**Date:** 2026-08-07  
**Lanes:** `audit-type`, `audit-layout`  
**Status:** PASS  

## Check Results

1. **`measureText` throws on unloaded font**: **PASS**
   - Verified via headless browser E2E probes (`probe-font-gate.html`) that `validateFontIsLoaded: true` throws an informative error when an unloaded font family is measured.
2. **Measure and render share one `fontStyle` object**: **PASS**
   - Verified via `layout/measure.js` (`HEADLINE_FONT` and `fontStyleFor`) that measurement and render paths share identical font property definitions, preventing synthetic font substitution and layout shift.

## Verdict: PASS
- Stage 5 completed successfully. Ledgers recorded at `data/audit/5/audit-type.ledger.md` and `data/audit/5/audit-layout.ledger.md`.
