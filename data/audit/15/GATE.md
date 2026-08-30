# GATE — Stage 15 (Delete-list sweep)

Stage: 15 — the absence register (`DEL`). Every `DEL` row is verified live at
gate time with the sweep's amended patterns (register `PART 4`).
Scope: motion-graphics render path (`src/skills/remotion-render/`).
Date: 2026-08-30 (sweep + SFR application + re-verification all in this stage).

## Lane dispatch (protocol Part 4 row 15)

Protocol row 15 dispatches all eight audit lanes in parallel (same as stage
13). Ledgers, all read and reconciled:

- `data/audit/15/audit-layout.ledger.md`
- `data/audit/15/audit-type.ledger.md`
- `data/audit/15/audit-color.ledger.md`
- `data/audit/15/audit-motion.ledger.md`
- `data/audit/15/audit-encoding.ledger.md`
- `data/audit/15/audit-assets.ledger.md`
- `data/audit/15/audit-audio.ledger.md`
- `data/audit/15/audit-render.ledger.md`

## Per-DEL result (sweep + gate-time re-measure)

| DEL | Must not exist | Sweep verdict | Gate-time re-measure (2026-08-30) |
|---|---|---|---|
| DEL-01 | no-op scale factor | **AMEND** -> RETIRED, INVERTED | Only live hit is `scaleUnit()` at `compositions/mg-style.js:154-155`, the LAY-20 u-scaler (MANUAL A3.2), 0 call sites; not the deleted no-op (dead scaler structurally replaced by DesignSpace S-fit). Row struck + inverted. |
| DEL-02 | `GridBackground` | PASS (unchanged) | 0 hits. |
| DEL-03 | `ColorWipe` | PASS (unchanged) | 0 hits. |
| DEL-04 | regex stat scrapers | PASS (unchanged) | 0 hits (`extractStats\|extractHeroNumber\|extractFlowLines`). |
| DEL-05 | two-word headline regex | PASS (unchanged) | 0 hits. |
| DEL-06 | keyword icon ladder | PASS (unchanged) | 0 hits. |
| DEL-07 | `pickScene` | PASS (unchanged) | 0 hits (also ENC-05 re-measured PASS below). |
| DEL-08 | sibling flex in content zones | **AMEND** (scoped to mg path) + SFR-LAY15-1 | mg-path hits gone: evidence-scenes.jsx role strip rebuilt absolute (SFR-LAY15-1; old line 174). Remaining mg flex: exactly the two carved sites — motion-graphics.jsx:940 dead `Centered`, :1024 leaf-internal chip (line refs as of post-sweep). `minimal`/`cinematic-documentary` flex = OTHER-STYLE per Part 6. |
| DEL-09 | `chunkVoiceover` | PASS after SFR-audit-type-del09 | 0 live hits; wrapper deleted from render.js + verify-compositions.js; both call sites call `chunkTextClauseAware` directly (render.js:152, verify-compositions.js:32). TYP-11 row -> PASS. |
| DEL-10 | `space-around` | PASS (unchanged) | 0 hits. |
| DEL-11 | inert `remotion.config.js` reliance | PASS (unchanged) | 0 hits. |
| DEL-12 | bar glow / radial gradients / accent gridlines | **AMEND** (pattern + carve) | New case-insensitive pattern (`boxShadow\|radial-gradient\|radialGradient\|linearGradient`). Only hits: four designed `scenes/stage.jsx` environment fills (paper-fall L318, sub-floor L355, atmo-haze L421, shot-falloff L525 — carve) + `visual/composition.js` parallax plane ratios (DEL-25 carve). |
| DEL-13 | `MinimalSections` | PASS (unchanged) | 0 hits. |
| DEL-14 | `inputProps` entry-file workaround | **AMEND** (scoped to production SSR path) + SFR-DEL14-1 (option A) | `qa-sample.js` refactored to the real `Root.jsx` → `MotionGraphicsShorts`, props via `inputProps` on both `selectComposition` + `renderMedia`, scale 0.5 (CLI contract 540x960 preserved), no generated `qa-entry.jsx`. `data/audit/*/_*-entry.jsx` harness shims carved as instrumentation. |
| DEL-15 | linear easing | PASS (unchanged) | 0 hits. |
| DEL-16 | idle sine pulses | **AMEND** (frames-differ clause) + SFR-motion-15-1 + SFR-motion-15-2(b) | mg background breathes deleted (BREATHE consts, fps+breathe computation, dotGrid scale, CanvasGrain wrapper scale; PART-7 comment rewritten). Remaining `Math.sin` in mg are all frame-independent (seed hash L94, beat-start overshoot/tilt L116/118, arc-helper geometry L544) — not idle pulses. abstract-scenes destabilising wobble -> `[0, 0, 0, 0]`. |
| DEL-17 | pure white / pure black | RETIRED, INVERTED (unchanged from 2026-08-16) | Row stays as-is. |
| DEL-18 | gradient fills | **AMEND** (case-insensitive + carve) | `(?i)gradient`: hits are the same four stage.jsx fills (DEL-12 carve) + other-style files; 0 live mg-code hits otherwise. |
| DEL-19 | `border:` in styles | PASS (unchanged) | 0 hits. |
| DEL-20 | JPEG intermediates | PASS + SFR-DEL20-1 | `qa-render-motion.mjs` -> `imageFormat: "png"`. 0 `imageFormat.*jpeg` in src. |
| DEL-21 | text transform / skew / rotate | **AMEND** (text-scope + carve) | `skew` 0 hits. `rotate(` only on: causal-marker vertical label (structure-scenes.jsx:726, LAY-15-governed), `<g transform>` canvas rotate (structure-scenes.jsx:759, shape-scope). |
| DEL-22 | mood-based colour grading | PASS (unchanged) | 0 hits. |
| DEL-23 | `Math.random` | PASS (unchanged) | 0 hits. |
| DEL-24 | particle systems | PASS (unchanged) | 0 hits. |
| DEL-25 | parallax / depth layers | **AMEND** (DEPTH-plane carve) | `parallax` only inside the positive-checked DEPTH-plane system: `visual/composition.js` (DEPTH_PROFILES, planeOffset), `stage.jsx` Plane + comments, plane-layer comments in abstract/structure-scenes. 0 hits outside the system. |
| DEL-26 | Three.js / WebGL geometry | **AMEND** (effects-pipeline carve, case-bound) | Live `three\|THREE\.` only in the carved `effects/` pipeline: PhotoTreatment.jsx, CanvasGrain.jsx, PostFxReadyGate.jsx, generate-editorial-lut.mjs (all via `@remotion/three` + `@react-three/postprocessing`). Case-bound so the English word "three" is not a false positive. |
| DEL-27 | uppercase captions | PASS (unchanged) | 0 hits. |
| DEL-28 | global film grain | **AMEND** (RETIRED-scoped) | `grain` allowed only as the carved CanvasGrain design: `effects/CanvasGrain.jsx` + its mg Background mount (motion-graphics.jsx:388), PhotoTreatment per-photo grain, "fine-grained" in beats.js. 0 mg-code hits outside those. |
| DEL-29 | remote asset fetch at render | PASS (unchanged) | 0 `https://` in compositions. |
| DEL-30 | hex literals in `channels.json` | **AMEND** -> RETIRED, INVERTED | Hex is the sanctioned palette inside a channel's `colors` block only (68/68 inside). SCript-side sibling SCR-13. |
| DEL-31 | kicker scaffolding | PASS (+ dormant AMEND-15-1 note) | No `Kicker`/`SectionKickers` components; `channelName` is a destructured prop default (motion-graphics.jsx:1183) with no reads in kicker scope. Dormant beats.js kicker amendment (AMEND-15-1) recorded in the motion ledger is NOT applied this stage — noted only. |
| DEL-32 | unconditional per-beat icon resolution | PASS (unchanged) | 0 hits. |
| DEL-33 | icon-only stage scene | PASS (unchanged) | 0 hits. |

