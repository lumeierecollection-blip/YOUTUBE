# Stage C — Write Script

You receive JSON on stdin: the frozen research artifact, the channel's
style/tone/format/`script_template`, and (for motion-graphics channels) its
`concepts` archetype allocation.

Follow the style contract in your system prompt exactly — it covers
grounding (cite only from the research you were given), pacing, hook
construction, and the structural rules the renderer depends on
(`text_overlay` shape, no colour values, and for motion-graphics channels the
archetype table and the `anchor_token` verbatim rule).

Write the full script now: `channel_id`, `topic_slug`, `format`, `hook`,
`sections[]`, and `sources_used`. Return `structured_output` matching the
provided JSON Schema exactly — nothing outside it.
