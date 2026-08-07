# STAGE 7 — Layer + primitives — GATE

**Date:** 2026-08-07
**Lanes:** `audit-layout` (build), `audit-motion` (verify)
**Protocol row:** Part 4, Stage 7 — "Tier 2 stills within ±2px; zero sibling flex in Stage/Headline/Caption"
**Verdict:** PASS

---

## Gate checks

| # | Check | Result | Evidence |
|---|---|---|---|
| G1 | `layers/Layer.jsx` exists — the ONLY positioning component | PASS | `src/skills/remotion-render/layers/Layer.jsx` (245 lines, blob `4fcebc95…`). Pure rect-driven positioning: R1 absolute rect, entrance/exit interpolation inline via individual CSS transforms, zero `display: flex` (LAY-11 grep 0 hits whole-file and code-only), zero raw pixel positions (LAY-10; only named motion constants 24/12/1.15/0.97/3 + D tokens from beats.js). JSX parse OK, 6 `ease()` calls all with easing + both clamps. |
| G2 | Primitives per MANUAL A5.1/A5.2/A5.3 | PASS | Five drafts moved into `primitives/` (SFR-LAY-7-1…7-5): Rule, Chip, Node, Panel, Icon. Rule 4px/radius-2 round-cap; Chip surface/2px border/radius 16/pad 16×24; Node r44 surface + 3px border (accent-when-highlighted per live renderer); Panel surface/radius 24/pad 32/no shadow; Icon from vendored ICON_INNER + A4 sizing. Zero shadows/gradients/self-positioning; radius set {8,16,24} only; Chip's `display:flex` is leaf-internal (§4.1 R1 — explicitly not a sibling positioner). Chart.jsx deferred to audit-encoding (stage 8). |
| G3 | Tier 2 stills within ±2px (LAY-12) | PASS | `node data/audit/7/tier2-probe.mjs` re-run by orchestrator: **worst |d| = 0.00px over 8 layers** at f30 and f45 (kicker/chart/headline/caption/rail/support/accent/caption-test). Root-relative measurement (headless `doctop=-999999` offset handled), scale = 1.0000. |
| G4 | No safe-rect crossing at render (LAY-13) | PASS | Probe: **worst crossing = 0.00px** at f30/f45; every rect inside SAFE_SHORTS (288–1248). |
| G5 | Zero sibling flex in Stage/Headline/Caption (LAY-11) | PASS | Probe asserts no Layer div is flex AND no parent is flex (f30/f45/f3/f86) — all PASS. Repo grep on the new stack (layers/, primitives/) = 0 hits. Legacy `compositions/*.jsx` flex is delete-list D1 → swept at Stage 15. |
| G6 | D2/D3 motion branches fire per contract | PASS | f3: entrance in flight (chart mid-POP scale 1.143 toward 1.15 peak, op <1 on entering layers); f86: exit routing per role — headline/accent fade-only (dy=0), chart/support stage exit (dy=−12), caption-test 3f scale 0.970 (dormant D3 branch now covered in-engine). |
| G7 | No regression | PASS | lint 38/0, spec 15/0, verify-compositions **ALL STYLES OK**, esbuild JSX parse 6/6 (Layer + 5 primitives). compositions/, styles/, spec/ untouched. |

## Lane outcomes

- **audit-layout** (ledger `data/audit/7/audit-layout.ledger.md`, 709 lines): CLAIM-LAY-019 CONFIRM (+2 hardening edits re-verified — furniture guard both entrance+exit; comment hygiene); CLAIM-LAY-020 **REJECT → fixed → CONFIRM**. SFRs LAY-7-1…7-7 filed.
- **audit-motion** (ledger `data/audit/7/audit-motion.ledger.md`, 391 lines): 13 claims, 12 counter-checked CONFIRM + 007 closed via orchestrator decision (P3.5). VERIFIED TOKEN TABLE delivered (all 7 D tokens RE-VERIFIED YES). SFRs motion-1/2/4 filed (motion-3 folded into motion-2). Probe G1–G4 green.

## Counter-check rejections (all handled per P3.5)

