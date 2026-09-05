# STAGE 2 — AUDIT-TYPE LEDGER (fonts loader/manifest, measurement call sites, tnum, captions)

**Lane:** `audit-type` · **Stage:** 2 (Asset integrity) · **Date:** 2026-08-07
**Gate (CROSSCHECK-PROTOCOL Part 4, Stage 2):** every font in `channels.json` has a `.woff2`; `tnum` present or fallback flagged; 11 unused families removed; Lucide vendored with both licence notices.
**Ownership exercised:** `captions/**` (does not exist yet — nothing to audit at Stage 2, see note) · `layout/measure.js` (does not exist yet — call sites are in `compositions/motion-graphics.jsx`) · `data/audit/**` only.
**Precondition state:** the orchestrator applied SFR-001 (`fonts-loader.js` + `fonts-manifest.json` regenerated to 13 families / 25 files) and SFR-002 (`fetch-fonts.js` latin-block selection) as **uncommitted working-tree changes** — verified here, not re-done.

---

## 0 — STATE OF RECORD (measured 2026-08-07)

- `src/skills/remotion-render/public/fonts/`: **exactly 25 entries, all `.woff2`, nothing else** (Group-Object over the dir: 25/25 `.woff2`).
- `fonts-manifest.json` (working tree): 13 families, 25 files — Bebas Neue is the only family with a single weight (400).
- `fonts-loader.js` (working tree): `FONT_FAMILIES` = 13 names; `FONT_FACES` = 25 `@font-face` rules.
- `fetch-fonts.js` (working tree): per-weight CSS2 request + latin `unicode-range` selection (SFR-002); `node --check` clean.
- `config/channels.json`: 13 `motion-graphics` channels (Money Mind id 1 flipped `minimal` → `motion-graphics`, working-tree diff). 6 distinct mg fonts: Inter, DM Sans, Roboto Condensed, Fira Sans, JetBrains Mono, Nunito.
- Instrumentation written this lane: `data/audit/2/verify-font-set.mjs` (exact-string 1:1 cross-check) + `data/audit/2/audit-type-measure.mjs` (pre-existing baseline, re-run).

---

## 1 — PHASE 1: CLAIM CARDS

## CLAIM-type-001 — loader, manifest and disk are internally consistent 1:1
```
ASSERTION   fonts-loader.js and fonts-manifest.json (SFR-001 state) are
            consistent with each other and with public/fonts/: FONT_FAMILIES
            (13) == manifest keys (13), the 25 @font-face rules in FONT_FACES
            point at exactly the 25 .woff2 files on disk (bijection, exact
            filenames), per-family weight alignment holds (Bebas Neue = 400
            only in all three), and zero loader refs are missing on disk.
SPEC REF    LAYOUT-SYSTEM §5.1 (font gate — measurement must not run against
            unloaded/missing fonts); MOTION-GRAPHICS-MANUAL E5.1/E5.3
            (local .woff2 only, loaded via fonts-loader.js);
            CHECK-REGISTER AST-01 / AST-03.
SOURCES     [1] repo-first-party: data/audit/2/verify-font-set.mjs (run
                2026-08-07) — manifest_families=13, font_families_list=13,
                face_rules=25, manifest_files=25, disk_files=25,
                families_match=true, files_bijection=true,
                all_face_src_exist=true, failures=[].
            [2] repo-first-party: data/audit/2/audit-type-measure.mjs
                (re-run 2026-08-07) — loader_refs_missing=[],
                loader_ref_total=25, loader_face_family_count=13,
                loader_family_list_count=13, families_only_in_faces=[],
                families_only_in_list=[], families_with_no_file_on_disk=[],
                missing_families_all_channels_scope=[],
                unused_families_all_channels_scope=[].
            [3] repo: audit-assets ledger SFR-001 required end state
                (13 families / 25 files, exact filename list) — the observed
                state matches it file-for-file.
RE-VERIFIED YES — SFR-001 delivered exactly its promised end state.
CURRENT     13 = 13 = 13 families; 25 = 25 = 25 files; 0 dangling refs.
DELTA       none.
PLAN        No change. SFR-001 verified, no re-work.
```

