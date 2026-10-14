# HANDOFF

Read this first, then `FIXES.md`.

## Hash at stop
`HEAD == origin/main == 1abc4ace`, tree clean, both directions empty. Suite 807/0.
**No code changed this session.**

## Cron
**ON**, 06:00 UTC. But see Job 3 below — it will not publish.

## Uploads
**None.** The publish path has still never executed.

---

# JOB 1 — VOICE TEST: BLOCKED, and the default was left alone

`edge_tts` 7.2.8 **is** installed locally and `scripts/acoustic/narration-acoustics.py`
exists, so the test was runnable. It is not a tooling gap:

```
WSServerHandshakeError: 403, message='Invalid response status',
url='wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?...'
```

Microsoft's endpoint refuses the handshake **before any audio is produced**. No file
is written, so there are no `f0_std_st` / `f0_range_st` / `f0_slope_st` numbers.

**I am not reporting six numbers I did not measure.** Per the brief's own rule — if the
measure cannot choose, leave the default — the default stays **`en-US-GuyNeural`** and
the provider switch was **not** pushed.

### This is also a risk to switching the default at all
`tts.js:137` puts Gemini first *because* Edge is the fallback. If Edge 403s here it may
403 on a GitHub runner too. **Before anyone flips the default, confirm Edge TTS
synthesises successfully on CI** — otherwise the switch removes the working provider
and leaves no voice at all. Check a recent workflow log for a successful `edge-tts`
call before changing anything.

# JOB 2 — the solver fix is working; both channels stopped elsewhere

Run `38495646394`, ch-44 and ch-2.

**ch-2 — rejected, `frame-review` / `TEMPLATE_MONOCULTURE`:**
```json
{ "verdict": "rejected", "failed_stage": "frame-review",
  "failed_check": "TEMPLATE_MONOCULTURE",
  "reason": "REJECTED — TEMPLATE_MONOCULTURE — 71% headline-dominated beats (time budget: no further attempt)",
  "local_audit": "all checks passed" }
```
**`local_audit: all checks passed`** — `canvas-type` no longer fails it. The "TYPE-FULL
twice in a row" gate (`cba262bd`) is through. The failure moved forward to a later gate.

The reason string matters: *"time budget: no further attempt"*. The retry loop ran out
of time rather than exhausting options. That is the same shape as the bug just fixed —
something giving up silently — and it is the **next cause in line**.

**ch-44 — render CANCELLED.** Started 01:44:17, completed 02:04:38. No queue JSON, no
rendered frames, no artifact content. Prep succeeded (`{"skipped": false, "prep":
"success"}`). This is infrastructure, **not a gate** — do not re-attempt it as if it were
a content failure. Re-run it on its own.

**Neither reached `approved-review`**, so the publish flow remains unproven.

# JOB 3 — WHAT THE CRON WILL ACTUALLY DO AT 06:00 UTC

**It will run and upload nothing.** Two independent reasons:

1. **`review-publish` cannot run on a schedule.** Its condition is:
   ```yaml
   if: >
     github.event_name == 'workflow_dispatch' &&
     github.event.inputs.publish == 'true' &&
     github.ref == 'refs/heads/main'
   ```
   On a `schedule` event `event_name` is `schedule`, so this is false and the job is
   **skipped**. The one condition in the whole workflow that gates on `event_name`
   excludes cron.
2. Nothing has ever reached `approved/` or `approved-review/` in a run.

So enabling the schedule made the pipeline **run** daily; it did not make it
**publish**. Enabling it was the right call and it is genuinely useful — it produces
the daily board — but it publishes nothing until `review-publish` is reachable from a
schedule event.

**The obvious next change, when a channel first reaches `approved-review`:** give
`review-publish` a schedule path. `github.event_name == 'workflow_dispatch'` would
have to admit `schedule`, and a schedule has no `inputs.channels` or `inputs.review_run_id`
— it needs to take them from the matrix and from its own run's artifacts. Do this
deliberately and prove it on one channel before enabling it daily.

## Credentials
**01, 02, 09, 26, 44** can upload. **05, 06, 08, 10, 49** need
`CHANNEL_NN_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` (owner action).

## Next cause in line
**`TEMPLATE_MONOCULTURE` / a gate that gives up on a time budget** — ch-2, "71%
headline-dominated beats (time budget: no further attempt)". Same family as the solver
bug: a check that stops searching instead of exhausting its options. Read before
adding anything — there is almost certainly a retry loop here too.

Then: re-run ch-44 alone (it was cancelled, not failed).

## Method
- One more instance of "the mechanism exists, it just stops early". The solver had a
  search and discarded its result; this gate has retries and runs out of clock.
- A blocked measurement is reported as blocked. Six invented f0 numbers would have
  looked like a finished job and set the default on noise.