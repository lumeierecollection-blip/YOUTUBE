# Handoff — topic-selection root cause CONFIRMED

## The four new channels never had a trending feed at all

Traced end to end, this run:

1. `.github/workflows/daily-pipeline-v2.yml:116` normalises the requested id by
   stripping the `ch-` prefix and leading zeros, so ids are **bare numbers**.
2. `:123` emits `channel_id: id` — so `matrix.channel_id` is `"5"`, `"10"`.
3. `:206` runs `node scripts/fetch-trending.cjs "${{ matrix.channel_id }}"`.
4. `scripts/fetch-trending.cjs:51` does `CATEGORY[Number(ch)]` — a lookup in the
   **numeric-id** namespace.
5. `5, 6, 8, 10` are not keys in that map, so it logs
   `no category mapping, skipped (unseeded discovery)` and returns.

**So ch-05, ch-06, ch-08 and ch-10 get zero trending seed and fall through to
unseeded discovery.** That is not "a topic from a too-broad category" — it is
*no category at all*. A newspaper-history channel drawing a music-vibe-coding
topic is unseeded discovery picking freely, not category 28 misfiring. The
niche-filter idea is still right, but the filter is second-order: the four
channels have to be in the map before a filter can act on them.

The six built channels resolve fine: `1, 2, 9, 26, 44` are each unique, and map
to ch-01, ch-02, ch-09, ch-26, ch-44 respectively.

## `CATEGORY[48] = 28` is a dead entry

There is no channel with `id=48`. That mapping has never done anything.

## Why the migration was NOT finished — the landmine

`id` is **not unique** in `config/channels.json`. Verified collisions:

```
id=5   -> ch-26 (Harmony, Music Theory)     and   ch-05 (Broadsheet)
id=6   -> ch-30 (Nash, Game Theory)         and   ch-06 (Archive Room)
id=8   -> ch-50 (Synapse, Cognitive Science) and   ch-08 (Ledger)
id=10  -> ch-31 (Word Lab, Linguistics)      and   ch-10 (Margin Note)
```

For the legacy rows, `channel_id` does not follow `ch-` + pad(`id`) — `ch-26`
carries `id=5`. So the workflow's own normalisation (`ch-`+pad → bare number)
and channels.json's `channel_id` are **not inverses of each other**, and there
is more than one row with `channel_id: ch-26`.

Re-keying CATEGORY by `channel_id` therefore requires a lookup that resolves a
bare id to exactly one row, and the obvious candidate — `ch-` + zero-pad — is
only correct by convention for the four *new* channels, not for the legacy rows.
Getting that wrong silently re-points a built channel's category.

This needs a decision, not a rushed edit:

- **Option A** — resolve via `ch-` + pad, accept that it is convention-only and
  wrong for legacy rows; safe *today* because only the four new channels are
  dispatched by those ids. Document the trap.
- **Option B** — fix the duplicate `id` values first (a data migration on 48
  rows, well outside "logs only"). Cleanest, much larger blast radius.
- **Option C** — key CATEGORY by the bare id the workflow already passes, and
  add `5: 25, 6: 24, 8: 25, 10: 27`. Smallest diff, but leaves the duplicate-id
  trap in place for the next person.

Option A is what I would ship, with the convention documented at the map.

## Still open

- The planner-summary question (ch-2: what fires
  `Visual planning failed (gemini, then ollama) — no plan, no render` when
  attempt 1 answered and beat translation ran). Unread window after
  `[translate] beat 3` in run 37540546857.
- Two dead Gemini keys (`project: unknown` on keys 1 and 2, both channels) —
  pipeline is on 1/3 of its real quota. Credential issue, outside this repo.
- Nothing was run. No channel was dispatched.