## CLAIM-type-002 — wait-for-fonts / fonts-loader import path resolves
```
ASSERTION   All three style compositions import "../wait-for-fonts.js"
            (one level up, exists), which imports { FONT_FACES, FONT_FAMILIES }
            from "./fonts-loader.js" (same dir, exists, exports both names);
            fonts-loader.js, wait-for-fonts.js and fetch-fonts.js all parse
            clean under node --check; @remotion/layout-utils (the package
            behind measureText / fitTextOnNLines at motion-graphics.jsx
            :18/:491/:503) is installed and satisfies the declared range.
SPEC REF    MOTION-GRAPHICS-MANUAL E5.3 (wait-for-fonts.js must resolve
            before the first frame); LAYOUT-SYSTEM §5.1 (font gate).
SOURCES     [1] repo: import graph — compositions/motion-graphics.jsx:20,
                minimal.jsx:12, cinematic-documentary.jsx:14 →
                ../wait-for-fonts.js:2 → ./fonts-loader.js (all files exist).
            [2] repo: node --check exit 0 on fonts-loader.js,
                wait-for-fonts.js, fetch-fonts.js (run 2026-08-07).
            [3] repo: node_modules/@remotion/layout-utils/package.json
                version 4.0.506 (root-hoisted) vs src/skills/remotion-render/
                package.json dependency "@remotion/layout-utils": "^4.0.503".
RE-VERIFIED YES.
CURRENT     Paths resolve; syntax parses; dependency present.
DELTA       none at Stage-2 scope. Render-time proof (fonts resolve before
            frame 0, metrics correct) is NOT produced here — a full Remotion
            render is deferred: Stage 5 (measurement gate) and Stage 16
            (full render, Tier 3) per CROSSCHECK-PROTOCOL Part 4.
PLAN        No change. Known benign behavior noted (unchanged since before
            SFR-001, also recorded in audit-assets ledger): wait-for-fonts.js
            issues a 700 load for Bebas Neue, which has only a 400 face —
            CSS font-matching resolves 700→400 and the .catch + 10 s cap
            backstop the load either way.
```

## CLAIM-type-003 — tnum: 5 mg channels flagged, flag not machine-readable
```
ASSERTION   On the vendored latin subsets, DM Sans and Nunito expose no tnum
            in their GSUB tables (per data/audit/2/tnum-features.txt), so the
            5 mg channels Legal Brief, Earth Signal, Build Smart, NutriDecode
            (DM Sans) and MedBrief (Nunito) require the DETAIL-REFERENCE A1.3
            per-digit fixed-slot fallback; the flag is recorded in the
            audit-assets ledger + spec amendments but is NOT machine-readable
            anywhere a renderer or check could consume, and CHECK-REGISTER
            AST-02 still reads "FAIL — 4 of 6 mg" (stale).
SPEC REF    DETAIL-REFERENCE A0.2 (tnum measured), A1.3 (fallback flag),
            A1.2 (tabular-nums on every numeric element);
            CHECK-REGISTER AST-02.
SOURCES     [1] binary-first-party: data/audit/2/tnum-features.txt —
                DMSans-400/700 gsub=[calt, ccmp, dnom, frac, liga, locl, numr]
                (no tnum), Nunito-400/700 identical shape (no tnum);
                Inter/FiraSans/RobotoCondensed carry tnum.
            [2] repo: config/channels.json font values — Legal Brief,
                Earth Signal, Build Smart, NutriDecode = DM Sans; MedBrief =
                Nunito (computed, matches audit-assets claim 004).
            [3] repo: CHECK-REGISTER.md:299 — AST-02 "FAIL — 4 of 6 mg".
            [4] repo: grep "tnum|tabular" in config/ + src/skills/
                remotion-render (outside data/audit/) — only
                fontVariantNumeric: "tabular-nums" at motion-graphics.jsx
                :595 (HERO_NUMBER counter) and :791 (PROGRESS value); no
                per-channel flag field anywhere.
RE-VERIFIED YES — audit-assets' measurement reproduced from the same binary
            evidence file; the machine-readability gap is my own finding.
CURRENT     5 channels need the fallback; tabular-nums at :595/:791 silently
            no-ops on their families (A0.2's "silently does nothing" failure
            mode); flag exists only as ledger prose + spec-amendment text;
            register row stale.
DELTA       (a) 5 channels' counting numerals jitter until A1.3 lands;
            (b) no machine-readable flag for a renderer/check to branch on;
            (c) CHECK-REGISTER AST-02 row wrong.
PLAN        No change in Stage 2. Stage-11 dependency (recorded): implement
            the per-digit fixed-slot fallback for the 5 channels; introduce a
            machine-readable flag (candidate: channels.json field or a
            computed constant in the counter/measure module — layout/measure.js
            when it exists); update CHECK-REGISTER AST-02. Register update
            filed as SHARED-FILE REQUEST SFR-type-001.
```

