# Handoff — ch-05 renders. The lookup bug was the whole story.

## The topic is verbatim true crime

Run `37550901882`, after `fc80532`:

```
[main 7e7714f] topic: ch-5 doj-fraud-division-corporate-enforcement-directive-2026
Discovered 3 candidate topic(s)
[research] ch-5: focus pillar "press investigations" (0 recent topic(s) touch it)
```

For comparison, the two runs before the lookup fix, same channel, same dispatch
key `5`:

| run | topic | what it actually was |
|---|---|---|
| 37540546857 (fleet) | `google-flow-music-vibe-coding-tools` | ch-26 **Harmony's** music niche |
| 37548436088 | `google-flow-music-vibe-coding-plugins` | same |
| 37549155059 | `moth-wing-acoustic-material` | same |
| **37550901882** | **`doj-fraud-division-corporate-enforcement-directive-2026`** | **ch-05 Broadsheet, true crime** |

Three music topics in a row, then a DOJ fraud-enforcement topic. The focus pillar
went from `"rhythm patterns"` to `"press investigations"`.

## And it RENDERED

```
rendered 1 file(s) under data/renders
[queue] ch-5: doj-fraud-division-corporate-enforcement-directive-2026-shorts-shorts-2026-10-07.mp4
[local-audit] PASS beat-sentence-mechanism - every beat has a sentence and a mechanism
[local-audit] PASS typography-count - 2 TYPOGRAPHY beat(s)
[local-audit] PASS mechanism-share - max share 33%
[local-audit] PASS av-duration - video 52.93s, audio 53.71s
[local-audit] VERDICT: FAIL (15/17 checks)
[backup-qa] canvas-checks failed (failed: canvas-accent, pop-transitions) -> local audit FAIL -> rejected
```

52.9 s of video and audio. **15 of 17 Layer 1 checks pass.** Two fail:
`canvas-accent` and `pop-transitions`. Rejected to
`data/renders/rejected/`. Layer 3 was never reached (eval_loop_mode=off), so no
style judgement exists yet.

`middle-zone-filled` did not appear in the failing list, so the density advisory
is not what is blocking.

## What the last several pushes actually were

Niche widening, CATEGORY mapping, pillar alignment and the niche filter were all
real and all correct - and all second-order. ch-05 was never failing on topic fit.
It was being handed ch-26 Harmony's discovery context and asked to make a video
about music, then judged against a newspaper-collage style spec. The filter work
(44 candidates to 4, true-crime titles kept) is good code that was cleaning a
feed nobody was reading.

## Next push

Two canvas checks, both visual and both on a video that now exists:
`canvas-accent` and `pop-transitions`. That is ordinary style work on a real
render, not a data bug. Clear those two and ch-05 should reach Layer 3.

Then re-dispatch ch-06 the same way - key 6 resolves to ch-06 Archive Room /
Cold Cases under the same fix, and it has never rendered once.

Do not run the fleet. ch-1 and ch-8 were SIGTERMed on runner capacity in
37540546857.

## Also still open

- `ch-48` throws `channel_ambiguous`: its `id` is not 48, so it has never
  resolved. Not in `config/priority-channels.json`, so nothing dispatches it.
- ch-2/ch-26 "Visual planning failed (gemini, then ollama) - no plan, no render"
  despite attempt 1 answering. Window after `[translate] beat 3` still unread.
  Note ch-26 is Fraud Files and its dispatch key is unaffected by `fc80532`.
- The "dead Gemini keys 1 and 2" claim still needs checking against what
  `project: unknown` meant - all five key secrets are present in the env.
- beat-index resolver gap; mojibake; the nine duplicate channel_ids, now failing
  loud instead of silently.
