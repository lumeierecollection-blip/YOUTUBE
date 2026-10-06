# Handoff — ch-2 / ch-26 planner diagnosis (fleet 37540546857)

## The "planner failed" summary is wrong, or there is a second attempt

Both channels log a healthy first pass:

```
[planner] gemini caching unavailable, using full prompt
[planner] ch-2: prompt ~2,575 tokens (static ~2,319, dyn ...)
[gemini] key 1 project: unknown (every probed API is ...)
[gemini] key 2 project: unknown (every probed API is ...)
[gemini] key 3 project: 662788814396
[gemini-client] Tokens used: 3839
[gemini-client] Cache MISS for d58f4011823a
[planner] gemini key 1/3 answered
Gemini plan attempt 1 ha[s ...]
[planner] ch-2: gemini p[lan ...]
[gemini-client] Tokens u[sed ...]
[translate] description ...
[translate] beat 0: "A b..."
[translate] description ...
[translate] logo + numbe[r ...]
[translate] beat 1: "The..."
[translate] photo -> PH[OTO ...]
[translate] beat 2: "The..."
[translate] logo + type ...
[translate] beat 3: "The..."
```

ch-26 is identical in shape (`key 1/3 answered`, `Tokens used: 3903`, same
`key 1/2 project: unknown` pattern).

**So Gemini answered and the plan was being translated beat by beat.** The
workflow's summary line — `Visual planning failed (gemini, then ollama) — no
plan, no render` — does not describe that. Two readings, not yet discriminated:

1. there is a **second attempt** that failed after attempt 1 succeeded on paper
   (the log says "attempt 1", so a retry exists), and the summary reports the
   final state; or
2. the summary is emitted by a branch that fires on something other than "no
   plan", and the real failure is later in the step.

**Not isolated before context ran out.** ch-2's log is 2285 lines; the window
after `[translate] beat 3` was not read. That is the next read.

## What the log does establish

- **Not quota.** No `429`, no `RESOURCE_EXHAUSTED`, no `quota_exhausted`. All
  three keys were probed and key 3 answered.
- **Not starvation at the first attempt.** Ollama does not appear in this
  window at all; Gemini answered first.
- **Keys 1 and 2 are dead:** `project: unknown (every probed API is ena...)` on
  both channels, on every run. Only `GEMINI_API_KEY_3` (project 662788814396)
  works. The pipeline is running on **one** working key, not three. That is a
  real capacity finding even though it did not cause this failure.
- **`OPENCODE_MODELS: "ollama/qwen2.5:3b"`** is set workflow-wide, so the
  opencode-run stages use Ollama; the visual planner uses the Gemini key path
  directly (`SCRIPT_GEMINI_MODEL`). Two different providers, one env block.
- **`[planner] gemini caching unavailable, using full prompt`** on both — the
  cachedContents path is not working in CI, so every plan pays full prompt cost.

## Topic mismatch — `fetch-trending.cjs`

One paragraph, as it actually reads. `scripts/fetch-trending.cjs` holds a
hardcoded map `CATEGORY = { 1: 27, 2: 25, 9: 25, 26: 25, 44: 27, 48: 28 }` —
channel id to YouTube **video category** id, and only those six ids are mapped.
It calls `videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=...`,
filters to the last 7 days, ranks by velocity, and writes
`data/trending/<ch>.json`. It **does not filter by channel niche** and does not
read the channel's `niche` field at all; the only per-channel input is that one
integer. YouTube's `mostPopular` for a broad category like 28 (Science &
Technology) returns whatever is popular there, so a Broadsheet channel can be
handed a video about music-vibe coding tools. `data/trends/` and
`data/trending/` are then read by the discover stage, which is where a topic
that does not fit the style becomes a beat plan that does not fit the style.

**ch-05, ch-06, ch-08 and ch-10 are not in that map at all**, so
`fetch-trending.cjs` skips them ("no category mapping, skipped (unseeded
discovery)") and their topics come from the unseeded fallback — which is why
their topics are less channel-shaped than the six mapped channels'.

## Next push, stated not executed

Read the window after `[translate] beat 3` in ch-2's log to settle attempt-1
succeeded-then-retried versus a mislabelled summary. Then fix topic selection
for the four new channels — add them to `CATEGORY` with category ids that match
their niches — and re-run ch-05 and ch-10 individually. Do not run the fleet:
ch-1 and ch-8 were SIGTERMed on runner capacity.