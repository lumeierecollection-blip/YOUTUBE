# GATE — Stage 12 (Background + depth)

Stage: 12 — Background + depth (dot-grid background discipline, stage occupancy,
24px separation, motion-blur confinement). Scope: 6 motion-graphics channels
(Money Mind, Legal Brief, Border Lines, Fraud Files, Skill Stack, Factory Floor).
Date: 2026-08-29 (run 1); re-entry runs after two lane gate failures.

## Lane dispatch (protocol Part 4 row 12)

Protocol row 12 names only `audit-color`, but register §0.3 assigns the nine
Stage-12 rows across three lanes. Dispatched all three IN ONE MESSAGE
(parallel): **audit-layout** (LAY-18, LAY-19), **audit-color** (COL-12/13/17/18/19/22),
**audit-motion** (MOT-18). Mapping recorded for GATE.md lineage.

Map from the protocol gate text (old fragment IDs) to register rows:
- `B2` → COL-17 (per-archetype dot-grid density) + COL-18 (density constant
  within section, changes only at the section wipe).
- `D8` → LAY-18 (stage occupancy ≤ 253,000 px²).
- `D15` → COL-20 (ground-plane luminance constant) — register gates this at
  **Stage 16** (Tier 3 contact sheet), so it is NOT forced into Stage 12;
  noted here as spec-vs-stage mapping, enforced at Stage 16.

## Per-check result

| Check | Status | Evidence (run at gate time, not asserted) |
|---|---|---|
| LAY-18 stage occupancy | **PASS** | `node layout/run-lint.js` (render dir): lintL18 built into layout/lint.js, wired into lintAll (14 checks); `46 passed, 0 failed`, exit 0. Over-packed fixture caught; chart counts bars (144,384 px²), not the blank container. |
| LAY-19 24px separation | **PASS** | Same run: `lintL19` — 10px pair caught; headline/chart with 68px gap passes; intra-chart bars (8px gutter) are one object, not a pair. |
| COL-12 zero shadows | **PASS** | Re-verified live by lane: `boxShadow` 0 hits in code. |
| COL-13 zero gradients | **PASS** | Re-verified live by lane: gradient 0 code fills (12 comment mentions + 1 diagnostic string at run-visual-tests.js:534, no render path). |
| COL-17 B2 density table | **PASS** | `styles/tokens.js`: DOT_GRID table exactly 8 archetypes (6%/4%/0, nothing between), pitch 64px absolute (B2.3), dot 4px (B2.4), unknown archetype throws. Probe `node data/audit/12/check-dot-grid-density.mjs`: Tier 1 ALL PASS, exit 0. **Application site PASS** after SFR-12-COL-1 (Background via `dotGridStateForFrame`; ListRunScene via `DOT_DIAMETER`/`DOT_GRID_PITCH`/`DOT_GRID.LIST_ITEM`; no literal duplication). |
| COL-18 density const within section | **PASS** | Section resolver (B2.2): lower-wins across mixed-archetype sections; inheritance for empty sections; frame sweep transitions ONLY at section wipes (recorded transition frames). Probe Tier 1 ALL PASS. |
| COL-19 integer px | **PASS** | Re-verified live by lane: layout/measure grid params integer px only. |
| COL-22 moodFrom unused | **PASS** | Re-verified live by lane: `moodFrom` 0 hits. |
| MOT-18 motion blur only in transition subtree | **PASS** | `node data/audit/12/probe-mot18.mjs`: modules `composition.js (SFR applied)`, 43 files scanned, motionBlur total 0, outside transition 0 (threshold 0); depth blur distinct (8 plane values, subject-not-sharp 0, non-constant 0); fixtures 4/4 incl. Phase-4 back-door proof; VERDICT PASS, exit 0. |
| COL-14/15/16 | RETIRED | Register retired; not re-validated. |

## Shared-file requests applied (protocol step 4)

1. **SFR-12-COL-1** (audit-color → orchestrator): applied to
   `compositions/motion-graphics.jsx` — Diff A (Background density-driven via
   `dotGridStateForFrame`, 0% renders no layer), Diff B (tokens import +
   call site feeds `mg?.beats`/`mg?.sectionRanges`), Diff C (ListRunScene
   panel grid → `DOT_DIAMETER`/`DOT_GRID_PITCH` at `DOT_GRID.LIST_ITEM` =
   0.04, fixing the B5 10% ceiling violation). Applied via
   `data/audit/12/apply-sfr-12.mjs` (line-wise, CRLF-preserving, every anchor
   matched exactly once). Verified byte-exact at lines 356–375, 1207, 1001–1007.
2. **SFR-motion-12-1** (audit-motion → orchestrator): MOT-18 permanent gate
   (MOTION_BLUR_SIGNALS, FRAME_BLUR_RE, scanMotionBlurSource,
   isTransitionContextFile, gateMotionBlur) appended to `visual/composition.js`
   after `shotSignatures` (block: `data/audit/12/sfr-motion-12-1-block.txt`).
