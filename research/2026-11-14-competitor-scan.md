# Competitor scan, 2026-11-14 (fresh cycle)

Source: YouTube Data API v3, run `competitor-research` #43620682910 on branch `ccr-d003fff3-tnca93`.
Window: 2026-11-04 .. 2026-11-14 (10 days; the 8-10 day primary window was sufficient for ch-02 and ch-04, thin for ch-01 and ch-03, see below).
Method: `search.list` order=viewCount, two queries per channel, Shorts (<=180 s) and long-form (>=480 s) ranked separately; stats from `videos.list`/`channels.list`.

## What was and was NOT inspected
- Inspected: title, channel, publish date, duration, view count, subscriber count, views/subs ratio (public API fields).
- NOT inspected: any video, frame, thumbnail, transcript or audio. Per owner decision (search-data only), every reference below is **"not watched"**.
- "Faceless" is NOT established by the API. Every pick is marked faceless-UNVERIFIED and must be confirmed before it drives visual direction.
- Queries are keyword-based; they bias results (ch-01 returned mostly Hindi/Indian-history content).

## Authorised channels (OAuth probe run 43620451045, 2026-11-14)
ch-01 Hidden Past, ch-02 AI Tested, ch-03 (YouTube title "Lumeiere Collection", owner-approved), ch-04 Rival Lines. Slot 48 excluded by owner. All others excluded (invalid / no credentials).

## Selected references (faceless-UNVERIFIED, not watched)
| Ch | Type | Video | Views | Subs | x | Date | Len |
|---|---|---|---|---|---|---|---|
| 04 | Short | Tactics Unfolded, "How Cesc Fabregas Beats the Press" https://youtu.be/_Qt54x2FM4c | 209,236 | 3,140 | 66.6 | 11-06 | 68 s |
| 04 | Long | Zekiel's Football Tales, "How Mourinho Fixed Real Madrid's Midfield Problem" https://youtu.be/l-8FSH6X4fw | 94,811 | 15,800 | 6.0 | 11-06 | 728 s |
| 04 | Long (2nd) | The Purist Football, "Fabregas' Como, Explained" https://youtu.be/x1bh-MEbdC0 | 72,641 | 228,000 | 0.32 | 11-07 | 687 s |
| 02 | Long | The Hardened Stack, "Craft Anything: The Free App That Clones Any App? I Tested It on Windows" https://youtu.be/99LXd-7GTBs | 41,966 | 1,140 | 36.8 | 11-05 | 563 s |
| 02 | Short | Fertile Facts, "Ai Tool Comparision" https://youtu.be/ULp-y-pzU2M | 15,752 | 8,700 | 1.8 | 11-12 | 52 s |
| 01 | Short | Goldenmindco, "From Bankruptcy to Billions: The Untold Story of Gerard & Anton Philips" https://youtu.be/Fc56mXA0uR8 | 65,472 | 5,960 | 11.0 | 11-10 | 161 s |
| 01 | Long | none adequate (see gaps) | | | | | |
| 03 | Short/Long | none adequate (see gaps) | | | | | |

## Findings
- ch-04: clearest signal. Three independent videos in the window are about Fabregas's Como tactics (209k, 89k, 72k, 10k). Topic is hot now; Shorts under 90 s that name one mechanism ("beats the press", "4-2-3-1 hidden weakness") dominate the Short list.
- ch-02: only Fable-5.2 / Claude / DeepSeek comparison and "I tested X" long-form pulls big numbers; most big channels are probably face-on (unverified). The one small-channel standout is a "free app that clones any app, tested on Windows" screen-test (x36.8).
- ch-01: window is dominated by Hindi/Indian "Untold Story" Shorts at 100k-470k. Pattern worth testing: "The Untold Story of [named pair/entity]" with a rivalry or reversal (Adidas vs Puma 469k from a 5k-sub channel). No strong English faceless long-form.
- ch-03: **insufficient.** The top video in the window has 254 views. Either the niche is quiet in this window or these queries miss the real competitors. Expanding to 7 days adds nothing (subset); needs different queries (named active cases) before a reference can be chosen.

## Known gaps (honest)
1. No video was watched; visual/hook/audio/script analysis is NOT done. Nothing here supports claims about footage, grading, typography or sound.
2. ch-01 long-form and ch-03 have no adequate reference.
3. Channel-title mismatch on slot 3 is owner-accepted; config name still says "Court & Spotlight".
