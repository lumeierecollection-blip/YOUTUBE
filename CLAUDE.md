# CLAUDE.md

Automated multi-channel YouTube system. Read this before touching anything —
headless runs (`claude -p` in `.github/workflows/daily-pipeline.yml`) load
this file automatically unless invoked with `--bare`.

## What this repo is

50 YouTube channels, each with its own niche, visual style
(`minimal` / `motion-graphics` / `cinematic-documentary`), and config in
`config/channels.json`. A daily GitHub Actions workflow researches a topic,
writes a script, generates a voiceover, renders a video, and publishes it —
per channel, mostly unattended. See `README.md` for the full system and
`PLAN.md` for the build order and hard rules.

## Hard rules — these are not stylistic preferences

- **No fact, statistic, claim, image, or sound effect that didn't come from
  an actual fetched/searched source.** Never fill a gap with general
  knowledge and label it as researched. If a research pass can't ground a
  topic, that topic gets skipped, not invented.
- **Every claim in a script must trace to `sources_used`, and every URL in
  `sources_used` must actually appear in the research artifact.** This is
  gated (`scripts/gate-script.js`, `CHECK-REGISTER.md` `SCR-14`), not just
  a request.
- Every upload goes private first, then auto-public after the channel's
  configured delay.
- Real, verified photos only for named people/places — fall back to
  graphics if a real photo can't be sourced and verified.
- Colour lives in `channels.json`, never in a script or a prompt-generated
  string — see `CHECK-REGISTER.md` `SCR-13`.

## Standing engineering rules

- Read a file before editing it. Grep before creating something that might
  already exist — this repo has drifted before (see `data/topic-log.json`'s
  history and `CHECK-REGISTER.md` §0.2's ID-collision table).
- Never claim a rendered visual works without an actual rendered frame or
  video to point to. "Should work" is not evidence.
- If something is broken, wrong, or a known limitation, say so plainly in
  code comments, commit messages, or output — don't paper over it. Several
  files in this repo (`schemas/script.mg.json`, `scripts/gate-research.js`)
  document exactly where their guarantees stop for this reason; keep that
  pattern.
- Never merge to `main` without explicit confirmation. The daily cron
  (`.github/workflows/daily-pipeline.yml`) only fires on `main` — the
  schedule trigger is inert on any other branch, which is the safety valve
  during development.

## Where things live

| What | Where |
|---|---|
| Channel config (50 channels) | `config/channels.json` |
| Per-channel topic history (dedup) | `data/topic-log.json`, via `src/utils/topic-log.cjs` |
| Daily pipeline (GitHub Actions) | `.github/workflows/daily-pipeline.yml` |
| Structured-output schemas for the `claude -p` pipeline stages | `schemas/` |
| Prompts for those stages | `prompts/` |
| Stage input builders / gates | `scripts/build-*.js`, `scripts/gate-*.js` |
| Render engine (Remotion) | `src/skills/remotion-render/` |
| Skills (OpenCode-style, agent-discoverable) | `.opencode/skills/*/SKILL.md` — **not yet migrated** to `.claude/skills/`; see the script-pipeline rebuild notes for why that migration was scoped out of this change |
| Motion-graphics render contract | `MOTION-GRAPHICS-MANUAL.md`, `DETAIL-REFERENCE.md`, `LAYOUT-SYSTEM.md` |
| Every check that gates this pipeline, in one place | `CHECK-REGISTER.md` — the single source of truth for check IDs; do not invent a new ID scheme, extend the existing namespace table in §0.3 |

## The `claude -p` pipeline stages

`discover-topics` (Stage A, one call for all 50 channels) →
`research` (Stage B, per channel, has `WebSearch`/`WebFetch`) →
`write-script` (Stage C, per channel, `--bare`, no web — writes only from
Stage B's frozen research). Each stage's output is schema-enforced
(`--json-schema`) and gated (`scripts/gate-*.js`) before the next stage or
TTS runs. Don't loosen a schema or skip a gate to make a run pass — fix
what's producing bad output.
