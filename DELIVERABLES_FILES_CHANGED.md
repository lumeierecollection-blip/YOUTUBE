# Files Changed & Why

All files below are NEW (no existing files were modified), so no prior
production workflow was altered. No protected files (`debug_creds.js`,
`task.txt`) were touched. No secrets, tokens, or credentials were introduced.

## New files

| File | Purpose |
|------|---------|
| `config/sourcing/channel-sourcing.json` | Per-channel sourcing rules: niche, preferred sources, asset priorities, graphic preferences, forbidden fallbacks, cache isolation namespace, QA thresholds per channel (ch-01..ch-04). Defines cache categories (brand/channel/video/temp) and reuse policy. |
| `scripts/sourcing/cache-isolation.mjs` | Cache-key construction (channel + video/topic + subject/query + source + metadata), `recordAsset`/`lookupAsset`, `canReuse` policy (video-category assets not reused without justification; brand reusable within channel), `repetitionCount` for QA cross-video history. |
| `scripts/sourcing/video-researcher.mjs` | Video-specific research: reads the approved script, extracts named entities (people/places/orgs/products/events/objects/dates/statistics/concepts), breaks narration into per-beat visual beats, generates a specific sourcing query per beat, retrieves candidates from Wikimedia Commons. |
| `scripts/sourcing/asset-downloader.mjs` | Downloads + licence-verifies assets. Retains source URL, title, creator, licence, attribution, retrieval date, SHA-256 checksum, intended beat, relevance explanation. Relevance verification rejects wrong-person/irrelevant matches. Only explicit PD/CC licences accepted. |
| `scripts/sourcing/visual-plan-generator.mjs` | Builds the structured visual plan BEFORE rendering: per-beat number, narration, subject, visual intent, selected asset, source/licensing, relevance explanation, duration, transition, animation/camera movement. Unique per production. |
| `scripts/sourcing/run-test-pipeline.mjs` | Orchestrates research → download → plan → treatment → QA for one test video. |
| `scripts/graphics/visual-treatment-selector.mjs` | Graphics engine variety upgrade: selects a visual treatment by narration meaning (not a fixed sequence), consults per-channel recent-video history to avoid repetition, avoids consecutive identical treatments, emits a graphic usage report per video. |
| `scripts/qa/repetition-detector.mjs` | Repetition & relevance QA gate: duplicate images (hash), perceptual similarity, cross-video repetition, unattributed assets, licensing failures, excessive generic stock, missing narration-to-visual alignment, illustrative-without-reason. Pass/fail verdict. |

## No existing files modified

The following existing components were inspected and traced as root-cause
sources, but left intact so existing workflows keep working:
`scripts/entity-assets.cjs`, `scripts/editor/auto-plan.mjs`,
`scripts/editor/graphics.mjs`, `scripts/editor/visual-pack.mjs`,
`scripts/assets/download-historical-images.mjs`,
`src/skills/remotion-render/editor/components/VisualDirector.jsx`,
`src/skills/remotion-render/editor/components/VisualStorytellingEngine.jsx`,
`src/skills/remotion-render/visual-engine/beat-interpreter.js`.

The new pipeline runs alongside them; the renderer consumes the generated
`visual-plan.json` via `VISUAL_PLAN_PATH`.
