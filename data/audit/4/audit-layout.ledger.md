# AUDIT-LAYOUT — STAGE 4 LEDGER

- **Lane:** `audit-layout` — "layout, slots, safe zones, the compiler, alignment"
- **Stage:** 4 (slot table + lint) per `CROSSCHECK-PROTOCOL.md` Part 4
- **Date:** 2026-08-07
- **Auditor model:** opencode/big-pickle
- **Ledger file:** `data/audit/4/audit-layout.ledger.md`
- **Deliverable to mg-orchestrator:** one final message (see §9)

---

## 0. Scope, ownership, method

### 0.1 Edit ownership (from `.opencode/agents/audit-layout.md`)

Editable by this lane and nothing else:

| Root | Contents |
|---|---|
| `src/skills/remotion-render/layout/**` | `slots.js`, `lint.js`, `run-lint.js` |
| `src/skills/remotion-render/spec/**` | `schema.js`, `toEnglish.js`, `run-spec.js` |
| `src/skills/remotion-render/layers/**` | does not exist yet (target tree, build-order step 5) |
| `data/audit/**` | this ledger |

Everything else (spec docs at repo root, `compositions/**`, `styles/**`, `CHECK-REGISTER.md`,
`beats/**`) is SHARED FILE territory → SHARED-FILE REQUESTS in §6.

### 0.2 Method

- CROSSCHECK-PROTOCOL.md Part 2, three phases, applied to every claim.
- Spec documents (`LAYOUT-SYSTEM.md`, `MOTION-GRAPHICS-MANUAL.md`, `MOTION-BLUEPRINT.md`,
  `CHECK-REGISTER.md`) are **inputs to verify, not scripture**.
- Verification environment: `npm` is blocked by the PowerShell execution policy
  (`npm.ps1` cannot be loaded), so every check ran as `node …` directly. The
  npm script names in `package.json` (`lint:layout`, `lint:spec`) are thin
  wrappers over exactly those node commands; results are equivalent.
- Every claim card that requires ≥2 independent sources (≥1 first-party) cites
  the live sources and the fetch date in §8.

---

## 1. PHASE 1 — CLAIMS AND GROUNDING (claim cards)

### CLAIM-LAY-001 — Shorts safe rect

- **ASSERTION:** `SAFE_SHORTS = { top: 288, bottom: 1248, left: 48, right: 888 }` is the YouTube
  Shorts safe area for a 1080 × 1920 frame.
- **SPEC REF:** `LAYOUT-SYSTEM.md` §2.1 / Part 3 (comment `slots.js:12-16`); `MOTION-GRAPHICS-MANUAL.md`
  A1 (`SAFE = { top: 288, right: 888, bottom: 1248, left: 48 }`); `MOTION-BLUEPRINT.md` §2 Rule 2.1.
- **SOURCES (≥2, ≥1 first-party):**
  1. Google first-party artifact: `https://services.google.com/fh/files/misc/youtubesafezoneoverlay_vertical_final.png`
     (fetched OK, 2026-08-06).
  2. `https://somake.ai/blog/youtube-shorts-aspect-ratio` (fetched 2026-08-06): top 288, bottom 672, left 48, right 192 for 9:16 1080×1920, citing Google's overlay.
  3. `https://aicarousels.com/free-tools/youtube-safe-zone-checker` (fetched 2026-08-06): top 288 / bottom 672 / left 48 / right 192.
- **RE-VERIFIED:** YES.
- **CURRENT (computed):** `1920 − 1248 = 672` (bottom margin) ✓ matches Google 672.
  `1080 − 888 = 192 = 4 × 48` (right margin = 4× left, §2.3/`Rule 2.3`) ✓.
  Usable field `(888−48) × (1248−288) = 840 × 960` ✓ per manual A1.2 / blueprint §2.
  Value in file: `slots.js:16`. Also duplicated (raw) at `compositions/beats.js:27` (see SFR-LAY-3).
- **DELTA:** none in the value. The Remotion generic floor (80 px sides / 100 px top-bottom at
  1080-wide) is looser and does **not** govern Shorts — blueprint §2 states this conflict
  explicitly and designates the Google numbers for Shorts (conservative choice recorded in the
  blueprint itself). Consistent.
- **PLAN:** CONFIRM — no change.

### CLAIM-LAY-002 — Longform safe rect + Remotion floors

- **ASSERTION:** `SAFE_LONGFORM = { top: 100, bottom: 980, left: 160, right: 1760 }` for 1920 × 1080,
  derived from Remotion's layout floor scaled to 1920 wide.
