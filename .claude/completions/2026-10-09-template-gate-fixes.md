# 2026-10-09 — template loophole, frame-review gate, label counter, no-repeat filter

Branch: fix/ollama-and-gemini-fallback (not merged). Evidence: board run 37837731824.

1. template-check.js: + "no device on more than two consecutive beats" (runsIn); old two-device clause kept.
   enforceChrome reports type-led runs of three as `unfixable` (removal cannot fix them).
2. render-and-qa.js: frame review always runs (frameReviewRuns); TEMPLATE_MONOCULTURE -> frameReviewHold ->
   backupAudit forceReject (rejected/). ch-26 on the board went to approved-review/ with exactly that verdict.
3. Label = any text drawn with its top edge in y < 620 (labelsDrawn / canvasManifest chrome.label.drawn).
   Board: old counter 0-1 labels/video, new 5-8; all 6 board manifests FAIL template-window now.
4. scripts/lib/used-images.js: one usedImages for every attach path, keyed by asset AND source_url
   (live cutouts / logos are beat-numbered paths). Concept attach moved to attachConceptVisuals (exported).

Open: with today's layouts (headline pinned top on most beats) template-window rejects nearly every render
at canvas-checks, before frame review. Layer 1 no-photo-repeat still keys by asset path only.