## CLAIM-type-004 — zero references to the 11 deleted families in the render tree
```
ASSERTION   None of Archivo Black, Barlow, Barlow Condensed, Crimson Pro,
            IBM Plex Sans, Lora, Nunito Sans, Plus Jakarta Sans, Rubik,
            Source Sans 3, Source Serif 4 appears anywhere in
            src/skills/remotion-render outside fonts-manifest.json and
            fonts-loader.js; the only measureText/fitText call sites
            (motion-graphics.jsx :18 import, :491 fitTextOnNLines, :503
            measureText) pass the fontFamily prop resolved from channels.json,
            never a family literal.
SPEC REF    DETAIL-REFERENCE A0.1 (11 unused families);
            CHECK-REGISTER AST-03 (0 unused).
SOURCES     [1] repo: grep of the 11 names across src/skills/remotion-render
                (*.js,*.jsx,*.ts,*.tsx,*.mjs,*.json) — 0 hits outside the two
                generated files (run 2026-08-07).
            [2] repo: compositions/visual.js:10-13 resolveFontFamily →
                `'${font}', 'Helvetica Neue', sans-serif` — the fallback is
                Helvetica Neue, not any deleted family.
            [3] repo: data/audit/2/audit-type-measure.mjs — mg used families
                = DM Sans, Fira Sans, Inter, JetBrains Mono, Nunito, Roboto
                Condensed; all have woff2 on disk.
RE-VERIFIED YES.
CURRENT     0 hits. measureText(:503) / fitTextOnNLines(:491) take fontFamily
            from the channel config via resolveFontFamily.
DELTA       none. Note (non-blocking, pre-existing): both call sites request
            fontWeight:800 while the vendored set tops out at 700 per family —
            CSS font-matching resolves 800→700; this matches MANUAL A3.1's
            "400 and 700/800" wording and is not a Stage-2 break.
PLAN        No change.
```

