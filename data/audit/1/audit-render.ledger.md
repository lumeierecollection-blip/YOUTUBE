# AUDIT-RENDER — STAGE 1 (DEPENDENCY UNBLOCK) — LEDGER

**Lane:** `audit-render` (renderMedia options, config, encoder, CI)
**Owns:** `src/skills/remotion-render/render.js` · `src/skills/remotion-render/remotion.config.js` · `.github/**` (+ `data/audit/**`)
**Date:** 2026-08-06
**Protocol:** CROSSCHECK-PROTOCOL.md Part 2 (three phases per change)
**Register rows in scope (Stage 1):** RND-01, RND-02, RND-03, RND-04, RND-05

---

## PHASE 1 — GROUNDING (claim cards)

### CLAIM-render-001  (register RND-01) — RE-ENTERED PHASE 1 AFTER REJECT (P3.5)
```
ASSERTION   (corrected) The render subpackage and root package.json declare the
            same Remotion range (^4.0.503) — equal per the register's method —
            BUT the installed tree is NOT a single instance: core remotion@4.0.505
            with five nested remotion@4.0.506 copies under
            @remotion/{effects,noise,rough-notation,shapes,transitions}, and npm
            `latest` has moved to 4.0.506.
SPEC REF    CHECK-REGISTER §3.7 RND-01 (method: parse both package.json; threshold:
            equal) · CROSSCHECK-PROTOCOL Part 4 Stage 1 gate ("render subpackage on
            remotion@^4.0.503 + React 19") · MOTION-BLUEPRINT.md line 570
            ("remotion@^4.0.503, React 19")
SOURCES     [1] first-party registry: npmjs.com/package/remotion + registry.npmjs.org/
            remotion/latest — remotion readme: "align the version of all remotion and
            @remotion/* packages to the same version"; live `latest` = 4.0.506
            (measured 2026-08-06)
            [2] first-party docs: remotion.dev/docs/react-19 — React 19 needs Remotion
            ≥4.0.0
            [3] in-repo spec: MOTION-BLUEPRINT.md:570 pins remotion@^4.0.503
RE-VERIFIED YES — registry latest is 4.0.506 (moved past 4.0.505); alignment
            guidance unchanged
CURRENT     Declared: subpackage package.json:24 `^4.0.503`; root package.json:33
            `^4.0.503` — EQUAL (register method passes). Installed (measured):
            node_modules/remotion = 4.0.505; nested remotion@4.0.506 under
            @remotion/effects, /noise, /rough-notation, /shapes, /transitions
            (5 copies). npm ls (root) confirms the nesting. Registry latest: 4.0.506,
            so a fresh `^4.0.503` install resolves 4.0.506. The subpackage has no
            lockfile, is not a workspace member, and is absent from the root lockfile
            → nothing pins its resolution.
DELTA       Register's "FAIL — 4.0.0 vs 4.0.503" is stale; declared equality passes.
            BUT version-alignment (npm guidance) is violated: 2-version tree + registry
            drift. Original card's "single installed 4.0.505 instance" wording was
            FALSE and was rejected by the counter-check.
PLAN        No in-lane product change. Escalate alignment + lockfile gap as
            SHARED-FILE REQUEST D. Register method note: RND-01's parse-equality
            check passes; consider amending the method to also measure the installed
            tree (npm ls) so the skew is caught.
COUNTER     REJECT (verifier ses_0286b0c1effeDHG2Zy11g9i5IV) — "single installed
            remotion@4.0.505 instance" FALSE: lockfile + disk show six remotion
            installs at two versions (core 4.0.505; nested 4.0.506 ×5); ^4.0.503
            resolves to 4.0.506 fresh; subpackage unpinned. Declared-equality part
            TRUE. Corrected above.
COUNTER-2   CONFIRM (verifier ses_0285d7babffexcs6CvDLwbV5Fk) — re-derived from
            direct measurement: declared equality passes (both "remotion":
            "^4.0.503", byte-identical); SIX remotion installs at two versions
            (node_modules/remotion@4.0.505 + 5 nested
            @remotion/{effects,noise,rough-notation,shapes,transitions}/
            node_modules/remotion@4.0.506, matching lockfile entries at lines
            4100-4103 / 1758, 1810, 1902, 1932, 2121); live registry latest
            4.0.506 (registry.npmjs.org/remotion/latest); subpackage unpinned
            (no own lockfile, absent from root lockfile, root has no workspaces).
            Caveat: sandbox allowed `npm ls`? No — tree enumerated from package.json
            files + lockfile (same data npm ls reports).
STATUS      CORRECTED + RE-CONFIRMED — declared-equality PASS; alignment defect
            escalated (REQ D). CLOSED after P3.5 cycle.
```

