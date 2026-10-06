# Channel Expansion Method

How four channels went from references in `research/` to registered entries in
`config/channels.json`, written so the next expansion is mechanical.

## 1. Cluster identification

**Measure, don't classify by eye.** For every video in `research/`, extract the
ground colour and dominant palette from decoded pixels and note the format. No
ASR exists in this environment, so nothing is derived from narration — that is a
limitation, not a choice, and it means subject domain comes from the filename
and the visible frames only.

**One measurement was rejected outright.** Cut counts returned 0 for videos that
visibly cut: `4_5917850534521349251.mp4` is 60 s of layout changes and the
detector saw none, because a 2 fps sample downsampled to 32 px cannot resolve a
cut between similar layouts. Grounds and palettes were used; **pacing is
unmeasured**, and no decision below rests on a cut rate. A measurement that
disagrees with what you watched is not a measurement.

**Group by editing technique, not subject.** Two videos about money are the same
cluster only if they share a grammar: ground, type system, and how elements
arrive. A cluster is a *technique signature*, so the name is the technique —
`newspaper-collage`, `archival-montage`, `stepped-timeline`, `money-explainer`,
`glitch-corporate`, `live-action-over-type` — never a genre and never "motion
graphics".

**A cluster can belong to two.** `4_5917850534521349257.mp4` is a dated timeline
(shared progression grammar with the typewriter/ASCII video → `stepped-timeline`)
and also a red/black glitch reel. The technique name and the palette disagreed;
it was merged into one cluster with the palette noted, not split into two
half-channels.

## 2. The `repeatable: yes` filter

The filter that does the real work. A reference becomes a channel candidate only
if the style is a **series format** — something that can carry next week's topic.
Applying it removed two clusters outright:

- a 5 s silent counter loop — a template preview, no editorial content at all
- a paid video-editing service ad with an Instagram handle in the last frame —
  there is a business to sell, not a series to run

**A single reference can still qualify**, but only if it demonstrates a full
format end to end. `4_5917850534521349255.mp4` qualifies: 65 s from SCENE 01
through to a closing card is a whole episode, not a fragment.

## 3. Collision check against built channels

Before assigning, read every existing channel's `style_spec.json` and reject any
cluster that duplicates one. Two were rejected this way:

- `money-explainer` — cream ground, green duotone currency, per-beat labels —
  is built **ch-01 Money Mind**: white `bg_mode`, `#22C55E` green accent. Same
  visual idea.
- `social-proof-psych` — cream ground, experiment clips, brain graphic —
  is built **ch-22 Mind Lab** and **ch-50 Synapse**.

Subject overlap is not the test. Visual grammar is. ch-05 Broadsheet and a
future history channel could share a subject and still be different channels if
one is front-page collage and the other letterboxed montage.

## 4. The four-pick criteria, in order

1. **Repeatable** — a series format, not a one-off. Filters hardest.
2. **Distinct** — no built channel shares the grammar. Reject on collision.
3. **Sufficient reference** — two references, or one showing a full format.
4. **Subject domain open** — the style carries topics beyond the one in the
   reference. A style that only works for robot labour is not yet a channel.

Fewer than four qualifying means ship fewer. Do not pad: a channel with a weak
style basis costs more later than the gap it fills.

## 5. Style-spec build

Copy an existing entry's shape field for field, then override only values. Two
new fields were added and documented rather than invented per channel:
`editing_style_name` (the cluster's technique label, so the spec names its own
style) and `style_spec_path` (the pointer to the spec file).

**Palettes are measured, not chosen.** Broadsheet `#BABDB6`, Archive Room
`#595A5B`, Ledger `#382D28`, Margin Note `#D4D4D4` all come from decoded pixels
in the reference footage. A palette picked for taste is an invention.

**IDs** are the first free integers outside the duplicate set — ch-05, ch-06,
ch-08, ch-10. `config/channels.json` declares nine channel_ids twice (ch-26, 30,
31, 35, 39, 44, 46, 47, 49), so "next integer" is not enough.

## 6. Appending to `config/channels.json`

**Never round-trip this file.** It stores mojibake: an em dash is stored as the
six escape characters `\u00e2\u20ac\u201d`, not the UTF-8 bytes. `JSON.parse` turns
those into three different codepoints and `JSON.stringify` re-emits a different
six-character sequence, so a parse-then-stringify **rewrites seven existing
lines**. That is what made four earlier registration attempts fail.

Append by byte splice:

1. Read bytes, scan backwards for the last `CRLF` before the array's `]`.
2. **Anchor on the CR, not the LF** — anchoring on the LF leaves a trailing
   `\r` on the prefix and puts the inserted comma in the wrong place.
3. Assert the prefix ends exactly at the last entry's `    }`.
4. That entry has **no trailing comma**; the splice supplies it.
5. Insert `,\r\n` + entries, each `JSON.stringify`-ed **individually** and
   ASCII-only.
6. Verify: prefix byte-identical to HEAD, `git diff --numstat` shows additions
   with **0 deletions**, and the mojibake is still present (proving it was left
   alone).

## 7. Pipeline verification sequence

Each channel runs three times, in order:

| mode | what it proves |
|---|---|
| `off` (default) | the channel renders at all, and Layer 1 passes on the real output |
| `dry` | the loop reaches a decision and names revisable elements, without touching pixels |
| `live` | the loop acts — partial re-render, re-score, accept or cap |

Then one human check that no gate substitutes for: **does the render look like
its reference?** Layer 1 proves the renderer executed the plan. Layer 2 is a
style-distance advisory that cannot catch a blank frame (measured: a blank scores
0.68–0.81 against a 0.457 floor). Layer 3 scores composition and style coherence
against the whole video with audio. Only looking at the frame answers "is this
the channel".

## 8. Repeating this for 10 → 20 → 50

The method is: measure `research/`, group by technique signature, drop
non-repeatable and colliding clusters, pick four by the criteria above, copy an
existing spec shape, append by byte splice. Nothing in it is channel-specific,
so each expansion is the same sequence over a larger video pool.

What changes at scale: the collision check grows from 6 to 50 style specs to
read, so cluster **fingerprint** matching (ground + palette + type + arrival
pattern, hashed) becomes worth automating. The `repeatable: yes` filter gets
stricter — a technique that only worked for one reference will have been caught
by then. And the human style-match check stops scaling; that is the step that
will need a rubric or a panel before 50 channels.

## 9. What actually blocked this expansion

Not the method — the **publishing gate**. `config/priority-channels.json` lists
`[1, 2, 9, 26, 44, 49]` and `daily-pipeline-v2.yml`'s setup step refuses any
channel outside it:

```
Not priority channels: 5 (priority: 1,2,9,26,44,49)
```

All four new channels hit it identically. Registering a channel is not the same
as being allowed to run one, and this repo keeps those lists separate on
purpose: priority is "approved for YouTube publishing". A channel is registered,
spec'd, paused, and not yet approved to publish — which is the correct state, and
also why no verification run in §7 has happened yet.