# HANDOFF

Read this first, then `FIXES.md`.

## Hash at stop
`HEAD == origin/main == 286d35aa`, tree clean, both directions empty. Suite 807/0.

## THE HEADLINE: ch-2 is the first channel ever to reach `approved/`

Run `38528287535`:
```json
{ "channel": 2, "verdict": "approved", "failed_stage": null, "failed_check": null,
  "reason": "verdict A rigorously structured, visually sophisticated editorial short
             that successfully translates complex legal reporting into a seamless
             typographic and data-driven motion piece.",
  "topic": "ice-agent-gregory-morgan-assault-twin-cities", "attempts": 1 }
```

After ~15 board runs and zero, one channel got through. The solver fix (`cba262bd`)
cleared the `canvas-type` gate that had been stopping it.

---

# JOB 1 — THE CRON REACHES review-publish: FIXED AND PROVEN

`286d35aa`. `review-publish` was gated on `event_name == 'workflow_dispatch'`, the
only gate in the workflow keyed on `event_name`, so a SCHEDULE event skipped it
outright. It now admits `schedule`, takes its channel list from
`config/priority-channels.json` and its run id from `github.run_id`, and a new first
step ("Resolve what to publish") resolves both once for every step below it.

**Proven by dispatch:** `Publishing approved-review videos of run 38528287535 for
channel(s) 2 (private)` — the job ran end to end through queue download, OAuth
materialisation and the publish step.

### Two wrong diagnoses on this job, both caught only by running it
- `6841f811` claimed `publish`/`review_run_id` were undeclared. They are, at lines
  62–68, along with `hold_public`. I read lines 33–54 and stopped, added duplicates,
  and the dispatch failed `HTTP 422 'publish' is already defined`.
- `468e0531` then used a blanket search-and-replace that rewrote the Resolve step's
  **own** env to read its own outputs, so both resolved empty and the step failed
  with `no channels given` on a dispatch that had passed both flags correctly.

Both reverted or fixed. Reasoning about this job was wrong twice; running it was
right three times.

---

# THE BLOCKER THAT REMAINS: `approved/` has no upload path

**This is why the publish run produced nothing.** `run.js --review` reads
**`approved-review/` only**. ch-2's video is in **`approved/`**. There is no
code path in `review-publish` that uploads an `approved/` video.

So the pipeline can now reach the upload step and there is still nothing it will
upload, because the one channel that has passed went to the queue `--review` ignores.

**The decision is yours, and it is a policy call, not a bug:**
- `approved/` is the stronger verdict (A). Under human-review posting it arguably
  deserves the same treatment: upload private, owner clicks Publish.
- The fix is small and local — let the publish step take `approved/` too, still
  private, still queued cancelled. It does **not** loosen any gate; it changes what
  happens to a video *after* it lands in a queue.

Until that is done, **the 06:00 cron will reach review-publish and upload nothing.**

# Uploads
**None.** `data/uploaded/.json` currently on main is from the broken 08:12 run —
it has `"date": ""` and a `no_credentials: []` that should have been populated. It
is junk and should be deleted. The 08:16 run's digest failed to push (exit 1, a
non-fast-forward against concurrent board pushes).

# JOB 2 — VOICE: unchanged, default left alone
`edge_tts` 7.2.8 is installed locally and the acoustics script exists, but
Microsoft's endpoint returns `WSServerHandshakeError: 403` at the handshake, before
any audio is written. **No f0 numbers exist and none were invented.** Default stays
`en-US-GuyNeural`.

**Before anyone switches:** confirm Edge synthesises on a GitHub runner. `tts.js:137`
puts Gemini first *because* Edge is the fallback; if Edge 403s there too, the switch
removes the working provider and leaves no voice.

# JOB 3 — ch-44: killed, not cancelled this time
Run `38528287535`, ch-44 render **failure**. It got past infrastructure.

# Board `38528287535` — all ten
ch-2 **approved** (first ever). ch-44, 5, 49, 26, 1, 6, 8, 10, 9 rejected at their
gates; `review-publish` skipped, correctly — that dispatch had no `publish=true`.

# Next, in order
1. **Give `approved/` an upload path** (above). Nothing publishes until this exists.
2. Delete `data/uploaded/.json` — a junk artifact from the broken run.
3. Confirm Edge TTS on CI, or take Path C and make the narration judge advisory
   (a deliberate policy change: the human watches every video anyway).
4. Then prove one real upload end to end and paste the Studio link.

# Credentials
**01, 02, 09, 26, 44** can upload. **05, 06, 08, 10, 49** still need
`CHANNEL_NN_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN`.

## Method
- Run it; do not reason about CI wiring. Two confident diagnoses here were wrong
  and a third (self-referencing outputs) only surfaced in a real run.
- A gate that passes is not an upload. Follow the artifact all the way to a video id
  before claiming anything published.