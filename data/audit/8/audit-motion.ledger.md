# AUDIT-MOTION — STAGE 8 LEDGER (PROGRESS beat component)

**Lane:** `audit-motion` — timing, easing, springs, stagger, drag, blur
**Stage:** 8 — `PROGRESS` archetype (CROSSCHECK-PROTOCOL Part 4 row 8, gate: "L8, L9, L10 pass — the three chart bugs cannot recur"; shared with `audit-encoding`)
**Mission:** deliver `src/skills/remotion-render/beats/Progress.jsx` — the first beat component (LAYOUT-SYSTEM §8.4 step 6, build order line 726) — implementing the PROGRESS chart motion per DETAIL-REFERENCE A4 §PROGRESS + MANUAL E3.4/E3.5/F5, with a Tier-2 render-engine probe proving the L8/L9/L10 guarantees in the DOM; counter-check every claim via `verify-independent`.
**Ownership (edit):** `src/skills/remotion-render/beats/**` + `data/audit/**`. **Not written:** `primitives/Chart.jsx`, `spec/fromBeats.js`, `layers/Layer.jsx`, `layout/**`, `compositions/**` (all read-only this stage; see §4 notes + SFR block).
**Status:** Phase 1 (GROUND) complete — 7 claim cards (014–020). Phase 2 (CHANGE) complete — Progress.jsx + probe written, probe green (13 passed / 0 failed, §4). Phase 3 verdicts appended in §5.

---

## §0 — Current state snapshot (pre-edit, all re-read this session)

- `beats/` **does not exist** — `Test-Path beats` = False; glob "No files found". `Progress.jsx` is the first beat file (LAYOUT-SYSTEM §8.4 step 6).
- `data/audit/8/` holds only the peer lane's `audit-encoding.ledger.md` + `frombeats-chart-gate.mjs` (Run 1: real PROGRESS beat → fromBeats → validateShotSpecs → compile → lintAll; L7 one accent, L8 Δ0, L9 equal, L10 = 12; ENC-08..24 throws; 94 passed exit 0).
- `layers/Layer.jsx` (244 lines): `{rect, enter, exit, frame?}` — positioning only; CHART_BUILD falls into the D2.4/D2.5 default branch (envelope: opacity 0→1 over D.base) — interior chart motion is the beat's job ("DRAW/GROW/TRACE interior motion is owned by the primitive").
- `primitives/Chart.jsx` (223 lines): static renderer of the compiled `chart` contract; DOM order = E3.4 (baseline → gridlines → axis labels → bars); header documents "motion is owned by beats/Progress.jsx … the animated beat can mount the same tree and animate it".
- `spec/fromBeats.js`: PROGRESS beat → 5 layers `[kicker, rail, caption, headline, chart]`, NO accent rule; chartLayer `{role:"chart", slot:"stage", align:"bottom-left", content:{unit,series}, enter:{pattern:"CHART_BUILD", atFrame:0}, exit:{pattern:"NONE"}}`; single-point → HERO_NUMBER (ENC-22/H8); ENC-08/09/13/24/10/21/20/23 throw.
- `layout/compile.js:191-244` chartRect: `axisY = slot.y + slot.h − (pad + 4)`; `barW = snapToGrid((plotW − (n−1)·gutter)/n, 8)`; bars bottom-anchored (`bottom: axisY` by construction, L8); `axisLabelRight = gridX − 12` (L10); `snapToGrid = Math.round(v/8)·8` (slots.js:68-71).
- Live legacy renderer `compositions/motion-graphics.jsx:705-830` `ProgressScene` (the code being replaced): baseline 0-10; gridlines `gridYs=[0.25,0.5,0.75]` at 8+3i; bar labels via `riseStyle(frame, 16+i·5)`; bars `growSpring(frame, start, fps)` = `spring({config:{damping:16, stiffness:90}, durationInFrames:24})`; value fade at start+10 over 6f; accent via 3-frame `mixColor` at start+24; `Sfx file="sfx/ui/click_004.ogg" at=start_hl+24 db={-22}`.
- `compositions/beats.js`: FPS 30; D {micro:4, short:6, base:9, large:12, complex:15, push:60, hold:45}; MG_TYPE {value:72, label:32}; MAX_BEAT_FRAMES 96.
- `compositions/motion-graphics.jsx:116` `dbToVolume(db) = Math.pow(10, db/20)`; `Sfx` (:282-289) = `<Sequence from={at}><Audio src={staticFile(file)} volume={dbToVolume(db)}/></Sequence>`.
- Environment: Node v24.18.1; Chrome `C:\Program Files\Google\Chrome\Application\chrome.exe`; `@remotion/bundler` + `@remotion/renderer` present (root node_modules); `public/sfx/ui/click_004.ogg` exists; `npm` blocked (execution policy) → everything runs as `node <file>`.
- Spring binary (machine, read this session): `node_modules/remotion/dist/cjs/spring/spring-utils.js` `springCalculation({frame,fps,config})` iterates per-frame; **no `durationInFrames` param**; `spring()` wrapper (spring/index.js) — with `durationInFrames` it REMAPS the natural spring to complete exactly at that frame; without it the duration is emergent. `measure-spring.js:11` `threshold = 0.005` default.

