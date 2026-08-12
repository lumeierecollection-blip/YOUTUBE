# Motion-graphics reference repos — GitHub research artifact

**Date:** 2026-08-11 · **Method:** live GitHub search API (webfetch), queries:
`remotion template`, `motion graphics`, `kinetic typography`, `youtube shorts template`.
Star counts / licenses / descriptions as fetched live. This is a *grounding
artifact*: candidate references to verify and adapt per CROSSCHECK-PROTOCOL —
not scripture.

## A. Duplicate-and-adapt shortlist (same architecture as this repo)

### 1. `Vincentwei1021/video-shotcraft` — 4645★ · Apache-2.0 · TypeScript
"AI video skill for Claude Code & Codex — cinematic product videos with
Remotion: 152 shot recipe cards, 209 motion previews, a production-ready
template." Active (pushed 2026-08-09).
**Fit:** Remotion-native skill repo, same shape as `.opencode/skills/remotion-render`.
Shot-recipe-card format + motion previews are a ready motion library for our
13 motion-graphics channels (manual §A3 Stage beats).
**Take:** recipe card schema, preview workflow, template layout.

### 2. `remotion-dev/template-tiktok` — 273★ (official Remotion org)
Kinetic captions for vertical video (Whisper.cpp word-timed captions).
**Fit:** our Caption zone (manual §A1.3, y 1152–1248) is exactly this; we
already depend on `@remotion/captions`.
**Take:** word-sync timing implementation → caption block animation.

### 3. `iart-ai/motion-skills` — 343★ · MIT
"50 open-source skills that teach your AI coding agent to make motion
graphics, animation & video — kinetic typography, data-viz, explainers,
TikTok/Reels, WebGL, Manim. 14 installable packs."
**Fit:** identical agent-skill architecture; kinetic-typography and data-viz
packs map to Stage/Headline zones.
**Take:** per-pack SKILL.md structure, data-viz animation patterns.

### 4. `DanteAlighieri13210914/pv-tool` — 400★ · TypeScript
"Automatically generate kinetic typography."
**Fit:** kinetic-typography grammar for Headline/Kicker beats.
**Take:** type-motion grammar (to adapt to our 8px grid, NOT copy values —
manual §A1.1, §A1.2).

## B. Math / behaviour reference (do not duplicate code; borrow the model)

### 5. `mojs/mojs` — 18753★ · MIT
"The motion graphics toolbelt for the web" — easing curves, timeline,
path morphing.
**Fit:** grounds the timing spine / easing in MOTION-BLUEPRINT against a real
motion library instead of invented curves.
**Take:** easing curve math, timeline model → audit-motion lane.

### 6. `astrofox-io/astrofox` — 1946★ · MIT
Audio → motion-graphics visualizers (audio-reactive animation).
**Fit:** candidate source for audio-reactive Stage beats — MUST be reconciled
with manual §A2 (flat bg, no gradient) and blueprint timing before use.
**Take:** audio-beat → animation mapping only.

### 7. `notivn/AIEV` — 89★ · MIT
"Claude directs HyperFrames (HTML + GSAP motion graphics) and Remotion
(timeline assembly)… transcript, kinetic typography, karaoke subtitles."
**Fit:** same agent-directs-renderer pipeline shape as ours; karaoke
caption-highlight sync is a direct Caption-zone candidate.
**Take:** agent→renderer contract, caption highlight sync.

## C. Evaluated, reference-only (different stack / too heavy to duplicate)

- `GraphiteEditor/Graphite` — 26811★ · Apache-2.0. Node-based procedural 2D
  motion engine (Rust). Engine reference for layer-graph evaluation only.
- `alyssaxuu/motionity` — 4085★ · MIT. Web motion editor (AE-like keyframes,
  canvas). Reference for keyframe-interpolation UX in a preview tool.
- `IgorShadurin/app.yumcut.com` — 848★. Full AI vertical-video pipeline
  (script→scenes→VO→subtitles→FFmpeg). Cross-check for scene segmentation and
  subtitle burn-in decisions vs our Remotion approach.

## D. Rejected (keyword noise, wrong domain)
`hairyhenderson/gomplate` (Go template CLI), `BoleroFramework/Bolero` (F# web),
`awslabs/aws-advanced-jdbc-wrapper` (JDBC), `odoo/odoo-docker` (Docker),
`galaxyproject/tools-iuc`, `microsoft/RDS-Templates` (Azure), and similar —
all "template"-keyword false positives, not motion graphics.

## E. Next actions
1. Clone/read A1–A4 internals (recipe schema, caption component, pack layout)
   and verify each claim against its actual source tree.
2. Audit-lane mapping: A1+A2 → audit-layout / audit-type (grid, captions);
   A3 → audit-encoding (data-viz honesty); B5–B7 → audit-motion (easing,
   beat, sync); B7+A2 → audit-audio (sync); C → evaluate-not-duplicate.
3. Only after lane verification: adapt into styles/templates, then re-render
   and **watch frames** (video-review skill) before any confirmation.