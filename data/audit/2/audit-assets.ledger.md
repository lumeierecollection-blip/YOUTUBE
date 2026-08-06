# STAGE 2 — AUDIT-ASSETS LEDGER (fonts, icons, licences)

**Lane:** `audit-assets` · **Stage:** 2 (Asset integrity) · **Date:** 2026-08-06
**Gate (CROSSCHECK-PROTOCOL Part 4):** every font in `channels.json` has a `.woff2`; `tnum` present or fallback flagged; 11 unused families removed; Lucide vendored with both licence notices.
**Ownership exercised:** `src/skills/remotion-render/public/**` · `THIRD_PARTY_LICENSES.md` · `data/audit/**` only. Every other path that must change is filed as a SHARED-FILE REQUEST at the bottom.

---

## 0 — STATE OF RECORD (measured 2026-08-06, before any edit)

- `config/channels.json`: 50 channels — 13 `motion-graphics`, 13 `minimal`, 24 `cinematic-documentary`. 13 distinct `font` values across all channels.
- 13 mg channels → 6 font families: Inter (Money Mind, Skill Stack), DM Sans (Legal Brief, Earth Signal, Build Smart, NutriDecode), Roboto Condensed (Border Lines), Fira Sans (Quantum Canvas, Machine Anatomy, Mind & Body Files, Factory Floor), JetBrains Mono (Fraud Files), Nunito (MedBrief).
- `public/fonts/`: 40 `.woff2`, 21 families (fonts-manifest.json). 11 of the 21 families (21 files) are used by no channel.
- MISSING from `public/fonts/`: Fira Sans (4 mg channels), Comic Neue (Brief History/minimal), Noto Serif (C-Drama Decoded/cinematic-documentary) → 6 channels, AST-01 FAIL.
- `public/icons/`: 95 svg (lucide-static@1.28.0). `public/b-roll/`: 15 ch-01 images. `public/sfx/`: 3 kenney files.
- Environment: Python 3.14.6 + fontTools 4.63.0 + brotli; Node v24.18.1; Google Fonts CSS2 reachable with Chrome UA.

### Instrumentation (all in `data/audit/2/`)
- `fonts-gsub.py` — per-woff2 cmap digit/punct coverage + GSUB/GPOS feature tags (binary read).
- `fonts-subsets.py` — block-level subset summary of the old vendored files (result: `gsub-dump.txt`).
- `probe-latin.mjs` — downloads the LATIN block (unicode-range covers U+0020–U+007E) per family/weight from CSS2 into `probe/` (25 files, 13 families).
- `ofl-1.1.txt` — canonical SIL OFL 1.1 text (4370 chars) as shipped by google/fonts `ofl/firasans/OFL.txt`.

---

## 1 — PHASE 1: CLAIM CARDS (all grounded before any edit)

## CLAIM-assets-001 — every vendored woff2 is the wrong subset
```
ASSERTION   All 40 .woff2 files in public/fonts/ contain zero U+0030-U+0039 digit
            glyphs (non-latin subsets), so every numeral in every composition
            renders via system-font fallback; the correct latin subset
            (unicode-range U+0000-00FF) exists for every family and is the LAST
            @font-face block per weight in the Google Fonts CSS2 response.
SPEC REF    DETAIL-REFERENCE A0.1/A0.2 (spec measured the same vendored files);
            MOTION-GRAPHICS-MANUAL E1.4 (fonts vendored from Google Fonts).
SOURCES     [1] first-party: fontTools 4.63.0 cmap read of all 40 files —
                digits=0 for every file (gsub-dump.txt; e.g. Inter-400 = 157 cps,
                0 digits).
            [2] first-party live: fonts.googleapis.com/css2?family=Inter:wght@400;700
                (fetched 2026-08-06) — 7 subset blocks per weight, cyrillic-ext
                FIRST, latin LAST; latin range begins U+0000-00FF (covers 0x20-0x7E).
            [3] first-party: fetch-fonts.js:52-57 — getWoff2Url returns the FIRST
                block matching `font-weight:` — i.e. cyrillic-ext, never latin.
RE-VERIFIED YES — reproduces live.
CURRENT     40/40 files have 0 digit codepoints; 0 latin coverage.
DELTA       40/40 files wrong subset → fallback numerals + wrong measureText
            metrics for every channel.
PLAN        Delete: all 40 files. Replace: latin-subset woff2 for all 21 families
            via data/audit/2/vendor-latin.mjs (per-family weight 400/700, one
            weight per CSS2 request, latin block by unicode-range).
```

