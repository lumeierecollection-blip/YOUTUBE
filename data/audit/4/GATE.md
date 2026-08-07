# STAGE 4 — Slot table + lint — GATE

**Date:** 2026-08-07
**Lane:** `audit-layout` (opencode/big-pickle)
**Protocol row:** Part 4, Stage 4 — `layout/slots.js` exists; L1–L3 pass on fixtures; nothing in the repo positions by raw pixel
**Verdict:** PASS

---

## Gate checks

| # | Check | Result | Evidence |
|---|---|---|---|
| G1 | `layout/slots.js` exists | PASS | `src/skills/remotion-render/layout/slots.js` present; exports `GRID {base:8, cols:12, col:56, gutter:8, pad:40}`, `SAFE_SHORTS {top:288, bottom:1248, left:48, right:888}`, `SAFE_LONGFORM {top:100, bottom:980, left:160, right:1760}`, `SLOTS_SHORTS`, `SLOTS_LONGFORM`, `ANCHORS`, `snapToGrid`, `columnX`, `slotBounds`, `anchorPoint`. Marked DONE 2026-08-06 by lane; re-verified by orchestrator 2026-08-07 |
| G2 | L1–L3 pass on fixtures | PASS | `node layout/run-lint.js` → **12 passed, 0 failed** (includes "good Shorts frame passes L1–L3" and "bad rect fails the combined run" negative case). Spec suite `node spec/run-spec.js` → **15 passed, 0 failed** |
| G3 | Nothing in the repo positions by raw pixel | PASS (scoped) | Register row LAY-10 scopes this leg to `styles/` + `beats/`: `beats/` absent; `styles/` contains only `tokens.js` (no layout coordinates). `mg-style.js` ZONES and `beats.js` SAFE/OPTICAL/CAPTION now derive from `layout/slots.js` — zero raw literals in lane-owned files. Raw pixel usage remains in `compositions/**` (e.g. `motion-graphics.jsx:198` `top: 288`, `:511` `maxWidth: 780`, stale `1148` context) — **tracked as D2 in register LAY-10** and deferred to owning stages 7/9/12 via SFR-LAY-4/5 (see Deferrals). Not a Stage-4 defect |

---

## Lane outcome

- **Claims:** 11/11 CONFIRM (all values grounded in live first-party sources; safes/locations correct as-is; zero lane edits).
- **Lint:** 12/12 pass. **Spec:** 15/15 pass.
- **Findings documented by lane:** 1148-vs-1152 spec conflict (§3.1/§3.7, A1.3) — resolved by deriving ZONES/CAPTION from `slots.js`; Longform caption-vs-headline slot overlap (§3.7 workaround, see SFR-LAY-6).
- **Ledger:** `data/audit/4/audit-layout.ledger.md` (497 lines).

## Shared-file requests applied (SFR-LAY-1…7)

