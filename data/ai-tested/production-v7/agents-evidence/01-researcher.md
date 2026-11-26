# Evidence: film-researcher (Phase 1)

- Role: film-researcher, lostsock1/opencode-filmmaker 13-agent system, AI Tested Shorts batch 21-25.
- Runtime: Claude subagent (claude-sonnet-5-5 via Claude Code), NOT the OpenCode runtime. OpenCode cannot run here (no provider credentials). The role's own `model: deepseek/deepseek-v4-pro` was not used.
- Date: 2026-11-26.
- Definition file: `.opencode/agents/film-making/film-researcher.md`
  - sha256 `5b39e21ae0af0a71bca64b3da75e576abd56a425872fb806acbd5ed186bd7604` (certutil)
- Schema file read: `.opencode/skills/filmmaker/references/schemas.md`
  - sha256 `c350bc38e3465898c9a366f8374bca11abcdadeac22b7240c165808913942334` (certutil)
  - Used the project-local path in place of the definition's `~/.config/opencode/skills/filmmaker/...`.
- Deviations from the definition: no user clarification step (inputs were pre-specified by the caller); no `vision-analysis` skill and no competitor-video analysis (not requested, and no competitor sources were fetched); 3 angles given at batch level only because the scripts are approved.

## Inputs read (full)
- `data/ai-tested/production-v7/analytics/ANALYTICS-SUMMARY.md`
- `data/ai-tested/production-v7/analytics/slot02-RETENTION-2026-11-23.md` (the `.json` beside it was listed, not opened; the md carries the same figures)
- `data/ai-tested/production-v7/reference/REFERENCE-ANALYSIS.md`
- `data/ai-tested/identity-reference.md`
- `data/ai-tested/shorts-v5/facts/21.facts.json` .. `25.facts.json`
- `data/ai-tested/shorts-v5/scripts/21-sandbox-escape-lawsuit.json`, `22-model-price-war.json`, `23-pause-frontier-ai-case.json`, `24-one-file-ai-game.json`, `25-ai-builds-the-app.json`
- `data/ai-tested/shorts-v5/assets/manifests/21..25-*.assets.json`
- `data/ai-tested/shorts-v5/assets/audio-licences.json` (first 40 lines only)
- Directory listings only (no file contents): `shorts-v5/assets/{logos,photos,photos/cutouts,photos/real,v7/*,music,sfx,ambience}`, `production-v7/*`.
- Not opened: `Oauth.txt.txt`; no secrets read or printed.

## Outputs written (only inside `data/ai-tested/production-v7/`)
- `film-project/ai-tested-shorts-21-25/01-research-brief.md`
- `film-project/ai-tested-shorts-21-25/project.yaml` (mode cinematic, aspectRatio 9:16, targetPlatform youtube, crossRendererTransitionPolicy warn)
- `agents-evidence/01-researcher.md` (this file)
- A directory `film-project/ai-tested-shorts-21-25/` was created.
- No git commit/push. Nothing touched on YouTube.

## Fetches and searches (all 2026-11-26; WebFetch returns summarised extractions)
1. WebFetch https://www.cnbc.com/2026/11/16/openai-california-bonta-ai-lawsuit.html
2. WebFetch https://openai.com/index/introducing-gpt-6-2-astra-sol/
3. WebFetch https://www.aljazeera.com/economy/2026/11/12/us-nonprofits-sue-tech-giants-to-halt-ai-development (twice, second time targeted at the "own admissions" sentence)
4. WebFetch https://huggingface.co/blog/softroyals/how-saltline-ai-game-was-built-1-4mb-html
5. WebFetch https://blog.google/innovation-and-ai/models-and-research/google-labs/tabletop/
6. WebFetch https://9to5google.com/2026/11/17/openai-releases-gpt-6-2-astra-and-sol-for-complex-projects-a-week-after-claude-5-2/
7. WebFetch https://saltline.games
8. WebFetch https://siliconangle.com/2026/11/11/google-tests-tabletop-letting-groups-build-planning-tools-with-an-ai-agent/
9. WebSearch "Felix Rieseberg Anthropic engineer Saltline game Claude Fable 5.2 one prompt" (result used only for 24-N1, marked unverified because the TweakTown page was not fetched)

## Findings that matter downstream
- Script 22 "on a legal test": no fetched page says "legal"; facts file's verbatim has no "legal" either.
- Script 24 "An Anthropic engineer": employer not stated in fetched pages; search snippet only. "One prompt" carries an HF-blog caveat (initial direction only).
- Script 21 omits sourced context (OpenAI said the models sought answers to cheat on an evaluation); "July" and the OpenAI "strengthened safeguards" quote in facts/21 were not reproduced by my re-fetch.
- Script 23 "companies' own admissions": supported as the article's characterisation, no named admission.
- Script 25 "app" and "on demand" are framing; the sources say "planning tools".
- Bridge window (3-9 s) holds recap/setup in scripts 22 and 25 by a word-count estimate (2.5 words/s, an assumption).

## Open issues
- Asset provenance not recorded for `photos/real/*`, `saltline_gameplay.*`, `tabletop_*.svg`, `v7/21/*`; Bonta portrait licence "verify on Commons".
- No primary source for Saltline; saltline.games operator unknown.
- Swipe-away 58% user-stated, unverified. No analytics for 21-25.
- Quotes are only as exact as the WebFetch extraction; re-check any text that goes on screen verbatim.
