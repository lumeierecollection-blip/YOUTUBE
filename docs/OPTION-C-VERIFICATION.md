# Option C Verification Report

**Date**: 2026-09-10
**Branch**: `claude/visual-rebuild-from-5f91e75`
**Commit**: `457dbefda654e1b36ee5ef8411367e63ff2c3500`
**Audited by**: Claude Opus 4.6 (read-only audit, no code modified)

## Summary

| Metric | Count |
|--------|-------|
| Total checks | 9 |
| PASS | 0 |
| FAIL | 7 |
| PARTIAL | 1 |
| Blocked | 1 |

**Option C as specified was not implemented.** The branch contains a different
body of work — a visual-engine rebuild with 2D-only `sentence-scene.jsx` and
`beat-scene.jsx` compositions — but none of the specific deliverables in the
Option C specification exist. The production render path still routes through
the existing Three.js/WebGL-dependent `MotionGraphicsShorts` composition with
`chromiumOptions: { gl: "swangle" }`.

---

## Detailed Results

### 1. File existence — FAIL

| Expected path | Status | Actual location / notes |
|---|---|---|
| `src/compositions/DailyRender.tsx` | **MISSING** | Directory `src/compositions/` does not exist. |
| `src/remotion/index.ts` | **MISSING** | Directory `src/remotion/` does not exist. Remotion entry point is `src/skills/remotion-render/Root.jsx`. |
| `src/skills/remotion-render/render.js` | **EXISTS** | 26,608 bytes, last modified Sep 10. |
| `.github/workflows/render.yml` | **MISSING** | No `render.yml`. Daily workflow is `.github/workflows/daily-pipeline.yml`. |
| `scripts/render-and-qa.js` | **EXISTS** | But this branch's version has only `--channel`, not `--dry-run`, `--script`, or `--output` flags. |
| `scripts/render-test.sh` | **MISSING** | `find` returns nothing. |

**Evidence** — directory listings:

```
$ ls src/compositions/ → ls: cannot access 'src/compositions/': No such file or directory
$ ls src/remotion/     → ls: cannot access 'src/remotion/':     No such file or directory
```

`render-and-qa.js` `parseArgs()` at line 44–46:
```js
function parseArgs(argv) {
  const idx = argv.indexOf("--channel");
  return { channelOverride: idx >= 0 ? argv[idx + 1] : null };
}
```

Only `--channel` is parsed. No `--dry-run`, `--script`, `--output`.

### 2. DailyRender.tsx — FAIL

**The file does not exist.** `find . -name "DailyRender*"` (excluding `node_modules`) returns
zero results. `grep -rn DailyRender` across all `.js`, `.jsx`, `.tsx`, `.ts`, `.yml`, `.json`
files returns zero matches.

The Remotion entry point (`Root.jsx`) registers seven composition families, none
named `DailyRender`:

```
cinematicDocumentary   → CinematicDocumentaryShorts, CinematicDocumentaryLongform
minimal                → MinimalShorts, MinimalLongform
motionGraphics         → MotionGraphicsShorts, MotionGraphicsLongform
templatePlan           → (from template-scene.jsx)
objectAudit            → (from object-audit.jsx)
beatSequence           → BeatSequenceShorts (from visual-engine/beat-scene.jsx)
sentenceScene          → SentenceShorts (from visual-engine/sentence-scene.jsx)
```

### 3. render.js modification — FAIL

**`chromiumOptions: { gl: "swangle" }` is still present** at line 294:

```js
// render.js:284-294
// SSR path, so every quality option must be passed here. gl: "swangle"
// (--use-gl=angle --use-angle=swiftshader) is the software WebGL2
// backend Remotion docs prescribe for GPU-less machines ...
chromiumOptions: { gl: "swangle" }, // software WebGL2 - NOT via the config file
```

**The composition id is still style-dependent**, never `DailyRender`. `render.js:221-227`:

```js
function getCompositionForStyle(style, format) {
  const compositions = {
    "cinematic-documentary": { shorts: "CinematicDocumentaryShorts", longform: "CinematicDocumentaryLongform" },
    minimal: { shorts: "MinimalShorts", longform: "MinimalLongform" },
    "motion-graphics": { shorts: "MotionGraphicsShorts", longform: "MotionGraphicsLongform" },
  };
  return compositions[style]?.[format] || "MinimalLongform";
}
```

**Three.js imports remain in the render tree.** `MotionGraphicsShorts` imports
`CanvasGrain` from `effects/CanvasGrain.jsx`, which uses:

- `ThreeCanvas` from `@remotion/three`
- `EffectComposer, Noise` from `@react-three/postprocessing`