### CLAIM-render-002  (register RND-02)
```
ASSERTION   The render subpackage and root declare identical React versions
            (^19.2.8) and resolve to a single hoisted react@19.2.8 instance, on a
            Remotion version that supports React 19.
SPEC REF    CHECK-REGISTER §3.7 RND-02 (parse; threshold: equal)
SOURCES     [1] first-party docs: remotion.dev/docs/react-19 — React 19 needs Remotion
            ≥4.0.0; "You need to upgrade both react and react-dom"
            [2] first-party registry: npmjs.com/package/react — react 19.x line is
            current; no React 18 pinned anywhere in the lockfile
RE-VERIFIED YES
CURRENT     subpackage: package.json:22-23 `react`/`react-dom` ^19.2.8; root:
            package.json:31-32 `react`/`react-dom` ^19.2.8. `npm ls` (root):
            `react@19.2.8`, `react-dom@19.2.8`, deduped single instance. Remotion
            installed 4.0.505 ≥ 4.0.0 (React-19 floor).
DELTA       None. Register's "FAIL — 18 vs 19" is stale.
PLAN        No product change. Verification only.
COUNTER     CONFIRM (verifier ses_0286b01bdffeW4Sw7uH9a1cz46) — own sources:
            remotion.dev/docs/react-19 (React 19 needs ≥4.0.0; types aligned in
            v4.0.236), GitHub v4.0.236 release ("officially support ... React 19"),
            Editor Starter deps (react ^19.2.8 + remotion 4.0.499 pairing). Lockfile
            shows a single hoisted react@19.2.8. Both checks pass.
STATUS      VERIFIED — PASS
```

### CLAIM-render-003  (register RND-03)
```
ASSERTION   @remotion/captions is installed at 4.0.505, ≥ the 4.0.216 minimum, and
            importable from the render subpackage.
SPEC REF    CHECK-REGISTER §3.7 RND-03 · MOTION-BLUEPRINT.md:73 ("native subtitle
            support arrived in Remotion v4.0.216")
SOURCES     [1] first-party docs: remotion.dev/docs/captions/api — "@remotion/captions
            Available from v4.0.216" (live)
            [2] first-party registry: package-lock.json:1587 resolves
            captions-4.0.505.tgz from registry.npmjs.org; `npm ls`: @remotion/captions
            @4.0.505
RE-VERIFIED YES — live captions API page still states "Available from v4.0.216"
CURRENT     subpackage: package.json:17 `^4.0.503`; root: package.json:20 `^4.0.503`;
            installed 4.0.505 (≥4.0.216). Actually consumed: compositions/beats.js:1
            `import { parseSrt } from "@remotion/captions"`; resolve + import probe
            from the subpackage both succeed.
DELTA       None.
PLAN        No product change. Verification only.
COUNTER     CONFIRM (verifier ses_0286af776ffeKRTr6Be4182Wjl) — own sources:
            remotion.dev/docs/captions/api ("Available from v4.0.216"), npm registry
            tarballs captions-4.0.216.tgz + captions-4.0.505.tgz (integrity hash
            matches the repo lockfile byte-for-byte). Declared ^4.0.503 in both
            manifests, installed 4.0.505, actually imported at beats.js:1. Both
            checks pass.
STATUS      VERIFIED — PASS
```

