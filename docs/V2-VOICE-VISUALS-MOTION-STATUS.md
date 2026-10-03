# Voice / Visuals / Motion — STATUS (not green)

Date: 2026-10-03
Runs: 2, which is the cap. Run 1 was 37141128792 at 27fa1b8. Run 2 was 37143472688 at 542b7f9.
Channels: 1, 2, 9, 26, 44, 48.

**Result: 0 of 6 approved in the final run.** The spec says that when the second run also
fails, the next step is this STATUS doc, not GREEN. No third run was made.

## Pipelines

| Workflow | State |
|---|---|
| `.github/workflows/daily-pipeline-v2.yml` | **Active.** This is the current pipeline: cron `0 6 * * *`, which fires on main only. |
| review-publish (moved to `.github/workflows-deprecated/review-publish.deprecated.yml`) | Deprecated: job `if: false`, disabled on GitHub (id 334402508), no schedule. |
| Network Policy Check | Disabled on GitHub (id 339763547). |
| V1 daily pipeline (`.github/workflows-deprecated/daily-pipeline.deprecated.yml`) | Deprecated. It was outside `.github/workflows`, so GitHub never ran it, but its YAML still declared `cron: "0 6 * * *"`; that schedule was removed in this commit. |

No deprecated workflow has a schedule. `gh workflow list --all` shows only "Daily Pipeline —
Optimized v2" as active.

## Final run, per channel

| Ch | Outcome | Why |
|---|---|---|
| 1 | **rejected** | `middle-zone-filled`: TYPE-SPLIT beats 3 and 7 fill 12% and 11% of the middle zone (minimum 15%). |
| 2 | approved-review (not uploaded) | The challenger rejected the plan twice (`beat 2 CONTRADICTION, beat 4 CONTRADICTION`); the plan repair replaced 0 of 4. Local audit PASS (17/17). |
| 9 | prep failed | Topic discovery found only duplicate topics. |
| 26 | **rejected** | `canvas-coverage`: NUMBER-FULL beat 1 spans 58.9% of the frame height (minimum 60%). |
| 44 | approved-review (not uploaded) | beat-check: the frames for beats 2 and 4 do not match their sentences. Beat 2 is a PROCESS diagram whose nodes ("EXPECTED" → "SIGNIFICANT PART") are words from the sentence, not a cause and effect. Local audit PASS (17/17). |
| 48 | prep failed | SCR-14: a `sources_used` URL was not in the research, after 5 attempts. The gate was not loosened. |

## Script (Part B)

Every script failed the voice and/or narrative validators. The full per-beat table and all six
scripts are in `docs/V2-NARRATIVE-SCRIPT-GREEN.md`.

| Ch | Voice | Name-starts | Over 25 words |
|---|---|---|---|
| 1 | FAIL (3) | 1 | 0 |
| 2 | FAIL (5) | 0 | 0 |
| 9 (run 1) | PASS | 0 | 0 |
| 26 | FAIL (9) | **2** | 3 |
| 44 | FAIL (3) | 0 | 1 |
| 48 (run 1) | FAIL (1) | 0 | 1 |

ch-26 has two sentences that start with "Greg Lui". The validator flagged it, and the re-ask did
not fix it. The workflow logged it as blocked and carried on, as the narrative spec says to.
That does break the voice spec's "do not accept a script with a person's name at the start of
more than one sentence". ch-26 was rejected at the canvas audit, so it was never uploaded. But
the two specs conflict here: one says log it and continue, the other says never accept it.
The pipeline currently does the former.

## Visuals (Part C): what each beat showed (`[visual]` logs)

| Ch | Beats | Fetched PNG | Beats with no concept | Kinds |
|---|---|---|---|---|
| 1 | 8 | 1 (Elizabeth Warren portrait) | 2 | portrait, process, type, type, number, process, symbol (dollar sign), type |
| 2 | 7 | 1 (New York City photo) | 2 | map, type, process, type, process, photo, map |
| 26 | 5 | 0 | 0 | map, number, map, number, map |
| 44 | 5 | 0 | 2 | chart, type, process, type, chart |

