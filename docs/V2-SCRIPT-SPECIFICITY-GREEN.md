# Script Specificity — Final Report

Date: 2026-10-03
HEAD: see `git log -1 main` (merged from `claude/variety-sfx-specificity`)
Iterations: 5 (runs 37125010644 … 37133611702)

## Skill

- Installed: yes. The yt-hook-scripter skill from sergebulaev/youtube-skills (MIT, `e922430`)
  was vendored verbatim with its two references.
- Path: `.claude/skills/yt-hook-scripter/`, the Claude Code project skill directory. It
  registered in-session. Not `.opencode/skills/`, because the pipeline's OpenCode agents
  don't deny the skill tool (see `SOURCE.md`). `claude plugin install` was not run: it
  changes the global Claude Code config, and CI never runs Claude Code.
- Rules extracted: `docs/SCRIPT-HOOK-FORMULAS.md` covers Y10, specificity, the pairing table,
  the Shorts beat structure, the concrete-detail rule and the re-hook pattern. The skill's own
  rule "never invent the specifics" matches CLAUDE.md.

## What was built

- `prompts/write-script.md`: every sentence names a person, place, organization, number or
  object from the research and about this video's subject. It has a banned-phrase list and
  the HOOK / SETUP / PAYOFF / CTA order.
- `scripts/validate-script.cjs`: scores specifics per sentence (average ≥1.5, no zeros), checks
  banned phrases, and requires a concrete:abstract noun ratio ≥2. It re-asks once, logs
  `data/ci-runs/blocked-script-specificity-<ch>.txt`, and never blocks the run.
- `scripts/trending-entities.cjs`: entities from the top 5 trending titles go into research.
  Inactive: there is no `YOUTUBE_API_KEY`, so every run took the null path.

## Per channel (validator, last run that wrote a script)

| Ch | Sentences | Avg entities | Concrete/Abstract | Banned | Result |
|---|---|---|---|---|---|
| 1 | 4 (it3) | 3.0 | 10/5 = 2.0 | 0 | PASS (it2: 0.5, 0/6 — FAIL twice, logged) |
| 2 | 5 (it3) | 2.0 | 9/1 = 9.0 | 0 | PASS |
| 9 | 7 (it5) | 2.0 | 14/0 | 0 | PASS |
| 26 | 4 (it5) | 2.3 | 11/0 | 0 | PASS |
| 44 | 4 (it5) | 2.5 | 10/4 = 2.5 | 0 | PASS |
| 48 | 6 (it5) | 2.3 | 11/2 = 5.5 | 0 | PASS |

Two script-stage regressions were found and fixed:
- **Too long:** "name something in every sentence" was read as "add facts", giving 121–190
  words. Too-long scripts are now trimmed by whole sentences before re-asking.
- **Too short:** "cut a vague sentence" was read as "delete", giving 44–69 words. The prompt
  now says replace, never delete.

One more fix: the specificity re-ask once pulled in an off-topic research fact (TPLF forces in
a Middle Corridor video). Named facts must now be about this video's subject.

## Composition impact

| Ch | Headline-dominated before (run 37119036921) | After (best rendered run) | Change |
|---|---|---|---|
| 1 | 100% | 40% | -60 |
| 2 | 67% | 50% | -17 |
| 9 | 66% | 28% | -38 |
| 26 | 66% | 40% | -26 |
| 44 | — (prep failed) | 40% | — |
| 48 | 71% | 33% | -38 |

## Blocked

- ch-1 and ch-26 failed specificity twice in iteration 2 (generic personal-finance research).
  They were logged and continued, as the spec requires.
- No trending entities ever reached research (no `YOUTUBE_API_KEY`).
- Research grounding and duplicate-topic failures stop prep before the script stage (see
  `V2-MAIN-VARIETY-SFX-GREEN.md`).
