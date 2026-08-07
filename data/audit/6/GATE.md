# STAGE 6 — Compiler — GATE

**Date:** 2026-08-07
**Lane:** `audit-layout` (slots, safe zones, the compiler, alignment)
**Protocol row:** Part 4, Stage 6 — L1–L12 pass on all three existing scripts, all 12 mg channels
**Verdict:** PASS

---

## Gate checks

| # | Check | Result | Evidence |
|---|---|---|---|
| G1 | L1–L12 pass on all three existing scripts | PASS | `node data/audit/6/build-shots.mjs` → **58 passed, 0 failed, exit 0**. Three real scripts (`data/scripts/ch-01/movile-cave-shorts-script.json` with real paired SRT; `render-test-script.json` + `ch-02/narrowboat-10k-surprise-shorts-script.json` with voiceover/timing-synthesized captions) → real beats via `parseSrtToBeats` → ShotSpec[] (inline fromBeats stand-in, schema-validated) → `compile()` → `lintAll()`. 66 real beat-frames per script. |
| G2 | …all 12 mg channels | PASS | Same runner × **13** motion-graphics channels (JSON superset of the manual's 12, all real fonts: Inter/DM Sans/Roboto Condensed/Fira Sans/JetBrains Mono/Nunito) = **858 compile+lintAll runs, all pass**. Font-agnostic proven. |
| G3 | Compiler contract R1–R4 | PASS | `layout/compile.js` (new, pure Node, no DOM): absolute-only rects (R1), bottom-up (R2), browser-fed measurement as input — never calls the library (R3, ESCLAY-5-1 option 1 respected), round-to-8 + assert ≤4 px + inside-slot + inside-safe (R4). 6 negative tests all THROW (missing fonts, missing measured, partial measured entry, out-of-range atFrame, §3.7 collision ×2) — "a layout error becomes a build error". |
| G4 | L4–L12 lint landed | PASS | `layout/lint.js` extended to full L1–L12 (L4 range-aware overlap, L5 measured+fontSize, L6 floors 84/64/44, L7 one accent, L8 bar bottoms==axis, L9 gutters ≤1 px, L10 axis label 12 px, L11 1–5 layers, L12 atFrame range). `layout/run-lint.js` → **38 passed, 0 failed** (12 stage-1 + 26 new incl. negative fixtures). |
| G5 | Chart checks on compiled interior | PASS | PROGRESS-style chart ShotSpec → compile() → interior asserted: bar bottom == axisY (L8, Δ=0), gutters equal (L9), axisLabelRight = gridX−12 (L10), one highlight (L7), frame passes lintAll. |
| G6 | No regression | PASS | `node layout/run-lint.js` 38/0; `node spec/run-spec.js` 15/0; `node verify-compositions.js` → **ALL STYLES OK** (mg palette/bg/accent/caption OK); `node --check` clean on all five modules. |

## Lane outcome

- **Claims:** CLAIM-LAY-016 (R1–R4 compiler) IMPLEMENTED, CLAIM-LAY-017 (L1–L12 lint) IMPLEMENTED, CLAIM-LAY-018 (LAY-20 register "0 hits" refuted — `scaleUnit` lives at `mg-style.js:150-151`) RE-VERIFIED.
- **Counter-check rejections:** attempt 1 **REJECT** — compile.js silently defaulted a partial measured entry to `lines: 1` instead of throwing, and `STRUCTURAL_ROLES = ["rail"]` was exported-but-unused/incomplete (accent is structural too). Per P3.5 → Phase 1 re-entry: now throws `"no measured line count"` on partial entries; `STRUCTURAL_ROLES = ["rail","accent"]` imported+used; 6th negative test added → attempt 2 **CONFIRM (A+B)** by a fresh verifier session (which independently corroborated 13 channels, 38 fixtures, real-pipeline wiring). Both verifiers hand-traced (their sandboxes deny bare `node`); the observed counts are the lane's own runs, re-confirmed by the orchestrator (G1–G6 above).
- **Ledger:** `data/audit/6/audit-layout.ledger.md` (490 lines).

## Shared-file requests applied

| ID | File | Action | Status |
|---|---|---|---|
| SFR-LAY-6-1 | `CHECK-REGISTER.md` | LAY-20 evidence corrected: "0 hits" (stale, stage-4 ledger) → "1 hit @ compositions/mg-style.js:150-151 (scaleUnit, applied — not a no-op)". Verdict stays PASS; the u-scaler DEFECT was never present. | APPLIED (verified by grep) |
| SFR-LAY-6-2 | `spec/fromBeats.js` | Beat[]→ShotSpec[] is **audit-encoding's** deliverable (protocol line 78). Stage 6 carried a documented inline stand-in inside `data/audit/6/build-shots.mjs` (every mapping choice recorded in the runner header). Audit-encoding should lift it into `spec/fromBeats.js` in a later stage and the stand-in deleted. | NOTED (no file change — other lane's deliverable) |
| SFR-LAY-6-3 | `MOTION-GRAPHICS-MANUAL.md` | "12 channels" → "13 channels" + Money Mind added to the list (JSON superset; Money Mind has full config: hues 265.8/149.6 under thumbnail_spec, font Inter, channel ch-01). | APPLIED (verified by read) |

## Escalations

1. **ESCLAY-6-1:** the lane's permission allow-list (`.opencode/agents/audit-layout.md`) has no `stage6/` path — the gate runner's natural home `src/skills/remotion-render/stage6/` was write-denied by the tool-permission rule; runner lives at `data/audit/6/build-shots.mjs` instead (consistent with stage-5 probe precedent). No gate impact; a `stage6/**` allow-list entry can be added if a module path is wanted. NOTE: the deliverable modules (compile.js, compile-lint.js) ARE inside the owned `layout/**` path — only the evidence harness was affected.
2. **ESCLAY-6-2 (resolved by SFR-LAY-6-3):** 13-vs-12 mg channels — Money Mind (id 1) was present in JSON but absent from the manual's list. Manual now lists 13; gate passes as superset either way.
3. **ESCLAY-5-2 (carried):** FINISH-SPEC.md absent — escalations 0–6.
4. **Carried to audit-encoding (stage 8/9):** `spec/fromBeats.js` deliverable with the documented stand-in as reference implementation.

## Completion criteria

- [x] Ledger read (`data/audit/6/audit-layout.ledger.md`)
- [x] Shared-file requests applied (SFR-LAY-6-1, SFR-LAY-6-3; LAY-6-2 noted for audit-encoding)
- [x] Gate checks G1–G6 pass (orchestrator re-ran the runner + baselines)
- [x] GATE.md written

**STAGE 6 CLOSED — verdict PASS. Next: Stage 7 (Layer + primitives, lanes `audit-layout` + `audit-motion`; gate: Tier 2 stills within ±2 px; zero sibling flex in Stage/Headline/Caption).**
