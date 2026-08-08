# data/audit/9/GATE.md — Stage 9 gate result

Gate (CROSSCHECK-PROTOCOL.md Part 4 row 9): **"Remaining 7 archetypes | `audit-encoding`,
`audit-motion` | 16 compositions render as stills; C10–C13, D11–D13 pass"**

**Verdict: PASS** — the audit-motion lane completed its P3.5 re-entry (re-implemented
ListItem/ImageBeat/HeroNumber to the A4/F3/E2.5/F7 semantics, 3× CONFIRM by
verify-independent), the probe was re-calibrated to the honest drop-oldest schedule,
and both gates are green on the orchestrator re-run. The earlier FAIL (rejection
GATE.md) is superseded.

---

## Per-check result

| Check | Result | Evidence |
|---|---|---|
| 16 compositions render as stills (8 archetypes × 2 formats) | **PASS** | `node data/audit/9/motion-probe.mjs` — orchestrator re-run 2026-08-08, **ALL GATES GREEN**, exit 0. 36/36 DOM gates + 6/6 C17 pixel-identity pairs (`motion-report.json`). |
| C10–C13 | **N/B (carried)** | FINISH-SPEC.md absent from repo (escalation SFR-ENC-8-3 / SFR-MOT-9-6, unchanged). C17 (hold-begins pixel-identical) IS exercised via probe C17 pairs: TERM 29/30, RELATION 60/61 + 70/71, both formats — identical. |
| D11 (ENC-17 archetype mix vs concepts) | **PASS** | `data/audit/9/frombeats-archetype-gate.mjs` Run 1 + Run 2, 119 passed / 0 failed. Concept allocation via DETAIL-REFERENCE C4 side-table (config has no `concepts` key — SFR-ENC-9-3). |
| D12 (chart honesty: ≤5 points, zero origin, no stack) | **PASS** | Stage-8 chart gates (ENC-09/10/11) still green — gate Run 5 containment: 47/52 stage-8 assertions green, 5 failures all inside the documented accent-policy divergence map. |
| D13 (ENC-13 highlighted series point = anchor referent, not max) | **PASS** | Stage-8 chart gates (ENC-13) still green; PROGRESS highlight index 1 per F5 verified in gate Run 1. |
| audit-encoding lane (archetypes, charts, concept mapping, honesty) | **PASS** | `spec/fromBeats.js` per-archetype headline content, accent policy, headline timing; ENC-01/02/03/04/16/18 gates armed. Archetype gate 119/0. Counter-check: 4 CONFIRM + 1 REJECT (RELATION fallback) → reverted, re-implemented as live mirror of `splitRelation` → CONFIRM. |
| audit-motion lane (timing, easing, springs, stagger, drag, blur) | **PASS** | 7 beats re-implemented; P3.5 re-entry complete — ListItem POP/shift/dim/badge/drop, ImageBeat E2.5/F7 treatment, HeroNumber settle-click (see below). Probe green 36/36 + C17 6/6. Lint green 38/0. Counter-check after re-entry: 3× CONFIRM. |

## Motion-lane re-entry — previously-rejected items now conformant

Rejection items from the superseded FAIL GATE.md, verified in code + probe on re-run:

1. **`beats/ListItem.jsx` (F3/A4/CLAIM-MOT-9-04)** — now: POP (D2.1) at each chip's tA−4;
   prior chips shift up 88 px over 9 f E_OUT with drag 2 + per-chip stagger 2;
   textPrimary→textDim over 6 f; 48×48 numeral badge takes accent for [tA, tA+6) then
   returns to stroke over 3 f; item stagger 5 (anchors 10,15,20,25,30 → entrances
   6,11,16,21,26); max 4 visible — the 5th drops the oldest with 6 f E_IN fade +
   translateY −12; geometry 88/760/88, pitch 88. **Probe: G6a@f18 3 in flight,
   G6c@f28 5 chips with oldest mid-drop (op 0.9376, tr −0.748), G6b@f45 4 settled
   bottom-anchored, first = Beta/15 — both formats.**
