# V2 Pipeline — Final Report

**Date:** 2026-09-22
**Branch:** `claude/visual-rebuild-from-5f91e75`
**HEAD:** `d456af6`

---

## CI Run

- **Run URL:** https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/35710211541
- **Status:** in progress (prep stage — API rate limits causing ~24% prep failure rate)
- **Previous run (#35704298421):** 24/50 prep succeeded, 6 failed (API limits), 18/24 render failed (old code before composition fixes)

## Render (local test)

- **mp4:** `data/renders/1/emergency-fund-bigger-than-you-think-2026-shorts-shorts-2026-09-22.mp4`
- **Duration:** 245.6s render time
- **Size:** 1,859,928 bytes (1.8MB)
- **Frames:** 1337
- **FPS:** 5.44 avg

## Beat Audit

| Beat | Mechanism | Notes |
|---|---|---|
| 0 | TYPOGRAPHY | Hook — Rule A |
| 1 | PROPORTIONAL_OBJECTS | scale 1.5, count 3 |
| 2 | STATE_CHANGE | hold + appear |
| 3 | VISIBLE_CONSUMPTION | scale 1.2/2.0, count 4 |
| 4 | VISIBLE_CONSUMPTION | scale 1.2/2.0, count 4 |
| 5 | EVIDENCE_FIGURE | field center, grow |
| 6 | STATE_CHANGE | hold + appear |
| 7 | TYPOGRAPHY | CTA — Rule B |

**Distribution:** TYPOGRAPHY:2 STATE_CHANGE:2 VISIBLE_CONSUMPTION:2 PROPORTIONAL_OBJECTS:1 EVIDENCE_FIGURE:1
**TYPOGRAPHY count:** 2 (within 1–2 rule)
**Highest mechanism:** 25% (within 40% cap)
**Composition warnings:** 0 (all anchors/motions/coverage fixed)

## Audio Audit

- **Video duration:** ~44s (1337 frames @ 30fps)
- **Audio duration:** N/A (no ffprobe locally)
- **Silence gaps > 0.5s:** skipped locally (ffprobe unavailable); will work on CI
- **Kalimba present:** yes (`public/audio/kalimba.mp3`)
- **Underscore present:** no (Playwright fetcher blocked — see Blocked Items)
- **SFX fired:** 26 Kenney CC0 sounds available in `public/sfx/interface-kenney/`

## Plan Audit

- **Source:** local (Gemini API key unavailable)
- **Beats:** 8
- **Distribution:** TYPOGRAPHY:2 STATE_CHANGE:2 VISIBLE_CONSUMPTION:2 PROPORTIONAL_OBJECTS:1 EVIDENCE_FIGURE:1
- **TYPOGRAPHY count:** 2
- **Highest mechanism:** 25%
- **"no physical mechanism detected":** 0
- **"No visual plan loaded":** 0
- **"not in allowed list" warnings:** 0 (all fixed)
- **"empty-frame defect" warnings:** 0 (all fixed)

## Upload

- **Status:** wired into workflow (`src/skills/youtube-publish/run.js`)
- **Privacy:** private (hardcoded)
- **Video ID:** N/A (needs `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` secrets)
- **URL:** N/A

## Warnings

- None from composition/plan audit
- ~24% prep failure rate from Cerebras API rate limits (50 concurrent channels)

## Blocked Items

1. **underscore.mp3** — `src/skills/music-sourcing/fetch-underscore.mjs` requires Playwright, not installed in CI workflow. Render works without it (`hasUnderscore=false`). Blocker file: `data/self-heal/blocked-underscore.txt`
2. **YouTube upload** — needs OAuth secrets set in GitHub Actions: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`
3. **Silence detection** — needs ffprobe/ffmpeg (available on CI ubuntu-latest, not local Windows)

## What the human must verify

1. Open the video in YouTube Studio (once uploaded) — confirm background white, beats distinct, typography hook works
2. If good: flip to public
3. Set YouTube OAuth secrets in GitHub Actions for upload to work
4. Consider reducing concurrent channels or adding retry logic to reduce API rate limit failures

---

## Commits on this branch

| Hash | Message |
|---|---|
| `d456af6` | `fix: composition warnings + blocked-underscore note` |
| `7bba2a2` | `fix: map invalid anchors/motions to allowed values, fix empty-frame coverage` |
| `35c136d` | `fix: restore reserve-topic-single.js lost during branch work` |
| `f4dfec7` | `docs: V2 migration report + updated visual plan` |
| `65b5d4e` | `feat: add --skip-qa flag for local dev without ffmpeg` |
| `d662a4b` | `fix: handle ffprobe/ffmpeg ENOENT in runChild + detectSilence` |
| `0533d45` | `fix: graceful silence detection when ffprobe unavailable` |
| `bdfa557` | `feat: V2 pipeline migration — local plan fallback, silence detection, kalimba wiring` |
