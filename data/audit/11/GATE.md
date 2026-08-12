# STAGE 11 GATE — Counters + settles

**Gate (CROSSCHECK-PROTOCOL Part 4 row 11):** "D4–D7, D14 pass; counter bounding box byte-identical across the count"
**Lanes:** `audit-motion` (D6 springs, D7 hold-begins, C17 pairs, G-series) · `audit-type` (D4 reserve, D5 digit-count, D14 bbox, ENC-28 separators)
**Date:** 2026-08-12 (orchestrator re-run; gate evidence regenerated this date)

## How the gate was run

All three probes executed by the orchestrator, not just the lanes:

| Probe | Command | Result |
|---|---|---|
| Motion gate (C17/G1–G6/D6/D7 hold-static + bundle assertion) | `node data/audit/11/motion-probe.mjs` | exit 0, "ALL GATES GREEN", `motion-report.json` pass:true, 50 gate rows + 16 C17 rows, zero `pass:false` |
| D5 digit-count + ENC-28 separators (type) | `node data/audit/11/counter-values-probe.mjs` | exit 0, "D5 overall: PASS" |
| D14 counter bbox (type, real woff2 fonts) | `node data/audit/11/type-d14-probe.mjs` | exit 0, `type-d14-report.json` pass:true |

## Pass / fail per check

| Check | Verdict | Evidence |
|---|---|---|
| **D7** — every archetype declares its A4.1 "hold begins" frame | **PASS** | 7 header-comment declarations added/updated (TERM unchanged); hold-static 16/16 (8 archetypes × 2 formats); C17 (hold−1, hold) pixel-identical 16/16 in the stage+headline region |
| **C17** — pixel-identity pairs | **PASS** | 16/16 pairs identical (hero 65/66, term 29/30, list 40/41, contrast 22/23, relation 36/37, image 65/66, statement 18/19, progress 37/38 — shorts + longform) |
| **D6** — spring damping ratio ζ ∈ [0.46, 1.0] | **PASS** | source scan: exactly 2 spring sites — Progress ζ=0.518 (d=13.9, k=180) in-range; ImageBeat push ζ=10.000 = documented A3.3/MANUAL D1 exception (only spring in the set, deliberately overdamped) |
| **D5** (ENC-26) — counters start at the target's digit count | **PASS** | 58 HERO counters across 6 real-data cases, 0 d5 fails, distinct-length sets all singletons; 0 PROGRESS beats in real data |
| **ENC-28** — thousands separators on every intermediate value | **PASS** | all 58 counters' sampled distinct strings checked; 0 samples missing a separator on 4+ digit values |
| **D14** (ENC-27) — counter bounding box byte-identical across the count | **PASS** (8 tnum/mono channels) | Inter runs: owMin==owMax (770/770, 628/628), oh 220/220, `boxStable:true`, rect spread 0, `rectStable:true`, `reserveOk:true` |
| **D14 on the 5 flagged channels** (DM Sans ×4, Nunito ×1 — no tnum in GSUB) | **FAIL — documented, quantified, consumption pending** | DM Sans runs: ow spread 197px (449→646) and 167px (282→449), rect x-spread 69.2px/51.8px — the exact tabular-figure failure D14 exists to catch; the A1.3 fix mechanism is DELIVERED (see D4 row) but not yet consumed |
| **D4** (ENC-25) — counter reserves the final string's width | **EXCEPTION — mechanism PASS, consumption OPEN** | `layout/measure.js` gained `FIXED_SLOT_FAMILIES`/`needsFixedSlots()` (A1.3 flag) + `reserveCounterWidth()` (A1.1 helper) — T-11-05 implemented and verified (`reserveOk:true` on every D14 run, all 4 runs). Consumption in `beats/HeroNumber.jsx`, `beats/Progress.jsx`, and the legacy `HeroNumberScene` is outside the type lane's ownership → SFR-T-11-1/SFR-T-11-2. Until that lands, D4 holds de facto only on the 8 tnum/mono channels |

## Gate infrastructure fix (this gate cycle)

The motion probe could not complete: its bundle mixed **two Remotion copies** — the entry resolved `remotion` from the root tree (4.0.505, no `RenderResourceManagerContext`) while the beats' `@remotion/media` (commit 41c1b21) resolved to the subpackage tree (4.0.507, context present) — so every frame mounting `<Audio>` (hero@66, list@18/28/41/45, progress@38) threw `Cannot read properties of undefined (reading '_currentValue')`, silently swallowed by `runGate`, and the probe crashed before writing its report.

**Fix (CLAIM-MOT-11-05, counter-checked CONFIRM):** one file, `data/audit/11/motion-probe.mjs` — the `bundle()` call now passes `webpackOverride` aliasing `remotion`/`remotion/no-react`/`remotion/version`/`@remotion/media`/`@remotion/paths`/`@remotion/shapes` to the subpackage's 4.0.507 esm paths (single copy), plus a post-bundle single-copy assertion (`report.bundle`) and a non-silent `runGate` error log. No gate logic changed. Production pipeline (`render.js` inside the skill dir) is single-copy — the skew was probe-only.

## Verdict

**PASS** — with one open exception escalated to the user:

1. **D4/D14 on the 5 non-tnum channels** (Legal Brief, Earth Signal, Build Smart, NutriDecode — DM Sans; MedBrief — Nunito): jitter demonstrated and quantified; the A1.3 fixed-slot mechanism is delivered; **consumption (SFR-T-11-1 beats, SFR-T-11-2 legacy scene) needs an orchestrator/user decision** — close now by authorizing the beats/legacy change, or defer to the production-wiring stage.

## Open SFRs carried to the user (not applied — outside orchestrator edit scope)

- **SFR-MOT-11-1…11-6** — `DETAIL-REFERENCE.md` A4 table amendments (RELATION/HERO/LIST/PROGRESS hold rows + CONTRAST/IMAGE/STATEMENT rows + D6 exception note) — spec-owner action
- **SFR-MOT-11-7** — Stage-9 Contrast divider unimplemented in `Contrast.jsx` (ends tA+6 < hold tA+13, not a D7 blocker) — accept as divergence or re-dispatch stage 9
- **SFR-T-11-1** — beats `HeroNumber.jsx`/`Progress.jsx`: consume `needsFixedSlots()` → per-digit fixed slots (`width: 0.62em`), reserve `reserveCounterWidth()` from frame 0; also apply the destructured-but-unused `fontFamily` prop
- **SFR-T-11-2** — legacy `HeroNumberScene` in `compositions/motion-graphics.jsx`: same fixed-slot + reserved-width fallback (this is the path currently wired into Root.jsx)
- **SFR-T-11-3** — `CHECK-REGISTER.md`: ENC-25/ENC-27 → PASS on 8 tnum/mono channels, FAIL on 5 flagged pending SFR-T-11-1/2; ENC-26/ENC-28 → PASS

## Paper-trail note

`audit-type.ledger.md` §2.3 (execution record) and §3 (counter-check verdicts) are empty — the type lane's verify-independent results were never recorded. All type-lane claims were independently re-confirmed by the orchestrator's own gate runs above; the ledger gap does not affect the gate verdict but is recorded for the record.
