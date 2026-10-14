# HANDOFF

Read this first, then `FIXES.md`.

## Hash at stop
`HEAD == origin/main == cba262bd`, tree clean, both directions empty. Suite 807/0.

## Cron
**ON**, 06:00 UTC daily (`369f3a27`).

## Uploads
**None.** `data/uploaded/YYYY-MM-DD.json` is produced by `review-publish`
(`0b744f47`) but has never run. Credentials: **01, 02, 09, 26, 44** can upload;
**05, 06, 08, 10, 49** need `CHANNEL_NN_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN`
(owner action).

---

# JOB 1 — DONE, `cba262bd` (unrendered)

**Why the solver gave up:** not because it could not search. Both give-up paths fell
through with `choice` **unchanged** — the very pick whose `problems` had just built
the Gemini prompt:

```js
if (!seqs.length) console.log("...no legal sequence exists...");   // then NOTHING
... else console.log("...no valid sequence number... — the beats stay as picked");
```

An arrangement the code had already measured as **illegal** was returned unexamined and
the audit failed it. That is `render-and-qa.js:1159` in its own words, and it has
happened at least three times (board 38044082797 ch 49, ch-44 beat 3, ch-2 beat 5).

**What changed:** `bestEffortSequence()` — the *same* search as `legalSequences()`,
same menus, same nearest-first ordering, same pruning — scoring by how many rules an
arrangement breaks instead of discarding any that breaks one. It is the existing
solver's fallback, not a second mechanism. The caller now **logs the residue**: which
beats still break which rule. Nothing is silent.

**Tests** (`solver-no-silent-giveup.test.js`, 5): ch-44's no-alternative sequence
yields a best-effort answer; the fallback is never worse than the illegal pick it
replaces; never worse than a legal sequence where one exists; each beat keeps a shot
its own menu offered; the residue is reportable.

They deliberately do **not** assert a legal sequence exists for the hand-built ch-2
fixture — `shotSequenceProblems` carries rules beyond the repeat (template-window,
alignment) that fixture has not been characterised against, and asserting it would be
asserting something unverified.

# JOB 2 — NOT STARTED. Do not ship a voice without this.

The change is one line (`tts.js:137`, `process.env.TTS_PROVIDER !== "edge"` →
default `edge`), and `edge-tts` is already installed (`daily-pipeline-v2.yml:234` and
a dedicated `:1058`). **It was not pushed**, because the brief says do not use the old
default without testing, and that testing did not fit in the remaining context.

1. Synthesise ONE production sentence through all six:
   `en-US-GuyNeural` (**the control — the current default**), `en-US-AndrewMultilingualNeural`,
   `en-US-AvaMultilingualNeural`, `en-US-AndrewNeural`, `en-US-BrianNeural`, `en-US-EmmaNeural`.
2. Score each with `scripts/acoustic/narration-acoustics.py`. Report `f0_std_st`,
   `f0_range_st`, `f0_slope_st` for **all six**.
3. Widest `f0_range` + highest `f0_std` wins. **If the measure does not separate them,
   say so and leave the default alone.** Do not invent a winner from noise.
4. If a winner: set it, push, render ONE channel end to end, run the narration judge.
   **Pass → the voice was the problem. Fail → the judge is the problem — report it and
   do not chase another voice.**

Context for the next session: `tts.js:134` records Gemini was put first because a blind
Gemini listening test called the voice "ROBOTIC"; `:144` records takes are advisory
(`TTS_GEMINI_TAKES`, default 1).

# JOB 3 — NOT STARTED
Re-run ch-44 and ch-2 once Job 1 and Job 2 are on main. Then, if either reaches
`approved-review`:
```bash
gh workflow run daily-pipeline-v2.yml --ref main \
  -f channels="<ch>" -f publish=true -f review_run_id=<numeric render run id>
```
The publish flow has **never run**. It must be verified before anything is trusted.

# Channel state
`Approved: 0` everywhere. No video has ever entered `approved/` (`git ls-tree`).
ch-8 and ch-44 have reached `approved-review` in earlier runs.

## Method
- The solver was not missing a mechanism — it had one and threw the result away.
  Read before adding: three fixes in this project would have been duplicates.
- Tests assert only what was verified; two were narrowed rather than adjusted until
  they passed.
- A green suite is not a frame. `cba262bd` is unrendered.