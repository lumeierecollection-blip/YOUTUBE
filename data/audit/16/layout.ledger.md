# ledger — stage-16 FRM-02: atmosphere horizon / safe-rect

Audit run: `data/audit/16/review-oldts/` (ch-01 `debt-snowball-vs-debt-avalanche-shorts`).
Owner lane: layout / slots / safe zones / compiler / alignment.
Dates: diagnosis + fix design completed this session (2026-08-30); rendered verification is the render lane's follow-up (see SHARED-FILE REQUEST).

## 1. Symptom (pre-fix, measured)

`node scripts/frame-audit.js data/audit/16/review-oldts` — FRM-02 margin gate
(`CHECK-REGISTER.md` FRM-02: "No frame shows text crossing the safe rect";
probe resolution = `scripts/frame-audit.js` MARGINS, `MARGIN_FG_MAX = 0.001`):

| frame | video idx | scene (beat class) | marginFg | per-probe split (diagnose-margins.mjs) | audit verdict / other failures |
|---|---|---|---|---|---|
| 05 | 1219 | CINEMATIC_STATEMENT | 0.796% | headline-right 4.531% | margin only |
| 06 | 1463 | CINEMATIC_STATEMENT (HORIZON) | 0.023% | headline-right 0.129% | caption contrast 2.19 + headline 3.94 (COL-23, PRE-EXISTING) |
| 07 | 1706 | CINEMATIC_STATEMENT (HORIZON) | 1.127% | headline-right 6.162%, top 0.183% | margin only |
| 08 | 1950 | CINEMATIC_STATEMENT (ISOLATED) | 1.270% | headline-right 5.305%, top 1.367% | margin only |
| 09 | 2191 | CINEMATIC_STATEMENT (HORIZON) | 0.140% | headline-right 0.798% | caption contrast 2.26 + headline 3.94 (COL-23, PRE-EXISTING) |

Frames 00-04: marginFg 0.000 (00/04 pass; 01/02/03 fail ONLY on pre-existing COL-23 headline/caption contrast — untouched by this change).

