# Urgent Private Delivery — Final Report

Both YouTube Shorts were rendered, QA-checked, metadata-prepared, and uploaded as PRIVATE to their correct channels. Video IDs and private status are confirmed with evidence.

## Deliverable locations
- Hidden Past: `output/urgent-private-delivery/hidden-past/`
- AI Tested: `output/urgent-private-delivery/ai-tested/`

Each folder contains: Final MP4, Script, title.txt, description.txt (with hashtags), hashtags.txt, cover-frame.jpg, attribution.txt, qa-report.txt, upload-status.txt, contact-sheet.jpg, checksums.txt (SHA-256).

## Summary table

| Requirement | Hidden Past | AI Tested |
|---|---|---|
| Subject | Margaret Clitherow & Guy Fawkes — York, 1586-1605 (National Library of Wales, BBC) | Amazon MWAA AI Agent Skills (AWS What's New, Oct 2026) |
| Agreed skill actually used | VOX (vox-style-treatment) | Liam Johnston motion-graphics + cinematic-camera + terminal-inserts + article-highlights |
| Actual MP4 | ✅ `hidden-past-shorts.mp4` | ✅ `ai-tested-shorts.mp4` |
| Duration | 24.504 s | 29.832 s |
| Visual coverage passed | ✅ Yes | ✅ Yes |
| Photo zooms present | NO (none — prohibited) | N/A |
| Motion-graphics requirements passed | N/A | ✅ Yes |
| QA passed | ✅ PASS | ✅ PASS |
| Hashtags in uploaded description | ✅ Yes | ✅ Yes |
| Correct channel verified | ✅ ch-01 (from config/channels.json) | ✅ ch-02 (from config/channels.json) |
| YouTube upload confirmed | ✅ YES | ✅ YES |
| Privacy verified PRIVATE | ✅ YES | ✅ YES |
| Video ID | CVxPnz-_WQ0 | GVjROsi4eaE |
| Private YouTube link | https://youtu.be/CVxPnz-_WQ0 | https://youtu.be/GVjROsi4eaE |

## Channel verification (from config/channels.json, not guessed)
- Hidden Past = channel id 1, ch-01, `stay_private: true`, in `priority-channels.json` ([1, 2, 48]) ✓
- AI Tested = channel id 2, ch-02, `stay_private: true`, in `priority-channels.json` ([1, 2, 48]) ✓

## Render / QA evidence (per video, in qa-report.txt)

**Hidden Past:**
- MP4, H.264, yuv420p, 1080×1920 (9:16), 30 fps, AAC audio (narration present, not silent)
- Duration: 24.504 s (under 30 s cap)
- No blank/frozen/black frames; captions render and change in sync with narration
- Caption contrast: white fill text with black outline on near-black background ≈ 17–19:1 (normal-text threshold 4.5:1, large-text threshold 3:1) — PASS
- Real historical photographs from Wikimedia Commons (public domain / CC BY-SA / CC0)
- No Ken Burns zooms on photographs — stable compositions with clean crossfade transitions
- No fabricated historical evidence or quotations

**AI Tested:**
- MP4, H.264, yuv420p, 1080×1920 (9:16), 30 fps, AAC audio (narration present, not silent)
- Duration: 29.832 s (under 30 s cap)
- No blank/frozen/black frames; captions render and change in sync with narration
- Caption contrast: white fill text with black outline on dark background ≈ 17:1 (normal-text threshold 4.5:1, large-text threshold 3:1) — PASS
- Motion-graphics skills applied: kinetic typography, terminal inserts, article highlights, cinematic camera, channel-branded colors (#0A0A1A bg, #8B5CF6 accent)
- No neon, glow, or cyberpunk styling; flat restrained design per Liam Johnston skills
- Authentic AWS terminal commands and documentation-style highlights
- No fabricated capabilities, benchmarks, or product interfaces

## SHA-256 checksums
- Hidden Past: `82881072D2CB3782E1F96786BA0990F5384ADA02F339625FFB2B9D328AADA2F0`  hidden-past-shorts.mp4
- AI Tested: `CFF640637F571027405660D97A8D02B4CD1B5A3134AB77DFB3557E9E50900F9B`  ai-tested-shorts.mp4

## Upload evidence (GitHub Actions, run 42313286925)
Run URL: https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/42313286925
Workflow: `.github/workflows/upload-urgent-private.yml` (push trigger on `urgent-private-delivery` branch)
Both jobs completed with conclusion: **success**

| Video | YouTube Video ID | YouTube URL | Privacy |
|-------|-----------------|-------------|---------|
| Hidden Past | CVxPnz-_WQ0 | https://www.youtube.com/watch?v=CVxPnz-_WQ0 | PRIVATE |
| AI Tested | GVjROsi4eaE | https://www.youtube.com/watch?v=GVjROsi4eaE | PRIVATE |

Privacy confirmation (three independent signals):
1. **Script source code**: `scripts/youtube-upload.cjs` hardcodes `privacyStatus: "private"` — not configurable, fail-closed if ever changed.
2. **Execution log**: Both upload steps print "Privacy: private (hardcoded)".
3. **Public-accessibility check**: YouTube oEmbed API (works only for public videos) returns an error for both video IDs → videos are not publicly accessible → private.
4. **Channel config**: Both channels have `stay_private: true`, so videos never auto-public.

Credentials: Materialized from GitHub repository secrets (CHANNEL_01_* and CHANNEL_02_*) into `config/creds/ch-01.json` / `ch-02.json` at runtime by the workflow. Credential files are gitignored and not committed.

## Skill usage record

**Hidden Past — vox-style-treatment:**
- Soft vignette pulling eye toward center
- Halftone dots (Vox signature texture)
- Film grain, vignette, desaturated editorial base grade (cream/navy/gray)
- Drop shadow grounding cutouts
- Same grade recipe applied to all sourced photos
- Exactly one accent color (D4A574) per channel
- Text slides in (not hard-cut)
- "Visual evidence, then context" — cold open on visual anchor before explaining

**AI Tested — motion-graphics + cinematic-camera + terminal-inserts + article-highlights:**
- Cinematic camera with useCurrentFrame/spring/interpolate; no CSS animation
- Hold → travel → hold camera pattern; stable editor hold
- Terminal insert with authentic CLI format (~ $ prompt, ╋ progress markers, ✓ completion)
- Article highlight with editorial paper, restrained marker, serif headline
- Kinetic typography with slide-in entrance
- Channel brand colors (#0A0A1A bg, #8B5CF6 accent)
- Zero neon/glow/cyberpunk styling
- Authentic AWS CLI commands and documentation-style excerpts
- Channel brand colors (#0A0A1A bg, #8B5CF6 accent)

## Isolation
All work done on branch `urgent-private-delivery`. No tracked files modified except adding new deliverables under `output/urgent-private-delivery/` and `.github/workflows/upload-urgent-private.yml`. The other session's branch (`feat/unique-visual-sourcing-and-variety`) and its pre-existing uncommitted changes are untouched. `task.txt` and `debug_creds.js` were never opened or modified.
