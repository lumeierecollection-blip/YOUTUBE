# audit-render — Stage 14 ledger (Encoder + CI)

**Stage:** 14 · **Lane:** audit-render · **Session:** 2026-08-29 · **Model:** opencode/big-pickle
**Owns:** `src/skills/remotion-render/render.js` · `src/skills/remotion-render/remotion.config.js` · `.github/**` · `data/audit/**`
**Register rows in scope:** RND-06 · RND-07 · RND-08 · RND-09 · RND-10 · RND-11 · RND-12
**Parallel lane:** Stage 13 audit-audio (owns `src/audio/**`, `audio.js`, `sound-design.js`, `sfx-library.js`) — untouched.

## 0. Change log (append-only)

| # | What | Phase | When |
|---|---|---|---|
| 1 | DELETED `src/skills/remotion-render/remotion.config.js` (RND-10) | P1 grounding → P2 counter-check CONFIRM → P3 file-absent check | 2026-08-29 |

One change only, and it was fully in-ownership. No SFRs filed — nothing outside this lane's list needed editing for any row in scope.

## 1. Row verdicts (RND-06…RND-12)

| ID | Check | Register state | Verdict this session | Evidence |
|---|---|---|---|---|
| RND-06 | `renderMedia` sets `imageFormat: 'png'` | FAIL (never re-measured) | **PASS** (re-verified, not re-fixed) | render.js:291 — parse + counter-check CONFIRM |
| RND-07 | `renderMedia` sets an explicit `crf` | FAIL (never re-measured) | **PASS** (re-verified, not re-fixed) | render.js:292 `crf: 16` — parse + counter-check CONFIRM |
| RND-08 | `renderMedia` sets `pixelFormat` | FAIL (never re-measured) | **PASS** (re-verified, not re-fixed) | render.js:293 `pixelFormat: "yuv420p"` — parse + counter-check CONFIRM |
| RND-09 | `chromiumOptions.gl` passed to `renderMedia`, not the config file | FAIL (never re-measured) | **PASS** (re-verified, not re-fixed) | render.js:294 `chromiumOptions: { gl: "swangle" }`; config file deleted (RND-10) so the "not the config file" half holds structurally |
| RND-10 | `remotion.config.js` is deleted or annotated as CLI-only | FAIL | **PASS** (CHANGED) | File deleted this session — see §2 |
| RND-11 | No config-file setting is relied on by the SSR path | FAIL | **PASS** (code review + installed-source check) | render.js passes every encoder option explicitly to `renderMedia()`; zero `Config.set` anywhere; `bundle()` default publicDir resolves to `<subpackage>/public` regardless — see §3 |
| RND-12 | One full Short renders per mg channel | FAIL — "never a clean run in CI"; 1/12 via 2026-08-26 local ch-02 render (sandboxed Linux), artifact not present here | **N/B** — blocked, not failed | CI cannot be dispatched from this session (`gh` unauthenticated — no `workflow_dispatch`); full-length software-GL Short doesn't complete in a 90-minute block on this GPU-less box. Smaller-scope runnable artifact through the real path completed — see §4 |

## 2. RND-10 — the one change (three-phase protocol, in full)

### Phase 1 — ground the claim with live sources
- **Claim:** deleting `remotion.config.js` cannot change render output because the config file only applies to Remotion CLI commands, and Rendering SSR APIs never read it. All four settings in the file were inert on the SSR path used by `render.js` (`bundle()` + `renderMedia()`).
- **Sources (fetched, not assumed):**
  - https://www.remotion.dev/docs/config — "These options will apply to CLI commands such as `npx remotion studio` and `npx remotion render`"; code-styled `:::warning The configuration file has no effect when using SSR APIs. :::` ; `setVideoImageFormat` default jpeg; `setCrf` h264 range 1–51, default 18 (crf 16 in-range); `setPixelFormat` — yuv420p valid; `setChromiumOpenGlRenderer('angle')` is a CLI option and `--gl` takes precedence.
  - https://www.remotion.dev/docs/renderer/render-media — `imageFormat?`, `crf?`, `pixelFormat?`, `chromiumOptions?.gl` are all first-class `renderMedia()` options (the SSR path — exactly how the repo applies them).
  - https://www.remotion.dev/docs/gl-options — `swangle` is "default on Lambda and Cloud Run" and the documented recommendation "on a machine with no GPU"; also states plainly: **"In Remotion 4.0, GitHub Actions will fail when using `angle`, since Actions runners don't have a GPU."** This matches render.js:286-290's own comment and is the whole reason `gl: "swangle"` is the CI-safe value.
  - https://www.remotion.dev/docs/bundle — `bundle()` (the SSR bundler entry `render.js` actually uses) is *not* the CLI; config-file options don't reach it.
  - In-repo spec: LAYOUT-SYSTEM.md §0.10 — "`remotion.config.js` is entirely inert" on the SSR path (all four lines "silently discarded"), and §5.6.2 — "Delete `remotion.config.js` or reduce it to Studio-only concerns, with a comment stating it does not affect `render.js`."
