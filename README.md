# Automated Multi-Channel YouTube System — Complete Setup Package

This is the full, self-contained package for building a hands-free,
multi-channel YouTube automation system with OpenCode. It's written so
anyone — including someone who didn't build the original version — can
pick this up and run it from zero.

## What this system does
Runs any number of YouTube channels (currently 17, cut down from an original
50 — see `NICHE-AUDIT.md` for why), each on its own separate Google account,
fully hands-free:
- A Short every day per channel (the funnel), plus a long-form video on
  Monday/Wednesday/Friday from that day's same researched topic (the
  qualifying and earning format — see `NICHE-AUDIT.md` §0.1/0.2 and
  `LONGFORM-SPEC.md`)
- Every topic, fact, script, image, and sound effect is sourced from real
  web/YouTube/social/GitHub research — nothing invented or written from
  general AI knowledge
- Videos upload private first, then automatically go public after a short
  delay (default 1 hour) unless manually cancelled in that window
- Three visual styles per channel: minimal, motion-graphics, and a third
  style chosen through research rather than fixed in advance (see
  `niche-discovery` and `remotion-render` skills)
- Real, verified photos used for named people/places — never mismatched
  stock or generic filler
- Visual polish (grain, filters, layering) and sound effects both grounded
  in researched current practice, with real SFX files sourced from
  license-clear GitHub repositories

## Requirements before starting
- OpenCode installed
- A GitHub account and an empty repo to build into
- One Google account + YouTube channel per automation channel you want to run
- `pip install edge-tts` (or your chosen TTS provider) once OpenCode tells
  you which it picked

## How to start (no copy-pasting required)
Terminal paste, if you ever need it: `Cmd+V` (Mac), `Ctrl+Shift+V`
(Linux/Windows Terminal), or `Shift+Insert` anywhere. But you shouldn't
need it — OpenCode reads files straight off disk.

**Download this as the single zip file provided, not individual files.**
Every skill needs its own folder (that's how OpenCode/Claude Code discover
skill names — from the folder name, with `SKILL.md` inside each one) —
downloading files one at a time loses that folder structure since several
are all named `SKILL.md`. The zip preserves it exactly; unzip it and the
whole `.opencode/skills/` tree comes out intact.

1. Create a new empty GitHub repo, clone it locally
2. Unzip this package's contents at the root of that cloned repo
3. `cd` into the repo, run `opencode`
4. Tell it: `Read PROMPT_FOR_OPENCODE.md and follow it step by step,
   asking me the setup questions in it before writing any code.`

