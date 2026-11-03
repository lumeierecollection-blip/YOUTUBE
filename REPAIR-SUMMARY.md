# CREATIVE PIPELINE REPAIR — Summary

**Branch:** `feat/fix-creative-pipeline` (from `feat/visual-storytelling-proof` @ `9000d0f8`)  
**Status:** Code fixes complete, tests passing (89/89), cannot render MP4 (no GitHub credentials to push; no local ffmpeg/Chrome)

---

## Root cause

The concept extraction and beat planning layer was **correct**: 21 beats for Channel 1, multiple concepts per sentence, zero uncovered concepts, appropriate motion types per visual class.

The failure was in **asset resolution** and **timeline composition**:

1. **`coverage-assets.mjs` `resolveAsset`** — only tried Wikipedia lead images (person/org), Commons search (object/place), and Google Patents PDF (document). Most concepts (historical people without Wikipedia images, events, states, relations) fell back to **label cards** (generic black cards with white text). Channel 2 had ZERO photo beats — all 17 beats were diagrams or text labels.

2. **`coverage-timeline.mjs` `beatLayers`** — rendered every beat identically: full-frame black background, one photo (if available) at fixed position, labels at fixed positions, diagrams at fixed positions, plus **unmotivated pan drift on ALL layers** (tx 40px / ty 30px) — explicitly prohibited by skill §5.2 ("unmotivated parallax").

3. **`coverage-audit.mjs`** — QA only checked technical properties + provenance. Label cards passed because they have credit + source_url. No check for label card dominance, person/place photos, or visual variety.

---

## Repairs made

### 1. `scripts/editor/coverage-timeline.mjs` — Composition + motion

**Removed:** Unmotivated pan drift on all layers (the `tx`/`ty` keyframe loop that moved every layer 40px/30px). This was decorative movement the skill prohibits.

**Added:** `compRect(visualClass, hasPhoto)` — each visual class gets a distinct composition:

| Visual class | Photo layout | Label position | Diagram |
|---|---|---|---|
| historical | Portrait (contain, 130,300,820,1000) | Bottom zone | Prominent (420,940) |
| document | Full-frame cover | Lower third | None |
| place | Full-frame cover | Lower third | None |
| entity | Right-side portrait (540,300,460,1000) | Left side (420,420) | None |
| photo | Full-frame cover | Lower third | None |
| figure | None | Upper zone | Prominent (300,940) |
| diagram | Portrait (contain) | Lower third | Prominent (300,1000) |

Motion is now purposeful: `push_in`/`push_out` for historical, `pan_left` for place, `draw` for diagrams, `settle` for documents/photos — matching the `beat.motion` from the plan.

### 2. `scripts/editor/coverage-assets.mjs` — Broadened asset resolution

**Before:** Person/org → Wikipedia only. Object/place → Commons only. Everything else → label card.

**After:**
- Person/org: Wikipedia lead image → Commons search for the name → label card
- Object/place: Commons search → Wikipedia lead image (places only) → label card
- Event/relation/state/etc.: Wikipedia lead image of named entity → Commons search for the named entity → label card

This gives more concepts a real photograph instead of a label card. For example, Channel 2's "WSO2" organization and Channel 1's "Guy Fawkes" person now have Commons fallbacks if Wikipedia lacks a lead image.

### 3. `scripts/editor/coverage-audit.mjs` — Creative QA checks

Added two new failure checks:

- **Label card dominance:** Fails when >50% of image assets are label cards. A video dominated by label cards is generic text-on-black, not visual storytelling.
- **Person/place photos:** Fails when a person/place image layer uses a label card instead of a photograph. Person and place concepts should be represented by real photographs where available.

### 4. `scripts/__tests__/editor-coverage.test.js` — Updated test

Replaced the test that asserted pan drift on ALL layers (the old broken behavior) with a test that asserts:
- Image layers have scale keyframes (purposeful motion)
- Diagram layers have draw keyframes
- NO layer has unmotivated tx/ty pan drift

---

## Test results

| Test suite | Result |
|---|---|
| `editor-coverage.test.js` | 15/15 pass |
| All `editor-*.test.js` | 89/89 pass |

---

## What changed visually (Channel 1 example)

**Before:** Every beat = black background + white text at y=980+k*120 + SVG diagram at (90,400) + pan drift on every layer. All 21 beats look essentially identical.

**After:** Each beat has a distinct composition:
- `figure` beat (1586): diagram prominent at top, labels at y=1300
- `historical` beat (pregnant mother): portrait photo area, labels at bottom
- `place` beat (York): full-frame photo, pan_left motion, labels lower third
- `entity` beat (Margaret Clitherow): photo on right side, large name label on left
- `diagram` beat (refused to plea): diagram prominent, photo secondary

No unmotivated movement. Motion matches the narration (push_in on historical reveals, pan_left on places, draw-on for diagrams).

---

## What still needs to happen (requires GitHub credentials)

1. **Push the branch** to trigger GitHub Actions `visual-storytelling-proof.yml` workflow
2. **Render Channel 1 MP4** via GitHub Actions (run 41506497982 showed the pipeline works end-to-end at `9000d0f8`)
3. **Inspect the actual MP4** — download artifact, extract frames, verify visuals match narration
4. **Run Channels 2 and 48** through the same pipeline
5. **Director reviews** the actual MP4s and contact sheets

Cannot complete steps 1–4 without GitHub push credentials (push hangs on authentication) and without local ffmpeg/Chrome for local rendering.

---

## Files changed

| File | Change |
|---|---|
| `scripts/editor/coverage-timeline.mjs` | Removed pan drift; added per-visual-class composition |
| `scripts/editor/coverage-assets.mjs` | Broadened resolveAsset sources (Commons fallback for person/org/place) |
| `scripts/editor/coverage-audit.mjs` | Added label-card dominance + person/place photo QA checks |
| `scripts/__tests__/editor-coverage.test.js` | Updated motion test to reject unmotivated pan drift |
