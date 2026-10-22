# QA loop (render, inspect, repair)

Status: building blocks plus an ADVISORY hook. Nothing here gates a verdict yet.

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

## Hook
`queueVideo` in `scripts/render-and-qa.js` calls `scripts/qa/advisory.mjs` (try/catch, `::warning::`), writing defects next to the video. It changes no verdict or exit code.
