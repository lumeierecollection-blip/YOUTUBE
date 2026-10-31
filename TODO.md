# Visual Storytelling Fixes - Implementation Plan

## 1. Remove SustainCamera meaningless drift (HIGH PRIORITY) - DONE
- [x] Remove or make meaningful the SustainCamera component in scenes/index.jsx
- [x] Remove SUSTAIN_DRIFT_PX and SUSTAIN_SCALE_GAIN from visual/composition.js
- [x] Update cameraSafe to not account for SustainCamera transforms

## 2. Support multiple concept visuals per beat (HIGH PRIORITY) - IN PROGRESS
- [ ] Modify gemini-visual-plan.js to identify multiple concepts per sentence (prompt already asks for up to 3)
- [x] Update rendering pipeline to use all concept_visuals (attachConceptVisuals already does this)
- [x] Ensure full-canvas.jsx renders all concept visuals per beat (already does)
- [x] Update canvas-layout.js heroShotLayout to create boxes for up to 3 concept visuals for ALL hero compositions

## 3. Fix PNG composition quality (HIGH PRIORITY) - DONE
- [x] Verify full-canvas.jsx handles cutouts with proper transparency
- [x] Check canvas-layout.js for proper cutout positioning
- [x] Add PNG quality validation in gate-visual-qa.js

## 4. Add explicit visual QA checks (HIGH PRIORITY) - DONE
- [x] Enhance gate-visual-qa.js with sentence-level coverage checks
- [x] Add PNG transparency validation
- [x] Add motion meaningfulness checks

## 5. GitHub Actions pipeline verification (HIGH PRIORITY)
- [ ] Check .github/workflows/daily-pipeline.yml for render stage
- [ ] Ensure all 3 channels can render
- [ ] Verify artifact collection

## 6. Test on all 3 channels (HIGH PRIORITY)
- [ ] ch-1 (minimal)
- [ ] ch-2 (motion-graphics)
- [ ] ch-3 (cinematic-documentary)