## CLAIM-type-005 — Money Mind `gauge` mapping: not a Stage-2 blocker, flagged
```
ASSERTION   Money Mind was flipped minimal → motion-graphics (channels.json:12,
            working-tree diff) and its new icon_map maps
            "interest|rate|apr|math|percent" → "gauge" (channels.json:103);
            DETAIL-REFERENCE C3 forbids gauge/radial as an encoding and
            CHECK-REGISTER ENC-12 (MAJOR, stage 8) forbids gauge; this is NOT
            a Stage-2 gate blocker (Stage 2 = fonts + licences) and is flagged
            for the encoding lane.
SPEC REF    DETAIL-REFERENCE C1 (line 444: single magnitude → HERO_NUMBER,
            "never a gauge, ring, or filled shape"), C3 (line 496: "Radial /
            gauge / progress ring | angle"); CHECK-REGISTER ENC-12;
            CROSSCHECK-PROTOCOL Part 4 Stage-2 gate definition.
SOURCES     [1] repo: config/channels.json:12 style + :103 icon_map term
                (computed; Money Mind is the 13th mg channel —
                audit-type-measure.mjs mg_channel_count=13, id 1 included).
            [2] repo: DETAIL-REFERENCE C3/C1 tables (verbatim quotes above).
            [3] repo: CHECK-REGISTER ENC-12 row.
            [4] repo: data/audit/0/GATE.md:56-57 — the Money Mind flip +
                percent→gauge mapping was already flagged at Stage 0.
RE-VERIFIED YES.
CURRENT     Money Mind is not the only one: 5 mg channels' icon_maps map a
            term to the gauge icon — Money Mind (percent→gauge,
            channels.json:103), Quantum Canvas (measure|observe|uncertain,
            :1315), Machine Anatomy (valve|pump|flow, :2969), Mind & Body
            Files (stress|anxiety|cortisol, :3821), Factory Floor
            (sensor|data|monitor, :4505). The gauge icon is vendored
            (icons-data.js:40) and resolves (95/95 icons). Money Mind's field
            set otherwise equals the other mg channels (superset — extra
            stay_private/tts_python are pipeline fields). Separately: no
            channel in channels.json has a `concepts` block, so DETAIL-
            REFERENCE C4's per-channel concept vocabulary is absent for all
            13 mg channels (encoding-lane note).
DELTA       gauge icon in 5 mg channels' icon vocabulary is in tension with
            C3's "never a gauge"; ENC-12 state UNK. Not a Stage-2 gate item.
PLAN        No change. Flag for audit-encoding at Stage 8 (ENC-12): decide
            whether the gauge *icon* (TERM_DEFINE/LIST_ITEM glyph) violates
            C3's magnitude-encoding prohibition, and re-map or justify for
            Money Mind (+ the 4 pre-existing channels).
```

---

## 2 — PHASE 2 / PHASE 3: EXECUTION LOG

_No code changes were made by this lane (nothing needed fixing — all five
verification items passed at Stage-2 scope). Changes authored: audit
instrumentation only (`verify-font-set.mjs` in data/audit/2/). Counter-checks
dispatched for the gate-bearing claims; results appended._

## CLAIM-type-001
```
PHASE 2     none (verification only). Evidence: verify-font-set.mjs output
            (13=13=13 families; 25=25=25 files; bijection; 0 failures).
DIFF        none — working-tree state produced by orchestrator's SFR-001/SFR-002
            (fonts-loader.js 49 lines changed, fonts-manifest.json 81,
            fetch-fonts.js 21 — git diff --stat).
COUNTER     CONFIRM — verifier (independent re-derivation, no lane sources):
            FONT_FAMILIES:33 == manifest keys 13, same order/spelling;
            lines 5-29 = 25 @font-face rules, each src a distinct file;
            public/fonts/ = exactly 25 .woff2 matching loader basenames
            char-for-char; manifest values = identical 25 filenames;
            Bebas Neue 400-only in all three (manifest 22-24, loader line 15,
            disk); zero loader refs missing. Corroborated git state: loader/
            manifest rewritten in working tree (old committed versions listed
            deleted families), public/fonts committed and unchanged.
            No part of the claim failed.
STATUS      LANDED (verification)
```

## CLAIM-type-003
```
PHASE 2     none (verification only). Evidence: tnum-features.txt binary read,
            channels.json computed, CHECK-REGISTER:299 row, grep for machine-
            readable flag.
DIFF        none.
COUNTER     CONFIRM — verifier (independent): tnum-features.txt rows 6-7
            (DMSans, no tnum), 16-17 (Nunito, no tnum) vs 8-11, 22-23 (Fira/
            Inter/Roboto Condensed with tnum); channels.json style count = 13,
            DM Sans x4 (Legal Brief:120, Earth Signal:1328, Build Smart:3074,
            NutriDecode:3842) + Nunito x1 (MedBrief:3626); grep tnum in
            config/ and src/ → 0 hits; the only tabular-nums occurrences are
            unconditional CSS at motion-graphics.jsx:595/:791 (no per-digit
            fixed-slot implementation anywhere — grep 0.62em|odometer|fixed-slot
            → 0 hits), so they do not constitute the A1.3 flag; CHECK-
            REGISTER:299 exactly as claimed. Caveat recorded: verifier could
            not re-run fontTools (bash allow-list) — binary GSUB rests on the
            two independent audit lanes' reads; nothing contradicts.
STATUS      LANDED (verification)
```