### CLAIM-render-004  (register RND-04)
```
ASSERTION   inputProps passed to both selectComposition() and renderMedia() reach the
            composition component and change the rendered output.
SPEC REF    CHECK-REGISTER §3.7 RND-04 (method: fixture render) · remotion.dev/docs/
            passing-props ("You should pass your inputProps to both selectComposition()
            and renderMedia()"; "Input props are passed to the component of your
            <Composition> directly")
SOURCES     [1] first-party docs: remotion.dev/docs/passing-props — exact SSR example
            passes inputProps to selectComposition AND renderMedia; input props reach
            the component as normal React props (live, fetched 2026-08-06)
            [2] first-party docs: remotion.dev/docs/parametrized-rendering — input
            props override default props; "The final props are passed to the React
            component"
RE-VERIFIED YES
CURRENT     render.js:240-245 selectComposition({serveUrl, id, browserExecutable,
            inputProps}); render.js:246-252 renderMedia({composition:
            {...composition, durationInFrames: frames}, ..., inputProps}); render.js:
            332-344 props object = {channelId, style, format, sections, mg,
            ttsAudioPath, thumbnailStyle, tone, font, channelName, palette};
            component consumption: MotionGraphicsShorts destructures {mg, sections,
            ttsAudioPath, font, palette, channelName} (motion-graphics.jsx:1210-1217) —
            a 6/10 key overlap with render.js's props, incl. palette→bg colour and
            font→fontFamily. Root.jsx registers compositions with no defaultProps that
            could mask the input props (Root.jsx:11-19).
DELTA       None in code — register FAIL is stale. Evidence gap: no live render yet in
            this session.
PLAN        Run a minimal fixture render (data/audit/1/fixture-inputprops.mjs): bundle
            the real Root.jsx, select MotionGraphicsShorts, renderStill frame 0 with
            two different palette inputProps, assert the two PNGs differ (palette is
            consumed from inputProps). If it renders, PASS with measured hashes; else
            record honestly as code-inspection only.
```

### CLAIM-render-005  (register RND-05)
```
ASSERTION   The generated-entry-file inputProps workaround (render-entry.jsx /
            verify-entry.jsx / writeRenderEntry()) no longer exists in the codebase.
SPEC REF    CHECK-REGISTER §3.7 RND-05 (grep writeRenderEntry / render-entry /
            verify-entry → 0 hits) · LAYOUT-SYSTEM Part 7 D6 (== register DEL-14),
            CLEARED 2026-08-06
SOURCES     [1] first-party docs: remotion.dev/docs/passing-props — inputProps on
            selectComposition/renderMedia is the supported mechanism that replaced
            the workaround (live)
            [2] repo measurement: Test-Path render-entry.jsx / verify-entry.jsx →
            both False; grep across *.js/*.jsx/*.ts/.github → 0 hits for the mechanism
            [3] in-repo spec: LAYOUT-SYSTEM.md:155-162 + 640 — D6 clearance record
            stating the entry files and writeRenderEntry() were deleted 2026-08-06
RE-VERIFIED YES
CURRENT     Files absent. Code grep: 0 hits. FULL-REPO grep `writeRenderEntry|render-
            entry|verify-entry` = 6 hits, all in two files OUTSIDE audit-render
            ownership: .gitignore:21-22 (2 stale lines naming the deleted files) and
            LAYOUT-SYSTEM.md:161, 640, 792-793 (4 references: line 640 is the D6
            clearance record that itself contains "writeRenderEntry()"; 792-793 is a
            stale "In-repo, audited" file inventory listing the deleted files).
DELTA       Workaround mechanism: GONE (substance passes the gate bullet "the
            generated-entry workaround deleted"). Strict register method (grep = 0
            hits repo-wide) still FAILs on 6 textual references in 2 shared files.
PLAN        No in-lane edit. File SHARED-FILE REQUESTS for .gitignore (delete lines
            21-22) and LAYOUT-SYSTEM.md (fix stale inventory 792-793). Flag the
            register/spec conflict: the D6 clearance record itself matches the grep
            pattern, so a strict repo-wide 0-hit gate is unsatisfiable without
            rewriting the audit trail or scoping the method to code paths.
COUNTER     CONFIRM (verifier ses_0286aca3dffeDODnBceE7FEczW) — own sources:
            remotion.dev/docs/passing-props + /docs/renderer/render-media (inputProps
            on both calls is the supported mechanism). Verified via git show/diff:
            writeRenderEntry removed, COMPONENT_FILES removed, renderVideo now bundles
            Root.jsx with inputProps, main() no longer generates an entry file; repo
            grep has zero hits for writeRenderEntry/render-entry/verify-entry in code;
            entry files absent on disk. Surviving refs are stale .gitignore patterns +
            doc inventory, not the mechanism. Read as worded, the claim is true; diff
            implements the removal exactly.
STATUS      VERIFIED — mechanism GONE (strict repo-wide grep still 6 hits in 2 shared
            files → REQ B + C + register amendment)
```

