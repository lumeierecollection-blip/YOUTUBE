# Stage 12 — Layout Audit Ledger

Audit owner domain: **layout, slots, safe zones, the compiler, alignment**.

Controlling prompt (overrides the five spec docs where they conflict): `visual guide.txt`
§2 DELETE BEFORE ADDING (no wrapping/recoloring/decorative filler), §10 use of frame
(fore/mid/background, depth, off-center framing), §30 editorial density
(background=environment, midground=mechanism, foreground=detail; no AI effects),
banned-list ≈lines 1080-1114.

Register IDs used (per CHECK-REGISTER §0.2.1): **LAY-18**, **LAY-19**.

Workflow: three-phase per `CROSSCHECK-PROTOCOL.md` Part 2:
- Phase 1 = claim card written BEFORE any edit.
- Phase 2 = one claim / one diff, delete-then-replace, diff hash recorded.
- Phase 3 = independent counter-check via `verify-independent` with CLAIM/DIFF/FILES/GATES
  (never pass sources).

---

## CLAIM-layout-181 — LAY-18 Stage occupancy ≤ 253,000 px²

- **STATUS**: OPEN (Phase 1 card — no implementation yet)
- **ASSERTION**: A tier-1 compiled lint check `lintL18(frames, slots)` reports a failure
  whenever the total "occupied geometry" inside the Stage slot exceeds 253,000 px².
  Occupied geometry = the summed painted area of non-structural stage-slot rects: for a
  `chart` rect with `chart.bars[]`, the sum of each bar's `w*h`; otherwise the rect's
  `w*h`; everything clipped to the Stage slot bounds. Persistent chrome (kicker/caption/rail)
  and the fixed skeleton (rail/accent) are not stage content and are excluded.
