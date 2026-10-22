# Resumable per-channel jobs

Each video has a record `data/jobs/<ch>/<slug>.json` (`scripts/jobs/job-state.mjs`): stages
`discover, research, script, tts, render, qa, publish`, each `pending|running|done|failed|skipped` with
`attempts`, timestamps, a redacted short `error`, `artifacts`; plus `run_ids`, `terminal`, `outcome`.
Writes are atomic; errors are scrubbed of tokens (`ya29.`, `refresh_token`, `client_secret`, `key=`...).

## Flow (`daily-pipeline-v2.yml`)
- prep, `Resume check`: `node scripts/jobs/resume.mjs --channel N [--max-age-days 3]` prints
  `{resume, slug, from_stage, why}`. Resume only if: a committed `data/research/N/<slug>-shorts-script.json`
  (committed only after the script gate passed), its job is not terminal, no marker in
  `data/renders/{approved,approved-review,rejected}/<slug>*.json`, younger than max age, render attempts < 3,
  and the topic is still in `data/topic-log.json` (a released topic is never resumed).
- On resume, discover/research/gate/script are skipped and the `render_only` step reuses the script
  (`RESUME_SLUG`); the run continues at TTS. Otherwise the pipeline is unchanged.
- prep records `Record job state (prep)`; the record rides the existing script commit and the prep artifact.
- render keeps its copy in `JOBS_ROOT` (outside the workspace) and copies it in after the rebase inside the
  existing `Commit publish queue` retry loop (a failed render with an unchanged queue still commits the record).
  `job-state.mjs queue-sync` closes the job (qa, publish, terminal) from the queue marker.
- log-results prints `scripts/jobs/stalled.mjs` (running > 3h, or open with no update 24h; `--json`) to the step summary.

All `job-state.mjs` calls print a warning and exit 0 on error.

## Limits
- Prep failures before the script commit are not persisted (nothing is pushed on that path).
- A rejected or approved video closes the job (terminal): a re-render of an already-judged video is a manual `render_only`.
- Rendering still `needs: prep` for the whole matrix. Per-channel unblocking needs a reusable-workflow split:
  1. move prep+render for one channel into `.github/workflows/channel.yml` (`on: workflow_call`, input `channel_id`);
  2. `setup` stays; a caller job `channel` with `matrix` and `uses: ./.github/workflows/channel.yml` (max-parallel 6);
  3. prep->render handoff becomes `needs` inside the reusable workflow, so channel A renders as soon as A's prep ends;
  4. review-publish/preview/log-results `needs: [channel]` as today;
  5. secrets pass via `secrets: inherit`; the artifact name already carries the channel.