## CLAIM-type-004
```
PHASE 2     none (verification only). Evidence: repo grep (0 hits), visual.js
            resolveFontFamily, measure script used-families.
DIFF        none.
COUNTER     CONFIRM — verifier (independent, case-insensitive grep): all 11
            names have zero genuine occurrences in src/skills/remotion-render
            (only substring false positives "Exploration" and "complex"); they
            are absent even from the two generated files (which list only the
            13 retained families); measureText(:503)/fitTextOnNLines(:491) pass
            the fontFamily variable only, resolved via resolveFontFamily(font)
            (visual.js:10-13 → 'Helvetica Neue', sans-serif fallback — names no
            deleted family); minimal.jsx:43 "Space Grotesk" and
            cinematic-documentary.jsx:135/148 "Inter" are retained families.
            Verifier noted the claim's assertion is strictly stronger than the
            repo state (names absent even from the generated files) — not a
            failure.
STATUS      LANDED (verification)
```

### Counter-check sourcing notes (P3.6)
- type-001: verifier derived everything from file reads + git state — same conclusion as my script, different method (manual rule-count vs regex parse). Strong pass.
- type-003: verifier corroborated the binary GSUB read via two independent in-repo lanes (audit-assets + audit-type) + external DM Sans tabular-figures context; its own sandbox lacks fontTools, recorded as a caveat — the evidence is two independent lane reads of the same binaries, which is what P3.6 calls a strong signal.
- type-004: verifier's exhaustive case-insensitive grep is a strictly stronger check than my exact-case grep; both agree on zero real hits.

---

## 3 — FINAL STATE OF RECORD (measured 2026-08-07, post-verification)

- Loader/manifest/disk: internally consistent 1:1 — 13 families, 25 files, 25 `@font-face` rules, zero dangling refs, exact bijection (verify-font-set.mjs: failures=[]).
- Import path: all three style compositions → `../wait-for-fonts.js` → `./fonts-loader.js` resolve; all three loader-adjacent files pass `node --check`; `@remotion/layout-utils@4.0.506` installed (root-hoisted, satisfies `^4.0.503`).
- tnum: PASS for the gate — 3 mg families carry tnum (Inter, Fira Sans, Roboto Condensed); 5 mg channels flagged for the A1.3 fallback (Legal Brief, Earth Signal, Build Smart, NutriDecode — DM Sans; MedBrief — Nunito); JetBrains Mono monospace n/a. Flag is NOT machine-readable; CHECK-REGISTER AST-02 row stale (FAIL — 4 of 6 mg) — Stage-11 dependency + SFR-type-001.
- Deleted families: 0 references in `src/skills/remotion-render` outside the two generated files; measureText/fitText call sites are family-literal-free.
- `captions/**`: does not exist in the repo; nothing to audit until Stage 10 (captions gate).
- `layout/measure.js`: does not exist (layout/ = slots.js, lint.js, run-lint.js); current measureText call sites are in compositions/motion-graphics.jsx — Stage 5 is where the shared fontStyle/`validateFontIsLoaded` gate lands.
- Gauge: Money Mind + 4 pre-existing mg channels map a term to the gauge icon; C3 forbids gauge as an encoding; NOT a Stage-2 blocker; flagged for Stage 8 (ENC-12).

---

## 4 — SHARED-FILE REQUESTS (for orchestrator)

