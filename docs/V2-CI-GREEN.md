# V2 CI Green Run — 6 Channels, QA on
Date: 2026-09-27
Branch: claude/visual-rebuild-from-5f91e75
HEAD: 1ae6efb (fix(qa,plan): parse fenced beat-check JSON; primitive kind in library_shape name)

Supersedes the 2026-09-23 record (run 35847628790, HEAD 3e96e96 — still in
this file's git history). That run was green with **QA off** (`--skip-qa`).
This one is green with the challenger, the per-beat frame check and the
Gemini review/correction loop all running on every video.

## Run
- URL: https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36331165614
- Run ID: 36331165614
- Mode: `dry_run=true` — rendered and verified, **not published**
- Duration: 22m29s (15:52:47 → 16:15:16 UTC)
- Iterations this session: 6 (runs 36323786443, 36325040366, 36326675679,
  36328141701, 36329825213, 36331165614)
- Conclusion: `success` — setup, 6/6 prep, 6/6 render, log-results;
  self-heal skipped

## Per-channel results

Measured from the run's own log and its `rendered-<ch>-36331165614` artifacts.
Every channel used 3/3 correction attempts (see "Where the guarantees stop");
the beat-check column lists attempts 1, 2, 3 — the shipped video is attempt 3.

| Ch | MP4 size | Video dur | Audio dur | Drift | Plan source | Beat check (att. 1,2,3) | Comps dropped | Frame-0 | Silence gate | Whole-video review | Pass |
|----|----------|-----------|-----------|-------|-------------|------|---|---------|---|------|------|
| 1  | 1,899 KB | 46.44s | 46.46s | 0.02s | Gemini | 7/7, 7/7, 7/7 | 0 | 41.1 KB | 7/7 pauses, 0 unmatched | 3/10 | ✓ |
| 2  | 1,287 KB | 38.66s | 38.64s | 0.02s | Gemini | 5/5, 5/5, 4/5 | 1 | 56.5 KB | 4/4, 0 unmatched | 3/10 | ✓ |
| 9  | 1,769 KB | 47.32s | 47.35s | 0.03s | Gemini | 5/5, 5/5, 5/5 | 1 | 51.4 KB | 5/5, 0 unmatched | 2/10 | ✓ |
| 26 | 1,685 KB | 52.78s | 52.80s | 0.02s | Gemini | 6/6, 6/6, 6/6 | 0 | 42.7 KB | 6/6, 0 unmatched | 2/10 | ✓ |
| 44 | 2,033 KB | 42.82s | 42.82s | 0.00s | Gemini | 6/6, 6/6, 6/6 | 0 | 50.1 KB | 2/2, 0 unmatched | 3/10 | ✓ |
| 48 | 2,282 KB | 55.08s | 55.08s | 0.00s | Gemini | 9/9, 8/9, 8/9 | 2 | 46.2 KB | 9/9, 0 unmatched | 2/10 | ✓ |

## Log defects
Over the complete log (20,521 lines):
`No visual plan loaded` 0 · `regex fallback` 0 · `no physical mechanism` 0 ·
`empty-frame` 0 · `not in allowed` 0 · `composition rejected` 0 ·
`_currentValue` 0 · `probe failed` 0 · `skip-qa` 0.

`MODULE_NOT_FOUND` 18 — every one is `scripts/local-visual-auditor.js`
(see below). It fails safe: with no local report, render-and-qa.js runs the
Gemini review instead of skipping it.

## Frames actually looked at
`docs/v2-ci-green-36331165614-frames.png` — 3 frames per channel (30%, 55%,
80% of runtime) extracted from the downloaded artifacts, ch 1, 2, 9 (top),
26, 44, 48 (bottom). What they show:
- No blank/black frames; text legible; each channel in its own
  `channels.json` palette; each frame carries a real drawing tied to its
  sentence (courthouse column, calendar grid, gauge, document, figures).
- **The visuals are weak.** Everything is abstract diagram language —
  grids, bars, blocks, labels — confined to a square panel with large empty
  areas above and below in the 9:16 frame. This matches the Gemini
  whole-video review, which scored every video 2–3/10 (template
  monoculture, dead space, "abstract graphical slop").

## Where the guarantees stop — read before trusting the table
- **Green means the repo's HARD gates passed, not that the videos are good.**
  The hard gates are the objective frame audit, the per-beat check, the
  challenger, the silence gate and duration drift. The Gemini whole-video
  verdict is deliberately NOT a hard gate (render-and-qa.js:805-820): it
  drives up to 3 correction attempts, then a frame-audit-clean video ships.
  All six hit 3/3 attempts and shipped with a failing review.
- **`pipelineVerdict` is never computed on this branch.** Every "Gemini
  verdict (attempt N)" logs UNKNOWN. main's gemini-frame-review.js computes
  APPROVED / NEEDS_IMPROVEMENT / REJECTED (incl. a CONTENT_FACTUAL hard
  reject for fabricated on-screen content, via a plan-compliance review that
  this branch also lacks). Effect here: the correction loop can never exit
  early on APPROVED, and there is no fabricated-content check at the video
  stage. Note that even on main, a REJECTED video ships once retries run out.
- **`scripts/local-visual-auditor.js` is missing on this branch** (exists
  only on main). render-and-qa.js calls it on every QA pass.
- **The beat check tolerates one NO** (`failing.length > 1` fails). Ch-2
  attempt 3 (4/5) and ch-48 attempts 2-3 (8/9) passed with one mismatched beat.
- **The beat check is noisy.** Across the session, near-identical renders
  flipped between 1/5 and 5/5 NO. A green run is partly luck until the
  planner stops producing abstract beats.
- **Compositions still drop at plan time** (4 in this run): an invented
  drawing name ("lease agreement"), unknown motions ("accumulate"), and map
  labels that are not a country/state name. Those beats render their
  generic mechanism scene.
- **Not published.** YouTube OAuth is still blocked
  (`data/ci-runs/blocked-youtube-oauth.txt`).
- **Model quality.** Prep runs `qwen2.5:3b` locally; ch-1 research failed
  4 of 6 iterations on citation formatting before passing in the last two.
