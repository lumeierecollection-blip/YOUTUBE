# Automated Multi-Channel YouTube System — Build Plan

## Decisions Made (July 2026)

### Visual Styles (3)
1. **Minimal** — kinetic typography, clean background, synced captions
2. **Motion-graphics** — icon/scene-based animated sequences
3. **Cinematic Documentary** — stock/archival B-roll, animated maps, charts, cinematic color grading, dramatic pacing

### Tooling
- **TTS**: EdgeTTS (free, no provider key)
- **Private delay**: All channels, default 1 hour
- **Research flow**: Fully automatic — deep-research → script-writer, no manual approval per video. Review via private-upload window.

### 10 Starting Niches
| # | Niche | RPM Est. | Style | Durability |
|---|-------|----------|-------|------------|
| 1 | Personal Finance (Budgeting for Beginners) | $10-22 | Minimal | Evergreen |
| 2 | Legal Education (Know Your Rights) | $8-22 | Motion-graphics | Evergreen |
| 3 | AI Tool Reviews (Real Results Only) | $7-15 | Minimal | Fast-growing |
| 4 | History Untold (What Really Happened) | $6-11 | Cinematic Documentary | Permanent evergreen |
| 5 | Natural Disaster / Volcano Stories | $7-10 | Cinematic Documentary | Evergreen + news-adjacent |
| 6 | Military History & Strategy | $5-10 | Cinematic Documentary | Permanent evergreen |
| 7 | Business Case Studies (How Companies Failed) | $9-18 | Cinematic Documentary | Evergreen |
| 8 | Psychology (Why We Do What We Do) | $5-9 | Minimal | Evergreen |
| 9 | Geopolitical Explainers (Maps & Power) | $5-10 | Motion-graphics | Evergreen |
| 10 | Betrayal/Revenge Stories | $12.82 | Cinematic Documentary | 21x growth |

## Build Order

Re-verified 2026-08-10 against real artifacts on disk, not assumed from the
step list below being old — see the evidence noted per row. "DONE" means a
concrete real artifact exists and was inspected; "PARTIAL" means it works
for some but not all of what the step scopes; "PENDING" means the
implementation itself is still a stub, independent of credentials.

| Step | What | Status |
|------|------|--------|
| 1 | Niche discovery — research via multi-pass web/YouTube/social | DONE |
| 2 | Channel config schema + first test channel | DONE — cut from 50 to 17 channels since (see `NICHE-AUDIT.md`) |
| 3 | Deep-research skill — wire up and test on one topic | DONE — rebuilt as Stage B (`prompts/research.md`, `schemas/research.json`); real `claude -p` + WebSearch calls tested on real topics for channels 1, 2, 4 |
| 4 | Trend-research skill — wire up and test (needs YouTube API creds) | PARTIAL — a real credential-detection logic bug was found and fixed; dry-run tested; never run against real YouTube API data (no credentials in this environment) |
| 5 | Script-writer — 1 Shorts + 1 long-form from real research | DONE — rebuilt as Stage C (`prompts/write-script.md`); real Shorts + long-form scripts produced and gate-passed (`gate-script.js`) for channels 1, 2, 4 |
| 6 | Thumbnail-maker | DONE — real specs + rendered PNGs for channels 1, 2, 4 (after fixing a hook-extraction bug and a filename-clobbering bug that had silently overwritten prior topics' thumbnails) |
| 7 | VFX-audit — research real polish per style, report findings | DONE — `data/vfx-audit.md`, `data/vfx-audit-cinematic-documentary.md`, `data/vfx-checklist.json`, each entry cited to a real source |
| 8 | SFX-sourcing — research usage, source real files from GitHub | DONE — `data/sfx-sources.md` documents real CC0/CC-BY GitHub sources (Kenney, etc.); files are baked into the motion-graphics template. Minimal and cinematic-documentary styles don't mix any SFX yet |
| 9 | Remotion-render — build all 3 style templates, show renders | PARTIAL — motion-graphics and cinematic-documentary each have a real, verified render (channels 1/2, channel 4); minimal has never been rendered end-to-end, only bundle-smoke-tested |
| 10 | YouTube-publish — private upload, auto-public, test flow | BLOCKED — no real OAuth credentials for any channel in this environment; the pipeline correctly reports "API not configured" rather than faking success. Never exercised end-to-end, on any channel |
| 11 | GitHub Actions — workflow, matrix, daily Shorts, Mon/Wed/Fri long-form | PARTIAL — workflow fully rewritten for the 3-stage pipeline (schedule corrected from this row's original "Tue/Fri" — the actual policy per `NICHE-AUDIT.md` is Mon/Wed/Fri); the real `daily-pipeline.yml` has never executed end-to-end on an actual GitHub Actions runner — only the isolated `tts-probe.yml` probe was |
| 12 | Channel-branding — research names/descriptions/keywords per niche | DONE — real per-channel `branding-spec.json` generated from channel config, confirmed not fabricated by a dedicated audit pass |
| 13 | Performance-tracking — views + revenue, grouped by owner | PENDING — `src/skills/performance-tracking/run.js` is a stub, self-documented `// TODO: Implement YouTube Analytics API integration`; not just credential-blocked, not yet implemented |
| 14 | Weekly-learning — retention analysis + competitor benchmarking | PENDING — `src/skills/weekly-learning/run.js` is a stub, self-documented as blocked on performance-tracking data which doesn't exist yet |
| 15 | Scale to remaining channels | PENDING — only 3 of the 17 surviving channels (1, 2, 4) have real end-to-end artifacts (script + render); the other 14 have none |

## Hard Rules
- No fact, statistic, claim, image, or sound effect that didn't come from an actual fetched/searched source
- Every upload goes private first, then auto-public after configured delay
- Real, verified photos only for named people/places — fall back to graphics if unverifiable
- Real sound effect files from license-clear repositories — never placeholder sounds
- Each channel's render/commit is independent — no cross-channel blocking