1. **LAY-020 attempt 1 REJECT** (verifier ses_023d29604ffe8zYmCb1RLdOiOZ): the Tier-2 probe fed the component rects WITHOUT `role` — every FADE layer fell into the default stage-exit branch (headline/accent logged dy=−12), contradicting the on-disk Layer.jsx fade-only branch. Probe defect, not product defect. Fixed: embed `role` exactly as compile() emits it, add an EXIT-ROLE-ROUTING gate, add a `caption-test` branch-coverage layer → re-run ALL GATES PASS → **CONFIRM**.
2. **motion-011 REJECT ×2** (stagger): (a) my bracket claim presented all three published stagger ranges as "matched" — 133ms only sits in equal.design's 80–150ms related-items band (6.7× MDC's ≤20ms cap); (b) hero frame slot misassigned (hero icon is at tA−4, not tA). Both corrected to verifier-confirmed facts; wording SFR-motion-2 filed.
3. **motion-007 REJECT ×2 → escalated (P3.5)** (D.hold): the value (45f = 1500ms; AVTpro T7.1 1.5s min; Corus 1.5s/≤32 chars) was confirmed by BOTH verifier sessions — only my precision-note wording failed (flat "140–180 wpm" attribution to DCMP; "at/above caps" not universal). **Orchestrator decision 2026-08-07: Option A + D** — corrected the note to verifier-confirmed facts (Ofcom/BBC/ITC 160–180, ITC ≤140, DCMP tiered 120–160/225–235), closed 007 as CONFIRMED (value), filed SFR-motion-4 for the blueprint cite. No third dispatch.

## Shared-file requests applied

| ID | File | Action | Status |
|---|---|---|---|
| SFR-LAY-7-1…7-5 | `primitives/{Rule,Chip,Node,Panel,Icon}.jsx` | 5 primitive drafts moved from `data/audit/7/primitives-draft/` | APPLIED (verified on disk) |
| SFR-LAY-7-6 | `MOTION-GRAPHICS-MANUAL.md` §D2.1 | POP easing cell `[E.out, E.settle]` → single `E.out` (live renderer verbatim, finding 3) | APPLIED (line 733) |
| SFR-LAY-7-7 | `MOTION-GRAPHICS-MANUAL.md` §A5.1 | Node border "3 px accent border" → "3 px stroke border, accent when highlighted" (live renderer mg.jsx:855/866) | APPLIED (line 286) |
| SFR-motion-1 | `MOTION-BLUEPRINT.md` §12 | MDC duration range (50–500 ms) → (50–1000 ms; 16 slots listed) | APPLIED (line 607) |
| SFR-motion-2 | `MOTION-BLUEPRINT.md` Rule 1.6 | "alone" → "unopposed" + accurate stagger-bracket split | APPLIED (lines 168–174) |
| SFR-motion-4 | `MOTION-BLUEPRINT.md` cite 39-1 | Broadcast wpm framing appended (Ofcom/BBC/ITC/DCMP tiered) | APPLIED (line 244) |

## Escalations / carried notes

1. **ESC-LAY-7-1 (ownership gap, carried to user):** `primitives/**` is granted to NO lane allow-list (`audit-layout.md` has only layout/spec/layers; `audit-encoding.md` only `primitives/Chart.jsx`). Worked around this stage via SFR moves applied by the orchestrator; recommend granting `primitives/**` (except Chart.jsx) to audit-layout for stage 9+ wiring, or having audit-encoding own the whole dir from stage 8.
2. **ESC-LAY-7-2:** orchestrator edit allow-list blocks `.opencode/agents/*.md` — the primitives grant could not be added by the orchestrator mid-stage (config is user territory). No gate impact.
3. **Carried (stage 9):** `verify-compositions.js` IMAGE_BEAT stddev 10.3 flags — image beats render as stills at stage 9; the flag is the known "flat image" proxy.
4. **Deferred:** `spec/fromBeats.js` (audit-encoding, stage 8); `captions/` (stage 10); FINISH-SPEC.md absent (escalation 0–6).

## Completion criteria

- [x] Both ledgers read (`data/audit/7/audit-layout.ledger.md`, `data/audit/7/audit-motion.ledger.md`)
- [x] Shared-file requests applied (7 files touched: 5 moves + 2 docs)
- [x] Gate checks G1–G7 pass (orchestrator re-ran Tier 2 probe + baselines)
- [x] GATE.md written

**STAGE 7 CLOSED — verdict PASS. Next: Stage 8 (`PROGRESS` archetype, lanes `audit-encoding` + `audit-motion`; gate: L8, L9, L10 pass — the three chart bugs cannot recur).**
