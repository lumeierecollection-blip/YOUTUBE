# HANDOFF

Read this first, then `FIXES.md`.

## Hash at stop
`HEAD == origin/main == f1d22b42`, tree clean, both directions empty.
**No code was changed this session.** Suite 802/0.

## Cron
**ON**, 06:00 UTC daily (`369f3a27`).

## Uploads
**None.** No upload has been attempted end to end. `data/uploaded/YYYY-MM-DD.json`
is now produced by `review-publish` (`0b744f47`) but has never run.

## Credentials
Can upload: **01, 02, 09, 26, 44**. Missing (owner action): **05, 06, 08, 10, 49**
— each needs `CHANNEL_NN_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN`.

---

# READ-FIRST ANSWERS (all five, so the next session does not repeat them)

**2. The plates neighbour guard that exists** — `scripts/entity-ladder.js:283`:
```js
const neighbourIsRow = !plan?.beats
  ? false
  : plan.beats.some((x) => Math.abs(x.index - b.index) === 1 &&
      (x.art?.kind === "plates" || x.canvas?.art?.kind === "plates"));
```
It reads neighbours' **applied** art (entityLadder applies directives in place as it
walks the plan left-to-right, so beat *n*'s art is already set when beat *n+1* is
processed). Without a `plan` it returns false and the beat takes the row. When true
the beat takes a single plate instead of a second row.

**3. Where a beat is handed its composition.** The gate is **`canvas-type`**, documented
at `scripts/local-audit.cjs:67` — "no composition twice in a row" — and it judges the
**manifest boxes**, after the render, not the plan.

Crucially, a solver for this already exists in the **plan** stage:
`scripts/render-and-qa.js:1143` — *"canvas-type refuses two centred headlines in a row,
so the sequence must not offer them"* — with `sequenceProblems()` at :1146 and the
comment at :1159 noting *"the solver gave up and left a photo card twice and a statement
twice in a row, which canvas-type…"*. So the class fix is to make that solver **never
give up**, not to add a new guard elsewhere. Read :1143–1200 first; a new parallel guard
would be the second mechanism solving the same problem.

**4. The TTS provider switch** — `src/utils/tts.js:137`:
```js
if (process.env.TTS_PROVIDER !== "edge" && ["GEMINI_API_KEY_4", "GEMINI_API_KEY_1", ...])
```
**Gemini TTS runs first by default; Edge is the fallback.** The brief's premise is correct.
The file's own header (`:2`) says it generates voiceover "using EdgeTTS (free, no
provider key)" — Gemini was layered on top of an Edge-native utility. Default Edge voice
per the header (`:12`) is **`en-US-GuyNeural`**, which is *not* among the five candidates
named in the brief. Note `tts.js` also records the reason Gemini was put first:
`"THE VOICE IS ROBOTIC"` in a blind Gemini listening test (`:134`), and takes are advisory
(`:144`).

**5. edge-tts IS installed.** Two places in `daily-pipeline-v2.yml`:
`:234` `pip install --quiet edge-tts faster-whisper`, and a dedicated
`:1058 - name: Install edge-tts`. Nothing to add.

---

# JOB 2 — Edge TTS as default: the code change is one line, but DO NOT PUSH IT YET

Flipping the default is `TTS_PROVIDER !== "edge"` → default `edge`. That part is trivial.

**The voice choice is not, and it gates the commit.** The brief is explicit: *"Do not use
the old default without testing. Do not use a preview voice."* I could not run the
acoustic comparison before context ran out, and shipping `en-US-GuyNeural` untested
would violate that instruction and risk making the narration judge *worse*.

Next session, in order:
1. Render the same production sentence through each of
   `en-US-AndrewMultilingualNeural`, `en-US-AvaMultilingualNeural`,
   `en-US-AndrewNeural`, `en-US-BrianNeural`, `en-US-EmmaNeural`
   (plus `en-US-GuyNeural` as the incumbent, for comparison).
2. Score each with `scripts/acoustic/narration-acoustics.py` — report `f0_std_st`,
   `f0_range_st`, `f0_slope_st`. Pick widest `f0_range` and highest `f0_std`.
   **If the measure does not separate them, say so and pick by ear** — do not invent a
   winner from noise.
3. Flip the default, push, re-render one channel, run the narration judge.
   **Pass → the voice was the problem. Fail → the judge is the problem.** Report that and
   do NOT chase another voice. That is the honest fork and it is already written down.

# JOB 1 — composition neighbour guard: NOT STARTED
See read-first 3. The fix belongs in the sequence solver at
`scripts/render-and-qa.js:1143–1200` — make it never return a sequence with an adjacent
repeat instead of giving up. Two real cases: ch-44 beat 3 `TYPE-FULL twice in a row`,
ch-2 beat 5 `TYPE-FULL+NAME twice in a row`. Regression test with both sequences.

# WHY NOTHING ELSE CHANGED
The board this was based on stopped ch-44 at `canvas-type` (run `38469933382`), and
`Approved: 0` remains true everywhere. The two blockers in front of posting are exactly
the two in this brief, so no work was spent anywhere else.

## Method
- Read-first 2 contradicted the brief's own assumption that no guard exists for
  compositions. The solver already tries; it just gives up. Read before adding.
- A green suite is not a frame, and a passing gate on a re-picked topic means nothing.
