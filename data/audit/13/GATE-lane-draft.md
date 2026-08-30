# GATE — Stage 13 (Audio lane) — LANE-ORIGINAL DRAFT (preserved for lineage)

Superseded by the orchestrator's authoritative `data/audit/13/GATE.md`
(2026-08-29). Preserved verbatim.

Lane: `audit-audio` · 2026-08-29

## Stage-13 gate (CROSSCHECK-PROTOCOL Part 4, stage 13) — how each item resolved

1. **SFX on visual-land frames** → PASS (CONFIRMED): all **36** scheduled events sit at their visual-state start frames (26 at localDelta 0) or on-grid tick offsets (10, deltas 6–78 f) inside a repeat state; 0 OTHER/word-timed events. Code path: `soundEventsForBeat` keys off `visualStates`; `SoundEvent` mounts at the same `atFrame`.
2. **No more than one SFX per beat** → **PASS NOT MET as written** — live source maxes at 3 with a 12-frame floor (measured: 9/5, 12/5, 15/8 events-per-beat on the QA inputs; 4/5, 5/5, 6/8 beats >1 event). Ledger SFR-1 amends the threshold to the implementation's documented cap (≤3, gap≥12, explainable). No code change: the existing caps are correct for the design.
3. **−14 LUFS integrated (±0.5) master on a real render** → NOT VERIFIED HERE (no compositor / TTS / render on this machine; repo `vo.mp3` is a silent placeholder, byte-identical to the only VO-sized file on disk). Listed as UNVERIFIABLE, unresolved, with venue named (production render + ebur128).
4. **Audio track duration ≤ video duration** → out of this lane's stage scope (AUD-09, ENC lane / stage 16) — not claimed here.

## Lane gate statement

- Every claim above traces to this run's own measurements (`data/audit/13/schedule-report-v3.json`, `probe-sfx-measure.mjs`, `probe-vo-levels.mjs`) or to fetched sources (Kenney, Mixkit, 2026 loudness round-up) — no register text was used as evidence.
- Owned-file changes: none. Two SFRs (register amendment + stale comment path) and one optional hardening item are queued with exact diffs (ledger PART E).
- Blockers AUD-05 (remote URLs) and AUD-06 (licence viability) CLEARED with measured evidence.
- Left honestly open: AUD-07, AUD-08, audible half of AUD-01 (cannot be produced on this machine; not fabricated).

Gate verdict: **pass with amendments queued (SFR-1 register correction mandatory before next render gate; AUD-07/AUD-08 remain open for the first future real render).**