- **SPEC REF**: DETAIL-REFERENCE B4.1 ("At least 45% of the Stage slot must be ground at every
  frame. 840 x 548 = 460,320 px²; occupied geometry may not exceed 253,000 px²."), B4.2
  (the rule that varies is Stage density, not the always-occupied kicker/headline/caption
  slots); CHECK-REGISTER LAY-18 ("Stage occupancy <=55% of slot area", MINOR, tier 1,
  stage 12, method `compiler`).
- **NOTE (threshold reconciliation)**: B4.1 computes 55% exactly as 253,176 px² when taken
  as a percentage of 460,320, but B4.1 itself states the operational bound as "253,000 px²"
  and CHECK-REGISTER keys the check on "<=253,000 px²". The register is source of truth for
  thresholds; the constant implemented is **253,000** (the stricter of the two).
- **SOURCES (grounding, principle-level)**:
  - gridmakerpro.com/learn/negative-space — "The 60% rule: Tech-editorial design
    conventionally aims for 60%+ negative space on a typical content page"; negative space as
    a percentage of the picture plane; cites Material Design 8pt spacing and figure/ground
    perception. Grounds the ">= 40% ground / <= 60% occupied" editorial negative-space floor.
  - designyourway.net — macro vs micro whitespace as a structural element.
  - affinity.studio — negative space (macro/micro whitespace) as a deliberate framing device.
  - The *specific* threshold numbers (55%, 253,000 px²) come from DETAIL-REF B4.1 /
    CHECK-REGISTER LAY-18, the register being the source of truth for threshold values.
- **RE-VERIFIED**: N/A (Phase 1 — nothing implemented to re-verify).
- **CURRENT (computed value, compiler-shaped fixture)**: `ResolvedFrame[]` fixture
  "goodChart": bars `{x:88,w:376,h:80}` (30,080) + `{x:472,w:376,h:304}` (114,304) =
  **144,384 px² <= 253,000** (pass). Stage slot `{x:48,y:392,w:840,h:548}` = 460,320 px²;
  55% = 253,176; register bound 253,000. A chart's *container* box 760x464 = 352,640 >
  253,000, which would be a false positive — the box includes plot padding that is ground,
  so occupied is measured from bars (painted figure), never the container box.
- **DELTA / PLAN**: Add `lintL18(frames, opts)` to `src/skills/remotion-render/layout/lint.js`;
  add pass fixture (goodChart) + fail fixture (stage packed so occupied > 253,000) with a
  `check()` assertion set in `run-lint.js`; wire `lintL18` into `lintAll` (which currently
  runs over `[goodFull, goodChart]` — both must stay green) and into `lintTier1`. Method is
  pure-Node over `ResolvedFrame[]` (E1 compiler-shaped). E3 satisfied by a fail fixture that
  should fail.

---

## CLAIM-layout-191 — LAY-19 no two rects within 24 px

- **STATUS**: OPEN (Phase 1 card — no implementation yet)
- **ASSERTION**: A tier-1 compiled lint check `lintL19(frames)` reports a failure whenever
  two distinct on-screen content objects approach closer than 24 px. Participants = emitted
  rects that are neither `persistent` (kicker/caption/rail) nor `structural` (rail/accent) —
  i.e. the compiler's content object types (headline, chart-as-one-object, support, etc.).
  For a pair visible in an overlapping (or undeclared) frame range, the minimum distance
  between the two bounding boxes is `sqrt(max(0,hGap)^2 + max(0,vGap)^2)`; a distance < 24 px
  is a failure (DETAIL-REF B4.3: "below 24 px two elements read as one object with a seam").
- **SPEC REF**: DETAIL-REFERENCE B4.3 ("No element may sit closer than 24 px to another
  element's bounding box. Below 24 px, two elements read as one object with a seam.");
  CHECK-REGISTER LAY-19 ("no two rects within 24 px of each other", MINOR, tier 1, stage 12,
  method `compiler`).
- **SCOPE DECISION (documented)**: The fixed layout skeleton (kicker/caption/rail persistent
  roles and the rail/accent structural strokes) is held apart by the slot/safe-zone system and
  must NOT be a participant (rail overlaps every content box geometrically by design — a naive
  all-pairs rule would false-positive). B4.3's "two elements read as one object with a seam"
  is about distinct composed objects in the depth field. Similarly, bars *within one chart*
  are NOT checked against each other: `goodChart` bar gutter is 8 px < 24 px by design
  (GRID.gutter), and Gestalt proximity groups them as ONE object. LAY-19 operates on
  "rect" = one emitted content object.
- **SOURCES (grounding, principle-level)**:
  - NNGroup — Gestalt Proximity (first-party HCI): "Using varying amounts of whitespace to
    either unite or separate elements is key to communicating meaningful groupings." Grounds
    that insufficient separation makes separate objects read as one group.
  - gestaltprinciples.com/principles/proximity — "Objects placed too close together are
    perceived as a group... a label drifting too close to the wrong field." Grounds the
    "read as one object" fusion defect below a distance threshold.
  - The *specific* 24 px figure comes from DETAIL-REFERENCE B4.3 / CHECK-REGISTER LAY-19
    (register = source of truth for thresholds).
- **RE-VERIFIED**: N/A (Phase 1 — nothing implemented to re-verify).
- **CURRENT (computed value, compiler-shaped fixture)**: `ResolvedFrame[]` fixture
  "goodChart" has NO headline (rects = kicker/rail/chart/caption); its chart is the only
  non-persistent non-structural participant, so LAY-19 passes trivially (no pairs). To give
  the positive case real geometry a dedicated fixture `l19WellSeparated` (b37) was added:
  headline `{y:964}` vs chart container bottom `{y:896}` → vertical gap **68 px >= 24** (pass).
  Fixture "goodFull": single non-persistent non-structural participant (headline) → no pairs
  (pass). Bars in `goodChart` have an 8 px gutter (by design, intra-chart → not a LAY-19 pair).
- **DELTA / PLAN**: Add `lintL19(frames)` to `src/skills/remotion-render/layout/lint.js`;
  add pass fixtures (`l19WellSeparated` headline-vs-chart 68 px gap, `goodFull` single
  participant, `goodChart` single participant) + fail fixture (`l19TooClose` two support
  rects 10 px apart) with a `check()` assertion in `run-lint.js`; wire `lintL19` into
  `lintAll`. Method is pure-Node over `ResolvedFrame[]` (E1 compiler-shaped). E3 satisfied
  by a fail fixture. (Corrected after first counter-check REJECT — the original card
  misstated that `goodChart` contains a headline; it does not.)

---

## Verification log

### PHASE 2 — implementation diff (both claims, one combined change, 2026-08-29)

Files changed (ownership: layout):
- `src/skills/remotion-render/layout/lint.js` (+ `lintL18`, `lintL19`; wired `lintAll` to run
  them after `lintL12`).
- `src/skills/remotion-render/layout/run-lint.js` (+ `lintL18`/`lintL19` imports, fixtures
  `l18OverOccupied` (b35), `l19TooClose` (b36), `l19WellSeparated` (b37, added on re-entry),
  assertions for the new checks, `lintAll` label updated L1–L12 + LAY-18/L19).
- `data/audit/12/audit-layout.ledger.md` (this ledger).

Diff hash (lint.js + run-lint.js only, initial implementation): `55f24344e37c74a39cf64510a9dae3dbad54af37`.
Final diff hash after LAY-19 re-entry: `a09e7d35e92016074af1026c26bd48d1db5f8ab3`.

Note: pre-existing uncommitted working-copy changes to files outside this audit's ownership
(`.opencode/agents/*`, `data/audit/0/GATE.md`, and other stage-12 ledgers/probes) are present
in the tree but are NOT part of this change; this ledger's diff is scoped to the owned files
above.

Verification run (initial): `node src/skills/remotion-render/layout/run-lint.js` →
**45 passed, 0 failed, exit 0** (was 38 passed / 0 failed at baseline).
Final run (after LAY-19 re-entry): **46 passed, 0 failed, exit 0** (+1 b37 assertion).

New-assertion evidence (all green):
- `lintL18([l18OverOccupied])` — 4 bars × 168×540 = 362,880 px² > 253,000 → 1 failure,
  message `b35: stage occupied geometry 362880px² (78.8% ...) exceeds the 253000px² (≤55%) budget`.
- `lintL18([goodChart])` — bars 144,384 px² ≤ 253,000 → 0 failures, observation
  `occupiedPx2 === 144384` (bars counted, not the 352,640 px² blank container).
- `lintL18([goodFull])` — no stage content → 0 failures.
- `lintL19([l19TooClose])` — two `support` rects 10 px apart → 1 failure,
  `b36 support is 10.0px from support (want ≥ 24px ...)`.
- `lintL19([l19WellSeparated])` (b37, added on re-entry) — headline y964 vs chart bottom
  y896, real 68 px gap → 0 failures (positive boundary case with genuine two-participant
  geometry).
- `lintL19([goodChart])` — chart is the only non-persistent non-structural participant → 0
  failures (no pairs; NOTE: goodChart has NO headline).
- `lintL19([goodFull])` — single non-persistent non-structural participant (headline) → 0 failures.
- `lintL19([l18OverOccupied])` — intra-chart bars (8 px gutter) are one object → 0 failures.
- `lintAll([goodFull, goodChart])` still passes across all 14 checks; `lintAll([l12OutOfRange])`
  still fails the combined run.

### REJECT → re-entry (LAY-19, 2026-08-29)

The first independent counter-check REJECTED CLAIM-layout-191: the original card asserted that
`goodChart` contains "headline y=964 vs chart bottom y=896 → 68 px gap". That was FALSE —
`goodChart` (b21) rects are kicker/rail/chart/caption with NO headline; LAY-19 passes it
because the chart is the only non-persistent non-structural participant, not because of any
68 px gap. The lint code itself was verified correct (participant filter, distance formula,
fail fixture b36, bars-not-iterated, lintAll wiring all confirmed by the counter-check); the
defect was a FALSE ASSERTION in the claim documentation.

Correction (re-entry):
- Card CURRENT/DELTA corrected to state `goodChart` has no headline.
- Added fixture `l19WellSeparated` (b37) — headline `{y:964}` + chart `{y:896}` (68 px gap),
  two genuine participants — so the LAY-19 positive boundary case is really exercised.
- Fixed the misleading `run-lint.js` test label ("headline and chart in goodChart keep a 68px
  gap" → now tests the b37 fixture directly).

Diff hash after re-entry (lint.js + run-lint.js only): `55f24344e37c74a39cf64510a9dae3dbad54af37`
(unchanged: `lint.js` was not altered on re-entry; `run-lint.js` gained the b37 fixture and a
label fix — recompute below).

Recomputed diff hash (lint.js + run-lint.js only, after re-entry): `a09e7d35e92016074af1026c26bd48d1db5f8ab3`.

Verification run after re-entry: `node src/skills/remotion-render/layout/run-lint.js` →
**46 passed, 0 failed, exit 0** (was 45 pre-reject; +1 for the b37 fixture assertion).

E-gates: E1 method=compiler — the numbers come from `ResolvedFrame[]` computation
(fixtures are `ResolvedFrame[]`-shaped; real ch-fixture end-to-end is blocked by no-network,
see claim cards). E3 fail fixtures provided (b35, b36). The `verify` gate
(`verify-compositions.js`) does not import lint.js, so the new checks cannot perturb render
verification.

### PHASE 3 — independent counter-checks

**CLAIM-layout-181 (LAY-18)** — first pass: **CONFIRM** (verify-independent, ses_fb198af8).
Evidence: `lintL18` exists (lint.js ~313-347, new in working tree), pure-Node over
`ResolvedFrame[]`, no JSX (E1). Stage slot `{48,392,840,548}` → bounds 48..888 / 392..940;
bars-summed area 376×80 + 376×304 = 144,384 (goodChart) ✓; `l18OverOccupied` 4×168×540 =
362,880 > 253,000 → exactly 1 failure with the exact claimed message ✓; `lintAll` includes
`lintL18` (line ~422) and `lintAll([goodFull, goodChart])` passes all 14 by per-check trace ✓;
E3 real fail input present ✓.

**CLAIM-layout-191 (LAY-19)** — first pass: **REJECT** (verify-independent). The card misstated
that `goodChart` contains a headline at y=964 with a 68 px gap; `goodChart` has no headline —
its chart is the sole participant, so it passes trivially. Lint code itself was correct; the
defect was a false assertion in the claim documentation.

**CLAIM-layout-191 (LAY-19)** — re-entry: **CONFIRM** (verify-independent, ses_fb194471).
Evidence: participant filter excludes persistent/structural ✓; formula
`hypot(max(0,hGap),max(0,vGap))` matches ✓; `l19TooClose` (b36) yields exactly 1 failure with
message `b36 support is 10.0px from support (want ≥ 24px; below that two elements read as one
object with a seam)` ✓; `l19WellSeparated` (b37) headline y964 vs chart bottom y896 → 68 px →
0 failures ✓; `goodChart` (no headline) / `goodFull` (single participant) pass trivially ✓;
bars-in-chart not iterated (loop over frame.rects) ✓; E1/E3 hold; `lintAll([goodFull,
goodChart])` passes all 14 ✓.

Final status: **both LAY-18 and LAY-19 implemented, wired into `lintAll`, all assertions green
(46 passed / 0 failed), independent counter-checks CONFIRMED.** No shared-file request was
needed (all edits within the layout ownership list).
