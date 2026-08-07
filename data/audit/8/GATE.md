# STAGE 8 — `PROGRESS` archetype — GATE

**Date:** 2026-08-07
**Lanes:** `audit-encoding` (build), `audit-motion` (build)
**Protocol row:** Part 4, Stage 8 — "L8, L9, L10 pass — the three chart bugs cannot recur"
**Verdict:** PASS

---

## Gate checks

| # | Check | Result | Evidence |
|---|---|---|---|
| G1 | `spec/fromBeats.js` exists: Beat[] → ShotSpec[] with the PROGRESS chart layer (SFR-LAY-6-2 lift) | PASS | `src/skills/remotion-render/spec/fromBeats.js` (329 lines, SHA-256 `05358974…`). 5-layer recipe `[kicker, rail, caption, headline, chart]`, no accent rule (L7), `CHART_BUILD at 0` / exit NONE, id `s<section>b<beat>`, ENC-08/09/24/10/21/20/13/23 throw with beat id; ENC-22 single-point → HERO_NUMBER downgrade; literal `highlight: p.highlight === true` passthrough. |
| G2 | `primitives/Chart.jsx` exists: static renderer of the compiled `chart` contract, E3.4 DOM order | PASS | `src/skills/remotion-render/primitives/Chart.jsx` (223 lines, SHA-256 `EFB0A000…`). Position from compiled fields only (`left: bar.x − gridX`, `top: bar.y − barAreaTop`); zero hex literals; exactly one accent decision `bar.highlight ? colors.accent : colors.surface` (ENC-15, L7); VALUE_GAP 8 ≤ 24 (ENC-14); AXIS_LABEL_GAP 12 (L10); `toLocaleString` separators. |
| G3 | `beats/Progress.jsx` exists: E3.4 tree animated on the A4 §PROGRESS frame table | PASS | `src/skills/remotion-render/beats/Progress.jsx` (new, blob `8467bddc…`, SHA-256 `8F965B9F…`). Baseline [0,10]; gridlines 8+3i (3 lines, 25/50/75 %); axis label RISE 16; bar grow spring `{damping:13.9, stiffness:180}` (ζ 0.518, 14.9 % overshoot, emergent ~21 f); bar stagger 7 from tA−4; shared-scalar counter with raised floor + clamp + separators from frame 0; 1-frame accent switch at highlightStart+24; one SFX `ui/click_004.ogg` −22 dB on the settle frame; zero raw layout coordinates (§8.3-clean). |
| G4 | L8/L9/L10 pass on the compiled interior of a real PROGRESS beat (the three chart bugs) | PASS | `node data/audit/8/frombeats-chart-gate.mjs` re-run by orchestrator: **94 passed, 0 failed, exit 0**. Run 1: L8 bar.bottom == axisY Δ=0 (the 36 px float), L9 gutters equal (the 42/84 split), L10 gridX − axisLabelRight = 12 (the 108 px defect), L7 exactly one accent. Runs 2/2b/3: all 8 ENC gates THROW; ENC-22 downgrade valid; ENC-23 boundary recorded as documented limitation. Runs 4/5: source greps token-clean. Run 7: 3 gate scripts × 13 mg channels through the real fromBeats (downgrade-first) = 858 compile+lintAll runs, all pass. |
| G5 | L8/L9/L10 hold in the rendered DOM (Tier 2), not just in compiled geometry | PASS | `node data/audit/8/progress-probe.mjs` re-run by orchestrator: **13 passed, 0 failed, exit 0** (real renderStill engine, frames 60/75/9/20/36/37). f60/f75: all 5 layers within ±2 px (worst |d| = 0.00), zero safe-rect crossing, zero sibling flex, bar bottoms 896 == 896, gutter 8.00, axis-label right edge 76 = gridX−12, exactly 1 accent fill (rgb(210,77,71) = #D24D47), counters "12"/"47", "1,240" with separator. Motion branches evidenced: f9 construction order in flight (baseline 759.91, g0 375.73, g1 0, bar0 62.31, bar1 absent, label op 0); f20 bar1 521.13 > 464 overshoot while counter reads "47" (clamped, never "53"); f36 surface → f37 accent (accentAt = 13 + 24 = 37, SFX frame consistent). |
| G6 | No regression | PASS | `node src/skills/remotion-render/layout/run-lint.js` re-run: **38 passed, 0 failed, exit 0** (incl. the L8 36 px float, L9 42/84 split, L10 20 px gap negatives). `layout/` untouched this stage. |

## Lane outcomes

- **audit-encoding** (ledger `data/audit/8/audit-encoding.ledger.md`, 511 lines): CLAIM-ENC-019 (fromBeats.js mapping + ENC gates) IMPLEMENTED, CLAIM-ENC-020 (Chart.jsx renderer + honesty) IMPLEMENTED, CLAIM-ENC-021 (LAY-07/08/09 cannot recur) RE-VERIFIED. Counter: CONFIRM (attempt 1, verifier `ses_02389c656ffeRmBoB85RA5Ehp9`); 4 wording warts corrected in the claim cards; verifier confirmed the legacy `mg-package.js:251` highlight hazard verbatim → SFR-ENC-8-1. Verifier sandbox denied bare `node` — it hand-traced all check arithmetic; the orchestrator's own re-run (94/94) covers the machine-evidence gap.
- **audit-motion** (ledger `data/audit/8/audit-motion.ledger.md`, 538 lines): 7 claims (014–020), all counter-checked **CONFIRM** with distinct external verifier sources (MIT/TMU control-systems for ζ/overshoot, MDN/ICU/ECMA-402 for formatting, Material/Apple HIG for accent, Remotion docs for sequence/audio/render-still, LAYOUT-SYSTEM §8.3 for geometry honesty). Probe 13/0 green. 2 non-fatal wording nits corrected in claim 019/020 text.

## Counter-check rejections

None this stage. No REJECT, no UNVERIFIABLE, no P3.5 escalation, no re-dispatch needed. All 10 claims (3 encoding + 7 motion) CONFIRM on attempt 1. Weak-pass notes (P3.6): none — verifier sources consistently differed from researcher sources.

## Deletions

None this stage — all deliverables are NEW files (delete-then-replace applied to nothing pre-existing; the legacy `compositions/motion-graphics.jsx` `ProgressScene` is on the Stage 15 delete-list sweep). New: `spec/fromBeats.js`, `primitives/Chart.jsx`, `beats/Progress.jsx`, `data/audit/8/frombeats-chart-gate.mjs`, `data/audit/8/progress-probe.mjs`, `data/audit/8/_progress-entry.jsx` (runtime-generated).

## Shared-file requests

| ID | Target | Action | Status |
|---|---|---|---|
| SFR-motion-5 | `DETAIL-REFERENCE.md` A4 §PROGRESS gridline rows (lines 226–227) | Amend `\| 11, 14, 17 \| gridlines 2–4 (stagger 3) \|` → `\| 11, 14 \| gridlines 2–3 (stagger 3) \|` + note: "the compiled chart has exactly three gridlines (25/50/75 % of the plot, Chart.jsx GRID_LINES); the earlier draft counted four starts." Timing values unchanged (8, stagger 3, 10 f). | **PENDING — orchestrator edit allow-list covers only Root.jsx, styles/motion-graphics.jsx, package.json, data/audit/**; DETAIL-REFERENCE.md edit denied by permission. Exact before/after above — apply as user action or by granting orchestrator `DETAIL-REFERENCE.md` edit permission.** |
| SFR-ENC-8-1 | `compositions/mg-package.js:251` | Replace `highlight: !!(p.highlight \|\| i === 0)` with `highlight: !!p.highlight` (pre-existing ENC-13 derivation in the legacy pipeline; the stage-8 path is clean). | **CARRIED — runtime behavior change to the live legacy pipeline; no claim card/counter-check would cover an orchestrator-side edit. Owner: the pipeline-composition lane or user, at the stage that rewires `compositions/` (Stage 14/15).** |
| SFR-ENC-8-2 (carried) | manual channel list | ESCLAY-6-2 "13 vs 12 mg channels" — gate asserts 13 AND superset-of-12. | CARRIED |
| SFR-ENC-8-3 (carried) | `FINISH-SPEC.md` | Document absent from repo (escalation 0–6). | CARRIED |

## Escalations / carried notes

1. **SFR-motion-5 pending (permission).** Spec amendment documented with exact text; cannot be applied by the orchestrator under the current edit allow-list.
2. **SFR-ENC-8-1 carried.** Legacy `deriveScene` PROGRESS branch still derives highlight (`i === 0`) — real but out of scope for this stage's gate; stage-8 path (fromBeats ENC-13 + Chart.jsx) is grep-proof and throw-proof.
3. **Carried (stage 9):** `verify-compositions.js` IMAGE_BEAT stddev flag; primitives ownership note (ESC-LAY-7-1 — `primitives/**` grant still not in any lane allow-list); `_progress-entry.jsx` is runtime-generated and recreated per probe run.
4. **A4 table deviation confirmed as spec error, not product defect:** the A4 draft listed a fourth gridline start (17) and "stagger 2" on a single axis label; the live chart has exactly 3 gridlines and 1 label. Implemented per the live source; SFR-motion-5 filed.

## Completion criteria

- [x] Both ledgers read (`data/audit/8/audit-encoding.ledger.md`, `data/audit/8/audit-motion.ledger.md`)
- [x] Shared-file requests handled (SFR-motion-5 PENDING-permission with exact text; SFR-ENC-8-1 carried; carried items re-recorded)
- [x] Gate checks G1–G6 pass (orchestrator re-ran gate runner 94/94, probe 13/0, lint 38/0)
- [x] GATE.md written

**STAGE 8 CLOSED — verdict PASS. Next: Stage 9 (remaining 7 archetypes, lanes `audit-encoding` + `audit-motion`; gate: 16 compositions render as stills; C10–C13, D11–D13 pass).**
