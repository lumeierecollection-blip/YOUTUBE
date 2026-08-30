# GATE — Stage 14 (Encoder + CI)

Stage: 14 — Encoder + CI (explicit `renderMedia` options; config-file
deletion; matrix green on one channel).
Scope: 6 motion-graphics channels (Money Mind, Legal Brief, Border Lines,
Fraud Files, Skill Stack, Factory Floor).
Date: 2026-08-29 (run 1 + orchestration re-entry for SFR application).

## Lane dispatch (protocol Part 4 row 14)

Protocol row 14 names `audit-render`. Dispatched alone. Ledger:
`data/audit/14/audit-render.ledger.md`.

Map from the protocol gate text to register rows (section 3.7):
- `explicit renderMedia options` → RND-06 (imageFormat png), RND-07 (crf 16),
  RND-08 (pixelFormat yuv420p), RND-09 (gl passed to `renderMedia`, never the
  config file).
- `remotion.config.js deleted or annotated` → RND-10 (deleted) + RND-11 (no
  `Config.set` relied on by the SSR path).
- `matrix green on one channel` → RND-12 (one full Short per mg channel on CI).
  NOTE: the register gates RND-12 at **Stage 16** (`Stage = 16` column, row
  329) — the per-channel CI matrix is verified there, when production renders
  actually run. Same mapping precedent as Stage 12's COL-20 (D15 → stage 16).
  The stage-14 evidence for it is recorded (below) but the verdict is NOT
  forced here.

## Per-check result

| Check | Status | Evidence (run at gate time, not asserted) |
|---|---|---|
| RND-06 `imageFormat: 'png'` | **PASS** | render.js:291 `imageFormat: "png"`. |
| RND-07 explicit `crf` | **PASS** | render.js:292 `crf: 16`. |
| RND-08 `pixelFormat` | **PASS** | render.js:293 `pixelFormat: "yuv420p"`; byte-confirmed in the stage-14 clip's ffprobe (pix_fmt=yuv420p). |
| RND-09 `gl` in `renderMedia`, not config | **PASS** | render.js:294 `chromiumOptions: { gl: "swangle" }`; config file deleted (RND-10). |
| RND-10 `remotion.config.js` deleted or annotated | **PASS** | File deleted: `git status` shows ` D src/skills/remotion-render/remotion.config.js`, Test-Path False, nothing imports or loads it. |
| RND-11 no config-file setting relied on by SSR path | **PASS** | Zero `Config.set` repo-wide; publicDir verified as the bundler default from installed `@remotion/bundler` source (dist/bundle.js:182,256-258). |
| RND-12 one Short per mg channel on CI | **N/B** (gates at stage 16) | Denominator restated 12/12 → 6/6 per register scope header (corrected 2026-08-16; 12/12 predated the 50→17 portfolio cut). CI not dispatchable from this session (`gh` 2.97.0 unauthenticated, no token) — the register's method for RND-12 is `CI`, and a verdict would have required a real matrix run. Evidence recorded for stage 16: 2026-08-26 real ch-02 (Legal Brief) Short rendered clean via render.js's actual CLI in a sandboxed Linux environment (1/6); stage-14 real-path clip (270×480, yuv420p, h264, 30/1 fps, 2.166667 s); full-length runs reaching `renderMedia`. |

## Shared-file requests applied (protocol step 4, render lane §2a)

1. **`qa/INVENTORY.md` line 16** — `remotion.config.js` entry removed (the
   file no longer exists; keeping the inventory line would document a dead
   file). Verified: 0 `remotion.config.js` mentions left in INVENTORY.
2. **`MOTION-GRAPHICS-MANUAL.md` A6.2 (line ~312)** — the
   `Config.setChromiumOpenGlRenderer('angle')` advice struck with a
   "Superseded 2026-08-29" notice pointing to LAYOUT-SYSTEM §0.10 (config file
   inert for the SSR path) and render.js's explicit `chromiumOptions.gl`.
   Applied as a deletion-plus-replacement (rule 3). Remaining single mention is
   the supersede notice itself.
3. **`CHECK-REGISTER.md`** — RND-12 restated 12/12 → 6/6 (scope header),
   RND-06..11 status cells → PASS, RND-12 → N/B with stage-16 venue. Applied
   with the AUD-* updates in the same script.
4. **`data/research/2/render-settings.json` (render_command)** — CARRIED to
   the research lane, NOT applied here: the file is produced by
   `src/utils/render-settings.js` (lines 57/105) which embeds the same
   pre-RND/SSR-era CLI string (`npx remotion render src/index.tsx ...`); a
   half-fix of just the artifact would be regenerated stale by the next
   research run. The generator + artifact are a single fix for the research
   lane (not one of the eight audit lanes this stage). Recorded in the render
   ledger §2a.

## Gate verdict

Protocol row 14 gate text: "explicit `renderMedia` options; `remotion.config.js`
deleted or annotated; matrix green on one channel".

- Clause 1 (explicit renderMedia options): **PASS** — RND-06..09, byte-confirmed.
- Clause 2 (remotion.config.js deleted or annotated): **PASS** — deleted
  (RND-10), nothing imports it, zero `Config.set` (RND-11).
- Clause 3 (matrix green on one channel): **deferred to Stage 16 by the
  register itself** (RND-12 row Stage = 16). Not forced here; the stage-14
  evidence (real ch-02 clean run, real-path clip, full runs reaching
  renderMedia) is recorded for that stage. Per §4.3 the row is not marked
  complete; it stays N/B with its venue.

**STAGE 14 GATE: PASS. Six stage-14 render-config rows verified (RND-06..11);
RND-12 carries to Stage 16 per its register row. Stage-9-era rendersettings
CLI string carried to the research lane (generator + artifact as one fix).**

Files changed in Stage 14 (orchestrator-applied or lane-verified):
CHECK-REGISTER.md (RND-06..12), qa/INVENTORY.md (line 16 removed),
MOTION-GRAPHICS-MANUAL.md (A6.2 supersede notice). `remotion.config.js` was
already deleted before this gate (previous session; test-path false at gate
time). Lane-owned artifacts under data/audit/14/ (ledger, measure/).
Pre-existing stage-14 leftovers (render-no-attribution.mjs,
_no-attribution-entry.jsx, out/, measure/) were not this stage's work and were
left untouched.