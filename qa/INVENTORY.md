# Motion-Graphics Inventory (Step 1)

Reference library: `vendor/video-shotcraft/` (Apache-2.0, 152 shot cards).
QA tooling: `scripts/qa_frames.py`, `scripts/vision_critic.py`, `.github/workflows/visual-qa-loop.yml`.
Skills: `.opencode/skills/{video-shotcraft,scene-director,mograph-critic}/`.

## Renderer layout (`src/skills/remotion-render/`)

- `Root.jsx` — registers 3 styles × 2 formats: `CinematicDocumentaryShorts/Longform`,
  `MinimalShorts/Longform`, `MotionGraphicsShorts/Longform`. **No defaultProps** —
  props are baked per video by `render.js` into a generated `render-entry.jsx`.
- `render.js` — CLI entry. For `motion-graphics` style the timing source of truth is
  the SRT next to the TTS audio; `buildMgPackage()` bakes `mg` and the duration.
  Renders at full res/length. Not suitable for cheap QA samples → QA entry generator needed.
- `audio.js` — static import of `./vo.mp3` staged by `render.js`. Absent in QA samples (fine).
- `wait-for-fonts.js` — cold-start font fetch (21 families) requires
  `timeoutInMilliseconds: 120000` (render.js) or `--timeout` on the CLI.

### Pure modules
- `beats.js` — duration tokens `D` (micro 4 / short 6 / base 9 / large 12 / complex 15 /
  push 60 / hold 45), SAFE rect, MG_TYPE sizes, caption tokens, SRT parsing,
  `wrapCaptionWords`, `transitionBeforeBeat`.
- `mg-style.js` — palette roles (`rolesFromPalette`), icon resolution (`resolveIcon`),
  `strokeAttr`, `mixColor`.
- `mg-package.js` — `buildMgPackage(srtText, opts)` → `{ beats, captions, pages,
  transitions, sectionRanges, totalFrames, audioFrames, synthesized }` + gates
  (headline overlap, icon names, chart data).
- `icons-data.js` — vendored icon set (`ICON_INNER`).
- `visual.js` — `resolveFontFamily`, `resolveColors`, `moodFromVisualCue`,
  `moodFromContent`, `EndFadeToBlack` (20f fade).

### Compositions
- `motion-graphics.jsx` (style "motion-graphics") — the richest mograph surface.
- `minimal.jsx` (style "minimal") — `AnimatedCaption` (spring damping 100 / stiffness 120),
  `MinimalBackground`, `MinimalSections`.
- `cinematic-documentary.jsx` — `FilmGrain`, `Vignette`, `LightLeak`, `AnimatedText`,
  `DataOverlay`, `KenBurnsImage`, `BrollLayer`, `SectionBackground`.

## motion-graphics.jsx — mograph primitives (the fix surface)

Global easing constants (lines 40–43):
`E_OUT = bezier(0.16,1,0.3,1)`, `E_SETTLE = bezier(0.33,1,0.68,1)`,
`E_IN = bezier(0.33,0,0.67,1)`, `E_PUSH = spring({damping:200})`.

Interpolation helpers: `ease()` (clamps, defaults E_OUT), `easeScale()` (perceptual-scale).

Motion primitives:
- `popStyle` (D2.1) — scale 0→1.15→1 over 9f, opacity 0→1 over 3f. Overshoot present.
- `riseStyle` (D2.2) — translateY +24→0 over 9f, opacity 0→1 over 6f (D.short).
- `stageExitStyle` (D3) — fade + translateY −12 over 6f, ease-in.
- `growSpring` (D2.4) — spring {damping:16, stiffness:90}, 24f. The only overshoot-on-dimension.
- `DesignSpace` — scaled canvas container (S scale factor for 1080×1920 design).
- `Background` — flat bg + dotGrid + noise (per MOTION-GRAPHICS-MANUAL A2.6).
- `Rail` — progress rail (linear `progress` — CHECK linearity).
- `Kicker` — section label + number.
- `Icon` / `TraceIcon` — icon draws; TraceIcon has a `start` (trace animation).
- `CaptionToken` / `CaptionLine` / `CaptionLayer` — word-level caption streaming
  with spoken/suppressed/accent states.
- `HeadlineBox` / `HeadlineLayer` — per-beat headline chip.
- Scene renderers: `HeroNumberScene`, `TermDefineScene`, `ContrastScene`,
  `ProgressScene`, `RelationScene`, `StatementScene`, `ImageBeatScene`,
  `StageScene`, `ListRunScene`.
- Assembly: `BeatStages`, `ListRuns`, `SectionKickers`, `MotionGraphicsContent`,
  `MotionGraphicsShorts`, `MotionGraphicsLongform`.

## QA baseline target

- Composition: `MotionGraphicsShorts` (motion-graphics style, the mograph surface).
- Sample data: channel 2 "Legal Brief" — SRT `data/tts/2/what-to-say-traffic-stop-script-vo.srt`
  (2:54 total), script `data/research/2/what-to-say-traffic-stop-script.json`, palette from
  `config/channels.json`. No TTS audio exists in repo → QA entry must render silent.
- Render: 6s sample (180f @ 30fps) at 540×960 (half of 1080×1920), frames 0–179,
  matching the mograph-critic skill's cheap-sample recipe.
- QA: `scripts/qa_frames.py --video out/qa.mp4 --report qa/report.json --sheet qa/sheet.jpg`.

## Baseline issues predicted from code review

1. `Rail` progress interpolated linearly → `linear_motion` risk.
2. `riseStyle` uses D.short (6f) for opacity but D.base (9f) for translation → two
   durations on one entrance, likely reads as simultaneous/abrupt.
3. `growSpring` spring config `{damping:16, stiffness:90}` is damped → near no overshoot.
4. `E_OUT = bezier(0.16,1,0.3,1)` is a strong ease-out on entrances — good; but caption
   tokens and rail still need per-window verification from real frames.
5. Stage exit uses fixed 6f with ease-in — verify against shot-transitions card.