## §0.1 — Sources of record (Phase 1, all fetched/live this session)

First-party / machine: installed remotion spring binaries (spring-utils.js, measure-spring.js, spring/index.js); remotion.dev/docs/spring; live repo files (Chart.jsx, Layer.jsx, fromBeats.js, compile.js, slots.js, beats.js, motion-graphics.jsx, run-lint.js, tier2-probe.mjs, _tier2-entry.jsx, frombeats-chart-gate.mjs, audit-encoding.ledger.md, stage-7 ledger + GATE.md).
Third-party / spec: the five spec docs (MOTION-GRAPHICS-MANUAL.md, DETAIL-REFERENCE.md, LAYOUT-SYSTEM.md, FINISH-SPEC.md, CHECK-REGISTER.md) as inputs-to-verify.

---

## §1 — PHASE 1 CLAIM CARDS

### CLAIM-motion-014 — Progress.jsx mounts the Chart.jsx tree in E3.4 order and animates it on the A4 §PROGRESS frame table

```
ASSERTION   beats/Progress.jsx renders the same DOM tree as the static
            primitive (Chart.jsx) in E3.4 construction order — baseline →
            gridlines → axis label → bars (each bar: rect, value, label) —
            and animates it on the DETAIL-REFERENCE A4 §PROGRESS frame
            table: baseline DRAW [0,10]; gridline i DRAW 10f from
            8+3·i (stagger 3); single axis label RISE at 16; bar i GROW
            from tA−4+7·i (stagger 7, ratio 0.35 — FINISH-SPEC R4.1
            override of the manual's 5); bar's value counter runs with the
            bar; bar's label RISE at bar+12 (drag 12); highlight settle →
            accent applied as a 1-frame switch; hold begins last label +9.
            All interior positions derive from the compiled chart object
            only (never recomputed): plotH = axisY − barAreaTop, bar left =
            bar.x − gridX, gridlines at 25/50/75 % of plotH.
SPEC REF    MOTION-GRAPHICS-MANUAL.md E3.4 (924-927) + F5 (1048-1063);
            DETAIL-REFERENCE.md A4 §PROGRESS (221-236); FINISH-SPEC R4.1.
SOURCES     [1] DETAIL-REFERENCE.md A4 §PROGRESS table (221-236) — the
            frame-resolution micro-timing table "the compiler emits and the
            linter checks".
            [2] FIRST-PARTY live: primitives/Chart.jsx:96-218 — the exact
            tree (baseline 4px stroke, 3 gridlines at 25/50/75%, axis label
            via right:calc(100%+12px), bars with value + label children)
            whose header (:18-21) assigns interior motion to this file.
            [3] FIRST-PARTY live: compositions/motion-graphics.jsx:705-830
            ProgressScene — the legacy implementation of the same table
            (baseline 0-10, gridlines 8+3i, value fade start+10, accent
            start+24, click start_hl+24).
RE-VERIFIED YES — with one CHANGED: the A4 table's "11, 14, 17 —
            gridlines 2–4" lists FOUR gridline starts, but the live chart
            (Chart.jsx GRID_LINES=[0.25,0.5,0.75], legacy gridYs) has
            exactly THREE. Implemented 8/11/14 (stagger 3 identical);
            SFR-motion-5 filed (DETAIL-REFERENCE amendment).
CURRENT     beats/ absent. Legacy ProgressScene animates the old absolute-
            coordinate tree (plotLeft 96, baselineY 880, maxBarH 400,
            value −56 float) — the geometry the L8/L9/L10 bugs lived in.
DELTA       No beat exists; the PROGRESS chart motion must move from the
            legacy scene into beats/Progress.jsx on the compiled chart.
PLAN        Delete: nothing (new file). Replace with: beats/Progress.jsx
            (E3.4 tree + A4 table on compiled geometry) + probe.
DIFF        blob 8467bddfc410 (beats/Progress.jsx, new; SHA-256 8F965B9F9E3B)
COUNTER     CONFIRM (verify-independent #0233f3e97, §5) — verifier sources:
            remotion.dev/docs/spring + spring-utils.ts ζ formula + MIT
            OCW 2.004 / TMU pressbooks OS formula; E3.4 order + full A4
            table mapped to Progress.jsx lines.
STATUS      LANDED
```

### CLAIM-motion-015 — Bar grow spring = ζ 0.518 / 15% overshoot, emergent (replaces legacy growSpring)