`evidence-scenes.jsx` also references `ThreeCanvas`. All five Three.js-dependent
files in the production render tree:

```
src/skills/remotion-render/effects/CanvasGrain.jsx
src/skills/remotion-render/effects/PhotoTreatment.jsx
src/skills/remotion-render/effects/PostFxReadyGate.jsx
src/skills/remotion-render/compositions/motion-graphics.jsx  (imports CanvasGrain)
src/skills/remotion-render/compositions/scenes/evidence-scenes.jsx  (references ThreeCanvas)
```

**The onProgress heartbeat is NOT present** in this branch's `render.js`. Confirmed by
checking the `renderMedia` call (lines 275–301) — there is no `onProgress` callback.

### 4. Remotion root registration — FAIL

`DailyRender` is not imported or registered in `Root.jsx`. Full contents show seven
composition families (see §2 above), none named `DailyRender`.

The visual-engine's 2D compositions (`BeatSequenceShorts`, `SentenceShorts`) ARE
registered but are not reachable from the production render path —
`render.js`'s `getCompositionForStyle()` has no mapping to them. They are used
only by QA scripts:

```
src/skills/remotion-render/qa-scripts/render-beats.mjs
src/skills/remotion-render/qa-scripts/render-sentences.mjs
```

### 5. GitHub Actions workflow — PARTIAL

| Check | Status | Evidence |
|---|---|---|
| Schedule trigger (cron) | ✅ PASS | `daily-pipeline.yml:10` → `cron: "0 6 * * *"` |
| Runs `render-and-qa.js` | ✅ PASS | Line 552: `node scripts/render-and-qa.js --channel "$CHANNEL_OVERRIDE"` |
| `--script` / `--output` flags used | ❌ FAIL | Not passed; this branch's `render-and-qa.js` doesn't support them |
| `RENDER_PROGRESS_MS` env var | ❌ FAIL | `grep "RENDER_PROGRESS" daily-pipeline.yml` → zero matches |
| Artifact upload step | ✅ PASS | Lines 559, 567: `actions/upload-artifact@v4` for frames and renders |
| No GPU runner | ✅ PASS | All five `runs-on:` lines are `ubuntu-latest` |

### 6. Syntax validation — PASS (for files that exist)

```
$ node --check src/skills/remotion-render/render.js  → EXIT: 0
$ node --check scripts/render-and-qa.js              → EXIT: 0
```

`DailyRender.tsx` cannot be validated because it does not exist. The existing
`.jsx` compositions are not TypeScript and cannot be `tsc`-checked without a
project `tsconfig.json`.

### 7. Dry run test — FAIL

`render-and-qa.js` on this branch has no `--dry-run` flag. Running with
`--channel 1` invokes the real orchestrator. Observed output:

```
WARN: can't tell shorts/longform from ...\automatic-savings-vs-willpower-script.json — defaulting to longform
WARN: no voiceover audio at ...\automatic-savings-vs-willpower-script-vo.mp3 — skipping render
WARN: no voiceover audio at ...\debt-snowball-vs-debt-avalanche-shorts-script-vo.mp3 — skipping render
WARN: no voiceover audio at ...\pay-frequency-budgeting-script-vo.mp3 — skipping render
```

Exit code 0, but only because all scripts lacked audio and were skipped — not
because a dry-run mode printed a plan.

### 8. Short render test — BLOCKED

**No script on this branch has a matching voiceover `.mp3`.** All three channel-1
scripts (`automatic-savings-vs-willpower`, `debt-snowball-vs-debt-avalanche-shorts`,
`pay-frequency-budgeting`) are missing their `-vo.mp3` files. The hidden-inflation
script JSON doesn't exist on this branch (it was committed on
`claude/fix-provider-secret-mapping`).

A render from a prior session exists at:
```
data/renders/1/september-2026-hidden-inflation-50-30-20-budget-shorts-shorts-2026-09-09.mp4
  Size: 2,013,405 bytes
  Duration: 1.387s (ffprobe)
  Codec: h264 1080x1920 @ 30fps + AAC audio
```

Frame 15 was extracted and inspected: it shows a light background with **wavy
grain lines** (the `CanvasGrain` Three.js/postprocessing effect), two large
numerals "2" and "0", and the label "INFLATION COOLING". This is a
`MotionGraphicsShorts` render using the WebGL path, **not** a 2D-only
composition. The 1.387s duration (vs 85s expected) indicates the render
failed/was truncated.

**Cannot run a new render** — no script + audio pair exists on this branch.
Creating a test fixture would constitute modifying the repo, which this audit
is instructed not to do.

