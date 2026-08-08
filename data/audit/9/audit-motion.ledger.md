# AUDIT-MOTION — STAGE 9 LEDGER (7 remaining archetype beat components)

**Lane:** `audit-motion` — timing, easing, springs, stagger, drag, blur
**Stage:** 9 — remaining 7 archetypes (CROSSCHECK-PROTOCOL Part 4 row 9: "Remaining 7 archetypes | `audit-encoding`, `audit-motion` | 16 compositions render as stills; C10–C13, D11–D13 pass"; shared with `audit-encoding`)
**Mission:** deliver `src/skills/remotion-render/beats/{HeroNumber,TermDefine,ListItem,Contrast,Relation,ImageBeat,Statement}.jsx` — the remaining beat components (LAYOUT-SYSTEM §8.4 step 6 build order) implementing the DETAIL-REFERENCE A4 per-archetype frame tables + MANUAL Part D/F storyboards, each consuming the compiled ShotSpec rects (headline/accent) + stage-geometry props; a Tier-2 probe rendering 16 stills (8 archetypes × 2 formats) proving geometry + motion in the DOM; counter-check every claim via `verify-independent`.
**Ownership (edit):** `src/skills/remotion-render/beats/**` (NEW files only — `Progress.jsx` untouched) + `data/audit/**`. **Not written:** `spec/**`, `primitives/**`, `layers/**`, `layout/**`, `compositions/**`, `styles/**` (read-only; see §6 SFRs).
**Status:** Phase 1 (GROUND) complete — claim cards written (9-01…9-09). Phase 2 (CHANGE) executed (7 components + probe; §2). Phase 3 (COUNTER-CHECK) dispatch 1 → **REJECT** (§5): genuine deviations on 9-04 (ListItem semantics) and 9-07 (ImageBeat push/treatment); 9-02 item 4 (settle click) unimplemented. **Re-attempt (this session):** re-entered Phase 1 (re-grounding, §3) → Phase 2 re-implemented claim 9-04 (legacy ListRunScene semantics: POP @ tA−4, shift-up 88 px drag 2 + stagger 2 over 9 f, dim 6 f, badge 6 f window, click_001 −24 dB @ tA+2, item stagger 5, max 4 visible + drop-oldest 6 f E_IN, geometry 88/760/88 from the stage prop) + claim 9-07 (radius 24, saturate 0.35, 12 % tint, fade tA−4 + scale 1.05, spring push 1.05→1.00, credit riseStyle) + claim 9-02 item 4 (click_004 −22 dB @ tA+56); claim card 9-04 item (3) corrected to the A4 numbers (9 f / drag 2 / stagger 2 / dim 6); probe gates re-calibrated (G6a/b/c + image-push) → probe re-run **ALL GATES GREEN 34/34 + 6/6**; lint 38/0. Phase 3 re-dispatch (re-attempt 1 of 2, P3.5) → **3× CONFIRM** (§5) — the re-implemented claims 9-02/9-04/9-07 are independently verified against the live spec + legacy; the two evidence-writeup inaccuracies the verifiers flagged were corrected in §2 (no code or claim-item change). Stage-9 motion lane: **gate-ready** (probe 36/36 + 6/6, lint 38/0, 3× CONFIRM).

---

## §0 — Current state snapshot (pre-edit, all re-read this session)

