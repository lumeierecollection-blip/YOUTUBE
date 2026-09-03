# Per-beat visual reasoning — coverage across all 17 channels

Every pipeline run, the reasoning stage evaluates each beat's actual script
line against its candidate photos and picks the one that fits. This file
records what that produced on this branch, channel by channel, including the
channels where it produced nothing and why.

Runners:

- `src/skills/remotion-render/visual/beat-photo-reasoning.mjs` — the decision
  itself, and the log format.
- `src/skills/remotion-render/visual/run-beat-reasoning.mjs` — runs it over
  every channel in `config/channels.json`. Full log:
  `data/renders/beat-reasoning/per-beat-log.txt`.
- `src/skills/remotion-render/qa-scripts/render-beat-clips.mjs` — renders a
  real clip per beat. Manifest: `data/renders/beat-clips/clips-manifest.json`.

## What "genuinely fits" means here, in code

A candidate fits only if the **source's own** title, description, or alt-text
contains or clearly corresponds to a concrete noun the script line names. What
the picture appears to show is not evidence and is never used. Every candidate
carries five fields — source name, source URL, search query, dimensions, and
the source's own text — and a field the source did not supply is written
`MISSING — not provided by the source`, never omitted and never invented.

Two such holes are real and recorded on every candidate rather than papered
over: the b-roll manifest schema does not store the search query that returned
a file, and Wikimedia Commons' `Special:FilePath` fetch returns a title but no
description or alt-text.

A pick with no quotable justification is not made. Beats where nothing
qualified are logged as `UNMATCHED GAP`, not resolved by guessing.

## Coverage, all 17 channels named

| # | Channel | Script + SRT on this branch | Beats reasoned | Matched | Unmatched | Clips rendered |
|---|---|---|---|---|---|---|
| 1 | Money Mind | yes — `debt-snowball-vs-debt-avalanche-shorts` | 31 | 0 | 31 | 3 |
| 2 | Legal Brief | yes — `what-to-say-traffic-stop` | 80 | 0 | 80 | 4 |
| 3 | AI Tested | **no** | 0 | — | — | 0 |
| 4 | Hidden Past | yes — `great-fire-of-london` | 92 | 0 | 92 | 4 |
| 7 | Dead Companies | **no** | 0 | — | — | 0 |
| 9 | Border Lines | **no** | 0 | — | — | 0 |
| 11 | Cosmic Frontiers | **no** | 0 | — | — | 0 |
| 17 | Epoch Chronicles | **no** | 0 | — | — | 0 |
| 26 | Fraud Files | **no** | 0 | — | — | 0 |
| 30 | Cold Case DNA | **no** | 0 | — | — | 0 |
| 31 | Justice Denied | **no** | 0 | — | — | 0 |
| 35 | The Engineering Archive | **no** | 0 | — | — | 0 |
| 39 | Case File Medicine | **no** | 0 | — | — | 0 |
| 44 | Skill Stack | **no** | 0 | — | — | 0 |
| 46 | Interview Insider | **no** | 0 | — | — | 0 |
| 47 | Medicare Navigator | **no** | 0 | — | — | 0 |
| 48 | Factory Floor | **no** | 0 | — | — | 0 |
| — | ch-fixture (not a production channel) | yes — `movile-cave-shorts` | 29 | 4 | 25 | 4 |

**4 of 18 rows ran. 13 of the 17 production channels produced no beats at
all.** That is not a sampling choice — those channels have no `*script.json`
with a matching `-vo.srt` anywhere under `data/research/<id>/` or
`data/scripts/<channel_id>/` on this branch, and the stage that would write one
cannot run here: no provider API key is set and every provider host is refused
by the egress policy. No channel's script was borrowed to make another channel
look covered.

**Money Mind, Legal Brief, and Hidden Past reasoned over 203 beats and matched
zero.** Also not a sampling choice: none of the three has a b-roll manifest
(`src/skills/remotion-render/b-roll-manifest-ch-0{1,2,4}.json` do not exist),
so there were no candidates to consider. Every one of those 203 beats is logged
individually with `CANDIDATES CONSIDERED: none`.

Only ch-fixture has real source-provided photo metadata, and it is the only row
with matches — 4 of 29 beats. A sample, quoted from the log verbatim:

```
    PICKED: https://commons.wikimedia.org/wiki/File:Lava_River_Cave_Entrance.jpg
    JUSTIFICATION (quoted from the candidate's own source_text.title):
      "File:Lava River Cave Entrance.jpg"
      matched the script line's concrete term "cave"
```

and a rejection from the same beat, showing why the bar held:

```
          source_text:   title="File:Large Sulfur Crystal.jpg"; description=MISSING — not provided by the source; alt=MISSING — not provided by the source
          verdict:       does not fit — no concrete term from the script line (broke, cave) appears in any source-provided text; the only remaining link would be what the image looks like, which is not evidence
```

The 25 unmatched fixture beats are each logged as an explicit gap.

## Clips

15 clips rendered, one per distinct visual strategy per script, 1.4–3.5s each,
1280x720 h264 at scale 0.5. They cover 8 distinct strategies:
`CINEMATIC_STATEMENT`, `ACCUMULATION`, `COMPARISON`, `VISUAL_METAPHOR`,
`CAUSE_EFFECT`, `TIMELINE`, `SCALE_COMPARISON`.

Every clip's audio track is a **silent placeholder**, not a voiceover. No TTS is
reachable here (`edge-tts` is absent and every TTS host is refused by the egress
policy), and the composition statically imports `./vo.mp3`, so a silent track of
the right length is staged instead. These are picture-only clips; do not read
them as evidence about audio.

Clip files live under `data/renders/beat-clips/` and are gitignored as
regenerable. The manifest beside them is tracked, and is the evidence.
Re-render with:

```
node src/skills/remotion-render/qa-scripts/render-beat-clips.mjs
```

## What would close the gap

Nothing in the render path. The 13 empty channels need a research + script run
against a reachable provider, and the 3 script-bearing channels need a b-roll
sourcing pass that records the search query alongside each file. Both are
blocked by this environment's egress policy, not by missing code.
