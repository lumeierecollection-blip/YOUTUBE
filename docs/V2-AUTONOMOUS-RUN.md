# Autonomous Run Report

Date: 2026-09-27
Branch: claude/visual-rebuild-from-5f91e75
HEAD: see the commit that adds this file (last code change: 1ae6efb)
Iterations: 6
Started: 2026-09-27T13:50:24Z (first trigger, run 36323786443)
Ended: 2026-09-27T16:15:16Z (green run 36331165614 completed)

## Outcome

**GREEN** — all six channels, dry run, QA on, zero forbidden log lines.
Green under the repo's hard gates; the videos themselves are visually weak
(every Gemini whole-video review 2–3/10). Details: `docs/V2-CI-GREEN.md`.

## Green run

URL: https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36331165614
Run ID: 36331165614
Duration: 22m29s

## Per-channel results

| Ch | Drift | Beat check (att. 1,2,3) | Silence gate | Whole-video review | Pass |
|----|-------|------|------|------|------|
| 1  | 0.02s | 7/7, 7/7, 7/7 | 0 unmatched | 3/10 | ✓ |
| 2  | 0.02s | 5/5, 5/5, 4/5 | 0 unmatched | 3/10 | ✓ |
| 9  | 0.03s | 5/5, 5/5, 5/5 | 0 unmatched | 2/10 | ✓ |
| 26 | 0.02s | 6/6, 6/6, 6/6 | 0 unmatched | 2/10 | ✓ |
| 44 | 0.00s | 6/6, 6/6, 6/6 | 0 unmatched | 3/10 | ✓ |
| 48 | 0.00s | 9/9, 8/9, 8/9 | 0 unmatched | 2/10 | ✓ |

Frames looked at: `docs/v2-ci-green-36331165614-frames.png`.

## Iteration history

| # | Run | HEAD | Prep | Render | What it showed |
|---|-----|------|------|--------|----------------|
| 1 | 36323786443 | 8057e6d | 5/6 | 0/6 | no 503s; plan JSON bad key (ch-2), curl timeout (ch-26), video-review probe bug (ch-9), abstract beats (44, 48) |
| 2 | 36325040366 | a542a8f | 5/6 | 0/6 | plans all parse; probe bug sent passing renders into re-renders that then failed the beat check |
| 3 | 36326675679 | 2666ad5 | 5/6 | 2/6 | 26, 48 pass; beat check timeout (ch-2); hyphenated drawing names dropping compositions |
| 4 | 36328141701 | 39ea337 | 5/6 | 2/6 | 44, 48 pass; ch-1 multi-id citation; ch-9 fenced beat-check JSON and `name:"field"` |
| 5 | 36329825213 | b71c60b | 6/6 | 5/6 | only ch-44 failed — genuinely abstract beats (5/6 NO), no bug |
| 6 | 36331165614 | 1ae6efb | 6/6 | 6/6 | **green** |

## Blockers

| File | Category | Status | Human action needed |
|------|----------|--------|---------------------|
| data/ci-runs/blocked-youtube-oauth.txt | publish | still blocking | Re-authorize the 6 channels (`scripts/oauth-setup.js` on main) and set the OAuth consent screen to "In production" |
| data/ci-runs/blocked-research-citation-quality.txt | research | partly fixed; ch-1 passed last 2 runs | Decide on a stronger research model than qwen2.5:3b |
| data/ci-runs/blocked-gemini-503-upstream-availability.txt | Gemini capacity | not recurring today | Decide whether VISION_MODEL gets a fallback model |
| data/ci-runs/blocked-prep-model.txt | prep model | unchanged (pre-existing) | — (superseded by the qwen2.5:3b decision) |

## Commits made

```
1ae6efb fix(qa,plan): parse fenced beat-check JSON; primitive kind in library_shape name
b71c60b fix(research): say "one id per source_url" when several are crammed in one
e289f95 fix(plan): tell the planner which primitives take "count"
f7966f1 fix(plan): accept hyphenated library_shape names; render the validated scene
39ea337 fix(qa): beat check — retry once on a Gemini transport failure
2666ad5 fix(research): accept "<url>/S<n>" citations only when url and id agree
5379f61 fix(qa): video-review.js — parse --manifest instead of treating it as the video
a542a8f fix(qa): plan-invalid — repair object keys missing their opening quote
```
Plus the docs commit that adds this report. No check was loosened or
skipped: every fix either repairs a parse/argument bug, retries a transport
failure, canonicalises an identifier that already existed, or improves
retry feedback. Grounding rules and gate thresholds are unchanged.

## Findings the loop deliberately did not change (need a decision)

1. **Failing Gemini reviews still ship.** By design (render-and-qa.js:805-820)
   the whole-video verdict drives 3 correction attempts, then a
   frame-audit-clean video ships. All six green videos shipped with 2–3/10.
   Same policy on main.
2. **This branch lost QA pieces that main has:** `pipelineVerdict` (logs
   UNKNOWN every time), the plan-compliance review with its CONTENT_FACTUAL
   hard reject for fabricated on-screen content, and
   `scripts/local-visual-auditor.js` (MODULE_NOT_FOUND on every QA pass;
   fails safe to the Gemini review). Porting them is a feature merge, not a
   loop fix — and restoring the auditor would let low-risk videos skip the
   Gemini review.
3. **The beat check tolerates one NO per video**, and its verdicts are noisy
   between near-identical renders.
4. **Visual quality is the real remaining gap:** abstract grids/bars/blocks
   in a square panel with large dead space in the 9:16 frame.

## Process notes

- A peer session ("Visual pipeline QA loop" [7305fd]) had pushed 102 commits
  to this branch and paused on 2026-09-24. It was sent a stand-down message
  (cloud session, delivery not confirmable); it pushed nothing during this run.
- Mid-run, Claude Code killed the background run-watcher for low memory;
  the loop paused until the user freed memory, then continued with
  foreground status checks only.

## What the human must do next

1. Re-authorize YouTube OAuth for channels 1, 2, 9, 26, 44, 48 and publish
   the consent screen, then run daily-pipeline-v2.yml with `dry_run=false`.
2. Decide findings 1–2: whether a failing whole-video review may ship, and
   whether to port `pipelineVerdict` / plan-compliance / the local auditor
   from main.
3. Look at `docs/v2-ci-green-36331165614-frames.png` and decide whether this
   visual quality is acceptable for private uploads before merging anything
   to main.
4. Decide the research model (see blocked-research-citation-quality.txt).
