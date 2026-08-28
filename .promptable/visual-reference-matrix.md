# Visual reference matrix — mass-over-line pass

Temporary audit doc (PART 37). Written BEFORE any scene edit in this pass,
from a real baseline render (`qa-scripts/inspect-anchors.mjs`, three fixtures
+ the real ch-02 legal script), not from memory of the last pass's numbers.

## What this pass is closing

CHECK-REGISTER.md 3.12.6 (last pass's own conclusion): composition, camera,
depth and ground are done for all 16 strategies. What is not done: 15 of 16
draw LINE (2-4px strokes) where GEOSPATIAL_RADIUS draws MASS (filled blocks,
filled radius). "Closing that gap means giving the other fifteen scenes real
filled mass, and that is per-scene design work, not another shared layer."
This pass is that per-scene work, scene by scene, not a new shared primitive.

## Baseline (this session, before any edit)

Measured via `inspect-anchors.mjs` against `qa-scripts/fixtures/*.fixture.json`
(ch-01, ch-48) and the real gate-passed `data/research/2/google-location-
history-chatrie-ruling-shorts-script.json` (ch-02). Fixture SRTs, silent
placeholder audio — FIXTURE-VERIFIED, not PRODUCTION-VERIFIED (PART 46).

| Strategy | v | ink | bbox | Line or mass now |
|---|---|---|---|---|
| GEOSPATIAL_RADIUS | 0/1 | 38.3% / 47.0% | 100x94% | MASS — benchmark |
| DOCUMENT_EVIDENCE | 0/1/2 | 4.7% / 3.4% / 4.7% | up to 88x78% | LINE — page fill = `colors.bg`, i.e. literally invisible; only the stroke border and 8-12px text bars carry any ink |
| SCALE_COMPARISON | 0 | 2.9% | 100x44% | Mixed — filled cells once grown, outline grid before |
| CAUSE_EFFECT | 0 | 2.4% | 92x74% | Mixed — already flow-ribbon strokes up to 9px (prior pass) |
| PROCESS | 0/1 | 2.3% / 2.1% | up to 99x94% | Mostly LINE — track/queue fills exist but at 0.05-0.09 opacity, below stage.jsx's own documented ink-visibility floor |
| VISUAL_METAPHOR | 0 | 1.9% | 96x81% | LINE — 5 concentric stroke-only rings |
| TIMELINE | 0 | 1.4% | 99x59% | Mostly LINE — ground/ticks are hairlines; period-band fill at 0.07-0.09 |
| ACCUMULATION | 0/1 | 1.2% / 5.4% | — | v0 (tray) LINE — outline boxes; v1 (ledger) already MASS |
| CINEMATIC_STATEMENT | 0 | 1.7% | 100x49% | Intentionally sparse (register 3.12.5) — NOT a target |
| DATA_CHART | 0/1 | 0.8% / 1.3% | up to 80x74% | LINE — bars outline-only except the one highlighted bar |
| INTERFACE_SIMULATION | 0 | 0.8% | 67x27% | LINE — chrome/rows outline-only, same `fill=none` bug as DOCUMENT_EVIDENCE's page |
| COMPARISON (quant.) | 0 | 0.7% | 65x42% | Mixed — winner bar filled, loser outline |
| TRANSFORMATION | 0 | 0.6% | 96x28% | LINE — 4px plotted path, no area |
| RELATIONSHIP | 0 | 0.5% | 70x40% | LINE — weakest scene; hairline links, stroke-only 16px nodes |
| COMPARISON (qual./Opposition) | 0 | 2.8% | 100x61% | LINE — 9 hairline "strata" per side |
| IMAGE_EVIDENCE | — | unmeasured | — | No real sourced asset resolved in this sandbox (0/N sections); real photo IS mass by construction, not a target of this pass, status stays UNVERIFIED per PART 47 |

## Why fill = `colors.stroke`/`colors.accent` at opacity, not `colors.surface`

`styles/tokens.js`: `surface` and `raised` both collapse to `bg` (literally
`#FFFFFF`/`#000000`, identical to the canvas). Any scene that fills a shape
with `colors.surface`/`raised`/`bg` paints it the same colour as the void
behind it — invisible mass. GEOSPATIAL_RADIUS already worked around this
(`GROUND_ALPHA`/`BUILDING_ALPHA` off `colors.stroke`, documented inline).
DOCUMENT_EVIDENCE and INTERFACE_SIMULATION did not, and it is a real bug in
both, not a style question: the "page" and the "window" are, right now,
invisible except for their stroke outline.

## Reference (Liamrjohnston/remotion-motion-graphics-skill) — actually fetched, not assumed

| File | Mechanism | Adopt | Do not adopt |
|---|---|---|---|
| `skills/cinematic-camera/SKILL.md` | Shared world 2-2.5x viewport, keyframed focal-point+zoom arrays, holds via repeated adjacent keys, explicit rejection of "slow zoom as the only camera idea" | Already implemented here (`compositions/scenes/stage.jsx` `Shot`/`Plane`, `visual/composition.js` framings/camera) — confirms no camera-architecture change is needed this pass | Its literal `KEY_T` array / intake workflow |
| `skills/motion-graphics/references/rejected-patterns.md` | Bans generic editorial props, fake dashboards, decorative motion, fabricated proof | Already the doctrine here (no invented UI/metrics, real sourced photos only) — used as a checklist against the fills added below | — |
| `skills/article-highlights/SKILL.md` | Layered paper: surface -> paper card -> marker -> text; paper is a real warm-white/off-white filled surface, not an outline | DOCUMENT_EVIDENCE's page needs an actual filled paper layer, same idea, restrained (`colors.stroke` at low opacity, not a literal off-white card — this system has no such token and inventing one would break `bg_mode`) | Its rough.js marker-stroke renderer, its 4:3/9:16 dual-format setup |
| `skills/motion-graphics/references/visual-critic.md` | 8-axis rubric (research/reference fidelity, concept specificity, product authenticity, mobile readability, composition, motion causality, material restraint), pass = all >=8 | Used below as the self-critique frame for each edited scene | Its 0-10 scoring ritual / hard-fail auto-reject list (this repo's own CHECK-REGISTER already plays that role) |

## Per-scene plan (this pass)

| Strategy | File | Change | Semantic justification |
|---|---|---|---|
| DOCUMENT_EVIDENCE | evidence-scenes.jsx `DocumentEvidenceScene` | Page fill `colors.bg` -> `colors.stroke` @ ~0.07 opacity (matches `PaperGround`'s own paper aesthetic) | A document is a physical page; an invisible page is a bug, not a restraint choice |
| INTERFACE_SIMULATION | evidence-scenes.jsx `InterfaceSimulationScene` | Window chrome `fill="none"` -> filled panel @ ~0.05 opacity; request/result rows get real fill | Same invisible-container bug as the page; a screen has a surface |
| RELATIONSHIP | structure-scenes.jsx `RelationshipScene` | Nodes: stroke-only 16px rings -> filled discs. Links: 1.8-4px hairlines -> width-varying filled ribbons | FIELD material — entities with mass in a field of influence, not a wireframe graph |
| TRANSFORMATION | quantity-scenes.jsx `TransformationScene` | Add filled area between the plotted path and baseline, growing with `pGrow` | The area IS the accumulated change; a bare line answers "what value" but not "how much changed" |
| COMPARISON (quant.) | quantity-scenes.jsx `ComparisonScene` | Loser bar `fill="none"` -> filled at reduced opacity | Standard, non-invented bar convention; both quantities should read as mass, not one mass + one wireframe |
| COMPARISON (qual.) | quantity-scenes.jsx `OppositionComparison` | 9 hairlines/side -> ~5 filled trapezoidal bands per side | Literal: sedimentary strata are filled rock layers, not line drawings — the metaphor already named in the code becomes the picture |
| DATA_CHART | quantity-scenes.jsx `DataChartScene` | Non-highlighted bars `fill=none` -> filled at reduced opacity | Standard bar-chart convention |
| ACCUMULATION (tray, v0) | quantity-scenes.jsx `AccumulationScene` | Item `fill=none` outline -> filled, matching the ledger variant's existing treatment | A coin/charge is a solid unit, not a wireframe; consistent with v1 |
| VISUAL_METAPHOR | abstract-scenes.jsx `VisualMetaphorScene` | Stroke-only rings -> filled bands between consecutive rings (annuli), graduated opacity | FIELD material's own description in stage.jsx: "isolines of a potential" — filled contour bands are the correct rendering of a potential field, hairline ellipses are not |
| PROCESS | structure-scenes.jsx `ProcessScene` | Track/queue fill opacity 0.05/0.09 -> ~0.11/0.16 | stage.jsx's own documented finding: 5% opacity lands ~12/255 from bg, under this repo's measured ink-visibility floor |
| TIMELINE | structure-scenes.jsx `TimelineScene` | Period/consequence band fill 0.07/0.09 -> ~0.14/0.16 | Same documented floor as PROCESS |

Not touched this pass, with reason:
- GEOSPATIAL_RADIUS — benchmark, no defect found.
- CINEMATIC_STATEMENT — register 3.12.5 already treats its low ink as
  correct for a deliberately sparse terminal fallback; ridge/foreground
  silhouettes are already filled mass, the sparseness is the composition.
- CAUSE_EFFECT — already carries filled-adjacent flow ribbons (up to 9px,
  prior pass took it 0.6%->4.1%); left alone rather than re-touched without
  a specific rendered defect.
- SCALE_COMPARISON — already mostly filled once grown; low priority.
- BEFORE_AFTER — "after" side is already filled mass; the density contrast
  (sparse outline before / dense fill after) is meaningful, not a defect.
- IMAGE_EVIDENCE — no code path to fix; status stays unverified until a real
  sourced asset renders (PART 47).

## QA method for this pass

1. Baseline captured above (this file).
2. Edit, per scene, guided by the table above only — no scene gets mass it
   cannot semantically justify.
3. Re-run the same three `inspect-anchors.mjs` invocations, same fixtures,
   same channel ids — a same-tool before/after, not a new metric.
4. Open the changed PNGs (not just the numbers) and apply the mute test
   (PART 50) to each.
5. `node visual/run-visual-tests.js` (registry/anti-template/scope-check
   suite) before commit.