## CLAIM-assets-002 — 11 vendored families are unused
```
ASSERTION   11 families (Archivo Black, Barlow, Barlow Condensed, Crimson Pro,
            IBM Plex Sans, Lora, Nunito Sans, Plus Jakarta Sans, Rubik,
            Source Sans 3, Source Serif 4 = 21 files) are referenced by zero of
            the 50 channels and zero times under src/ + .opencode/skills outside
            fonts-manifest.json / fonts-loader.js; deleting them is safe.
SPEC REF    DETAIL-REFERENCE A0.1 ("11 vendored families are used by no channel");
            CHECK-REGISTER AST-03 (threshold 0 unused; state FAIL — 11).
SOURCES     [1] first-party: config/channels.json `font` field — computed set of
                13 distinct families; none in the 11.
            [2] first-party: repo walk over src/, config/, .opencode/skills —
                the 11 appear ONLY in fonts-manifest.json + fonts-loader.js.
            [3] independent: DETAIL-REFERENCE A0.1 lists the identical 11.
RE-VERIFIED YES.
CURRENT     21 files (10 families x2 + Archivo Black 400-only) in public/fonts.
DELTA       21 files of dead weight; loader emits 21 @font-face rules nothing uses.
PLAN        Delete: the 21 files. SHARED-FILE REQUEST for loader/manifest regen.
```

## CLAIM-assets-003 — 3 families referenced but missing
```
ASSERTION   6 channels reference 3 families with no woff2: Fira Sans (Quantum
            Canvas, Machine Anatomy, Mind & Body Files, Factory Floor — mg),
            Comic Neue (Brief History — minimal), Noto Serif (C-Drama Decoded —
            cinematic-documentary); all three are served by Google Fonts CSS2
            with a latin block.
SPEC REF    DETAIL-REFERENCE A0.1; CHECK-REGISTER AST-01 (100%; FAIL — 6 channels).
SOURCES     [1] first-party: config/channels.json — the 6 channels' font values.
            [2] first-party: public/fonts/ + fonts-manifest.json — no files for
                the three families.
            [3] first-party live: CSS2 requests for the three families (200 OK,
                latin blocks found; probe-latin.mjs results: FiraSans-400/700,
                ComicNeue-400/700, NotoSerif-400/700).
RE-VERIFIED YES — CHANGED channel name only: A0.1 says Comic Neue -> "Story Mode",
            current config says Brief History.
CURRENT     6 channels resolve to Helvetica/sans fallback (visual.js
            resolveFontFamily).
DELTA       6 channels: wrong typeface + wrong metrics.
PLAN        Add: 6 files (FiraSans-400/700, ComicNeue-400/700, NotoSerif-400/700)
            latin subsets. SHARED-FILE REQUEST for loader/manifest regen.
```

## CLAIM-assets-004 — tnum status after correct re-vendoring
```
ASSERTION   GSUB measurement of the latin-subset files: Inter, Fira Sans and
            Roboto Condensed expose `tnum` (no fallback); DM Sans and Nunito do
            NOT expose `tnum` and must be flagged for the per-digit fixed-slot
            fallback (DETAIL-REFERENCE A1.3); JetBrains Mono is monospace —
            digits equal-width by construction (A0.2 agrees, no flag).
SPEC REF    DETAIL-REFERENCE A0.2 (claims only Inter carries tnum — WRONG for the
            correct subsets), A1.3; CHECK-REGISTER AST-02 (100% tnum OR flagged;
            state FAIL — 4 of 6 mg).
SOURCES     [1] binary: fontTools GSUB/GPOS read of the 25 latin probe files —
                tnum PRESENT: Inter, Fira Sans, Roboto Condensed, Space Grotesk,
                Bebas Neue, Cormorant Garamond, Noto Serif. tnum ABSENT:
                DM Sans, Nunito, Oswald, Playfair Display, Comic Neue,
                JetBrains Mono (monospace by construction).
            [2] independent: DETAIL-REFERENCE A0.2's own fontTools inspection —
                agrees DM Sans/Nunito lack tnum; its "Roboto Condensed no"
                was measured on the defective cyrillic subset (no digits, no
                tnum, no latin at all).
RE-VERIFIED CHANGED — A0.2's "only Inter carries tnum" is false for the latin
            subsets; A1.3's "four of six cannot use the feature" -> two of six.
CURRENT     vendored files contain no digits at all (see claim 001).
DELTA       5 mg channels need the fallback flag: Legal Brief, Earth Signal,
            Build Smart, NutriDecode (DM Sans), MedBrief (Nunito). The 4 channels
            A0.2 flagged via Roboto Condensed + missing Fira Sans need no flag.
PLAN        No file change. Measurements recorded here + SPEC AMENDMENT block.
            Flag = register note (AST-02) + Stage-11 implementation dependency
            (per-digit fixed slots, A1.3 fallback).
```

