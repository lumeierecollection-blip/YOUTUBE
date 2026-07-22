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

| Step | What | Status |
|------|------|--------|
| 1 | Niche discovery — research via multi-pass web/YouTube/social | DONE |
| 2 | Channel config schema + first test channel | DONE |
| 3 | Deep-research skill — wire up and test on one topic | PENDING |
| 4 | Trend-research skill — wire up and test (needs YouTube API creds) | PENDING |
| 5 | Script-writer — 1 Shorts + 1 long-form from real research | PENDING |
| 6 | Thumbnail-maker | PENDING |
| 7 | VFX-audit — research real polish per style, report findings | PENDING |
| 8 | SFX-sourcing — research usage, source real files from GitHub | PENDING |
| 9 | Remotion-render — build all 3 style templates, show renders | PENDING |
| 10 | YouTube-publish — private upload, auto-public, test flow | PENDING |
| 11 | GitHub Actions — workflow, matrix, daily Shorts, Tue/Fri long-form | PENDING |
| 12 | Channel-branding — research names/descriptions/keywords per niche | PENDING |
| 13 | Performance-tracking — views + revenue, grouped by owner | PENDING |
| 14 | Weekly-learning — retention analysis + competitor benchmarking | PENDING |
| 15 | Scale to remaining channels | PENDING |

## Hard Rules
- No fact, statistic, claim, image, or sound effect that didn't come from an actual fetched/searched source
- Every upload goes private first, then auto-public after configured delay
- Real, verified photos only for named people/places — fall back to graphics if unverifiable
- Real sound effect files from license-clear repositories — never placeholder sounds
- Each channel's render/commit is independent — no cross-channel blocking
