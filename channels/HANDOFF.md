# Handoff — the topic bug was NEVER the trending category

## What actually happened on 37549155059

```
[research] ch-5: trending topics loaded (4)
[research] ch-5: focus pillar "rhythm patterns" (0 recent topic(s) touch it)
[research] ch-5: trending topics loaded (4)
[research] ch-5: focus pillar "financial crime cases" (0 recent topic(s) touch it)
[discover-topics] ch-?: answer model gemini (gemini-3.5-flash-lite), ollama fallback
[discover-topics] queries from input: "acoustics news October 2026",
                   "music psychology news October 2026", "composition techniques..."
```

**Two different focus pillars, both labelled `ch-5`.** One is `rhythm patterns`
(Harmony, music theory). One is `financial crime cases` (Broadsheet, the real
ch-05). And the discover queries are about **acoustics and music psychology** -
Harmony's niche, not Broadsheet's.

## Root cause

`scripts/build-discovery-context.js:33`:

```js
.filter((c) => !channelOverride || String(c.id) === String(channelOverride))
```

It resolves the channel by **`c.id`** - the ambiguous namespace - and does NOT
break on the first match. For override `5` that matches TWO rows:

    id=5 -> ch-05 Broadsheet  (True Crime & Investigative Journalism)
    id=5 -> ch-26 Harmony     (Music Theory & Composition)

Both survive into `out`, which is why `trending topics loaded (4)` and a focus
pillar print TWICE.

Then `scripts/ollama-agent.js:295`:

```js
const ch = (input.channels || [])[0];
```

It silently takes **`[0]`** - whichever row JSON order put first - and builds the
entire discovery context from that. That was Harmony. Hence acoustics queries,
hence `moth-wing-acoustic-material`.

Line 45 compounds it: both rows read `data/trending/${c.id}.json`, i.e. the SAME
`5.json`, so the true-crime feed my fix produced was loaded into the music
channel's context and then ignored.

Line 462 logs `ch-?` because `--channel-id` is never passed to the agent, so the
label is empty. Cosmetic, but it is why the log gave no clue which channel it
thought it was.

## This retro-explains the fleet run

Run 37540546857 gave ch-05 the topic `google-flow-music-vibe-coding-tools`. That
is a **music** topic. Broadsheet is newspaper-history; Harmony is music theory.
ch-05 has been receiving the music channel's topics this entire time.

So the whole topic-mismatch investigation - the missing CATEGORY entries, the
niche filter, the pillar widening - was chasing a symptom. The trending work
was worth doing (the filter demonstrably works: 44 -> 4, true-crime titles kept)
but it was never the cause. `google-flow-music-vibe-coding-tools` and
`moth-wing-acoustic-material` are both Harmony's niche arriving through a
duplicate-`id` lookup.

## The same bug class, unfixed, in the path I already touched

`fetch-trending.cjs` got a collision guard in 07ddeb0. That guard protects
`fetch-trending.cjs` only. `build-discovery-context.js` does its own lookup, in
the same run, with the same ambiguity, and has no guard at all.

## Not fixed here - this is a decision, not a one-liner

Same fork as the CATEGORY migration, and the user already chose Option A there
(resolve by `channel_id`, guard loudly). Applying it here means deciding whether
`build-discovery-context.js` resolves by bare `channel_id` - which would change
what ch-26/ch-30/ch-31/ch-35/ch-39/ch-44/ch-46/ch-47/ch-49 receive - or fixing
the duplicate `id` values first. Not a one-line change and not authorised in
this push.

## Also confirmed this run

- `discover-topics` does NOT fail on ollama. The ollama hypothesis is **refuted**.
  It answers via `gemini-3.5-flash-lite` with ollama as fallback. What failed was
  upstream: the context it was given described the wrong channel.
- `PREP_CALL_TIMEOUT_S: 300`, `OLLAMA_MODEL: qwen2.5:3b`, `OLLAMA_URL:
  http://127.0.0.1:11434`, all set. No timeout or load error in the log.
- Five key secrets are present (`GEMINI_API_KEY`, `_1`, `_2`, `_3`,
  `GOOGLE_GENERATIVE_AI_API_KEY`) - all four numbered ones resolve, so the
  "dead keys 1 and 2" claim needs re-checking against what `project: unknown`
  actually meant. Not resolved here.

## Next push

Fix the channel lookup in `build-discovery-context.js` so a dispatched bare id
resolves to exactly one channel, using the same `channel_id` convention and the
same fail-loud collision guard already shipped in `fetch-trending.cjs`. Then
re-dispatch ch-05 and check the topic is true crime. That is one push and it
tests the widening for the first time. Do not run the fleet.
