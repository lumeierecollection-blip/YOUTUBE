# QA loop (render, inspect, repair)

Status: wired into production (`scripts/render-and-qa.js`, after the canvas checks). `QA_LOOP=advisory` is the production default; `QA_LOOP=enforce` is proven only on the qa-proof `production-loop` job (see its run), not on the daily pipeline.

## Defect schema (`schemas/defect-report.json`, `scripts/qa/defects.mjs`)
`{id, check, source: objective|vision|audit, severity: blocker|major|minor, scene_id, beat_index, t_start, t_end, frame_paths[], evidence, expected, actual, repair: {kind, params}|null, status: open|repaired|unresolved}`.
Adapters: `fromLocalAudit` (`-local-audit.json` / `-backup-audit.json`), `fromBeatCheck` (`-beat-check.json`), `fromCameraCheck` (`-camera-check.json`), `fromFrameReview` (data/audit/gemini-review record).
Caveat: the frame-review per-scene CRITICAL/HIGH tier is not persisted, so `fromFrameReview` maps `severity`/`correction.level`/`status` best-effort. Entity and look checks have no adapter yet.
`writeDefectReport(dir, stem, defects, meta)` writes `<stem>-defects.json` and `.md` (table by severity, timestamps).

## Objective checks (`scripts/qa/objective-checks.mjs`, ffprobe/ffmpeg only)
aspect (blocker) and resolution (minor, scaled same aspect); duration vs `DURATION_RANGE_SECONDS` +/-2 s; fps; video/audio stream presence (blocker); A/V duration mismatch; black frames (`blackdetect`, blocker); frozen frames > 3 s (`freezedetect`); silence > 1.5 s (`silencedetect`); true peak above -0.1 dBTP (`ebur128`); SRT cue overlap, gap, past video end; plan assets missing on disk (manifest `canvas.photo/art/concept_visuals` under `src/skills/remotion-render/public`).
Expected size: 1080x1920 for shorts (hard-coded in render.js manifest). Longform 1920x1080 is an assumption, not verified.

## Risk frames (`scripts/qa/risk-frames.mjs`)
`planRiskFrames` picks: beat boundary +/-2 frames, beat settled (+0.35 s), mid-transition, text change +0.2 s, extras; dedupes frames closer than one frame (merging reasons), caps at `max` (24), keeping multi-reason frames first. `extractRiskFrames` writes JPEGs and a labelled ffmpeg tile contact sheet.

## Loop (`scripts/qa/loop.mjs`)
`runQaLoop({render, inspect, repair, revert?, budgets:{maxAttempts, maxMs, maxCostUnits}, now, log})`. Stops: `pass` (no blocker/major), `unresolved` (repair changed nothing), `no-progress` (same blocker/major set twice), `budget-exhausted`. Tracks the best attempt (fewest blockers, then blocker+major), records new blockers in previously clean scenes as `regressions`, and calls `revert(best)` when the last attempt is not the best.

## Objective vs judged
Objective: everything in `objective-checks.mjs` and the `audit` source (deterministic local-audit). Vision-judged (model opinion, not proof): beat, camera, frame-review defects. An automated pass is not a visual QA pass; frames still need inspecting.

## Production loop (`scripts/qa/production.mjs`, `scripts/qa/repairs.mjs`)
`QA_LOOP=off|advisory|enforce` (default advisory). Budgets: `QA_MAX_ATTEMPTS` (renders incl. the first, 3), `QA_MAX_MS` (20 min), `QA_MAX_COST_UNITS` (re-renders, 2).
Inspect = objective checks + the Layer-1 canvas checks (`local-audit.cjs --canvas-only` stdout parsed per beat) + render failure.
Repairs (deterministic; plan repairs touch ONE beat, every other beat byte-identical - regression-tested):
| defect check | scope | repair |
|---|---|---|
| canvas-fit | plan beat | drop pull phrase / label / lead-in, headline <= 8 words; second time: TYPE card (headline kept) |
| pop-transitions, missing-media | plan beat | TYPE card (headline kept) - the same reset as `forceTypeCard` |
| entity-coverage | plan beat | `art: plate-person/place/organization` with the entity's name (no image invented) |
| captions-overlap / -past-end / -timing | input (SRT) | clamp cue ends; original kept as `.srt.pre-qa`; re-render |
| audio-clipping (true peak) | post (MP4) | `alimiter` at -1 dBFS, video stream copied; no re-render |
Everything else (aspect, black, freeze, silence, duration, A/V, canvas-accent, ...) has no repair and is reported unresolved.
Advisory: attempt 1 is inspected, the repairs it would apply are written, nothing is re-rendered or changed.
Enforce: repaired plans are written as `<plan>-qa-aN.json` and rendered; each previous MP4 is snapshotted as `<video>.qa-aN.mp4`; the best attempt is copied back to the canonical path; render-and-qa.js re-runs silence/duration gates on a re-render and sends unresolved **blockers** to `backupAudit` (stage `qa-loop`, rejected). Unresolved majors do not fail the video by themselves - the existing gates still decide.
Report: `<stem>-qa-loop-defects.json` / `.md` next to the video (attempts, repairs, regressions, unresolved + repaired defects, risk frames, contact sheet `<stem>-qa-frames/risk-contact-sheet.jpg`).
Vision: the loop makes no model call and records `vision: not_run` with the reason; the frame review later in render-and-qa.js gates separately.
Limits: repairs are only as good as the re-render proves - a repair that changes nothing measurable ends `no-progress`. Manifest beat index == plan beat index is assumed (true for the renders inspected).

## Hook
`queueVideo` in `scripts/render-and-qa.js` calls `scripts/qa/advisory.mjs` (try/catch, `::warning::`), writing defects next to the video. It changes no verdict or exit code.