| Item | Value |
|---|---|
| Repo HEAD | `65e90fc90f64abb53e73237ded5984d403c7cd59` (stage-8 commit) |
| Working tree | NOT clean: `spec/fromBeats.js` **M** (+233/−39 — the peer lane's in-flight stage-9 change: accent-rule policy CLAIM-ENC-9-02 + ENC-01..18 gates); `data/audit/9/` untracked |
| Peer gate (fresh this session) | `node data/audit/9/frombeats-archetype-gate.mjs` → **119 passed, 0 failed**; Run 5 documents the 5 stage-8-gate FAILs as expected divergence (§0.3 of the peer ledger) |
| `beats/` | contains ONLY `Progress.jsx` (stage-8, 358 lines) — the 7 new files absent |
| Contract (fresh `contract-probe.mjs` this session, against the CURRENT fromBeats.js) | see §0.2 table |
| Lint | `layout/run-lint.js` **38/0** (peer gate Run 6, this session). L7 archetype-blind: compiled frames for HERO_NUMBER/CONTRAST/RELATION/LIST_ITEM/IMAGE_BEAT/STATEMENT report "0 accent elements" — expected divergence (peer SFR-ENC-9-1, manual accent map CLAIM-ENC-9-02) |
| Primitives (read-only, ESC-LAY-7-1 carried) | `Node.jsx` (NODE_RADIUS 44, NODE_STROKE 3), `Chip.jsx` (CHIP_RADIUS 16, CHIP_BORDER 2, CHIP_PAD {16,24}, CHIP_GAP 24), `Chart.jsx`, `Rule.jsx`, `Panel.jsx`, `Icon.jsx` — all exist |
| Legacy scenes (read, superseded by this stage) | `compositions/motion-graphics.jsx`: HeroNumberScene 582, TermDefineScene 612, ContrastScene 632, ProgressScene 708 (stage 8 done), RelationScene 835, StatementScene 926, ImageBeatScene 945, StageScene 993, ListRunScene 1016; helpers: ease 64, easeScale 72, popStyle 82, riseStyle 91, stageExitStyle 99, growSpring 107, formatCounter 121, fmtValue 127, Sfx 282, Icon 304, TraceIcon 323, Centered 562; `mixColor` in mg-style.js:56 |
| `compositions/beats.js` (read) | FPS 30; D {micro:4, short:6, base:9, large:12, complex:15, push:60, hold:45}; MG_TYPE {hero:220, headline:84, body:52, support:44, kicker:28}; MAX_WORDS_PER_BEAT 7; MAX_BEAT_FRAMES 96 |
| `layout/slots.js` (read, full) | GRID {8,12,56,8,40}; SAFE_SHORTS {288,1248,48,888}; SAFE_LONGFORM {100,980,160,1760}; SLOTS_SHORTS: kicker {48,288,840,72}, stage {48,392,840,548}, headline {48,964,840,176}, caption {88,1152,760,96}, rail {48,288,4,960}; SLOTS_LONGFORM: kicker {160,100,1600,72}, stage {160,196,1600,560}, headline {160,780,1600,144}, caption {456,884,1008,96}, rail {160,100,4,824} |
| Stage-8 probe pattern (read) | `data/audit/8/progress-probe.mjs` + runtime-generated `_progress-entry.jsx` (bundle → renderStill → onBrowserLog → getBoundingClientRect normalised by scale; entry maps compiled RECTS through Layer with role-switch content) |

### §0.1 — Sources of record (Phase 1, all live this session)

First-party / machine: live repo files (fromBeats.js [peer-modified], schema.js, compile.js, compile-lint.js, lint.js, run-lint.js, slots.js, beats.js, motion-graphics.jsx, mg-style.js, Progress.jsx, Layer.jsx, primitives/*, verify-compositions.js, Root.jsx-era registrations); fresh runs of `contract-probe.mjs` + `frombeats-archetype-gate.mjs` (119/0); stage-8 artifacts (GATE.md, progress-probe.mjs, _progress-entry.jsx, frombeats-chart-gate.mjs, audit-motion.ledger.md, audit-encoding.ledger.md); peer stage-9 ledger (audit-encoding.ledger.md).
Third-party / spec: the five spec docs (MOTION-GRAPHICS-MANUAL.md, DETAIL-REFERENCE.md, LAYOUT-SYSTEM.md, FINISH-SPEC.md [absent from repo], CHECK-REGISTER.md) as inputs-to-verify; CROSSCHECK-PROTOCOL.md.

### §0.2 — Contract (fresh contract-probe output, this session, CURRENT fromBeats.js)

All 8 archetypes: kicker RISE@0 `{index,label}`; rail NONE persistent structural (rect {48,288} 4×960); caption RISE@0 (rect {88,1104} 760×144 fs64 Shorts).

| Archetype | Headline layer (enter / exit / content / rect) | Accent rule | Stage-slot layer |
|---|---|---|---|
| HERO_NUMBER | RISE@"anchor+8" / FADE@"end-6" / `{"text":"%"}` (unit) / {48,1004} 48×96 fs84 | none | none (numeral is peer-lane stage content) |
| TERM_DEFINE | RISE@"anchor+0" / FADE@"end-6" / term ("Inflation is a" scene-less fallback) / {48,1004} 704×96 fs84 | YES — DRAW@"anchor+6" / FADE@"end-6", rect {48,1100} 704×4 structural | none (icon peer-lane) |
| LIST_ITEM | **no headline layer** (honest omit) | none | none (chips peer-lane) |
| RELATION | RISE@"anchor+18" / FADE@"end-6" / relation phrase ("drives inflation") / {48,1004} 808×96 fs84 | none | none (nodes peer-lane) |
| CONTRAST | RISE@"anchor+0" / FADE@"end-6" / consequence ("12 percent now" scene-less fallback) / {48,1004} 704×96 fs84 | none | none (panels peer-lane) |
| STATEMENT | RISE@"anchor+0" / FADE@"end-6" / subject ("because every" scene-less fallback) / {48,1004} 656×96 fs84 | none | none (icon peer-lane) |
| IMAGE_BEAT | RISE@"anchor+6" / FADE@"end-6" / subject ("dam holds back a") / {48,1004} 808×96 fs84 | none | none (image peer-lane) |
| PROGRESS | RISE@"anchor+8" / FADE@"end-6" / (stage-8 done) | none | chart CHART_BUILD@0 rect {88,432} 760×464 |

Fixture shapes WITHOUT `scene.headline` produce anchor-phrase fallbacks; production (`deriveScene` in mg-package.js) sets `scene.headline` = unit/term/consequence/subject. **No archetype emits counter/badge/chip spec layers** — ENC-16 holds structurally (only PROGRESS carries one stage-slot layer). ListItem caption rect {372,1176} 192×72 = first item text ("Alpha").

---

## §1 — PHASE 1 CLAIM CARDS

### CLAIM-MOT-9-01 — Component architecture + wiring contract (all 7 components)

```
ASSERTION   The 7 new components live in src/skills/remotion-render/beats/
            and are mounted by the WIRING (orchestrator-owned, patterned
            on the stage-8 _progress-entry.jsx:78-85: RECTS.map → <Layer
            rect enter exit> → role-switch content) which renders the
            persistent rects (kicker/rail/caption) as Layer + plain text
            and mounts the beat component for archetype-specific content.
            Component contract (each component):
              props = { rects: { headline?, accent? }, stage, colors,
                        anchorFrame, frame, durationInFrames,
                        ...archetypeProps }
            rects = the COMPILED rect objects (role/slot/enter/exit/
            x/y/w/h/from/to/text/fontSize/chart…); stage = the compiled
            stage-slot rect passed by the wiring (SLOTS_SHORTS.stage
            {48,392,840,548} / SLOTS_LONGFORM.stage {160,196,1600,560})
            — NEVER hardcoded; colors = channel palette; anchorFrame =
            LOCAL anchor frame (beat.anchorFrame − beat.startFrame, the
            same value compile.js consumes); frame = useCurrentFrame()
            local. Components import layers/Layer.jsx for their compiled
            headline/accent rects (Layer is read-only; "DRAW/GROW/TRACE
            interior motion is owned by the primitive/beat" D2.4/D2.5)
            and draw peer-lane stage content inside the stage rect prop.
            ArchetypeProps handshake: value+unit (HeroNumber), icon
            (TermDefine/Statement), items (ListItem — from beat.data.
            items, not carried by the spec: caption carries only the
            first item), leftText/rightText (Contrast), left/right/
            relation (Relation), src+credit (ImageBeat).
SPEC REF    LAYOUT-SYSTEM.md §8.4 step 6 (build order line 726), §8.3
            (no bare ints except frame counts), D2.4/D2.5; stage-8
            _progress-entry.jsx (wiring pattern); beats/Progress.jsx
            (precedent: consumes compiled-only).
SOURCES     [1] stage-8 artifacts: _progress-entry.jsx:11-20 contentFor
            role switch + :78-85 Layer mount — the wiring pattern.
            [2] FIRST-PARTY live: beats/Progress.jsx header — the
            precedent contract (chart={rect.chart} colors unit
            anchorFrame frame).
            [3] FIRST-PARTY live: layers/Layer.jsx — positioning-only.
            [4] FIRST-PARTY live: contract-probe output (§0.2) — the
            compiled rects each component consumes.
RE-VERIFIED YES. Decided in-phase: stage content (F1 numeral / F2 icon /
            F3 chips+badge / F4 panels+divider+key / F6 nodes+connector /
            F7 image / F8 icon) has NO compiled rect for any non-PROGRESS
            archetype (contract-probe) — the component draws it inside
            the stage prop. Counter/badge/chip spec layers definitively
            DO NOT exist (ENC-16 structurally ≤1 stage-slot layer).
CURRENT     beats/ has only Progress.jsx; production wiring (Root.jsx)
            still mounts the legacy motion-graphics scenes.
DELTA       7 new components + probe wiring; components are self-
            contained (given the props, they render identically in any
            wiring).
PLAN        Delete: nothing (new files). Replace: nothing pre-existing.
DIFF        PENDING (Phase 2)
COUNTER     PENDING (Phase 3)
STATUS      PENDING
```

### CLAIM-MOT-9-02 — HeroNumber: numeral count-up + unit headline + settle click

```
ASSERTION   beats/HeroNumber.jsx renders: (1) the numeral at the stage
            centre (stage.x + stage.w/2, stage.y + stage.h/2), MG_TYPE
            hero, tabular-nums, colors.accent — opacity 0→1 over 6 f
            E_OUT and scale 0.92→1.00 over 9 f E_OUT (perceptual, A4
            HERO_NUMBER rows), both starting tA−4; (2) the counter driven
            from a raised floor (A2.3: floor = 10^(digits−1) for value
            ≥ 10 else 0) 0→value over D.push (60 f) E_OUT — same-scalar
            pattern as Progress.jsx (A2.1), clamped at beat.data (A2.6,
            never past the target), thousands separators from frame 0
            (A2.4), rest text == Chart.jsx fmtValue; value lands at
            tA+56 (F1 "tA−4→tA+56 counter 0→value E.out over D.push");
            (3) the unit label in the compiled headline rect via Layer
            (RISE@"anchor+8" / FADE@"end-6" — compiled, F1 "unit/what
            it measures TYPE.headline textPrimary"); (4) exactly one
            SFX ui/click_004.ogg at dbToVolume(−22) on the settle frame
            tA+56 (F1 E4.2); (5) hold begins tA+67 (A4 HERO_NUMBER last
            row) — before/after pixel-identical (C17).
SPEC REF    MOTION-GRAPHICS-MANUAL.md F1 (971-989), E4.1/E4.2;
            DETAIL-REFERENCE.md A4 HERO_NUMBER rows; A2.1-A2.6.
SOURCES     [1] FIRST-PARTY live: motion-graphics.jsx HeroNumberScene
            582-611 — legacy numeral/counter/Sfx (click_004 −22 dB at
            start+D.push) + formatCounter (pads, commas).
            [2] FIRST-PARTY live: beats/Progress.jsx — the A2 counter
            pattern (same scalar, raised floor, clamp, separators) this
            component mirrors.
            [3] FIRST-PARTY live: contract-probe — headline rect
            {48,1004} 48×96 fs84 RISE@"anchor+8"; no accent rule.
RE-VERIFIED YES — with one spec conflict: A4 HERO_NUMBER lists "unit
            label RISE tA+2" AND "headline RISE tA+58 (drag 12 from
            settle)"; the compiled contract emits ONE headline rect
            entering RISE@"anchor+8" (peer CLAIM-ENC-9-03 table:
            HERO_NUMBER 8). Compiled wins → SFR-MOT-9-2.
CURRENT     Legacy HeroNumberScene: numeral at (468,666) TYPE.hero
            accent; counter ease(frame−(tA−D.micro), [0,D.push], [0,1])
            × scene.value; click_004 −22 dB at start+D.push.
DELTA       Geometry from stage prop (no 468/666 literals); A4 scale
            0.92→1.00 replaces the legacy popStyle 0→1.15; A2 raised
            floor; Layer-driven headline rect.
PLAN        Delete: nothing. Replace: legacy scene semantics moved into
            beats/HeroNumber.jsx on compiled rects + stage prop.
DIFF        PENDING (Phase 2)
COUNTER     PENDING (Phase 3)
STATUS      PENDING
```

### CLAIM-MOT-9-03 — TermDefine: icon POP + term RISE + rule DRAW under the term

```
ASSERTION   beats/TermDefine.jsx renders: (1) a 180 px STROKE icon
            (TraceIcon/Icon, colors.stroke — F2 "icon is stroke not
            accent") centred in the stage, POP at tA−4 (popStyle:
            opacity [0,3]→[0,1], scale [0,5,9]→[0,1.15,1] perceptual
            E_OUT — A4 "tA−4 icon POP 9"); (2) the term in the compiled
            headline rect via Layer (RISE@"anchor+0" / FADE@"end-6" —
            F2 "tA term RISE 9"); (3) the compiled 4 px accent rule
            (rect w = measured term width, structural) DRAW left→right
            — scaleX 0→1, transformOrigin left — from tA+6 over 14 f
            E_OUT (F2 "tA+6 rule DRAW 14 frames left-to-right width =
            measured term width"; A4 "tA+6 rule DRAW under term (drag
            6) 14"); (4) hold begins tA+20 (A4) — C17 pixel-identical;
            (5) NO SFX (F1/F2 assign clicks only to HERO_NUMBER settle
            and LIST_ITEM chip).
SPEC REF    MOTION-GRAPHICS-MANUAL.md F2 (991-1008); DETAIL-REFERENCE
            A4 TERM_DEFINE rows; L7 (rule = the ONE accent).
SOURCES     [1] FIRST-PARTY live: motion-graphics.jsx TermDefineScene
            612-631 — legacy icon 180 at (468,600) popStyle + TraceIcon
            / Icon, stroke colour.
            [2] FIRST-PARTY live: contract-probe — headline rect
            {48,1004} 704×96 RISE@"anchor+0"; accent rect {48,1100}
            704×4 DRAW@"anchor+6" FADE@"end-6" structural.
            [3] SPEC: F2 storyboard rows + A4 table (both agree:
            term@tA, rule@tA+6, 14 f draw).
RE-VERIFIED YES — A4 and F2 agree exactly (term RISE tA, rule DRAW
            tA+6 14 f, icon POP tA−4); no conflict to arbitrate.
CURRENT     Legacy TermDefineScene: icon POP at start = tA−D.micro;
            headline riseStyle; accent = 4 px rule below the term.
DELTA       Rule as the compiled accent rect (scaleX from the rect);
            icon geometry from stage prop.
PLAN        Delete: nothing. Replace: legacy scene semantics moved into
            beats/TermDefine.jsx.
DIFF        PENDING (Phase 2)
COUNTER     PENDING (Phase 3)
STATUS      PENDING
```

### CLAIM-MOT-9-04 — ListItem: chip run — accumulate, shift up 88, badge, drop-oldest

```
ASSERTION   beats/ListItem.jsx renders the run: (1) up to 4 chips
            stacked in the stage, bottom-anchored at stage bottom
            (stage.y + stage.h = 940 Shorts), pitch 88, height 88,
            left = stage.x + 40 = caption.x (88), width = caption.w
            (760) — each chip = Chip primitive (radius 16, surface,
            2 px stroke, padding 24, gap 24) with a 48×48 circle badge
            (radius 24, transparent fill, 3 px stroke, number k+1 at
            MG_TYPE.label) and the item text (beat.scene.item ||
            beat.text, MG_TYPE.body, weight 700); (2) new chip POP at
            tA−D.micro (tA−4) — A4/F3 "tA−4 new chip POP"; (3) prior
            chips translate up 88 px over 9 f E_OUT with drag 2 and a 2 f stagger per chip up the stack — the chip directly above the newcomer moves first (A4 row 3 “translate up 88 px (drag 2) | 9, stagger 2”); the ITEM entrance stagger is 5 f (A4 “Stagger 5 for the items themselves (0.56 ratio on a 9 f entrance), replacing the manual’s 6”) — fixture anchors 10/15/20/25/30 give entrances every 5 f. Text flips textPrimary→textDim over 6 f (A4 row 4)
            (F3 "dim to textDim"); (4) badge accent during [tA, tA+6)
            then 3 px stroke (F3/A4 6 f window; legacy 8 f superseded);
            (5) exactly one SFX per new chip ui/click_001.ogg at
            dbToVolume(−24) on tA+2 (F3); (6) a 5th chip drops the
            OLDEST with a 6 f E_IN fade + translateY −12 (stageExitStyle
            — legacy dropOpacity E_IN); (7) hold = end−6.
SPEC REF    MOTION-GRAPHICS-MANUAL.md F3 (1009-1029); DETAIL-REFERENCE
            A4 LIST_ITEM rows (stagger 5 / badge 6 f); L7 (chip badge =
            the ONE accent, peer map).
SOURCES     [1] FIRST-PARTY live: motion-graphics.jsx ListRunScene
            1016-1064 — legacy chips left 88 width 760 height 88;
            shiftBase = 940 − (lastArrived−1−k)·88; shiftProg ease
            [0,5] E_OUT; dimProg same; dropOpacity ease [0,6] [1,0]
            E_IN; badge 48×48 circle number k+1 TYPE.label; accent
            [tA, tA+8) legacy (6 per A4); click_001 −24 dB at tA+2.
            [2] FIRST-PARTY live: primitives/Chip.jsx — the chip
            contract (radius 16, 2 px stroke, padding 16×24, gap 24,
            active → accent border + label tint).
            [3] FIRST-PARTY live: contract-probe — LIST_ITEM has NO
            headline layer and NO stage-slot layer; caption rect
            {372,1176} 192×72 = first item.
RE-VERIFIED YES — A4 "Stagger 5… replacing the manual's 6" explicitly
            supersedes the manual's item stagger; badge window 6 f
            (A4/F3) supersedes legacy 8 f. Items array is NOT carried
            by the spec (caption = first item only) → wiring passes
            items via the 9-01 handshake (peer SFR-ENC-9-4).
CURRENT     Legacy ListRunScene: absolute 88/940/760/88 literals; badge
            accent 8 f; item stagger D.micro (4 f).
DELTA       Geometry from stage/caption props; stagger 5; badge 6 f;
            Chip primitive; Layer-rendered kicker/caption handled by
            the wiring (component renders chips only).
PLAN        Delete: nothing. Replace: legacy ListRunScene semantics
            moved into beats/ListItem.jsx.
DIFF        PENDING (Phase 2)
COUNTER     PENDING (Phase 3)
STATUS      PENDING
```

### CLAIM-MOT-9-05 — Contrast: dim/raised panels + divider DRAW + key word accent

```
ASSERTION   beats/Contrast.jsx renders: (1) left panel (the "before"
            side, colors.textDim) present from frame 0; right panel
            (the "after" side, colors.textPrimary) POP at tA−4 (scale
            0.92→1.00 over 9 f perceptual E_OUT — mirror of the
            numeral entry); panels are stage halves: width
            (stage.w − 24)/2, left panel at stage.x, right panel at
            stage.x + (stage.w + 24)/2, panel top = stage.y + 128,
            height 340 (legacy {48,520,412,340}/{480,520,408,340}
            derives from stage {48,392,840,548} — 520 = 392+128, 48 =
            stage.x, 480 = 468+12 centre+half-gap, 408 = (840−24)/2);
            (2) a 4 px divider at the stage centre x (468) DRAW
            top→bottom from tA−6 over 12 f (D.large) E_OUT (F4 divider;
            legacy div y 520→860 over D.large); (3) the right panel's
            FIRST word in colors.accent from tA+4 (F4 "key element" —
            CONTRAST's ONE accent, peer map; legacy after[0] accent,
            rest textPrimary); (4) the consequence phrase in the
            compiled headline rect via Layer (RISE@"anchor+0" /
            FADE@"end-6" — CLAIM-ENC-9-03: CONTRAST 0); (5) hold =
            end−6.
SPEC REF    MOTION-GRAPHICS-MANUAL.md F4 (1030-1047); DETAIL-REFERENCE
            A4 CONTRAST (headline tA); L7 (key word = the ONE accent).
SOURCES     [1] FIRST-PARTY live: motion-graphics.jsx ContrastScene
            632-707 — left panel textDim from 0; right panel textPrimary
            POP; divider x=468 4 px top→bottom; after[0] accent at tA+4.
            [2] FIRST-PARTY live: contract-probe — CONTRAST headline
            RISE@"anchor+0"; no accent rule (key word is peer-lane).
            [3] SPEC: F4 + peer CLAIM-ENC-9-03 (headline delay 0).
RE-VERIFIED YES. Note: the consequence-phrase headline content is
            producer-gapped upstream (scene-less fixtures yield the
            anchor-phrase fallback "12 percent now") — peer SFR-ENC-9-4;
            fixture-level: scene.headline = the consequence phrase.
CURRENT     Legacy ContrastScene: absolute {48,520,412,340} /
            {480,520,408,340} / divider 468.
DELTA       Panels/divider geometry derived from the stage prop;
            headline via Layer.
PLAN        Delete: nothing. Replace: legacy ContrastScene semantics
            moved into beats/Contrast.jsx.
DIFF        PENDING (Phase 2)
COUNTER     PENDING (Phase 3)
STATUS      PENDING
```

### CLAIM-MOT-9-06 — Relation: node A + node B + connector DRAW; NO accent element

```
ASSERTION   beats/Relation.jsx renders: (1) node A — Node primitive
            (88×88 circle, NODE_RADIUS 44, surface fill, 3 px stroke)
            at (stage.left + 200, stage centre y), POP at frame 0
            (A4 "0 node A POP (or carried) 9"); (2) node B at
            (stage.right − 200, stage centre y), POP at tA−4 (A4);
            (3) a 4 px stroke connector A→B, DRAW (evolvePath 0→1)
            from tA+4 over 14 f E_OUT (F6 "tA+4 connector DRAW 14
            frames from A to B"; legacy connStart = tA+D.micro; A4 row
            "tA connector DRAW (drag 4) 14" conflicts on the start —
            F6 + live legacy agree → SFR-MOT-9-3); (4) node labels
            under the nodes: A label colors.textDim with opacity ease
            from frame 0; B label colors.textPrimary riseStyle at
            bStart+6 (legacy; F6 "node labels under nodes"); (5) NO
            accent element — F6 declares none (peer map CLAIM-ENC-9-02:
            RELATION none; the legacy bAccent border flip is
            superseded); (6) the relation headline in the compiled
            headline rect via Layer (RISE@"anchor+18" / FADE@"end-6" —
            compiled + peer CLAIM-ENC-9-03: RELATION 18; A4's tA+14
            row conflicts → SFR-MOT-9-3); (7) hold begins tA+23 (A4) —
            C17 pixel-identical.
SPEC REF    MOTION-GRAPHICS-MANUAL.md F6 (1065-1082); DETAIL-REFERENCE
            A4 RELATION rows; L7 (no accent element — SFR-ENC-9-1).
SOURCES     [1] FIRST-PARTY live: motion-graphics.jsx RelationScene
            835-925 — node A circle (248−44, 666−44) 88×88 surface
            3 px stroke POP 0; node B (688−44, 666−44) POP tA−4;
            connector DRAW at connStart = tA+D.micro over D.large (12);
            labels under nodes (A textDim, B textPrimary riseStyle
            bStart+6); legacy bAccent flip (superseded).
            [2] FIRST-PARTY live: primitives/Node.jsx — node contract.
            [3] FIRST-PARTY live: contract-probe — RELATION headline
            RISE@"anchor+18" rect {48,1004} 808×96; no accent rule.
RE-VERIFIED YES — two spec conflicts arbitrated: headline 18 (compiled
            + F6) vs A4 tA+14; connector start tA+4 (F6 + legacy) vs
            A4 tA. Both → SFR-MOT-9-3.
CURRENT     Legacy RelationScene: absolute 248/688/666 geometry;
            connector 12 f (D.large); bAccent border flip present.
DELTA       Geometry from stage prop (nodes inset 200); connector
            14 f at tA+4; NO accent element.
PLAN        Delete: nothing. Replace: legacy RelationScene semantics
            moved into beats/Relation.jsx.
DIFF        PENDING (Phase 2)
COUNTER     PENDING (Phase 3)
STATUS      PENDING
```

### CLAIM-MOT-9-07 — ImageBeat: full-stage image, desaturate + tint, slow push, credit

```
ASSERTION   beats/ImageBeat.jsx renders: (1) the image filling the stage
            rect EXACTLY (48,392,840,548 Shorts — the stage slot IS the
            image slot), radius 24, overflow hidden, a plain <img> with objectFit cover (legacy ImageBeatScene uses plain <img> — motion-graphics.jsx:945-992, NOT Remotion’s <Img>, which throws on load failure) with filter saturate(0.35) + an accent overlay at 0.12 opacity (F7 "image treated stylistically": desaturated,
            tinted — peer map IMAGE_BEAT: none per F7); (2) fade 9 f
            + scale 1.05 at tA−4 (A4/F7 "fade 9 f tA−4"; legacy fade 9 f
            tA−4); (3) push 1.05→1.00 over D.push via spring
            {damping: 200} (legacy: scale 1.05 − push·0.05, Easing.spring
            damping 200); (4) a credit line 32 px colors.textDim at the
            stage bottom-left corner (stage.x + 8, stage.y + stage.h −
            34 — derived from the stage prop, legacy (56,906)) with
            riseStyle at start+D.short; (5) the subject headline in the
            compiled headline rect via Layer (RISE@"anchor+6" /
            FADE@"end-6" — F7 + compiled); (6) NO accent element (F7
            none; the accent overlay is a tint, not an accent element —
            A5.2-compliant, no shadows/gradients); (7) hold = end−6.
SPEC REF    MOTION-GRAPHICS-MANUAL.md F7 (1083-1097); DETAIL-REFERENCE
            A4 IMAGE_BEAT; ENC-18 (≤20 % of beats); L7.
SOURCES     [1] FIRST-PARTY live: motion-graphics.jsx ImageBeatScene
            945-992 — image fills {48,392,840,548} THE stage slot,
            radius 24, overflow hidden, opacity fade 9 f tA−4, scale
            1.05 − push·0.05 transformOrigin center, cover +
            saturate(0.35), accent overlay 0.12, credit (56,906)
            textDim riseStyle start+short.
            [2] FIRST-PARTY live: contract-probe — IMAGE_BEAT headline
            RISE@"anchor+6"; no accent rule.
            [3] FIRST-PARTY live: verify-compositions.js:233-237 — the
            carried IMAGE_BEAT stddev check (stage region must show
            photo variance) that this component must satisfy.
RE-VERIFIED YES. Fixture rule (peer F-2): the headline must stay ≤ 13
            chars (17-char "THE ALAMEDA COURT" wrapped and was rejected
            by the compile one-line rule §3.7/§5.3; production fixtures
            use "ALAMEDA COURT").
CURRENT     Legacy ImageBeatScene: absolute {48,392,840,548} /
            (56,906); the live pipeline check (verify-compositions)
            validates stddev > 18 in the stage region.
DELTA       Geometry from the stage prop; credit anchored to the stage
            corner; headline via Layer.
PLAN        Delete: nothing. Replace: legacy ImageBeatScene semantics
            moved into beats/ImageBeat.jsx.
DIFF        PENDING (Phase 2)
COUNTER     PENDING (Phase 3)
STATUS      PENDING
```

### CLAIM-MOT-9-08 — Statement: single icon + subject headline; no accent

```
ASSERTION   beats/Statement.jsx renders: (1) a 120 px STROKE icon
            (TraceIcon/Icon, colors.stroke) centred in the stage, POP
            at tA−4 (popStyle, A4/F8 "tA−4 icon POP"); (2) the subject
            headline in the compiled headline rect via Layer
            (RISE@"anchor+0" / FADE@"end-6" — F8 + compiled,
            CLAIM-ENC-9-03: STATEMENT 0); (3) NO accent element (F8
            none; peer map STATEMENT: none); (4) hold = end−6. The
            component is the smallest of the seven (icon + headline).
SPEC REF    MOTION-GRAPHICS-MANUAL.md F8 (1098-1106); DETAIL-REFERENCE
            A4 STATEMENT; ENC-01 (STATEMENT ≤ 30 % — enforced upstream
            in fromBeats, peer gate Run 2).
SOURCES     [1] FIRST-PARTY live: motion-graphics.jsx StatementScene
            926-944 — icon 120 at (468,600) POP tA−4; headline riseStyle
            tA.
            [2] FIRST-PARTY live: contract-probe — STATEMENT headline
            RISE@"anchor+0"; no accent rule.
RE-VERIFIED YES — F8 and compiled contract agree (headline tA).
CURRENT     Legacy StatementScene: absolute (468,600); headline rise.
DELTA       Icon geometry from the stage prop; headline via Layer.
PLAN        Delete: nothing. Replace: legacy StatementScene semantics
            moved into beats/Statement.jsx.
DIFF        PENDING (Phase 2)
COUNTER     PENDING (Phase 3)
STATUS      PENDING
```

### CLAIM-MOT-9-09 — Tier-2 probe: 16 stills (8 archetypes × 2 formats), DOM gates, motion evidence

```
ASSERTION   The stage-9 probe (data/audit/9/stage9-probe.mjs +
            runtime-generated _stage9-entry.jsx, pattern data/audit/8/
            progress-probe.mjs + _progress-entry.jsx) compiles 8
            production-shaped fixture beats (wordTokens, data, scene.
            headline for real text; IMAGE_BEAT headline ≤ 13 chars;
            LIST_ITEM items of 5 to exercise the drop; HERO value 47;
            PROGRESS 2-series) via fromBeats → validateShotSpecs →
            compile, renders the compiled rects through Layer.jsx with
            the archetype-specific content = the new beat components,
            in the REAL render engine, for Shorts (1080×1920) AND
            Longform (1920×1080, SLOTS_LONGFORM) = 16 stills. Gates:
            G1 every compiled Layer rect measures within ±2 px at
            settled frames; G2 zero safe-rect crossings; G3 zero
            sibling flex; G4 every peer-lane stage element bounds
            inside the stage rect (chips/panels/nodes/image/icon);
            G5 motion branches evidenced at in-flight frames (HERO
            count mid-run at tA+20 with scale > 1; TERM rule scaleX
            in (0,1) at tA+9; LIST chips at staggered offsets; CONTRAST
            right panel scale < 1 mid-POP; RELATION connector path
            partial; IMAGE push scale > 1.0 mid-run; STATEMENT icon
            opacity < 1); G6 C17 hold: TERM_DEFINE frame tA+20−1 vs
            tA+20 and RELATION tA+23−1 vs tA+23 pixel-identical in the
            stage+headline region; G7 all 16 stills render without
            throwing; G8 `layout/run-lint.js` stays green (38/0).
            L7 expectation: compiled frames for the six no-accent
            archetypes report "0 accent elements" — expected
            divergence (peer SFR-ENC-9-1); the probe does NOT assert
            L7 pass on those frames, it asserts the manual accent map
            (TERM rule + PROGRESS highlight only).
SPEC REF    LAYOUT-SYSTEM.md §5.5 (Tier 2 = DOM confirmation), §8.4
            step 6; CROSSCHECK-PROTOCOL Part 4 row 9 (16 stills).
SOURCES     [1] FIRST-PARTY precedent: data/audit/8/progress-probe.mjs
            + _progress-entry.jsx — the exact pattern (bundle →
            renderStill → onBrowserLog → getBoundingClientRect/scale,
            G1/G2/G3, EVIDENCE_FRAMES).
            [2] FIRST-PARTY live: data/audit/9/contract-probe.mjs —
            fixture shape + buildInputs + compile path.
            [3] FIRST-PARTY live: layout/slots.js — both slot tables.
RE-VERIFIED YES. 16 = 8 archetypes × 2 slot tables (SLOTS_SHORTS +
            SLOTS_LONGFORM — both confirmed present this session).
            C10–C13 have no in-repo definition (FINISH-SPEC.md absent,
            SFR-MOT-9-6); D11–D13 are audit-encoding's fromBeats checks
            (implemented — peer gate Run 2/4).
CURRENT     No stage-9 probe exists.
DELTA       New probe + entry mirroring the stage-8 harness with
            per-archetype stage-content + motion-frame assertions.
PLAN        Delete: nothing. Replace: nothing. New files:
            data/audit/9/stage9-probe.mjs + _stage9-entry.jsx
            (runtime-generated).
DIFF        PENDING (Phase 2)
COUNTER     PENDING (Phase 3)
STATUS      PENDING
```

---

## §2 — PHASE 2 (CHANGE) RECORD — filled after edits

Phase 2 executed as delete-then-replace: `beats/` had only `Progress.jsx` (stage 8); the 7 remaining components were added as NEW files (nothing pre-existing deleted or wrapped). Probe artifact follows the stage-8 `_progress-entry.jsx` pattern (runtime-generated entry, bundle → renderStill → onBrowserLog → getBoundingClientRect).

| Claim | File(s) (new) | git blob hash (P2.5) | Lines |
|---|---|---|---|
| 9-01 (wiring) | `data/audit/9/motion-probe.mjs` (entry `Beat`/`Measure` + `serializeEntry` → `_motion-entry.jsx` runtime) | `f7e81c1c4ddff95f77ba91ea7c9320f72bd2dfa7` | 759 |
| 9-02 (HeroNumber) | `src/skills/remotion-render/beats/HeroNumber.jsx` | `c8ab36e5410ab1eaad1747d594de0e4af2a43072` | 141 (re-implementation: settle click) |
| 9-03 (TermDefine) | `src/skills/remotion-render/beats/TermDefine.jsx` | `ff86e78558955a080be8c2361e9da07c16155fe7` | 150 |
| 9-04 (ListItem) | `src/skills/remotion-render/beats/ListItem.jsx` | `936b3a153346ea6a7deef5615af8250b627f6ebe` | 222 (re-implementation: legacy ListRunScene semantics) |
| 9-05 (Contrast) | `src/skills/remotion-render/beats/Contrast.jsx` | `b2f721656571bd5ee4928fb69aaed1be5b6b4fc5` | 200 |
| 9-06 (Relation) | `src/skills/remotion-render/beats/Relation.jsx` | `d794433b6123278e43f8fc68d6ba692ceee4969c` | 208 |
| 9-07 (ImageBeat) | `src/skills/remotion-render/beats/ImageBeat.jsx` | `6fad0c0cf29d04c6dda4c9eeab876b1a9546dc71` | 153 (re-implementation: F7 treatment + push) |
| 9-08 (Statement) | `src/skills/remotion-render/beats/Statement.jsx` | `e020c91c505a362c95595cffcbe929e98a3d1308` | 120 |
| 9-09 (probe gate) | `data/audit/9/motion-probe.mjs` + runtime `_motion-entry.jsx` | above (probe row) | 759 |

**Probe run (this session, live repo HEAD 65e90fc + peer fromBeats.js working tree):**
`node data/audit/9/motion-probe.mjs` → **ALL GATES GREEN** — 34/34 DOM gates + 6/6 C17 pixel-identity pairs, both formats (Shorts 1080×1920, Longform 1920×1080). Report: `data/audit/9/motion-report.json`.

Probe fixes made this session (all inside the probe artifact, no production code touched):
1. **Root-relative measurement** — headless stills position the canvas ~1e6 px up the page; `Measure` now reads rects relative to `[data-root]` (AbsoluteFill). Without this, every y-coordinate was off by −999999 (G1/G4 false negatives).
2. **Chip dedup key** — `id::role` collapsed all 5 chips to chip 0; key now includes `data-index`/`data-side` (G6a/b/c false negatives).
3. **`settled()` accepts percentage translates** — the primitives' permanent `-50% -50%` centering translate is static, not motion; regex now treats percent translates as settled (G5 icon false negative).
4. **Backtick discipline inside the entry template literal** — the entry is one giant template literal; an internal `` `${...}` `` terminated it early (syntax error); reverted to string concatenation.

**Post-REJECT re-run (re-attempt 1 of 2 — this session, after re-implementation):**
`node data/audit/9/motion-probe.mjs` → **ALL GATES GREEN** — **36/36 DOM gates + 6/6 C17** pixel-identity pairs, both formats (36 = 11 gate ids: G1×12, G2a×2, G2b×4, G3×2, G4×2, G5×2, G6a/G6c/G6b ×2 each, mid-rise×4, image-push×2). The earlier “34/34” count (§2 + GATE.md) was the pre-rejection probe’s gate set; the re-calibrated probe added image-push + the mid-rise pair. Re-calibrated gates now assert the RE-IMPLEMENTED semantics: G6a@f18 = 3 chips in flight (POP + staggered shift-up), G6c@f28 = 5 chips in DOM with the oldest mid-drop fade, G6b@f45 = drop complete — 4 chips settled, bottom-anchored at 940 = stage.y + stage.h, first = Beta/15, pitch 88; image-push@f30 = scale 1.0003 > 1.0 mid-spring; G1@f70 = the headline rect settles exactly on the compiled rect (push done at 66; the image headline enters RISE@anchor+6 and settles well before f70). The image container {48,392,840,548} and credit {56,906} are code-derived from the stage prop (ImageBeat.jsx:70-73,112-113) — confirmed by the re-dispatch counter-check; the probe itself gate-measures only the image container scale (image-push@30) and the compiled headline rects (G1), not the image/credit geometry. Measured vs closed-form (node, same curves): Alpha shift @f18 89.571 = 88·(1−E_OUT(5/9)) + 88 ✓; drop translate @f28 −0.748 = −12·E_IN(2/6) ✓ — probe measurements are exact against the implemented curves. Lint re-run: `layout/run-lint.js` **38/0**.
Reconciliations made today (all re-verified by a fresh probe run AFTER each change):
1. **ListItem.jsx** — stale doc comment said the shift-up runs “over 5 f”; corrected to 9 f (drag 2, stagger 2 — A4 row 3), matching the code and claim card. Comment-only, no behaviour change.
2. **ImageBeat.jsx** — claim card 9-07 said “<Img>”; tried Remotion’s <Img> → it THROWS on load failure (Error loading image) and 4 gates failed, because the probe’s headless bundle 404s the fixture image URL (/public/b-roll/... — a static-base mismatch in the served bundle: the asset DOES exist at src/skills/remotion-render/public/b-roll/ch-01/cave-entrance.jpg, but the headless server does not map that URL onto the publicDir; probe-env artifact only). No gate reads image bytes — all image gates read the container div’s computed style, so the 404 never affects a gate result. Reverted to plain <img> — legacy-faithful (motion-graphics.jsx:945-992 ImageBeatScene uses plain <img>) — and amended claim card 9-07 item (1) to say plain <img> with that justification.
3. **Claim card 9-04 item (3)** — corrected to the A4 numbers (9 f / drag 2 / stagger 2 per chip / dim 6 f; item entrance stagger 5 f).
4. **Final probe re-run after the revert + claim-card amendments: ALL GATES GREEN 36/36 + 6/6, exit 0** (report motion-report.json); lint re-run **38/0**. The §5 next-action list (re-implement 9-04 / 9-07 / 9-02 item 4, re-calibrate G6a/b/c, add push + click evidence) is now fully executed — click evidence is source-level (Audio element in HeroNumber.jsx/ListItem.jsx; stills probes cannot assert audio — stage-13 render SFX check).
## §3 — PHASE 3 (COUNTER-CHECK) — appended after dispatch

**Re-dispatch 1 (re-attempt 1 of 2, P3.5) — this session:** three `verify-independent` sessions, one per re-implemented claim (9-02 / 9-04 / 9-07), each given ONLY the verbatim ASSERTION (the corrected claim card) + the component file + the probe gate code (P3.1 — no spec sources passed; the verifier re-reads the repo itself). Verdicts: see §5.

## §3 — PHASE 3 (COUNTER-CHECK) — appended after dispatch

**Dispatch 1 (this session):** `verify-independent` (Task `ses_021863a79ffedEwjYuCH4W26L9`), CLAIM = stage-9 gate assertion + FILES (7 components + probe) + GATES (probe run + lint). **Verdict: REJECT** — detailed in §5.

**Post-rejection Phase 1 re-grounding (this session, against live spec + legacy):**
- TermDefine rule DRAW: claim 9-03 + A4 + F2 all say **14 f**; code = 14 f. Verifier item 1 was a paraphrase error (my dispatch text said 9) — **code matches its claim card**.
- Statement icon: claim 9-08 + A4 + F8 say **POP**; code = popStyle. Verifier item 4 was a paraphrase error (dispatch text said fade) — **code matches its claim card**.
- ListItem: claim 9-04 + A4 (DETAIL-REFERENCE:238-250) + F3 (MANUAL:1009-1028) + legacy ListRunScene (motion-graphics.jsx:1016-1064) all describe: new chip POP at tA−4 at the stack bottom, existing chips shift up 88 px over 5 f E_OUT (stagger 2), textPrimary→textDim 6 f, badge accent [tA,tA+6) then stroke, click_001 −24 dB at tA+2, items stagger 5 (0.56 × 9 f), max 4 visible + drop-oldest 6 f E_IN fade. **Code deviates:** top-anchored static stack (left 104/w 736/h 64 vs legacy 88/760/88), RISE not POP, no shift-up, no dim, no badge, no click, no drop-oldest, DROP_STAGGER 7. The code comment's G6a justification ("5-frame stagger settles chip 3 at tA+22") is an artifact of the code's own drop schedule (tA+3+7i), which itself deviates from the A4 schedule (arrival tA−4). **Genuine REJECT item.**
- ImageBeat: claim 9-07 + F7 (MANUAL:1083-1097) + E2.5/E2.6 (MANUAL:895-897) + legacy ImageBeatScene (945-992) all describe: image radius 24, saturate(0.35), 12% accent tint overlay, fade 9 f from tA−4 with scale 1.05, push 1.05→1.00 over D.push via spring damping 200, 32 px credit riseStyle at start+D.short. **Code:** fade from frame 0 (not tA−4), no radius, no filter, no tint, no scale/push/spring, static credit. **Genuine REJECT item.**
- HeroNumber: claim 9-02 item 4 requires the settle click `ui/click_004.ogg` at dbToVolume(−22) on tA+56 (F1 E4.2, Progress.jsx precedent). **Code has no Audio element** — unimplemented claim item (stills probe cannot assert audio; progress-render SFX check is a stage-13 concern).
- Remaining claims verified by the probe (34/34 gates + 6/6 C17) are unaffected by the rejection: geometry/centering/entrance-settle/counter/rule-draw/stagger-window/rect-identity all hold for the implemented semantics.

## §4 — Observations (non-claim findings)

1. **Peer lane is mid-change.** `spec/fromBeats.js` is modified in the working tree (+233/−39, accent-rule policy CLAIM-ENC-9-02 + ENC-01..18 gates). My contract evidence (§0.2) was re-run THIS session against the current file; the peer gate is green (119/0). My claims bind to the live file — if the peer lands more changes before my probe runs, the probe re-compiles against the live state (contract-probe + gate re-runs are cheap and part of the probe).
2. **L7 is archetype-blind (peer SFR-ENC-9-1).** Six archetypes emit zero compiled accent elements, so `lintL7` reports "0 accent elements" on their frames by design. The stage-9 probe does not assert L7 on those frames; the manual accent map (peer CLAIM-ENC-9-02) governs: TERM_DEFINE rule + PROGRESS highlight are the only compiled accents.
3. **A4 vs compiled conflicts (each → SFR in §6):** A4 HERO_NUMBER rows (unit tA+2; headline tA+58 drag 12) vs compiled anchor+8; A4 RELATION headline tA+14 vs compiled anchor+18; A4 RELATION connector tA vs F6 tA+4; A4 LIST_ITEM badge window 6 f vs legacy 8 f (A4 wins — the newer table); LIST_ITEM item stagger 5 f vs MANUAL's 6 (A4 explicitly supersedes).
4. **FINISH-SPEC.md absent** (escalation carried from stage 8). C10–C13 have no in-repo definition; D13 = DETAIL-REFERENCE:587 ("highlighted series point is the anchor token's referent, not max()"); D11/D12 = archetype-mix vs concepts / chart honesty (audit-encoding, implemented). C17 (hold-begins pixel-identical) is exercised by probe gate G6.
5. **IMAGE_BEAT headline one-line rule (peer F-2):** keep fixtures ≤ 13 chars; "ALAMEDA COURT" is the proven fixture.
6. **ESC-LAY-7-1 carried:** `primitives/**` is in no lane allow-list — components IMPORT Node/Chip/Rule/Icon (read-only) and mirror constants verbatim (Progress.jsx precedent); never edit them.
7. **Carried from stage 8:** `verify-compositions.js:233-237` IMAGE_BEAT stage stddev > 18 check (live-pipeline flag, orchestrator lane); `_stage9-entry.jsx` will be runtime-generated like `_progress-entry.jsx`.
8. **Bare-integer discipline (§8.3):** components contain zero raw layout coordinates (no 48/88/392/940/964/1248/1080/1920 literals); every position derives from the stage/rect props; the only literals are frame counts + design constants mirrored verbatim from primitives/legacy scenes (ICON_RADIUS 90/60, NODE_RADIUS 44 via Node.jsx import, CHIP_* via Chip.jsx import, IMAGE_RADIUS 24, CONTRAST_GAP 24, RELATION_INSET 200, CREDIT_* offsets, D tokens from beats.js).

## §5 — COUNTER-CHECK VERDICTS — appended after dispatch

### Dispatch 1 — stage-9 gate claim → **REJECT** (verifier `ses_021863a79ffedEwjYuCH4W26L9`)

Verifier's five items, disposition:
1. TermDefine rule draws 14 f, not the claimed 9 — **rejected as a finding**: my dispatch paraphrased the claim incorrectly; claim 9-03, A4 and F2 all say 14 f and the code implements 14 f. (P3.1 violation on my side: the dispatch must carry the verbatim ASSERTION line.)
2. ListItem: rise 6/9 f and DROP_STAGGER 7 vs the claim's "5 f / 2 f stagger" — **confirmed genuine** (see §3 re-grounding): the component implements simplified static-stack semantics (no shift-up 88, no dim, no badge, no click_001, no drop-oldest, geometry 104/736/64 vs legacy 88/760/88) and the probe gates G6b/G6c encode the simplified "all 5 chips settled" behavior that contradicts the spec's "max 4 visible + drop-oldest".
3. ImageBeat: no push — **confirmed genuine**: no scale 1.05 entry, no 1.05→1.00 push over D.push, no spring; also missing radius 24, saturate(0.35), 12 % accent tint, tA−4 fade start, credit riseStyle.
4. Statement: icon pops not fades — **rejected as a finding**: my dispatch paraphrase said "fade"; claim 9-08, A4 and F8 all say POP and the code implements popStyle. (Same P3.1 violation.)
5. Claim text's "2-frame stagger" is incompatible with gate G6a — **moot**: the claim card's own numbers were muddled ("2 f stagger between shifts" vs the quoted A4 "Stagger 5 for the items"), and the genuine deviation (item 2) supersedes this.

Verifier also noted its sandbox denied raw `node` invocations, so it could not re-run the probe itself; the probe's 34/34 + 6/6 green stands from my own run (report `data/audit/9/motion-report.json`), but the rejection holds on the two genuine items regardless.

**Next action (per P3.5 — first re-attempt):** re-enter Phase 1 (done in §3) → Phase 2 re-implement claim 9-04 (ListItem: POP entry at tA−4, shift-up 88 px stagger 2, dim 6 f, badge window, click_001 −24 dB at tA+2, items stagger 5, max 4 visible + drop-oldest 6 f E_IN, legacy geometry 88/760/88 from stage prop) and claim 9-07 (ImageBeat: radius 24, saturate(0.35), 12 % tint, fade 9 f tA−4 scale 1.05, push 1.05→1.00 E.push, credit riseStyle) + claim 9-02 item 4 (HeroNumber settle click) → re-calibrate probe gates G6a/b/c and add ImageBeat push + HeroNumber click evidence → re-run → re-dispatch with VERBATIM claim cards.

### Re-dispatch 1 (re-attempt 1 of 2, P3.5) — three claims → **3× CONFIRM** (this session)

Three `verify-independent` sessions, one per re-implemented claim, each given ONLY the verbatim ASSERTION (corrected claim card) + the component diff (P3.1 — no spec sources passed; each verifier re-read the repo itself):

| Claim | Verdict | Independent sources used by the verifier | Notes |
|---|---|---|---|
| CLAIM-MOT-9-02 (HeroNumber, incl. settle click) | **CONFIRM** | MANUAL F1/E4.1/E4.2; DETAIL-REFERENCE A4 HERO_NUMBER; legacy HeroNumberScene (motion-graphics.jsx:582-611, Sfx 282-289); Progress.jsx (A2 counter); beats.js tokens; probe report G2a/G3/G4 | all 5 items match, incl. the previously-missing click_004 at dbToVolume(−22) on tA+56 (file exists in public/sfx/ui/); the A4 “unit tA+2 / headline tA+58” conflict resolved to the compiled anchor+8 (SFR-MOT-9-2), as the claim states. |
| CLAIM-MOT-9-04 (ListItem, legacy run semantics) | **CONFIRM** | MANUAL F3 (1009-1028); DETAIL-REFERENCE A4 LIST_ITEM (238-251); legacy ListRunScene (motion-graphics.jsx:1013-1096) incl. popStyle/stageExitStyle/Sfx; Chip.jsx; slots.js; probe report G6a/G6b/G6c (f18 shift 89.571, f28 drop op 0.9376/tr −0.748, f45 bottom 940) | all 7 items match; the six dispatch-1 deviations (static stack, RISE entry, no shift/dim/badge/click/drop, DROP_STAGGER 7) are all gone. Two non-falsifying observations: spec docs live at repo root (claim-card citations lack full paths) and A4 row 4 dim “tA−2” vs F3 “tA−4” start conflict — the claim asserts only the shared 6 f duration. |
| CLAIM-MOT-9-07 (ImageBeat, F7 treatment + push) | **CONFIRM** | MANUAL F7 (1083-1097) + E2.5/E2.6 (895-897); DETAIL-REFERENCE A4 IMAGE_BEAT; legacy ImageBeatScene (motion-graphics.jsx:945-992); fromBeats.js headline enter (IMAGE_BEAT 6); compile-lint.js; probe report image-push@30 | all 7 items match, incl. plain <img> (legacy-faithful), radius 24, saturate(0.35), 12% tint, fade tA−4, spring push 1.05→1.00 (byte-identical to the legacy push line), credit riseStyle. Two evidence-writeup inaccuracies flagged and corrected in §2: G1 measures the headline rect, not image/credit geometry (the {48,392,840,548}/(56,906) values are code-derived, not gate-measured); the fixture 404 is a static-base artifact (asset exists), not a missing asset. |

P3.6 note: every verifier re-derived the values independently (spec tables + legacy scenes + closed-form arithmetic reproducing the probe’s measured numbers). The two corrections above are evidence-wording fixes only — no claim item, code line, or gate assertion changed as a result.

## §6 — SHARED-FILE REQUESTS (SFRs)

### SFR-MOT-9-1 (Root.jsx — composition registration)
- **Target:** orchestrator-owned `src/skills/remotion-render/Root.jsx` (registration of the 8 beat compositions × 2 formats = 16 compositions).
- **Grounds:** the stage-9 gate says "16 compositions render as stills"; Root.jsx is orchestrator-owned (stage-8 GATE.md SFR precedent). The wiring contract (CLAIM-MOT-9-01) defines exactly how the 7 components mount, so the registration can be written against it.
- **Action:** orchestrator writes the wiring + registration at the point it rewires `compositions/` (stage 14/15) or this stage's gate, whichever comes first.

### SFR-MOT-9-2 (Spec conflict — DETAIL-REFERENCE A4 §HERO_NUMBER)
- **Before:** A4 HERO_NUMBER rows "unit label RISE tA+2" + "headline RISE tA+58 (drag 12 from settle)".
- **After:** ONE headline rect (the unit/what-it-measures label) RISE at tA+8 — the compiled contract (headline enter RISE@"anchor+8", contract-probe) + peer CLAIM-ENC-9-03 table. The "tA+58 headline" row describes the legacy scene's second element that no longer exists.
- **Grounds:** fromBeats emits exactly one headline layer for HERO_NUMBER (contract-probe §0.2); the counter settles at tA+56 and the unit is what measures it — the F1 storyboard's single headline at tA+8.

### SFR-MOT-9-3 (Spec conflict — DETAIL-REFERENCE A4 §RELATION)
- **Before:** A4 RELATION rows "tA connector DRAW A→B (drag 4) 14" + "tA+14 headline RISE 9".
- **After:** connector DRAW at tA+4 over 14 f; headline RISE at tA+18 (compiled anchor+18, contract-probe + peer CLAIM-ENC-9-03 + F6).
- **Grounds:** F6 storyboard (tA+4 connector) and the live legacy code (connStart = tA+D.micro) agree on tA+4; the compiled contract (anchor+18) and F6 (tA+18) agree on the headline. A4's two rows are the outliers.

### SFR-MOT-9-4 (carried with peer — producer gaps)
- LIST_ITEM has no headline producer and CONTRAST's consequence phrase has no producer upstream (peer SFR-ENC-9-4). This lane's components receive `items` (ListItem) and `leftText/rightText` (Contrast) via the wiring handshake (CLAIM-MOT-9-01) — the spec carries only the caption text.
- **Fixture note:** production-shaped fixtures set `scene.headline` so the compiled headline text is the real term/consequence/subject, not the anchor-phrase fallback.

### SFR-MOT-9-5 (carried with peer — IMAGE_BEAT headline one-line)
- IMAGE_BEAT headline must stay ≤ 13 chars (peer F-2: 17-char "THE ALAMEDA COURT" wrapped and was rejected by the compile one-line rule §3.7/§5.3). Fixture: "ALAMEDA COURT".

### SFR-MOT-9-6 (carried — FINISH-SPEC.md absent)
- C10–C13 undefined in-repo; D13 found at DETAIL-REFERENCE:587; C17 exercised via probe gate G6. Carried from stage 8 (escalation 0-6).

### SFR-MOT-9-7 (carried — ESC-LAY-7-1 primitives ownership)
- `primitives/**` grant not in any lane allow-list; components import, never edit.

### SFR-MOT-9-8 (carried with peer — L7 archetype-blindness, SFR-ENC-9-1)
- The lint's "exactly 1 accent per frame" contradicts F6/F7/F8 (no accent element). The stage-9 probe asserts the MANUAL map instead of L7 on the six no-accent archetypes (see claim 9-09).
