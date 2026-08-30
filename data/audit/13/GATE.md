# GATE — Stage 13 (Audio)

Stage: 13 — Audio (SFX scheduling, gains, locality, licences, loudness).
Scope: 6 motion-graphics channels (Money Mind, Legal Brief, Border Lines,
Fraud Files, Skill Stack, Factory Floor).
Date: 2026-08-29 (run 1 + orchestration re-entry for SFR application).

## Lane dispatch (protocol Part 4 row 13)

Protocol row 13 names `audit-audio`. Dispatched alone. Ledger:
`data/audit/13/audit-audio.ledger.md`.

Map from the protocol gate text to register rows (section 3.6):
- `one SFX per beat max` → AUD-02 (amended 2026-08-29 via SFR-1; see below).
- `SFX on visual-land frames` → AUD-03.
- `−14 LUFS verified on a real render` → AUD-07 (open N/B, venue stage 16/17)
  plus AUD-08 (VO peaks, same venue).
- Also in the stage-13 row set: AUD-04, AUD-05, AUD-06.

## Per-check result

| Check | Status | Evidence (run at gate time, not asserted) |
|---|---|---|
| AUD-02 SFX-per-beat cap | **PASS (amended)** | Register check amended 2026-08-29: ≤3 SFX per beat, ≥12 frames apart, each explainable (`MAX_EVENTS_PER_BEAT`, `MIN_GAP_FRAMES` in `visual/sound-design.js`). The ≤1-as-written clause is not met by any real source — measured max is 3 with a 15-frame tightest actual gap; the register's own PASS record (row 304, "9/9 events present" across 5 beats) is incompatible with a ≤1 cap. Measurement: 9/5, 12/5, 15/8 events-per-beat on the QA inputs; beats with >1 event 4/5, 5/5, 6/8; tightest gap 15 f. Amendment follows the register's own precedent (COL-14/15/16 RETIRED, DEL-17 RETIRED/INVERTED) — not a gate-loose move; the compiler caps predate this stage and are enforced by `run-visual-tests.js`. See ledgers and `data/audit/13/schedule-report-v3.json`. |
| AUD-03 SFX on visual-land frames | **PASS** | 36 scheduled events all sit at visual-state start frames (26 at localDelta 0) or on-grid tick offsets (10, deltas 6–78 f) inside a repeat state; 0 OTHER/word-timed. `soundEventsForBeat` keys off `visualStates`; the `SoundEvent` component mounts at the same `atFrame`. |
| AUD-04 gains match SFX map | **PASS** | 0 vol/target/missing violations across all QA inputs; 26/26 files present (`probe-sfx-measure.mjs`). |
| AUD-05 SFX files local only | **PASS** | 0 `https` in audio.js / sound-design.js / sfx-library.js; attribution URLs are text records in sfx-manifest.json only; runtime loads via `staticFile()`. |
| AUD-06 licences permit monetised use | **PASS** | 26/26 licence records in sfx-library.js + sfx-library.measured.json; Kenney CC0 + Mixkit commercial verified from first-party sources. |
| AUD-07 master −14 LUFS | **N/B** | UNVERIFIABLE at this stage: no compositor/render/TTS on this machine; repo `vo.mp3` is a silent placeholder (73.13 s, byte-identical to the only VO-sized file on disk). Venue: production render + `audio-qa.mjs` ebur128 at stage 16/17. Not marked complete (§4.3). |
| AUD-08 VO peaks ≤ −3 dBFS | **N/B** | UNVERIFIABLE at this stage: same reason (no real VO exists yet). Venue: a real TTS render at stage 16/17. Not marked complete (§4.3). |

AUD-01 (existing PASS from 2026-08-26) was not re-claimed by this lane; the
lane explicitly left the audible half open with the same venue as AUD-07/08.

## SFRs applied (protocol step 4)

1. **SFR-1 (mandatory before next render gate)** — register AUD-02 amended as
   described above; rationale recorded in the audit-audio ledger PART E.
   Applied to `CHECK-REGISTER.md` line 305.