## CLAIM-assets-005 — font licences (OFL 1.1) and icon licences (ISC+MIT)
```
ASSERTION   All 13 families to be vendored are SIL OFL 1.1 per the OFL.txt
            shipped by google/fonts; THIRD_PARTY_LICENSES.md has no font notices
            and gains an OFL section (full OFL 1.1 text + per-family copyright
            lines). Lucide ISC (c) 2026 and Feather-derived MIT notices are
            already present and verbatim -> AST-09/AST-10 PASS.
SPEC REF    MOTION-GRAPHICS-MANUAL A4.1 / E1.4 (licence text in source);
            CHECK-REGISTER AST-09 / AST-10 (state FAIL — stale, both notices
            present and verbatim since Stage 1).
SOURCES     [1] first-party live: OFL.txt from
                raw.githubusercontent.com/google/fonts/main/{ofl,apache}/...
                fetched 2026-08-06 for all 13 families (all OFL 1.1; copyright
                lines recorded in claim 005 data block below).
            [2] first-party live: SIL OFL 1.1 canonical text (fetched, 4370
                chars, saved data/audit/2/ofl-1.1.txt).
            [3] first-party live: lucide.dev/license — ISC (c) 2026 + Feather
                MIT list; matches THIRD_PARTY_LICENSES.md verbatim.
RE-VERIFIED CHANGED — Roboto Condensed re-licensed: google/fonts moved it from
            apache/robotocondensed to ofl/robotocondensed (OFL 1.1, "Copyright
            2011 The Roboto Project Authors (github.com/googlefonts/roboto-classic)").
            No repo doc asserted Apache 2.0, so nothing to amend there.
CURRENT     THIRD_PARTY_LICENSES.md = 58 lines, Lucide + Feather sections only.
DELTA       13 font licences undocumented in the project source.
PLAN        Replace THIRD_PARTY_LICENSES.md (same content + appended OFL section).
```
### claim 005 data — OFL copyright lines (fetched live 2026-08-06)
| Family | Source path in google/fonts | Copyright line |
|---|---|---|
| Space Grotesk | ofl/spacegrotesk/OFL.txt | Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk) |
| Inter | ofl/inter/OFL.txt | Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter) |
| Playfair Display | ofl/playfairdisplay/OFL.txt | Copyright 2017 The Playfair Display Project Authors (https://github.com/clauseggers/Playfair-Display), with Reserved Font Name "Playfair Display" |
| DM Sans | ofl/dmsans/OFL.txt | Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts) |
| JetBrains Mono | ofl/jetbrainsmono/OFL.txt | Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono) |
| Oswald | ofl/oswald/OFL.txt | Copyright 2016 The Oswald Project Authors (https://github.com/googlefonts/OswaldFont) |
| Nunito | ofl/nunito/OFL.txt | Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito) |
| Cormorant Garamond | ofl/cormorantgaramond/OFL.txt | Copyright 2015 the Cormorant Project Authors (github.com/CatharsisFonts/Cormorant) |
| Roboto Condensed | ofl/robotocondensed/OFL.txt | Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic) |
| Bebas Neue | ofl/bebasneue/OFL.txt | Copyright © 2010 by Dharma Type. |
| Fira Sans | ofl/firasans/OFL.txt | Copyright (c) 2012-2015, The Mozilla Foundation and Telefonica S.A. |
| Comic Neue | ofl/comicneue/OFL.txt | Copyright 2014 The Comic Neue Project Authors (https://github.com/crozynski/comicneue) |
| Noto Serif | ofl/notoserif/OFL.txt | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic) |

