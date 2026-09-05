# Element-layer rebuild — audit (before any edit)

## 0. What actually exists (verified this session, not from memory)

No `visual/mechanism.js`, `visual/semantic-qa.js`, or `visual/camera.js` exist in
this repo (checked again — same as last pass's finding). The real module map:

| Named in the task | Actual file |
|---|---|
| `visual/mechanism.js` | `visual/strategies.js` (semantic contract: intent, dataNeeds, states) |
| `visual/semantic-qa.js` | `visual/run-visual-tests.js` + `visual/scope-check.js` + `visual/diagnostics.js` |
| `visual/camera.js` | `compositions/scenes/stage.jsx` (`Shot`, `Plane`) + `visual/composition.js` (per-strategy camera/framing/material) |
| `scenes/stage.jsx`, `scenes/index.jsx`, `scenes/structure-scenes.jsx` | `compositions/scenes/*.jsx` (no top-level `scenes/`) |

## 1. Per-file audit

| FILE | FUNCTION | CALLERS | CURRENT VISUAL PROBLEM | ACTION |
|---|---|---|---|---|
| `compositions/scenes/structure-scenes.jsx` | `CauseEffectScene` | `scenes/index.jsx` registry only | Flow "lanes" are thick curved `<path>` strokes converging through two chevron strokes — no object exists, it is line-weight primitives with more width than before | REPLACE body. Keep export name, state keys (`cause/link/effect/settle`), `sup.cause/effect/marker` |
| " | `ProcessScene` | " | ONE universal template (track + roller circles + rect workpiece) regardless of subject — exactly what §12 forbids. `sup.stages` is a bare count, no per-stage labels exist anywhere in the data pipeline (confirmed: `director.js:314` `supporting.stages = payload.stages \|\| 3`, nothing else) | REPLACE body with subject-family selection (deterministic keyword read of `beat.text`, same technique `VisualMetaphorScene` already uses for `mode`) driving which designed machine renders; cannot fabricate per-stage names that were never extracted — record this honestly |
| " | `TimelineScene` | " | Already staged (ground, depth, camera track) from the last pass; events are POSTS (footing + head rect), not designed marker objects. `sup.years` is bare year numbers only — no titles/descriptions exist anywhere in the data pipeline | REPLACE the marker with a designed `TimelineEvent` object; cannot invent per-event titles that don't exist |
| " | `RelationshipScene` | " | Not in this task's target list (§11-19 don't name it). Last pass already gave it filled nodes/bands | RETAIN as-is this pass |
| `compositions/scenes/quantity-scenes.jsx` | `AccumulationScene` | " | Grid of same-size cells (tray) or uniform rows (ledger) — no overlap, no depth, no irregularity; "many" reads as a spreadsheet, not a pile | REPLACE the item-layout with real overlap/depth/perspective stacking |
| " | `TransformationScene` | " | A plotted line + filled area (last pass) — still a chart, not an object changing state | REPLACE with an object whose own form interpolates between two states (own take on `ShapeMorphing`'s technique), value curve becomes secondary evidence not the whole picture |
| " | `ComparisonScene` / `OppositionComparison` | " | Two bars, or two strata fields — still two abstract masses, not two constructed things | REPLACE with two small constructed scenes (miniature composed states), each internally structured |
| " | `DataChartScene` | " | Standard bars (real convention, but flat — one rectangle each, no internal hierarchy beyond fill) | REPLACE with a designed `ChartColumn` (base, shadow, fill, cap, value, label as one object) — same real data, no invention |
| " | `ScaleComparisonScene` | " | Not in this task's target list | RETAIN |
| `compositions/scenes/evidence-scenes.jsx` | `DocumentEvidenceScene` | " | Page now has fill (last pass) but body copy is bare ruled bars — no heading hierarchy, no margin structure, no annotation object | REPLACE the page's internal construction; real narration phrase still the only text drawn (grounding rule unchanged) |
| " | `InterfaceSimulationScene` | " | Chrome + 3 rects + arrow-shaped progress, now filled (last pass) but still generic — no toolbar/nav/status hierarchy | REPLACE with a real windowed-app internal hierarchy; no invented product identity, stays abstract per §23 |
| " | `BeforeAfterScene` | " | A grid of cells, sparse vs dense — the field changes, not an object | REPLACE with one constructed object whose own state changes (shares the `elements/transform.jsx` morph object with TRANSFORMATION) |
| " | `ImageEvidenceScene` | " | Real `<Img>`, not a primitive construction problem | RETAIN — out of scope, not primitive-driven |
| `compositions/scenes/abstract-scenes.jsx` | `VisualMetaphorScene` | " | Not in this task's target list | RETAIN |
| " | `CinematicStatementScene` | " | Already object-free typography-in-a-shot by design (§21: "keep statement scenes… do not force mechanisms") | RETAIN, light touch only if a genuine defect is found on render |
| `compositions/scenes/GeospatialRadiusScene.jsx` | `GeospatialRadiusScene` | " | Benchmark — §20 explicitly forbids regressing it | RETAIN, unmodified |
| `compositions/scenes/primitives.jsx` | `Rule`, `Label`, `Figure`, `GroundPlane`, `MeasureBracket`, `Enter`, `seeded`, `variantOf`, state hooks | Every scene file, including the ones being rebuilt | These are genuinely low-level (a ruled line, a number, a fade-in) — exactly what §8 says may still exist "internally" as long as the user doesn't see primitive assembly AS the design | RETAIN in full. New `elements/*.jsx` files are built ON TOP of these, not a replacement for them |
| `compositions/scenes/stage.jsx` | `Shot`, `Plane`, `Ground`, `Falloff`, `shotFrame`, `FlowPath`, `pointOnFlow` | Every scene + `scenes/index.jsx` | Working staging/camera infrastructure — not a primitive-construction problem | RETAIN in full |
| `visual/composition.js`, `visual/director.js`, `visual/strategies.js`, `visual/states.js`, `visual/semantics.js` | (whole modules) | scene router, `mg-package.js`, tests | Semantic contract / timing / staging decision layer — this is the infrastructure §0 and §30 say to preserve | RETAIN. Zero edits planned; the state-key vocabulary (`cause/link/effect/settle`, `stages/advance/arrive`, etc.) is the contract the new element bodies read, unchanged |
| `visual/diagnostics.js`, `visual/run-visual-tests.js`, `visual/scope-check.js` | anti-template / registry / scope checks | CI-equivalent gate | Already does per-strategy shot-signature dedup (added last pass); does NOT check object-family sameness | EXTEND (§12/31 of this task): add an object-family/element-usage signature alongside the existing shot signature |

## 2. Real data available per target strategy (nothing beyond this may be shown)

| Strategy | `sup` fields that actually exist | Cannot show |
|---|---|---|
| CAUSE_EFFECT | `cause` (text), `effect` (text), `marker` (text) | per-lane quantities (none exist) |
| PROCESS | `stages` (a bare count, 2-6) | per-stage names/verbs (never extracted anywhere in the pipeline) |
| ACCUMULATION | `count`, `total`, `unit`, `countKnown` (bool) | any count/unit not literally in these fields |
| COMPARISON | `series[{label,value}]` (quantitative) OR `qualitative:true, leftPhrase, rightPhrase, pivot` | invented numeric values when only qualitative fields exist |
| TRANSFORMATION | `from`, `to`, `unit`, `labels[from,to]` | any intermediate value not on the `from->to` line |
| DATA_CHART | `series[{label,value,highlight?}]` (2-5 points) | more than 5 points, any invented highlight |
| TIMELINE | `years[]` (bare numbers, 1+) | event titles/descriptions (do not exist) |
| DOCUMENT_EVIDENCE | `phrase` (real narration text pulled out), page shape variant | fabricated statute/document body text |
| INTERFACE_SIMULATION | none (`dataNeeds: []`) | any real product identity/UI — stays abstract per §23 |
| BEFORE_AFTER | none (`dataNeeds: []`) | any specific before/after content — stays abstract, the object's state change is the content |

## 3. Reference repositories — actually cloned and read this session, not the README

| Repo | What was read | Adopted | Not adopted |
|---|---|---|---|
| `lifeprompt-team/remotion-scenes` | `DataAnimations/DataGauge.tsx`, `DataBarChart.tsx`; `LayoutAnimations/LayoutSplitContrast.tsx`; `ShapeAnimations/ShapeMorphing.tsx`; `UIAnimations/UICard.tsx`; `ListAnimations/ListTimeline.tsx` | (1) split-reveal via `clipPath: inset()` growing from two independent progresses, joined by a seam whose opacity is `min(a,b)` — used for `ComparisonRig`. (2) literal shape-morph via interpolated corner radius/proportions rather than swap-two-boxes — used for the shared transform object. (3) card internal hierarchy: label -> title -> body -> accent rule -> tag row, adapted (no fabricated body copy) for `DocumentSheet`/`InterfacePanel`. (4) per-bar spring-free staggered growth with value-above/label-below — already this repo's convention, confirms it | Its fabricated marketing copy ("OLD WAY", "FEATURED WORK", "24"), its gradients on bars, `spring()` physics (this repo has its own house easing, kept for consistency), any glow/blur |
| `fernandokaraka/remotion-motion-graphics-skill` | `references/patterns.md`, `traps.md`, `polish.md` in full | Craft checklist confirmed already covered by this repo's own infrastructure (tabular-nums already in `Figure`; complete enter/exit already from `states.js`; stagger already used; idle life already via `SustainCamera`) — used as a checklist, not a to-do list | Its glow/bloom/particle "payoff" and "effects and accent" recommendations — this repo's own material doctrine (MOTION-GRAPHICS-MANUAL.md, CHECK-REGISTER.md) explicitly bans glow/bloom/glassmorphism and that doctrine is not being overridden by a generic marketing-motion-graphics reference |
| `remotion-dev/skills` | Directory survey (`remotion-markup/*`, `remotion-maps/techniques/*`) | Confirmed these are the same skills already installed in this session (`remotion-markup`, `remotion-maps`, etc.) — no new technique needed beyond what's already available; `remotion-maps` techniques are real-tile-provider (MapTiler/Mapbox/Cesium) integrations, irrelevant since `GeospatialRadiusScene` is a deliberately stylised drawn map and out of scope (§20) | The tile-provider map techniques entirely — different architecture, not needed |

## 4. Plan

Build `compositions/scenes/elements/` (co-located with `primitives.jsx`/`stage.jsx`,
which already split "drawing tools" from "staging tools" — elements are the third,
missing layer: "designed objects," built ON `primitives.jsx`, staged BY `stage.jsx`).
Not `visual/elements/`: everything in `visual/` is a pure `.js` module consumed by
node (tests, gates) as well as the browser bundle; elements are React/JSX and belong
where `primitives.jsx` and `stage.jsx` already live.

One file per object family, matching the reference's own per-scene-file granularity:
`document.jsx`, `interface.jsx`, `machine.jsx` (shared by CAUSE_EFFECT + PROCESS),
`money.jsx`, `comparison.jsx`, `chart.jsx`, `transform.jsx` (shared by TRANSFORMATION
+ BEFORE_AFTER), `timeline.jsx`.

Rebuild order: CAUSE_EFFECT and PROCESS first (§11/12 explicitly "rebuild, don't
polish"), then DOCUMENT_EVIDENCE/INTERFACE_SIMULATION (extend last pass's fill fix
into real hierarchy), then ACCUMULATION, COMPARISON, BEFORE_AFTER/TRANSFORMATION,
DATA_CHART/TIMELINE. CINEMATIC_STATEMENT/GEOSPATIAL_RADIUS/RELATIONSHIP/
VISUAL_METAPHOR/SCALE_COMPARISON untouched, per §20/§21 and because they are not
named in this task's target list.