Plus the sign-post rows the DEL amendments touch:
- **TYP-11** (caption is SRT-derived, not word-count chunked): **FAIL -> PASS**
  2026-08-30 — wrapper deleted; `chunkVoiceover` grep 0 hits; call sites
  direct to `chunkTextClauseAware`.
- **COL-13** (zero gradient fills): stale **PASS -> PASS-with-amendment** —
  the class-level "0 code hits" no longer holds since 61ded3d added the four
  designed SVG environment fills; carved under DEL-12/18.
- **ENC-05 / ENC-06** (cue-based routing gone / no regex-scraped numbers):
  re-measured **PASS** — 1 hit is a documentation comment in beats.js:840
  referencing the old names; 0 code hits.

## Applied SFRs (orchestrator, step 3 of protocol row 15)

All ten filed SFRs applied exactly as adjudicated, via
`data/audit/15/apply-sfr-15.mjs` (idempotent — re-run confirms all skip):

1. **SFR-audit-type-del09** — `chunkVoiceover` wrapper deleted from render.js
   and verify-compositions.js; call sites -> `chunkTextClauseAware`.
2. **SFR-LAY15-1** — evidence-scenes.jsx role strip rebuilt absolute
   (tick `left:0, top:2`, `Label x={40}`), verbatim from the layout ledger.
3. **SFR-motion-15-1** — mg background breathes removed (comment rewrite,
   BREATHE constants, fps+breathe computation, both `scale:` strips).