The PNG fetch ran on every channel, and every beat has a visual element (`[resolve] starting PNG
fetch` appears in each log). Few PNGs survived because the cutout-quality gate rejected most
candidates. In ch-2, for example, objects covered 8.7% and 9.7% of the photo (minimum 12%),
and others were marked `quality=DIRTY`. The gate was not loosened. ch-1 has 4 of 8 beats on
TYPE-family layouts (one carries the dollar-sign symbol), which is over the 30% variety
target.

## Motion (Part D)

| Ch | `[motion]` |
|---|---|
| 1 | 8/8 beats with primary + secondary + micro motion |
| 2 | 7/7 |
| 26 | 5/5 |
| 44 | 5/5 |

The motion counts come from `visual/motion-plan.js`, which mirrors what `full-canvas.jsx`
renders. No frame of this run was inspected by eye. The local audit's pop-transitions check
passed on all four renders.

## Layout (Part E): `[layout]` logs

| Ch | Layouts | Headline sizes | Alignment |
|---|---|---|---|
| 1 | PORTRAIT, PROCESS, TYPE-FULL, TYPE-SPLIT, NUMBER, PROCESS, TYPE-FULL+HERO, TYPE-SPLIT | 140/96/104/88/110/96/104/88 | L/R alternating, 0 repeats |
| 2 | MAP, TYPE-FULL, PROCESS, TYPE-FULL, PROCESS, SCENE, MAP | 140/96/104/88/110/96/104 | 0 repeats (one centred statement) |
| 26 | MAP, NUMBER, MAP, NUMBER, MAP | 140/96/104/88/110 | 0 repeats |
| 44 | DATA, TYPE-FULL, PROCESS, TYPE-FULL, DATA | 112/96/104/88/110 (hero shrunk from 140 to fit) | 0 repeats |

Every channel had 0 consecutive same layouts. The code puts a texture on every 3rd beat (0.03)
and a gradient on every 5th (`backgroundOf` in canvas-layout.js). The run logs do not print
this, so it is the code's behaviour, not something observed in this run. SFX: 6 fired per
video, the cap.

## Specific failures and causes

1. **Script quality.** The script stage runs on `ollama/qwen2.5:3b`. It copies the prompt's
   example line, repeats sentences across beats and ignores the bans after one re-ask. This is
   the main blocker, and it is behind ch-2's and ch-44's review failures too: when a beat
   repeats the beat before it, there is nothing new to draw.
2. **ch-1 TYPE-SPLIT middle zone at 11–12%.** The run-1 fix (refit to at least 2 lines) was
   not enough. The cause was not verified: no frame was inspected, because the local render
   is off-limits (memory pressure).
3. **ch-26 NUMBER-FULL coverage at 58.9%.** This is unverified. It is likely the smaller
   non-hero headline tier (96 px) shortening the beat's vertical span.
4. **ch-9 duplicate topics and ch-48 SCR-14.** These are upstream gates working as intended.

## Deviations from the spec

- **E.1's extra arrangements were not built.** They conflicted with the zone and caption
  system.
- **`daily-pipeline-v2.yml` was kept active.** "Disable every old pipeline" was read as
  "every pipeline but the current one".
- **Disabling review-publish removes the manual publish path.** `approved-review` renders now
  have no one-click route to upload.

## Recommended next change

Route the script stage to Gemini. The planner already uses `src/lib/gemini-client.js` with
the CI keys; `scripts/ollama-agent.js` has no Gemini path. Then remove the verbatim re-hook
example from `prompts/write-script.md`. After that, look at the ch-1 and ch-26 canvas
failures against rendered frames. This was not done here because it would have shipped
untested to main after the two-run cap.
