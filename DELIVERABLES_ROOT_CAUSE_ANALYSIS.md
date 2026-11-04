# Root-Cause Analysis — Repeated Photographs & Repetitive Graphics

This document records the exact, code-traced reasons for the two production
problems, with evidence from the repository.

---

## Problem 1 — Repeated photographs across videos

### Root cause 1A: Global shared entity cache with no channel/topic isolation

**File:** `scripts/entity-assets.cjs`

The entity resolver (`resolveEntity`) stores every resolved photo in a single
shared manifest at `src/skills/remotion-render/public/entities/manifest.json`,
keyed only by `type:name` (e.g. `person:Margaret Clitherow`,
`place:York`). There is **no channel ID, no video/topic ID, and no subject
suffix in the cache key**.

Consequence: the first video to resolve "York" (e.g. the Margaret Clitherow
video) caches a York photograph. Every later video on **any channel** that
mentions York receives the exact same photograph, regardless of topic, period,
or subject matter. A photograph of a person, event, product or location is
reused automatically merely because it exists in the cache — directly
violating the reuse policy.

Evidence:
- `MANIFEST = join(PUBLIC, "entities", "manifest.json")` — one manifest for all
  channels.
- `const key = `${type}:${String(name).trim().toLowerCase()}`;` — key has no
  channel, video, or topic component.
- `if (cached && existsSync(join(PUBLIC, cached.asset))) return { ok: true, ...cached, cached: true };` —
  non-person cached entities are returned **without re-verification**, so a
  stand-in photo is silently reused indefinitely.

### Root cause 1B: Non-person cached entities returned without re-verification

In `resolveEntity` (line ~437), places and organizations served from cache skip
the identity check entirely (only persons are re-verified via
`verifyPersonImage`). A "courthouse" photo cached for one court case is reused
for every unrelated court case — an "unrelated courtroom photograph presented
as case-specific" fallback, which the directive forbids.

### Root cause 1C: Explicit photo-reuse pool in the automatic editor

**File:** `scripts/editor/auto-plan.mjs` (lines ~272-277)

When no photo is found for a sentence, the editor reuses an existing photo up
to 5 times:

```js
const pool = Object.keys(assets).filter((a) => /^(photo|concept)-/.test(a) && a !== lastAsset && uses(a) < 5)
...
const reuse = pool[Math.floor(rng() * Math.min(pool.length, 2))];
scene = { ...base, id: `s${i}-${reuse}-again`, asset: reuse, ... };
how = `${reuse} again, re-framed`;
```

This deliberately reuses the same photograph across multiple beats within a
video, and `lastAsset` only prevents immediate consecutive repetition — the
same photo can reappear many times.

### Root cause 1D: Hardcoded entity lists locked to one historical story

**File:** `src/skills/remotion-render/editor/components/VisualDirector.jsx`

`classifyVisualIntent` hardcodes `margaret clitherow`, `guy fawkes`,
`christopher wright`, `john wright`, `york`, `london`, `paris`, `rome`,
dates `1586|1605|1570|1606`. These are specific to the Margaret Clitherow /
Gunpowder Plot story but are applied to every video, so unrelated history
videos are classified and illustrated with Clitherow/Fawkes/York-centric
logic.

### Root cause 1E: Static curated visual packs reused per channel

**Files:** `scripts/assets/download-historical-images.mjs`,
`data/editor/visual-packs/ch1-*.json`, `ch2-*.json`

