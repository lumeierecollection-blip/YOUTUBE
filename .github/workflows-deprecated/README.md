# Deprecated workflows (kept for reference, never scheduled)

GitHub Actions only loads workflow files from `.github/workflows/`. Files here
are not run, scheduled or dispatchable — that is the point. A file renamed to
`*.deprecated.yml` but left in `.github/workflows/` would still fire on its
cron, so deprecated workflows are moved here instead.

- `daily-pipeline.deprecated.yml` — the V1 monolith (discover → research →
  script → TTS → render → publish in one job per channel). Superseded by
  `.github/workflows/daily-pipeline-v2.yml` (the visual-rebuild pipeline),
  which became production on main on 2026-10-03.
- `review-publish.deprecated.yml` — the manual "render + publish one script privately"
  workflow (workflow_dispatch, and push on its own file). Deprecated 2026-10-03 with the
  owner's "single pipeline only" instruction: its job is `if: false` and it is disabled on
  GitHub; its push trigger was removed in the 2026-10-03 audit. The manual publish path for
  `data/renders/approved-review/` videos is now the `review-publish` job in
  `daily-pipeline-v2.yml` (workflow_dispatch with `publish=true`, main only, channels
  1/2/9/26/44/48, private).
- `daily-pipeline.deprecated.yml`'s cron line was removed and its `publish` job is
  `if: false` (audit 2026-10-03).
- `network-policy-check.yml` (diagnostic) exists only on the old branch
  `claude/png-sourcing-animations-captions-wgv6ty`; it is disabled on GitHub
  (`gh workflow disable`), so a push there no longer runs it.
