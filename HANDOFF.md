# HANDOFF

Read this first, then `FIXES.md` (the grouped, ranked list of causes).

## Hash at stop
`HEAD == origin/main == 369f3a27`, tree clean, both directions empty.
Suite 794/0. Workflow YAML parses.

## CRON: ON — next run 06:00 UTC daily
Enabled in `369f3a27`. The old "held until most channels are green" comment is
replaced; the trigger is uncommented.

**No run id yet.** GitHub only shows a scheduled run after it is queued near its
wall-clock time, so there is nothing to report until roughly 06:00 UTC. Check
`gh run list --workflow daily-pipeline-v2.yml` after that.

## Videos uploaded today
**None.** No test run was dispatched before context ran out. See Job 4 below —
this is the outstanding action, not a skipped one.

## THE BIG FINDING: the publish path already exists

`review-publish` (line ~1410) **already uploads `approved-review/` as PRIVATE**.
Line ~1435 logs:

```
Publishing approved-review videos of run <id> for channel(s) <ids> (private)
```

So Job 1 of the brief was already implemented. What was missing was only that
nothing ever reached `approved-review`, and that nothing invoked it. **No upload
code had to be written, and none was.** The commit changes the schedule trigger and
the comment; it does not touch the upload path, the gates, the render path, or
what lands in which queue.

To upload after a render run, dispatch with:

```
gh workflow run daily-pipeline-v2.yml --ref main \
  -f channels="26" -f publish=true -f review_run_id=<numeric run id>
```

It requires `review_run_id` (numeric) and `ref == main`.

## BLOCKER: OAuth is missing for 5 of the 10 priority channels

`review-publish` wires `secrets.CHANNEL_{05,06,08,10,49}_*`. Those secrets **do not
exist** in the repository.

| Channel | OAuth wired | Secret present | Can upload |
|---|---|---|---|
| 01 | yes | yes | yes |
| 02 | yes | yes | yes |
| 09 | yes | yes | yes |
| 26 | yes | yes | yes |
| 44 | yes | yes | yes |
| 05, 06, 08, 10, 49 | yes | **NO** | **no** |

Secrets present in the repo that the workflow does not use for these channels:
03, 04, 07, 48.

**This is an owner action — refresh tokens cannot be created from the repo.** Until
they are added, only channels 01, 02, 09, 26 and 44 can upload. Of those, only
**ch-44 and ch-8 reached `approved-review`** in recent runs, and ch-8 cannot upload.

So the realistic first morning: **ch-44 only.**

## NOT DONE — Job 4, the test run
Not dispatched. It needs a render run to produce a `review_run_id`, and context ran
out. The sequence for the next session:

1. `gh workflow run daily-pipeline-v2.yml --ref main -f dry_run=true -f channels="44"` → wait.
2. If it lands in `approved-review/`, dispatch:
   `-f channels="44" -f publish=true -f review_run_id=<id from step 1>`
3. Report the video id and `https://studio.youtube.com/video/<id>/edit`.

## NOT DONE — Job 2, the daily digest
`data/uploaded/YYYY-MM-DD.json` with channel, title, video id, Studio link and
source queue. **Not built.** It should be written by `review-publish` after a
successful upload, and committed by that job. Nothing in the repo produces it yet.

## Channel state
`Approved: 0` everywhere. No video has ever entered `approved/` — verified with
`git ls-tree`. Two channels reach `approved-review` (ch-8, ch-44).

## Causes still open (`FIXES.md`)
- **A date with no YEAR can never be covered** — 2 channels, one line.
  `entity-coverage.js:140` requires a four-digit year:
  `const y = (e.name.match(/(?:1[89]|20)\d{2}/) || [])[0];`
  "November 12" and "June 25" have none, so both guards fail and a date that IS
  drawn is reported as not drawn. Match the entity's own month/day text when it
  carries no year — do NOT just drop the guard, or "November 12" beside an
  unrelated figure would pass. Re-run 8, 10.
- **Plan contradicts its sentence** — challenger beat MISMATCH/CONTRADICTION:
  ch-8 beat 0, ch-44 beat 5, plus ch-9, ch-49. 4 channels.
- **naming-check** — ch-44 beat 2.
- **ch-2** — `canvas-type`, TYPE-FULL+NAME twice in a row.
- Causes 5–7 are fixed but unrendered (`67d17bb3`, `73ab2fba`, `68d3c086`, `70dcbd7c`).
- Cause 8 (unit dropped from a number) diagnosed, open.
- Causes 9–11 (rounded flag corners / grid off-axis / no camera move) open.

## Method
- The ladder↔coverage "invariant" was not broken where assumed. `directiveFor()` and
  `coverageOf()` agreed for every type; the wrong rung came from a different
  writer, found by grepping who writes `art.kind`.
- Fixtures built from a real board case pass; invented generalizations failed and
  were dropped rather than adjusted until green.
- A green suite is not a frame, and a passing gate on a channel that re-picked its
  topic means nothing — confirm the beat you fixed is the beat the run drew.