```
ASSERTION   beats/Progress.jsx grows each bar with
            spring({frame: frame−start, fps, config:{damping:13.9,
            stiffness:180}}) — mass 1 → ζ = 13.9/(2√180) = 0.518,
            first overshoot e^(−πζ/√(1−ζ²)) = 14.9 % ≈ the A3.1 table's
            "Chart grow 15 %", the design's ONE overshoot site (MANUAL
            §7.2 / DETAIL-REFERENCE A3.1 "bars"). The duration is EMERGENT
            (no durationInFrames — A3.4/A3.5): measured natural settle =
            21 frames at Remotion's 0.005 rest threshold (~20 per the A4
            table "GROW + counter ~20"). The value counter drives from the
            SAME scalar p (A2.1) — never a second interpolation.
SPEC REF    DETAIL-REFERENCE.md A3.1 (settle table), A3.4 (17f settle
            math), A3.5 (spring only where duration is emergent);
            A4 §PROGRESS (bar GROW ~20, spring ζ0.517); MANUAL §7.2.
SOURCES     [1] DETAIL-REFERENCE.md A3.1/A3.4/A3.5 — damping 13.9 /
            stiffness 180 / ζ 0.517 / 15 % for "chart grow" (bars).
            [2] FIRST-PARTY machine: node_modules/remotion/dist/cjs/spring/
            spring-utils.js:35 (ζ formula), spring-utils.js:59 (oscillation
            branch only ζ<1), measure-spring.js:11 (0.005 default);
            spring/index.js (durationInFrames remap logic). Computed this
            session: ζ=0.5180, OS=14.92 %, natural duration = 21f (0.005),
            29f (0.001); p(8)=1.1485 peak, p(14)=0.9955, p(21)≈1,
            p(24)=1.0032, p(30)=1.0001, p(60)=1.0000.
            [3] FIRST-PARTY docs: remotion.dev/docs/spring — config
            semantics + defaults (damping 10, mass 1, stiffness 100).
RE-VERIFIED YES — ζ recomputed by hand and by binary this session; the
            legacy growSpring {damping:16, stiffness:90, durationInFrames:
            24} (ζ 0.843, forced 24f completion) is superseded: A3.1 names
            the chart-grow config explicitly and A3.4/A3.5 ban fixed
            durations for springs.
CURRENT     Legacy motion-graphics.jsx:107-114 growSpring {16, 90,
            durationInFrames: 24} — ζ 0.843 (~0.7 % overshoot), forced
            completion at 24f. Not the A3.1 chart-grow config.
DELTA       Bar spring config + emergent duration per A3.1/A3.4/A3.5.
PLAN        Replace legacy growSpring with {damping:13.9, stiffness:180},
            no durationInFrames, in beats/Progress.jsx.
DIFF        blob 8467bddfc410 (beats/Progress.jsx, new; SHA-256 8F965B9F9E3B)
COUNTER     CONFIRM (verify-independent #0233f310d, §5) — verifier sources:
            remotion.dev/docs/spring + repo spring-utils.js:35/59-60 +
            measure-spring.js:11 + spring/index.js:23 + Wikipedia "Damping"
            / aleksandarhaber.com (OS formula); settle 21f hand-resimulated
            at fps 30.
STATUS      LANDED
```

### CLAIM-motion-016 — Counter: same p as the bar, raised floor, separators from frame 0, clamped at beat.data

```
ASSERTION   beats/Progress.jsx counts each bar's value from the SAME
            spring scalar p as the bar height (A2.1 — "never a second
            interpolation"), starting from a raised floor with the same
            digit count as the target (A2.3/ENC-26: floor = 10^(digits−1)
            for value ≥ 10, else 0), formatting EVERY intermediate value
            with thousands separators via toLocaleString("en-US") from
            frame 0 (A2.4/ENC-28), fixing the decimal place at compile
            time (A2.5, 1 decimal max like Chart.jsx fmtValue), and never
            counting to a value not in beat.data (A2.6 — clamped at the
            target, which also preserves the digit count across the 15 %
            overshoot transient, ENC-25/27). Rest value == Chart.jsx
            fmtValue(bar.value) exactly.
SPEC REF    DETAIL-REFERENCE.md A2.1-A2.6; CHECK-REGISTER §3.5 rows
            ENC-25/26/28 (stage 11, currently FAIL — the beat must
            satisfy them); MANUAL F5 counter note (:988-989).
SOURCES     [1] DETAIL-REFERENCE.md A2.1 (same scalar), A2.3 (raised
            floor inside charts), A2.4 (separators from frame 0), A2.5
            (decimals fixed), A2.6 (never past beat.data).
            [2] FIRST-PARTY live: primitives/Chart.jsx:69-75 fmtValue —
            the rest-state formatting the counter must match
            (toLocaleString("en-US"), integers exact, max 1 decimal).
            [3] FIRST-PARTY live: compositions/motion-graphics.jsx:120-130
            formatCounter/fmtValue — legacy precedents for pad + commas.
RE-VERIFIED YES. Clamp decision recorded: A2.1's example
            (shown = Math.round(value·p)) predates the A3.1 15 % chart
            spring; at ζ 0.518 the peak p = 1.1485 would read 53 for a 47
            target — A2.6 ("never count to a value that isn't in
            beat.data") + ENC-26/27 (digit count never changes) win; the
            bar still overshoots (A3.1), the counter holds at the target.
CURRENT     No beat counter exists. Legacy counter (mg.jsx:120-125) pads
            with leading zeros and rounds mid-count — no raised floor.
DELTA       Raised floor + same-scalar counting + clamp + separators from
            frame 0, matching fmtValue at rest.
PLAN        Replace legacy formatCounter with the A2 counter in
            beats/Progress.jsx.
DIFF        blob 8467bddfc410 (beats/Progress.jsx, new; SHA-256 8F965B9F9E3B)
COUNTER     CONFIRM (verify-independent #0233f1f32, §5) — verifier sources:
            MDN Intl.NumberFormat/toLocaleString + Unicode/ICU rounding
            modes + ECMA-402; hand-checks 47@p1.1485→47 (never 53), 12→2
            digits, 1240→comma from frame 0. Caveat noted: equality relies
            on ENC-10 (v ≥ 0) — non-fatal.
STATUS      LANDED
```

