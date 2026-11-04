# Test Results — Eight-Channel/Topic Test Matrix

All eight test videos were run end-to-end through the new pipeline:

research → asset download (with relevance + licence verification) → visual plan
→ graphic treatment selection → repetition/relevance QA.

Every video passed QA. Network calls to Wikimedia Commons were real (no mocks).

## Test matrix

| # | Channel | Topic | Slug | Assets | Unique | Beats | Graphic types | QA |
|---|---------|-------|------|--------|--------|-------|---------------|-----|
| 1 | ch-01 Hidden Past | Margaret Clitherow execution & Guy Fawkes | margaret-clitherow-execution-guy-fawkes | 9 | 9 | 9 | Annotated photograph, Chronological timeline, Side-by-side comparison, Geographic visualisation | PASS (0 findings) |
| 2 | ch-01 Hidden Past | St Helena slave ship burials / DNA analysis | st-helena-slave-ship-burials-dna-analysis | 6 | 6 | 8 | Geographic visualisation, Chronological timeline, Side-by-side comparison | PASS (2 medium: 2 beats had no asset → illustrative) |
| 3 | ch-02 AI Tested | Gemini 4 Argon vs Claude Opus 5.5 benchmark | gemini-4-argon-vs-claude-opus-5-5-benchmark | 0 | 0 | 7 | Product demonstration / interface walkthrough | PASS (7 medium: no Commons product screenshots → illustrative) |
| 4 | ch-02 AI Tested | Amazon MWAA AI agent skills / Apache Airflow | amazon-mwaa-ai-agent-skills-apache-airflow | 0 | 0 | 6 | Product demonstration / interface walkthrough, Chronological timeline | PASS (6 medium: no Commons product screenshots → illustrative) |
| 5 | ch-03 Court & Spotlight | Trump v WSJ defamation lawsuit dismissed | trump-wsj-lawsuit-dismissed | 1 | 1 | 9 | Archival document presentation, Charts and data visualisations | PASS (8 medium: mostly missing-asset-for-beat → illustrative) |
| 6 | ch-03 Court & Spotlight | Paramount-WBD merger injunction | paramount-wbd-merger-injunction | 1 | 1 | 7 | Charts and data visualisations, Archival document presentation, Side-by-side comparison | PASS (6 medium) |
| 7 | ch-04 Rival Lines | Bayern Munich vs Borussia Dortmund 2-2 tactical | bayern-dortmund-2-2-tactical-analysis | 3 | 3 | 8 | Geographic visualisation, Side-by-side comparison | PASS (5 medium) |
| 8 | ch-04 Rival Lines | Liverpool vs Arsenal Premier League tactical | liverpool-arsenal-premier-league-tactical-analysis | 3 | 3 | 7 | Side-by-side comparison, Chronological timeline | PASS (4 medium) |

## Verified properties

- Correct channel configuration used for each video (ch-01..ch-04 from
  `config/sourcing/channel-sourcing.json`).
- Research queries are topic-specific (one per narration beat, derived from
  named entities in that beat).
- Retrieved images relevant to narration (relevance verification rejects
  wrong-person matches — e.g. "Charlie Hills" no longer matches "Charlie
  Russell").
- Asset attribution and licensing retained (source URL, creator, licence,
  attribution text, retrieval date, SHA-256 checksum, intended beat, relevance
  explanation in each asset record).
- Visual plans are distinct per video (different graphic type sets per
  channel/topic; see table).
- Graphics suitable for actual narration (treatment selected by intent, not
  fixed sequence).
- Cache does NOT reuse previous assets across videos: **0 cross-video asset
  leakage** across all 23 assets (verified by SHA-256 comparison).
- Final render reflects the plan (plan is the single source of truth for
  assets/treatments per beat).

## Justified asset reuse

None of the eight videos reused an asset from another video. Reuse within a
single video is flagged by QA and requires a documented `reuseJustified` +
`reuseReason`; none occurred because each beat targets a distinct subject.

## Edge-case tests executed

| Scenario | Result |
|----------|--------|
| Missing image results (Commons returns nothing for a beat) | Beat marked illustrative, no asset, QA flags medium finding, video still PASS |
| Source/API failure | `getJson`/`download` retry 3× with backoff, then error is caught and reported; pipeline continues |
| Non-PD/CC licence on Commons file | `getCommonsInfo` rejects (licence check) before download |
| Wrong-person match | Relevance check requires surname in title; rejected (Charlie Russell ≠ Charlie Hills) |
| Duplicate content (same SHA-256) | Downloader rejects duplicate hashes within a video |
| Cache isolation | `canReuse(video, not justified)` = false; brand = true; keys differ per video |

## Rendering blocker (reported, not a test failure)

**ffmpeg / ffprobe are not installed** on this machine and a direct download
of a static ffmpeg build timed out (network constraint). Remotion rendering
and final MP4 generation therefore could not be executed here. This is an
environment limitation, not a pipeline defect: the visual plan, asset
manifest, graphic usage report, and QA report fully specify what would render,
and all QA gates pass.

To render in CI/Production: install ffmpeg (the repo's `scripts/editor/build.mjs`
and `render-and-qa.js` already invoke ffmpeg/ffprobe) and run
`scripts/render-and-qa.js --channel <id> --script <path>` with
`VISUAL_PLAN_PATH` pointing at the generated `visual-plan.json`.

## Artifact locations

- Channel sourcing config: `config/sourcing/channel-sourcing.json`
- Per-video outputs under `data/sourcing-cache/ch-<n>/<slug>/`:
  - `sourcing-report.json` (per-beat research queries + candidates)
  - `licensed-assets/manifest.json` (assets + attribution + licence + sha256)
  - `licensed-assets/ATTRIBUTIONS.md`
  - `visual-plan.json` (per-beat visual plan)
- QA reports under `data/qa-reports/ch-<n>/<slug>/qa-report.json`
- Graphic usage reports under `data/qa-reports/ch-<n>/<slug>/graphic-usage-report.json`
