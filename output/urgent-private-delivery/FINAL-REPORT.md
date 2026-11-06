# Urgent Private Delivery — Final Report

Both YouTube Shorts were rendered, QA-checked, metadata-prepared, and uploaded as PRIVATE to their correct channels. Video IDs and private status are confirmed with evidence.

## Deliverable locations
- Hidden Past: `output/urgent-private-delivery/hidden-past/`
- AI Tested: `output/urgent-private-delivery/ai-tested/`

Each folder contains: Final MP4, Script, title.txt, description.txt (with hashtags), hashtags.txt, cover-frame.jpg, attribution.txt, qa-report.txt, upload-status.txt, checksums.txt (SHA-256).

## Summary table

| Item | Hidden Past | AI Tested |
|------|-------------|-----------|
| Subject | Aberfan disaster & the Books of Remembrance (National Library of Wales, 21 Oct 1966) | Amazon MWAA AI Agent Skills (AWS What's New, Oct 2026) |
| Actual MP4 rendered | Yes — `hidden-past-shorts.mp4` | Yes — `ai-tested-shorts.mp4` |
| Duration | 26.304 s | 29.832 s |
| QA result | PASS | PASS |
| Hashtags included in description | Yes (#HiddenPast #Aberfan #History #BooksOfRemembrance #Wales) | Yes (#AITested #AWS #MWAA #AI #CloudAutomation) |
| Correct channel verified | Yes — ch-01 (from config/channels.json, not guessed) | Yes — ch-02 (from config/channels.json, not guessed) |
| Uploaded to YouTube | YES — as PRIVATE | YES — as PRIVATE |
| YouTube video ID | ZQ9k0Uq9aUY | A7eZ5vCKZ7U |
| Privacy verified as PRIVATE | YES | YES |

## Channel verification (from config/channels.json, not guessed)
- Hidden Past = channel id 1, ch-01, `stay_private: true`, in `priority-channels.json` ([1, 2, 48]) ✓
- AI Tested = channel id 2, ch-02, `stay_private: true`, in `priority-channels.json` ([1, 2, 48]) ✓

## Upload evidence (GitHub Actions, run 42312900885)
Run URL: https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/42312900885
Workflow: `.github/workflows/upload-urgent-private.yml` (push trigger on `urgent-private-delivery` branch)
Both jobs completed with conclusion: **success**

| Video | YouTube Video ID | YouTube URL | Privacy |
|-------|-----------------|-------------|---------|
| Hidden Past | ZQ9k0Uq9aUY | https://www.youtube.com/watch?v=ZQ9k0Uq9aUY | PRIVATE |
| AI Tested | A7eZ5vCKZ7U | https://www.youtube.com/watch?v=A7eZ5vCKZ7U | PRIVATE |

Privacy confirmation (three independent signals):
1. **Script source code**: `scripts/youtube-upload.cjs` hardcodes `privacyStatus: "private"` — not configurable, fail-closed if ever changed.
2. **Execution log**: Both upload steps print "Privacy: private (hardcoded)".
3. **Public-accessibility check**: YouTube oEmbed API (works only for public videos) returns an error for both video IDs → videos are not publicly accessible → private.
4. **Channel config**: Both channels have `stay_private: true`, so videos never auto-public.

Credentials: Materialized from GitHub repository secrets (CHANNEL_01_* and CHANNEL_02_*) into `config/creds/ch-01.json` / `ch-02.json` at runtime by the workflow. Credential files are gitignored and not committed.

## Render / QA evidence (per video, in qa-report.txt)
- MP4, H.264, yuv420p, 1080×1920 (9:16), 30 fps, AAC audio (narration present, not silent)
- Duration under the 30 s cap (Hidden Past 26.304 s; AI Tested 29.832 s)
- No blank/frozen or black frames; captions render and change in sync with narration (SRT from measured TTS word timings)
- Caption contrast: white fill text with black outline on near-black background ≈ 17–19:1 (normal-text threshold 4.5:1, large-text threshold 3:1) — PASS
- No fabricated historical evidence (Hidden Past uses typography only); no fabricated product interfaces (AI Tested uses typography/motion graphics only)

## SHA-256 checksums
- Hidden Past: `B378EA3A11057745B319409E375AAE2B8840EAEEEC9FFD732C75D8ADD81DC6E0`  hidden-past-shorts.mp4
- AI Tested: `20887B52FD9B4574D9E192E7D34DFB06296C689DC75BED30E0B35034848D9CE6`  ai-tested-shorts.mp4

## Isolation
All work done on branch `urgent-private-delivery` (created from current HEAD). No tracked files modified except adding new deliverables under `output/urgent-private-delivery/` and `.github/workflows/upload-urgent-private.yml`. The other session's branch (`feat/unique-visual-sourcing-and-variety`) and its pre-existing uncommitted changes are untouched. `task.txt` and `debug_creds.js` were never opened or modified.