## One real limitation to know about upfront
YouTube's API can fully automate a channel's branding (name, description,
keywords) and everything downstream of that — but it **cannot create a
new channel**. Creating the channel itself is a one-time manual click per
Google account (Create a new channel, in YouTube's account switcher).
`channel-branding` generates all the naming/description/keyword content
for you and hands you a batch sheet to paste in during that one manual
click per channel, then pushes any further branding updates automatically.

## Build order (do not skip ahead)
1. Channel config schema + **one real test channel**, end to end
2. `deep-research` skill — test on one topic
3. `trend-research` skill — YouTube API trending data
4. `script-writer` — produce a Shorts and a long-form script from real
   research, review both
5. `thumbnail-maker`
6. `vfx-audit` — research and lock in the visual polish approach per style
7. `sfx-sourcing` — research SFX usage + pull real license-clear files
8. `remotion-render` — build and compare all style templates on the same
   script
9. `youtube-publish` — private-upload + delayed-public flow, confirmed
   working on the test channel
10. GitHub Actions: daily Shorts cron + Tue/Fri long-form cron, matrix
    strategy, tested on the one channel
11. Only once 1-10 work end-to-end: run `niche-discovery` to find and
    confirm the remaining channel niches, then scale config to all of them

## GitHub Secrets (required for automation)

Each channel needs 3 OAuth credentials stored as GitHub secrets. The portfolio
was cut from 50 to 17 channels per `NICHE-AUDIT.md` (see that file for the
reasoning — Shorts RPM reality, the inauthentic-content policy, and the
per-niche CPM research behind which channels survived). For 17 channels,
that's **51 secrets**, not 150.

### Secret naming format

```
CHANNEL_{2-digit-ID}_CLIENT_ID
CHANNEL_{2-digit-ID}_CLIENT_SECRET
CHANNEL_{2-digit-ID}_REFRESH_TOKEN
```

IDs are **not renumbered** after the cut — they keep their original numeric
`id` from when the portfolio had 50, so existing `data/research/<id>/` paths
and any credentials already issued for a surviving channel stay valid. That's
why the list below isn't 01–17 sequential.

### Full list (the 17 surviving channels)

| Channel | Name | CLIENT_ID | CLIENT_SECRET | REFRESH_TOKEN |
|---------|------|-----------|---------------|---------------|
| 01 | Money Mind | `CHANNEL_01_CLIENT_ID` | `CHANNEL_01_CLIENT_SECRET` | `CHANNEL_01_REFRESH_TOKEN` |
| 02 | Legal Brief | `CHANNEL_02_CLIENT_ID` | `CHANNEL_02_CLIENT_SECRET` | `CHANNEL_02_REFRESH_TOKEN` |
| 03 | AI Tested | `CHANNEL_03_CLIENT_ID` | `CHANNEL_03_CLIENT_SECRET` | `CHANNEL_03_REFRESH_TOKEN` |
| 04 | Hidden Past | `CHANNEL_04_CLIENT_ID` | `CHANNEL_04_CLIENT_SECRET` | `CHANNEL_04_REFRESH_TOKEN` |
| 07 | Dead Companies | `CHANNEL_07_CLIENT_ID` | `CHANNEL_07_CLIENT_SECRET` | `CHANNEL_07_REFRESH_TOKEN` |
| 09 | Border Lines | `CHANNEL_09_CLIENT_ID` | `CHANNEL_09_CLIENT_SECRET` | `CHANNEL_09_REFRESH_TOKEN` |
| 11 | Cosmic Frontiers | `CHANNEL_11_CLIENT_ID` | `CHANNEL_11_CLIENT_SECRET` | `CHANNEL_11_REFRESH_TOKEN` |
| 17 | Epoch Chronicles | `CHANNEL_17_CLIENT_ID` | `CHANNEL_17_CLIENT_SECRET` | `CHANNEL_17_REFRESH_TOKEN` |
| 26 | Fraud Files | `CHANNEL_26_CLIENT_ID` | `CHANNEL_26_CLIENT_SECRET` | `CHANNEL_26_REFRESH_TOKEN` |
| 30 | Cold Case DNA | `CHANNEL_30_CLIENT_ID` | `CHANNEL_30_CLIENT_SECRET` | `CHANNEL_30_REFRESH_TOKEN` |
| 31 | Justice Denied | `CHANNEL_31_CLIENT_ID` | `CHANNEL_31_CLIENT_SECRET` | `CHANNEL_31_REFRESH_TOKEN` |
| 35 | The Engineering Archive | `CHANNEL_35_CLIENT_ID` | `CHANNEL_35_CLIENT_SECRET` | `CHANNEL_35_REFRESH_TOKEN` |
| 39 | Case File Medicine | `CHANNEL_39_CLIENT_ID` | `CHANNEL_39_CLIENT_SECRET` | `CHANNEL_39_REFRESH_TOKEN` |
| 44 | Skill Stack | `CHANNEL_44_CLIENT_ID` | `CHANNEL_44_CLIENT_SECRET` | `CHANNEL_44_REFRESH_TOKEN` |
| 46 | Interview Insider | `CHANNEL_46_CLIENT_ID` | `CHANNEL_46_CLIENT_SECRET` | `CHANNEL_46_REFRESH_TOKEN` |
| 47 | Medicare Navigator ⚠️ | `CHANNEL_47_CLIENT_ID` | `CHANNEL_47_CLIENT_SECRET` | `CHANNEL_47_REFRESH_TOKEN` |
| 48 | Factory Floor | `CHANNEL_48_CLIENT_ID` | `CHANNEL_48_CLIENT_SECRET` | `CHANNEL_48_REFRESH_TOKEN` |

⚠️ **Medicare Navigator requires human review before every single upload** —
see `NICHE-AUDIT.md` §3.3 and `channels.json`'s `requires_human_review` field.
`youtube-publish/run.js` hard-gates on this; do not bypass it.

### How to get credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or use existing)
3. Enable **YouTube Data API v3** and **YouTube Analytics API**
4. Create **OAuth 2.0 Client ID** (Desktop app type)
5. Download the JSON — extract `client_id`, `client_secret`
6. Use a refresh token generator (or run the OAuth flow once) to get `refresh_token`
7. Add all 3 as GitHub secrets per channel

### Quick setup (copy-paste all 150 at once)

```bash
# Example for channel 01:
gh secret set CHANNEL_01_CLIENT_ID --body="your-client-id"
gh secret set CHANNEL_01_CLIENT_SECRET --body="your-client-secret"
gh secret set CHANNEL_01_REFRESH_TOKEN --body="your-refresh-token"

# Repeat for channels 02-50
```

## What's in here
- `PROMPT_FOR_OPENCODE.md` — master kickoff prompt
- `.opencode/skills/` — every skill OpenCode needs, auto-discovered:
  - `deep-research` — multi-pass topic/fact research (web + social + practitioner)
  - `trend-research` — YouTube API trending data
  - `niche-discovery` — finds and evaluates new channel niches
  - `script-writer` — Shorts + long-form scripts, format-specific length
  - `vfx-audit` — researches and applies real visual-polish practices
  - `sfx-sourcing` — researches SFX usage + sources real files from GitHub
  - `remotion-render` — renders using the 3 style templates
  - `thumbnail-maker` — generates matching thumbnails
  - `youtube-publish` — private upload, delayed auto-public
  - `channel-branding` — generates channel name/description/keywords per
    niche and pushes them via API (channel creation itself stays manual —
    see limitation above)
  - `performance-tracking` — views (Shorts vs. long-form) and revenue,
    grouped by which Google account owns each channel
  - `weekly-learning` — weekly retention analysis + competitor
    benchmarking, feeding real adjustments back into scripts and editing
- `config/channels.example.json` — one channel's config schema; duplicate
  per channel with real values

## Handing this off / reselling
Nothing in this folder is tied to any specific brand, account, or
credentials — it's a generic blueprint. Whoever receives it just needs
their own Google accounts, GitHub repo, and OpenCode installation to run
it from scratch using the steps above.