## CLAIM-assets-006 — icon set complete, licence-clear, no brand logos
```
ASSERTION   95/95 icon names in the 13 mg channels' icon_map resolve to vendored
            lucide-static@1.28.0 SVGs (0 missing, 0 unused); the asset set
            (icons, b-roll, sfx) contains no brand logos.
SPEC REF    CHECK-REGISTER AST-06 (state FAIL — stale, 95/95 resolve),
            AST-11 (0; state UNK).
SOURCES     [1] first-party: data/audit/1/audit-assets-measure.mjs re-run this
                stage — 95/95 resolve, 0 missing, 0 unused.
            [2] first-party: node_modules/lucide-static/package.json — version
                1.28.0, license ISC; package LICENSE file.
            [3] independent: lucide.dev/license — ISC + Feather MIT list.
RE-VERIFIED YES.
CURRENT     95 svg in public/icons; all icon_map names resolve; all 95 names are
            generic lucide icons (no apple/twitter/youtube/google etc. brand
            marks); b-roll filenames are ch-01 cave-science photos; sfx are
            kenney close/click.
DELTA       none.
PLAN        No change.
```
**AST-05 (weights ≤2 per channel):** computed — every channel resolves to at most {400,700} (0 channels exceed 2); state UNK -> PASS. No change.

---

## 2 — PHASE 2 / PHASE 3: EXECUTION LOG (append as changes land)

_One claim, one change, one commit. Diff hash recorded before counter-check; verifier invoked with CLAIM + DIFF + FILES only._

## CLAIM-assets-001
```
PHASE 2     git rm 40 files -> vendor-latin.mjs downloaded latin subsets for
            21 families (40 files; Archivo Black 700 + Bebas Neue 700 skipped —
            families have no 700 weight; CSS2 400s on wght@400;700 combined).
MEASURE     fontTools run on new public/fonts/: all 40 files digits=True +
            full punct set (gsub output recorded in session).
DIFF        6f245ca  (40 Bin -> 40 Bin, public/fonts/*.woff2 only)
COUNTER     CONFIRM — verifier (own sources, no lane sources): live CSS2 for
            all 21 families + developers.google.com/fonts/docs/css2 + repo
            behavior. Noted old 400/700 blobs were byte-identical per family
            (fetcher reused one subset for both weights); new per-weight blobs
            differ; new Inter-400 size matches live latin static (23664).
            Caveat: its sandbox lacks python, glyph check rested on blob
            identity + commit evidence — recorded, accepted (my own fontTools
            measurement of the exact committed files: digits=True, 40/40).
STATUS      LANDED
```

## CLAIM-assets-002
```
ASSERTION   11 families (21 files) referenced by zero channels / zero code.
PHASE 2     Delete: 21 files (10 families x2 + ArchivoBlack-400).
MEASURE     grep family names in config/channels.json + src/ + .opencode/skills
            (walker) — 0 hits outside fonts-manifest.json / fonts-loader.js.
DIFF        772fead  (21 Bin deletions, public/fonts only)
COUNTER     REJECT — verifier (independent repo audit, no lane sources):
            premises true by the letter, but the SAFETY conclusion fails:
            fonts-loader.js (imported by wait-for-fonts.js, itself imported by
            all three style compositions) still lists the 11 deleted families
            (FONT_FAMILIES line 48, 21 @font-face rules) and issues 22
            guaranteed-failing document.fonts.load() calls per render until
            the loader/manifest regeneration lands. The diff deletes files
            while tracked, executing source still references them — the
            deletion is only safe GIVEN the regeneration, which the commit
            deferred. P3.3: true claim, incomplete diff = REJECT.
REVERT      git revert 772fead -> 0d47bea (21 files restored; tree clean).
RE-ENTRY    Phase 1 refined: ASSERTION now scopes safety to the regenerated
            loader/manifest state and makes the regeneration part of the same
            logical change, filed as SHARED-FILE REQUEST SFR-001 (files are
            outside lane ownership per CROSSCHECK-PROTOCOL 1.1.2 + lane edit
            allow-list: public/**, THIRD_PARTY_LICENSES.md, data/audit/**).
            Stage-2 gate + register AST-03 are measured on the POST-regeneration
            repo, which is the state the orchestrator produces when it applies
            SFR-001 between stages (protocol Part 4, orchestrator steps 4-5).
STATUS      RE-ATTEMPT 1 IN PROGRESS
```