### SFR-type-001 — update CHECK-REGISTER AST-02 register state
- **Files:** `CHECK-REGISTER.md`
- **Why:** the register row at CHECK-REGISTER.md:299 reads `AST-02 ... FAIL — 4 of 6 mg`, computed from DETAIL-REFERENCE A0.2's measurement on the defective cyrillic-ext subsets. The corrected measurement (tnum-features.txt, verified by both Stage-2 lanes) is: 3 mg families carry tnum, 5 mg channels flagged for the A1.3 fallback — the Stage-2 gate requirement ("tnum present or fallback flagged") is met.
- **Required end state:** `AST-02 ... PASS` (3 families tnum; 5 channels flagged: Legal Brief, Earth Signal, Build Smart, NutriDecode, MedBrief) with evidence pointer to `data/audit/2/tnum-features.txt`.
- **Note:** the flag itself must additionally become machine-readable for Stage 11 (see claim-type-003) — that is an implementation item for Stage 11 (audit-type/audit-motion), not a Stage-2 blocker.

### No other requests
SFR-001/SFR-002 (orchestrator-applied) verified correct — no re-work requested.

---

## 5 — SPEC AMENDMENTS (for the orchestrator)

### DETAIL-REFERENCE A0.2 / A1.3 — corroborated by this lane
Concur with audit-assets' SPEC AMENDMENTS: A0.2's "only Inter carries tnum" is superseded (Inter, Fira Sans, Roboto Condensed carry tnum on the latin subsets); A1.3's "four of six" → the correct flag list is 5 mg channels (Legal Brief, Earth Signal, Build Smart, NutriDecode — DM Sans; MedBrief — Nunito). Evidence re-read by this lane directly from `tnum-features.txt`.

### DETAIL-REFERENCE C4 — concept vocabulary absent from channels.json (observation for audit-encoding)
C4 (lines 508-515) shows a per-channel `concepts` block as if it exists in `config/channels.json`. Grep of channels.json for `concepts`/`palette`/`video_template`: 0 hits — **no channel (all 50) carries a concepts block**. This is an encoding-lane/Stage-8 dependency (the C4 classifier cannot be constrained per channel until the field exists), flagged here for completeness; not a Stage-2 item.

### No further amendments
Claims type-001/002/004/005 required no spec changes.

---

## 6 — GATE SUMMARY (Stage 2 — this lane's portion)

| Check | Requirement | Result | Evidence |
|---|---|---|---|
| Loader↔manifest families | FONT_FAMILIES == manifest keys | **PASS** (13 = 13) | claim-type-001, verify-font-set.mjs |
| @font-face → disk | every FONT_FACES src exists | **PASS** (25/25) | claim-type-001 |
| Disk ↔ manifest 1:1 | 25 files, exact bijection | **PASS** (25 = 25, 0 extra, 0 missing) | claim-type-001 |
| Weight alignment | per-family weights agree across manifest/loader/disk | **PASS** (Bebas Neue 400-only everywhere) | claim-type-001 |
| Import path | compositions → wait-for-fonts → fonts-loader resolve | **PASS** (paths exist, node --check clean; full render deferred to Stage 5/16) | claim-type-002 |
| measureText deps | @remotion/layout-utils installed | **PASS** (4.0.506 ≥ ^4.0.503) | claim-type-002 |
| tnum or flagged | every mg numeral font tnum OR fallback flagged | **PASS** (3 tnum + 5 flagged; flag machine-readability = Stage-11 item) | claim-type-003, tnum-features.txt |
| Deleted families | 11 removed, 0 refs in render tree | **PASS** (0 hits outside the 2 generated files) | claim-type-004 |
| measureText call sites | no deleted-family literals | **PASS** (fontFamily prop only) | claim-type-004 |
| gauge mapping | (not a Stage-2 gate item) | **FLAGGED → Stage 8, ENC-12** (5 mg channels) | claim-type-005 |

**My portion of the Stage-2 gate: PASS.** The only outstanding items are (a) register row AST-02 (SFR-type-001, orchestrator), (b) Stage-11 machine-readable tnum flag + A1.3 implementation, (c) Stage-8 gauge/ENC-12 review.

---

## STATUS: COMPLETE