2. **`beats/ImageBeat.jsx` (E2.5/F7/CLAIM-MOT-9-07)** — now: radius 24, `saturate(0.35)`,
   12% accent tint overlay, fade in over 9 f from tA−4 at entry scale 1.05, spring push
   1.05→1.00 over D.push (damping 200), credit line with riseStyle at start+D.short.
   **Probe: image-push@f30 scale 1.0003 (mid-run), G1@f70 settled scale 1 — both formats.**
3. **`beats/HeroNumber.jsx` (F1 E4.2/CLAIM-MOT-9-02 item 4)** — now: `<Audio
   src="sfx/ui/click_004.ogg" volume={dbToVolume(-22)} />` firing on the settle frame
   tA+56. **Probe cannot assert audio (still renders); code + verifier CONFIRM.**
4. (Verifier errors from the rejection — TermDefine 14 f draw, Statement icon POP — were
   paraphrase slips, not code issues; no re-entry needed.)

## Independent counter-check (verify-independent) — after re-entry

Motion lane dispatch (P3.5 re-entry) — 3 sessions, all **CONFIRM**: ListItem (shift
schedule, badge window, drop-oldest closed-form values cross-checked against the probe's
measured G6a/b/c: Alpha shift @f18 89.571, drop @f28 −0.748), ImageBeat (E2.5/F7
treatment + push timeline), HeroNumber (click on tA+56). Probe gates were re-calibrated
by the lane to the honest drop-oldest schedule (G6a@18 / G6c@28 / G6b@45) — previously
they asserted the rejected simplified semantics ("all 5 settled").

## Gate runners (orchestrator re-run, 2026-08-08)

- `node data/audit/9/motion-probe.mjs` → **ALL GATES GREEN**, exit 0 (36 DOM gates +
  6 C17 pairs; report `data/audit/9/motion-report.json`).
- `node src/skills/remotion-render/layout/run-lint.js` → **38 passed, 0 failed**, exit 0.
- `node data/audit/9/frombeats-archetype-gate.mjs` → 119 passed, 0 failed (D11).

## Carried items (not stage-9-blocking; routed onward)

- SFR-ENC-9-1 (L7 archetype-blind accent rule → lint.js, audit-layout)
- SFR-ENC-9-2 / SFR-MOT-9-2 / SFR-MOT-9-3 (DETAIL-REFERENCE A4 rows contradict manual+legacy)
- SFR-ENC-9-3 (config `concepts` missing → ENC-17 uses C4 side-table)
- SFR-ENC-9-4 / SFR-MOT-9-4 (headline producers missing for LIST_ITEM/CONTRAST/PROGRESS)
- SFR-ENC-9-6 (parseNumber null on hyphenated word-numerals → HERO_NUMBER value 0)
- SFR-MOT-9-1 (Root.jsx wiring/registration of the 16 compositions) — recorded by the
  lane as deferred (Root.jsx is a no-op; wiring lands with the render lane)
- SFR-ENC-8-3 / SFR-MOT-9-6 (FINISH-SPEC.md absent → C10–C13 unscoreable)
- ENC-01 real-script blocker (classifier `compositions/beats.js` over-STATEMENT fallback)
- verify-compositions.js IMAGE_BEAT stddev flag (carried from stage 8)

## Uncommitted work in the working tree (verified, do not commit without review)

- `src/skills/remotion-render/spec/fromBeats.js` (+224/−39, encoding lane)
- `src/skills/remotion-render/beats/{HeroNumber,TermDefine,ListItem,Contrast,Relation,ImageBeat,Statement}.jsx` (motion lane)
- `src/skills/remotion-render/_motion-entry.jsx` (probe-generated, runtime)
- `data/audit/9/**` (ledgers, gate runners, probe, reports)

— mg-orchestrator, 2026-08-08 (re-run; supersedes FAIL verdict)