---

## PHASE 1.5 — DELTA SUMMARY BEFORE ANY EDIT

Measured state of the Stage 1 gate:

| Gate bullet | Measured | Verdict |
|---|---|---|
| subpackage on remotion@^4.0.503 + React 19 | declared ^4.0.503 / ^19.2.8 in BOTH manifests (equal); installed core remotion@4.0.505 + 5 nested remotion@4.0.506 copies; react@19.2.8 single hoisted; registry latest 4.0.506 | declared-equality PASS; installed-tree version alignment VIOLATED (REQ D) |
| captions/transitions/paths/shapes/layout-utils/effects installed | all importable from the subpackage (captions@4.0.505, transitions@4.0.506, paths@4.0.506, shapes@4.0.506, layout-utils@4.0.506, effects@4.0.506) via root hoisting | PASS |
| inputProps reaches the component | code path verified + fixture render passed (2 palettes → 2 distinct frames tinted to each palette) | PASS (real render) |
| generated-entry workaround deleted | mechanism deleted (writeRenderEntry + entry files gone, 0 code hits); 6 stale textual refs in .gitignore + LAYOUT-SYSTEM.md | substance PASS / strict-grep FAIL (REQ B + C) |

No edit to `render.js`, `remotion.config.js`, or `.github/**` is required for Stage 1.
All required edits are in shared files → SHARED-FILE REQUESTS at the bottom.

---

## PHASE 2 — CHANGE (RND-04 fixture artifact)

One edit made within audit-render ownership: `data/audit/1/fixture-inputprops.mjs`
(a measurement artifact, not a product change). It mirrors render.js's exact
inputProps flow (bundle → selectComposition with inputProps → render with inputProps)
against the real Root.jsx.

DIFF (new file) sha256 recorded after creation in the run log below.

---

## PHASE 2 — RUN LOG (RND-04 fixture render)

Artifact: `data/audit/1/fixture-inputprops.mjs` (new file, sha256
9AE40C8941DB75750416436ADF114D0CE5B993F55EA8E23056A1043016474A0F). Measurement
tool only — no product file touched. Mirrors render.js's exact flow against the
real Root.jsx: bundle → selectComposition({inputProps, timeoutInMilliseconds:
120000}) → renderStill({inputProps, timeoutInMilliseconds: 120000}), frame 0,
MotionGraphicsShorts, two runs differing ONLY in `palette`.

Result (run 1 failed: default 28 s delayRender timeout exceeded on the cold-start
font load — same reason render.js sets 120 s; fixed by passing
`timeoutInMilliseconds: 120000`, matching render.js:264):

```
bundled: ...remotion-webpack-bundle-RXRUTj
palette-a sha256: 8bbe36a8a81e3f2c297ed3e2408395cf5c07f2d87e76a494031d4f1faa4d3c36
palette-b sha256: 1a2400839e9a207ec95fead64c1aeb9a51d3bc1505f07cba736cbf1be37ad8e3
PASS: distinct inputProps produced distinct frames — inputProps reaches the component
```