### 9. Regression check — Three.js compositions untouched — PASS (for the stated check)

Files still using Three.js:

```
src/skills/remotion-render/effects/CanvasGrain.jsx          → @remotion/three, @react-three/postprocessing
src/skills/remotion-render/effects/PhotoTreatment.jsx       → @remotion/three, @react-three/fiber, three
src/skills/remotion-render/effects/PostFxReadyGate.jsx      → @react-three/fiber
src/skills/remotion-render/compositions/motion-graphics.jsx → imports CanvasGrain
src/skills/remotion-render/compositions/scenes/evidence-scenes.jsx → references ThreeCanvas
```

These are **not** untouched regressions — they are the **active production
path**. `render.js` routes all `motion-graphics` channels (channels 1, 2, 9,
26, 44, 48) through `MotionGraphicsShorts`/`MotionGraphicsLongform`, which
depend on these files. The Three.js code is live, not legacy.

The new visual-engine compositions (`beat-scene.jsx`, `sentence-scene.jsx`) are
genuinely 2D-only — zero Three.js/WebGL imports. But they are not connected to
the production render path.

---

## What the branch ACTUALLY contains

The 6 commits on this branch (ahead of `main`) implement a **visual-engine
rebuild**, not Option C:

| Commit | What it does |
|--------|-------------|
| `f4d5ac1` | Screen ownership: TYPE/HERO beat modes, one focal element per beat |
| `a007bcd` | Fix object names rendered as display typography |
| `b3d84ac` | Semantic asset matching, sentence renderer, real icon library (14,217 icons) |
| `dee1a62` | Wire Iconify catalog into actual render, fix icon scoring bugs |
| `c415f1a` | Render cave video end-to-end, fix blank-frame / dead-hold / faint-animation defects |
| `457dbef` | Delete hand-drawn procedural fallback from icon engine |

These are quality improvements to the `BeatSequenceShorts` and `SentenceShorts`
compositions accessible via QA scripts (`render-beats.mjs`,
`render-sentences.mjs`). They are 2D-only and do not use WebGL. However, they
are **not wired into the production render path** (`render.js` →
`getCompositionForStyle()` → `renderMedia()`).

---

## Blockers

1. **`DailyRender.tsx` does not exist.** The core deliverable of Option C was never created.
2. **`render.js` still routes through Three.js compositions** with `chromiumOptions: { gl: "swangle" }`. No 2D path exists in the production render.
3. **`render-and-qa.js` on this branch lacks `--dry-run`, `--script`, `--output` flags.** Those features exist on `claude/fix-provider-secret-mapping` but not here.
4. **No script + audio pair exists on this branch** to prove a render works.
5. **The `onProgress` heartbeat is absent** from this branch's `render.js`.
6. **`RENDER_PROGRESS_MS` is not set in the workflow.**

---

## Recommended next actions

1. **Do not merge this branch claiming Option C is complete.** Option C was not implemented.
2. **Decide whether Option C is still wanted.** The branch's actual work (visual-engine with 2D sentence/beat scenes) is a different approach:
   - It provides 2D compositions (`SentenceShorts`, `BeatSequenceShorts`) that genuinely avoid WebGL.
   - But it's designed as a per-channel opt-in via `visual_engine: "template"` in `channels.json`, not a wholesale replacement of the Three.js compositions.
   - The existing compositions (`MotionGraphicsShorts`, etc.) are preserved and remain the default.
3. **If Option C is still wanted**: create `DailyRender.tsx` as specified, wire it into `render.js`, remove `chromiumOptions: { gl: "swangle" }`, and prove it renders on a GPU-less runner.
4. **If the visual-engine approach is preferred instead**: wire `SentenceShorts`/`BeatSequenceShorts` into `render.js`'s `getCompositionForStyle()` as a new style or as a fallback, and verify the daily pipeline uses it.
5. **Either way**: port `--dry-run`, `--script`, `--output` and the `onProgress` heartbeat from `claude/fix-provider-secret-mapping` into this branch's `render-and-qa.js` and `render.js`.

---

## Proof of work

- **No new render was executed** — blocked by missing script+audio pair on this branch.
- **Existing render inspected**: `data/renders/1/september-2026-hidden-inflation-50-30-20-budget-shorts-shorts-2026-09-09.mp4`
  - Size: 2,013,405 bytes
  - Duration: 1.387s (truncated; expected ~85s)
  - Frame 15 extracted to PNG (935,874 bytes): shows CanvasGrain wavy-line effect (WebGL-rendered Three.js postprocessing), numerals "2" "0", label "INFLATION COOLING" — confirms this is the **existing Three.js render path**, not a 2D-only composition.
