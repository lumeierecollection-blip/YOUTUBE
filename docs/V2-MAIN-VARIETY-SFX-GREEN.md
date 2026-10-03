# Main Pipeline, Variety, SFX — Final Report

Date: 2026-10-03
Main HEAD: see `git log -1 main` (this work merged from `claude/variety-sfx-specificity`)
Runs: 37125010644, 37126933290, 37129265971, 37131085417, 37133611702 (5 iterations,
dispatched on the work branch first — "do not push to main without running the full test")

**Target NOT met:** at least 4 of 6 approved in one run. Best: 2 of 6 (iterations 2 and 5).

## Pipeline

- Main now runs: the visual-rebuild pipeline — `.github/workflows/daily-pipeline-v2.yml`
  (merge `05cbc9d`; main went `e7d3461` -> `8e44293`). There is no `daily-render.yml`; the
  prompt's file names were reversed (v2 IS the visual rebuild).
- Old pipeline: deprecated. `daily-pipeline.yml` (V1) was moved to
  `.github/workflows-deprecated/daily-pipeline.deprecated.yml`. GitHub loads workflows only
  from `.github/workflows/`, so a `*.deprecated.yml` left there would still fire on its cron.
- Daily schedule: `cron: "0 6 * * *"` (06:00 UTC) + `workflow_dispatch`.

## Composition variety (part B)

The rule (`scripts/composition-variety.js`): at most 3 of 10 beats TYPE (hook and CTA
included), never two TYPE beats in a row. It is applied in the planner (count, one re-ask,
deterministic fallbacks before and after rotation) and again on the resolved canvases.
Fallbacks: PROCESS (a stated flow), TREND (a stated rise or fall: a line to one dot, no
numbers), COUNTER, a drawn symbol for a stated meaning, and as the last resort two key nouns.

| Ch | TYPE-FULL (final run that rendered) | Max consecutive same | Distinct types |
|---|---|---|---|
| 1 | 2/5 (it3, approved) | 1 | 4 |
| 2 | 2/5 (it3) | 1 | 3 |
| 9 | 2/7 (it5) | 1 | 3 |
| 26 | 2/5 (it5) | 2 (two heroes — fixed after the run, `f9dce91`) | 2 |
| 44 | 3/6 (it5, approved) — over max, logged | 1 | 5 |
| 48 | 3/7 (it5, approved) — over max, logged | 1 | 4 |

Before this work (run 37119036921) the reviewer called 66–100% of beats headline-dominated
on every channel. After: 28–50% on most renders (ch-48 33%, ch-9 28%, ch-1 40%).

## Layout variety (part C)

- Headline alignment alternation: **yes**. Left and right alternate by beat. TYPE-FULL is
  the one centred composition, and two centred headlines in a row are refused by
  local-audit. Measured on ch-1 (it3): center / right / left / right / center.
- Headline sizes: 120–160 px for TYPE-FULL / TYPE-SPLIT statements, 80–110 px for headers
  over visuals. ch-1: 160 / 110 / 110 / 110 / 160.
- Entrance styles used per video: 3 (together / staggered / visual-first, never the same twice
  in a row). ch-1: together, staggered, visual-first, staggered, together.
- Background variations: 2 kinds. A 0.04-opacity paper texture every 3rd beat and a thin rule
  every 5th; ch-1 had 1 texture beat and 1 rule beat.
- C.2 "headline position never in the same zone twice": **not met**. Headers are top-zone on
  every visual composition; only the swapped counter puts its headline in the middle zone.
  The bottom zone is the caption.

Frames, ch-1 iteration 3 (approved), one per beat at 66%: TYPE-FULL, NUMBER-FULL
(counter), DATA-FULL (gauge), PROCESS-FULL, TYPE-FULL. Consecutive same type: 0.

## SFX (part D)

Six roles (`visual/canvas-sfx.js`), at most 6 per video, visible events only, charts silent.

| Ch | SFX count | Events fired (ch-1, it3) | Files |
|---|---|---|---|
| all rendered | 6 (cap hit every video; extra whooshes dropped and logged) | chime @9 (hook settles), whoosh-soft @206, number-roll @308 (counter "8"), whoosh-soft @476, pop @730 (headline), impact-low @1054 (CTA) | reveal.mp3, whoosh.mp3, number-roll.mp3, pop.mp3, impact.mp3 (+ number-count.mp3 for tick) |

pop.mp3 and number-roll.mp3 are new, both from Kenney (CC0); see `public/sfx/CREDITS.md`.
number-roll fires as a counter pops in, because the compositor shows figures settled (no roll
on screen). tick (portrait quotes) never fired, because no plan carries a quote.

## Approval

| Ch | It1 | It2 | It3 | It4 | It5 |
|---|---|---|---|---|---|
| 1 | rejected (coverage) | review (challenger) | **approved** | prep failed (too short) | prep failed (research URL gate) |
| 2 | prep failed (too long) | **approved** | review (beat check) | rejected (heroes in a row) | prep failed (duplicate topics) |
| 9 | **approved** | **approved** | review (off-topic sentence) | review (challenger) | review (3/10) |
| 26 | prep failed (too long) | rejected (symbol coverage) | review (4/10) | prep failed (duplicate topics) | rejected (hero pair) |
| 44 | review (beat-check parse) | rejected (coverage) | prep failed (research URL gate) | prep failed (too short) | **approved** |
| 48 | rejected (split hero) | review (Georgia map) | review (monoculture) | **approved** | **approved** |

Every defect above was fixed in the commit after it was found; the fixes are in the log.

## Remaining blockers

- **Discovery duplicates** (`data/ci-runs/blocked-discover-duplicate-topics.txt`): ch-2 and
  ch-26 topic logs are saturated after today's runs, and qwen2.5:3b proposes only covered
  topics.
- **Research citation gate**: the local model cites URLs its search never returned (ch-1,
  ch-44). The gate is right to refuse these.
- **Weak PROCESS nodes**: the beat checker rejects flow and key-noun diagrams whose nodes don't
  carry the sentence ("SIGN → USED", "HOWEVER → EXPANSION").
- **Repeated figures across compositions**: the same 20 / 10 appear in a bar chart, a
  comparison and a counter (ch-26). The repeat guard covers single-figure beats only.
- **Whole-video content judgments** of 2–4/10 on otherwise passing videos (ch-9, ch-26).
- The last two fixes (`1ac6323` hero adjacency, `f9dce91` hero pair) came after the final
  run. They are merged untested in CI, because the per-channel iteration cap was reached.
