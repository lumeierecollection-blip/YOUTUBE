# Tokens, Entities, Verification — Final Report

Date: 2026-10-03
HEAD: 7ecfcdc (branch claude/visual-rebuild-from-5f91e75); last CI-tested commit f6f3850, run 37119036921
Iterations: 5 (the per-channel cap) — **target NOT met: no run reached 4/6 approved**

| Iteration | Run | Commit | Approved | approved-review | rejected | prep failed |
|---|---|---|---|---|---|---|
| 1 | 37108869325 | e94a529 | 0 | — | — | — |
| 2 | 37110620556 | ce9631a | **3** (ch-9, ch-26, ch-44) | ch-1, ch-48 | ch-2 | — |
| 3 | 37113140609 | 5fe7cec | 2 (ch-1, ch-48) | ch-2, ch-9, ch-26 | — | ch-44 |
| 4 | 37114977307 | 1730aed | 0 | ch-1, ch-44, ch-48 | ch-26 | ch-2, ch-9 |
| 5 | 37119036921 | f6f3850 | 0 | ch-2, ch-9, ch-26, ch-48 | ch-1 | ch-44 |

Best single run: 3/6 (iteration 2). Every channel except ch-2 was approved in at
least one iteration. Nothing was uploaded except the iteration-3 approvals (publish
attempted for ch-1 and ch-48, both private-first).

## Token reduction

- Before: ~8,800 tokens (planner prompt measured before part A)
- After: **2,187–2,802 tokens, median 2,404** — Gemini's own `usage.prompt_tokens`
  over 59 planner calls in iterations 1–5 (log line
  `[planner] ch-N: gemini prompt N tokens (cached: N), response N tokens`).
  Under the 4,500 target on every call. The offline budget test
  (`scripts/test-plan-gates.mjs`) holds a 12-sentence prompt under 4,500.
- Caching enabled: **no — implemented but unavailable.** `createCachedContent`
  (src/lib/gemini-client.js) is called every run; the free tier answers 429
  `TotalCachedContentStorageTokensPerModelFreeTier limit=0`, so the planner logs
  `[planner] gemini caching unavailable, using full prompt` and sends the full
  prompt. It switches on by itself on a paid key. `cached: 0` on every call above.
- How: the worked example moved to `prompts/scene-example.json`; rules consolidated
  into one decision order; fields the code derives (`direction`, `reason`,
  `emotional_weight`, `carries_forward`, `visual_headline`) are no longer asked for.
  No behaviour rule was removed — `test-plan-gates.mjs` asserts each is present.

## Company/institution entities (iterations 1–5, unique per run+channel+name)

- Extracted: 29
- Resolved to logo: 7 — Microsoft Research, ANYbotics (SVG→PNG), World Bank (it1);
  Bitget, FBI, Tigray People's Liberation Front (it3); FDIC (it5)
- Resolved to photo (headquarters): 1 — Hyundai Motor Group (it5)
- Fell to name card: 16 — mostly non-free logos (Boston Dynamics, Islamic
  Development Bank: Wikipedia's file is fair-use, not on Commons → refused, as the
  rule requires) or no Wikipedia article (Mitsubishi Power)
- Refused, no card: 5 — "AI", "ICE", "TPLF" (ambiguous acronyms); "POSCO", "DGIST"
  (it4 — fixed in f6f3850: an all-caps company/institution with a Wikipedia article
  describing it as one is now looked up; not yet exercised in CI)
- No company logo was ever fetched from Pixabay (Pixabay is not in the org path).

## Source credits

- Beats with credits: every beat that shows a fetched image (photo, logo, cutout,
  money scan) gets `canvas.source_credit` from its source URL
  (`sourceCredit()` in scripts/render-and-qa.js).
- Format verified: **yes, on a rendered frame** — run 37119036921 ch-26 beat 2
  (the $100 Wikipedia scan): "Source: wikipedia.org", bottom-right, small grey sans,
  fading in after the beat starts. Frames extracted from the qa-queues-26 artifact.

## Two-number comparisons

- Detected: 6 distinct beats. 3 are genuine comparisons; 3 were detector false
  positives on dates.
- Genuine comparisons rendered as a DATA-FULL chart:
  - ch-26 beat 5, "10 vs 50 million": BAR on every attempt (it1).
  - ch-44 beats 4 and 6, "90 vs 10": BAR on it2 attempt 1. On attempt 2 the model kept
    non-charts after the one allowed re-ask, and plan-repair made them
    PROCESS / COUNTER. This gap is open: forcing a chart in code would mean inventing
    bar labels.
