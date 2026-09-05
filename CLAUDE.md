# CLAUDE.md

Automated multi-channel YouTube system. Read this before touching anything.

Note on who actually reads this file: the daily pipeline's own model calls
do **not**. They run through the OpenCode CLI as scoped agents
(`.opencode/agents/pipeline-*.md`) with `read` denied, so they never load
this file — everything they need is put in their prompt by
`scripts/opencode-agent.js`. That denial is deliberate: a pipeline agent
that could read repo docs started confusing itself about which stage it was
in. This file is for humans and for interactive agents working on the repo.

## What this repo is

17 YouTube channels, each with its own niche, visual style
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
| Current state and the next moves, for whoever picks this up | `OPENCODE-BRIEF.md` — written at the visual-architecture handoff; `PROMPT_FOR_OPENCODE.md` is the original bootstrap prompt and is historical |
| Channel config (17 channels) | `config/channels.json` |
| Per-channel topic history (dedup) | `data/topic-log.json`, via `src/utils/topic-log.cjs` |
| Daily pipeline (GitHub Actions) | `.github/workflows/daily-pipeline.yml` |
| Model runner for all 3 stages (provider, failover, schema validation) | `scripts/opencode-agent.js` |
| Per-stage agent tool scoping | `.opencode/agents/pipeline-research.md`, `.opencode/agents/pipeline-script.md` |
| Structured-output schemas for the pipeline stages | `schemas/` |
| Prompts for those stages | `prompts/` |
| Stage input builders / gates | `scripts/build-*.js`, `scripts/gate-*.js` |
| Render engine (Remotion) | `src/skills/remotion-render/` |
| Skills (OpenCode-style, agent-discoverable) | `.opencode/skills/*/SKILL.md` — **not yet migrated** to `.claude/skills/`; see the script-pipeline rebuild notes for why that migration was scoped out of this change |
| Motion-graphics render contract | `MOTION-GRAPHICS-MANUAL.md`, `DETAIL-REFERENCE.md`, `LAYOUT-SYSTEM.md` |
| Every check that gates this pipeline, in one place | `CHECK-REGISTER.md` — the single source of truth for check IDs; do not invent a new ID scheme, extend the existing namespace table in §0.3 |

## The pipeline stages

`discover-topics` (Stage A, one call for all channels) →
`research` (Stage B, per channel, websearch only) →
`write-script` (Stage C, per channel, no tools at all — writes only from
Stage B's frozen research).

All three run through `scripts/opencode-agent.js`, which drives the OpenCode
CLI (`opencode run`) against Cerebras models listed in `OPENCODE_MODELS`
(comma-separated = primary,failover). Each stage's output is validated
against its `schemas/*.json` with ajv — with a corrective retry, then a
failover to the next model — and then gated (`scripts/gate-*.js`) before the
next stage or TTS runs. Don't loosen a schema or skip a gate to make a run
pass — fix what's producing bad output.

Two provider facts that shape the whole design, both learned from real runs:

- **The tools come from OpenCode, not the model provider.** Cerebras's API
  has no built-in search; OpenCode supplies a real Exa-backed `websearch`
  (enabled by `OPENCODE_ENABLE_EXA=1`). That's what keeps the "every fact
  traces to a real source" rule true after the provider switch.
- **The free tier rate-limits tokens-per-minute account-wide.** Both models
  return the same quota error simultaneously, so failover does not escape
  it. This is why searches are capped (1–2 calls, `numResults: 6`,
  `contextMaxCharacters: 1200`), page fetching is denied outright, and
  `max-parallel` is 2. Loosening any of those brings the limit back.
