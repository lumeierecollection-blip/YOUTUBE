# Creative direction + QA overhaul — changelog, 2026-10-22 (session 2)

Branch `feat/cdqa-integration` = `feat/cdqa-coverage` (audit, reference analysis, scene briefs,
QA building blocks, job state, agents/skills — see `docs/AUDIT-2026-10-22.md`) plus three
parallel branches, each built in its own worktree with file ownership, verified on GitHub
Actions, then integrated. Not merged to main.

| Branch | What | Evidence |
|---|---|---|
| `feat/cdqa-direction-wire` | planner prompt trimmed back under the owner's 4,500-token budget (strict block from `7fc35824` had pushed ch-2 to 4,667; budget unchanged, origin/main fails the same test); per-channel REFERENCE DIRECTION section (measured pacing + evidenced vision observations, cited `fNNN@t`, colour excluded, capped 720 chars) in the planner; critic reference images **opt-in** via `REVIEW_REFERENCE_IMAGES=1` (owner's 2026-09-29 decision stands by default); scene briefs justify composition against narration + reference, flag evidence URLs missing from `sources_used` | tests 39816705916 (1092/0) |
| (same) | ref-01 vision analysis committed from qa-proof run 39816705908 (status complete, 45 frames, 17-scene storyboard), checked by hand against `contact-01.jpg`. ref-02/03 and ch-05/06/08/10 references are still measured-only | — |
| `feat/cdqa-pipeline-jobs` | per-channel prep→render via reusable `channel-pipeline.yml` (render waits only for its own prep); publish is a separate capability check (`scripts/jobs/publish-gate.mjs`): missing/rejected OAuth → green skip with reason in `data/publish-status/`, job record and digest; bounded OAuth-exchange retry (`scripts/jobs/retry.mjs`); `no_push` dispatch input; review-publish bash syntax bug (exit 2 in main run 39790127811) fixed by moving the digest to `scripts/jobs/digest.mjs` | tests 39817200497 (1104/0 node tests); dispatch 39817297912 below |
| `feat/cdqa-qa-loop` | `runProductionQa` wired into `render-and-qa.js` (`QA_LOOP=off|advisory|enforce`, default **advisory**); objective checks + per-beat canvas defects; single-beat plan repairs (canvas-fit, pop-transitions, missing-media, entity-coverage), SRT clamp, true-peak limiter; budgets `QA_MAX_ATTEMPTS`/`QA_MAX_MS`/`QA_MAX_COST_UNITS`; best-attempt keep; regression test that repairing beat N leaves other beats byte-identical; vision recorded `not_run` | tests 39827200044 (1129/0); qa-proof 39819712458 |

## Real runs on GitHub

- **Dispatch 39817297912** (`channels=1 dry_run no_push`, branch): discover → research → script → TTS →
  render (40.9 s, 810x1440 from the existing `RENDER_SCALE`) all ran in the new per-channel structure.
  Render was **rejected** at camera-check ("no real camera move: beats 0, 1"), queued approved-review;
  publish skipped with reason "not on main". Orchestrator's own frame inspection: 3/7 beats are name-only
  type cards, the Bayeux Tapestry itself never appears, one photo is small in a frame, a pull phrase is
  truncated. The rejection was right.
- **qa-proof 39819712458** (`QA_LOOP=enforce`, ch-4 Great Fire of London, 1080x1920, 43 s): the loop
  passed on attempt 1 with 0 objective defects, so **no repair has yet run on a real render**. Inspected
  frames still show defects the objective/canvas checks do not catch: plaque photo cropped at the right edge
  (20.9-21.2 s), chest cutout clipped (18.4-18.7 s), ~10 s of a lone "13,200" (29-39.7 s), generic
  abstract labels ("RESILIENCE", "CRISIS"). The later naming gate rejected attempt 2 ("CIT,,").

## Known limits (not papered over)

- Enforce mode has no real-render repair to its name yet; production default stays advisory.
- camera-check is not repairable: the move size is a renderer constant
  (`canvas-layout.js:903 CAMERA.photo/graph`); needs a per-beat override first.
- Cutout/photo edge clipping and long near-static beats are caught only by vision gates, not objective checks.
- Only ref-01 has a vision analysis; other references give measured pacing only.
- No live-model log yet of the planner prompt with the reference section attached.