## CLAIM-assets-002 (re-attempt 1)
```
ASSERTION   Deleting the 21 woff2 files of the 11 unused families (Archivo
            Black, Barlow, Barlow Condensed, Crimson Pro, IBM Plex Sans, Lora,
            Nunito Sans, Plus Jakarta Sans, Rubik, Source Sans 3, Source Serif
            4) is safe iff fonts-loader.js + fonts-manifest.json are regenerated
            to the 10-family/19-file set in the same logical change; the
            regeneration is filed as SHARED-FILE REQUEST SFR-001 because those
            two generated files sit outside this lane's ownership. After the
            orchestrator applies SFR-001, FONT_FACES/FONT_FAMILIES contain only
            existing files and wait-for-fonts.js issues zero failing loads.
SPEC REF    DETAIL-REFERENCE A0.1 note; CHECK-REGISTER AST-03 (0 unused).
SOURCES     [1] first-party: config/channels.json — 13 distinct font values;
                none in the 11 (computed).
            [2] first-party: repo grep (src/, .opencode/skills) — the 11 appear
                only in fonts-manifest.json + fonts-loader.js.
            [3] independent: DETAIL-REFERENCE A0.1 lists the identical 11.
            [4] first-party code path: wait-for-fonts.js:18-21 loads every
                FONT_FAMILIES entry via document.fonts.load (swallows errors,
                10 s cap) — the runtime invariant SFR-001 restores.
RE-VERIFIED YES.
CURRENT     21 files present; loader/manifest still list them (pre-regen state).
DELTA       (a) 21 files dead weight; (b) loader emits 21 @font-face rules for
            families nothing uses; (c) until SFR-001 lands, 22 failing loads.
PLAN        Delete: the 21 files (this lane). Replace: regenerated
            fonts-loader.js + fonts-manifest.json (10 families, 19 files) via
            SFR-001 — orchestrator-applied before the Stage-2 gate.
```
PHASE 2     re-executed: git rm 21 files -> commit 6fba3f7.
DIFF        6fba3f7  (21 Bin deletions, public/fonts only; retained 19 files
            untouched; Bebas Neue 400-only + 9 families x2)
COUNTER     CONFIRM — verifier (independent repo audit): zero channel refs
            for the 11 (font + thumbnail_spec.text_font), zero src/ hits
            outside the two generated files; diff exactly 21 deletions;
            remaining 19 files = the 10 retained families; post-SFR-001 state
            consistent — every @font-face resolves, wait-for-fonts.js issues
            20 loads all resolving (Bebas Neue 700 matches 400 by CSS
            font-matching, .catch + 10s cap as backstop); SFR-001 formally
            filed per protocol P2.4 + orchestrator step 4. Noted render.js:262
            stale comment mentions no family — not a code path.
STATUS      LANDED (conditional on SFR-001 — see SHARED-FILE REQUESTS)
```

## CLAIM-assets-003
```
ASSERTION   6 channels reference 3 families with no woff2: Fira Sans (Quantum
            Canvas, Machine Anatomy, Mind & Body Files, Factory Floor — mg),
            Comic Neue (Brief History — minimal), Noto Serif (C-Drama Decoded —
            cinematic-documentary); all three served by Google Fonts CSS2 with
            a latin block.
PHASE 2     Add: FiraSans-400/700, ComicNeue-400/700, NotoSerif-400/700
            (vendor-latin.mjs, latin blocks).
MEASURE     fontTools on the 6 new files — digits=True + punct + correct
            weights + correct family names. Blob sizes vs live latin statics:
            FiraSans-400 23872, ComicNeue-400 19572, NotoSerif-400 14400 —
            match Google Fonts CSS2 latin subset downloads.
DIFF        1e5aa6f  (6 Bin additions, public/fonts only)
COUNTER     CONFIRM — verifier (independent): per-family CSS2 latin URLs fetch
            live, family names + weights verified; zero diff outside the 6
            files; noted render.js:262 has a stale comment referencing no
            family — comment only, not a code path (recorded, no action).
STATUS      LANDED
```

## CLAIM-assets-004
```
PHASE 2     none — measurement only. fontTools GSUB/GPOS read of the 25 latin
            files in public/fonts (fonts-features.py -> tnum-features.txt).
MEASURE     tnum PRESENT (7 families, per tnum-features.txt): Inter, Fira
            Sans, Roboto Condensed, Space Grotesk, Bebas Neue, Cormorant
            Garamond, Noto Serif. tnum ABSENT (6 families): DM Sans, Nunito,
            Oswald, Playfair Display, Comic Neue, JetBrains Mono (monospace —
            digits equal-width by construction, A0.2 agrees, no flag).
            Of the 6 mg-relevant families: tnum present -> Inter (Money Mind,
            Skill Stack), Fira Sans (4 channels), Roboto Condensed (Border
            Lines); tnum absent -> DM Sans (Legal Brief, Earth Signal, Build
            Smart, NutriDecode), Nunito (MedBrief) -> A1.3 per-digit
            fixed-slot fallback flag required for these 5 channels.