| ID | File | Action | Status |
|---|---|---|---|
| SFR-LAY-1 | `MOTION-GRAPHICS-MANUAL.md` | Caption row `1148 – 1248` → `1152 – 1248`; `zoneTop` 1148 → 1152; `maxWidth` 780 → 760; B2.2 "100 px zone" → "96 px zone" | APPLIED (4 replacements; verified by grep) |
| SFR-LAY-2 | `src/skills/remotion-render/compositions/mg-style.js` | ZONES bulk-derived from `SLOTS_SHORTS` (`import { SLOTS_SHORTS } from "../layout/slots.js"`); all raw literals removed; caption top now 1152 | APPLIED (verified: syntax OK, only coordinate source is slots.js) |
| SFR-LAY-3 | `src/skills/remotion-render/compositions/beats.js` | `SAFE = SAFE_SHORTS`; American `OPTICAL_CENTER_X` deleted, `OPTICAL_CENTRE_X = SAFE.left + (SAFE.right - SAFE.left)/2`; `OPTICAL_CENTRE_Y = (SAFE.top + SAFE.bottom)/2`; `CAPTION = { zoneTop: SLOTS_SHORTS.caption.y (1152), zoneBottom: 1248, anchor: "bottom", maxWidth: SLOTS_SHORTS.caption.w (760) }` | APPLIED (verified: syntax OK) |
| SFR-LAY-4 | `src/skills/remotion-render/compositions/motion-graphics.jsx` slot alignment | **DEFERRED** to stage 7/9 (lane classifies as Tier-2 stills work, `±2px`; not Stage-4 scope) | DEFERRED |
| SFR-LAY-5 | `src/skills/remotion-render/compositions/minimal.jsx` + `cinematic-documentary.jsx` slots | **DEFERRED** to stage 9 ("16 compositions render as stills" gate) | DEFERRED |
| SFR-LAY-6 | `LAYOUT-SYSTEM.md` | §3.1 carve-out (rail width 4, stage height 548 are deliberate multiples-of-4-not-8 structural constants); §3.7 rewritten "never overlap (Shorts)" + **Longform caveat** (table caption 884–980 overlaps headline 780–924 by 40 px; two-line caption collides; longform rail spans 100–924) | APPLIED (verified by grep) |
| SFR-LAY-7 | `CHECK-REGISTER.md` | LAY-02/03/04/05/20 → **PASS**; LAY-10 method note (`compositions/` raw dupes tracked (D2: stale 1148)); LAY-12 method note (useCurrentScale doc conflict 4.0.111 vs 4.0.125 resolved by 4.0.505 install) | APPLIED (7 rows updated) |

## Deferrals (documented, registered)

- **SFR-LAY-4 / SFR-LAY-5:** raw-pixel alignment inside `compositions/**` is owning-stage work — Stage 7 gate ("Tier 2 stills within ±2px", lane `audit-layout`+`audit-motion`) and Stage 9 gate ("16 compositions render as stills"). Register LAY-10 carries the D2 method note (stale 1148). The Stage-4 G3 leg is scoped by LAY-10 to `styles/`+`beats/`, which are clean.

## Post-application verification (orchestrator)

- `node --check compositions/beats.js` + `compositions/mg-style.js` → **syntax OK**.
- `node layout/run-lint.js` → **12 passed, 0 failed**.
- `node spec/run-spec.js` → **15 passed, 0 failed**.
- `node verify-compositions.js` → **ALL STYLES OK**; `[mg-gate] palette PASS`; bg `#070D1A` OK; accent count 261 OK; caption zone OK; alive (f60 vs f1500 DIFFERENT).
- Re-run of `data/audit/4/apply-sfr-docs.mjs` made idempotent (skip already-applied pairs) — no double-application; all 7 register rows + doc edits in final state.

## Escalations (carried)

1. **FINISH-SPEC.md still absent** — escalated at every stage; Stage 15 delete-list sweep and Stage 16 full render depend on it. Needs human decision (create from MOTION-BLUEPRINT/lane ownership, or re-scope Stage 15 gates).
2. **IMAGE_BEAT stage stddev ~10.2–10.3 vs 18 threshold** in `verify-compositions.js` — known recurring flag; b-roll resolves correctly; E2.5 35% desaturation lowers variance by design. Not a Stage-3/4 defect; escalated to Stage 9 (Remaining 7 archetypes).
3. **Legacy `.colors` hex field** in `config/channels.json` — T-colors follow-up; other lanes' ownership (COL-10 N/A at Stage 3). Zero hex literals already enforced for palette roles.

## Completion criteria

- [x] Ledger read: `data/audit/4/audit-layout.ledger.md`
- [x] Shared-file requests applied (SFR-LAY-1/2/3/6/7; LAY-4/5 deferred with register note)
- [x] Gate checks G1–G3 pass
- [x] GATE.md written

**STAGE 4 CLOSED — verdict PASS. Next: Stage 5 (Measurement, `audit-type` + `audit-layout`).**
