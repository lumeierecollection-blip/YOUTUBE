# Deprecated workflows (kept for reference, never scheduled)

GitHub Actions only loads workflow files from `.github/workflows/`. Files here
are not run, scheduled or dispatchable — that is the point. A file renamed to
`*.deprecated.yml` but left in `.github/workflows/` would still fire on its
cron, so deprecated workflows are moved here instead.

- `daily-pipeline.deprecated.yml` — the V1 monolith (discover → research →
  script → TTS → render → publish in one job per channel). Superseded by
  `.github/workflows/daily-pipeline-v2.yml` (the visual-rebuild pipeline),
  which became production on main on 2026-10-03.