3. **SFR-motion-12-2** (audit-motion → orchestrator, Phase-4 fix): replaced the
   gate's declaration block so no signal token appears as a contiguous string
   in the gate module (byte-level exemption, runtime-identical regexes), fixing
   the self-match defect. Applied by the same idempotent script.

Process note: SFR-12-1's append step was initially NOT idempotent, so a second
apply run duplicated the 90-line block (587 lines) and broke SFR-12-2's anchor
uniqueness. Detected at the gate, repaired (duplicate removed; block now
exists exactly once, 497 lines), and `applyLineReplace`/`appendLines` hardened
with idempotence + duplicate-abort guards that fail loudly instead of
corrupting. This defect was introduced by the orchestrator's own apply script,
not by a lane.

## Gate-failure re-entries (protocol step 5)

Run 1 gate FAILED on two lanes' own probe/SFR inconsistencies; both lanes
were re-dispatched alone, in parallel, with the exact failure text:

1. **audit-color — COL-17/18 application site.** Failure: probe regex matched
   only numeric literals (`dotSize: (\d+)`), so the SFR's symbolic wiring
   reported `0 dotGrid call(s)` → PENDING. Root cause was the probe, not the
   wiring. Lane rebuilt the application-site scan (5-part structural check:
   tokens import, exactly 2 sites, `dotGridStateForFrame` state consumption,
   symbol-resolved geometry/opacity, conditional 0%-no-layer render), proved
   teeth with 3 throwaway mutation fixtures (literal 8/80, correct-looking
   4/64 literals, `beats={[]}` — all FAIL with the right message), deleted the
   fixtures. Re-run: APPLICATION_SITE PASS, TIER 1 ALL PASS, exit 0.
   Ledger Phase-4 re-entry appended (`data/audit/12/audit-color.ledger.md`).
2. **audit-motion — MOT-18 self-match.** Failure: the applied permanent gate in
   `visual/composition.js` self-matched its own declarations (literal
   `@remotion/motion-blur`, `<CameraMotionBlur>`, `<Trail>`, and FRAME_BLUR_RE
   matching the word `frame` in its own source) → 4 outside-transition hits on
   a clean graph. The lane could not edit composition.js directly (permission
   deny, correctly not bypassed), so it filed SFR-motion-12-2 with byte-level
   token-split declarations, plus: probe self-match detector (fails loudly
   while a gate self-matches), fixture 4 (back-door proof planting a real
   `<CameraMotionBlur>` 2 lines after the gate block, still caught),
   fragment-built bundled fallback, and `graphBase`/`PROBE_MOT18_RENDER_DIR`
   test hooks. Re-run after orchestrator applied SFR-12-2: VERDICT PASS,
   outside 0, fixtures 4/4, exit 0. Ledger Phase-4 re-entry appended
   (`data/audit/12/audit-motion.ledger.md`), SFR-motion-12-2 registered.
3. **audit-layout** — no re-entry needed; LAY-18/LAY-19 passed on run 1.

Neither failure was papered over or gated-loose; each fix closed a real
measurement gap and added teeth fixtures.

## Residuals (documented, not hidden)

- dot-grid **Tier 2** (real mg package compile) is SKIPPED on this machine:
  `@remotion/captions` not installed here (npm install'ed render sandbox
  required). Tier 1 + wiring scan carry the verdict locally; Tier 2 runs at
  Stage 17 (production render) on the sandbox.
- `D15`/COL-20 ground-plane luminance constancy: gated at Stage 16 per the
  register (Tier 3 contact sheet), not here. Recorded for the Stage-16 lane.
- Loaded orchestration config still pre-reconciliation (this session's editor
  allow-list lacks `compositions/motion-graphics.jsx` and
  `visual/composition.js`); SFRs were applied via the sanctioned bash→node
  mechanism. On-disk agent configs were reconciled earlier; new permissions
  bind after an opencode restart.
- `FINISH-SPEC.md` remains absent at repo root; its R01–R30 content is
  re-encoded as `DEL-*` checks in the register, so Stage 15 remains runnable.

## Verdict

**STAGE 12 GATE: PASS** (run 1 failed 2 checks; both lanes fixed with teeth;
re-run green). All nine active Stage-12 register rows verified; two retired;
one (COL-20/D15) explicitly deferred to Stage 16.

Files changed in Stage 12 (all lane-owned or SFR-applied): layout/lint.js,
layout/run-lint.js, styles/tokens.js, visual/composition.js,
compositions/motion-graphics.jsx, plus Stage-12 artifacts under data/audit/12/
(3 ledgers, 2 probes, 2 SFR block files, apply script, report). 516 insertions,
26 deletions across 15 files (diff --stat), all staged-review pending.