- **SPEC REF:** `LAYOUT-SYSTEM.md` §3.2 (`slots.js:18-22`); `MOTION-BLUEPRINT.md` §2 (paragraph on
  Remotion's rule governing longform).
- **SOURCES:**
  1. First-party: `https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-best-practices/remotion-create/video-layout.md`
     (fetched verbatim 2026-08-06): "For 1080px-wide videos, keep key text at least **80px from the
     sides and 100px from the top and bottom** … **Main headline: 84px … Important supporting text:
     44px** … Scale those values with the composition width."
  2. In-repo: `MOTION-BLUEPRINT.md` §2 and §3.1 (same rule), `MOTION-GRAPHICS-MANUAL.md` A3.2.
- **RE-VERIFIED:** YES.
- **CURRENT (computed):** sides: `80 × 1920/1080 = 142.2`; spec value 160 ≥ 142.2 (conservative
  round-up) ✓. top/bottom: floor is 100 px at 1080 height; longform height is 1080, so 100 applies
  unchanged ✓. `1920 − 160 = 1760` ✓; `1080 − 100 = 980` ✓. Value in file: `slots.js:22`.
- **DELTA:** none.
- **PLAN:** CONFIRM — no change.

### CLAIM-LAY-003 — Grid

- **ASSERTION:** `GRID = { base: 8, cols: 12, col: 56, gutter: 8, pad: 40 }`.
- **SPEC REF:** `LAYOUT-SYSTEM.md` §3.5 / §3.6 (`slots.js:9-10`); `MOTION-GRAPHICS-MANUAL.md` A1.1/A1.2.
- **SOURCES:** in-repo spec arithmetic is re-derivable and self-checking:
  1. `12 × 56 + 11 × 8 + 2 × 40 = 672 + 88 + 80 = 840` ✓ (manual A1.2 states the same sum).
  2. `840 = stage width = SAFE right − SAFE left` (888 − 48) — cross-checked with CLAIM-LAY-001.
  (External craft sources for an 8 px base grid: `LAYOUT-SYSTEM.md` Part 9 cites filmbaker.com /
  LinkedIn craft guidance on grid discipline — secondary.)
- **RE-VERIFIED:** YES.
- **CURRENT:** `slots.js:10`. Column edges via `columnX(i) = 48 + 40 + i·(56+8)`: columns span
  88 … 792, last right edge 848, right pad `888 − 848 = 40` ✓ (`slots.js:78-80`).
- **DELTA:** none.
- **PLAN:** CONFIRM — no change.

### CLAIM-LAY-004 — Shorts slot table

- **ASSERTION:** `SLOTS_SHORTS` as published in `slots.js:37-43` matches the documented zones and
  satisfies the stated arithmetic.
- **SPEC REF:** `LAYOUT-SYSTEM.md` Part 3 table (lines 313-320) + §3.1, §3.1.1, §3.4, §3.7;
  `MOTION-GRAPHICS-MANUAL.md` A1.3 (zone table) and B2 (caption geometry).
- **SOURCES:** in-repo (spec docs + running code):
  1. Manual A1.3 zones: Kicker 288–360, Stage 392–940, Headline 964–1140, Caption 1148–1248,
     Rail x 48 y 288–1248.
  2. LAYOUT-SYSTEM Part 3 table: kicker {48,288,840,72}, stage {48,392,840,548}, headline
     {48,964,840,176}, caption {88,1152,760,96}, rail {48,288,4,960}.
  3. Live renderer (`compositions/mg-style.js:25-29`, `compositions/motion-graphics.jsx` zones in
     LAYOUT-SYSTEM Part 0.2) uses the same zone bounds for kicker/stage/headline/rail.
- **RE-VERIFIED:** YES.
- **CURRENT (computed, every value):**
  - kicker: `48+840 = 888` = safe right ✓; bottom `288+72 = 360` ✓.
  - stage: `392 + 548 = 940` ✓ (= manual Stage bottom 940).
  - headline: `964 + 176 = 1140` ✓; content box `176 − 48 = 128` (§3.7) ✓.
  - caption: `1152 + 96 = 1248` = safe bottom ✓ (bottom-anchored); centre `88 + 760/2 = 468`
    = optical centre ✓; inset right `88 + 760 = 848 ≤ 888` ✓.
  - rail: `288 + 960 = 1248` = safe bottom ✓.
  - 2-line caption `2 × 64 × 1.12 ≈ 143` px, bottom-anchored → top `1248 − 143 = 1105`;
    headline lower 48 px band = `1140−48 … 1140 = 1092…1140`; 1105 inside band and **above**
    the content box bottom 1092 (13 px clearance) ✓ §3.7 works for Shorts.
  - every value is a multiple of 4 ✓ (incl. 548/4 = 137, 4/4 = 1).
- **DELTA (recorded, not changed):**
  - **D2 — caption zone top: 1152 (slots.js, corrected) vs 1148 (MANUAL A1.3 + B2, `mg-style.js:28`,
    `beats.js:55`).** LAYOUT-SYSTEM §3.1.1 (2026-08-06) states the first draft placed the caption at
    `{150, 1148, 780, 100}` and it was **corrected** to `{88, 1152, 760, 96}` because 1148 is
    off-grid (1148/8 = 143.5 → L3 displacement 4) and the original right edge 930 > 888 (L2).
    `run-lint.js:68-71,100-101` proves the old value fails L2. **The manual and the two
    compositions were never updated.** slots.js is on the corrected side. → SFR-LAY-1, SFR-LAY-2, SFR-LAY-3.
  - **D1 — §3.1 claim "every width and height is a multiple of 8" is false** for stage h=548
    (548/8 = 68.5) and rail w=4 (4/8 = 0.5) in BOTH tables. The first clause ("every value a
    multiple of 4") holds for all 20 values. The stage 392–940 geometry is confirmed by manual
    A1.3 and the live renderers; the rail is a 4 px stroke rule (manual A1.3; `TYP-18` register
    allows stroke widths of 2 or 4). **The spec sentences overstate; the data is the established
    geometry.** → SFR-LAY-6.
- **PLAN:** CONFIRM the table as-is (no change — changing stage h would desync `mg-style.js` /
  `motion-graphics.jsx`, the live renderers). Deltas go to shared files.

### CLAIM-LAY-005 — Longform slot table

- **ASSERTION:** `SLOTS_LONGFORM` as published in `slots.js:46-52` is faithful to the spec table.
- **SPEC REF:** `LAYOUT-SYSTEM.md` Part 3 table (lines 322-328) + §3.1 + §3.7.
- **SOURCES:** in-repo only (no external source exists for a 1920×1080 editorial slot table;
  Remotion floor governs the safe rect, CLAIM-LAY-002).
- **RE-VERIFIED:** YES — `slots.js:46-52` is a byte-for-byte transcription of LAYOUT-SYSTEM lines 322-328.
- **CURRENT (computed):**
  - kicker `160+1600 = 1760` = safe right ✓; bottom 172.
  - stage `196 + 560 = 756`; gap kicker→stage `196 − 172 = 24` ✓ (3×8).
  - headline `780 + 144 = 924`; gap stage→headline `780 − 756 = 24` ✓.
  - caption `884 + 96 = 980` = safe bottom ✓ (bottom-anchored); centre `456 + 1008/2 = 960`
    = stage centre ✓ (§3.1 arithmetic "centred on 960").
  - rail `100 + 824 = 924`.
- **DELTA (recorded, not changed):**
  - **D3 — §3.7 "Slots never overlap" vs the published longform table.** caption slot top 884 <
    headline slot bottom 924 → the **static slots overlap by 40 px** (headline content box =
    780 … 780+96 = 876; caption top 884 clears the content box by 8 px for a 1-line caption, but a
    2-line caption reaches `980 − 143 = 837`, overlapping the headline content box by 39 px —
    whereas in Shorts the 2-line top 1105 clears the content box by 13 px). The "slots never
    overlap" claim is therefore only true for Shorts; the longform table is internally inconsistent
    with §3.7's own exception.
  - **D4 — longform rail extent under-documented:** rail bottom 924 ≠ safe bottom 980, while the
    Shorts rail spans the full safe height (288–1248). No spec sentence documents why.
  - Both deltas are spec-level (the published table and slots.js agree with each other).
    → SFR-LAY-6.
- **PLAN:** CONFIRM the table (faithful to spec); deltas to shared files.

### CLAIM-LAY-006 — Optical centre

- **ASSERTION:** Shorts optical centre x = 468 (NOT 540); vertical centre y = 768.
- **SPEC REF:** `MOTION-GRAPHICS-MANUAL.md` A1 (`OPTICAL_CENTRE_X = 468`, `OPTICAL_CENTRE_Y = 768`);
  `LAYOUT-SYSTEM.md` §3.4; `MOTION-BLUEPRINT.md` Rule 2.3.
- **SOURCES:**
  1. Rule 2.3 cites the Google-derived geometry: right margin 192 = 4 × left 48 ("Do not centre
     horizontally by eye") — grounded in the same sources as CLAIM-LAY-001.
  2. Arithmetic: `48 + 840/2 = 468`; `(288 + 1248)/2 = 768`.
- **RE-VERIFIED:** YES.
- **CURRENT:** 468 / 768; caption centre `88 + 760/2 = 468` ✓ (slots.js:41); hero/term/relation
  centres use 468 in `motion-graphics.jsx:434,586,614,688,928`.
- **DELTA:** none in the value. Note: `compositions/beats.js` declares the constant twice with
  different spellings (`OPTICAL_CENTER_X` line 29, `OPTICAL_CENTRE_X` line 50) — dedupe/align in
  SFR-LAY-3.
- **PLAN:** CONFIRM — no change.

### CLAIM-LAY-007 — Anchors and geometry helpers

- **ASSERTION:** nine anchors (`ANCHORS`), `snapToGrid`, `slotBounds`, `anchorPoint`, `columnX`
  implement §3.3/§3.5/§3.6.
- **SPEC REF:** `LAYOUT-SYSTEM.md` §3.3 (9 anchors), §3.5 (round to nearest 8, assert ≤4),
  §3.6 (12-column subdivision).
- **SOURCES:** spec text + pure arithmetic (re-derivable):
  - 9 anchors enumerated in §3.3 and `slots.js:55-65` ✓ identical set.
  - `snapToGrid` rounds to nearest multiple of grid; max displacement for period 8 is 4 ✓ §3.5.
  - `columnX(i) = stage.x + pad + i·(col+gutter)` = `88 + 64i` ✓ §3.6.
- **RE-VERIFIED:** YES.
- **CURRENT:** `slots.js:55-65, 68-71, 78-80, 83-85, 91-115`.
- **DELTA:** none.
- **PLAN:** CONFIRM — no change.

### CLAIM-LAY-008 — lint.js implements Tier 1 L1–L3

- **ASSERTION:** `lintL1` (rect inside slot), `lintL2` (slot inside safe rect), `lintL3`
  (8 px grid, rounding recorded) implement LAYOUT-SYSTEM Part 6 Tier 1 checks L1–L3.
- **SPEC REF:** `LAYOUT-SYSTEM.md` Part 6 (L1/L2/L3 rows) + §3.5; `slots.js:5-6` header;
  `CHECK-REGISTER.md` LAY-01/02/04/05.
- **SOURCES:** running code + fixtures (Tier 1 evidence, register rule E1: computed value, not
  code reading; E3: failing fixtures exist).
- **RE-VERIFIED:** YES.
- **CURRENT:** `node layout/run-lint.js` → **12 passed, 0 failed** (see §8.1 for full output).
  Failing fixtures prove the fail paths: L1 crossing rect (b08), unknown slot (b09), L2
  first-draft caption `{150,1148,780,100}` (right 930 > 888), L3 off-grid x=150 recorded
  (displacement 2) and NaN rejected. Longform table passes L2 with `SAFE_LONGFORM` ✓.
  Register LAY-02 (slots inside safe) = **PASS** by computation (was FAIL — stale, pre-slots.js);
  LAY-04/LAY-05 (grid multiples / rounding ≤4) = **PASS** for resolved rects, with the table
  exceptions D1 documented; LAY-01 (rect in slot) is N/B in the register but the L1 engine is
  implemented and fixture-proven.
- **DELTA:** none required. L3's fail branch is dead for finite numbers by construction
  (comment `lint.js:64-72` explains: period 8 ⇒ nearest multiple always within 4) — that is the
  intended, honest semantics of §3.5.
- **PLAN:** CONFIRM — no change.

### CLAIM-LAY-009 — spec/ files (schema + English layer)

- **ASSERTION:** `spec/schema.js` validates Shot Specs, forbids raw pixels in layers, and
  `toEnglish.js` renders the review artifact; the suite passes.
- **SPEC REF:** `LAYOUT-SYSTEM.md` Part 2 (spec shape, 2.1.1 "a layer may never carry raw x/y",
  2.2 English layer); §8.4 step 2 ("15 checks").
- **SOURCES:** running code + fixtures.
- **RE-VERIFIED:** YES.
- **CURRENT:** `node spec/run-spec.js` → **15 passed, 0 failed** (see §8.2 for full output),
  matching §8.4 step 2's "15 checks" claim exactly. `schema.js` slot whitelist =
  kicker/stage/headline/caption/rail; atFrame grammar `integer | anchor±n | end−n` enforced
  (fixture rejects `later`); layers carry `slot` + `align`, never x/y ✓ §2.1.1.
- **DELTA:** none.
- **PLAN:** CONFIRM — no change.

### CLAIM-LAY-010 — measureText / fitText / fillTextBox semantics (R3, §5.1–5.2)

- **ASSERTION:** measurement functions are browser-only, cached, font-gated, and return
  composition-px results; `fitText` must be capped; `fillTextBox` reports overflow per word.
- **SPEC REF:** `LAYOUT-SYSTEM.md` §4 R3, §5.1, §5.2; `MOTION-GRAPHICS-MANUAL.md` A3.4; `DETAIL-REFERENCE.md` A0.1.
- **SOURCES (≥2, ≥1 first-party):**
  1. `https://www.remotion.dev/docs/layout-utils/measure-text` (searched 2026-08-07): returns
     `{ height, width }`; "This function has a cache"; browser-only.
  2. Source: `https://github.com/remotion-dev/remotion/blob/main/packages/layout-utils/src/layouts/measure-text.ts`
     (searched 2026-08-07): `wordCache = new Map()`, throws `'measureText() can only be called in
     a browser.'`, fallback-font detection throws with `validateFontIsLoaded: true`.
  3. First-party skills rule: `https://github.com/remotion-dev/skills/blob/main/skills/remotion/rules/measuring-text.md`
     (searched 2026-08-07): `fitText({withinWidth})` → cap the `fontSize`; `fillTextBox({maxBoxWidth,
     maxLines})` → `box.add(word)` returns `exceedsBox`; "Load fonts first", "Match font properties",
     "Avoid padding and border" (use `outline`).
- **RE-VERIFIED:** YES.
- **CURRENT:** installed `@remotion/layout-utils@4.0.506` (see §8.3). `motion-graphics.jsx` imports
  `measureText`/`fitTextOnNLines` from `@remotion/layout-utils`; DETAIL-REFERENCE A0.1 (missing
  vendored fonts invalidate measurements) is consistent with the source's font-gating behaviour.
- **DELTA:** none in the documented semantics.
- **PLAN:** CONFIRM — no change.

### CLAIM-LAY-011 — useCurrentScale division (§5.5 DOM probe)

- **ASSERTION:** Remotion applies a `scale()` transform to the container; `getBoundingClientRect()`
  values must be divided by `useCurrentScale()` to recover composition px.
- **SPEC REF:** `LAYOUT-SYSTEM.md` §5.5; `MOTION-BLUEPRINT.md` §10 static gate 6.
- **SOURCES (≥2, ≥1 first-party):**
  1. `https://www.remotion.dev/docs/use-current-scale` (searched 2026-08-07): hook returns the
     canvas scale factor (Studio zoom; Player fit scale; 1 at render); `<AvailableFrom v="4.0.125" />`.
  2. `https://www.remotion.dev/docs/measuring` (searched 2026-08-07): the render div has a `scale()`
     transform that affects `getBoundingClientRect()`; "From v4.0.111 on, you can use the
     `useCurrentScale()` hook to correct the dimensions".
  3. First-party skills rule: `https://github.com/remotion-dev/skills/blob/main/skills/remotion/rules/measuring-dom-nodes.md`
     (searched 2026-08-07): divide `rect.width / scale`, `rect.height / scale`, include `scale` in
     the effect deps.
- **RE-VERIFIED:** YES.
- **CURRENT:** installed `remotion@4.0.505` ≥ both doc'd minimums (111 and 125) — the hook is
  available. §5.5's `{ w: rect.width / scale, h: rect.height / scale }` matches the first-party rule.
- **DELTA:** none in behaviour. **Minor doc conflict noted:** Remotion's own two pages disagree on
  the first-available version (4.0.111 vs 4.0.125); irrelevant at 4.0.505, noted for the register owner.
- **PLAN:** CONFIRM — no change.

### 1.1 Phase 1 summary

| Claim | Verdict | Change made |
|---|---|---|
| 001 SAFE_SHORTS | CONFIRM | none |
| 002 SAFE_LONGFORM | CONFIRM | none |
| 003 GRID | CONFIRM | none |
| 004 SLOTS_SHORTS | CONFIRM (D1, D2 recorded) | none |
| 005 SLOTS_LONGFORM | CONFIRM (D3, D4 recorded) | none |
| 006 Optical centre | CONFIRM | none |
| 007 Helpers | CONFIRM | none |
| 008 lint L1–L3 | CONFIRM | none |
| 009 spec/ files | CONFIRM | none |
| 010 measure/fit/fill | CONFIRM | none |
| 011 useCurrentScale | CONFIRM | none |

**Zero changes.** Every value in `layout/slots.js`, `layout/lint.js`, `layout/run-lint.js` and
`spec/*` was grounded and found faithful to the corrected spec + live first-party sources. The
discovered bugs (D1–D5) all live in shared files → §6.

---

## 2. PHASE 2 — CHANGES

None. P2 applies delete-then-replace to claims that failed verification; all claims verified.
No diff was produced; P2.5 (diff hash) is N/A.

## 3. PHASE 3 — COUNTER-CHECKS

None. P3 counter-checks are triggered by changes (P2.5 → P3). With zero changes there is nothing
to counter-check. If the orchestrator requires independent confirmation of the *confirmations*, it
can dispatch `verify-independent` with claim 004/005 + this ledger; the arithmetic in §1 is
self-contained for that purpose.

---

## 4. GATE LEG 3 — "NOTHING POSITIONS BY RAW PIXEL" (evidence)

Gate claim (from the stage briefing): *grep `styles/`, `beats/`, `compositions/`, `layers/` for a
bare integer positioning and it should return nothing but frame counts* (LAYOUT-SYSTEM §8.3;
register LAY-10).

### 4.1 Verdict: **FAIL repo-wide today — but confined to `compositions/**` (not owned by this lane)**

| Location | Result |
|---|---|
| `styles/` (`tokens.js` only) | **CLEAN** — 0 raw-geometry hits (grep of `top:|left:|right:|bottom:|width:|height:|padding:`) |
| `beats/` | does not exist (target-tree dir, build-order steps 6-7). `compositions/beats.js` exists instead and **duplicates raw constants** (below) |
| `layers/` | does not exist (target-tree dir, build-order step 5) |
| `spec/` + `layout/` | **CLEAN** — the only positions in the system; layers carry `slot` names, never pixels (schema.js, §2.1.1); lint enforces containment |
| `compositions/**` | **FAIL — extensive raw pixels** (inventory below) |

### 4.2 Raw-pixel inventory in `compositions/**`

`compositions/motion-graphics.jsx`:
- `:198` rail rect `{ position:"absolute", left:48, top:288, width:4, height:1248-288 }` — raw dupe of `SAFE_SHORTS`/rail slot
- `:214` rail fill `height: progress * (1248 - 288)` — raw arithmetic dupe
- `:232-233` kicker content `top:312, left:80` — hard-coded offsets inside kicker slot
- `:242-243` kicker rule `width:40, height:6`
- `:433` caption `bottom: 1920 - CAPTION.zoneBottom` — re-derives from a local constant instead of the slot (LAYOUT-SYSTEM Part 0.12 documents this as the known "caption slot is hardcoded, not declared" defect)
- `:434` caption `left:468`; `:511` headline `top:1008, left:468, maxWidth:780`
- `:519-520,564-565,586,614,626,643-646,664-667,774,782-784,800-802,850,858,887-890,904-907,928,954-957,975-976,1050-1053,1068-1069` — panels, nodes, labels, bars, chips positioned by raw numbers (e.g. `left:248-44, top:666-44`; CONTRAST panels `48/520/412/340` + `480/520/408/340`; stage rect `left:48, top:392, width:840, height:940-392`)

`compositions/mg-style.js:25-29` — `ZONES` raw-pixel duplicates of the slot table, including the **stale caption top 1148** (D2).

`compositions/beats.js` — `:27` `SAFE = { top:288, bottom:1248, left:48, right:888 }` (raw dupe of `SAFE_SHORTS`), `:29` `OPTICAL_CENTER_X = 468`, `:50-51` `OPTICAL_CENTRE_X/Y`, `:55-56` `zoneTop: 1148` (**stale**, D2), `zoneBottom: 1248`.

`compositions/cinematic-documentary.jsx` — `:340-342` `top:48, left:0, right:0`; `:365` `padding:80`; `:394-396` `bottom:0, left:0, height:3`; `:446` textOverlay `top:28` — **260 px above the 288 safe line** (documented OPEN defect, LAYOUT-SYSTEM Part 0.2); `:470` `padding:40` (crosses the 48 px left safe line).

`compositions/minimal.jsx` — `:45` `fontSize: 88/64/40`; `:92` `padding:40`; `:142-151` frame sizes — no safe-rect awareness at all (documented OPEN defect, Part 0.2).

### 4.3 Why this is not a Stage-4 blocker for the lane

The §8.3/LAY-10 contract applies to the **target tree** (`styles/`, `beats/`, `primitives/`,
`layers/`) after the restructure (build-order steps 5-11). The current tree still renders from
`compositions/**`, which predates the slot model. `layout/` + `spec/` (this lane's files) are
clean and are the single source of positions. The compositions' raw pixels are a known, documented
OPEN state owned by later stages — tracked via SFR-LAY-2/3/4/5.

---

## 5. REGISTER EVIDENCE (for the register owner; CHECK-REGISTER.md is not editable here)

Computed by this lane on 2026-08-07 (Tier 1 evidence — computed values, not code reading; E1):

| Register | Check | Prior state | Evidence now | Computed |
|---|---|---|---|---|
| LAY-02 | Every slot inside safe rect | FAIL (stale, pre-slots.js) | `node layout/run-lint.js` L2: Shorts + Longform tables pass; first-draft caption fails as designed | **PASS** |
| LAY-03 | Safe-rect constants exist | FAIL — 0 hits (stale) | `slots.js:16` `{top:288,bottom:1248,left:48,right:888}` | **PASS** |
| LAY-04 | x/y/w/h multiples of 8 | N/B | L3 passes on all fixtures (on-grid rects); table exceptions documented (D1: stage h 548, rail w 4 — both multiples of 4) | **PASS** (rects) + D1 exception documented |
| LAY-05 | Rounding ≤4 px | N/B | L3 records displacements (x=150 → 2 px) and rejects NaN; by construction displacement ≤4 for period 8 | **PASS** |
| LAY-10 | No raw pixel in styles/, beats/ | FAIL | styles/ clean; beats/ absent (target tree); compositions/** raw (inventory §4.2) → later-stage SFRs | **FAIL** (compositions only) — as documented |
| LAY-20 | `u` scaler not a no-op | FAIL — `u ≡ 1` (stale) | `motion-graphics.jsx` uses `S = Math.min(height/1920, width/1080)` (Part 0.1 CLEARED); register grep `Math.min(width, height) / 1080` → 0 hits | **PASS** |

No register cell was edited (CHECK-REGISTER.md is a shared file).

---

## 6. SHARED-FILE REQUESTS

| # | File(s) | What | Why |
|---|---|---|---|
| SFR-LAY-1 | `MOTION-GRAPHICS-MANUAL.md` A1.3 + B2 | Caption zone `1148–1248` → `1152–1248`; `zoneTop: 1148` → `1152`; B2.2 "the 100 px zone" → 96 px; `maxWidth: 780` → align with corrected `w: 760` (or justify) | D2 — manual carries the first-draft values that LAYOUT-SYSTEM §3.1.1 corrected on 2026-08-06; 1148 is off-grid |
| SFR-LAY-2 | `compositions/mg-style.js:25-29` | `ZONES` → derive from `layout/slots.js` (import); fix caption top 1148 → 1152 | Raw-pixel dupe (gate leg 3) + stale caption value |
| SFR-LAY-3 | `compositions/beats.js` | Delete raw `SAFE` (:27), `OPTICAL_CENTER_X` (:29), `OPTICAL_CENTRE_X/Y` (:50-51), `zoneTop/zoneBottom` (:55-56); import from `layout/slots.js`; dedupe the dual spelling | Raw-pixel dupe (gate leg 3) + stale caption value + duplicate constant spelling |
| SFR-LAY-4 | `compositions/motion-graphics.jsx` | Replace raw pixel positions (:198, :214, :232-233, :242-243, :433, :434, :511, :586, :614, :626, :643-646, :664-667, :774, :782-784, :800-802, :850, :858, :887-890, :904-907, :928, :954-957, :975-976, :1050-1053, :1068-1069) with slot-derived rects | Gate leg 3 (raw pixels) — the documented "caption slot hardcoded" defect, Part 0.12 |
| SFR-LAY-5 | `compositions/minimal.jsx`, `compositions/cinematic-documentary.jsx` | Rebuild on the slot model (incl. `cd.jsx:446` top:28 and `:470` padding:40 crossing the safe rect) | Gate leg 3 + safe-rect violations (LAYOUT-SYSTEM Part 0.2 OPEN) |
| SFR-LAY-6 | `LAYOUT-SYSTEM.md` | §3.1 "every width and height is a multiple of 8" → carve out rail w=4 (stroke) and stage h=548 (or state "multiple of 4; grid multiples apply to resolved rects"); §3.7 "slots never overlap" vs longform table (caption slot overlaps headline slot by 40 px; 2-line caption reaches 837, colliding with content box 780-876); document longform rail extent (100–924) | D1/D3/D4 — spec-internal contradictions discovered in Phase 1 |
| SFR-LAY-7 | `CHECK-REGISTER.md` | Flip LAY-02/03/04/05/20 per §5; add D2 to LAY-10's method note (raw dupe in `compositions/` incl. stale 1148); note useCurrentScale version conflict (4.0.111 vs 4.0.125) in LAY-12 | Register is shared; evidence is in this ledger |

---

## 7. ESCALATIONS

1. **FINISH-SPEC.md is absent repo-wide** (glob `**/FINISH-SPEC.md` → none; re-confirmed
   2026-08-07). Carried from earlier stages. The protocol's spec set is incomplete without it.
2. **`layout/` + `spec/` are untracked in git** (`git status --short` → `??`). Stage-4 work exists
   only as working-tree files. No commit history to diff against (P2.5-style hashes impossible
   until first commit).
3. **Build-order claims verified true on 2026-08-07:** §8.4 step 1 ("L1–L3 pass on 12 hand-written
   fixtures" → 12/12 ✓) and step 2 ("15 checks" → 15/15 ✓) both hold. Part 7's "DONE 2026-08-06"
   markers are **confirmed**, not assumed.

---

## 8. APPENDIX — commands, outputs, sources

### 8.1 Layout lint (Tier 1)

Command (workdir `C:\Users\Chile\YOUTUBE\src\skills\remotion-render`):
`node layout/run-lint.js` → **12 passed, 0 failed** (exit 0). Full output:

```
L1 — rect inside slot
  ok  good Shorts frame passes
  ok  good Longform frame passes
  ok  crossing rect is caught
  ok  unknown slot is caught
L2 — slot inside safe rect
  ok  Shorts table passes
  ok  Longform table passes
  ok  documented caption {150,1148,780,100} fails (right 930 > 888)
L3 — grid multiples
  ok  good Shorts frame is exactly on-grid
  ok  off-grid x=150 is recorded, not failed
  ok  NaN coordinate is rejected
tier1 combined
  ok  good Shorts frame passes L1–L3
  ok  bad rect fails the combined run

12 passed, 0 failed
```

### 8.2 Spec lint

Command: `node spec/run-spec.js` → **15 passed, 0 failed** (exit 0). Covers schema valid/invalid
cases (bad atFrame `later`, bad align, unknown slot, bad archetype, bad fit, empty layers, missing
exit) + `toEnglish` rendering of the Part 2.1 fixture.

### 8.3 Installed versions (workdir `C:\Users\Chile\YOUTUBE`)

```
remotion@4.0.505
@remotion/layout-utils@4.0.506
```

### 8.4 Git state of lane files

`git status --short -- src/skills/remotion-render/layout src/skills/remotion-render/spec` → `??`
(both untracked). `git log --oneline -3 -- layout/slots.js` → no commits.

### 8.5 Live sources fetched / searched (all retrieved 2026-08-06/07)

| # | Source | Used for |
|---|---|---|
| 1 | `services.google.com/fh/files/misc/youtubesafezoneoverlay_vertical_final.png` (first-party artifact) | 001 — Google vertical safe-zone overlay exists and is fetchable |
| 2 | `somake.ai/blog/youtube-shorts-aspect-ratio` | 001 — 288 top / 672 bottom / 48 left / 192 right; 9:16 1080×1920 |
| 3 | `aicarousels.com/free-tools/youtube-safe-zone-checker` | 001 — same numbers, from Google's overlay |
| 4 | `raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-best-practices/remotion-create/video-layout.md` (first-party skills repo) | 002, 006 — 80 px sides / 100 px top-bottom; headline 84 / supporting 44; scale with width |
| 5 | `remotion.dev/docs/layout-utils/measure-text` | 010 — browser-only, cached, `{width,height}` |
| 6 | `github.com/remotion-dev/remotion/blob/main/packages/layout-utils/src/layouts/measure-text.ts` (first-party source) | 010 — `wordCache`, browser throw, `validateFontIsLoaded` |
| 7 | `github.com/remotion-dev/skills/blob/main/skills/remotion/rules/measuring-text.md` (first-party skills repo) | 010 — fitText cap, fillTextBox `exceedsBox`, load fonts first, outline over border |
| 8 | `remotion.dev/docs/use-current-scale` | 011 — canvas scale hook; `AvailableFrom v4.0.125`; throws outside context |
| 9 | `remotion.dev/docs/measuring` | 011 — `scale()` transform affects gBCR; "From v4.0.111" (doc version conflict noted) |
| 10 | `github.com/remotion-dev/skills/blob/main/skills/remotion/rules/measuring-dom-nodes.md` (first-party skills repo) | 011 — divide by scale; scale in deps |

### 8.6 Gate-leg-3 grep commands

- `grep 'top:|left:|right:|bottom:|width:|height:|padding:' styles/` → 0 hits
- `glob layers/**` → no files (dir does not exist)
- `glob beats/**` → no dir; `compositions/beats.js` exists (raw dupes, §4.2)
- Raw-pixel greps over `compositions/**` → inventory in §4.2

---

## 9. FINAL MESSAGE TO MG-ORCHESTRATOR (to be sent verbatim)

1. **Verdict: READY** — for the layout-lane scope. Ledger: `data/audit/4/audit-layout.ledger.md`.
2. **Changes:** zero. All 11 claim cards CONFIRM. `layout/slots.js`, `layout/lint.js`,
   `layout/run-lint.js`, `spec/*` are grounded and faithful to the corrected spec + live sources.
3. **Lint:** `node layout/run-lint.js` → **12 passed, 0 failed**; `node spec/run-spec.js` →
   **15 passed, 0 failed** (npm blocked by PowerShell policy; run via node, scripts are thin wrappers).
4. **Counter-checks:** none ran — zero changes, P3 not triggered.
5. **Shared-file requests (7):** SFR-LAY-1 manual caption geometry (1148→1152 + B2 updates);
   SFR-LAY-2 `mg-style.js` ZONES → import slots.js (+ caption 1148→1152); SFR-LAY-3 `beats.js`
   raw SAFE/optical/zoneTop + dual spelling; SFR-LAY-4 `motion-graphics.jsx` raw pixels → slots;
   SFR-LAY-5 `minimal.jsx` + `cinematic-documentary.jsx` safe-rect rebuild (cd.jsx top:28, padding:40);
   SFR-LAY-6 LAYOUT-SYSTEM §3.1/§3.7/longform-rail corrections; SFR-LAY-7 CHECK-REGISTER LAY flips.
6. **Gate leg 3 (raw pixels):** FAIL repo-wide **but only in `compositions/**`** (inventory in
   ledger §4.2); `styles/` clean, `layers/`/`beats/` don't exist yet. Not a Stage-4 lane blocker —
   tracked via SFR-LAY-2/3/4/5.
7. **Spec issues needing user/orchestrator confirmation (not changed by me):** (a) FINISH-SPEC.md
   absent repo-wide (escalation); (b) caption zone conflict 1148 vs 1152 — slots.js is on the
   corrected side, MANUAL/mg-style/beats are stale; (c) §3.1 "multiple of 8" overstates (stage h 548,
   rail w 4); (d) §3.7 "slots never overlap" false for the longform table (40 px static overlap;
   2-line caption collides with content box); (e) longform rail extent under-documented;
   (f) `layout/`+`spec/` untracked in git.
