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

**Duration cap: ALL videos must be 30-45 seconds.** At 30 fps this means
900-1350 frames.

**Voiceover word count: 76-93 words. This is a hard gate, not a guideline.**
The gate converts your word count to a duration using the channel's
words-per-minute target and the actual TTS delivery rate, then REJECTS the
script if it falls outside 30-45 seconds. 76-93 is the range that is safe
for every channel's voice, so staying inside it always passes; going under
76 fails just as hard as going over 93. Aim for the middle (~85 words).

Do NOT write short to save render time. A script under 76 words is rejected
and the whole channel produces nothing that day.

Write the full script now: `channel_id`, `topic_slug`, `format`, `hook`,
`sections[]`, and `sources_used`. Return `structured_output` matching the
provided JSON Schema exactly — nothing outside it.

## Before you finish

- Every value in any beat's `data.series` is one of the research's real
  `numbers[].value` entries (copied exactly, with its real unit) — never
  invented, derived, or a binary 0/1 encoding of a contrast. If it isn't
  in `numbers[]`, it must not be charted.
- Voiceover word count is **76-93 words** — count it. Under 76 or over 93
  is a BLOCKER (SCR-16) and the script is rejected. If you are over, cut
  beats; if you are under, the hook and the consequence both need real
  sentences — do not pad with filler, but do not ship 60 words either.
- For motion-graphics: primary archetypes 50% or more of beats, secondary
  35% or less, excluded 0%.
- `sources_used` has 2 or more URLs that actually appear in the research's
  `key_facts`/`numbers`, and every one is used by something you wrote.