### CLAIM-motion-017 — Exactly one accent: the highlight bar fill, switched in 1 frame at settle

```
ASSERTION   beats/Progress.jsx applies accent to exactly ONE element —
            the highlight bar's fill (chart.highlightIndex from the
            compiled data, never value-derived) — as a hard 1-frame
            switch at the highlight bar's settle frame
            (highlightStart + 24), per DETAIL-REFERENCE A4 "highlight
            settle — accent applied, 1-frame switch" and L7. Values stay
            textPrimary on every bar and the bar border stays stroke
            (Chart.jsx ENC-15 mirror) — only the fill switches.
SPEC REF    DETAIL-REFERENCE.md A4 §PROGRESS (row "highlight settle");
            MOTION-GRAPHICS-MANUAL.md E3.4 ("Only the highlight: true
            point takes accent"); LAYOUT-SYSTEM L7 (one accent per frame);
            CHECK-REGISTER ENC-15.
SOURCES     [1] DETAIL-REFERENCE.md A4 §PROGRESS row + MANUAL E3.4 —
            the 1-frame-switch accent rule.
            [2] FIRST-PARTY live: primitives/Chart.jsx:162, 29-32 — the
            static accent decision `bar.highlight ? colors.accent :
            colors.surface` and the ENC-15 statement (values textPrimary
            on every bar) the beat mirrors at rest.
            [3] FIRST-PARTY live: compositions/motion-graphics.jsx:765-770
            — legacy settle (start+24) and its 3-frame blend, which the
            spec's "1-frame switch" replaces.
RE-VERIFIED YES — "1-frame switch" supersedes the legacy 3-frame
            mixColor blend (DETAIL-REFERENCE A4 is the newer table).
CURRENT     Legacy blends surface→accent over 3f (settled ease [0,3]) and
            also recolours the value text + stroke; Chart.jsx (the rest
            contract) keeps values textPrimary and borders stroke.
DELTA       Hard switch at highlightStart+24; fill only.
PLAN        Replace legacy blend with the 1-frame ternary in
            beats/Progress.jsx.
DIFF        blob 8467bddfc410 (beats/Progress.jsx, new; SHA-256 8F965B9F9E3B)
COUNTER     CONFIRM (verify-independent #0233f032d, §5) — verifier sources:
            Material Design color system (m2/m1) + Apple HIG Color (accent
            sparingly, no competition); accent = only P284 occurrence of
            colors.accent; ENC-13 pipeline guard verified.
STATUS      LANDED
```

### CLAIM-motion-018 — SFX: ui/click_004.ogg at −22 dB on the highlight-settle frame

```
ASSERTION   beats/Progress.jsx fires exactly one SFX — ui/click_004.ogg
            (vendored, exists at public/sfx/ui/click_004.ogg) at
            dbToVolume(−22) = 10^(−22/20) ≈ 0.0794 — on the highlight
            bar's settle frame (highlightStart + 24), i.e. the frame the
            visual lands (E4.3, never on the word). One SFX per beat
            (E4.1/AUD-02).
SPEC REF    MOTION-GRAPHICS-MANUAL.md E4.1 (one SFX per beat), E4.2
            (value settle → ui/click_004.ogg −22 dB), E4.3 (fires on the
            visual-land frame); DETAIL-REFERENCE A4 §PROGRESS (highlight
            settle); CHECK-REGISTER AUD-01..04 (stage 13).
SOURCES     [1] MOTION-GRAPHICS-MANUAL.md E4.1/E4.2/E4.3 — the click
            mapping and the −22 dB gain.
            [2] FIRST-PARTY live: compositions/motion-graphics.jsx:282-289
            (Sfx = Sequence + Audio + staticFile, dbToVolume :116) and
            :821-827 (legacy click at start_hl+24, db −22) — the exact
            mechanism and timing precedent.
            [3] FIRST-PARTY live: public/sfx/ui/click_004.ogg exists
            (Test-Path True this session).
RE-VERIFIED YES — file present; gain formula matches the live renderer;
            timing = highlight settle (start+24), same as legacy.
CURRENT     Legacy ProgressScene renders <Sfx file="sfx/ui/click_004.ogg"
            at={start_hl+24} db={-22}/> (mg.jsx:821-827).
DELTA       None beyond moving the Sfx into the beat (the beat owns its
            motion + the sound on it).
PLAN        Replace legacy inline Sfx with the beat's own Sequence/Audio
            (staticFile path identical).
DIFF        blob 8467bddfc410 (beats/Progress.jsx, new; SHA-256 8F965B9F9E3B)
COUNTER     CONFIRM (verify-independent #0233ef81a, §5) — verifier sources:
            remotion.dev/docs/sequence + using-audio + media/audio +
            SoundSpool/bgmzipapp (SFX on visual-land frame); file present +
            sfx-manifest.json:172-176 (Kenney CC0); volume arithmetic
            re-derived 10^(−1.1) ≈ 0.0794.
STATUS      LANDED
```