Pixel analysis (decode-png.js on the two PNGs):

```
A corner(10,10): 35,35,54  (palette #1A1A2E bg = 26,26,46; +9 lift = Background grid)
B corner(10,10): 25,69,54  (palette #0F3D2E bg = 15,61,46; +9 lift = Background grid)
A full-frame mean: 35,35,54   B full-frame mean: 25,69,54
```

Both frames are flat full-frame (mg=null renders only the Background), so the
entire frame difference is the background colour derived from the inputProps
`palette` — and the RGB tints match each palette's [0] exactly. Controlled
experiment: identical props except `palette` → different rendered output,
tinted to the prop. **RND-04 verified by real render.**

### CLAIM-render-004 verdict
```
DIFF        fixture file (untracked) + render.js working-tree diff (below)
COUNTER     CONFIRM (verifier ses_0286adbc8ffelyvylpBmHrUtGn) — own sources:
            remotion.dev/docs/passing-props ("You should pass your inputProps to both
            selectComposition() and renderMedia()"), /docs/renderer/render-media
            ("Make sure to also pass the same inputProps to selectComposition()"),
            /docs/renderer/select-composition, /docs/get-input-props ("A component
            that was rendered as a composition will retrieve the input props as
            regular props"), GitHub select-composition.ts + issue #2688. Diff
            implements exactly the documented pattern; component consumes palette →
            bg (motion-graphics.jsx:1218); fixture artifacts internally consistent.
            Its optional `npm run verify` gate was blocked by sandbox execution
            policy (environmental, not a claim failure); my fixture render on the
            host already passed.
STATUS      VERIFIED-BY-RENDER + CONFIRM — PASS
```

Working-tree render.js diff (context — the inputProps/durationInFrames rewrite,
already in the tree, NOT authored by this session):
`git diff src/skills/remotion-render/render.js` shows: `writeRenderEntry()`
deleted; `renderVideo` now bundles Root.jsx, passes `inputProps` to
`selectComposition` and `renderMedia`, overrides `durationInFrames`, keeps
imageFormat/crf/pixelFormat/chromiumOptions/concurrency/timeout options.

---

## PHASE 3 — COUNTER-CHECKS

Five `verify-independent` tasks dispatched in parallel, each receiving ONLY its
claim card + diff/files/gates (no sources). Verdicts:

| Claim | Row | Verdict | Verifier |
|---|---|---|---|
| CLAIM-render-001 | RND-01 | REJECT (single-instance wording false) → P3.5 returned to Phase 1, corrected → re-dispatch CONFIRM → CLOSED | ses_0286b0c1effeDHG2Zy11g9i5IV → ses_0285d7babffexcs6CvDLwbV5Fk |
| CLAIM-render-002 | RND-02 | CONFIRM — PASS | ses_0286b01bdffeW4Sw7uH9a1cz46 |
| CLAIM-render-003 | RND-03 | CONFIRM — PASS | ses_0286af776ffeKRTr6Be4182Wjl |
| CLAIM-render-004 | RND-04 | CONFIRM — PASS (fixture already rendered green on host) | ses_0286adbc8ffelyvylpBmHrUtGn |
| CLAIM-render-005 | RND-05 | CONFIRM — PASS (mechanism gone; 6 textual refs in shared files → REQ B/C) | ses_0286aca3dffeDODnBceE7FEczW |

P3.5 resolution for RND-01: corrected card re-dispatched on 2026-08-06 and
CONFIRMED by ses_0285d7babffexcs6CvDLwbV5Fk (6 remotion installs, two versions;
registry latest 4.0.506; subpackage unpinned). Row closed. All five rows now
have a final verdict.

---

## SHARED-FILE REQUESTS (out of audit-render ownership)

