# ROOT CAUSE ANALYSIS — Creative Pipeline Failure

**Repository:** `lumeierecollection-blip/YOUTUBE`  
**Branch:** `feat/fix-creative-pipeline` (created from `feat/visual-storytelling-proof` @ `9000d0f8`)  
**Investigation target:** Why the `remotion-render` skill is not reflected in actual rendered videos

---

## Summary

The **concept extraction and beat planning layer works correctly** — it produces multiple visual beats per sentence, covers every essential concept, and assigns appropriate motion types. The failure is entirely in **asset resolution** and **timeline composition**: most concepts fall back to generic label cards instead of real photographs, and every beat is rendered with the same repetitive composition regardless of its visual class. The QA gate passes because it only checks technical properties and provenance, not creative quality.

---

## Execution chain trace

Each stage below shows source, input, output, and whether the skill is followed.

### 1. Narration understanding — `scripts/editor/coverage-plan.mjs` (`extractCoverageConcepts`, `buildCoveragePlan`)
- **Input:** script JSON + research JSON + TTS word timings
- **Output:** sentences → concepts → beats, each with start/end time, visual class, diagram type, motion
- **Skill followed:** YES
- **Evidence:** Channel 1 produces 21 beats across 9 sentences; sentence 0 ("In 1586, a pregnant mother was brutally crushed to death in York") yields 4 concepts (1586, pregnant mother, crushing to death, York) → 4 separate beats. Zero uncovered concepts across all three channels.

### 2. Visual concept planning — `coverage-plan.mjs` (`groupConcepts`, `timeGroups`, `defaultMotion`)
- **Input:** concepts from stage 1
- **Output:** grouped beats with timing and motion type (push_in, push_out, pan_left, draw, settle)
- **Skill followed:** YES — motion types match visual class (historical → push_in/push_out, diagram → draw, place → pan_left)

### 3. Asset resolution — `scripts/editor/coverage-assets.mjs` (`resolveAsset`) — **FAILURE POINT #1**
- **Input:** concept (kind, label, visual, diagram)
- **Output:** resolved asset {file, width, height, credit, source_url, license, role} or null → label card
- **Skill followed:** NO — too narrow source coverage
- **Resolution logic:**
  - Person/organization → Wikipedia lead image ONLY → null if no page image → label card
  - Object/place → Commons search ONLY → null if no matching bitmap → label card
  - Document → Google Patents PDF ONLY → null if no PDF → label card
  - Event/relation/state/number/version/date → Wikipedia lead image of related named entity → null → label card
  - Diagram/annotated/figure → null (drawn as SVG by renderer, not an image file)
- **Result:** Most concepts get **label cards** (generic black card with white text), not real photographs. For Channel 2 (WSO2), ZERO beats resolve to photos — all 17 beats are diagrams or entity text labels. For Channel 1, only ~2-3 of 21 beats get real photos (Guy Fawkes Wikipedia image, York Commons image).

### 4. Timeline composition — `scripts/editor/coverage-timeline.mjs` (`beatLayers`) — **FAILURE POINT #2**
- **Input:** beat (concepts, photoAsset, diagrams, visual_class, motion) + assets
- **Output:** timeline layers (background, photo, scrim, credit, labels, diagrams)
- **Skill followed:** NO — one-size-fits-all composition
- **Composition logic (every beat, identical):**
  1. Full-frame black background solid (#08090B)
  2. At most ONE photo (full-frame `cover` fit) — only if photoAsset resolved
  3. Scrim overlay (rgba black 0.55) — only if photo exists
  4. Credit tag at bottom-left (fixed position)
  5. Text labels at FIXED positions (y: 980 + k*120, same for every beat)
  6. SVG diagrams at FIXED positions (x: 90, y: 400, same for every beat)
  7. **Pan drift on ALL layers** — tx moves 40px, ty moves 30px, then back (lines 97-110) — this is **unmotivated parallax**, explicitly prohibited by skill §5.2
- **Result:** Every beat looks essentially the same: black background + fixed-position labels + fixed-position diagram + (maybe) one photo. No layered compositions, no split screens, no PNG cutouts, no visual variety.

### 5. Rendering — `src/skills/remotion-render/render-editor.js` + `EditorTimeline.jsx`
- **Input:** timeline JSON + audio
- **Output:** MP4 via Remotion renderMedia
- **Skill followed:** YES — renderer draws exactly what's in the timeline, no layout opinions of its own
- **Note:** The renderer is not at fault; it faithfully renders the generic timeline it receives.

### 6. QA — `scripts/editor/video-qa.js` + `coverage-audit.mjs` (`auditCoverage`) — **FAILURE POINT #3**
- **Input:** rendered MP4 + timeline + coverage report
- **Output:** PASS/FAIL + technical metrics
- **Skill followed:** PARTIAL — checks technical properties + provenance + uncovered concepts
- **NOT checked:** whether visuals actually match narration subjects, whether label cards dominate, whether composition is repetitive, whether pan drift is unmotivated, whether transparent PNGs are used
- **Result:** QA passes with label cards because label cards have credit + source_url (provenance check passes) and pan drift satisfies the motion check.

---

## What the videos actually look like

Every channel's video is: **black background + white text labels at fixed positions + SVG diagrams at fixed positions + (rarely) one full-frame photo**. All beats share the same layout. Movement is the same pan drift on every layer. No transparent PNGs. No layered compositions. No visual variety.

This matches the user's observation: "the actual rendered videos look virtually identical to the previous failed outputs."

---

## Repairs required

| # | File | Repair |
|---|------|--------|
| 1 | `coverage-assets.mjs` | Broaden `resolveAsset`: person → Wikipedia → Commons → label card; org → Wikipedia → Commons → label card; object/place → Commons → Wikipedia → label card; add better fallbacks |
| 2 | `coverage-timeline.mjs` `beatLayers` | Remove unmotivated pan drift on all layers; vary composition by visual_class (portrait for historical, document close-up, diagram-prominent, full-frame for place); support layered compositions; support PNG cutouts |
| 3 | `coverage-audit.mjs` `auditCoverage` | Add creative QA: detect label card dominance, detect repetitive composition, check visual variety, verify real photos used for person/place concepts |
| 4 | `coverage-timeline.mjs` | Add PNG cutout support as layered elements; support multiple photos per beat for comparisons |

---

## Demonstration constraint

Cannot push to GitHub (no credentials — `git push` hangs on authentication). Cannot render locally (no ffmpeg, no Chrome). Code fixes are made locally and verified with unit tests. Actual MP4 demonstration requires GitHub Actions with credentials.