### CLAIM-motion-019 — Geometry honesty: consumes only compiled chart geometry, §8.3-clean

```
ASSERTION   beats/Progress.jsx contains ZERO raw layout coordinates —
            every position/width derives from the compiled chart object
            (chart.axisY, chart.barAreaTop, chart.gridX, bar.x, bar.w,
            bar.h, chart.gutters, chart.highlightIndex), exactly like
            Chart.jsx. Its only numeric literals are frame counts
            (LAYOUT-SYSTEM §8.3: "nothing but frame counts") plus the
            six MANUAL-derived primitive constants mirrored from
            Chart.jsx (BASELINE_STROKE 4, STROKE 2, GRID_OPACITY 0.3,
            VALUE_GAP 8, BAR_LABEL_TOP 16, BAR_RADIUS 8 — values taken
            verbatim from the static primitive, not invented; the axis
            label uses Chart.jsx's AXIS_LABEL_GAP 12 with the same
            right:calc(100%+12px) placement). RISE offset 24 comes from
            Layer.jsx D2.2.
SPEC REF    LAYOUT-SYSTEM.md §8.3 (no bare integers in beats/ except
            frame counts); MANUAL A5.3 (radius set), E3.5 (axis labels
            adjacent), ENC-14 (VALUE_GAP ≤ 24).
SOURCES     [1] LAYOUT-SYSTEM.md §8.3 — the rule.
            [2] FIRST-PARTY live: primitives/Chart.jsx:48-67 — the six
            constant values mirrored (verbatim read this session).
            [3] FIRST-PARTY live: compile.js:191-244 chartRect — the
            compiled contract consumed (axisY/gridX/barAreaTop/bar.w/
            bar.h/highlightIndex/gutters/axisLabelRight).
RE-VERIFIED YES — mirror values read verbatim from Chart.jsx:48-67.
            Mirror rationale: Chart.jsx does not export these (and is
            another lane's file); §8.3's intent — no MAGIC layout
            coordinates in beats — is honoured (grep-able: no 48/88/432/
            896/840/1920-style literals anywhere in the file).
CURRENT     beats/ absent; legacy ProgressScene hardcodes plotLeft 96,
            plotRight 840, baselineY 880, maxBarH 400 (mg.jsx:715-721).
DELTA       Raw coordinates deleted from the chart motion path entirely.
PLAN        Replace legacy absolute geometry with compiled-only reads in
            beats/Progress.jsx.
DIFF        blob 8467bddfc410 (beats/Progress.jsx, new; SHA-256 8F965B9F9E3B)
COUNTER     CONFIRM (verify-independent #023390279, §5) — verifier sources:
            LAYOUT-SYSTEM §8.3 (:712-714) + Chart.jsx:48-67 + Layer.jsx:69/76
            + Remotion spring source; every code literal enumerated and
            traced (frame counts / mirrored constants / table constants);
            zero raw coordinates. Minor nits (non-fatal): chart.gutters
            listed in claim but never read; GRID_LINES is a 7th mirrored
            constant.
STATUS      LANDED
```

### CLAIM-motion-020 — Tier-2 probe: compiled == rendered within ±2px; L8/L9/L10 hold in the DOM

```
ASSERTION   The Tier-2 probe (data/audit/8/progress-probe.mjs +
            _progress-entry.jsx, pattern data/audit/7) compiles a real
            PROGRESS beat (fromBeats → validateShotSpecs → compile) and
            renders its 5 compiled layers through Layer.jsx with the
            chart layer's content = beats/Progress.jsx in the REAL render
            engine. Gates: G1 every compiled Layer rect measures within
            ±2 px at settled frames (60, 75); G2 zero safe-rect
            crossings; G3 zero sibling flex; G4 the chart interior holds
            the stage-8 gate in the DOM at rest — bar bottoms == axis
            (L8), gutters equal (L9), axis-label right edge 12 px from
            the plot left (L10), exactly one accent fill per chart (L7);
            G5 the counter is format-stable (raised floor keeps the
            formatted length constant; separators visible on 4-digit
            values; rest text == Chart.jsx fmtValue). Evidence frames
            prove the motion branches fire: construction order in flight
            (frame 9), grow stagger + overshoot + counter clamp in flight
            (frame 20), 1-frame accent switch (frames 36→37).
SPEC REF    LAYOUT-SYSTEM.md §5.5 (Tier 2 = DOM confirmation), §8.4 step
            6 (gate: L8/L9/L10); CROSSCHECK-PROTOCOL Part 4 row 8.
SOURCES     [1] LAYOUT-SYSTEM.md §8.4 step 6 + §5.5 — the gate and the
            DOM-confirmation tier.
            [2] FIRST-PARTY precedent: data/audit/7/tier2-probe.mjs +
            _tier2-entry.jsx — the exact probe pattern (bundle →
            renderStill → onBrowserLog → relative getBoundingClientRect
            normalised by scale; G1/G2/G3; evidence frames).
            [3] FIRST-PARTY precedent: data/audit/8/frombeats-chart-gate
            .mjs — the fixture beat shape + buildInputs feeding compile.
RE-VERIFIED YES — pattern read verbatim from the stage-7 artifacts.
CURRENT     No beat probe exists; stage 7 probed Layer + primitives only.
DELTA       The stage-8 gate must be proven in the DOM, not just in the
            compiled geometry (the peer gate's Run 1 already proves the
            compiled side; this probe proves the rendered side).
PLAN        Delete: nothing (new probe). Replace with:
            data/audit/8/progress-probe.mjs + _progress-entry.jsx.
DIFF        blob f56c83b2ce24 (progress-probe.mjs, new; SHA-256 38AC4A1300C0)
            + blob 14c1ec1ab582 (_progress-entry.jsx, runtime-generated)
COUNTER     PENDING (verify-independent, dispatched §3)
STATUS      IMPLEMENTED — machine-evidenced (§4 run log).
```

