# Audit lane: audit-render — Stage 15 ledger (Delete-list sweep)

- **Lane:** audit-render (model `opencode/big-pickle`)
- **Stage:** 15 — Delete-list sweep (protocol row 15: LAYOUT-SYSTEM D1–D14, FINISH-SPEC R01–R30 re-encoded as `DEL-*` in CHECK-REGISTER §3.4, lines ~1471–1527)
- **Date:** 2026-08-30
- **Scope:** DEL-11, DEL-14, DEL-20 (primary owner) + cross-cutting co-reports
- **Method followed:** Three-phase edit protocol applies ONLY if a file I own is edited. No edit to an owned file was required this session (no deletion SFR landed in `render.js`), so the sweep + classification path was followed. Every grep below was run fresh this session; no row was marked pass from the register's State column.
- **Ownership used (edit):** `render.js`, `remotion.config.js`, `.github/**`, `data/audit/**`. No owned file was edited.

---

## 1. Per-row verdicts

| Row | Pattern / scope (per register §3.4 + dispatch) | Verdict | file:line evidence (fresh greps) |
|---|---|---|---|
| **DEL-11** | Inert `remotion.config.js` reliance — `Config.set` referenced by `render.js` | **PASS** | Zero `Config.set` in `src/skills/remotion-render/` and the whole SSR chain. `render.js` passes every encoder option explicitly to `renderMedia()`. `remotion.config.js` deleted on disk (git status `deleted`, `Test-Path` False, still tracked/not yet committed). |
| **DEL-14** | `inputProps` entry-file workaround — generated entry path | **FAIL** (live pattern match) + SFR | Production path PASS (render.js inputProps at `selectComposition` L272, `renderMedia` L282; zero `writeRenderEntry`/`render-entry`/`verify-entry`). BUT `qa-sample.js:54/76/82/88` writes+bundles a generated `qa-entry.jsx` and reaches the component via `defaultProps` (not `inputProps`); CI-live via `.github/workflows/visual-qa-loop.yml:75`. |
| **DEL-20** | JPEG intermediates — `imageFormat.*jpeg` | **PASS** (real-render intermediates) + residual note | `render.js:291` png, `qa-scripts/render-clip.mjs:142` png, `qa-scripts/inspect-anchors.mjs:228` png. Only `qa-scripts/qa-render-motion.mjs:87` = jpeg — throwaway, non-gating, non-pipeline (classified LEGITIMATE REUSE, co-reported). |

---

## 2. Sweep detail per row (all greps run this session)

### DEL-11 — `Config.set` (BLOCKER)

Repo-wide `Config.set` grep → 44 hits, **none** in any code file of the SSR render path. Categorised:

- `.agents/skills/**/*.md`, `.agents/skills/remotion-best-practices/**/*.md` — third-party/agent skill **documentation** (string-only, describes a pattern, no code runs).
- `vendor/video-shotcraft/template/remotion.config.ts` — vendored external template (L3-6 `Config.set...`).
- `LAYOUT-SYSTEM.md:117-120,126`, `CHECK-REGISTER.md:328,1489`, `data/audit/{0,13,14}/**` — docs / prior ledgers / GATE records.
- `data/audit/14/audit-render.ledger.md:25,41,64,92,101` — my own prior stage ledger.

**Scope check (SSR path):** `render.js` (524 lines, fully read) has **zero** references to `Config`, `remotion.config`, or `@remotion/cli/config`. Its imports are local modules + `@remotion/bundler` / `@remotion/renderer`. All encoder options are passed explicitly to `renderMedia()` at `render.js:275-300` (`codec`, `audioCodec`, `enforceAudioTrack`, `imageFormat: "png"` L291, `crf: 16`, `pixelFormat: "yuv420p"`, `chromiumOptions: { gl: "swangle" }`, `concurrency`, `scale`, `timeoutInMilliseconds`).

`remotion.config.js` deleted on disk (git status: `deleted: src/skills/remotion-render/remotion.config.js`; `Test-Path` → False; still in `git ls-files`, so the deletion is uncommitted). Nothing imports it; nothing references it.

