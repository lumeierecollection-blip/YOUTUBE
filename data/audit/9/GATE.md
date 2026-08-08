# data/audit/9/GATE.md — Stage 9 gate result

Gate (CROSSCHECK-PROTOCOL.md Part 4 row 9): **"Remaining 7 archetypes | `audit-encoding`,
`audit-motion` | 16 compositions render as stills; C10–C13, D11–D13 pass"**

**Verdict: FAIL — the audit-motion lane did not complete its mandated P3.5 re-entry.
The stage gate must not be closed. Stage 9 is BLOCKED pending the motion-side fixes.**

---

## Per-check result

| Check | Result | Evidence |
|---|---|---|
| 16 compositions render as stills (8 archetypes × 2 formats) | **FAIL** | 16 stills DO render and measure cleanly (34/34 DOM gates + C17 pairs, `node data/audit/9/motion-probe.mjs`, orchestrator re-run 2026-08-08; report `motion-report.json`) — but the stills prove the **simplified** ListItem/ImageBeat semantics that the independent verifier REJECTED. The probe's own G6a/b/c assert "all 5 chips settled", contradicting the A4/F3 drop-oldest schedule. A stills proof of non-conformant behavior is not a pass. |
| C10–C13 | **N/B** | FINISH-SPEC.md is absent from the repo (carried escalation SFR-ENC-8-3 / SFR-MOT-9-6); no in-repo definition exists. Mapping through CHECK-REGISTER Part 0.2 → COL/MOT/RND namespaces; cannot be scored without the source spec. C17 (hold-begins pixel-identical) IS exercised via probe C17 pairs — those pass for the implemented (rejected) semantics. |
| D11 (ENC-17 archetype mix vs concepts) | **PASS** | `data/audit/9/frombeats-archetype-gate.mjs` Run 1 + Run 2 (119 passed / 0 failed, orchestrator re-run). Concept allocation via DETAIL-REFERENCE C4 side-table (config has no `concepts` key — SFR-ENC-9-3). |
| D12 (chart honesty: ≤5 points, zero origin, no stack) | **PASS** | Stage-8 chart gates (ENC-09/10/11) still green — gate Run 5 containment: 47/52 stage-8 assertions stayed green, 5 failures all inside the documented accent-policy divergence map. |
| D13 (ENC-13 highlighted series point = anchor referent, not max) | **PASS** | Stage-8 chart gates (ENC-13) still green; PROGRESS highlight index 1 per F5 verified in gate Run 1. |
| audit-encoding lane (archetypes, charts, concept mapping, honesty) | **PASS** | `spec/fromBeats.js` +224/−39 (per-archetype headline content, accent policy, headline timing, ENC-01/02/03/04/16/18 gates armed). Gate 119/0. Counter-check: 5 sessions — 4 CONFIRM + 1 REJECT (RELATION fallback list) → reverted, re-implemented as live mirror of `splitRelation` → CONFIRM. |
| audit-motion lane (timing, easing, springs, stagger, drag, blur) | **FAIL** | 7 components exist; first-shot semantics DOM-measure cleanly; independent verifier REJECTED 3 genuine items (see below). P3.5 re-entry (re-implement + re-verify) NOT executed: the lane returned empty/aborted across **5 dispatches** (1× empty no-artifacts; 1× claim-cards only; 1× probe+verifier then stopped; 1× empty no-change; 1× surgical empty no-change). |

## Independent counter-check (verify-independent) — rejection contents

Motion lane dispatch 1 verdict: **REJECT**, with per-item disposition from the lane's own
re-grounding (ledger §3, §5):

1. **Genuine — `beats/ListItem.jsx`**: implements a simplified top-anchored static stack
   (RISE not POP; no shift-up 88 px, no textPrimary→textDim dim, no 48×48 number badge,
   no `click_001` at −24 dB on tA+2, no drop-oldest; geometry 104/736/64 vs spec 88/760/88;
   DROP_STAGGER 7). Contradicts CLAIM-MOT-9-04 + DETAIL-REFERENCE A4 (238-250) + MANUAL F3
   (1009-1028) + legacy ListRunScene (motion-graphics.jsx:1016-1064).
2. **Genuine — `beats/ImageBeat.jsx`**: missing the E2.5/F7 treatment — no radius 24,
   no `saturate(0.35)`, no 12% accent tint, fade from frame 0 instead of tA−4, no
   scale 1.05 entry, no 1.05→1.00 spring push (damping 200) over D.push, credit static
   (no riseStyle). Contradicts CLAIM-MOT-9-07 + MANUAL F7 (1083-1097) + E2.5/E2.6 (895-897).
3. **Genuine — `beats/HeroNumber.jsx`**: settle-click SFX never implemented (no `<Audio>`
   element; `ui/click_004.ogg` at dbToVolume(−22) on tA+56). CLAIM-MOT-9-02 item 4, F1 E4.2.
4. **Verifier error (rejected as finding)** — TermDefine rule draws 14 f not 9: claim
   P3.1 paraphrase slip on the lane's side; code matches claim/A4/F2 (14 f).
5. **Verifier error (rejected as finding)** — Statement icon POP vs "fade": same
   paraphrase slip; code matches claim/A4/F8 (POP).

Encoding lane's counter-check (all CONFIRM except the documented RELATION REJECT→re-entry).

## Gate-blocking items (carried, do not close)

- SFR-ENC-9-1 (L7 archetype-blind accent rule → lint.js, audit-layout)
- SFR-ENC-9-2 / SFR-MOT-9-2 / SFR-MOT-9-3 (DETAIL-REFERENCE A4 rows contradict manual+legacy)
- SFR-ENC-9-3 (config `concepts` missing → ENC-17 uses C4 side-table)
- SFR-ENC-9-4 / SFR-MOT-9-4 (headline producers missing for LIST_ITEM/CONTRAST/PROGRESS)
- SFR-ENC-9-6 (parseNumber null on hyphenated word-numerals → HERO_NUMBER value 0)
- SFR-MOT-9-1 (Root.jsx wiring/registration of the 16 compositions)
- ENC-01 real-script blocker (classifier `compositions/beats.js` over-STATEMENT fallback —
  11/32, 18/24, 10/21 — shared territory, not a stage-9 lane)
- verify-compositions.js IMAGE_BEAT stddev flag (carried from stage 8)

## Uncommitted work in the working tree (do not commit as a passing stage)

- `src/skills/remotion-render/spec/fromBeats.js` (+224/−39, encoding lane, gate green)
- `src/skills/remotion-render/beats/{HeroNumber,TermDefine,ListItem,Contrast,Relation,ImageBeat,Statement}.jsx` (motion lane, 3 items non-conformant)
- `src/skills/remotion-render/_motion-entry.jsx` (probe-generated, runtime)
- `data/audit/9/**` (ledgers, gate runners, probe, reports)

## What the gate needs to pass

Re-execute the motion-lane P3.5 re-entry: re-implement ListItem (POP entry, shift-up 88
with 2 f stagger, dim, badge 6 f window, click_001 −24 dB @ tA+2, item stagger 5, max 4
visible + drop-oldest 6 f E_IN), ImageBeat (radius 24, saturate(0.35), 12 % tint, fade
tA−4 + scale 1.05, spring push 1.05→1.00 over D.push, credit riseStyle), HeroNumber
(click_004 −22 dB @ tA+56); re-calibrate probe G6a/b/c to the drop-oldest schedule; re-run
probe + run-lint; re-dispatch verify-independent with VERBATIM claim cards; append verdicts;
then re-run this gate.

— mg-orchestrator, 2026-08-08