---

## §2 — PHASE 2 (CHANGE) RECORD — filled after edits

| Change | Files | Diff hash (P2.5) | Claims |
|---|---|---|---|
| beats/Progress.jsx (new) | `src/skills/remotion-render/beats/Progress.jsx` | blob 8467bddfc410 (SHA-256 8F965B9F9E3B) | 014–019 |
| Tier-2 probe (new) | `data/audit/8/progress-probe.mjs`, `data/audit/8/_progress-entry.jsx` (runtime-generated) | probe blob f56c83b2ce24 (SHA-256 38AC4A1300C0); entry blob 14c1ec1ab582 | 020 |

P2.5 note: all three files are NEW (untracked, pre-stage-7 HEAD 146d4ea) —
the "diff" for each is the full blob content (git hash-object above).

P2.5 correction (020): the claim card originally read "construction order
in flight (frame 6)". The probe's EVIDENCE_FRAMES = [9, 20, 36, 37] and the
assertion actually measures frame 9 (at f6 the highlight bar's spring is at
p=0 and nothing is visibly in flight; at f9 bar0 is mid-grow at 62.3px while
bar1 is absent, gridline1 is zero, axis label opacity is 0 — the strongest
construction-order evidence). Claim text updated to match the exact bytes
judged; no component or probe change required.

P2.2 note: the claims above are the enumerable, independently verifiable
properties of ONE change (the single new component + its probe harness) —
they are not batched unrelated changes; each gets its own counter-check.

## §3 — PHASE 3 (COUNTER-CHECK) — appended after dispatch

## §4 — Observations (non-claim findings)

1. **Gridline count discrepancy (SFR-motion-5).** DETAIL-REFERENCE A4
   §PROGRESS lists gridline starts "8; 11, 14, 17 — gridlines 2–4". The
   live chart (Chart.jsx GRID_LINES = [0.25, 0.5, 0.75]; legacy
   ProgressScene gridYs = [0.25, 0.5, 0.75]) has exactly THREE gridlines.
   Stagger 3 is identical either way; implemented 8/11/14 per the live
   source. Spec doc flagged for amendment.
2. **A2.1 vs A3.1 tension resolved by A2.6.** The A2.1 example
   (`shown = Math.round(value·p)`) is unclamped; with the A3.1 15 %
   chart spring the peak p = 1.1485 reads 53 for a 47 target, which A2.6
   ("never count to a value that isn't in beat.data") forbids. The bar
   keeps its designed overshoot; the counter holds at the target.
3. **`durationInFrames` semantics (machine-confirmed).** spring() with
   durationInFrames REMAPS the natural spring to finish exactly at that
   frame (spring/index.js `durationProcessed = delayProcessed /
   (passedDurationInFrames / naturalDuration)`); without it the duration
   is emergent. The legacy growSpring's "24f" was therefore a forced
   stretch of a ζ 0.843 spring; the new ζ 0.518 spring is emergent and
   naturally lands within 0.5 % at 21f.
4. **"axis labels RISE (stagger 2)" at 16** — the compiled chart has ONE
   axis label (the unit); "stagger 2" is vestigial from a multi-label
   design. Implemented as the single unit label rising at 16.
5. **Legacy value label hovered at −56 px above the bar** (mg.jsx:786) —
   the ENC-14 failure Chart.jsx already fixed (values on the bar, ≤ 24 px
   clearance). Progress.jsx mirrors Chart.jsx's placement: value INSIDE
   the bar at VALUE_GAP 8 when final bar height ≥ 88 (MG_TYPE.value +
   2·VALUE_GAP), else 8 px above the final bar top; the growing bar rides
   up to meet it (bar bottom pinned to the axis throughout — L8 holds at
   every frame, by construction).

## §5 — COUNTER-CHECK VERDICTS — appended after dispatch

All seven claims dispatched to `verify-independent` (fresh sessions, CLAIM +
DIFF + FILES + GATES only, P3.1 — no researcher sources passed). All seven
returned CONFIRM. Verifier sources below are the ones THEY cited (P3.6).

