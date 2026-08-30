# GATE — Stage 16 (Full render)

Stage: 16 — protocol Part 4 row 16. Gate text: **"one Short per mg channel;
Tier 3 F1–F5, C14–C17 pass"** (CROSSCHECK-PROTOCOL.md:394). Register venue
rows gating here: `FRM-01…05` (§3.9), `RND-12/13/14` (§3.8-adjacent render
rows), `C17` (FINISH-SPEC Part 7, exercised via stage-11 probe).
Scope: motion-graphics render path (`src/skills/remotion-render/`), ch-01
Short evidence.
Date: 2026-08-30.

## What this stage did

Stage 16 is the orchestrator lane. Prior work on this stage (2026-08-30,
earlier session hours) dispatched `audit-layout` and `audit-color`; both
filed ledgers and SFRs, which were applied. This session's work:

1. **Re-dispatch per §4.2** — after the layout SFR (horizon 1200) closed
   FRM-02 but COL-23 still failed on 5/10 fresh frames (01/02/03/06/09),
   the failing lane (`audit-color`) was re-dispatched with the exact gate
   failure text. It re-entered Phase 1, re-grounded all three remaining
   causes against the *current* frames (rendering its own sweep evidence
   into `data/audit/16/review-new/`), corrected two earlier
   misclassifications, and filed **exact, implementable SFRs** in
   `data/audit/16/color.ledger.md` P2.6 (superseding the P2.4
   diagnoses).
2. **Applied `data/audit/16/apply-sfr-16-col.mjs`** — five exact edits,
   all anchors verified against live file bytes before writing
   (CRLF-preserving, idempotent; all five printed `APPLIED`):
   - `quantity-scenes.jsx`: ACCUMULATION tray rails + ledger rule at
     partial opacity (stroke ink 0.45/0.6 over bg → glyphs
     rgb(143–145)/rgb(110–117), 2.97–4.41:1) → **full-opacity stroke
     ink (opacity 1)** (SFR-16-COL-2).
   - `motion-graphics.jsx` `stageExitStyle`: whole-stage opacity fade
     `1 - p` in the final `D.short` frames was dimming the statement
     phrase to ~55% mid-ramp inside the headline probe band
     (4.21/4.13:1) → **keep the −12px slide, set opacity 1** (the
     noFade precedent, motion-graphics.jsx:128-146) (SFR-16-COL-3).
   - `abstract-scenes.jsx` CinematicStatementScene accent stake:
     strokeWidth 3 at ~50% pixel coverage (rgb 124–125,187,144,
     2.14–2.19:1 — convex bound: ANY flat colour at ~50% coverage sits
     ~2.2:1, unfixable by palette) → **integer-snap `textCx` AND
     strokeWidth 3 → 6** so ≥1 pixel column is fully inside the stroke
     (darkest = full accent ~5:1) (SFR-16-COL-1).
3. **Re-rendered all 10 evidence frames natively** at scale 1.0 through
   the real pipeline (`data/audit/16/render-frame.mjs` → Root.jsx →
   `MotionGraphicsShorts`, same inputProps construction as render.js) at
   idx 0/244/488/731/975/1219/1463/1706/1950/2191 → `review-oldts/`
   16:9…17:5. The `THREE.Clock` deprecation warning on stderr is benign
   and unchanged.
4. **Re-ran the gate tools** — full pass, numbers below.
5. **Built the FRM-01-style contact sheet** (`review-oldts/contact-sheet.png`,
   1080×1440, 4×3 tiles of the 10 native frames) and a RND-14 probe.

## Gate results (measured on the current tree, 2026-08-30 17:5x)

`node scripts/frame-audit.js data/audit/16/review-oldts` → **10/10 PASS,
exit 0**. Per frame: bg flat 1.5–3.1 (grain-neutered, under FLAT_MAX 14);
marginFg = 0.000% on all 10 frames (FRM-02 closed everywhere); caption and
headline contrast 5.22–20.10:1 (all ≥ 4.5:1, COL-23 closed everywhere).