**CI invocation (my `.github/**` ownership):** all real renders are SSR via `node`, not the config-reading Remotion CLI:
- `.github/workflows/review-publish.yml:105` → `node src/skills/remotion-render/render.js ...`
- `.github/workflows/daily-pipeline.yml:470-472` → `node scripts/render-and-qa.js`
- `.github/workflows/visual-qa-loop.yml:75` → `node qa-sample.js`
- No `.github/**` file contains `Config.set` or `remotion.config` (Confirmed: `Get-ChildItem .github -Filter *.yml | Select-String 'Config\.set|remotion\.config'` → 0 hits).
- `scripts/render-and-qa.js:39` uses `RENDER_JS = .../render.js` (spawns the SSR version); no `Config`, no `npx remotion`.

**Verdict: PASS** — re-confirms register RND-11 (stage 14) from fresh greps. Nothing in the SSR path relies on any config-file setting; `@remotion/cli` is never used for a real render.

### DEL-14 — `inputProps` entry-file workaround (MAJOR)

**Production path — PASS.** `render.js` reaches `inputProps` directly on both render calls:
- `render.js:269-274` `selectComposition({ serveUrl, id, inputProps: props, ... })` (inputProps at L272)
- `render.js:275-300` `renderMedia({ ..., inputProps: props, ... })` (inputProps at L282)

Grep `<render package>` for `writeRenderEntry|render-entry|verify-entry|generate-entry|generated[- ]entry|_entry` → **0 hits**. The original workaround mechanism (`writeRenderEntry`, `render-entry.jsx`, `verify-entry.jsx`) is gone. Positive checks RND-04 (inputProps reaches component — fixture-verified at stage 1) and RND-05 (generated-entry workaround gone) hold for the production path.

**LIVE PATTERN MATCH — FAIL for the pattern as scoped by this dispatch.** `src/skills/remotion-render/qa-sample.js` (render package root, outside my edit ownership) is an auto-generated-entry mechanism that **does not reach `inputProps`**:
- `qa-sample.js:54` `const entryPath = join(__dirname, "qa-entry.jsx");`
- `qa-sample.js:76` `<Composition ... defaultProps={DEFAULTS} ... />` (props baked into the generated entry)
- `qa-sample.js:82` `writeFileSync(entryPath, entry, "utf-8")` (writes the generated shim)
- `qa-sample.js:88` `bundle({ entryPoint: entryPath, ... })`
- `qa-sample.js:89` `selectComposition({ serveUrl, id: "QaComp", ... })` — **no `inputProps`**
- `qa-sample.js:90-99` `renderMedia({ ... })` — **no `inputProps`**
- **CI-live:** `.github/workflows/visual-qa-loop.yml:75` runs `node qa-sample.js ...`; workflow header (L6-7) even says "compositions are data-driven (no defaultProps)... it bakes a channel's SRT into a QA entry."

This is exactly the dispatch's enumerated DEL-14 pattern: "an auto-generated entry shim (`qa-entry.jsx`) / a 'generated entry' mechanism instead of reaching `inputProps` directly." It is not just a stale reference — it writes and bundles a live generated entry and reaches props via `defaultProps`.

Classification rationale: the *domain the deleted thing belonged to* (the production SSR render path) is clean, which is why RND-04/RND-05 pass. But the register §3.4 method is "a single grep returning zero hits" for the DEL-14 pattern, and this dispatch's scope explicitly names the generated-entry mechanism class — which `qa-sample.js` is a live member of, and it is CI-wired through a workflow I own. I therefore cannot honestly mark DEL-14 **PASS** as-read. **Verdict: FAIL (live match)** + SFR (qa-sample.js outside my edit ownership).

Note: `data/audit/15/_fallback-entry.jsx` also matches the `_*-entry.jsx` literal pattern, but it is a **pre-existing audit fixture** (from the layout/motion fullbleed-fallback lane), NOT in the render package and NOT the workaround mechanism — classified LEGITIMATE (fixture), not owned/edited by me.

### DEL-20 — JPEG intermediates (MAJOR)

`imageFormat` across the render package (fresh grep):
- `render.js:291` → `"png"` (production)
- `qa-scripts/render-clip.mjs:142` → `"png"` (production-path instrument)
- `qa-scripts/inspect-anchors.mjs:228` → `"png"` (anchor-frame renderStill)
- `qa-scripts/qa-render-motion.mjs:87` → `"jpeg"` (the only jpeg), with `jpegQuality: 80` L88