### CLAIM-motion-014 — CONFIRM
- Verifier: remotion.dev/docs/spring (call shape `spring({frame, fps,
  config})`, mass default 1); remotion spring-utils.ts (`zeta = c/(2√(km))`);
  remotion.dev/docs/measure-spring (0.005 default threshold); remotion.dev/
  docs/interpolate (clamp + easing); MIT OCW 2.004 + Toronto Metropolitan U
  pressbooks (OS = e^(−πζ/√(1−ζ²)) = 14.9 % at ζ 0.518).
- Diff check: E3.4 order identical to Chart.jsx (P208/222/242/276→291→308→328
  vs Chart.jsx 99/111/130/158/167/181/199); baseline [0,10]; gridline 8+3i,
  10f, 25/50/75 %; axis label RISE at 16; grow tA−4+7i; counter shares the
  spring scalar; label at bar+12; 1-frame accent switch; plotH = axisY −
  barAreaTop; left = bar.x − gridX; contract fields all exist in compile.js.
- Verifier noted the two A4-draft deviations (fourth gridline start, axis
  label stagger 2) match the live chart — consistent with SFR-motion-5 + §4
  observation 4, not defects.
- Strength: strong — verifier's physics sources (MIT/TMU) differ from
  researcher's (Remotion binaries); same conclusion.

### CLAIM-motion-015 — CONFIRM
- Verifier: remotion.dev/docs/spring; repo Remotion binaries (spring-utils.js
  :35 ζ, :59-60 ζ<1 branch; measure-spring.js:11 threshold 0.005, :56-73
  settle; index.js:23 emergent duration); Wikipedia "Damping" +
  aleksandarhaber.com control-systems lecture (OS formula); repo tables
  (DETAIL-REFERENCE :156/:162/:180/:191-200/:229).
- Diff check: P278 `spring({frame: frame−start, fps, config: SPRING_CONFIG})`
  with P109 {damping:13.9, stiffness:180}; NO durationInFrames; ζ = 0.518
  recomputed; settle 21f re-simulated by hand at fps 30 (first crossing <
  0.005 at 14, +20-frame confirmation → 21); counter driven by the same p
  (P280 + P323), one spring call only.
- Nuance noted: 15 % also appears for "Standard pop"/captions in A3.1 but
  those are bezier-keyframe shapes (A3.5) — springs-with-overshoot are the
  chart grow's alone; claim's "ONE overshoot site" holds for springs.
- Strength: strong — external control-systems source + full hand re-simulation.

### CLAIM-motion-016 — CONFIRM
- Verifier: MDN Intl.NumberFormat/toLocaleString (halfExpand rounding,
  useGrouping default true, maximumFractionDigits); Unicode/ICU Rounding
  Modes (half-up = ties away from zero, matches Math.round for non-negatives);
  ECMA-402 proposal (tc39.es) on maximumFractionDigits.
- Diff check: P278-280 + P323 (same p); P154-155 raised floor
  (floor = value ≥ 10 ? 10^(digits−1) : 0); P160 fmtValue every intermediate;
  P157-159 decimal by target precision; P156 clamped at target; rest ==
  Chart.jsx fmtValue (P131-135 mirror of Chart.jsx:71-75).
- Hand-checks: 47 at p=1.1485 → 47 never 53; 12 → floor 10, 2 digits always;
  1240 → floor 1000, comma from frame 0. Probe logs confirm 12/47/1,240/850
  and the f20 clamp.
- Caveat (non-fatal): equality holds because fromBeats ENC-10 rejects v < 0
  (fromBeats.js:134-138) — negatives unreachable.
- Strength: strong — external formatting standards (MDN/ICU/ECMA-402) differ
  from researcher's (spec + repo mirror).

### CLAIM-motion-017 — CONFIRM
- Verifier: Material Design color system (m2/m1 — secondary color applied
  sparingly as accent); Apple HIG Color (apply color sparingly, key color
  must not compete).
- Diff check: P284 `bar.highlight && accentOn ? accent : surface`; P187 hard
  boolean (no blend); ACCENT_AT 24 = highlightStart+24 (P104/185/186); accent
  driven by compiled highlightIndex/highlight (compile.js:218/221), never
  value-derived — fromBeats ENC-13 throws on derivation (fromBeats.js:172-178);
  value textPrimary P318 constant; border stroke P301 constant; colors.accent
  appears ONLY at P284.
- Strength: strong — external design-system sources (Material/Apple) differ
  from researcher's (spec E3.4 + Chart.jsx mirror).

### CLAIM-motion-018 — CONFIRM
- Verifier: remotion.dev/docs/sequence (from prop), /docs/using-audio
  (Sequence+Audio delays playback), /docs/media/audio (timing cascade);
  SoundSpool + bgmzipapp.com + theproaudiofiles.com (SFX lands on the visual
  event frame).
- Diff check: single Audio at P357 inside `<Sequence from={accentAt}>` (P356);
  CLICK_FILE "sfx/ui/click_004.ogg" (P117) exists at
  public/sfx/ui/click_004.ogg + manifest (src/audio/sfx-manifest.json:172-176,
  Kenney CC0); dbToVolume(−22) = 10^(−1.1) ≈ 0.0794 (P165, matches
  mg.jsx:116-118); fires on the same frame as the accent switch (P187/P284);
  one SFX per mount (zero if no highlight bar).
