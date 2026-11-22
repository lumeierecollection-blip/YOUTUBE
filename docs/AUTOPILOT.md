# Two-Channel Autopilot

Nobody has to start a production or write a prompt. `.github/workflows/autopilot.yml` wakes every 4 hours, checks whether a slot is due, and makes the video if one is.

## Schedule (SAST, UTC+2)

| Channel | Day | Time |
|---|---|---|
| AI Tested | Mon, Tue, Wed, Thu, Fri | 11:00 |
| Hidden Past | Wed | 16:00 |
| Hidden Past | Sat | 11:00 |

That is 7 Shorts a week, 71% AI Tested. Change the times in `config/autopilot.json`.

The workflow polls at 03:23, 07:23, 11:23, 15:23, 19:23 and 23:23 SAST (`23 1,5,9,13,17,21 * * *` UTC). A slot runs on the first poll after its time. GitHub has fired this repo's crons hours late, so the slot time, not the cron, decides what is due. A slot that is still unmade after 36 hours is dropped rather than piling up.

## What happens in a production

1. **Claim.** The slot is written to the ledger on the `automation/state` branch by a git push. A second trigger sees the claim and stops. Only one production runs at a time.
2. **Discover.** Fetches real items from Google News, Bing News, publisher and official feeds, Reddit, Hacker News, Google Trends and (Hidden Past) Wikipedia anniversaries for the coming week. Each proposal is checked for independent coverage. If fewer than 3 candidates qualify, a second wave searches other phrases. Every source's result and every rejection reason is saved in `candidates.json`.
3. **Score.** Out of 100, using the weights in the config. Momentum, reach and source quality come from fetched data. Curiosity, relevance and visual potential are a model's ratings. A signal that could not be fetched counts as nothing. Stale, single-source, obscure, weak or recently covered topics are rejected.
4. **Research and script.** The existing research runner and gates (`gate-research`, `gate-script`, story and claims checks). If web search is down, research reads fetched publisher pages instead. The writer uses a dedicated 30-second brief with per-channel word budgets from measured voice pace, and revises its previous draft against the gate findings, up to 10 passes. A final editorial read of the whole script can still reject it. If claims cannot be checked, the production stops. If a topic fails here, or has no usable images, the next candidate is tried (up to 3). A topic tried once is never picked again.
5. **Visuals.** AI Tested and Hidden Past have separate builders. See below.
6. **Render, then gates.** See below.
7. **Private upload.** `scripts/youtube-upload.cjs`, after confirming the token belongs to the right channel and that the hash, production ID and title are all new.
8. **Read-back.** The YouTube API must confirm channel, title, description and `privacyStatus: "private"`.
9. **Report.** Ledger, Telegram, performance data, `DASHBOARD.md`.

## Channel treatments

**AI Tested** (`scripts/autopilot/ai-tested.mjs`): kinetic type, diagrams, comparisons, data bars, terminal inserts and a real screenshot of a cited page. Illustrative panels are labelled `ILLUSTRATIVE` on screen. Numbers on screen must exist in the script or research.

**Hidden Past** (`scripts/autopilot/hidden-past.mjs`): applies `.agents/skills/vox-style-treatment/SKILL.md`.
- Each photo is desaturated, rendered once through `PhotoTreatment.jsx`, restored to display encoding and shown as that still. The timeline has no scale or pan on photos.
- Each image is classed as exact (shows something the narration names) or context (same place or period). Context images are labelled "Related image" on screen, and a video needs at least one exact image. A cheap image check runs before research is spent.
- Annotations are drawn only on a detail that a vision model located and a separate look at the crop confirmed.
- Chapter openers, map routes on Natural Earth data, slide-in type, sound on chapters and annotations.
- A scene that cannot get a treatment records the reason as an exception.

## Gates (all must pass; any failure blocks upload)

| Gate | Checks |
|---|---|
| Technical | 30 s or less, 1080x1920, 30 fps, H.264, AAC, audible, no black, frozen or undecodable frames |
| `video-qa.js` | Existing timeline and final-pixel checks |
| Frame review | A vision model reads a 15-frame sheet from the MP4. Clipped or overlapping text must be confirmed on full-resolution frames. If no model answers, the video is held |
| `final-acceptance.mjs` | Existing acceptance checks, per production |
| VOX inspection (Hidden Past) | Measured from the MP4: photo stability, halftone, grain, vignette, grade, annotation and route draw-on, chapter motion |

One exception: `video-qa.js` requires zoom or pan on 80% of image layers. VOX forbids that, so for Hidden Past that single check is replaced by the VOX stability test, and every run records it. It still applies to AI Tested.

Hidden Past reports land in `output/github-final-production/hidden-past/` inside the run's artifact: `final.mp4`, `vox-compliance-report.json`, `VOX-VISUAL-REVIEW.md`, `vox-comparison.jpg`, frames, contact sheet, attribution and SHA-256.

## Retries and recovery

- Each slot gets 2 attempts, the second on a later poll. A retry cannot pick a topic already tried.
- Fresh slots go before retries, so one failing channel never blocks the other.
- A production that makes no accepted video turns the GitHub run red.
- The channel login is checked first, so a broken token fails before any quota is spent.
- A job GitHub kills is detected after 3 hours and becomes a normal failed attempt.
- A slot that passed QA but lost its upload result is never re-produced automatically; the dashboard flags it.
- Model answers that arrive truncated or malformed are retried. Network errors are retried with backoff.
- A search outage does not use up the topic.
- Upload runs at most twice, with a title check before each try, so a first attempt that really worked cannot be duplicated. A video on YouTube is recorded first.

## If scheduling fails

Push any commit to the `automation/kick` branch. Without a `config/autopilot-kick.json` file (or with `{"channel":"due"}`) it behaves exactly like a poll. `{"channel":"2"}` forces one extra production, and `"not_before"` makes that job wait on GitHub until a given time (useful for a provider quota reset). This route does not use `workflow_dispatch`.

## Watching it

Open `autopilot/DASHBOARD.md` on the `automation/state` branch. Each run's video and evidence are in its Actions artifact for 90 days.

## Telegram

Add repository secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Until they exist, the dashboard lists this under "Needs your attention".

## Limits

- Model capacity is the tightest constraint. Gemini's free daily quota is the main provider; a burst of many productions in one day exhausts it and lowers script quality. Seven videos a week fits within it.
- Retention data needs the `yt-analytics.readonly` OAuth scope. If the current tokens lack it, the dashboard says so and only views, likes and comments are collected. Impressions and viewed-versus-swiped are not offered by the API.
- All uploads are private, so performance learning stays empty until videos are public. A pillar needs 3 public videos before anything is inferred from it.
- Halftone, grain and grade checks are statistics showing the treatment reached the pixels. They do not judge whether it looks good.