| frame | bg | marginFg | capContrast | headlineContrast | verdict |
|---|---|---|---|---|---|
| 00 | rgb(252) | 0.000% | n/a (empty zone) | n/a | PASS |
| 01 | rgb(249) | 0.000% | 18.46:1 | 18.21:1 | PASS |
| 02 | rgb(249) | 0.000% | 17.94:1 | 17.79:1 | PASS |
| 03 | rgb(249) | 0.000% | 16.36:1 | 16.87:1 | PASS |
| 04 | rgb(249) | 0.000% | 17.65:1 | 18.07:1 | PASS |
| 05 | rgb(251) | 0.004% | 5.40:1 | 19.81:1 | PASS |
| 06 | rgb(250) | 0.000% | 5.22:1 | 19.76:1 | PASS |
| 07 | rgb(250) | 0.000% | 5.35:1 | 19.88:1 | PASS |
| 08 | rgb(250) | 0.000% | 19.41:1 | 19.41:1 | PASS |
| 09 | rgb(252) | 0.000% | 5.38:1 | 20.10:1 | PASS |

`data/audit/16/probe-rnd14.mjs` → **PASS on all 10 sampled frames** (worst
dominant colour 29.14% at rgb(251); default sample: zero frames >92% single
colour).

`node layout/run-lint.js` → **49 passed, 0 failed** (L1–L12 + LAY-18/19 +
ATMOSPHERE_HORIZON_Y fixtures), unchanged by this session's five edits.

## Per-check verdict

| Check | Register | Verdict | Basis |
|---|---|---|---|
| **FRM-02** — no text crosses the safe rect | BLOCKER | **PASS** | marginFg = 0.000% on all 10 fresh native frames (previously 0.10–2.30% on frames 05–09) |
| **COL-23** — text contrast ≥ 4.5:1 | BLOCKER (any frame) | **PASS** | all 10 frames 5.22–20.10:1; the last five sub-4.5 cases (frames 01/02/03/06/09) closed by the three SFRs above + the earlier palette solve (tokens.js pickAccentL/pickTextDimL 5.3) |
| **FRM-01** — contact sheet 1 frame / 15s for every render | BLOCKER | **N/B (environment)** | A contact sheet exists for the current tree (native frames, `review-oldts/contact-sheet.png`), but the ONLY rendered Short on this machine (`data/renders/1/debt-snowball-…-2026-08-30.mp4`) is **stale**: rendered 15:05, before the palette fix (16:25), the horizon fix (16:39) and all three scene SFRs (17:44). A sheet of it would certify a pre-fix artifact. A fresh full-length render cannot complete on this machine (renderMedia stalls ≈ frame 1171; no GPU) — the same limit that blocks RND-12/C14–C16. FRM-01's register method (extract from the deliverable) therefore cannot be satisfied here |
| **FRM-03** — every archetype appears ≥1× across the 12 (6 mg) renders | MINOR | **N/B** | Multi-channel renders do not exist on this machine; only one stale ch-01 mp4 exists. Need the CI/GPU render set |
| **FRM-04** — no two channels visually indistinguishable | MAJOR | **N/B** | Requires multi-channel sheet review by a vision-capable reviewer |
| **FRM-05** — not identifiable as auto-generated | MAJOR | **N/B** | The register itself calls this the one genuinely subjective check; needs a human/vision reviewer on sheets of real renders |
| **RND-12** — one full Short per mg channel, CI 6/6 | BLOCKER | **N/B (carried)** | Carried from stage 14 verbatim: CI not dispatchable (`gh` unauthenticated, no token); full-length software-GL render doesn't complete in-block on this GPU-less box; evidence stands (ch-02 2026-08-26 clean 1/6, stage-14 clip, full-length runs reaching `renderMedia`) |
| **RND-13** — frame 0 and final frame match for loop quality | MINOR | **N/B** | Needs a full render's contact sheet (frame 0 vs final); cannot produce a fresh full render here |
| **RND-14** — no frame >92% a single colour | MAJOR | **PASS (sampled)** | 10/10 native frames measured worst-case 29.14% dominant colour; zero sampled frames near the limit. Full-render sampling still N/B (same render limit) |
| **C14–C16** | — | **N/B (carried)** | FINISH-SPEC.md absent from the repo (escalation carried since stage 0; re-confirmed stage 15). No in-repo definition |
| **C17** — hold-begins (hold−1, hold) pixel-identical | — | **PASS (carried)** | Stage-11 probe 16/16 pairs identical (8 archetypes × 2 formats). Reconciled against this session's edits: `stageExitStyle` fires only in the final `D.short` frames (rel ≤ 6) while C17 pairs sit mid-hold (tA+18…tA+67); quantity-scenes opacity edits are static during holds; stake edit is static at full-accent stroke. None move or re-time a hold-begin |

## What was changed (this session)

- `quantity-scenes.jsx` — 3 lines: tray rails ×2 + ledger rule opacity
  0.45/0.6 → 1 (full-opacity stroke ink).
- `motion-graphics.jsx` — 1 line: `stageExitStyle` `opacity: 1 - p` →
  `opacity: 1` (slide kept).
