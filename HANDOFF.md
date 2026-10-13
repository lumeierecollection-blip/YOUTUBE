# HANDOFF

Read this first, then `FIXES.md` (the grouped, ranked list of causes).

## Hash at stop
`HEAD == origin/main == 0b744f47`, tree clean, both directions empty.
Suite 802/0. Workflow YAML parses; the digest's embedded JS parses.

## Cron
**ON**, 06:00 UTC daily (enabled in `369f3a27`).

## Videos uploaded
**None yet.** No upload has been attempted — see Job 3 below.

## Credentials: which channels can upload
`review-publish` wires `CHANNEL_{01,02,05,06,08,09,10,26,44,49}_*`.

| Channel | Can upload |
|---|---|
| 01, 02, 09, 26, 44 | **yes** |
| 05, 06, 08, 10, 49 | **NO — secrets missing** |

Secrets present but unused by these channels: 03, 04, 07, 48.
**Owner action**: add `CHANNEL_05_*`, `CHANNEL_06_*`, `CHANNEL_08_*`,
`CHANNEL_10_*`, `CHANNEL_49_*` as `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`.

## Job 1 — yearless date fix: DONE, `7d8c483f` (unrendered)
`entity-coverage.js` required a four-digit year, so "November 12" and "June 25"
could never be matched even when drawn. With a year the year is still required;
without one the **month and the day** must both be present — the day alone would
match any figure carrying that number. `scripts/__tests__/yearless-date-coverage.test.js`
covers both real board cases plus the negatives.

## Job 2 — daily digest: DONE, `0b744f47` (unrendered)
`review-publish` now writes `data/uploaded/YYYY-MM-DD.json` after every publish
attempt — per video: channel, title, video id, privacy status, source queue, and
`https://studio.youtube.com/video/<id>/edit`. Written even when nothing uploads,
with `uploads: []` and a note naming the reason. Both steps are `if: always()`.
Derived from `data/publish-queue/`, so it reflects what was really uploaded.

## Job 3 — TEST RUN: BLOCKED, and the block is a gate, not credentials

Run `38469933382`, ch-44 only. It rendered, and landed in **`rejected`**:

```json
{ "channel": 44, "verdict": "rejected", "failed_stage": "canvas-checks",
  "failed_check": "canvas-type", "reason": "failed: canvas-type",
  "local_audit": ["canvas-type: beat 3: TYPE-FULL twice in a row"] }
```

So there was nothing in `approved-review/` to upload, and the publish step was
never invoked. **No video id, no Studio link** — I am not going to claim an upload
that did not happen.

### The exact command, when a channel does reach approved-review
```bash
gh workflow run daily-pipeline-v2.yml --ref main \
  -f channels="44" \
  -f publish=true \
  -f review_run_id=<numeric run id of the render run>
```
Requires `publish=true`, a numeric `review_run_id`, and `ref == main`. Ch-44 has
OAuth, so it is the right channel to prove the path on.

## The next cause: TYPE-FULL twice in a row — 2 channels

`canvas-type` refuses the same composition on adjacent beats — the same frame
twice, the same rule the plates-row fix enforces.

- ch-44 beat 3: `TYPE-FULL twice in a row` (just now)
- ch-2 beat 5: `TYPE-FULL+NAME twice in a row` (board `38411644598`)

`fix_67d17bb3`'s neighbour guard exists in the **entity ladder** for `plates` rows
(`entity-ladder.js`, "NOT A ROW, TWICE"). The same guard does **not** exist for the
composition choice — a beat can still be handed the same composition as its
neighbour. That is the class-level place to fix it, not two beats.

Re-run 44 and 2 after.

## Everything else still open
- **Plan contradicts its sentence** — challenger MISMATCH/CONTRADICTION: ch-8 beat 0,
  ch-44 beat 5, ch-9, ch-49. 4 channels.
- **naming-check** — ch-44 beat 2.
- Causes 5–7 fixed but unrendered (`67d17bb3`, `73ab2fba`, `68d3c086`, `70dcbd7c`).
- Cause 8 (unit dropped from a number) diagnosed, open.
- Causes 9–11 (rounded flag corners / grid off-axis / no camera move) open.

## Channel state
`Approved: 0` everywhere. No video has ever entered `approved/` — verified with
`git ls-tree`. ch-8 and ch-44 have reached `approved-review` in earlier runs.

## Method
- A green suite is not a frame. `7d8c483f` and `0b744f47` are both unrendered.
- Fixtures built from a real board case pass; invented generalizations failed and
  were dropped rather than adjusted until green.
- When a channel re-picks its topic between runs the previous fix is usually not
  exercised — confirm the beat you fixed is the beat the run drew.