- **Reasoning:** the deleted file set (jpeg image format / overwrite true / publicDir "public" / angle GL). On the SSR path all four were ignored; `render.js`'s `renderMedia()` call already carries its own `imageFormat: 'png'`, `crf: 16`, `pixelFormat: 'yuv420p'`, `chromiumOptions: { gl: 'swangle' }` — the values (except the config's stale `angle`, which would have FAILED on Actions runners anyway). Leaving an inert config next to a live SSR render path is the §5.6.2 hazard.

### Phase 2 — independent counter-check
- verify-independent (task ses_fb1272655ffee4VF3XCrvQvmdQ): **CONFIRM** — `git diff` shows `deleted file mode 100644`; `git show HEAD:...` shows the 8-line file with all four `Config.set` calls; zero `Config.set` / imports of the config in code files under the render package.

### Phase 3 — runnable measurement
- File-absent check: `Test-Path src/skills/remotion-render/remotion.config.js` → `False` after deletion; `git status` shows exactly ` D src/skills/remotion-render/remotion.config.js` (plus pre-existing Stage-12 working-tree files belonging to other lanes).
- **No behavior change on any owned workflow:** grep across `src/skills/remotion-render/*.js|*.jsx` and `.github/**` shows zero references to `remotion.config` as an import or load. `.github/workflows/*.yml` invoke `node render.js` (SSR) and `npx remotion browser ensure` (needs no config); neither reads the config file.

### Stale-doc notes (not SFRs — deletion stands alone and the register row is satisfied)
- `qa/INVENTORY.md:16` still documents the file's contents; `MOTION-GRAPHICS-MANUAL.md:312` (A6.2) still advises setting the GL renderer via `remotion.config.js` — advice that §0.10 already invalidated and is now impossible to follow. Suggested for a future docs pass by whoever owns those files; not blocking RND-10.

## 2a. SHARED-FILE REQUESTS (filed, awaiting owners — none blocking this stage)

| Target | Change wanted | Owner lane | Why this lane can't do it | Blocks? |
|---|---|---|---|---|
| `qa/INVENTORY.md:16` | Remove the entry documenting `remotion.config.js` (file deleted by RND-10) | assets/doc lane | Outside this lane's ownership (`qa/**`) | No |
| `MOTION-GRAPHICS-MANUAL.md:312` (A6.2) | Delete/strike the `Config.setChromiumOpenGlRenderer('angle')` advice; point to §0.10 + render.js `chromiumOptions` | assets/doc lane | Outside ownership (`*.md` render contract) | No |
| `CHECK-REGISTER.md` RND-12 | Restate threshold 12/12 → 6/6 (mg channel count); update status cell for RND-06..12 per this ledger once orchestrator confirms | register keeper | Register is read-only for audit lanes | No |
| `data/research/2/render-settings.json` | Documented CLI render command (`npx remotion render --crf=18`) is pre-RND/SSR-era and no longer how renders run; consider replacing with the render.js SSR contract | research lane | Outside ownership (`data/research/**`) | No |

## 3. RND-11 — no config-file setting relied on by the SSR path

Method per register: code review, threshold 0 reliance.

