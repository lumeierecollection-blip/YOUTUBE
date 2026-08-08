# AUDIT-MOTION — STAGE 11 LEDGER (D6 springs + D7 hold-begins declarations)

**Lane:** `audit-motion` — timing, easing, springs, stagger, drag, blur
**Stage:** 11 — CROSSCHECK-PROTOCOL Part 4 row 11: "D4–D7, D14 pass; counter bounding box byte-identical across the count" (shared with `audit-type`; D4/D5/D14 are the type lane's domain — they own `data/audit/11/counter-values-probe.mjs`)
**Mission:** make D7 true across the 8 beat archetypes in `src/skills/remotion-render/beats/**` — every archetype declares a "hold begins" frame (A4.1, DETAIL-REFERENCE:272-274) with no visual event after it except caption/rail (A4.2, :276-277) — plus the D6 half of the gate (ζ ∈ [0.46, 1.0], DETAIL-REFERENCE:580). Deliver: per-archetype hold declarations (component doc comments), a Tier-2 probe rendering C17 pixel-identity pairs (hold−1, hold) for all 8 archetypes × 2 formats, and a D6 spring-config source scan. Counter-check every claim via `verify-independent`.
**Ownership (edit):** `src/skills/remotion-render/beats/*.jsx` (comment-only hold declarations — NO timing/visual code changes) + `data/audit/**`. **Not written:** `spec/**`, `primitives/**`, `layers/**`, `layout/**`, `compositions/**`, `styles/**` (read-only; see §2 SFRs).
**Status:** Phase 1 (GROUND) complete — claim cards written (11-01…11-04). Phase 2 (CHANGE) executed — 7 comment-only hold declarations + stage-11 probe (8 archetypes × 2 formats). Phase 3 (COUNTER-CHECK) — probe report ALL GREEN (C17 16/16 identical, hold-static 16/16, D6 2 sites w/ exception); dispatch 1 → CONFIRM (no rework needed).

---

## §0 — Current state snapshot

| Item | Value |
|---|---|
| Repo HEAD | `29c3038` — "stage 9: gate verdict PASS — orchestrator re-run" (motion probe 36/36 + C17 6/6, lint 38/0, archetype 119/0) |
| Working tree | Untracked only: `data/audit/10/`, `data/audit/11/`, `src/skills/remotion-render/captions/` — no tracked-file modifications |
| `beats/` | 8 components present (Progress.jsx stage-8; HeroNumber/TermDefine/ListItem/Contrast/Relation/ImageBeat/Statement stage-9). Production wiring (Root.jsx) still mounts the LEGACY `motion-graphics.jsx` scenes — the beats/** components are not yet wired into production (stage-9 claim 9-01: wiring is a later stage's job) |
| Peer artifacts in `data/audit/11/` | `counter-values-probe.mjs` (audit-type, D5/D14); scratch dumps `_probe-*.txt`, `_mm-d.txt`, `_ls-d.txt`, `_dr-d.txt` were stage-9 read notes — deleted at close (no live value) |
| Stage-9 evidence (read this phase) | `data/audit/9/audit-motion.ledger.md` claim cards 9-01…9-09; `motion-probe.mjs` schedule/C17 pairs; stage-8 `progress-probe.mjs` fixture (2-bar chart, hl=1, HL_START 13, ACCENT_AT 37) |

### §0.1 — Sources of record (Phase 1)

First-party / machine: live `beats/*.jsx` (all 8 re-read this phase, headers + timing bodies), `spec/fromBeats.js` (HEADLINE_DELAY table :77-86 — HERO 8, TERM 0, RELATION 18, STATEMENT 0, IMAGE 6, CONTRAST 0, LIST 0, PROGRESS 8), `layers/Layer.jsx` (RISE/POP/FADE mechanics), `layout/compile.js` (resolveAtFrame "end-6" → dur−6), `compositions/beats.js` (D {micro:4, short:6, base:9, large:12, complex:15, push:60, hold:45}), `compositions/mg-package.js:438-440` (trace flag: hook beat only, at most one per video), `primitives/Icon.jsx` (TraceIcon: 10 f/subpath, staggered D.micro; `<circle>` icons → zero subpaths → static fallback), `primitives/Chart.jsx` (static — no springs), `compositions/motion-graphics.jsx:635-636, 687-701` (legacy Contrast divider), stage-9 ledger + probe, stage-8 probe.
Third-party / spec: DETAIL-REFERENCE.md A4 tables (:202-290), A4.1/A4.2 (:272-277), A3.3/A3.5, Part D (:562-594); CROSSCHECK-PROTOCOL.md; MANUAL D1 (E.push exception).

### §0.2 — The hold-begins convention (established from A4 + stage-9 verified evidence)

- **A4.1** (DETAIL-REFERENCE:272-274): every archetype declares a "hold begins" frame = the frame C17 tests — the frame before and the frame after must be pixel-identical.
- **Convention (from TERM_DEFINE, stage-9 verified 29/30):** hold begins = the frame the last visual motion completes (its final interpolation value); C17 pair = (hold−1, hold). E_OUT (bezier(0.16,1,0.3,1)) saturates fast: E_OUT(8/9) = 0.99983 → the hold−1 frame is sub-pixel-different (e.g. 0.004 px translateY), which rasterizes pixel-identical (stage-9 C17 6/6 proved the pattern).
- **A4.2** (:276-277): nothing after hold begins except the caption highlight and the progress rail. Audio events (settle clicks) are not visual events and do not move the hold.

### §0.3 — Per-archetype hold math (all re-derived this phase from the live component code, tA = anchor frame)

| Archetype | Last visual event (completion frame) | **Hold begins** | C17 pair (tA=10 fixture) | Component currently declares? |
|---|---|---|---|---|
| HERO_NUMBER | counter reaches value at start+D.push = **tA+56** (numeral scale/opacity settle tA+5; headline RISE@anchor+8 settles tA+17) | **tA+56** | (65, 66) | NO |
| TERM_DEFINE | rule DRAW tA+6, 14 f → **tA+20** | **tA+20** (already declared) | (29, 30) — stage-9 verified | YES |
| LIST_ITEM (run, 5 items anchors 10/15/20/25/30) | lowest surviving chip's final shift — chip 1 starts entrance₄+2+2·(N−2−k) = 32, 9 f → **41** (chip 0 is dropped — frozen, faded by 32; badge return 39; drop 32) | **41** (single-chip beat: badge return completes **tA+9**) | (40, 41) | NO |
| CONTRAST | after-value POP (start tA−4 + PANEL_POP_DELAY 4 + VALUE_POP_DELAY 4 = tA+4, D.base 9 f) → **tA+13** (before panel tA+5; after panel/before value tA+9; headline RISE@anchor+0 tA+9) | **tA+13** | (22, 23) | NO |
| RELATION | headline RISE@anchor+18, 9 f → **tA+27** (connector DRAW tA+4→tA+17; node pops tA+5) | **tA+27** | (36, 37) | PARTIAL — comment says "settles tA+27", no "hold begins" declaration |
| IMAGE_BEAT | push spring settles at start+D.push = **tA+56** (imageScale 1.00; fade tA+5; credit rise tA+11; subject headline RISE@anchor+6 tA+15) | **tA+56** | (65, 66) | NO |
| STATEMENT | headline RISE@anchor+0, 9 f → **tA+9** (icon POP tA+5) | **tA+9** | (18, 19) | NO |
| PROGRESS (2-bar, hl=1 fixture) | highlight accent switch at hl+24 = **tA+27** (labels: bar1 label tA+15→tA+24; bars settle ≈tA+24) — a DISCRETE 1-frame switch (`frame ≥ hl+24`), so the hold is one frame AFTER it | **tA+28** = max(last label settle tA+17+7(N−1), accent switch hl+24 + 1) | (37, 38) | PARTIAL — comment says "nothing moves after the accent lands" (TRUE only when hl = N−1; for hl < N−1 the last label settles later) |

**A4-vs-reality divergences found (→ SFRs in §2):**
1. RELATION A4 row "tA+14 headline RISE / tA+23 hold" is stale — superseded by stage-9 SFR-MOT-9-3 (compiled headline at anchor+18, fromBeats.js HEADLINE_DELAY.RELATION = 18). True hold tA+27.
2. HERO_NUMBER A4 rows "tA+58 headline RISE / tA+67 hold" stale — SFR-MOT-9-2 moved the headline to anchor+8 (settles tA+17). True hold tA+56 (count reaches value; A4's own tA+56 row).
3. LIST_ITEM A4 "tA+7 hold begins" true only for a 2-chip stack; badge return completes tA+9; the highest chip's shift completes tA+2N−4+9 for N chips (no drop).
4. PROGRESS A4 "last label +9 | hold begins" misses the case where the highlight IS the last bar (hl = N−1): the accent switch lands 3 f later, and because it is a discrete 1-frame switch (`frame >= hl+24`) the hold is one frame AFTER it. True hold = max(last label settle, accent switch + 1).
5. CONTRAST / IMAGE_BEAT / STATEMENT have NO A4 micro-timing table rows — their timing lives in component comments/MANUAL; hold declarations must be added there.
6. Stage-9 claim 9-06 misdescribed its own C17 evidence: RELATION pairs (60,61) and (70,71) are tA+50/51 and tA+60/61, NOT tA+22/23 as the card wrote; the card's conclusion (hold tA+23) is wrong — actual tA+27. Correction note (§1, claim 11-04).
7. Stage-9 claim 9-05 item 2 ("divider draws tA−6→tA+6 at x=468") is UNIMPLEMENTED in Contrast.jsx. Legacy divider confirmed at motion-graphics.jsx:635-636, 687-701 (dividerProg = ease(frame − (tA−D.short), [0, D.large], [0,1]); dividerY = 520 + 340·prog; SVG line x1=x2=468). Contrast.jsx renders panels/values/labels/headline only. NOT a D7 violation (divider ends tA+6 < hold tA+13) — a stage-9 completeness gap, carried as an SFR for the orchestrator to accept or re-dispatch.

---

## §1 — PHASE 1 CLAIM CARDS

### CLAIM-MOT-11-01 — D7: every archetype declares a "hold begins" frame (component comments)

```
ASSERTION   After this change, all 8 beats/** components declare their A4.1
            "hold begins" frame in the header doc comment, and the declared
            frame is the true first-static frame per §0.3:
              TERM_DEFINE  tA+20  (already declared — unchanged)
              HERO_NUMBER  tA+56  (counter completes start+D.push)
              RELATION     tA+27  (headline RISE@anchor+18 settles)
              LIST_ITEM    tA+9 per-beat (badge return) / 41 for the 5-item
                           run fixture (lowest surviving chip's final shift)
              CONTRAST     tA+13  (after-value POP settles)
              IMAGE_BEAT   tA+56  (push spring settles)
              STATEMENT    tA+9   (headline RISE@anchor+0 settles)
              PROGRESS     max(last label settle, accent switch hl+24 + 1)
                           — tA+28 for the 2-bar hl=1 fixture (the accent
                           switch at tA+27 is a discrete 1-frame change)
            No visual event follows the declared frame (A4.2): every event
            after it is audio (settle clicks at tA+56 HERO / hl+24 PROGRESS /
            tA+2 per-chip LIST) or outside the component (caption highlight,
            progress rail — wiring-owned).
            STATEMENT trace-mode caveat (D2.5, mg-package.js:438-440 hook
            beat only): TraceIcon draws subpath k−1 over 10 f staggered
            (10+D.micro) f — dormant in the current wiring (the archetypeProps
            handshake carries icon only, trace defaults false; `<circle>`-only
            icons like "target" have zero subpaths → static Icon fallback).
            Declared in the comment so the future wiring knows the per-icon
            hold if trace is ever passed.
SPEC REF    DETAIL-REFERENCE.md A4.1/A4.2 (:272-277); A4 tables (:202-290);
            D7 (:581); stage-9 ledger (claim 9-01 component contract;
            TERM hold tA+20 verified 29/30).
SOURCES     [1] Live code re-read this phase: HeroNumber.jsx:51-59,78-81,107;
            Relation.jsx:68-74; ListItem.jsx:63-74,88-137 (entrance/shift/
            badge/dim/drop); Contrast.jsx:77-83,105-108; ImageBeat.jsx:36-45,
            59-62; Statement.jsx:41-46,60-65; Progress.jsx:19-52; TermDefine
            (hold comment).
            [2] spec/fromBeats.js:77-86 HEADLINE_DELAY (live).
            [3] layers/Layer.jsx RISE (D.base 9, E_OUT) + compile.js
            resolveAtFrame "end-6".
            [4] DETAIL-REFERENCE.md A4 tables + A4.1/A4.2 + Part D.
            [5] data/audit/9/motion-probe.mjs (schedule, C17 60/61 + 70/71,
            fixture anchors 10/15/20/25/30).
            [6] data/audit/8/progress-probe.mjs (2-bar fixture, hl=1,
            HL_START 13, ACCENT_AT 37).
RE-VERIFIED YES (this phase): every completion frame re-derived from the
            live component arithmetic; stage-9 C17 pairs re-read from the
            probe source (60/61, 70/71 — NOT tA+22/23).
CURRENT     Only TermDefine's comment declares a hold. Relation/Progress
            comments gesture at it ("settles tA+27", "nothing moves after
            the accent lands") — the latter is FALSE for hl < N−1. The
            other four have nothing.
DELTA       Comment-only: add/align a HOLD (A4.1) line to the header doc
            comment of HeroNumber, Relation, ListItem, Contrast, ImageBeat,
            Statement, Progress. ZERO timing/visual code changes.
PLAN        Delete: nothing. Replace: 7 header-comment blocks (TERM unchanged).
DIFF        n/a (comment-only; verified via git diff filter — every +/- line
            inside {/* */} doc blocks, zero code lines; 7 files: HeroNumber,
            Relation, ListItem, Contrast, ImageBeat, Statement, Progress).