4. **SFR-motion-15-2 (option b)** — abstract-scenes destabilising wobble
   zeroed to `[0, 0, 0, 0]`.
5. **SFR-DEL14-1 (option A)** — qa-sample.js refactor to real Root.jsx +
   `MotionGraphicsShorts` + inputProps on both calls + scale 0.5 +
   durationInFrames guard; entry-shim block deleted; `writeFileSync` import
   dropped.
6. **SFR-DEL20-1** — qa-render-motion.mjs `imageFormat: "png"`.
7. **SFR-15-COL-1** — DEL-12 / DEL-18 / COL-13 amendments.
8. **SFR-DEL25-1** — DEL-25 DEPTH-plane carve.
9. **SFR-DEL26-1** — DEL-26 effects-pipeline carve + case-bound pattern.
10. **SFR-DEL28-1** — DEL-28 RETIRED-scoped.

(Adjudicated NOT applied: SFR-LAY15-2, SFR-LAY15-3 — blocked on the shared
clamp parent / non-geometric conditions; see layout ledger. AMEND-15-1 dormant
kicker — noted only.)

## Shared-file requests applied (protocol step 4)

1. **CHECK-REGISTER.md** — DEL-01/08/12/14/18/21/25/26/28/30 rows amended,
   TYP-11 -> PASS, COL-13 -> PASS-with-amendment, ENC-05/06 -> PASS,
   §4.2 tail rewritten (DEL-09 wrapper now deleted), new **§4.3** paragraph
   documenting the amendment set (DEL-17 precedent). Old anchors matched on
   the file's on-disk bytes; new text written in proper Unicode (the
   apply-sfr-13-14 convention).
2. **LAYOUT-SYSTEM.md** — §0.12 `chunkVoiceover` bullet -> CLEARED; D2 row
   struck through.
3. **MOTION-BLUEPRINT.md** — Rule 3.1 updated to `chunkTextClauseAware`.
4. **.github/workflows/visual-qa-loop.yml** — header comment updated to the
   real-Root.jsx / inputProps / scale-0.5 contract (CLI unchanged).
5. **DEL-08 carve line refs** — corrected post-sweep to 940/1024 (the sweep's
   949/1033 were pre-eedit line numbers; the fix script is applied and the
   reference is marked "as of post-sweep").

## Gate verdict

Protocol row 15 gate: "delete-list sweep — every DEL row amended or verified
as absent; cross-checked notes filed".

- Every DEL row: **amended (9 rows) or re-verified absent (23 rows)** at gate
  time with greps run fresh after the SFRs were applied — not asserted.
- All four sign-post rows (TYP-11, COL-13, ENC-05, ENC-06) verified PASS /
  PASS-with-amendment.
- All code edits pass `node --check` (render.js, verify-compositions.js,
  qa-sample.js, qa-render-motion.mjs — the .jsx edits verified by read-back
  and by the register's live-grep re-measure).
- Cross-checked notes (lane rejections / adjudications) all recorded in the
  ledgers; no SFR applied that a lane rejected.

**STAGE 15 GATE: PASS.** 34 DEL rows closed (26 PASS, 2 retired/inverted from
2026-08-16, 9 amended, 1 carved-scope RETIRED) + 3 sign-post rows brought to
truth. Nothing carried forward from this stage's gate except the no-renderer
note below.

## Honest limitation notes (plainly stated)

- **No renderer/compositor on this machine.** SFR-LAY15-1's geometric
  equivalence (±1-2px in-theme) cannot be pixel-verified here; it is verified
  by structure (position/left/top/opacity preserved, flex container removed)
  and by the layout lane's ruling. First real render (Stage 17) re-checks it.
- **DEL-08 carve line numbers** cite the post-sweep positions (940/1024);
  a later edit above them would shift them again — the carve is by component
  identity (dead `Centered`, leaf-internal chip), not by line.
- **§4.3's DEL-12/18 timeline claim** ("invisible to the gate for 3 days")
  is the color lane's reconstruction; the amendment's substance (the
  camelCase blind spot) is the durable part.

Files changed in Stage 15: render.js, verify-compositions.js,
evidence-scenes.jsx, motion-graphics.jsx, abstract-scenes.jsx, qa-sample.js,
qa-render-motion.mjs, CHECK-REGISTER.md, LAYOUT-SYSTEM.md,
MOTION-BLUEPRINT.md, visual-qa-loop.yml (+ the apply/fix scripts under
data/audit/15/). No lane-owned artifact was handed on; carries to Stage 16:
RND-12 (CI matrix), AUD-07/08 (SFX map + LUFS, needs real TTS + ebur128),
DEL-28 positive measurement (data/audit/17), Tier-2 dot-grid hold check
(Stage 17 render).