**Scope scrutiny — does `qa-render-motion.mjs` "gate real renders"? NO:**
- Its own header (`qa-render-motion.mjs:8-9`): "Throwaway QA script, not part of the pipeline."
- It renders a **synthetic fixture** (`channelId: "ch-verify"`, `style: "verify"`, `font: "DM Sans"`, hand-built `mg` package), not a real channel/topic.
- It is **not referenced by any `.github` workflow, any register gate, or `visual/run-visual-tests.js`**; its only mention anywhere is a comment inside `render-clip.mjs:14`.
- Output is an unshipped QA artifact `qa/motion-verify.mp4`.
- The real-render gate (`render-visual-tests.sh`) renders through the **real `render.js` CLI** with `imageFormat: "png"`.

**Verdict: PASS** for the DEL-20 concern (JPEG *intermediates in real renders*) — every production/gate instrument uses png; no real or gated render uses jpeg. Residual: `qa-render-motion.mjs:87` is a jpeg intermediate on a throwaway non-gating QA clip → classified **LEGITIMATE REUSE** (QA-only, synthetic, unshipped), co-reported below so the owning lane (or orchestrator) can decide whether to flip it to png for strict discipline. No edit made (outside my ownership; also a deliberate speed choice that does not change delivered quality).

---

## 3. Co-reports (cross-lane; I do not own these edits)

### CO-REPORT 3a — `chunkVoiceover` in `render.js` (DEL-09 / TYP-11, primary = audit-type)

Exact lines in my owned file, for the owning lane's deletion SFR:
- `render.js:134-136` — definition: `function chunkVoiceover(text, maxWords = 7) { return chunkTextClauseAware(text, maxWords); }` (a 2-line wrapper delegating to `chunkTextClauseAware` from `compositions/beats.js`).
- `render.js:153` — call site: `content: chunkVoiceover(s.voiceover),` inside `toContentSections`.
- Also present in `verify-compositions.js:22,36` (not my file).
- Register §4.2 documents that `chunkVoiceover` is now a clause-aware wrapper; the pattern matches by name only, and TYP-21 is the real behavioural check. **No deletion SFR from audit-type landed in `render.js` this session → nothing for me to apply.** If/when it does, I will apply the exact before→after per the three-phase protocol and note it here.

### CO-REPORT 3b — DEL-29 spirit in `render.js`: CLEAN

`render.js` (full read) contains **zero** `https://` and **zero** `fetch(` (`Select-String` on the file → 0 hits). render.js does not fetch remote assets at render time. Script/topic JSON loads from local `data/research/` via `readFileSync(join(ROOT, ...))`. The only network-capable modules are build/sourcing tools, not the render runtime: `fetch-fonts.js` (font vendoring, build time; owned by assets lane) and `qa-scripts/fetch-sfx-library.mjs` (asset sourcing, build time). DEL-29 spirit satisfied.

### CO-REPORT 3c — DEL-20 residual: `qa-render-motion.mjs:87` jpeg (see §2 DEL-20)

Shared/`qa-scripts/**` (unassigned, orchestrator-shared per `data/audit/_ownership-reconciliation.md:41-46`). Not gating real renders; classified LEGITIMATE REUSE. Recommend (optionally) flipping to `png` for strict grep-cleanliness, owned by orchestrator/qa lane.

### CO-REPORT 3d — `qa-sample.js` generated entry (DEL-14) is render-lane-relevant AND CI-wired

The DEL-14 FAIL stanza (§2) is the substantive co-report. The fix touches `qa-sample.js` (render pkg root, **unassigned** / not my edit ownership) and/or `.github/workflows/visual-qa-loop.yml` (MY ownership). If the orchestrator chooses the refactor, the workflow change lands in my `.github/**` ownership and I can apply it once the `qa-sample.js` change is specified.

---

## 4. SHARED-FILE REQUESTS (SFR) — filed, none apply to an owned file

### SFR-DEL14-1 (filed; owner = orchestrator/shared `qa-sample.js`)

**Reason:** DEL-14 FAIL — live generated-entry mechanism at `qa-sample.js`, reached via `defaultProps` not `inputProps`, CI-live through `.github/workflows/visual-qa-loop.yml:75`.

**Exact before → after (for `src/skills/remotion-render/qa-sample.js`):**

Before (L54, L61-82, L88-99 in essence):
```
const entryPath = join(__dirname, "qa-entry.jsx");
...
const defaults = JSON.stringify(props, null, 2).replace(/</g, "\\u003c");
const entry = `import React from "react";
import { Composition, registerRoot } from "remotion";
import { MotionGraphicsShorts } from "./compositions/motion-graphics.jsx";