DIFF        none — no tracked file change (tnum-features.txt is audit
            evidence in data/audit/2/, untracked).
COUNTER     CONFIRM — verifier (independent, own fontTools measurement):
            agrees DM Sans + Nunito lack tnum, Inter/Fira Sans/Roboto
            Condensed carry it. Caveat recorded: dm-fonts source defines tnum
            but the Google Fonts build (and so the vendored latin subset) does
            not ship it — re-check if the DM Sans Google build is ever
            refreshed. AST-02 register state will be satisfied once the
            Stage-11 flag implementation lands (see SPEC AMENDMENTS).
STATUS      LANDED (no diff)
```

## CLAIM-assets-005
```
PHASE 2     Attempt 1: compose-licenses.mjs (UTF-8-safe node writer) + full
            OFL 1.1 text + 13 per-family copyright rows -> commit b2fc7c6
            (THIRD_PARTY_LICENSES.md 58 -> 180 lines).
COUNTER     REJECT #1 — verifier: Bebas Neue row had "Copyright c 2010"
            (ASCII c) instead of verbatim "Copyright © 2010" (U+00A9) from
            ofl/bebasneue/OFL.txt — a character substitution. Everything else
            checked out.
REVERT      git revert b2fc7c6 -> 9402daa.
RE-ENTRY    Phase 1: fixed compose-licenses.mjs row to U+00A9 escape.
PHASE 2     Attempt 2 -> commit 2ecbaab.
COUNTER     REJECT #2 — verifier: Playfair Display row used typographic curly
            quotes (U+201C/U+201D) around "Playfair Display"; google/fonts
            ofl/playfairdisplay/OFL.txt uses ASCII straight double quotes
            (U+0022). P3.5: this was re-attempt 1 — reverted, not patched.
REVERT      git revert 2ecbaab -> 1889546.
RE-ENTRY    Phase 1: Playfair Display row switched to straight ASCII quotes.
PHASE 2     Attempt 3 (final re-attempt, P3.5 cap) -> commit 0daa4c9.
MEASURE     grep for U+201C/U+201D across THIRD_PARTY_LICENSES.md — 0 hits;
            diff = 1 file, 122 insertions, 0 deletions.
