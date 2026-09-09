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

- Every value in any beat's `data.series` is one of the research's real
  `numbers[].value` entries (copied exactly, with its real unit) — never
  invented, derived, or a binary 0/1 encoding of a contrast. If it isn't
  in `numbers[]`, it must not be charted.
- Voiceover word count is inside the format range in the style contract.
- For motion-graphics: primary archetypes 50% or more of beats, secondary
  35% or less, excluded 0%.
- `sources_used` has 3 or more URLs that actually appear in the research's
  `key_facts`/`numbers`, and every one is used by something you wrote.

## Gate checklist — the script is rejected if any of these is false

Re-read every beat against this list before returning. These are the exact
checks `gate-script.js` runs; a script that fails them is thrown away.

1. **SCR-04 — chart beats need ≥2 points.** A `PROGRESS` or `DATA_CHART`
   beat MUST have 2 or more `data.series` points. If you have only one real
   number for the idea (a price, a trial length, a single count), the beat
   is `HERO_NUMBER`, not `PROGRESS`. One number is never a bar chart.
2. **SCR-05 — every series value is verbatim from `numbers[]`.** Take each
   `data.series[].value` and find it in the research's `numbers[]` array. If
   it isn't there character-for-character, delete the point or drop the
   chart. Do not round, convert, or infer a value.
3. **SCR-03 — `anchor_token` is a substring of that section's `voiceover`.**
   Write the section's `voiceover` first, then copy the `anchor_token`
   straight out of it. If the token is "99.99", the characters "99.99" must
   appear in that voiceover. Never anchor on a number or phrase you did not
   speak in that section.
4. **SCR-08 — hit the word count.** Add up the words in every section's
   `voiceover` plus the `hook`. `shorts` must total 150–280 words; a
   90-word shorts script fails. If you are short, expand the section
   voiceovers with more of the researched detail — do not pad with filler.
