# AUDIT-TYPE — STAGE 11 LEDGER (D4 reserved counter slot, D5 digit-count, D14 bbox)

**Lane:** `audit-type` — type, fonts, measurement, captions, crispness
**Stage:** 11 — CROSSCHECK-PROTOCOL Part 4 row 11: "D4–D7, D14 pass; counter bounding box byte-identical across the count" (shared with `audit-motion`; D4/D5/D14 are THIS lane's domain — the motion lane's probe and ledger confirm it owns `data/audit/11/counter-values-probe.mjs`)
**Mission:** verify D4 (every numeric rect reserves the width of its FINAL formatted string — DETAIL-REFERENCE A1.1:78-89), D5 (counter start has the same digit count as the target — A2.3:130-136, register ENC-26), and D14 (counter region's bounding box byte-identical across every frame of the count — register ENC-27) against the REAL counter surface: the beats/** HERO_NUMBER + PROGRESS components, on REAL channel data and REAL fonts. Deliver: (1) real-data probe evidence for D5 + ENC-28 separators (exists, re-run this phase), (2) a NEW rendered probe that loads the REAL woff2 faces and measures the numeral bbox across the count — the first D14 evidence that is not font-blind, (3) the Stage-2-recorded Stage-11 dependency: the machine-readable A1.3 flag + A1.1 reserved-width helper in `layout/measure.js` (this lane's file), (4) SHARED-FILE REQUESTS for the beats to consume the flag. Counter-check every claim via `verify-independent`.
**Ownership (edit):** `src/skills/remotion-render/layout/measure.js` (this lane's file — A1.3 flag + A1.1 helper), `data/audit/**` (probe + entry + evidence). **Not written:** `beats/**`, `compositions/**`, `primitives/**`, `layers/**`, `spec/**`, `styles/**`, `config/**` (read-only; consumption of the flag is a SHARED-FILE REQUEST in §2).
**Status:** Phase 1 (GROUND) complete — claim cards written (11-T-01…11-T-05). Phase 2 (CHANGE) — evidence probe + measure.js additions executed. Phase 3 (COUNTER-CHECK) — dispatch recorded in §3.

---

## §0 — Current state snapshot

| Item | Value |
|---|---|
| Repo HEAD | `29c3038` — "stage 9: gate verdict PASS — orchestrator re-run" |
| Working tree | Untracked only: `data/audit/10/`, `data/audit/11/`, `src/skills/remotion-render/captions/` — no tracked-file modifications |
| Counter surface | beats/HeroNumber.jsx (numeral span `data-role="numeral"`, `formatCounter` = raisedFloor + thousands separators, `fontVariantNumeric: "tabular-nums"`, NO reserved width — content-sized) ; beats/Progress.jsx (per-bar `counterText`, same A2.3/A2.4 arithmetic, tabular-nums on value + label + axis label, NO reserved width) |
| Production wiring | Root.jsx still mounts the LEGACY `motion-graphics.jsx` scenes (HeroNumberScene :582-608 applies `fontFamily` + `tabular-nums` directly on the numeral span). beats/** are exercised by probes only (motion probe + this phase's D14 probe) |
| Fonts | 13 families in `public/fonts/` (fonts-loader.js FONT_FACES); mg channels use 6: Inter, DM Sans, Roboto Condensed, Fira Sans, JetBrains Mono, Nunito. Binary GSUB reads (`data/audit/2/tnum-features.txt`): tnum PRESENT on Inter, Fira Sans, Roboto Condensed; ABSENT on DM Sans, Nunito (proportional); JetBrains Mono monospace (equal-width by construction, tnum n/a). Stage-2 verdict: 8 mg channels tnum-safe, 5 flagged for the A1.3 fallback (Legal Brief, Earth Signal, Build Smart, NutriDecode — DM Sans; MedBrief — Nunito) |
| Register rows (read this phase) | ENC-25 (D4, stage 11, FAIL, MAJOR, "compiler | reserved"), ENC-26 (D5, stage 11, FAIL, MINOR, "compiler | equal"), ENC-27 (D14, stage 16, FAIL, MAJOR, "contact sheet | identical"), ENC-28 (separators, stage 11, FAIL, MINOR, "compiler | 100%") |
| Stage-2 dependency | claim-type-003 (audit/2/audit-type.ledger.md:88-124): "introduce a machine-readable flag (candidate: channels.json field or computed constant in the counter/measure module — layout/measure.js when it exists)" — THIS phase delivers the computed-constant option in measure.js |

### §0.1 — Sources of record (Phase 1)

First-party / machine:
- `src/skills/remotion-render/beats/HeroNumber.jsx` (re-read this phase — raisedFloor :36-40, formatCounter :43-49, numeral span :89-109 with `fontVariantNumeric: "tabular-nums"`, `fontFamily` prop destructured :72 but NEVER applied to any element — renders in the inherited/default font unless a wrapper sets font-family)
- `src/skills/remotion-render/beats/Progress.jsx` (re-read this phase — counterText :159-167, A2.3 raised floor + A2.4 fmtValue separators + A2.5 decimal fix + A2.6 clamp; tabular-nums at :269/:325/:347; NO reserved width; NO fontFamily prop at all)
- `src/skills/remotion-render/compositions/motion-graphics.jsx` (legacy HeroNumberScene :582-608 — `fontFamily` applied directly to the numeral span, `tabular-nums`, formatCounter(counter, scene.value))
- `src/skills/remotion-render/fonts-loader.js` (FONT_FACES — 25 woff2, weights 400/700 only)
- `src/skills/remotion-render/wait-for-fonts.js` (delayRender + document.fonts.load for all families)
- `data/audit/2/tnum-features.txt` (binary GSUB reads — tnum presence per family)
- `data/audit/11/out/counter-values-probe.json` (D5 probe output — 6 cases, 58 HERO counters, 0 PROGRESS in real data)
- `data/audit/11/counter-values-probe.mjs` (D5 probe — mirrors HeroNumber raisedFloor/formatCounter verbatim :25-39)
- `data/audit/11/motion-probe.mjs` + `data/audit/11/_motion-entry.jsx` (probe infra pattern — serializeEntry/Measure/parseMeasures; NOTE: the motion entry does NOT import wait-for-fonts.js, so its numerals render in the browser-default font — font-blind; this phase's D14 probe is the first to load real fonts)
- Stage-9/8/7/5/2 ledgers (cross-referenced evidence + precedents)

Third-party / spec:
- DETAIL-REFERENCE.md A1.1 (:78-89, reserve final-string width, `rect.w = ceil8(slot.width)`), A1.2 (:91-92, tabular-nums on every numeric element), A1.3 (:94-105, non-tnum fallback — per-digit fixed slots `width: 0.62em`), A2.3 (:130-136, same digit count as target), A2.4 (:138-140, separators from frame 0), D14 (:593), D2 (:571); CHECK-REGISTER.md ENC-25..28 (:256-259); CROSSCHECK-PROTOCOL.md

---

## §1 — PHASE 1 CLAIM CARDS

### CLAIM-T-11-01 — D5 (ENC-26): every real counter starts at the target's digit count — PASS on real data

```
ASSERTION   Running data/audit/11/counter-values-probe.mjs over every real
            SRT + sections-fallback synthesis path (6 cases: ch-01 movile-cave
            SRT, ch-01 sections-fallback, ch-02 narrowboat sections-fallback,
            ch-01 debt-snowball SRT, ch-04 great-fire SRT, ch-02 what-to-say
            legacy SRT) yields 58 HERO_NUMBER counters, all d5ok = true
            (start digit count == target digit count), zero multi-length
            cases, probe exit code 0. No PROGRESS beats exist in real data
            (progress = 0 across all cases); the register's ENC-26 compiler
            gate covers HERO_NUMBER today.
METHOD      node data/audit/11/counter-values-probe.mjs — mirrors the EXACT
            raisedFloor/formatCounter arithmetic from HeroNumber.jsx; exit
            0 iff every counter keeps its target's digit count from frame 0.
            Evidence: out/counter-values-probe.json (58 heroes, 0 d5fails).
CRITERION   d5ok true for every HERO counter; distinctLengths all singletons.
RESULT      (recorded in §2 after the re-run)
```

### CLAIM-T-11-02 — ENC-28: thousands separators on every intermediate value — PASS on real data

```
ASSERTION   Every distinct string the probe sampled for every counter carries
            thousands separators from frame 0 — e.g. "1,000" → "1,986"
            (movile-cave), "10,000" → "13,600" (debt-snowball), "100" → "800"
            (narrowboat), all comma-formatted; the formatCounter regex
            \B(?=(\d{3})+(?!\d)) applies to every intermediate, and
            Progress.counterText routes through fmtValue (toLocaleString).
METHOD      Probe output distinctStrs arrays (per counter); assert /,/ present
            in every sampled string. Same probe as T-11-01.
CRITERION   100% of sampled distinct strings contain a thousands separator
            when the value >= 1,000; no unformatted string appears mid-count.
RESULT      (recorded in §2 after the re-run)
```

### CLAIM-T-11-03 — D4 (ENC-25): mechanism analysis — reserved slot is ABSENT; de-facto PASS on tnum fonts, genuine FAIL on the 5 flagged channels

```
ASSERTION   Neither the beats nor the legacy counter spans reserve the final
            string's width (A1.1's rect.w = ceil8(measureText(finalStr))):
            HeroNumber.jsx:89-109 and motion-graphics.jsx:591-603 render a
            CONTENT-SIZED numeral with tabular-nums only. Therefore D4 holds
            de facto ONLY where (a) the font's digits are equal-width (tnum
            present — Inter/Fira Sans/Roboto Condensed — or monospace —
            JetBrains Mono) AND (b) D5 keeps the digit count constant (T-11-01
            PASS): then every string in the count has the same width and the
            box never moves. On the 5 flagged channels (DM Sans ×4, Nunito ×1)
            tabular-nums is a silent no-op (no tnum in the GSUB), digit
            advances differ, and the content-sized box JITTERS as the count
            passes through 1/8/9-heavy strings → D4 genuinely FAILS there
            until the A1.3 per-digit fixed-slot fallback lands.
CRITERION   Structural: rect has no reserved width (read of both renderers).
            Rendered: numeral bbox byte-identical on Inter, jittering on
            DM Sans (T-11-04 probe — rendered, real fonts).
RESULT      (recorded in §2)
```

### CLAIM-T-11-04 — D14 (ENC-27): rendered bbox byte-identical across the count — PASS on tnum (Inter), jitter demonstrated on DM Sans

```
ASSERTION   NEW rendered probe (data/audit/11/type-d14-probe.mjs + its own
            entry importing wait-for-fonts.js) renders HERO_NUMBER with the
            REAL woff2 faces (Inter = tnum; DM Sans = no tnum) at the frames
            of every distinct counter string across the count window
            [start, start+D.push] and measures the numeral's
            getBoundingClientRect + offsetWidth/offsetHeight:
              Inter  (ch-01, 13,600 debt-snowball + 1,986 movile-cave):
              offsetWidth/offsetHeight byte-identical at every sampled count
              frame, and the DOM rect byte-identical on all post-entrance
              frames (frame >= start + D.base; the 0.92→1 scale over D.base
              is the DOCUMENTED entrance pop, not a digit-width change).
              DM Sans (ch-02 narrowboat, 2,000 + 800 — the same values the
              D5 probe found): offsetWidth varies across distinct strings →
              the exact tabular-figure failure D14 exists to catch, and the
              A1.3 fallback's justification.
            Note the entrance nuance (honesty): frames [start, start+D.base−1]
            carry the deliberate scale pop (A4 entrance), so "byte-identical
            across every frame" is asserted on the layout box (offset
            width/height) at ALL frames and on the DOM rect after the
            entrance completes. The register row ENC-27 is staged for the
            contact-sheet gate (stage 16); this probe supplies the Tier-3
            rendered evidence ahead of that stage.
CRITERION   Inter runs: max deviation of offsetWidth/offsetHeight across
            sampled frames == 0 px, and DOM rect deviation == 0 px for
            frames >= start+D.base. DM Sans runs: max offsetWidth deviation
            > 0 px (jitter present, quantified).
RESULT      (recorded in §2)
```

### CLAIM-T-11-05 — A1.3 machine-readable flag + A1.1 reserved-width helper in layout/measure.js (Stage-2-recorded dependency)

```
ASSERTION   layout/measure.js (this lane's file) gains:
              - FIXED_SLOT_FAMILIES (the 2 mg families binary-verified to
                lack tnum AND be proportional: DM Sans, Nunito) +
                needsFixedSlots(fontFamily) — the machine-readable A1.3 flag
                Stage 2 recorded (claim-type-003 "computed constant in the
                counter/measure module — layout/measure.js when it exists").
              - reserveCounterWidth(finalStr, fontStyle) — the A1.1
                measurement (measureText of the FINAL formatted string via
                this module's gated measureText, ceil8) that a fixed-slot
                counter must reserve from frame 0. Pure measurement; no
                render-site change in this file. Consumption in beats/**
                (HeroNumber.jsx, Progress.jsx) and/or legacy scenes is
                OUTSIDE this lane's ownership → SHARED-FILE REQUESTS (§2).
            JetBrains Mono is deliberately NOT flagged: monospace digits are
            equal-width by construction (stage-2 verdict "monospace n/a").
CRITERION   lint clean; needsFixedSlots("DM Sans") === true,
            needsFixedSlots("Nunito") === true,
            needsFixedSlots("Inter") === false,
            needsFixedSlots("Fira Sans") === false,
            needsFixedSlots("JetBrains Mono") === false;
            reserveCounterWidth returns ceil8(measured width).
RESULT      (recorded in §2)
```

---

## §2 — PHASE 2 (CHANGE)

All changes are additive/verification-only within this lane's ownership
(measure.js = mine; probes/entries/evidence = data/audit/**).

### Change 2-1 — re-run the D5 probe (verification only, existing file)

Command and result recorded in §2.3.

### Change 2-2 — NEW D14 rendered probe (data/audit/11/type-d14-probe.mjs + data/audit/11/_type-entry.jsx)

Written this phase. First probe to load the REAL fonts (imports
wait-for-fonts.js → FONT_FACES via document.fonts.load) so D14 is measured
on the actual tnum/non-tnum metric behavior, not the browser-default face.
The entry wraps HeroNumber in a div that sets font-family (beats do not
apply their fontFamily prop — finding, see §4) so the numeral inherits the
real face, mirroring the legacy scene's `fontFamily` on the span.

Runs (4): `13600-Inter` (debt-snowball, ch-01), `1986-Inter` (movile-cave,
ch-01), `2000-DMSans` (narrowboat, ch-02), `800-DMSans` (narrowboat, ch-02).
Frames: the first frame of every DISTINCT counter string in the count window
[6, 66] (tA=10, start = tA−4, D.push = 60) — computed node-side by mirroring
HeroNumber's eased progress + formatCounter (same arithmetic the D5 probe
uses). Gate per run:
- Inter runs (expectStable): offsetWidth/offsetHeight identical across ALL
  sampled frames; DOM rect (x,y,w,h) identical on all frames >= 15.
- DM Sans runs (expectJitter): max offsetWidth deviation > 0 recorded and
  reported (this is the D14-failure demonstration that justifies A1.3).

### Change 2-3 — layout/measure.js additions (A1.3 flag + A1.1 helper)

See claim T-11-05. Pure additive exports at the end of the module; no
existing export modified.

### Change 2-4 — SHARED-FILE REQUESTS (consumption is outside this lane's ownership)

| ID | File(s) | Request |
|---|---|---|
| SFR-T-11-1 | `beats/HeroNumber.jsx`, `beats/Progress.jsx` | When `needsFixedSlots(fontFamily)` is true for the channel's family, render the numeral in per-digit fixed slots (`width: 0.62em` centred boxes per digit, DETAIL-REFERENCE A1.3:101-105) and reserve the counter box to `reserveCounterWidth(finalStr, fontStyle)` from frame 0 (A1.1) — so D14 holds on DM Sans/Nunito channels too. Also: apply the component's `fontFamily` prop to the numeral span (HeroNumber destructures it at :72 but never uses it — see finding 4-1) |
| SFR-T-11-2 | `compositions/motion-graphics.jsx` (legacy HeroNumberScene) | Same fixed-slot + reserved-width fallback for the legacy production path when the channel's font lacks tnum (legacy path is currently the one wired into Root.jsx) |
| SFR-T-11-3 | `CHECK-REGISTER.md` | Update ENC-25 (D4) and ENC-27 (D14): PASS on the 8 tnum/mono channels; FAIL on the 5 flagged channels pending SFR-T-11-1/2; ENC-26 (D5) → PASS, ENC-28 → PASS (probe evidence, T-11-01/T-11-02). ENC-27's formal contact-sheet gate (stage 16) still applies |

### §2.3 — Execution record

(command outputs appended as evidence)

---

## §3 — PHASE 3 (COUNTER-CHECK)

Dispatched after §2: T-11-01/T-11-02 (probe exit + JSON evidence),
T-11-03 (structural read of both renderers + rendered probe),
T-11-04 (probe gates), T-11-05 (measure.js exports + lint).

---

## §4 — OBSERVATIONS (flagged, NOT changed — outside this lane's ownership or not a gate item)

4-1. **beats ignore their fontFamily prop.** HeroNumber.jsx:72 destructures
     `fontFamily = "Inter"` but never applies it to the numeral or headline
     span — probe renders fall back to the browser-default font. Progress.jsx
     has NO fontFamily prop at all. The legacy scene applies it directly
     (motion-graphics.jsx:593). If beats are wired into Root.jsx without a
     font-family wrapper, numerals render in a fallback face. → folded into
     SFR-T-11-1.
4-2. **The beats numerals render at fontWeight 800 but every vendored face
     ships only 400/700** (fonts-loader.js FONT_FACES). The browser
     synthesizes an 800 (or matches to 700). This is consistent between
     measurement (HEADLINE_FONT w800, Rule 5.2) and render, so it does not
     falsify D14; noted for font integrity.
4-3. **D14's entrance pop vs "every frame" wording.** The numeral's 0.92→1
     scale over D.base (HeroNumber.jsx:85,104) means the DOM rect is
     intentionally smaller during frames [start, start+D.base−1]. The layout
     box (offsetWidth/offsetHeight) is transform-free and byte-identical
     across the whole count on tnum fonts — that is the honest assertion
     for "every frame"; the DOM rect is asserted after the entrance settles.
4-4. **No PROGRESS beats in real data today** (probe: progress = 0 in all 6
     cases) — Progress.jsx's counter path is exercised by fixtures (stage-8
     probe) and by the D5 probe's progress loop (which found no real
     instances). D14 evidence for PROGRESS is structurally identical (same
     counterText + tabular-nums), covered when real PROGRESS data exists.
4-5. **measureText cache-key gap (stage-5 note):** fontVariantNumeric absent
     from the @remotion/layout-utils cache key — two measurements differing
     only in that flag collide. This is inside the vendored lib (index.mjs),
     not this lane's file; the tabular-nums flag is always present in the
     measure calls this lane routes (Rule 5.2b), so the collision does not
     bite today. Noted for the lib owner.

---

## §5 — SPEC/REGISTER NOTE

DETAIL-REFERENCE A1.3's "four of six" count is superseded by the Stage-2
binary re-read: the correct mg flagged set is FIVE channels (Legal Brief,
Earth Signal, Build Smart, NutriDecode — DM Sans; MedBrief — Nunito), and
A0.2's "only Inter carries tnum" is superseded (Inter, Fira Sans, Roboto
Condensed carry tnum on the latin subsets). This ledger relies on the
stage-2 corrected numbers (tnum-features.txt), already ratified by both
stage-2 lanes and by the stage-2 GATE.md PASS row.
