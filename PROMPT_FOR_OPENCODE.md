# Project: Automated Multi-Channel YouTube System

## What we're building
A pipeline that runs multiple YouTube channels (target: 50), each on its
own separate Google account, fully hands-free end to end. Per channel: 2
Shorts posted per day, plus one long-form video on Tuesday and Friday.

Everything — topics, facts, scripts, images, sound effects, and visual
style choices — must come from real, current web/YouTube/social/GitHub
research. Nothing invented or written from general AI knowledge. Research
and script-writing run automatically with no manual approval step per
video. Videos upload to YouTube as **private** first, then automatically
go **public** after a short configured delay (default 1 hour) unless
cancelled — this is the only checkpoint in the whole pipeline.

## Before writing any code, do this
1. Read every `SKILL.md` in `.opencode/skills/`.
2. Ask me the setup questions below. Wait for my answers before scaffolding
   anything.
3. Read `config/channels.example.json` so you understand the config shape
   you're building toward.

## Setup questions to ask me
- What are the first 5 niches/verticals to build and test with?
- Do I have YouTube Data API credentials (OAuth client) ready for at least
  one test channel, or should that be step one?
- What TTS provider should voiceovers use?
- Any channels that should skip the private-review delay entirely?

## Styles
Three visual styles per channel, not fixed in advance:
1. **Minimal** — kinetic typography, clean background, synced captions
2. **Motion-graphics** — icon/scene-based animated sequences
3. **Third style — determined by research, not assumed.** Before building
   it, research 2-3 real currently-effective alternative styles (with
   actual examples of channels/videos using them well) and report back
   with a recommendation before implementing. Voice-animation has already
   been ruled out — don't propose it again.

## Build order (one channel first, not all 50)
1. Channel config schema + one real test channel filled in
2. Deep-research skill wired up and tested on one topic
3. Trend-research skill (YouTube API) wired up and tested
4. Script-writer skill: produce one Shorts script and one long-form script
   from real researched material, show me both
5. Thumbnail-maker skill
6. VFX-audit skill: research real current visual-polish practice (grain,
   filters, layering, color, general "alive" look) per style, apply
   findings to the templates — report findings before locking anything in
7. SFX-sourcing skill: research how sound effects are used effectively in
   this style/niche, then source real, license-clear sound effect files
   from GitHub repositories — never a synthesized placeholder sound
8. Remotion-render skill — build and show me all 3 style templates
   (including the researched third style) on the same script, with real
   verified photos for any named person/place and the VFX/SFX findings
   applied, so I can pick per channel
9. YouTube-publish skill — private upload, auto-public after the
   configured delay, confirm the flow works on one real test upload before
   relying on it
10. GitHub Actions: one workflow, matrix strategy, daily cron for Shorts,
    Tue/Fri cron for long-form — test on the one channel first
11. Niche-discovery skill: once 1-10 work end-to-end, use this to find and
    evaluate the remaining channel niches. Show me the full list with
    evidence (current performance + durability + style fit) before
    generating new channel configs
12. Channel-branding skill: for each new niche/channel, research and
    generate a name, description, and keyword set, and give me a batch
    sheet I can use during the one manual "create channel" click per
    Google account (the API can't create channels, only brand them —
    confirm this limitation with me if you find otherwise)
13. Once channels exist and I've provided each `owner_gmail` grouping:
    performance-tracking skill — wire up real view (Shorts vs. long-form)
    and revenue tracking per channel, grouped by owning account
14. Weekly-learning skill: set up the weekly retention-analysis +
    competitor-benchmarking job that feeds real adjustments back into
    script-writer, remotion-render, and niche-discovery
15. Only after I confirm the niche list: duplicate config to the remaining
    channels

## The research → script flow (fully automatic, no waiting on me per video)
For every new topic:
1. Run deep-research — 3-4 search passes minimum, different angles each
   time: general web, news, practitioner/community, social discussion.
2. Log the findings summary to the channel's run log for auditing, then
   proceed straight to script-writer without waiting for sign-off.
3. Write the script, then move to thumbnail, VFX/SFX application, and
   render.

I review after the fact via the private-upload delay window, not before
each script.

## Hard rules
- No fact, statistic, claim, image, or sound effect in any video that
  didn't come from an actual fetched/searched source in this session.
- Every upload goes private first, then auto-publishes public after the
  channel's configured delay unless cancelled — never skip straight to
  public, never set the delay to zero without me explicitly asking for that.
- Real, verified photos only for named people/places — if nothing
  verifiably correct is found, fall back to graphics rather than guessing.
- Real sound effect files only, sourced from license-clear repositories,
  with license/attribution logged — never a placeholder or invented sound.
- Each channel's render/commit is independent — no channel's failure
  should block another channel's run.