Visual packs contain exact Commons file titles ("curated pack; no keyword
search"). `ch1-margaret-clitherow.json` is reused for Channel 1 videos.
`applyVisualPack` (`scripts/editor/visual-pack.mjs`) ties each image to a
sentence index, but the pack itself is static per channel — every Channel 1
history video draws from the same nine-image pool regardless of topic.

---

## Problem 2 — Repetitive graphics / visual treatments

### Root cause 2A: Graphics engine limited to 5 figure types

**File:** `scripts/editor/graphics.mjs`, function `chooseKind()` (lines 40-46)

```js
export function chooseKind(figs, rng, look) {
  if (figs.length === 1 && figs[0].kind === "year") return "year";
  const pcts = figs.filter((f) => f.kind === "percent" && f.value >= 0 && f.value <= 100);
  if (pcts.length >= 2) return "bars2";
  if (pcts.length === 1) return ... "bar";
  return "count";
}
```

Every figure is rendered as one of: `year`, `bars2`, `bar`, `ring`, `count`.
There is no timeline, map, document, evidence-board, comparison, or
process-diagram treatment. The same small set of graphic components (bar,
ring, counter, sweep line, corner brackets) appears in every video regardless
of narration meaning. "Replace repetitive number-circle animations with another
repetitive universal template" is exactly what this does.

### Root cause 2B: Visual Director intent classifier hardcoded to one story

**File:** `src/skills/remotion-render/editor/components/VisualDirector.jsx`

`classifyVisualIntent` and `getVisualConfig` map a narrow set of hardcoded
names/dates to components (`PersonPortrait`, `PlaceMap`, `TimelineMarker`,
`StatCard`, `ComparisonCard`, ...). The default falls back to `PLACE` →
`HistoricalScene` / `PlaceMap`. Every video gets the same intent→component
mapping, so graphics are selected by keyword, not by narration meaning. The
default `PLACE` means any non-matching sentence becomes a map, even when a
timeline or photograph is correct.

### Root cause 2C: No per-channel recent-video history consulted

The graphics engine has no concept of "what did this channel show in recent
videos?" so it freely repeats the same opening/middle/closing animation
sequence across videos. `deduplicateConsecutive` and `capPercentages` in
`beat-interpreter.js` only rotate within a single video's 8 mechanisms; they
do not consult cross-video history.

### Root cause 2D: Templates override the visual plan

The editor's `graphics.mjs` decoration layers (`sweepLayers`,
`decorationLayers`) draw the same accent sweep / corner brackets on every
photo scene "so a photo is never just a held still" — pure decoration that
states nothing, repeated identically across videos. The visual plan (if any)
does not override these decorative templates.

---

## Summary of confirmed causes

| Problem | Cause | File |
|---------|-------|------|
| Repeated photos | Global entity cache, keyed `type:name` only, no channel/topic | `scripts/entity-assets.cjs` |
| Repeated photos | Non-person cache returned without re-verification | `scripts/entity-assets.cjs` |
| Repeated photos | Explicit reuse pool (same photo up to 5×) | `scripts/editor/auto-plan.mjs` |
| Repeated photos | Hardcoded Clitherow/Fawkes/York/1586/1605 lists | `VisualDirector.jsx` |
| Repeated photos | Static per-channel visual packs | `download-historical-images.mjs`, `visual-pack.mjs` |
| Repetitive graphics | 5 figure types only (year/bar/ring/count) | `graphics.mjs chooseKind()` |
| Repetitive graphics | Intent→component map hardcoded, default=PLACE | `VisualDirector.jsx` |
| Repetitive graphics | No cross-video recent-history consulted | `beat-interpreter.js` |
| Repetitive graphics | Decorative templates override the plan | `graphics.mjs decorationLayers/sweepLayers` |

---

## How the fix addresses each cause

1. **Per-channel, per-video cache keys** combining channel + video/topic +
   subject/query + source + metadata (`scripts/sourcing/cache-isolation.mjs`).
   A new video never inherits another video's visual identity.
2. **Separate cache categories** (brand, channel, video, temp). Brand may be
   reused; video-category assets are not reused across videos without
   documented justification.
3. **Video-specific sourcing pipeline** (`scripts/sourcing/video-researcher.mjs`,
   `asset-downloader.mjs`) that reads the script, extracts entities, builds
   per-beat queries, and verifies relevance + licensing before accepting any
   asset.
4. **Relevance verification** rejects wrong-person matches (e.g. "Charlie
   Hills" no longer matches "Charlie Russell").
5. **Graphics engine** (`scripts/graphics/visual-treatment-selector.mjs`)
   selects treatments by narration meaning, consulting per-channel recent
   history to avoid repetition, and emits a graphic usage report per video.
6. **Visual plan before rendering** (`scripts/sourcing/visual-plan-generator.mjs`)
   records per-beat intent, asset, licensing, duration, transition, animation.
7. **QA repetition gate** (`scripts/qa/repetition-detector.mjs`) detects
   duplicates, cross-video repetition, missing assets, licensing failures,
   and excessive generic stock.
