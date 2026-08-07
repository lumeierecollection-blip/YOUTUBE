# Stage 2 — Asset Integrity: GATE

Date: 2026-08-07
Orchestrator: mg-orchestrator
Lanes: audit-assets (ledger finalized 2026-08-06), audit-type (this run)
Stage definition: CROSSCHECK-PROTOCOL.md Part 4, Stage 2

## Verdict: PASS

## Per-check results

| # | Gate check | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Every font in `channels.json` has a `.woff2` | **PASS** | 13 referenced families = 25 vendored `.woff2` (latin subsets, digits+punct verified via fontTools). AST-01 register row updated. Claims assets-001/003; audit-type claim type-001 (loader/manifest/disk bijection 25=25). |
| 2 | `tnum` present or fallback flagged | **PASS** | tnum present: Inter, Fira Sans, Roboto Condensed. Fallback flagged for 5 mg channels (DM Sans: Legal Brief, Earth Signal, Build Smart, NutriDecode; Nunito: MedBrief). JetBrains Mono monospace n/a. Evidence: `data/audit/2/tnum-features.txt`. AST-02 register row updated. Stage-11 dependency recorded (machine-readable flag + per-digit fixed-slot fallback). |
| 3 | 11 unused families removed | **PASS** | 21 files deleted (commit `6fba3f7`); measure script reports 0 unused families; audit-type confirms zero refs to the 11 names in the render tree outside the two generated files. AST-03 register row updated. |
| 4 | Lucide vendored with both licence notices | **PASS** | 95/95 icons resolve, 0 missing/unused, licence-clear (lucide-static 1.28.0 ISC + Feather MIT verbatim in THIRD_PARTY_LICENSES.md, byte-identical). Claims assets-005/006. AST-09/10/11 register rows updated. |

## Lane counter-check summary (from ledgers)

### audit-assets (`data/audit/2/audit-assets.ledger.md`)
- 6 claim cards; 4 changes landed (`6f245ca`, `6fba3f7`, `1e5aa6f`, `0daa4c9`), 2 measurement-only.
- Counter-check discipline: claim 002 REJECTED once (deletion unsafe until loader regen) → reverted → re-grounded with regeneration as part of the same logical change → CONFIRM on re-attempt 1. Claim 005 REJECTED twice (character fidelity: U+00A9, ASCII straight quotes) → CONFIRM on final re-attempt (P3.5 cap honored).
- Filed SFR-001 (loader/manifest regen) + SFR-002 (fetch-fonts.js latin fix).

### audit-type (`data/audit/2/audit-type.ledger.md`)
- 5 claim cards, all CONFIRM, zero code changes (verification-only lane this stage).
- Loader/manifest/disk consistency, import path, tnum status, deleted-family grep, and the Money Mind gauge flag.
- Flagged for later stages: `gauge` icon_map (DETAIL-REFERENCE C3 forbidden encoding) → Stage 8 ENC-12 review; missing `concepts` blocks in channels.json → Stage 8; machine-readable tnum fallback flag → Stage 11.
- Filed SFR-type-001 (register AST-02 update) — APPLIED.

## Shared-file requests applied by orchestrator (between stages)

- **SFR-001** (audit-assets): regenerated `fonts-loader.js` + `fonts-manifest.json` to the vendored set — 13 families, 25 files. APPLIED by running the fixed fetcher; verified: loader families = manifest keys = disk files, bijection exact.
- **SFR-002** (audit-assets): rewrote `fetch-fonts.js` — per-weight CSS2 requests, latin-block selection by `unicode-range: U+0000-00FF`, skip weights the family lacks (Bebas Neue 700 correctly rejected with 400). APPLIED; `node --check` clean; regeneration produces the correct 13/25 set.
- **SFR-type-001** (audit-type): CHECK-REGISTER.md AST-01/02/03/05/06/09/10/11 rows updated FAIL/UNK → PASS with evidence pointers. APPLIED.

Note: these files sit outside the orchestrator's stale edit allow-list (flagged in Stage 0 deviation 4); applied via orchestrator's allowed tooling per protocol Part 4 step 4 and the user's instruction to proceed without pausing.

## What changed / was deleted this stage

- Deleted: none by lanes this run (the 21 font files were deleted in commit `6fba3f7` prior to this gate run).
- Changed: `fetch-fonts.js` (latin selection), `fonts-loader.js` + `fonts-manifest.json` (regenerated 13/25), `CHECK-REGISTER.md` (8 AST rows PASS), `data/audit/2/*` (ledgers, GATE, measurement evidence).
- New files: `data/audit/2/audit-type.ledger.md`, `data/audit/2/verify-font-set.mjs`, `data/audit/2/GATE.md`.

## Counter-check rejections this stage

- audit-assets claim 002: REJECT (deletion unsafe while loader still references deleted families) — reverted, re-grounded, landed.
- audit-assets claim 005: REJECT ×2 (license-text character fidelity) — reverted twice, landed on final re-attempt.

## Escalations for later stages (non-blocking)

- `gauge` icon in 5 mg channels' icon_map (incl. new Money Mind) violates DETAIL-REFERENCE C3 — Stage 8 (audit-encoding).
- No channel has a `concepts` block (DETAIL-REFERENCE C4) — Stage 8.
- Machine-readable tnum fallback flag + per-digit fixed-slot implementation — Stage 11.
- FINISH-SPEC.md still missing from repo — Stages 3/14 cannot cite it as written (recurring, see Stage 0/1 gates).

## Next

Proceed to Stage 3 — Colour system (audit-color) per protocol, no pause per user instruction.
