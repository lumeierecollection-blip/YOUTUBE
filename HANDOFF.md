# HANDOFF

Read this first, then `FIXES.md`.

## Hash at stop
`HEAD == origin/main == 45b04668`, tree clean, both directions empty. Suite 814/0.

## Cron
**ON**, 06:00 UTC.

## Uploads
**NONE.** The upload has still never happened. See Job 2.

---

# JOB 1 — DONE, `45b04668` (tests green, NOT yet proven in a run)

`findVideo()` read exactly one queue:

```js
const verdict = review ? "approved-review" : "approved";
```

So ch-2 — the first channel ever in `approved/` — had **no upload path at all**,
and the job built to publish could not publish the one video that had passed
everything. `--review` now searches `approved-review/` **first** (it exists precisely
because a video needs a human, and one there must not be passed over for a different
video from the other queue), then `approved/`. `findVideo` returns the queue it came
from, so `data/publish-queue` records the truth instead of guessing from the review
flag.

`rejected/` is still never read. No gate changed, no queue membership changed. Upload
is still `privacyStatus: "private"` and still queued `cancelled` — tests pin both.
`scripts/__tests__/publish-both-queues.test.js`, 7 tests.

# JOB 2 — THE UPLOAD DID NOT HAPPEN

Dispatch `38545634139`, `-f channels=2 -f publish=true -f review_run_id=38528287535`.

**Proof it did not happen, from the artifact rather than the log:**
`data/publish-queue/2/publish-queue.json` on `origin/main` contains only entries dated
**2026-08-11** and **2026-09-15**. Nothing from today. **No video id, no Studio link.**

How far it got:
```
Publishing approved-review videos of run 38528287535 for channel(s) 2 (private)
... Resolve → Check inputs → checkout → node → deps → download queues
    → download renders → download prep → Materialize OAuth credentials
    → Write the daily upload digest → Commit the daily upload digest → Commit publish queue
```

**The step `Publish approved-review videos (private)` is absent from that list, and
`run.js` was never invoked** — no invocation appears anywhere in the log. The job went
straight from `Materialize OAuth credentials` to the digest step.

**So the publish step did not execute at all**, and I could not work out why in the
context remaining. The step is present in the workflow at line ~1648, correctly
indented (6 spaces, same as its siblings), with a `run:` and no `if:`, so nothing in
the file explains it being skipped.

**Next session: open run `38545634139` → the `review-publish` job → and look at the
`Publish approved-review videos (private)` step directly in the GitHub UI**, including
whether it is greyed out with a skip reason. That is one click and it will answer this
immediately. Do not re-diagnose from the log; the log does not contain the step.

Secondary failure worth noting: **both `Commit the daily upload digest` and
`Commit publish queue` exit 1** — almost certainly non-fast-forward against the board
runs committing scripts to `main` simultaneously. They have a rebase-and-retry loop, so
if it is that, the loop is being exhausted. Worth a look once the upload itself works.

# JOB 3 — VOICE: unchanged, default left alone

`edge_tts` 7.2.8 installed locally; `scripts/acoustic/narration-acoustics.py` exists.
Microsoft's endpoint returns, before any audio is written:

```
aiohttp.client_exceptions.WSServerHandshakeError: 403, message='Invalid response status',
url='wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?...'
```

**No f0 numbers exist and none were invented.** Default stays `en-US-GuyNeural`.
Path A was not taken — testing Edge on a CI runner needs a workflow, which is the next
session's first job.

**If Edge 403s on runners too, Edge is dead as a provider and the real choice is Path C:**
make the narration judge advisory. Under human-review posting you watch every video
before it publishes, so a gate that rejects 8/8 sentences as "synthetic or flat" (ch-44)
is filtering on something only a listener can judge. That is a deliberate policy
change, not a loosening, and it should be stated as one when made.

# JOB 4 — ch-44: killed, `grid`

```
stage=canvas-checks  check=grid
audit: grid: beat 6 (TYPE-CHAPTER): the words are centred at x 585,
       not on the frame's axis (540 ± 40)
```

A layout bug, not content. **Not fixed** — out of context. It has been failing since
board `38330253047` and is the same beat and the same number, so it is stable and
diagnosable, not flaky. `TYPE-CHAPTER` needs to centre on the frame axis; 585 vs 540 is
a 45 px offset, just past the ±40 tolerance.

# Will tomorrow's 06:00 cron upload?

**It will reach the publish step. It will upload nothing until Job 2 is resolved.**
Everything up to and including OAuth materialisation is proven working. The single
unknown is why the publish step itself does not execute — which is one UI click away.

Channels that could upload: **01, 02, 09, 26, 44**. **05, 06, 08, 10, 49** still need
`CHANNEL_NN_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN`.

# Next, in order
1. Read run `38545634139`'s publish step in the UI. One click answers the whole blocker.
2. Once it runs, dispatch again and paste a real Studio link.
3. Test Edge TTS on a CI runner → Path A result, or take Path C.
4. ch-44's `grid` offset — stable, one beat, diagnosable.

## Method
- Three wrong diagnoses in a row on the publish wiring this week. Every one was caught
  only by running it. Reasoning about CI wiring has a poor record here; the artifact
  and the UI are the truth.
- `data/publish-queue` answered "did it upload?" in one command when the log could not.