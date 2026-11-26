# AI Tested analytics summary (read-only recovery)

Nothing here is new data. Local credentials are absent (see `data/ai-tested/analytics/audit-2026-11-23.md`), so this summary rests on the
newest retention-report artifact that exists in the repo. `gh run list --workflow retention-report.yml` (checked 2026-11-26) shows the newest
run is 45167785502, 2026-11-23T11:43Z, branch `feat/ai-tested-shorts-vox`, which produced exactly the file below. No newer run exists on any branch.
The YouTube integration was only read; nothing was written to YouTube.

Sources (raw copies in this folder):
* `slot02-retention-2026-11-23.json` / `slot02-RETENTION-2026-11-23.md`, from `data/ai-tested/v4/analytics/` (run 45167785502, generated 2026-11-23T11:44:17Z). Channel "AI Tested", 11 subscribers.
* `slot01-RETENTION-2026-11-13.md`, from `docs/longform/analytics-2026-11-13/` (run 43498856278, 2026-11-13). Slot 01 is a different channel (history); used only as a weak sanity check.
* The 58% swipe-away rate was stated by the user. The API does not expose viewed-vs-swiped, so it is not in any file and is not verified here.

## Per-video table, AI Tested public Shorts with a retention curve

| Video | Published | Dur | Views | Avg viewed | Hook 0-3 s lost | Bridge lost (window) | Body lost | Close lost | Weakest | Subs gained |
|---|---|---|---|---|---|---|---|---|---|---|
| A Lawyer Trusted ChatGPT. It Invented 6 Court Cases (`mZXdIWAfjmI`) | 2026-11-19 | 29 s | 100 | 135.7% (39 s) | 3.8% | 46.2% (3-8.7 s) | 19.2% | 19.2% | bridge | 0 |
| AI Gets Big Multiplication Wrong. We Tested It (`Lyqg_U3n3fo`) | 2026-11-13 | 36 s | 29 | 112.0% (40 s) | 16.7% | 50.0% (3-10.8 s) | 25.0% | 8.3% | bridge | 0 |
| Does AI Cave When You Say "I'm an Expert"? 24 False Claims Tested (`fI2_A0TCllw`) | 2026-11-12 | 30 s | 257 | 72.1% (21 s) | 18.5% | 36.9% (3-9 s) | 26.2% | 16.9% | hook | 0 |

Still-watching at 3 s / 25% / 50% / 75% / end (audienceWatchRatio, above 100% = replays): lawyer 189/150/123/123/104; multiplication 167/125/100/100/83; expert 119/92/62/55/39.
Public with no curve yet (too few views): Air Canada's chatbot lied (`RZkrR47me8s`, 31 s, 69 views). Private uploads and duplicates (9 "Fake court cases" re-uploads, COMPAS, 12MP glasses, 374 s test) have 0 to 2 views and no audience data.

## Better vs weaker performers

| | Lawyer (better retention) | Multiplication | Expert (most views) |
|---|---|---|---|
| Topic category | news story with a real-world consequence (court sanction) | self-run test | self-run test |
| Title/hook device | concrete number + consequence ("6 Court Cases") | test claim | test + count ("24 False Claims") |
| Hook loss 0-3 s | 3.8% | 16.7% | 18.5% |
| Replay/loop (avg viewed over 100%) | yes, 136% | yes, 112% | no, 72% |
| End-of-video still watching | 104% | 83% | 39% |

What the data supports:
* In all three curves the bridge (the stretch right after the 3 s hook, 6 to 8 seconds long) loses 37 to 50% of the remaining audience. That is the largest single loss in every video and the weakest part in 2 of 3. It is the only pattern repeated in all three.
* The lawyer story (real event, a number, a named consequence) kept the hook (3.8% lost vs 17 to 19%) and finished with the best retention, even though it had fewer views than the expert video.
* The expert video drew the most views (257) but held the audience worst (72% average viewed, hook weakest at 6.2%/s lost). Reach and retention diverge here.
* Body segments are cheap everywhere (1.3 to 1.7% lost per second), so once the viewer is past the bridge they mostly stay.

What it does not support:
* Causal claims. n = 3 curves, views 29 to 257, one channel, three weeks. A 3-second difference in hook loss across 29 vs 100 views is within noise for the 29-view video.
* Any claim about swipe-away, thumbnails, titles, subscriber growth (0 subs gained on all three; the channel has 11 subscribers), or topic category beyond "news story vs test".
* Slot 01 (history) cannot be compared: different niche, and its only 99-view curve had the hook as weakest at 30% lost (Escobar), i.e. weak hooks are not unique to AI Tested.

## Implications for the next five videos (only what the data bears out)

1. Treat the 3 to ~9 s bridge as the primary risk in every script and storyboard: no recap of the premise, a new piece of evidence or visual event inside the bridge window.
2. Open on a concrete, named, numbered, real event (lawyer-style) rather than on the format ("we tested"). This is a weak, one-sample signal, not a rule.
3. Keep bodies evidence-dense; they already hold the audience.
4. Aim for a looping ending: both videos with a loop-friendly end exceeded 100% average viewed.
5. Judge the batch against Studio's swipe-away rate by hand, because this API cannot report it.
