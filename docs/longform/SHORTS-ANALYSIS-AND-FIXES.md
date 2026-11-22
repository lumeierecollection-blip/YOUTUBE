# Shorts analytics: what went wrong, and the fixes applied

Data: YouTube Analytics retention report for channels 01 (Hidden Past) and 02 (AI Tested), pulled 2026-11-13 from the `retention-report` workflow (run 43498856278, read-only). Raw files: `docs/longform/analytics-2026-11-13/`. The Shorts swipe-away rate is not in the API (Studio only), so "hook" losses below are measured from the retention curve, not from swipe rate.

## What the numbers say

| | Hidden Past | AI Tested |
|---|---|---|
| Videos listed (latest 30) | 30 | 30 |
| Public | **8** | 9 |
| Still private | **22** | 21 |
| Views, all public videos | **532** (median 46, best 265) | **6,238** (median 524, best 1,612) |
| Titles ending in "..." (truncated) | **14 of 30** | 3 of 30 |

1. **Hidden Past barely had an audience to lose.** 22 of its last 30 uploads never went public, so they have 0-1 views by construction. Of the 8 public ones the best got 265 views; four got 5, 6, 13 and 23. Why 22 stayed private is not determined from here (uploads go private first and flip public after a delay; `config/upload-approval.json` shows entries sitting at `"privacy": "private"`). It is listed under open issues.
2. **The bridge (seconds ~3 to ~11) is where AI Tested viewers leave.** It was the weakest of the four parts in 6 of 8 AI Tested Shorts with a curve, losing 33-54% of viewers (up to 7.7% per second). The hook (0-3 s) lost 13-32%.
3. **Best performers**: "We Told AI It Was Wrong. It Didn't Budge." (39 s, 1,612 views, 86% average viewed), "Will AI Say 'I Don't Know'?" (23 s, 1,253 views, 107% average viewed, 80% still watching at the end), "AI Knew the Answer. Then We Said It Was Wrong." (1,255 views). All three are a conflict or a question about whether to trust AI. Worst retention: "We Clicked Every Link AI Gave Us" (32% at the end, bridge lost 51%) and "Can You Trust AI With Your Data" (bridge lost 54%).
4. **Hidden Past public videos** also lose most in the bridge (Clitherow: bridge lost 52%, 26% still watching at the end; Teeth: bridge lost 56%). The Escobar one lost 30% in the first 3 s.
5. **Titles**: 14 of 30 Hidden Past titles are cut off with "..." and read like news headlines ("The discovery of 131 cuneiform tablets at Kayalipinar in central Turkey provides a direct"). One headline was uploaded three times.
6. Subscribers gained: 0-3 per video. The Shorts do not convert viewers into subscribers.

Limits of this analysis: small numbers (most public videos under 300 views), no swipe-away rate, no click-through rate, and "average viewed" over 100% means looping/replays.

## What follows from this (decided 2026-11-13)

The owner's instruction: keep the Shorts exactly as the existing Shorts system makes them (their own compositions, voice and sound), and make the long-form videos a separate thing. A first attempt at a vertical cut-down of the long-form (a 16:9 scene over a blurred copy of itself, with burned-in captions) was built, looked at, and **dropped**; it is not used and its script was deleted (it stays in git history, commit 3e4beb5f).

So the analytics become **script-level rules for the next Shorts written in the existing system**, not format changes:
- Open on the result or the question in the first sentence; do not open with the set-up ("we tested...", "here is how the test worked"). The hook lost 13-32% and the bridge (seconds 3-11) lost 33-54% on AI Tested.
- Put the first new fact or twist inside the first 8 seconds, so the bridge is not a restatement.
- 23-39 s worked best (the owner's 35-40 s rule stays).
- Titles 60 characters or fewer, never truncated, a claim or a question; no news-headline titles for Hidden Past.
- Topics: about whether or how far to trust AI (AI Tested) and stories with a question in them (Hidden Past).

None of this is tested on an audience yet.

## Open issues for the owner (outside the video files)

1. Why 22 of 30 Hidden Past uploads stayed private: check the publish queue and delay logic, and `stay_private`, for channel 01.
2. Hidden Past topics written as news headlines performed worst; story-style topics with a question are closer to what worked for AI Tested.