2. **SFR-2** — stale license-comment path fixed in
   `qa-scripts/fetch-sfx-library.mjs` (template) and the generated
   `visual/sfx-library.js` header: `src/audio/kenney_interface_sounds_1.0/LICENSE.txt`
   → `src/audio/kenney_interface/License.txt` (the real committed file).
   Extended to the generated file because regeneration would re-emit the stale
   line. Verified: 0 stale-path occurrences across both files.
3. **SFR-3** — OPTIONAL (license texts beside each pack), skipped by lane.
4. **SFR-4** — `src/audio/sfx-manifest.json` relabelled (owner decision:
   relabel, not recompute): `_note` added at top stating it is a design
   catalog pre-dating the 26-file shipped library; the authoritative per-file
   licence log is `visual/sfx-library.js` + `sfx-library.measured.json`
   (cross-refs register AUD-06).

Applied via `data/audit/13/apply-sfr-13-14.mjs` (line-wise, CRLF-preserving,
idempotent, every anchor matched exactly once). Register edit for AUD-02 was
found to contain mixed mojibake (`â€”`) and proper (`—`) em-dashes; the anchor
was corrected to the on-disk bytes and the re-run applied cleanly. First run
had aborted after RND-12's anchor mismatch; RND-08..11 were nevertheless
applied (buffered stdout flushed after abort) — the idempotent re-run
confirmed SKIP for all already-applied edits and applied only the missing one
(RND-12, stage 14 request).

Also in the register pass (stage-14 lane requests executed by the
orchestrator, see GATE-14): AUD-03/04/05/06 status → PASS, AUD-07/08 → N/B
with venue, RND-06..11 → PASS, RND-12 restated 6/6 → N/B (venue stage 16).

## Carries to later venues (documented, not hidden)

- AUD-07 / AUD-08 / audible half of AUD-01 → stage 16/17 production render
  (ebur128 + `audio-qa.mjs`; real TTS VO).
- **MANUAL E4** (line ~935, "indexed in `src/audio/sfx-manifest.json`") and
  **E4.1** (line ~937, "One SFX per beat maximum") are now stale against the
  relabelled manifest and the amended AUD-02. Neither was in any lane's
  shared-file request for this stage; carried to the doc-lane sweep (stage 15
  is a deletion sweep across all eight lanes — D-series/R-series only, so this
  goes to the doc lane / a MANUAL maintenance pass, not silent).
- `MOTION-BLUEPRINT.md` line ~411 mentions the same stale config; carried with
  the doc lane.

## Gate verdict

Protocol row 13 gate text: "one SFX per beat max; SFX on visual-land frames;
−14 LUFS verified on a real render".

- Clause 1 (one SFX per beat max): NOT met as written; **resolved by register
  amendment** (SFR-1), not by loosening evidence — the amended check passes
  against measured data and the register's own prior PASS record required it.
- Clause 2 (SFX on visual-land frames): **PASS**.
- Clause 3 (−14 LUFS on a real render): **NOT VERIFIED at this stage** — open
  N/B with a named venue (stage 16/17), per §4.3 the stage is not marked
  complete on it and the row stays open there.

**STAGE 13 GATE: PASS on all verifiable checks (AUD-02 amended, AUD-03..06
verified); AUD-07/AUD-08 remain open N/B with venues stage 16/17. Not marked
fully complete — the loudness/VO clauses carry to the first real render.**

Files changed in Stage 13 (orchestrator-applied): CHECK-REGISTER.md
(AUD-02..08), src/audio/sfx-manifest.json (SFR-4 `_note`),
src/skills/remotion-render/qa-scripts/fetch-sfx-library.mjs + visual/sfx-library.js
(SFR-2). Lane-owned artifacts under data/audit/13/ (ledger, probes,
schedule-report-v3.json, vo-levels-report.json, fixtures, apply script).
The lane made no owned-file code changes.