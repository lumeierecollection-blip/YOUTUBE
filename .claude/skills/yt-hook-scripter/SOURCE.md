# Source of this skill

Vendored verbatim from https://github.com/sergebulaev/youtube-skills (MIT, see
`LICENSE`), commit e922430ce41156bf8a7d65fefa887b2e631cf6fb (2026-10-03).

| Here | Upstream |
|---|---|
| `SKILL.md` | `skills/yt-hook-scripter/SKILL.md` |
| `references/retention-beats.md` | `skills/yt-hook-scripter/references/retention-beats.md` |
| `references/hook-formulas.md` | `references/hook-formulas.md` (SKILL.md calls it `../../references/hook-formulas.md`) |

Not vendored: the bundle's Python clients (`lib/` — Publora / Pixfaro / YouTube
API wrappers), `references/algorithm-heuristics.md`, the root `SKILL.md` voice
rules, and the other eight skills. SKILL.md mentions `lib/url_parser.py` and an
"approval card" step; neither applies in this repo.

Why `.claude/skills/` and not `.opencode/skills/`: the daily pipeline's OpenCode
agents (`.opencode/agents/pipeline-*.md`) do not deny the skill tool, and a
pipeline agent that loads repo material has confused itself about its stage
before (CLAUDE.md). This copy is for interactive Claude Code sessions. The
pipeline gets the rules through `prompts/write-script.md` — extracted in
`docs/SCRIPT-HOOK-FORMULAS.md`.
