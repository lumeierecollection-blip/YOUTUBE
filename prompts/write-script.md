# Stage C — Write Script

You are given JSON in the INPUT section of this message: the frozen research
artifact, the channel's style/tone/format/`script_template`, and (for
motion-graphics channels) its `concepts` archetype allocation. Everything you
need is in that section — you have no web access, no file access, and nothing
to ask the user for.

Follow the style contract in your system prompt exactly — it covers
grounding (cite only from the research you were given), pacing, hook
construction, and the structural rules the renderer depends on
(`text_overlay` shape, no colour values, and for motion-graphics channels the
archetype table and the `anchor_token` verbatim rule).

Write the full script now: `channel_id`, `topic_slug`, `format`, `hook`,
`sections[]`, and `sources_used`. Return `structured_output` matching the
provided JSON Schema exactly — nothing outside it.

## Before you finish

- Every value in any beat's `data.series` exists exactly in the research's
  `numbers[].value` — if it isn't there, it must not be charted.
- Voiceover word count is inside the format range in the style contract.
- For motion-graphics: primary archetypes 50% or more of beats, secondary
  35% or less, excluded 0%.
- `sources_used` has 3 or more URLs that actually appear in the research's
  `key_facts`/`numbers`, and every one is used by something you wrote.