COUNTER     CONFIRMED (probe): motion-probe.mjs run — hold-static at every
            declared hold frame passes both formats (hero 7 roles, term,
            list 5, contrast 14, image 8, statement, progress 16 at rest);
            mid-rise evidence: RELATION headline still in flight at f32/f33;
            HERO headline pre-RISE at f17. Diff review: git diff = comments
            only (36 insertions, 3 deletions — the Progress replacement).
STATUS      IMPLEMENTED
```

### CLAIM-MOT-11-02 — D6: spring inventory passes with the documented push exception

```
ASSERTION   Every spring config in beats/** satisfies D6 (ζ ∈ [0.46, 1.0],
            DETAIL-REFERENCE:580) except the one documented exception:
              Progress.jsx  spring({damping:13.9, stiffness:180})
                            ζ = 13.9 / (2·√180) = 0.518 ∈ [0.46, 1.0] ✓
                            (A3.1, DETAIL-REFERENCE comment; ≈15% overshoot)
              ImageBeat.jsx Easing.spring({damping:200})
                            ζ = 200 / (2·√100) = 10.0 ∉ [0.46, 1.0]
                            — DOCUMENTED EXCEPTION A3.3 / MANUAL D1 E.push:
                            the image "push" is a deliberately overdamped
                            settle (scale 1.05 → 1.00 with zero bounce);
                            it is the ONLY spring in the archetype set.
            No other springs exist in beats/** (all other motion is E_OUT
            bezier keyframes); primitives/Chart.jsx is static (no motion
            code); layers/Layer.jsx uses bezier only (D2.3).
SPEC REF    DETAIL-REFERENCE.md D6 (:580); A3.1 (:185-196, ζ formula); A3.3
            (exception mechanism); MANUAL D1 E.push; stage-9 claim 9-07
            (push 1.05→1.00 via Easing.spring({damping:200}), A3.3-cited).
SOURCES     [1] Live: Progress.jsx SPRING_CONFIG + header (:28-31: "ζ = 13.9/
            (2·√180) = 0.518"); ImageBeat.jsx:60 (Easing.spring({damping:200})).
            [2] Spec: DETAIL-REFERENCE.md A3.1/A3.3/D6.
            [3] grep of beats/** + primitives/Chart.jsx + layers/Layer.jsx
            for Easing.spring/spring( — no other occurrences.
RE-VERIFIED YES: ζ values re-computed by hand from the live configs; the
            D6 gate's source scan (claim 11-03) re-checks at run time.
CURRENT     As described.
DELTA       No code change (evidence claim). D6 check must encode the A3.3
            push exception or the spec D6 row amended to note it.
PLAN        Delete: nothing. Replace: nothing.
DIFF        n/a
COUNTER     CONFIRMED (source scan): gateD6() found exactly 2 spring sites in
            beats/*.jsx — Progress.jsx ζ=0.518 (d=13.9, k=180) and
            ImageBeat.jsx ζ=10.000 (d=200, k=100, Remotion default k).
STATUS      IMPLEMENTED
```

### CLAIM-MOT-11-03 — Stage-11 probe: C17 (hold−1, hold) pixel-identity + hold static + D6 scan

```
ASSERTION   data/audit/11/motion-probe.mjs renders every archetype in both
            formats (Shorts + Longform) and gates:
              C17  (hold−1, hold) pixel-identical in the stage+headline
                   region, hold = the declared frame (§0.3): HERO (65,66),
                   TERM (29,30), LIST (40,41), CONTRAST (22,23), RELATION
(36,37), IMAGE (65,66), STATEMENT (18,19), PROGRESS
(37,38).
              G1   at the hold frame the archetype's own animated roles are
                   static (no scale/translate/opacity ≠ settled value).
              D6   source scan of beats/*.jsx: every Easing.spring/spring()
                   config's ζ ∈ [0.46, 1.0] EXCEPT ImageBeat's push ζ=10
                   (A3.3 exception) — asserts exactly the two spring sites.
            Fixture constants mirror stage-9 (DUR 90, START 300, ANCHOR 310,
            tA 10; LIST 5 items anchors 10/15/20/25/30; PROGRESS 2-bar
            hl=1 fixture from stage-8). Entry wiring mirrors the stage-9
            _motion-entry pattern (beats/** components, compiled rects via
            buildMgPackage).
SPEC REF    CROSSCHECK-PROTOCOL.md Part 2 (three-phase); A4.1/C17;
            stage-9 probe pattern (data/audit/9/motion-probe.mjs).
SOURCES     [1] data/audit/9/motion-probe.mjs + _motion-entry.jsx (pattern,
            fixture, png-identity.mjs region diff).
            [2] data/audit/8/progress-probe.mjs (PROGRESS fixture).
            [3] §0.3 hold table (this ledger).
RE-VERIFIED YES (Phase 2 will run it).
CURRENT     No stage-11 motion probe exists.
DELTA       New file: data/audit/11/motion-probe.mjs (+ entry + out/ + report).
PLAN        Delete: nothing. Replace: nothing (new files).
DIFF        n/a (new files: motion-probe.mjs + _motion-entry.jsx + out/ +
            motion-report.json; entry lives in data/audit/11 — the tracked
            src/skills/remotion-render/_motion-entry.jsx is untouched).
COUNTER     CONFIRMED (probe): motion-probe.mjs — C17 16/16 pairs
            pixel-identical (shorts + longform), report pass:true, gates 32
            + C17 16 + D6 all green. Entry written to data/audit/11/
            _motion-entry.jsx (my ownership — the tracked
            src/skills/remotion-render/_motion-entry.jsx untouched).
STATUS      IMPLEMENTED
```

### CLAIM-MOT-11-04 — Stage-9 corrections + findings (evidence ledger, no code change)

```
ASSERTION   Three stage-9 ledger inaccuracies are corrected in this ledger:
            (1) claim 9-06 misdescribed its C17 pairs as tA+22/23 — the
            probe source shows (60,61) = tA+50/51 and (70,71) = tA+60/61;
            the card's RELATION hold tA+23 is wrong (actual tA+27, headline
            RISE@anchor+18 per SFR-MOT-9-3).
            (2) claim 9-05 item 2 ("divider draws tA−6→tA+6 at x=468") is
            unimplemented in Contrast.jsx — the legacy divider exists at
            motion-graphics.jsx:635-636, 687-701. Carried: NOT a D7 blocker
            (divider ends tA+6 < CONTRAST hold tA+13), a stage-9 completeness
            gap for the orchestrator (accept as documented divergence or
            re-dispatch stage-9).
            (3) A4 table rows are amended via SFRs (§2): RELATION hold
            tA+23→tA+27; HERO tA+67→tA+56; LIST tA+7 generalised; PROGRESS
            hold = max(last label +9, accent hl+24); add CONTRAST/IMAGE/
            STATEMENT hold rows (or note declarations live in the comments).
            These are ledger/spec-note amendments ONLY — no code behavior
            changes (the code already renders the true timing; stage-9
            gates passed on it).
SPEC REF    data/audit/9/audit-motion.ledger.md claims 9-05, 9-06;
            DETAIL-REFERENCE.md A4 (:202-290); SFR-MOT-9-2, SFR-MOT-9-3
            (stage-9 ledger §6).
SOURCES     [1] data/audit/9/motion-probe.mjs:656-659 (C17_PAIRS 60/61, 70/71).
            [2] motion-graphics.jsx:635-636, 687-701 (legacy divider).
            [3] Contrast.jsx (full read — no divider code).
            [4] spec/fromBeats.js:77-86 (HEADLINE_DELAY.RELATION = 18).
RE-VERIFIED YES (this phase).
CURRENT     As described.
DELTA       No code change — ledger/spec-note only.
PLAN        Delete: nothing. Replace: nothing.
DIFF        n/a
COUNTER     n/a (evidence ledger — no code change; every fact re-derived
            from the live code + spec this phase).
STATUS      LEDGER ONLY
```

---

## §2 — SHARED-FILE REQUESTS (SFRs — spec documents are read-only; amendments for the orchestrator/spec owner)

- **SFR-MOT-11-1** — `DETAIL-REFERENCE.md` A4 RELATION table (:268-270): amend "tA+14 headline RISE" → "tA+18 headline RISE (anchor+18)" and "tA+23 hold begins" → "tA+27 hold begins" (superseded rows; compiled headline per fromBeats HEADLINE_DELAY.RELATION = 18).
- **SFR-MOT-11-2** — A4 HERO_NUMBER (:218-219): amend "tA+58 headline RISE" → "tA+8 headline RISE (anchor+8, SFR-MOT-9-2)" and "tA+67 hold begins" → "tA+56 hold begins (count reaches value — the true first-static frame)".
- **SFR-MOT-11-3** — A4 LIST_ITEM (:248): generalise "tA+7 hold begins" → "hold begins when the highest prior chip's shift and the newcomer's badge return complete (badge tA+6+3 = tA+9; top-chip shift tA−2+2·(N−2)+9); A4's tA+7 is the 2-chip case".
- **SFR-MOT-11-4** — A4 PROGRESS (:233): amend "last label +9 | hold begins" → "max(last label +9, highlight accent switch hl+24 + 1) | hold begins" (the accent lands 3 f after the last label when the highlight IS the last bar, and its discrete 1-frame switch puts the hold one frame after it).
- **SFR-MOT-11-5** — A4: add hold-begins rows (or a pointer) for CONTRAST (tA+13), IMAGE_BEAT (tA+56), STATEMENT (tA+9) — the table currently omits these three archetypes; the declarations now live in the component comments.
- **SFR-MOT-11-6** — D6 exception: note in the D6 row (or the A3.3 table) that ImageBeat's push (Easing.spring damping 200, ζ=10, no bounce) is the sanctioned A3.3/MANUAL D1 E.push exception, so the D6 linter check must carve it out.
- **SFR-MOT-11-7** — Stage-9 completeness: claim 9-05 item 2 (Contrast divider) is unimplemented in Contrast.jsx — orchestrator decides: accept as documented divergence or re-dispatch stage-9 to add the divider (it does not affect the stage-11 D7 hold: ends tA+6 < tA+13).

---

## §3 — OPEN (blocked / deferred)

None blocking. Deferred: the Contrast divider (SFR-MOT-11-7); STATEMENT trace-mode wiring (dormant — the future production wiring must pass `scene.trace` and the per-icon hold formula with it).