- False positives:
  - ch-44 beats 1 and 5, "20% vs 2026" (a spelled year). Fixed in ce9631a.
  - ch-2 beat 3, "1 vs 2027" ("July 1, 2027"). Fixed in 6052710: a trailing
    comma is dropped, and a day of the month is skipped.

## PNG verification (three questions, 8 candidates)

- Total candidates tried: 75
- Accepted: 4
- Rejected: 71 (shows: 25, kind: 4, quality: 15, flat: 8, isolation: 43 — a
  candidate can fail several)
- Only YES + LITERAL + CLEAN (+ FLAT for money) was ever accepted; every
  `N candidates, 0 accepted` beat rendered without the object.

## Money PNGs

- Replaced: the Pixabay money path is now Wikipedia/Commons US-currency scans first
  (`moneyCandidates`, scripts/fetch-cutout-once.cjs), used as trimmed scans (no rembg).
- Flat check passed: 2 accepted in it5 (ch-2, ch-26: "a one hundred dollar bill",
  FLAT); 8 money candidates were rejected as ANGLED in earlier iterations.

## Per channel (iteration 5, run 37119036921)

| Ch | Approval | Entities | Credits | Comparisons | PNG pass |
|---|---|---|---|---|---|
| 1 | rejected — canvas-type "TYPE-FULL twice" (fixed after the run, a28dfc7) | 3 persons, no verified photo → name cards | 0 | 0 | — |
| 2 | approved-review — TEMPLATE_MONOCULTURE 67% | Maryland → MAP | 1 (money cutout; frame not checked) | 0 | 1/1 |
| 9 | approved-review — challenger rejected the plan twice | 4 orgs → name cards; Morocco → MAP | 0 | 0 | — |
| 26 | approved-review — TEMPLATE_MONOCULTURE 66% | FDIC → logo (verified, then rotated away; see blockers) | 1 (verified on frame) | 0 | 1/1 |
| 44 | prep failed — every discovered topic a duplicate | — | — | — | — |
| 48 | approved-review — TEMPLATE_MONOCULTURE 71% | Hyundai Motor Group → HQ photo; Boston Dynamics → name card (non-free logo) | 2 (HQ photo beats; frames not checked) | 0 | — |

## Fixes made in iterations 4–5

- 1730aed: a day of the month is not a hero number; a country or US state is its map.
- bfeb897: a namesake is not the person. "a man named David Rivera" got the
  congressman's portrait (it4 ch-26). Now a portrait is kept only if a text model
  says the sentence's person IS the Wikipedia subject (SAME), and "named X" is refused
  outright. A bare concept also gets its sentence's material ("plates" → "steel plates").
  Neither path came up in it5: no portrait or ambiguous concept was resolved.
- f6f3850: all-caps company/institution names (POSCO, DGIST) are looked up.
- a28dfc7: the rotation keys a bare-name card the way the audit does (it5 ch-1).
- 6052710: "July 1, 2027" is not a two-number comparison.

The last two commits came after the final run, and none of the it5-era fixes above
has been exercised in CI.

## Remaining blockers

- **TEMPLATE_MONOCULTURE** (`data/ci-runs/blocked-template-monoculture.txt`): the
  Gemini whole-video review flags 60–83% headline-led beats on essay-style scripts
  and sends them to approved-review. Beats get visuals only when the sentence names
  something, so abstract scripts stay mostly typography. Fixing this needs a content
  model decision from the owner, not a code change.
- **Discovery duplicates** (`data/ci-runs/blocked-discover-duplicate-topics.txt`):
  ch-44's topic log is saturated with AI-at-work topics after today's runs, and
  qwen2.5:3b proposes only duplicates. The dedup gate was not loosened.
- **One map highlights one region** (it5 ch-9): "Morocco, the UAE, and Jordan" drew
  only Morocco, and the challenger rejected the plan. Multi-region MAP is a renderer
  feature.
- **Two adjacent cutout heroes**: the audit forbids "TYPE-FULL+HERO twice", so a
  verified logo next to a money cutout is rotated away (it5 ch-26 FDIC → PROCESS).
- **Non-free logos**: most corporate logos on English Wikipedia are fair-use and are
  correctly refused, so companies often fall back to a name card.
