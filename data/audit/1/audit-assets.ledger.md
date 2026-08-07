# AUDIT-ASSETS — Stage 1 Ledger (Dependency Unblock)

- Lane: `audit-assets` (icons, licences, images, font vendoring)
- Owns: `src/skills/remotion-render/public/**`, `THIRD_PARTY_LICENSES.md` (+ `data/audit/**`)
- Shared files (Root.jsx, render subpackage package.json, styles/motion-graphics.jsx): ORCHESTRATOR ONLY — none touched this stage
- Date: 2026-08-06
- Stage gate (asset side): confirm no remote asset fetch at render time (AST-13); measure font integrity; report icons/licence state. Stage 2 owns the full font/icon rebuild — NOT performed here.
- Measurement scripts: `data/audit/1/audit-assets-measure.mjs` (this lane's data dir)

---

# PHASE 1 — CLAIM CARDS

All three claims this stage are **measurements / state reports**. AST-13 found NO
blocker, so Phase 2 (delete-then-replace) never runs: there is nothing to delete
and nothing to replace. Phase 3 counter-checks are still run on all three claims
because they are gate inputs (a wrong negative on AST-13 would let rendering
proceed with a network dependency; a wrong font table would poison Stage 2).

---

## CLAIM-assets-001

ASSERTION   No module reachable from the render entry path fetches any asset over
            the network at render time. The only `https://` and `fetch()`
            occurrences in the package belong to (a) `fetch-fonts.js` — a
            standalone one-time vendoring tool that is never imported by the
            render path — and (b) provenance metadata in
            `b-roll-manifest-ch-01.json`. Every render-time asset is local:
            40 @font-face rules and all b-roll/SFX assets resolve via
            `staticFile()` to files under `public/` that exist on disk (0
            missing), and the voiceover is bundled locally by webpack as a
            static import (`audio.js` imports `./vo.mp3` from the package root,
            staged there by `render.js` `stageAudio`) — no remote URL appears in
            any `<Img>`/`<Audio>` src or fetch call anywhere in the render path.

            RE-ENTRY NOTE (attempt 1 REJECTED, P3.5): the original assertion
            over-broadly said "every render-time asset resolves via staticFile()
            ... all audio". The verifier correctly rejected that clause: the
            voiceover `vo.mp3` is NOT under `public/` and NOT referenced via
            `staticFile()`; it is a webpack static asset import from the package
            root. The no-network finding was unaffected (the import is local),
            so the gate decision stands; only the enumeration is corrected
            above.

SPEC REF    CROSSCHECK-PROTOCOL.md Part 4 Stage 1 (dependency unblock, asset
            side); Remotion asset rule (assets referenced with `staticFile()`
            must live under `public/`; `staticFile()` throws on remote URLs).

SOURCES     [1] first-party: https://www.remotion.dev/docs/staticfile —
                "Turns a file in your `public/` folder into an URL"; assets are
                loaded via `<Img>/<Audio>/<Video>`/Fetch/FontFace.
            [2] first-party (source of record): https://github.com/remotion-dev/
                remotion/blob/main/packages/core/src/static-file.ts — the
                implementation throws `TypeError("staticFile() does not support
                remote URLs...")` when the path starts with `http://`/`https://`,
                and also rejects relative/absolute/`public/`-prefixed paths.
            [3] first-party (source of record): https://github.com/remotion-dev/
                skills/blob/main/skills/remotion/rules/assets.md — "Place assets
                in the `public/` folder... You MUST use `staticFile()` to
                reference files from the `public/` folder".
            [4] first-party: https://www.remotion.dev/docs/fonts — local fonts go
                in `public/`, loaded with `FontFace`/`loadFont` + `staticFile()`.

RE-VERIFIED YES — live docs and source code still state the public-folder-only
            rule; `staticFile()` still throws on remote URLs (checked the
            current `static-file.ts` on GitHub).

CURRENT     Grep `https://` over the package: 16 hits, all in
            `b-roll-manifest-ch-01.json:13-114` (`source_url` metadata, 15
            Wikimedia Commons provenance URLs) and `fetch-fonts.js:44`
            (`https://fonts.googleapis.com/css2?...`). Grep `fetch(`: 2 hits,
            both in `fetch-fonts.js:48` and `:61`. `fetch-fonts.js` is imported
            by NO render-path module (grep shows it referenced only in its own
            header comment and in the AUTO-GENERATED header of `fonts-loader.js:1`).
            Render entry: `render.js:239` `bundle({entryPoint: Root.jsx})`;
            `Root.jsx:1-21` imports only the three style compositions +
            remotion. Compositions import `wait-for-fonts.js`
            (cinematic-documentary.jsx:14, motion-graphics.jsx:20, minimal.jsx:12)
            which injects `fonts-loader.js` FONT_FACES (40 @font-face rules,
            fonts-loader.js:5-44, every `src` a `staticFile("fonts/*.woff2")`).
            Asset refs: motion-graphics.jsx:286 `<Audio src={staticFile(file)}>`
            (SFX), :966 `<Img src={staticFile(scene.image)}>`; cinematic-documentary.jsx:214
            `<Img>`, :262 `src={staticFile(f)}`. `broll.js:48-63` resolves cues to
            paths under `public/b-roll/` (e.g. `:56`); 15/15 manifest files exist
            on disk (measured). 0 of the 40 loader-referenced woff2 files are
            missing (measured). The only `http` hits besides those are an XML
            namespace inside a data-URI SVG noise filter
            (cinematic-documentary.jsx:44) — not a fetch.
            Voiceover (verified by counter-checker): `audio.js` does
            `import voiceover from "./vo.mp3"` — a webpack static import of a
            local file at the package root (`vo.mp3`, staged by
            `render.js:201-217 stageAudio`), NOT via `staticFile()`, NOT under
            `public/`, and NOT remote. Local, network-free, and a supported
            Remotion import mechanism — it does not change the gate verdict.

DELTA       None. AST-13 is NOT a blocker: there is no remote asset fetch in the
            render path, and nothing violates Remotion's public-folder rule.

PLAN        No change this stage. Nothing to delete, nothing to replace.
            (Stage 2 may later touch fonts/icons, but the render path already
            complies with the asset rule.)

DIFF        (none — no repository change made for this claim)

COUNTER     <filled in Phase 3>

STATUS      MEASURED — gate input

---

## CLAIM-assets-002

ASSERTION   Cross-referencing `config/channels.json` against the 40 `.woff2`
            files in `src/skills/remotion-render/public/fonts/` and the 40
            @font-face rules in `fonts-loader.js`: exactly 4 of the 13
            motion-graphics channels reference **Fira Sans**, which has no
            `.woff2` and no @font-face (Quantum Canvas, Machine Anatomy,
            Mind & Body Files, Factory Floor); **Comic Neue** (Brief History)
            and **Noto Serif** (C-Drama Decoded) are referenced by non-mg
            channels and are also not vendored; 0 of the 40 loader-referenced
            files are missing on disk; 11 vendored families are used by no
            channel at all.

SPEC REF    DETAIL-REFERENCE.md A0.1 (measured-finding block; re-verified below)
            and D1 (Stage 2 gate: "every font in `channels.json` has a `.woff2`").

SOURCES     [1] first-party (repo, measured): `config/channels.json` font fields
                vs `public/fonts/*.woff2` listing vs `fonts-loader.js` @font-face
                rules — computed by `data/audit/1/audit-assets-measure.mjs`
                (A0.1 itself states it is "computed or measured from the repo,
                not asserted", DETAIL-REFERENCE.md:12).
            [2] first-party: https://www.remotion.dev/docs/fonts — custom fonts
                must be loaded into the document before render for
                `measureText()`-class APIs to measure real metrics; an
                unloaded font falls back to the generic family.

RE-VERIFIED A0.1 numbers still hold: Fira Sans missing for exactly the same 4
            mg channels; the 11 unused families match A0.1's list exactly.
            CHANGED (roster drift): A0.1 says "four of the twelve motion-graphics
            channels"; channels.json now has 13 mg channels. A0.1 names the
            Comic Neue channel "Story Mode" — it is now "Brief History"
            (channels.json:1610-1613). A0.1 leaves the Noto Serif channel
            unnamed — it is "C-Drama Decoded" (channels.json:2058-2061).
            See SPEC AMENDMENTS below.

CURRENT     Measured (data/audit/1/audit-assets-measure.mjs):
            - 13 motion-graphics channels total (ids 1,2,9,14,15,26,32,34,40,
              41,42,44,48).
            - MISSING fonts (referenced in channels.json, no @font-face, no
              .woff2 in public/fonts):
                Fira Sans    <- Quantum Canvas   channels.json:1222 (id 14)
                Fira Sans    <- Machine Anatomy  channels.json:2879 (id 32)
                Fira Sans    <- Mind & Body Files channels.json:3732 (id 41)
                Fira Sans    <- Factory Floor    channels.json:4411 (id 48)
                Comic Neue   <- Brief History    channels.json:1613 (id 18, minimal)
                Noto Serif   <- C-Drama Decoded  channels.json:2061 (id 23, cinematic-documentary)
            - vendored families in loader: 21; files on disk: 40;
              missing file refs: 0.
            - unused-by-any-channel families (11): Lora, Crimson Pro,
              Source Serif 4, Barlow, Nunito Sans, IBM Plex Sans,
              Barlow Condensed, Archivo Black, Source Sans 3,
              Plus Jakarta Sans, Rubik. (Exact match with A0.1's list.)
            - consequence: `resolveFontFamily()` (compositions/visual.js:10-13)
              falls back to `'Helvetica Neue', sans-serif` for the missing
              families, so those channels render in the wrong face AND
              `measureText`/`fitText` compute against wrong metrics
              (DETAIL-REFERENCE A0.1 consequences 1-2).

DELTA       4 of 13 mg channels (31%) have no font file for their configured
            family; 2 more channels outside mg reference non-vendored fonts;
            11 vendored families (52% of the 21) are dead weight.

PLAN        NO change this stage (Stage 2 owns this per the orchestrator):
            vendor Fira Sans (+ Comic Neue, Noto Serif), remove the 11 unused
            families, re-run the cross-reference, add a GSUB/`tnum` check.
            This claim only records the measured baseline.

DIFF        (none — no repository change made for this claim)

COUNTER     <filled in Phase 3>

STATUS      MEASURED — Stage 2 gate input

---

## CLAIM-assets-003

ASSERTION   The icon setup is installed and complete: `lucide-static@1.28.0`
            (ISC) is a root dependency (package.json:30; installed version and
            licence verified in node_modules), `public/icons/` holds 95 vendored
            SVGs that exactly match the 95-name union of the 13 motion-graphics
            channels' `icon_map` (0 missing, 0 unused), `vendor-icons.js`
            exists, and `THIRD_PARTY_LICENSES.md` exists with the Lucide ISC
            notice (verbatim match to the live lucide.dev/licence page) plus the
            Feather MIT notice naming exactly the six Feather-derived icons
            vendored here (clock, crosshair, lock, search, target,
            triangle-alert).

SPEC REF    MOTION-GRAPHICS-MANUAL.md A4.1 / E1.4 (licence text in the project
            source); CROSSCHECK-PROTOCOL.md Part 4 Stage 2 gate ("Lucide
            vendored with both licence notices").

SOURCES     [1] first-party: https://lucide.dev/license — ISC License,
                "Copyright (c) 2026 Lucide Icons and Contributors", with a
                "derived from the Feather project" list that includes
                alert-triangle, clock, crosshair, lock, search, target, and the
                Cole Bemis MIT text.
            [2] first-party (installed copy): node_modules/lucide-static/LICENSE
                — byte-identical ISC text + identical Feather list + MIT text.
            [3] third-party/first-party to Feather: https://github.com/
                feathericons/feather/blob/master/LICENSE — The MIT License (MIT),
                Copyright (c) 2013-2023 Cole Bemis (independent confirmation of
                the Feather MIT notice's provenance).

RE-VERIFIED YES — live lucide.dev/license and the installed package LICENSE
            agree; the six icons named in THIRD_PARTY_LICENSES.md all appear in
            the live Feather-derived list (triangle-alert is listed as Feather's
            `alert-triangle`, the pre-rename name; the vendored
            public/icons/triangle-alert.svg carries the classic triangle-alert
            geometry).

CURRENT     root package.json:30 `"lucide-static": "^1.28.0"`;
            node_modules/lucide-static/package.json: version 1.28.0, license
            "ISC"; `public/icons/` = 95 SVGs; union of the 13 mg channels'
            `icon_map` (default + terms) = 95 names; required-but-not-vendored:
            none; vendored-but-not-required: none; required-but-not-in-
            lucide-static: none (all measured). `vendor-icons.js` exists
            (65 lines; normalises per E1.3: strips width/height/class/
            stroke-width, keeps viewBox 0 0 24 24, line 50-62).
            `THIRD_PARTY_LICENSES.md` exists (58 lines): Lucide ISC
            (lines 7-28), Feather MIT (lines 30-57).

DELTA       None for state compliance — the Stage 2 gate preconditions
            (lucide-static present, vendored set present, both notices present)
            already hold. Only 95 of lucide-static's ~1,600 icons are vendored,
            which is correct per E1 (union of what channels use).

PLAN        NO change this stage (do NOT rebuild the icon set; that is Stage 2
            work). Report-only.

DIFF        (none — no repository change made for this claim)

COUNTER     <filled in Phase 3>

STATUS      MEASURED — Stage 2 gate input

---

# SPEC AMENDMENTS (flagged for the orchestrator / doc owner)

1. **DETAIL-REFERENCE.md A0.1** — roster drift, numbers intact:
   - "four of the **twelve** motion-graphics channels" → channels.json now has
     **13** motion-graphics channels (verified 2026-08-06).
   - Comic Neue's channel is **Brief History** (channels.json:1610), not
     "Story Mode" as A0.1 names it.
   - A0.1 leaves the Noto Serif channel unnamed; it is **C-Drama Decoded**
     (channels.json:2058).
   - Core numbers (Fira Sans × 4 mg channels; 11 unused families; the unused
     family list itself) verified exactly — no change needed there.
2. **THIRD_PARTY_LICENSES.md Feather MIT notice** — "Copyright (c)
   2013-present Cole Bemis" matches lucide.dev/license verbatim. The upstream
   feathericons/feather LICENSE now reads "2013-2023"; since the icons come from
   lucide-static, the lucide.dev attribution chain is the correct one to keep.
   Observation only — no change required.

# SHARED-FILE REQUESTS

None filed this stage. No change to `Root.jsx`, render subpackage `package.json`,
or `styles/motion-graphics.jsx` is required by this lane: `vendor-icons.js`
reads `lucide-static` from the ROOT `node_modules` (vendor-icons.js:37), so no
subpackage dependency is needed; the render path already complies with
Remotion's asset rule.

---

# PHASE 3 — COUNTER-CHECKS

All three claims dispatched to `verify-independent` (separate sessions, no
sources passed) on 2026-08-06.

## COUNTER — CLAIM-assets-001 (attempt 1)

COUNTER     REJECT — verifier confirmed the headline (no render-path module
            calls fetch()/XMLHttpRequest/network modules; only fetch-fonts.js
            — never imported — and manifest source_url metadata; 40/40
            @font-face refs exist on disk; b-roll and SFX all under public/)
            but REJECTED the supporting clause "every render-time asset
            resolves via staticFile() ... all audio": the voiceover `vo.mp3`
            is imported via webpack static import from the package root
            (`audio.js: import voiceover from "./vo.mp3"`), not under
            `public/` and not via `staticFile()`. Verifier's sources: Remotion
            docs staticFile/assets/absolute-paths pages; static-file.ts and
            bundle.ts sources on GitHub; devsvideo.com Remotion asset guide.
            Note: the rejection does NOT touch the gate decision — the
            voiceover import is local and network-free.
            ACTION (P3.5): returned to Phase 1, assertion corrected to the
            exact mechanism; re-dispatched as attempt 2 below.

## COUNTER — CLAIM-assets-001 (attempt 2)

COUNTER     CONFIRM — verifier re-checked the corrected claim from scratch:
            no fetch()/XMLHttpRequest/new Image/new Audio anywhere in the
            render path; `https://` only in fetch-fonts.js:44 and the 15
            manifest source_url fields; fetch-fonts.js never imported; 40/40
            font files, 15/15 b-roll files, 3/3 SFX files exist on disk;
            voiceover = webpack static import of ./vo.mp3 at package root
            (staged by render.js stageAudio); no remote assetPrefix/publicDir
            override in remotion.config.js. Sources: remotion.dev/docs/assets
            + staticfile (first-party); devsvideo.com Remotion asset guide
            (independent).
            Final: claim corrected, gate decision unchanged and confirmed —
            AST-13 is NOT a blocker.

## COUNTER — CLAIM-assets-002

COUNTER     CONFIRM — verifier re-measured independently: 13 mg channels (ids
            1,2,9,14,15,26,32,34,40,41,42,44,48); exactly 4 reference Fira
            Sans = the four named; 40 .woff2 files / 40 @font-face rules / 21
            families, Fira Sans absent from all three; Comic Neue (Brief
            History, minimal) and Noto Serif (C-Drama Decoded,
            cinematic-documentary) confirmed non-vendored; every loader src
            resolves (0 missing); unused-by-any-channel = exactly the 11
            families listed. Verifier checked `thumbnail_spec.text_font`
            fields too and found no additional families. Strong pass — two
            independent measurements agree.

## COUNTER — CLAIM-assets-003

COUNTER     CONFIRM — verifier independently: lucide-static@1.28.0 ISC in root
            package.json + node_modules (npm registry + unpkg as second
            source); union of the 13 icon_maps = 95 names, directory = 95
            SVGs, set-equal (0 missing, 0 unused); vendor-icons.js reads root
            node_modules/lucide-static/icons and writes public/icons;
            THIRD_PARTY_LICENSES.md ISC text word-for-word identical to live
            lucide.dev/license and to node_modules/lucide-static/LICENSE
            (only line wrapping differs); all six named Feather icons appear
            in the live page's Feather-derived list (triangle-alert =
            Feather's alert-triangle). Confirmed.

---

# PHASE 3 (attempt 2 dispatch) — CLAIM-assets-001

Dispatched to verify-independent with the corrected assertion only (no
sources). Verdict recorded below when it returns.

---

# STAGE 1 SUMMARY (audit-assets)

| Claim | Type | Counter-check | Status |
|---|---|---|---|
| CLAIM-assets-001 (AST-13 render-path network fetch) | measurement | REJECT (attempt 1, over-broad audio clause) → CONFIRM (attempt 2, corrected) | MEASURED — not a blocker, gate PASSES |
| CLAIM-assets-002 (font-integrity baseline) | measurement | CONFIRM | MEASURED — Stage 2 baseline recorded |
| CLAIM-assets-003 (icons + licence state) | measurement | CONFIRM | MEASURED — Stage 2 gate preconditions already hold |

Changes made: NONE (no Phase 2 changes; nothing to delete — AST-13 found no
remote fetch in the render path).
Deletions: NONE.
Files written (lane-owned): `data/audit/1/audit-assets.ledger.md`,
`data/audit/1/audit-assets-measure.mjs`.
Shared-file requests: NONE.
Spec amendments flagged: DETAIL-REFERENCE.md A0.1 roster drift (13 mg channels,
"Brief History" not "Story Mode", Noto Serif channel = "C-Drama Decoded").
Gate input for orchestrator: AST-13 BLOCKER — CLEARED; font table and icons
state recorded for the Stage 2 gate.
