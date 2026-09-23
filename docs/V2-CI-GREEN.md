# V2 CI Green Run — 6 Channels
Date: 2026-09-23
Branch: claude/visual-rebuild-from-5f91e75
HEAD: 3e96e96 (fix(research): fresh seed per retry; domain feedback names the available sites)

## Run
- URL: https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/35847628790
- Run ID: 35847628790
- Mode: `dry_run=true` — rendered and verified, **not published** (see "Not yet done")
- Duration: 18m07s (10:14:22 → 10:32:29 UTC)
- Attempts: 16 full-pipeline iterations + 2 render-only debug runs
- Conclusion: `success` — setup, 6/6 prep, 6/6 render, log-results; self-heal skipped (nothing failed)

## Per-channel results

Measured from the run's own logs and its `rendered-<ch>-35847628790` artifacts.

| Ch | MP4 size | Video dur | Audio dur | Drift | Plan source | TYPO | Max mech | Frame-0 | Pass |
|----|----------|-----------|-----------|-------|-------------|------|----------|---------|------|
| 1  | 951 KB   | 31.59s | 31.61s | 0.01s | local  | 2 | 25% | 41.6 KB | ✓ |
| 2  | 1,641 KB | 56.19s | 56.21s | 0.02s | Gemini | 1 | 17% | 51.9 KB | ✓ |
| 9  | 1,091 KB | 36.82s | 36.82s | 0.01s | Gemini | 1 | 17% | 41.3 KB | ✓ |
| 26 | 1,412 KB | 48.55s | 48.55s | 0.00s | Gemini | 1 | 29% | 45.0 KB | ✓ |
| 44 | 1,641 KB | 55.19s | 55.20s | 0.01s | Gemini | 1 | 14% | 44.9 KB | ✓ |
| 48 | 1,755 KB | 53.72s | 53.74s | 0.02s | local  | 2 | 33% | 29.6 KB | ✓ |

Every channel also passed the silence gate with 0 unmatched gaps (every pause
in the video matches a pause in the source voiceover).

"local" = Gemini's plan call failed (quota/format) and the rule-based
`scripts/local-visual-plan.cjs` planned the video; this is logged in the run.

## Log defects
- Zero across all checks, over the complete logs of all 15 jobs (13,809 lines):
  `no physical mechanism` 0 · `No visual plan loaded` 0 · `empty-frame` 0 ·
  `not in allowed` 0 · `regex fallback` 0 · `_currentValue` 0 ·
  `composition rejected` 0.

## Where the guarantees stop — read before trusting the table
- **Gemini compositions dropped at plan time.** On the four Gemini-planned
  channels most of Gemini's composed scenes still failed validation after
  synonym mapping, and were removed at plan time with the reason recorded on
  the beat (`composition_dropped`) and counted in the plan
  (`compositionsDropped`): ch-2 5, ch-9 4, ch-26 1, ch-44 6. Those beats
  render the director's mechanism scenes. This is a plan-time decision, not a
  render-time fallback — but it means Gemini's richer compositions mostly
  are not on screen yet.
- **Sentence trimming.** A Short whose measured voiceover runs over 58s has
  whole sentences deleted (`scripts/fit-short.js` — hook and payoff kept,
  nothing added or reworded) before it is re-gated and re-measured.
- **Script beat gates are scoped.** SCR-03/04/05/06/07/15 do not apply to
  DirectedShorts channels (CHECK-REGISTER.md 3.10.3, decided by the user).
- **Model quality.** Prep runs `qwen2.5:3b` locally (user's decision after
  7B could not fit the budget on CPU runners). Topics and scripts are
  grounded and gated, but visibly weaker: ch-2's slug degenerated to
  `traffic-stop-scripts-now-now-now-…`, and some topics echo a content
  pillar rather than a specific story.
- **Frame check covers beat 0 only**, as specified; other beats are not
  size-checked.

## Self-heal
- Triggered: yes, on every failing iteration; it now reads the failed jobs'
  logs, classifies them, and writes `data/ci-runs/blocked-<class>.txt`.
- Files changed by self-heal: none. No automatic fixer exists
  (see the header of `scripts/self-heal.cjs`); every fix in this loop was
  made by hand from the logs.

## Not yet done
- **Uploads — blocked on OAuth.** The publishing run
  ([35852731846](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/35852731846),
  `dry_run=false`, all six channels set to `stay_private: true` first)
  passed 6/6 prep and 6/6 render with every gate green, then every upload
  failed with `invalid_grant — Token has been expired or revoked`. Nothing
  was uploaded. All six refresh tokens were set 2026-09-14; Google expires
  refresh tokens after 7 days for OAuth apps in "Testing" status. Details
  and the fix: `data/ci-runs/blocked-youtube-oauth.txt`.
- **Replacing `main`.** Per the owner's decision, `main` is replaced with
  this branch only after green; that is a separate step.

## What the human must verify
- Open each of the six private uploads on YouTube (after the publishing run).
- Confirm: white background (ch-1, ch-9, ch-44 are `bg_mode: white`; ch-2,
  ch-26, ch-48 are `black`), distinct beats, the typography hook works, and
  narration is audible for the full video.
- **Auto-public timing — check before publishing.** Each upload is queued to
  go public at upload time + `publish_delay_hours`
  (`src/skills/youtube-publish/run.js`), and the `process-queue` step of
  any later workflow run flips due entries public. In `config/channels.json`
  none of the six channels sets `publish_delay_hours` (default: **1 hour**);
  only ch-1 sets `stay_private: true`. So uploads on ch-2, 9, 26, 44 and 48
  go public at the first workflow run that starts an hour or more after
  upload (for example the next 06:00 UTC cron once this is on `main`). If
  every video must be reviewed first, set `stay_private: true` or a longer
  `publish_delay_hours` on those channels before the publishing run.
- If good: flip to public.
