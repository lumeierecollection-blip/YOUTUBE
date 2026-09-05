# data/audit/15/audit-color.ledger.md

Audit lane: **audit-color** — Stage 15 (Delete-list sweep).
Date: **2026-08-30**.
Protocol: CROSSCHECK-PROTOCOL Part 4 / register §4 — DEL rows are proven by
grep. Every grep below was RUN this session (none taken from the register's
State column or prior ledgers). Tools: Grep tool (case-sensitive by default,
node_modules-excluded) + PowerShell `Select-String` recursion (source tree)
as the independent second run.

Ownership (this lane): `config/channels.json`, `styles/tokens.js`,
`effects/CanvasGrain.jsx`, `effects/generate-editorial-lut.mjs`,
`data/audit/**`. Everything else read-only. **No edits were made this sweep**
— the DEL rows all resolve to PASS or AMEND-with-register-fix, and every
fix target (CHECK-REGISTER.md, `compositions/**`) is orchestrator-owned →
SFR only.

Scope definitions used:
- **mg style** = `compositions/motion-graphics.jsx`, `compositions/scenes/**`,
  `compositions/mg-package.js`, `compositions/mg-style.js`,
  `visual/composition.js` (feeds the mg plan), `styles/tokens.js`.
- **mg render package** = everything under `src/skills/remotion-render/`
  (own source; `node_modules` is vendored third-party — can only reach a
  render through the package's own source, which is scanned).
- **OTHER-STYLE** = `compositions/cinematic-documentary.jsx` (16:9 long-form)
  and `compositions/minimal.jsx` — both registered in `Root.jsx` (live
  compositions) but deliberately distinct styles with their own rebuild
  history; their removal-comments are out of mg scope.

---

## Per-row verdict table

| Row | Pattern | Hits (mg-scope live code) | Verdict |
|---|---|---|---|
| DEL-02 | `GridBackground` | 0 | **PASS** |
| DEL-03 | `ColorWipe` | 0 | **PASS** |
| DEL-12 | `boxShadow\|radial-gradient` | 1 (out-of-scope comment) + **4 live camelCase fills unseen by the pattern** | **AMEND** |
| DEL-18 | `gradient` | 0 code fills as-written (+ same 4 blind-spot fills) | **AMEND** |
| DEL-22 | `moodFrom` | 0 (1 comment) | **PASS** |
| DEL-28 | `grain` in mg style | 0 banned-class; designed features only | **AMEND** |
| DEL-30 | `#[0-9A-Fa-f]{6}` in `config/channels.json` | 68, all inside `colors` blocks | **AMEND** |

---

## DEL-02 — `GridBackground` → **PASS**

- Grep tool (js/jsx/mjs/ts/tsx/json/md): **0 files**.
- PowerShell recursive `Select-String -SimpleMatch` across the whole package
  source tree (all extensions): `NO_HITS_outside_node_modules`.
- Dependency scan (all `node_modules/*/package.json`): no dep name or
  manifest contains either string (`NO_GridBackground_ColorWipe_in_dep_package.json`).
- A full byte-scan of `node_modules` internals was not completed (recursion
  exceeds sensible bounds on this machine); recorded as out of scope — the
  old component belonged to the package's own style source, and vendored deps
  cannot inject it into the mg render path.
- The NEW dot grid lives as `DOT_GRID` / `dotGridStateForFrame` in
  `styles/tokens.js` (COL-17/18 positive checks) with zero `GridBackground`
  references anywhere — the rename surface is clean.

## DEL-03 — `ColorWipe` → **PASS**

- Grep tool: **0 files**. PowerShell source-tree scan: `NO_HITS`.
- `ColorWipe` (an overlay component that colour-wiped between sections) is
  gone; no spelling variant (`colorWipe`, `ColorWipe` were both covered by
  `-SimpleMatch`) exists in package source.

## DEL-12 — `boxShadow|radial-gradient` → **AMEND**

As-written grep (case-sensitive, kebab):
- `compositions/cinematic-documentary.jsx:28` — comment ("the radial-gradient
  vignette") listing what the cinematic rebuild REMOVED. OTHER-STYLE file
  (registered composition, non-mg style), comment-only, cannot reach a render.
- `boxShadow`: **0 hits** package-wide. The bar-glow half of the row is
  genuinely clean (re-confirms COL-12's "PASS — 0 hits").

**Blind-spot finding (the reason this row cannot be a clean PASS):** the
register pattern is spelled kebab-case and case-sensitive, so it can never
match the SVG DOM's camelCase gradient elements. Four **live** gradient
fills exist in the mg style since commit `61ded3d` (2026-08-27, "Give every
scene a stage: material, framing, depth, camera"), all in mg-scope
`compositions/scenes/stage.jsx`:

| fill | lines | element | used by | reachable via |
|---|---|---|---|---|
| `paper-fall` | 318–321 | `<radialGradient>` | `PaperGround` | DOCUMENT_EVIDENCE → M.PAPER (`visual/composition.js:98`) |
| `sub-floor` | 355–358 | `<linearGradient>` | `SubstanceGround` | ACCUMULATION/DATA_CHART → M.SUBSTANCE (`composition.js:89,92`) |
| `atmo-haze` | 421–424 | `<linearGradient>` | `AtmosphereGround` | TIMELINE/SCALE_COMPARISON/CINEMATIC_STATEMENT → M.ATMOSPHERE (`composition.js:93,101,103`) |
| `shot-falloff` | 525–528 | `<radialGradient>` | `Falloff` (full-frame, every staged beat — `scenes/index.jsx:105`, strength 0.4) | all planned beats |

Classification: **DESIGN FEATURE (AMEND candidate), not slop.** These are
environment-shading fills (ink `colors.stroke`/bg at 4–14% alpha, zero hue
modification) inside the render-QA'd 16-strategy stage system: §3.12.11's
fixtures rendered TIMELINE (→ atmoshpere ground) and CINEMATIC_STATEMENT
beats through `inspect-anchors.mjs` with ink numbers verified; §3.12.x pass
documents `visual/run-visual-tests.js` 70/70 repeatedly; the ground alphas
were tuned "after looking at rendered frames" (stage.jsx:267–276). They are
the exact opposite of the banned radial GLOW / neon accent fills the row
targeted. This is the DEL-17-shaped situation: a designed, measured feature
that contradicts an absence pattern — register §4.2 precedent applies.

Consequence for the register (must be fixed by the register owner):
- The row's own positive check COL-13 ("0 code hits") is **stale**: true on
  2026-08-16, false since 2026-08-27 for the *class* (not the as-written
  pattern, which still can't see camelCase). COL-12's 0-hit claim re-verified
  true. Also note for the amendment: the CaptionLayer `drop-shadow` carve-out
  (`motion-graphics.jsx:710`, documented B1.4 in stage-12 ledger) is the only
  shadow-family member; pattern `boxShadow` never saw it either.

**Proposed amended row text (DEL-17 format), for SFR:**
> | DEL-12 | Bar glow / radial gradients / accent gridlines | `boxShadow\|radial-gradient\|radialGradient\|linearGradient` **outside the four stage.jsx ground-shading fills (`paper-fall`, `sub-floor`, `atmo-haze`, `shot-falloff` — environment shading, ink-on-bg, no hue, render-QA'd §3.12.11) and outside `visual/composition.js`'s parallax plane ratios (tested by `run-visual-tests.js` ≥2×)** | MAJOR |

## DEL-18 — `gradient` → **AMEND**

As-written (lowercase, case-sensitive) — 13 hits, every one comment/string:
- `compositions/minimal.jsx:21,22` — removal-comments (OTHER-STYLE).
- `compositions/cinematic-documentary.jsx:28,30,212,213,246` — removal-comments
  (OTHER-STYLE; line 246: "flat, opaque bars behind the text zones — not a
  gradient").
- `compositions/motion-graphics.jsx:49,352` — removal/guard comments (mg style,
  comment-only).
- `compositions/scenes/stage.jsx:169` — comment pointing at visual/composition.js
  parallax plane ratios (tested by run-visual-tests.js:520–534).
- `visual/run-visual-tests.js:520 (comment), 534 (diagnostic message string)` —
  test tooling; the string is a QA failure message, never a render fill.
- `compositions/scenes/elements/chart.jsx:38` — comment.
None of these can reach a render as a fill — consistent with the stage-12
COL-13 assessment (12 comment hits + 1 diagnostic string).

**Same blind spot as DEL-12:** `gradient` (lowercase) cannot match
`radialGradient`/`linearGradient`, so the four live fills in
`scenes/stage.jsx` (catalogued under DEL-12) are invisible to the row. The
row's NAME ("gradient fills") is matched by four live fills; the designed-feature
classification and DEL-17-precedent reasoning from DEL-12 apply identically.

**Proposed amended row text, for SFR:**
> | DEL-18 | Gradient fills | `(?i)gradient` **excluding the four stage.jsx ground-shading fills (see DEL-12's carve) — everything else that can reach a render fails** | MAJOR |
> (register note: COL-13's STATE must be corrected — class-level "0 code hits"
> has not held since 61ded3d, 2026-08-27; as-written-pattern 0 hits and the
> designed carve are the current truth.)

## DEL-22 — `moodFrom` → **PASS**

- Current live grep: **1 hit** — `compositions/cinematic-documentary.jsx:31`,
  a comment ("moodFromVisualCue/moodFromContent, formerly in visual.js")
  documenting the deletion; the file's own header (lines 27–33) explicitly
  cites "CHECK-REGISTER.md DEL-22 / COL-22". OTHER-STYLE file, comment-only.
- `mood` family sweep (broader than the row's pattern): 6 hits, ALL
  removal-comments in the same cinematic header (lines 27, 30, 31, 33, 212,
  331). **0 live mood-grading code in the package** — `visual.js` no longer
  exports `moodFrom*` (re-confirms COL-22's staged deletion).
- Re-verification of the dispatch seed ("0 hits at stage 12"): the stage-12
  ledger actually recorded "1 hit, comment only (cinematic-documentary.jsx:31)"
  and passed on 0-code-hits. Current state identical → the seed was imprecise;
  the ledger's version is the accurate one. PASS stands.

## DEL-28 — `grain` (mg style) → **AMEND**

22 hits, classified:

| hit | class | rationale |
|---|---|---|
| `effects/PhotoTreatment.jsx:14,29` | DESIGN FEATURE | comments describing photo-treatment grain; §3.12.12 render-verified with a real photo (`qa-render-image-evidence.mjs`); per-photo, not global |
| `effects/CanvasGrain.jsx:8,9,17,22,33,38,56,57,58` + lines 1–124 (the component) | DESIGN FEATURE | the deliberately introduced canvas paper-grain (vox-style-treatment SKILL.md); luminance-only by shader construction (`vec3 noise = vec3(rand(...))` broadcast equally to RGB); NORMAL blend calibrated from real renders (`data/audit/17/out/grain-white.png` stddev 1.1 @ 0.05, `grain-black.png` stddev 11.0 @ 0.05 → recalibrated 0.006); opacity split by measured bg luminance |
| `compositions/motion-graphics.jsx:337,339,344,351,376` + live mount at 385–398 | DESIGN FEATURE | the mg Background's grain layer (A6 stack: flat bg → dotGrid → content → grain); frame-audit's flatness check was deliberately extended (blurredStddev/chromaStddev) to *allow* grain while catching gradient/tint — gate-integrated, not carved around |
| `qa-scripts/qa-render-image-evidence.mjs:6` | LEGITIMATE REUSE | QA tooling comment |
| `compositions/beats.js:909,1083` | LEGITIMATE REUSE | English word "fine-grained"/"finer-grained" — no visual grain |
| `compositions/scenes/evidence-scenes.jsx:151` | DESIGN FEATURE | comment re photo treatment of evidence images |
| `compositions/scenes/stage.jsx:303` | LEGITIMATE REUSE | comment ("a sheet's grain") — PaperGround's texture is hairlines, no noise |
| `compositions/cinematic-documentary.jsx:22` + **live `FilmGrain` 43–54** | OTHER-STYLE (co-report) | a REAL full-frame film-grain overlay (`feTurbulence` fractalNoise SVG) — but in the 16:9 cinematic style, which is out of the mg-style scope this row is scoped to |

Judgment: the banned "global film grain" (an un-vetted cinematic grain
overlay in the mg style) does **not** exist. What exists is (a) canvas paper
grain on the mg background — luminance-only, measured, gate-integrated —
and (b) per-photo grain (photo treatment). Honest alternative reading
recorded: CanvasGrain IS full-frame and whole-video, so a strict reading of
"global" could call it the banned thing re-born; the amendment below is the
recommended resolution, and the orchestrator should ratify one reading.

**Proposed amended row text, for SFR:**
> | DEL-28 | ~~Global film grain in this style~~ **RETIRED-scoped, 2026-08-30** — `grain` may exist only as (1) the CanvasGrain canvas paper-grain layer (`effects/CanvasGrain.jsx` + its mount in `motion-graphics.jsx` Background), (2) PhotoTreatment's per-photo grain (`effects/PhotoTreatment.jsx`), and the English word in "fine-grained" (beats.js); any OTHER `grain` in mg live render code still fails. Positive checks: `data/audit/17` render measurements + synthetic gradient/tint controls (audit-report.json: grain frames PASS flatness, controls FAIL), §3.12.12 photo-treatment render, frame-audit blurredStddev/chromaStddev gate | MINOR |

## DEL-30 — hex literals in `config/channels.json` → **AMEND**

- Grep `#[0-9A-Fa-f]{6}`: **68 hits** — exactly 17 channels × 4 roles
  (`primary`/`secondary`/`accent`/`bg`).
- Programmatic parse (node): 68 hex strings total, **0 outside `colors`
  blocks**; `bg_mode` spread white 7 / black 10; 17 channels.
- Classification: **DESIGN FEATURE — the sanctioned palette source.**
  - The `colors` block is consumed by real lanes: `src/utils/branding.js:25`,
    `src/utils/captions.js:197`, `src/utils/endscreen.js:71`,
    `src/skills/script-writer/run.js:106` — live, not dead data.
  - The mg render palette is derived from `thumbnail_spec.accentHue` +
    `bg_mode` (`render.js:506-509`, `paletteFromHues` in tokens.js) — so
    `colors.bg` is T-colors-owned legacy-live data, exactly as the COL-07/08
    rows' State notes say (".colors legacy field = T-colors follow-up").
  - SCR-13's whole principle is "colour lives in `channels.json`, never in a
    script or prompt-generated string". A DEL-30 "pass" (zero hex in
    channels.json) would delete the palette's sanctioned home and force hex
    into scripts — inverting SCR-13 by construction.
- This is the DEL-17 shape: an absence check whose zero state contradicts the
  current designed state. Per §4.2 precedent — AMEND/RETIRE, never blind
  deletion.

**Proposed amended row text, for SFR:**
> | DEL-30 | ~~Hex literals in `channels.json`~~ **RETIRED, INVERTED 2026-08-30** — hex literals are the sanctioned palette and live ONLY inside a channel's `colors` block: `#[0-9A-Fa-f]{6}` **outside** `colors` in `channels.json` is 0 (verified 2026-08-30; 68/68 hits inside `colors`); the script-side sibling is SCR-13 | MAJOR |
> (register note per §4.2 format: the deletion era banned hex because palettes
> were drifting into prompts; the centralized `colors` block + SCR-13 +
> COL-07/08 now enforce the opposite, centralized rule.)

---

## Co-reports (cross-cutting DEL patterns in this lane's owned files)

1. **The DEL-12/18 pattern blind spot (loudest finding).** Both rows' patterns
   are kebab-case/case-sensitive and cannot match the SVG camelCase elements
   `radialGradient`/`linearGradient`. Four live mg-scope fills exist since
   2026-08-27 (`61ded3d`) and are catalogued under DEL-12. The register's
   COL-13 State ("PASS — 0 code hits") is stale at the class level. Register
   owner must apply the amended patterns + carve + corrected state — without
   a carved pattern, a future "clean" grep will be a lie again.
2. **DEL-26 (`three|THREE\.`) — my owned files.** `effects/CanvasGrain.jsx:2,3,12,23,106,120`
   (`@remotion/three`, `@react-three/postprocessing`, `<ThreeCanvas>`) and
   `effects/generate-editorial-lut.mjs:4,5` (`Three.js's LUTCubeLoader`, comment).
   These are the designed WebGL texture path (§3.12.12 port + data/audit/17),
   the same AMEND class as DEL-28: WebGL exists ONLY inside the two gated
   effect components. Not a three.js-geometry slop regression.
3. **DEL-16 (`Math.sin(`) — `styles/tokens.js:101`.** `Math.sin(hr)` in
   `hexFromOklch` is OKLCH→sRGB hue decomposition (colour math), not an idle
   animation sine pulse. LEGITIMATE REUSE; the animation-family `Math.sin` in
   mg Background (`motion-graphics.jsx:360,393`) is the documented PART 7
   ≤1.5% breath feature (orchestrator-owned file, out of my edit scope).
4. **DEL-25 (`parallax`) — `config/channels.json:704,1333`.** Channel
   metadata strings ("parallax-shift" in a transitions list; "layered
   parallax depth" in a `visual_spec.color_grade` description). Cannot reach a
   render layer. LEGITIMATE REUSE — noted for the audit-motion lane.
5. **DEL-28 cross-style — `compositions/cinematic-documentary.jsx:43-54`**
   has a LIVE full-frame `FilmGrain` (SVG feTurbulence fractalNoise, overlay
   blend, opacity 0.1). Out of DEL-28's "in mg style" scope, but it IS the
   literal "film grain overlay" the row name describes — if the orchestrator
   wants the DEL-28 intent package-wide rather than mg-scoped, this is the
   hit to adjudicate. Regards its own style's designed feature (its header
   documents "Film grain overlay (texture, not colour)").
6. **`color_grade` field name — `config/channels.json:1333`.** A descriptive
   spec string, no grading code. Noted because the name collides with DEL-22
   vocabulary; no live grading semantics.

---

## SHARED-FILE REQUESTS

### SFR-15-COL-1 — CHECK-REGISTER.md row amendments (register owner)

**File:** `CHECK-REGISTER.md` (orchestrator/register owner; not in this
lane's edit list).

**Reason:** DEL-12, DEL-18, DEL-28, DEL-30 require register amendments per
the DEL-17 (§4.2) precedent — the rows name things that are now verified
designed features, and the patterns themselves have a spelling blind spot
(see DEL-12/18 co-report) that no code change can cure. COL-13's State cell
must be corrected (class-level "0 code hits" untrue since `61ded3d`,
2026-08-27). No mg render code should change.

**Exact edits (before → after):**

1. DEL-12 row, §Part-4 table (~line 1490):
   **before:** `| DEL-12 | Bar glow / radial gradients / accent gridlines | `boxShadow\|radial-gradient` | MAJOR |`
   **after:** `| DEL-12 | Bar glow / radial gradients / accent gridlines (outside the designed ground shading) | `boxShadow\|radial-gradient\|radialGradient\|linearGradient` — EXCEPT the four `scenes/stage.jsx` environment fills `paper-fall`/`sub-floor`/`atmo-haze`/`shot-falloff` (ink-on-bg alpha ≤14%, no hue; render-QA'd §3.12.11) and `visual/composition.js` parallax plane ratios (run-visual-tests ≥2×) | MAJOR |`

2. DEL-18 row (~line 1496):
   **before:** `| DEL-18 | Gradient fills | `gradient` | MAJOR |`
   **after:** `| DEL-18 | Gradient fills | `(?i)gradient` — same four-`stage.jsx` carve as DEL-12; everything else live still fails | MAJOR |`

3. DEL-28 row (~line 1506):
   **before:** `| DEL-28 | Global film grain in this style | `grain` in mg style | MINOR |`
   **after:** `| DEL-28 | ~~Global film grain in this style~~ **RETIRED-scoped 2026-08-30** — `grain` allowed only as CanvasGrain (`effects/CanvasGrain.jsx` + its mg Background mount), PhotoTreatment's per-photo grain, and the word in "fine-grained" (beats.js:909,1083); any other `grain` in mg live code fails. Positive checks: data/audit/17 measurements + synthetic controls, §3.12.12 render, frame-audit blurredStddev/chromaStddev | MINOR |`

4. DEL-30 row (~line 1508):
   **before:** `| DEL-30 | Hex literals in `channels.json` | `#[0-9A-Fa-f]{6}` | MAJOR |`
   **after:** `| DEL-30 | ~~Hex literals in `channels.json`~~ **RETIRED, INVERTED 2026-08-30** — hex is the sanctioned palette and lives ONLY inside a channel's `colors` block: `#[0-9A-Fa-f]{6}` outside `colors` = 0 hits (68/68 inside). Script-side sibling: SCR-13 | MAJOR |`

5. COL-13 State cell (~line 226) — corrective note:
   **before:** `**PASS** - 0 code hits, only removal-comments (motion-graphics-rebuild-v2)`
   **after:** `**PASS-with-amendment** - 0 CSS/code gradient hits as-written, but the class-level "0 code hits" does NOT hold since 61ded3d (2026-08-27): four designed SVG environment fills in scenes/stage.jsx (paper-fall/sub-floor/atmo-haze/shot-falloff) are invisible to the case-sensitive pattern and are carved out under DEL-12/18 amendments`

6. §4.x register note (after §4.2's DEL-17 paragraph) — one paragraph recording
   the 2026-08-30 DEL-12/18/28/30 amendment set and the pattern-spelling
   blind-spot rationale (kebab-case vs SVG camelCase), so future sweeps run
   the amended patterns and not the old ones.

**Gate after applying:** re-run this lane's greps with the amended patterns:
DEL-12 as amended → 0 hits outside the carved set; DEL-18 → 0 live fills
outside the carved set; DEL-28 → 0 mg hits outside the named components;
DEL-30 → 0 hex outside `colors` blocks. Only `CHECK-REGISTER.md` changes.

---

## Final VERDICT

- **PASS:** DEL-02, DEL-03, DEL-22 (0 live-code matches; verified by two
  independent grep runs this session).
- **AMEND (register-level, no code change):** DEL-12, DEL-18 (pattern
  blind-spot + designed stage-ground carve, DEL-17-precedent), DEL-28
  (RETIRED-scoped: CanvasGrain/PhotoTreatment grain is the gated designed
  feature; no banned global film grain), DEL-30 (RETIRED/INVERTED: hex
  belongs in `colors` blocks by SCR-13 design).
- **No deletions performed** — every match this lane found is either a
  comment/string, legitimate reuse, an other-style file, or a verified
  designed feature. Nothing in this lane's ownership needed editing.
- **One SFR filed:** SFR-15-COL-1 (CHECK-REGISTER.md amendments + COL-13
  state correction) — verbatim above.
- Highest-severity finding for the orchestrator: the DEL-12/18 pattern
  spelling blind spot let four live radial/linear gradient fills exist in mg
  scope for 3 days without any register gate seeing them; the amended
  patterns in SFR-15-COL-1 close that hole.