- **REQ A — `src/skills/remotion-render/package.json`** (owner: orchestrator).
  Add devDependencies so the subpackage can resolve everything it imports
  WITHOUT relying on root hoisting: `@remotion/renderer`, `@remotion/paths`,
  `@remotion/shapes`, `@remotion/layout-utils`, `@remotion/effects`,
  `@remotion/transitions` (all `^4.0.503`). Currently missing; only
  bundler/captions/cli/player/rough-notation are declared. Stage 1 gate bullet
  "captions/transitions/paths/shapes/layout-utils/effects installed" passes only
  via root hoisting today — that is a latent breakage if the subpackage is ever
  installed standalone.
- **REQ B — `.gitignore` lines 21-22** (owner: orchestrator). Delete the two
  stale patterns `src/skills/remotion-render/render-entry.jsx` and
  `.../verify-entry.jsx` — the generated-entry workaround they guard (and its
  files) is gone (RND-05).
- **REQ C — `LAYOUT-SYSTEM.md:792-793`** (owner: orchestrator). The "In-repo,
  audited" inventory still lists the deleted entry files. Update to reflect the
  inputProps mechanism. Do NOT touch line 640 (the D6 clearance record is part
  of the audit trail; the grep-hit there is inherent — see amendment below).
- **REQ D — Remotion version alignment** (owner: orchestrator, decision
  required). Declared equality passes, but the installed tree is skewed:
  core remotion@4.0.505 + nested remotion@4.0.506 ×5
  (@remotion/{effects,noise,rough-notation,shapes,transitions}), registry
  `latest` = 4.0.506, and the subpackage has NO lockfile / is not a workspace
  member / is absent from the root lockfile, so nothing pins its resolution.
  npm's own guidance: "align the version of all remotion and @remotion/*
  packages to the same version." Options: (a) bump everything to ^4.0.506 (root
  deps incl. the nested-copy owners) and generate a lockfile for the
  subpackage; (b) pin everything to 4.0.505. Keep the gate's declared range as
  the floor in either case. Stage 1 is PASS either way (declared range holds);
  this is a robustness/escalation, not a blocker.

## SPEC AMENDMENTS (register/spec gaps found — proposed, not applied)

1. **RND-01 method** — parse-equality of package.json misses the installed
   tree. Amend the method to also measure `npm ls remotion` at repo root (or
   add an alignment check) so two-version installs are caught.
2. **RND-05 grep scope** — a strict repo-wide 0-hit grep is unsatisfiable: the
   D6 clearance record (LAYOUT-SYSTEM.md:640) itself contains
   "writeRenderEntry()". Amend the method to scope grep to code paths
   (render.js, Root.jsx, compositions/, *.jsx/*.js) and treat doc/audit hits as
   textual references to resolve (REQ B/C), not mechanism remnants.
3. **MANUAL §A6.2 (carried from Stage 0)** — the manual render step still
   describes the pre-bump/entry-file flow; it references files that no longer
   exist. Stage-0 owner already has this flagged; re-flag here so it is not
   lost: `CROSSCHECK-PROTOCOL.md` §A6.2 must be updated when the manual step is
   rewritten.

---

## STAGE 1 REPORT (audit-render lane)

- **Claims:** RND-02/03/04/05 VERIFIED — PASS (all 4 counter-checked CONFIRM).
- **RND-01:** declared-equality PASS; single-instance wording REJECTED and
  corrected; installed-tree version alignment VIOLATED → escalated REQ D.
- **Changes made:** one measurement artifact only —
  `data/audit/1/fixture-inputprops.mjs` (new, untracked). No edits to
  `render.js`, `remotion.config.js`, `.github/**` (all Stage-1 gate bullets
  pass without in-lane changes). Stage 14 (`remotion.config.js` incl.
  `setChromiumOpenGlRenderer("angle")`) and Stage 15 (`chunkVoiceover()`
  render.js:113) items intentionally untouched.
- **Deletions:** none in-lane (mechanism already deleted in the working tree;
  stale references → REQ B/C).
- **Open:** REQ A-D (shared files, orchestrator-owned); RND-01 corrected-card
  re-dispatch; MANUAL §A6.2 amendment.