COUNTER     CONFIRM — verifier (independent, 13 live OFL.txt fetches from
            raw.githubusercontent.com/google/fonts/main/ofl/*/OFL.txt):
            all 13 rows byte-for-byte (Bebas U+00A9 ✓, Cormorant lowercase
            "the" + no https ✓, Playfair ASCII straight quotes ✓); embedded
            OFL 1.1 text character-identical to Fira Sans OFL.txt and
            canonical SIL OFL 1.1; Lucide ISC + Feather MIT sections
            byte-identical to parent commit; diff shape exactly 122/0.
STATUS      LANDED
```

## CLAIM-assets-006
```
PHASE 2     none — measurement only (audit-assets-measure.mjs re-run).
MEASURE     mg channels with icon_map: 13; required icon names (union): 95;
            vendored icons: 95; required-but-missing: none; vendored-but-
            unused: none; not-in-lucide-static: none; b-roll manifest
            15 entries missing on disk: none. No brand logos: all 95 names
            generic lucide glyphs (no apple/twitter/youtube/google marks);
            b-roll = ch-01 cave-science photos; sfx = kenney close/click.
DIFF        none.
COUNTER     CONFIRM — verifier (independent): compositions/icons-data.js
            ICON_INNER matches lucide naming; icon set licence-clear.
STATUS      LANDED (no diff)
```

---

## 3 — FINAL STATE OF RECORD (measured 2026-08-06, post-claims)

- `public/fonts/`: **25 `.woff2`, 13 families** — the 13 families referenced by channels, all latin subsets (digits + punct verified via fontTools, `tnum-features.txt`).
  Retained (10): Inter, DM Sans, Space Grotesk, Cormorant Garamond, Oswald, Bebas Neue (400 only — no 700 weight exists), Nunito, Roboto Condensed, Playfair Display, JetBrains Mono.
  Added (3): Fira Sans, Comic Neue, Noto Serif.
  Removed (11 families, 21 files): Archivo Black, Barlow, Barlow Condensed, Crimson Pro, IBM Plex Sans, Lora, Nunito Sans, Plus Jakarta Sans, Rubik, Source Sans 3, Source Serif 4.
- `public/icons/`: 95/95 resolve, 0 missing, 0 unused, licence-clear (lucide-static@1.28.0 ISC + Feather MIT).
- `THIRD_PARTY_LICENSES.md`: 180 lines — Lucide ISC + Feather MIT (unchanged, byte-identical) + new font section (13 OFL 1.1 copyright rows verbatim + full OFL 1.1 text verbatim).
- `fonts-loader.js` / `fonts-manifest.json`: **STILL PRE-REGENERATION** (21 families listed, incl. the 11 removed, excl. the 3 added) — this is the one remaining gap, owned by the orchestrator via SFR-001. Measure script's "MISSING: Fira Sans/Comic Neue/Noto Serif" lines are loader-gap output, not vendored-file gaps (files exist on disk).
- AST-01 (fonts resolve): PASS post-SFR-001 (13/13 families vendored, 25 files).
- AST-02 (tnum or flagged): 3 families carry tnum (Inter, Fira Sans, Roboto Condensed); 5 mg channels flagged for A1.3 fallback (Legal Brief, Earth Signal, Build Smart, NutriDecode, MedBrief); JetBrains Mono monospace n/a. Register state FAIL is stale from A0.2's wrong subset measurement (see SPEC AMENDMENTS).
- AST-03 (0 unused): PASS post-SFR-001 (files already removed; loader regen pending).
- AST-05 (≤2 weights/channel): PASS — 0 channels exceed 2 weights.
- AST-09/AST-10 (licence notices): PASS — ISC + MIT notices present and verbatim; register state FAIL was stale.
- AST-06 (icons): PASS — 95/95. AST-11 (brand logos): PASS — 0.

---

## 4 — SHARED-FILE REQUESTS (for orchestrator, applied between stages, before Stage-2 gate)

### SFR-001 — regenerate fonts-loader.js + fonts-manifest.json to the vendored set
- **Files:** `src/skills/remotion-render/fonts-loader.js`, `src/skills/remotion-render/fonts-manifest.json`
- **Why:** claims 002 + 003 (commits `6fba3f7`, `1e5aa6f`) deleted 21 files and added 6, but the loader/manifest are generated files outside this lane's edit allow-list. Current loader still lists 21 families (incl. 11 deleted, excl. 3 added) → 22 guaranteed-failing `document.fonts.load()` calls via `wait-for-fonts.js` per render until regenerated.
- **Required end state:** the generated set must list exactly the current vendored files — 13 families, 25 files: Inter-400/700, DMSans-400/700, SpaceGrotesk-400/700, CormorantGaramond-400/700, Oswald-400/700, BebasNeue-400 (only 400 — 700 does not exist in the family), Nunito-400/700, RobotoCondensed-400/700, PlayfairDisplay-400/700, JetBrainsMono-400/700, FiraSans-400/700, ComicNeue-400/700, NotoSerif-400/700. FONT_FAMILIES = the 13 family names; every `@font-face` must point at an existing file.
- **Source of truth:** `config/channels.json` `font` values (13 distinct) — the current `fetch-fonts.js` `collectFonts()` already returns exactly these 13; regeneration = run the fixed `fetch-fonts.js` (see SFR-002) or re-apply its emit step.
- **Verification after apply:** run `node data/audit/1/audit-assets-measure.mjs` — "fonts referenced by ANY channel but not vendored" must be empty; loader families total must be 13; no `.woff2` filename in the loader/manifest may be absent from `public/fonts/`.

### SFR-002 — fix fetch-fonts.js latin-block selection
- **Files:** `src/skills/remotion-render/fetch-fonts.js`
- **Why:** root cause of claim 001 — `getWoff2Url()` returns the FIRST `@font-face` block per weight (cyrillic-ext), never latin; latin is the LAST block per weight (unicode-range U+0000-00FF). Also the combined `wght@400;700` request means Bebas Neue / Archivo Black 700 requests 400 (family has no 700) and must be tolerated (skip + keep 400).
- **Required fix:** per weight request (one `wght@` value per CSS2 call), select the `@font-face` whose `unicode-range` covers U+0000-00FF (latin), download its woff2 URL. Skip weights where CSS2 returns 400. Filename convention must stay `Family-Weight.woff2` (no `-latin` suffix — matches current `public/fonts/` names so SFR-001's run over the existing dir keeps current files and only rewrites loader/manifest).
- **Note:** applying SFR-002 + re-running fetch-fonts.js BEFORE SFR-001 gives the same result as SFR-001 alone (files already correct; existing files are skipped; loader/manifest get rewritten from `collectFonts()`).

---

## 5 — SPEC AMENDMENTS (for the orchestrator, Stage-2 gate inputs)

### DETAIL-REFERENCE A0.1 — correct: fonts missing
A0.1 said 6 channels were missing fonts and (implicitly) listed Comic Neue → "Story Mode". Reality at measurement: Comic Neue is used by **Brief History** (minimal); the other missing-font channels are the 4 Fira Sans mg channels + C-Drama Decoded (Noto Serif). **Amend A0.1's channel table** to: Fira Sans ← Quantum Canvas / Machine Anatomy / Mind & Body Files / Factory Floor; Comic Neue ← Brief History; Noto Serif ← C-Drama Decoded. (AST-01 measured against channels.json, not the table, so no register impact.)

### DETAIL-REFERENCE A0.2 — superseded: tnum claims measured on wrong subsets
A0.2's fontTools inspection ran on the defective cyrillic-ext subsets (0 digits, 0 latin, no tnum) and concluded "only Inter carries tnum". **Supersede with:** on the correct latin subsets, tnum is present in Inter, Fira Sans, Roboto Condensed (plus Space Grotesk, Bebas Neue, Cormorant Garamond, Noto Serif — non-mg); absent in DM Sans, Nunito, Oswald, Playfair Display, Comic Neue, JetBrains Mono (monospace n/a). A0.2's "Roboto Condensed no tnum" and "Fira Sans missing" reasoning no longer applies.

### DETAIL-REFERENCE A1.3 — corrected: which mg channels need the fallback flag
A1.3 assumed "four of six" mg families can't use tnum. Correct list of mg channels needing the per-digit fixed-slot fallback flag (5): **Legal Brief, Earth Signal, Build Smart, NutriDecode** (DM Sans), **MedBrief** (Nunito). No flag: Money Mind, Skill Stack (Inter — tnum present), Border Lines (Roboto Condensed — tnum present), Quantum Canvas, Machine Anatomy, Mind & Body Files, Factory Floor (Fira Sans — tnum present), Fraud Files (JetBrains Mono — monospace). **Register note AST-02** must be set accordingly (5 flagged, not 4; the register currently carries A0.2's stale FAIL).

### Roboto Condensed re-license
google/fonts moved it `apache/robotocondensed` → `ofl/robotocondensed` (OFL 1.1, "Copyright 2011 The Roboto Project Authors"). No repo doc asserted Apache 2.0, so nothing to amend; THIRD_PARTY_LICENSES.md now documents OFL.

### No further amend
AST-05 (≤2 weights) PASS; AST-06 icons PASS; AST-09/10 licence-notice PASS; AST-11 no-brand-logos PASS — all measured, none were repo-doc-false, only register rows were stale (noted in claim cards).

---

## 6 — GATE SUMMARY (Stage 2, asset integrity)

| Register | Requirement | Result | Evidence |
|---|---|---|---|
| AST-01 | every channel's font has `.woff2` | **PASS** (25 files / 13 families on disk; 6 formerly-missing channels resolved) | claims 001+003, commits `6f245ca`, `1e5aa6f` |
| AST-02 | `tnum` present OR fallback flagged | **PASS** (3 families tnum; 5 channels flagged for A1.3) | claim 004, `tnum-features.txt` |
| AST-03 | 0 unused vendored families | **PASS** (21 files removed) | claim 002, commit `6fba3f7` |
| AST-05 | ≤2 weights per channel | **PASS** (0 exceed) | claim card |
| AST-06 | icons complete | **PASS** (95/95, 0 missing/unused) | claim 006 |
| AST-09/10 | Lucide ISC + Feather MIT notices | **PASS** (verbatim, unchanged) | claim 005 |
| AST-11 | no brand logos | **PASS** (0) | claim 006 |
| — | licence docs | **PASS** (13 OFL rows + full OFL 1.1 text, all verbatim) | claim 005, commit `0daa4c9` |

**Remaining before gate:** orchestrator applies SFR-002 (fetch-fonts.js latin fix) + SFR-001 (loader/manifest regen) — then `data/audit/1/audit-assets-measure.mjs` shows loader=13 families and zero MISSING lines, and the Stage-2 gate is green.

**Commit list (this lane):** `6f245ca` (001 re-vendor) → `6fba3f7` (002 removal) → `1e5aa6f` (003 add) → `0daa4c9` (005 licences). Reverts: `0d47bea`, `9402daa`, `1889546` (P3.5). Claim 004/006: measurement-only, no commits. P3.5 cap honored: claim 005 was re-attempted twice and CONFIRMED on the final re-attempt.