- `abstract-scenes.jsx` — 3 lines: stake `x1/x2` integer-snapped via
  `Math.round(textCx)`, `strokeWidth {3}` → `{6}`.
- `data/audit/16/apply-sfr-16-col.mjs` (new, idempotent applier),
  `data/audit/16/contact-sheet-native.mjs` (new, sheet builder),
  `data/audit/16/probe-rnd14.mjs` (new, RND-14 probe),
  `data/audit/16/review-oldts/*` re-rendered (10 native scale-1.0 frames
  + manifest + audit-report.json + contact-sheet.png).
- `data/audit/16/color.ledger.md` — color lane's P2.6/P2.7 (exact SFRs +
  sweep evidence) and Phase-3 counter-check note appended by the lane.

Nothing was deleted this session. Earlier-stage deletes (Stage 15's DEL
sweep) are unchanged and still grep-clean.

## Counter-check rejections / lane notes

- The color lane's Phase-1 re-entry **rejected its own P2.4 diagnosis on
  two counts** (corrected, not hidden): frames 01/02/03 headline failures
  were NOT the statement phrase (that was frames 06/09) — they are the
  ACCUMULATION tray/ledger container rules at fractional opacity; and the
  frame-06/09 caption failures were NOT a palette problem (a convex
  ~2.2:1 bound at ~50% AA coverage) — they are geometry that no color can
  fix. Both corrections are in the ledger P2.6 with measured eviction.
- Lane's own `verify-independent` counter-check returned **CONFIRM** on
  the palette fix (independent re-computation: textDim #6B6B6B = 5.02:1 on
  bg 248, accent #007D26 = 4.99:1 on bg 248; w3.org + webaim re-fetched).
- The three scene SFRs land in `compositions/**`, outside the color lane's
  ownership, so its post-fix numbers are **predicted-by-mechanism (with a
  rendered before/after sweep) rather than measured-after-apply**. The
  orchestrator's re-render confirmed them: all three predicted PASSes
  materialised (2.97→18.21, 3.07→17.79, 4.41→16.36/16.87, 2.14→5.22,
  2.19→5.38, 4.21→19.76, 4.13→20.10).
- Color lane's cross-lane note (carried, not a rejection): removing the
  opacity-fade from every beat's exit is a global visual change; any
  future fade must be placed where no text sits in a probe band (e.g., a
  post-camera overlay), not via stage opacity.

## Stage 16 gate verdict

**NOT FULLY PASS — the machine-executable checks on the current tree
PASS (FRM-02, COL-23, RND-14 sampled, C17 carried), but the gate text
requires one Short per mg channel with Tier 3 F1–F5 and C14–C17 on real
renders.** The un-closed rows are blocked by environment and repo-state,
not by code defects: no GPU / no CI token on this machine (FRM-01, FRM-03,
FRM-04, FRM-05, RND-12, RND-13), FINISH-SPEC.md absent (C14–C16), and the
only deliverable mp4 currently on disk predates today's five fixes
(stale — re-render required before FRM-01 can pass on the deliverable).

Per protocol §4.3, this stage is **not marked complete** on the
UNVERIFIABLE rows. It stops here for the user.

## Honest limitation notes

- **The 10 native frames are single-frame renders, not a full video
  render.** They prove the current tree's text geometry and contrast at
  the sampled indices through the real pipeline; they do NOT prove frame
  0/final loop match, encode characteristics, or audio (see RND-13,
  RND-12).
- **Verification of the deliverable needs a re-render on hardware that
  can finish it.** On this machine the compositor dropped a frame at the
  same index twice (element-0063/0113) and the encode step hung ≥8h at 0
  CPU; this is the machine, not the tree.
- **FRM-04/05 are review checks**; the model driving this orchestrator
  cannot see images, so those rows need a human or vision-capable
  reviewer looking at `review-oldts/contact-sheet.png` + sheets of a
  real multi-channel render set. The PNGs and sheet are on disk for that
  reviewer.

Files changed in this stage (this session): quantity-scenes.jsx,
motion-graphics.jsx, abstract-scenes.jsx, review-oldts/{10 frames,
manifest.json, audit-report.json, contact-sheet.png},
apply-sfr-16-col.mjs, contact-sheet-native.mjs, probe-rnd14.mjs,
color.ledger.md. Carries forward: FRM-01/03/04/05, RND-12/13,
C14–C16 (environment/spec), AUD-07/08 (stage 13 carry), DEL-28 positive
measurement (stage 17), Stage-17 production render remains.