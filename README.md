# Automated Multi-Channel YouTube System — Complete Setup Package

This is the full, self-contained package for building a hands-free,
multi-channel YouTube automation system with OpenCode. It's written so
anyone — including someone who didn't build the original version — can
pick this up and run it from zero.

## What this system does
Runs any number of YouTube channels (built and tested at 50), each on its
own separate Google account, fully hands-free:
- 2 Shorts per day, one long-form video on Tuesday and Friday, per channel
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

Each channel needs 3 OAuth credentials stored as GitHub secrets. For 50 channels, that's **150 secrets**.

### Secret naming format

```
CHANNEL_{2-digit-ID}_CLIENT_ID
CHANNEL_{2-digit-ID}_CLIENT_SECRET
CHANNEL_{2-digit-ID}_REFRESH_TOKEN
```

### Full list

| Channel | Name | CLIENT_ID | CLIENT_SECRET | REFRESH_TOKEN |
|---------|------|-----------|---------------|---------------|
| 01 | Money Mind | `CHANNEL_01_CLIENT_ID` | `CHANNEL_01_CLIENT_SECRET` | `CHANNEL_01_REFRESH_TOKEN` |
| 02 | Legal Brief | `CHANNEL_02_CLIENT_ID` | `CHANNEL_02_CLIENT_SECRET` | `CHANNEL_02_REFRESH_TOKEN` |
| 03 | ToolTok | `CHANNEL_03_CLIENT_ID` | `CHANNEL_03_CLIENT_SECRET` | `CHANNEL_03_REFRESH_TOKEN` |
| 04 | History Untold | `CHANNEL_04_CLIENT_ID` | `CHANNEL_04_CLIENT_SECRET` | `CHANNEL_04_REFRESH_TOKEN` |
| 05 | Eruption | `CHANNEL_05_CLIENT_ID` | `CHANNEL_05_CLIENT_SECRET` | `CHANNEL_05_REFRESH_TOKEN` |
| 06 | Warfront | `CHANNEL_06_CLIENT_ID` | `CHANNEL_06_CLIENT_SECRET` | `CHANNEL_06_REFRESH_TOKEN` |
| 07 | Dead Company | `CHANNEL_07_CLIENT_ID` | `CHANNEL_07_CLIENT_SECRET` | `CHANNEL_07_REFRESH_TOKEN` |
| 08 | Brain Drop | `CHANNEL_08_CLIENT_ID` | `CHANNEL_08_CLIENT_SECRET` | `CHANNEL_08_REFRESH_TOKEN` |
| 09 | Border Lines | `CHANNEL_09_CLIENT_ID` | `CHANNEL_09_CLIENT_SECRET` | `CHANNEL_09_REFRESH_TOKEN` |
| 10 | Betrayed | `CHANNEL_10_CLIENT_ID` | `CHANNEL_10_CLIENT_SECRET` | `CHANNEL_10_REFRESH_TOKEN` |
| 11 | Debt Decoder | `CHANNEL_11_CLIENT_ID` | `CHANNEL_11_CLIENT_SECRET` | `CHANNEL_11_REFRESH_TOKEN` |
| 12 | Courtroom Tea | `CHANNEL_12_CLIENT_ID` | `CHANNEL_12_CLIENT_SECRET` | `CHANNEL_12_REFRESH_TOKEN` |
| 13 | Pixel Lab | `CHANNEL_13_CLIENT_ID` | `CHANNEL_13_CLIENT_SECRET` | `CHANNEL_13_REFRESH_TOKEN` |
| 14 | Quantum Canvas | `CHANNEL_14_CLIENT_ID` | `CHANNEL_14_CLIENT_SECRET` | `CHANNEL_14_REFRESH_TOKEN` |
| 15 | Earth Signal | `CHANNEL_15_CLIENT_ID` | `CHANNEL_15_CLIENT_SECRET` | `CHANNEL_15_REFRESH_TOKEN` |
| 16 | Timeline X | `CHANNEL_16_CLIENT_ID` | `CHANNEL_16_CLIENT_SECRET` | `CHANNEL_16_REFRESH_TOKEN` |
| 17 | Forge & Fall | `CHANNEL_17_CLIENT_ID` | `CHANNEL_17_CLIENT_SECRET` | `CHANNEL_17_REFRESH_TOKEN` |
| 18 | Brief History | `CHANNEL_18_CLIENT_ID` | `CHANNEL_18_CLIENT_SECRET` | `CHANNEL_18_REFRESH_TOKEN` |
| 19 | Case Closed | `CHANNEL_19_CLIENT_ID` | `CHANNEL_19_CLIENT_SECRET` | `CHANNEL_19_REFRESH_TOKEN` |
| 20 | Rewired | `CHANNEL_20_CLIENT_ID` | `CHANNEL_20_CLIENT_SECRET` | `CHANNEL_20_REFRESH_TOKEN` |
| 21 | Empire Fall | `CHANNEL_21_CLIENT_ID` | `CHANNEL_21_CLIENT_SECRET` | `CHANNEL_21_REFRESH_TOKEN` |
| 22 | Panel Pulse | `CHANNEL_22_CLIENT_ID` | `CHANNEL_22_CLIENT_SECRET` | `CHANNEL_22_REFRESH_TOKEN` |
| 23 | Dark Atlas | `CHANNEL_23_CLIENT_ID` | `CHANNEL_23_CLIENT_SECRET` | `CHANNEL_23_REFRESH_TOKEN` |
| 24 | Mind Forge | `CHANNEL_24_CLIENT_ID` | `CHANNEL_24_CLIENT_SECRET` | `CHANNEL_24_REFRESH_TOKEN` |
| 25 | Silicon autopsy | `CHANNEL_25_CLIENT_ID` | `CHANNEL_25_CLIENT_SECRET` | `CHANNEL_25_REFRESH_TOKEN` |
| 26 | The Unit | `CHANNEL_26_CLIENT_ID` | `CHANNEL_26_CLIENT_SECRET` | `CHANNEL_26_REFRESH_TOKEN` |
| 27 | Paper Trail | `CHANNEL_27_CLIENT_ID` | `CHANNEL_27_CLIENT_SECRET` | `CHANNEL_27_REFRESH_TOKEN` |
| 28 | Red Line | `CHANNEL_28_CLIENT_ID` | `CHANNEL_28_CLIENT_SECRET` | `CHANNEL_28_REFRESH_TOKEN` |
| 29 | Signal Lost | `CHANNEL_29_CLIENT_ID` | `CHANNEL_29_CLIENT_SECRET` | `CHANNEL_29_REFRESH_TOKEN` |
| 30 | Pitch Deck | `CHANNEL_30_CLIENT_ID` | `CHANNEL_30_CLIENT_SECRET` | `CHANNEL_30_REFRESH_TOKEN` |
| 31 | Fracture | `CHANNEL_31_CLIENT_ID` | `CHANNEL_31_CLIENT_SECRET` | `CHANNEL_31_REFRESH_TOKEN` |
| 32 | Cold Vault | `CHANNEL_32_CLIENT_ID` | `CHANNEL_32_CLIENT_SECRET` | `CHANNEL_32_REFRESH_TOKEN` |
| 33 | War Machine | `CHANNEL_33_CLIENT_ID` | `CHANNEL_33_CLIENT_SECRET` | `CHANNEL_33_REFRESH_TOKEN` |
| 34 | Unravel | `CHANNEL_34_CLIENT_ID` | `CHANNEL_34_CLIENT_SECRET` | `CHANNEL_34_REFRESH_TOKEN` |
| 35 | Collateral | `CHANNEL_35_CLIENT_ID` | `CHANNEL_35_CLIENT_SECRET` | `CHANNEL_35_REFRESH_TOKEN` |
| 36 | The Dig | `CHANNEL_36_CLIENT_ID` | `CHANNEL_36_CLIENT_SECRET` | `CHANNEL_36_REFRESH_TOKEN` |
| 37 | Protocol | `CHANNEL_37_CLIENT_ID` | `CHANNEL_37_CLIENT_SECRET` | `CHANNEL_37_REFRESH_TOKEN` |
| 38 | Fault Line | `CHANNEL_38_CLIENT_ID` | `CHANNEL_38_CLIENT_SECRET` | `CHANNEL_38_REFRESH_TOKEN` |
| 39 | Black Ledger | `CHANNEL_39_CLIENT_ID` | `CHANNEL_39_CLIENT_SECRET` | `CHANNEL_39_REFRESH_TOKEN` |
| 40 | Aftermath | `CHANNEL_40_CLIENT_ID` | `CHANNEL_40_CLIENT_SECRET` | `CHANNEL_40_REFRESH_TOKEN` |
| 41 | Mind & Body Files | `CHANNEL_41_CLIENT_ID` | `CHANNEL_41_CLIENT_SECRET` | `CHANNEL_41_REFRESH_TOKEN` |
| 42 | The Fix | `CHANNEL_42_CLIENT_ID` | `CHANNEL_42_CLIENT_SECRET` | `CHANNEL_42_REFRESH_TOKEN` |
| 43 | Blueprint | `CHANNEL_43_CLIENT_ID` | `CHANNEL_43_CLIENT_SECRET` | `CHANNEL_43_REFRESH_TOKEN` |
| 44 | Skill Stack | `CHANNEL_44_CLIENT_ID` | `CHANNEL_44_CLIENT_SECRET` | `CHANNEL_44_REFRESH_TOKEN` |
| 45 | Vendetta | `CHANNEL_45_CLIENT_ID` | `CHANNEL_45_CLIENT_SECRET` | `CHANNEL_45_REFRESH_TOKEN` |
| 46 | Origin Story | `CHANNEL_46_CLIENT_ID` | `CHANNEL_46_CLIENT_SECRET` | `CHANNEL_46_REFRESH_TOKEN` |
| 47 | The Drop | `CHANNEL_47_CLIENT_ID` | `CHANNEL_47_CLIENT_SECRET` | `CHANNEL_47_REFRESH_TOKEN` |
| 48 | Smoke Signal | `CHANNEL_48_CLIENT_ID` | `CHANNEL_48_CLIENT_SECRET` | `CHANNEL_48_REFRESH_TOKEN` |
| 49 | Catalyst | `CHANNEL_49_CLIENT_ID` | `CHANNEL_49_CLIENT_SECRET` | `CHANNEL_49_REFRESH_TOKEN` |
| 50 | Paradox | `CHANNEL_50_CLIENT_ID` | `CHANNEL_50_CLIENT_SECRET` | `CHANNEL_50_REFRESH_TOKEN` |

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