Root cause (empirical, `data/audit/16/diagnose-margins.mjs`): ALL margin leaks come from
the CinematicStatement **ridge band** — a solid full-width dark fill (α 0.26, `#111`-family on
white, ~540/540 sampled columns per row) sitting at output y≈1244-1271 — straddling
`SAFE_SHORTS.bottom` = 1248 — plus a second-order **haze wash** in the top margin
(frames 07/08 only). The bottom margin is clean (mark-fan is sub-threshold at these
frames' ground-fade factors).

## 2. Geometry (re-verified against live source this session)

Transform chain (all constants read from code, cross-checked against measured pixels —
the pre-fix band bottom 1271 re-derives the settled-far constant to 0.1 px):

- `motion-graphics.jsx` DesignSpace, captions off: `translateY(110px)` (captionDrop), shorts S = 1.
- `stage.jsx` `Shot`: `translate(dy) scale(1.06)` settled DRIFT, `dy = −15.36` px; `transformOrigin` 50% 50%.
- `stage.jsx` `Plane` far (parallax 0.14, `visual/composition.js` `planeOffset`): adds `+13.21`.
- ⇒ far plane settled: `outY = 1.06·d + 50.25`. Ground/subject (k=1): `1.06·d + 37.04`. Drift start (e=0): `1.04·d + 71.6`.
- Ridge peaks reach up to 56 px above the horizon (`abstract-scenes.jsx` L225: `10 + seeded·46`).
- Statement text is **bottom-anchored**: `textBottom = CANVAS_H − (horizon − stakeH) + 26`,
  `stakeH = max(90, f.h·0.2)` (L213-217) — the earlier "text top ~1092" model was wrong;
  corrected positions below.

### Why DOWN, not up
Raising the horizon (e.g. to 1120) moves the band INTO the headline-right probe
(x940-1060, y964-1248): measured ~20% coverage — a hard fail. Lowering until the whole
band clears 1248 is the only direction that works, confirmed by full-width solid rows
(band is ~68 px tall, so no jump across the probe is possible between 1248 and 1271).

### Chosen value — `ATMOSPHERE_HORIZON_Y = 1200`
Constraint (worst case, drift-phase independent): `1.06·(h − 56) + 50.25 ≥ 1248 + 3`
(blur(3) edge spread) → `h ≥ 1188.8` → snap to the 8 px grid (§3.5) with headroom → **1200** (= 150·8).

At h = 1200 (settled far plane):
- ridge crest (max peak): `1.06·1144 + 50.25 = 1262.9` — 11.9 px below the probe strip.
- horizon line: `1.06·1200 + 50.25 = 1322.3`; ground: `1.06·1200 + 37.04 = 1309.0`.
- statement text stays inside the safe rect for both framings:
  HORIZON `[926, 1033]`, ISOLATED `[869, 937]` (bottom `CANVAS_H − (h − stakeH) + 26`).
- crest at drift start (e=0): `1.04·1144 + 71.6 = 1261.4` — also clear.

Correction trail: an earlier derivation proposed 1192; re-verification (a) corrected the
text-position model (bottom-anchored, not top) and (b) added one grid step of blur
headroom → 1200.

## 3. Changes made (this lane)

1. `src/skills/remotion-render/layout/slots.js` — added `ATMOSPHERE_HORIZON_Y = 1200`
   with full derivation (safe rects section, §8.3: "every layout number lives here and
   nowhere else"). The constant replaces `CANVAS_H * 0.6` hardcoded in three scene files.
2. `src/skills/remotion-render/layout/run-lint.js` — three derivation fixtures
   ("ATMOSPHERE_HORIZON_Y — world horizon vs safe rect"): grid multiple, worst-crest
   clearance `≥ 1248 + 3`, horizon-line-below-safe. These re-encode the derivation so a
   camera/design-space change in the render lane cannot silently re-open the FRM-02
   failure. NO new CHECK-REGISTER ID was invented — these are self-tests of an existing
   value, not a new gate (register namespace unchanged).

`node layout/run-lint.js`: 49 passed, 0 failed (incl. the 3 new fixtures).

DIFF (P2.5) — `git diff` of the two touched files hashed:
`7d8eb6e054a804044560c05ffc02704740f018cf`
(covers `layout/slots.js` + `layout/run-lint.js` vs HEAD; the tree carries
unrelated pre-existing stage-15 working-tree edits, so the hash includes
those too — the NEW bytes this session: slots.js §ATMOSPHERE_HORIZON_Y block
(L24-67 + `export const ATMOSPHERE_HORIZON_Y = 1200;`), run-lint.js import +
"ATMOSPHERE_HORIZON_Y — world horizon vs safe rect" fixture section.)

## 4. SHARED-FILE REQUEST — for the render-engine lane (`compositions/**`, not mine)

The value lives in `layout/slots.js` now; the three consumers must consume it (and one
alpha must change). Exact edits, verified against current file contents:

1. `src/skills/remotion-render/compositions/scenes/abstract-scenes.jsx`
   - Delete the local constant (L165-166) `const ATMOSPHERE_HORIZON_Y = CANVAS_H * 0.6;`.
   - Import `{ ATMOSPHERE_HORIZON_Y }` — recommended `from "../../layout/slots.js"`
     (the scenes' existing sibling imports already reach `../../visual/...`; a direct
     slots.js import matches `compositions/beats.js`, `captions/fromSrt.js`).
   - L196 (`const horizon = ATMOSPHERE_HORIZON_Y;`) unchanged.
2. `src/skills/remotion-render/compositions/scenes/stage.jsx`
   - L408: `const horizonY = CANVAS_H * 0.6;` → `const horizonY = ATMOSPHERE_HORIZON_Y;`
     plus the same import.
   - L422 (atmo-haze gradient stop): `stopOpacity={0.1 * a}` → `stopOpacity={0.06 * a}`
     — the second half of the FRM-02 fix (top-margin haze leak on frames 07/08:
     α 0.08-0.093·a sits 1-2 units over the audit's FG_DIFF=20 at a≈0.92-1.0; with
     0.06·a the worst top-row diff is ~13 < 20 at any a).
3. `src/skills/remotion-render/compositions/scenes/structure-scenes.jsx`
   - L107: `const groundY = CANVAS_H * 0.6;` → `const groundY = ATMOSPHERE_HORIZON_Y;`
     plus the same import; update the L103-106 comment that currently pins TimelineScene
     to "0.6 of the frame height" (its own contract says it "sits on the SAME horizon
     AtmosphereGround draws").
   - DO NOT touch L313 `lastY = CANVAS_H * 0.68` — that is a separate constant.
4. Optional: re-export `ATMOSPHERE_HORIZON_Y` from `compositions/layout-constants.js` via
   `scenes/primitives.jsx` L34-36 if the lane prefers routing all layout numbers through
   the existing scene import chain. Either wiring is fine; ONE source of truth is the
   requirement (slots.js).

Render-lane follow-up after the edits (already spec'd):
- Re-render frames 05-09 natively: `node data/audit/16/render-frame.mjs 1
  data/research/1/debt-snowball-vs-debt-avalanche-shorts-script.json
  data/audit/14/measure/debt-snowball-shorts-vo.mp3 <idx> <out.png> 1.0`
  (idx 1219→frame-05, 1463→frame-06, 1706→frame-07, 1950→frame-08, 2191→frame-09).
- `node scripts/frame-audit.js data/audit/16/review-oldts` (or a new dir + manifest).
- Acceptance: marginFg ≤ 0.1% on ALL frames; flatness ≤ pre-fix; contrast verdicts on
  06/09 UNCHANGED from pre-fix (they must keep failing COL-23 at the same numbers —
  see §5).

## 5. Post-fix expectations (predicted; the audit run proves them)

- 05/07/08: margin 0.80/1.13/1.27% → ~0 **PASS** (ridge no longer in the probe).
- 06/09: margin 0.02/0.14% → ~0; but **still FAIL on caption/headline contrast
  (COL-23) at ~2.19/3.94 and ~2.26/3.98** — PRE-EXISTING (present in the pre-fix
  audit-report.json, same code path; the ~42 px vertical shift keeps the statement in
  the same headlineText zone and the stake in the captionText zone, so the estimates
  are unchanged). Not regressions; out of this lane's scope.
- 01/02/03: unchanged (other scenes; horizon-independent).
- Known visual side-effects (not probe-gated; flagged for the human/vision reviewer):
  the ridge band now sits fully below 1248 — a ~68 px full-width dark ground strip
  under the safe line on frames 05-09 — and the 3 px accent stake still crosses 1248
  (now to ~1309). Both are the scene's "ground/floor" reading; the FRM-02 wording is
  about TEXT, and no text crosses. If the render lane judges the strip too heavy,
  shrinking/fading the ridge fill below 1248 is a scene-side option — out of this lane.
- Bottom-margin mark fan stays on its pre-existing knife-edge (marks i=10/11 at
  α 0.088-0.0935·a land in y1600-1760 for any horizon; measured clean at these frames'
  fade factors; ~±2 units from FG_DIFF at a=1 — pre-existing, unchanged).

## 6. Protocol status (CROSSCHECK-PROTOCOL.md Part 2)

- Phase 1 (specs collected & verified, not trusted on authority): LAYOUT-SYSTEM.md
  (slot tables Part 3, L2 Part 6, §8.3), MOTION-GRAPHICS-MANUAL.md A1.3/A1.4/A2.1,
  CHECK-REGISTER.md FRM-02/COL-23, frame-audit.js constants (read, not modified),
  motion-graphics.jsx captionDrop, stages.jsx Shot/Plane, visual/composition.js
  planeOffset, abstract-scenes.jsx L165-306, stage.jsx L380-441, structure-scenes.jsx
  L103-107 — all re-read this session against the claims in the ledger.
- Phase 2 (changes): this ledger + slots.js + run-lint.js (above), verified by
  `node layout/run-lint.js` (49/49).
- Phase 3 (counter-check): independent re-derivation requested (see next step).
- Render-lane edits (SFR) are NOT mine and will be verified by their owner + the
  frame-audit re-run.
---

## COUNTER-CHECK 1 � REJECT (attempt 1)

Verifier verdict on claim as first worded ("�thereby fixing the stage-16
FRM-02 margin-gate failures�"): **REJECT**.

- **(b) mechanism false as implemented.** ATMOSPHERE_HORIZON_Y was imported
  only by the run-lint fixtures; the three scene files (abstract-scenes.jsx
  L166, stage.jsx L408, structure-scenes.jsx L107) still hardcode
  CANVAS_H * 0.6 = 1152, so the ridge still crosses the y1248 strip and the
  frames were NOT fixed by the diff alone. Correct: the claim overstated the
  diff; scene consumption is the render lane's SHARED-FILE REQUEST.
- **(a) doc/fixture plane conflation.** slots.js comment cited the far-plane
  horizon edge (1322.3 = 1.06�1200 + 50.25, the ridge fill's bottom) while
  the fixture check uses the ground-plane constant (1309.04 = 1.06�1200 +
  37.04, k=1) without attributing the two planes � internally inconsistent
  wording. Real defect; fixed in attempt 2.
- Verifier could not run the gate (permission allow-list), judged by reading.

Per CROSSCHECK-PROTOCOL P3.5: change reverted (both files restored to the
prior working-tree state), claim re-entered Phase 1 with the rejection text.
This is re-attempt 1 of 2.

## CLAIM-layout-012 (rev 2 � re-attempt after REJECT)

ASSERTION   The shared atmosphere-horizon layout number belongs in
            layout/slots.js (�8.3) and its derived value 1200 (= 150�8,
            grid �3.5) maps the worst-case CINEMATIC_STATEMENT ridge crest
            (1.06�(1200 - 56) + 50.25 = 1262.9, far plane parallax 0.14,
            settled DRIFT camera) below the frame-audit headline-right
            strip (y = 1248 + 3) and maps the ground-plane horizon line
            (1.06�1200 + 37.04 = 1309.0, k=1) below SAFE_SHORTS.bottom
            (1248); run-lint.js fixture checks re-encode that derivation so
            the stage-16 FRM-02 margin failures on frames 05-09 (pre-fix
            marginFg 0.80/0.02/1.13/1.27/0.14%) cannot silently re-open.
            THIS diff is the constant + fixtures only: consuming the
            constant in the three scene files (and the haze 0.06�a top-stop)
            is the render lane's SHARED-FILE REQUEST (�4 above) and is NOT
            claimed by this diff.
SPEC REF    LAYOUT-SYSTEM �8.3 ("every layout number lives here and nowhere
            else"); �3.5 (8 px grid).
SOURCES     [1] first-party: repo live source � compositions/scenes/stage.jsx
            Shot/Plane (translate dy = -15.36 settled, scale 1.06, far
            parallax 0.14), visual/composition.js planeOffset, motion-
            graphics.jsx captionDrop 110 (captions off), abstract-scenes.jsx
            L213-228 (stakeH max(90, f.h�0.2), text bottom CANVAS_H -
            (horizon - stakeH) + 26, ridge peaks 10 + seeded�46).
            [2] first-party: measured pixels � data/audit/16/review-oldts/
            audit-report.json + diagnose-margins.mjs (band bottom 1271.4 =
            1.06�1152 + 50.25; per-probe splits 0.80/0.02/1.13/1.27/0.14%).
RE-VERIFIED YES (all re-read this session; the 1271.4 band bottom
            re-derives the settled-far constant to 0.1 px).
CURRENT     slots.js: no horizon constant (scenes hardcode CANVAS_H * 0.6
            = 1152 � the value that straddles 1248 with the ridge band at
            output ~1215-1271).
DELTA       No layout-number home for the world horizon; the hardcoded 1152
            leaks 0.80/0.02/1.13/1.27/0.14% into the headline-right probe.
PLAN        Delete: nothing (adding).  Replace with: ATMOSPHERE_HORIZON_Y =
            1200 in slots.js + 3 derivation fixtures in run-lint.js; SFR for
            the three scene-file consumers.

## ATTEMPT 2 — re-implemented and re-verified

- slots.js: `ATMOSPHERE_HORIZON_Y = 1200` + derivation comment, with the
  plane attribution fixed from the REJECT (far-plane ridge edge 1322.3 vs
  ground-plane line 1309.0 = 1.06·1200 + 37.04, k=1 — both stated).
- run-lint.js: import + 3 fixture checks (grid multiple; crest ≥ 1248+3;
  ground-plane horizon line > 1248).
- Gate: `node layout/run-lint.js` → 49 passed, 0 failed.
- DIFF (P2.5): `a1029dc34a7403b1e1affe5f4f4a4e1f29996f5d` — hash of
  `git diff` for layout/slots.js + layout/run-lint.js vs HEAD (tree carries
  unrelated pre-existing stage-15 edits; the new bytes are the two blocks
  above).
- Phase 3 re-dispatch: independent counter-check (claim rev 2).

## ATTEMPT 2 — VERDICT: CONFIRM (caveats recorded)

- Counter-check re-derived from live source: settled scale 1.06, dy −15.36,
  far parallax 0.14 → offY +13.21, captionless drop 110: crest
  1.06·(1200−56)+50.25 = 1262.9 ≥ 1251 ✓, ground-plane horizon
  1.06·1200+37.04 = 1309.0 > 1248 ✓, 1200 = 150·8 ✓. Implementation scope
  (constant + 3 fixtures + import; scene files NOT part of the diff) exact.
- Caveat 1 (immaterial): the far-plane constant is strictly 1.06·d + 51.04 —
  the Plane's offY(+13.21) sits INSIDE Shot's scale(1.06), so offY is scaled
  too (13.21·1.06 = 14.0), not 13.21. 0.79 px; crest clearance becomes 12.7
  px (BIGGER), ground-plane 37.04 unaffected (offY = 0 at k = 1), thresholds
  and verdict unchanged. Measured band bottom 1271 cannot distinguish 0.8 px.
- Caveat 2 (comment overstatement, FIXED post-verdict): my fixture comment
  claimed a camera/caption-drop change "cannot silently drift the horizon
  back" — false, the fixtures hardcode the settled mapping. Comment now says
  the fixtures pin the value under the CURRENT constants; future transform
  changes must update derivation + value together, with the FRM-02 frame
  audit as the backstop. Comment-only edit; constant/fixtures byte-identical
  to the verified diff except this comment. `node layout/run-lint.js` re-
  run after the edit: 49 passed, 0 failed.
- Post-verdict diff hash (comment-only delta): not re-hashed separately —
  the verified sections are unchanged; the ledger records the wording fix
  above instead.
- LAYOUT LANE COMPLETE: constant + derivation + fixtures + SFR + 2
  protocol passes documented. The render lane's consumption (SFR §0), the
  frames 05-09 re-render, and the FRM-02 re-run are the follow-up.
