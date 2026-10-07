# Handoff — topic widening: filter works, but the test never ran

## Two ch-05 dispatches, both instructive

**37548436088 (crashed).** `[trending] unexpected error (dropped is not defined),
falling back to unseeded research`. My own bug from 07ddeb0's `rankAndFilter`
extraction. Topic came back `google-flow-music-vibe-coding-plugins` — identical
to the fleet run, because the fetch died before filtering. Fixed in 7f05bdf.

**37549155059 (crash fixed, filter live).** Verbatim:

```
[trending] ch-5: fetched 50, kept 44 (last 7 days), top 4 by velocity; 2 hot term(s)
[trending] ch-5: entities from 4 titles - people 1, places 0, organizations 0, other names 1, numbers 0
[main 99da625] topic: ch-5 moth-wing-acoustic-material
echo "::error::discover-topics failed for channel $CH"
```

**So: the fetch no longer crashes, and the niche filter cut 44 candidates to 4.**
The CATEGORY + pillar + filter machinery is working as designed.

## But the widening is still UNTESTED

`discover-topics` FAILED, so `moth-wing-acoustic-material` came from the topic
*reservation* fallback, not from the trending seed. The prep job then failed.
Nothing was rendered.

The question the prompt set — "does ch-05 come back with a fraud case or a
corporate scandal?" — is still unanswered, because the stage that picks the topic
never ran. Confirming the filter works is not the same as confirming the topic
fits.

`prep (5)` and `render (5)` both failed; `setup` and `log-results` passed;
`review-publish` skipped. No Layer 1, no Layer 3, no MP4.

## Next read, in order

1. **Why did `discover-topics` fail on 37549155059?** The log shows the ollama
   pull (`ollama pull "$m"`) immediately before the error. `OPENCODE_MODELS` is
   `ollama/qwen2.5:3b`, so a 3b model is producing the topic. Get the actual
   error - this is the same local-model chain that failed for ch-2/ch-26's
   *visual planner*, so it may be the same wall.
2. **Then re-dispatch ch-05.** With the fetch proven working, the topic run is
   the real test.
3. **ch-06 has not been dispatched at all** this push.

## State

- `07ddeb0` CATEGORY + collision guard + niche filter
- `c816866` / `51fe1fa` widened niches / aligned pillars
- `e7a9a6f` CATEGORY re-aligned (6->24, 8->27) + category/niche drift test
- `b91c8f8` pillar/niche drift tests
- `7f05bdf` fetch-trending crash repair + main() exported + E2E harness
- Suite 215 pass / 0 fail. `origin/main..HEAD` empty.

## Still open

- discover-topics failure (above) - now the blocker, ahead of everything else.
- ch-2/ch-26 "Visual planning failed (gemini, then ollama) - no plan, no render"
  despite attempt 1 answering. Unread window after `[translate] beat 3`.
- Two dead Gemini keys (`project: unknown` on keys 1 and 2) - 1/3 of quota.
- beat-index resolver gap; mojibake; duplicate channel_id data (baselined as
  warnings, not fixed).
