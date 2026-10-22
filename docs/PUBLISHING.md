# Publishing (capability check)

Publishing is not a pipeline stage that can fail a finished video. Every channel researches, scripts,
renders and is judged by QA whether or not it can upload; the upload is a separate check
(`scripts/jobs/publish-gate.mjs`) that SKIPS, green, with the exact reason when it cannot run.

## Where the reason is recorded
- `data/publish-status/<channel_id>.json` `{channel_id, status: skipped|refused, reason, run_id, at}`
  (committed with the publish queue on main; in the `jobs-<ch>-<run>` artifact otherwise),
- the job record (`data/jobs/<ch>/<slug>.json`, `stages.publish.status = skipped`, `error = reason`),
- the morning digest `data/uploaded/<date>.json` `not_uploaded[<ch>]` (`scripts/jobs/digest.mjs`).

## Order of checks (render job, `channel-pipeline.yml`)
1. `Publish capability check` (`publish-gate.mjs gate`): uploads only from `refs/heads/main` and only when
   `dry_run`, `render_only` and `no_push` are off. Otherwise: skipped, reason e.g. `not on main (ref ...)`.
2. `Materialize OAuth credentials` (`publish-gate.mjs materialize`): only the channel's OWN secrets
   `CHANNEL_<NN>_{CLIENT_ID,CLIENT_SECRET,REFRESH_TOKEN}` into its OWN `config/creds/<channel_id>.json`.
   Missing -> skipped, reason names the missing secrets (never values). A `channels.json` row whose
   `youtube_credentials_path` is another channel's file -> refused, exit 1 (a config error, not a skip).
3. `Publish to YouTube (private)` (`run.js`): approval rules unchanged (`approved/` or human-approved
   `approved-review/`, private first, auto-public after the channel delay). If Google rejects the
   credentials (`invalid_grant`, `invalid_client`, ...) run.js records the reason and exits 78 = skipped.
   Any other non-zero exit is a real failure and stays red. The token exchange retries transient errors
   (3 attempts, bounded); the upload itself is never retried.

review-publish uses the same `materialize` per channel and treats exit 78 as a skip. On the schedule, a
run with no `approved-review/` video is a green "nothing to upload"; on a dispatch it is still an error.

## Exercising the pipeline on a branch
`gh workflow run daily-pipeline-v2.yml --ref <branch> -f channels=1 -f dry_run=true -f no_push=true`
uploads nothing (not main, dry run) and pushes nothing to any branch (reservation, script, SFX verdicts,
queues, job records are all skipped; the job record is kept as an artifact). The cron has no inputs, so
both default off and production is unchanged.

## Owner actions (known credential state, from config/priority-channels.json)
ch-3, ch-4, ch-7, ch-44 `invalid_grant`; ch-9, ch-26 `invalid_client`; ch-5/6/8/10/49 no credentials
These channels are not in the priority set; when they are re-added they will skip with these reasons
until re-authorized.