const DEFAULTS = ${defaults};

const Root = () => (
  <Composition
    id="QaComp"
    component={MotionGraphicsShorts}
    durationInFrames={${mg.totalFrames}}
    fps={30}
    width={540}
    height={960}
    defaultProps={DEFAULTS}
  />
);

registerRoot(Root);
`;
writeFileSync(entryPath, entry, "utf-8");
...
const serveUrl = await bundle({ entryPoint: entryPath, onProgress: () => {} });
const composition = await selectComposition({ serveUrl, id: "QaComp", browserExecutable: CHROME });
await renderMedia({ composition, serveUrl, codec: "h264", frameRange: [0, frames - 1], outputLocation: outPath, ... });
```

After (proposal — reach props via `inputProps`, drop the generated `qa-entry.jsx`):
- Replace the runtime `writeFileSync` of a generated entry with a **static** minimal entry (committed, not generated) that renders `MotionGraphicsShorts` at 540x960/180f and passes nothing — OR point `bundle` at the real `Root.jsx` and select the real composition and constrain with `frameRange`/`scale`.
- Move `props` out of `defaultProps` and into `inputProps` on **both** `selectComposition` and `renderMedia` (mirroring `render.js:272,282`), so the composition reads props via inputProps and the generated-entry workaround is gone.
- Keep the 540x960/180-frame cheap-sample contract (that is the QAP purpose); delete `qa-entry.jsx` generation entirely.

**Decision request to orchestrator:** Either (A) apply the refactor above (owner: orchestrator for `qa-sample.js`; render lane can apply the `.github/workflows/visual-qa-loop.yml` side if it changes), or (B) formally AMEND the DEL-14 register row to scope to the production SSR render path (`render.js` + real `Root.jsx`) with a register note carving the QA-sampling tool out as a documented exception (DEL-17-style). If (B), the register row's "Must not exist" should read e.g. "`inputProps` entry-file workaround **in the production render path (`render.js`/real `Root.jsx`)**" and the note should cite `qa-sample.js` + `visual-qa-loop.yml`.

Register is read-only for audit lanes → either outcome is applied by the register keeper/orchestrator, not by me.

### SFR-DEL20-1 (advisory; owner = orchestrator/qa shared, optional)

**Reason:** strict grep-cleanliness for DEL-20.
Before: `qa-scripts/qa-render-motion.mjs:87-88` `imageFormat: "jpeg", jpegQuality: 80`.
After: `imageFormat: "png",` (drop `jpegQuality`), matching every other render instrument.
Optional — DEL-20 already PASSes because this script does not gate real renders. Filed as an advisory only; not a blocker.

---

## 5. Edits made this session

None to owned files. No deletion SFR for `render.js` was received this session, so no three-phase edit was triggered. `remotion.config.js` deletion (stage 13/14, already applied and on-disk-deleted) was re-confirmed present-in-status / absent-on-disk; nothing further to change.

---

## 6. Final VERDICT

- **DEL-11: PASS** (re-confirms RND-11; zero `Config.set` in SSR path; encoder options explicit; render invoked via `node`, never the config-reading CLI; `remotion.config.js` on-disk-deleted).
- **DEL-14: FAIL — live generated-entry workaround in `qa-sample.js`** (production path is clean and RND-04/05 hold; but the dispatch's DEL-14 pattern "a generated entry mechanism instead of reaching `inputProps` directly" matches CI-live `qa-sample.js`). → **SFR-DEL14-1** filed (refactor OR register-scope amendment); owner not in my edit list.
- **DEL-20: PASS** for real-render intermediates (all production/gate instruments png); residual non-gating jpeg in `qa-render-motion.mjs:87` classified LEGITIMATE REUSE → advisory **SFR-DEL20-1**.
- Co-reports: `chunkVoiceover` render.js:134/153 (DEL-09/TYP-11, audit-type primary; nothing to apply yet); DEL-29 spirit clean in render.js (no `https://`/`fetch(`); `qa-render-motion.mjs:87` jpeg; `qa-sample.js` DEL-14.
- **Stage 15 lane verdict (audit-render): IMPEDED on DEL-14 (live match + SFR open); DEL-11 PASS; DEL-20 PASS.** No owned file changed; ledger at `data/audit/15/audit-render.ledger.md`.