- Strength: strong — external SFX-timing practice + Remotion docs differ from
  researcher's (MANUAL E4 + legacy parity).

### CLAIM-motion-019 — CONFIRM
- Verifier: LAYOUT-SYSTEM §8.3 (:712-714 — bare integer in beats/ must be a
  frame count); Chart.jsx:48-67 constant block; Layer.jsx:69/76 (E_OUT,
  RISE_OFFSET 24); DETAIL-REFERENCE A4/A2.3/A3.1; compile.js chartRect;
  mg.jsx:116-118/765; Remotion spring source (external ζ/threshold).
- Diff check: every code literal (P64-364) is a frame count, a verbatim
  Chart.jsx-mirrored constant (BAR_RADIUS 8, STROKE 2, BASELINE_STROKE 4,
  GRID_LINES [0.25,0.5,0.75], GRID_OPACITY 0.3, VALUE_GAP 8, BAR_LABEL_TOP
  16, AXIS_LABEL_GAP 12 + typography 700/800/2/1), or a table-traced constant
  (RISE_OFFSET 24, E_OUT, SPRING_CONFIG 13.9/180, DECADE 10, DRAW_END 100,
  CLICK_DB −22); ZERO raw layout coordinates (no 48/88/432/896/840/1920
  literals in code); positions only from chart fields (P182/229/281/282/297/
  320/334); right:calc(100% + 12px) character-identical to Chart.jsx:135.
- Minor imprecision (non-fatal): claim lists chart.gutters among consumed
  fields — the file never reads it (compile contract includes it; consumed
  are axisY/gridX/barAreaTop/bars/highlightIndex). Also GRID_LINES is a
  seventh mirrored constant, not one of the "six" named. Neither affects the
  predicate (zero raw coordinates; everything compiled-driven).
- Strength: strong — verifier independently enumerated every literal and
  traced each to its source; found only the two cosmetic nits above.

### CLAIM-motion-020 — CONFIRM
- Verifier: remotion.dev/docs/renderer/render-still (bundle +
  selectComposition + renderStill + onBrowserLog + puppeteerInstance);
  remotion select-composition.ts source; LAYOUT-SYSTEM §5.5/§6 (DOM probe,
  getBoundingClientRect/scale, ±2 px) and §8.4 step 6 (L8/L9/L10 gate).
- Diff check: imports resolve to real exports (fromBeats, validateShotSpecs,
  compile, lintAll/lintL7-10, SAFE_SHORTS/SLOTS_SHORTS, paletteFromHues);
  real engine renderStill at 60/75/9/20/36/37; entry maps 5 compiled layers
  through Layer.jsx with chart content = <Progress>; measurement is geometric
  (scale = rr.width/1080, deltas ±2 px gates / ±3 px evidence); gates encode
  the THREE bugs (|bottom−896|≤2, |gutter−8|≤2, |right−76|≤2 + node-side
  lintL8/9/10 + exact-JSON geometry).
- Run artifacts: f60/f75 layers d=0.00, SAFE 0.00, FLEX 0, bottoms 896==896,
  gutter 8.00, right 76=gridX−12, exactly 1 accent (bar1 rgb(210,77,71) =
  #D24D47), counters 12/47, GVALUE 850/1,240; f9 construction order in
  flight (baseline 759.91, g0 375.73, g1 0, bar0 62.31, bar1 absent, label op
  0); f20 bar1 521.13 > 464 while counter reads "47" (clamped, never "53");
  f36 surface → f37 accent (accentAt = 13 + 24 = 37). "13 passed, 0 failed"
  consistent with exactly 13 check() calls and the report() logic.
- Trivial observation (non-fatal): the claim's phrase "separators visible on
  4-digit values … '850'" is loose — "850" is 3-digit (no comma); probe's real
  intent (separator in every logged 4-digit intermediate) holds on every
  logged value.
- Strength: strong — machine artifacts (logs/PNGs) + real engine + external
  Remotion docs; the strongest pass in the set.

## §6 — SHARED-FILE REQUESTS (SFRs)

### SFR-motion-5 (Spec amendment — DETAIL-REFERENCE.md A4 §PROGRESS, gridline rows)
- **Target:** orchestrator-owned `DETAIL-REFERENCE.md` (A4 §PROGRESS, lines 226-227).
- **Before:** `| 8 | gridline 1 DRAW | 10 | E.out |` / `| 11, 14, 17 | gridlines 2–4 (stagger 3) | 10 each | E.out |`
- **After:** `| 8 | gridline 1 DRAW | 10 | E.out |` / `| 11, 14 | gridlines 2–3 (stagger 3) | 10 each | E.out |` — with a note: "the compiled chart has exactly three gridlines (25/50/75 % of the plot, Chart.jsx GRID_LINES); the earlier draft counted four starts."
- **Grounds:** the live compiled chart (primitives/Chart.jsx:55 GRID_LINES = [0.25, 0.5, 0.75]) and the legacy renderer (motion-graphics.jsx:724 gridYs = [0.25, 0.5, 0.75]) both emit exactly three gridlines; stagger 3 is preserved. No value in any table changes — the row count only.
- **Value changes?** No — timing values (8, stagger 3, 10f) unchanged.