- `render.js`'s `renderMedia()` call (lines 275–300) passes **every** quality-relevant option explicitly: `codec: 'h264'`, `audioCodec: 'aac'`, `enforceAudioTrack: true`, `imageFormat: 'png'`, `crf: 16`, `pixelFormat: 'yuv420p'`, `chromiumOptions: { gl: 'swangle' }`, `concurrency: 2`, `scale`, `timeoutInMilliseconds: 120000`. Nothing for the encoder to pull from a config file.
- `Config.set` / `@remotion/cli/config` — zero hits repo-wide in render code (counter-check CONFIRM #1 and #2).
- **The one candidate reliance — `setPublicDir("public")` — checked against installed source** (`@remotion/bundler@4.0.503` dist/bundle.js):
  - line 182: `resolvedRemotionRoot = rootDir ?? findClosestPackageJsonFolder(entryPoint) ?? process.cwd()` — render.js's `bundle({ entryPoint: join(__dirname, "Root.jsx") })` passes no `rootDir`, so the root = the render subpackage (its package.json).
  - line 256–258: `publicDir` from options, else `join(resolvedRemotionRoot, 'public')` = `src/skills/remotion-render/public/` — the REAL public dir (fonts, asset-library, b-roll, sfx). The deleted config's `setPublicDir("public")` was not load-bearing: the same directory was already the bundler default. Static asset resolution is identical with the file gone.
- Verdict: **PASS.** After RND-10 the file doesn't even exist, so nothing can rely on it; even while it existed, the SSR path did not read it.

## 4. RND-12 — one full Short per mg channel (CI)

### Blockers (named, concrete)
1. **CI cannot be run from this session.** `gh` 2.97.0 present but unauthenticated (`gh auth status` fails) → cannot `workflow_dispatch` the daily-pipeline render job, and this repo has no local GitHub token. The register's RND-12 evidence convention ("renders clean in CI / matrix green on one channel") requires an Actions run, which needs write access this lane lacks.
2. **Full-length software-GL renders don't fit an interactive session on this box.** This machine has no GPU; `gl: "swangle"` renders at ~1.5–8s/frame:
   - Full ch-01 Short (2194 frames, 1080×1920): killed at 40 min, no mp4 (sidecars written — the real CLI progressed past package build into `renderMedia`).
   - Same Short at scale 0.5 (540×960): killed at 90 min, 0 frames of mp4 output yet (temp PNGs confirmed rendering in progress).
   - 463-frame minimal Short at scale 0.5: killed at 60 min mid-render.
   - A 65-frame single-beat clip at scale 0.25 completed in ≈15 min → extrapolated full 2194-frame Short ≈ 5.5–8 h on this box.

### Evidence actually produced this session (runnable, real path)
- `data/renders/clips/debt-snowball-vs-debt-avalanche-CINEMATIC_STATEMENT.mp4` (116,940 B) — rendered through the **real** `buildMgPackage` + real `MotionGraphicsShorts` composition + `renderMedia()` with `imageFormat: 'png'`, `pixelFormat: 'yuv420p'`, `chromiumOptions: { gl: 'swangle' }` (qa-scripts/render-clip.mjs, a production-path instrument; its `crf: 20` is clip-only, note below).
- **ffprobe output (captured):** `codec_name=h264` · `profile=High` · `width=270` · `height=480` · `pix_fmt=yuv420p` · `r_frame_rate=30/1` · `duration=2.166667` — i.e. the pixel-format option provably reaches the encoder, and h264/yuv420p/30fps match the render-settings.json contract (crf 20 vs 16 is the clip instrument's own value; the production value `crf: 16` is verified by parse, not by this clip).
- `data/renders/1/*-visual-report.json` — written by the real CLI during the killed full-length runs: 31 visual beats, 106 visual states, 3 distinct strategies, real SRT-derived timing and fallback reasoning. Proves the mg path executes end-to-end up to frame encoding on the actual script.
- Register's own 1/12 (2026-08-26 ch-02, sandboxed Linux) could not be re-verified here: `data/renders/2/` contains nothing on this machine.

### Verdict
**N/B — not measurable in this lane/session, not FAIL.** The register's own threshold note counts only CI runs as green; the 12/12 denominator is also stale (safe-zone header corrected to 6 mg channels on 2026-08-16; "12/12" likely predates it — see register §0.2 note). This session's contribution: a completed runnable artifact through the real SSR render path plus full-length proof of the pipeline reaching `renderMedia`. The CI-gating part of RND-12 needs a runner with a GPU or very large time budget — record register state as N/B-open, not PASS.

## 5. Verification log (real outputs)

- `git diff -- src/skills/remotion-render/remotion.config.js` → `deleted file mode 100644` (counter-check relayed same).
- `git grep "Config.set"` in render package → 0 hits (both counter-checks relayed zero).
- `git grep "remotion.config"` in workflows → 0 hits.
- `Test-Path remotion.config.js` → `False`.
- `ffprobe` on completed clip → see §4.
- Search-tool re-verification of docs pages: config, render-media, gl-options, bundle — all fetched live this session (URLs in §2).

## 6. Open items / recommended follow-ups (not blocking this stage)

1. RND-12 needs one CI run to flip green: enablement requires orchestrator-side gh token or a pushed branch + Actions dispatch. Threshold should be restated as 6/6 (mg channels).
2. Docs referring to the deleted config file: `qa/INVENTORY.md:16`, `MOTION-GRAPHICS-MANUAL.md:312` (A6.2)'s `Config.setChromiumOpenGlRenderer('angle')` advice — already superseded by LAYOUT-SYSTEM §0.10 and now impossible to follow; a future docs pass should strike it.
3. `render-clip.mjs` uses `crf: 20` (clip QA value) — harmless for QA, but if a clip is ever cited as encoder evidence, its crf is not the production 16. Already documented in its own comment.
4. **Pre-existing files in this stage's dir (NOT from this session):** `data/audit/14/render-no-attribution.mjs`, `_no-attribution-entry.jsx`, `out/no-attribution-beat*.png` — timestamps 17:36:12 (before this session's 20:00+ staging), Linux `/opt/pw-browsers` paths, header "Phase D Part 1.1" (the Stage-12 visual lane's on-screen-credit-removal probe). Untracked leftovers that happen to share the stage-14 dir name; deliberately left untouched. They are not part of this ledger.