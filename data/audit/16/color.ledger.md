# Stage 16 — audit-color ledger (COL-23 gate re-audit)

Lane: `audit-color` · Domain: palettes, OKLCH, contrast, elevation, background.
Owned files: `config/channels.json`, `styles/tokens.js`, `effects/CanvasGrain.jsx`,
`effects/generate-editorial-lut.mjs`, `data/audit/**`. Everything else is
read-only here; scene/composition changes are filed as SHARED-FILE REQUESTS.

Date: 2026-08-30. Script under test: `data/research/1/debt-snowball-vs-debt-avalanche-shorts-script.json`
(ch-01, white bg). Render batch: `data/audit/16/review-oldts/` (native 1080x1920,
10 frames at idx 0/244/488/731/975/1219/1463/1706/1950/2191; SRT/VO from
`data/audit/14/measure/debt-snowball-shorts-vo.{srt,mp3}`; `render-frame.mjs`).

---

## 0. Diagnosis of the COL-23 gate failure (measured, not assumed)

Gate: `scripts/frame-audit.js` `estimateForeground()` + `wcagContrast()` on the
headlineText zone (x64,y964,824x176) and captionText zone (x64,y1152,824x96);
floor 4.5:1, no rounding (same as COL-23 entry, CHECK-REGISTER L236).

### 0.1 Audit result (this batch, pre-change, exit 1)

| frame | idx | beat (archetype / phrase) | captionContrast | headlineContrast | marginFg | result |
|---|---|---|---|---|---|---|
| 00 | 0 | CONTRAST "SNOWBALL VERSUS" | 12.00 | 17.94 | 0 | PASS |
| 01 | 244 | HERO_NUMBER "costs you $13,600" | 12.00 | **3.03 (144,144,144)** | 0 | FAIL |
| 02 | 488 | HERO_NUMBER "On a realistic $10,636" | 12.07 | **2.97 (145,145,145)** | 0 | FAIL |
| 03 | 731 | HERO_NUMBER "$2,838 in interest" | 4.50 (115,115,115) | 4.50 | 0 | PASS (razor) |
| 04 | 975 | HERO_NUMBER "months and $3,053" | 4.70 | 4.84 | 0 | PASS |
| 05 | 1219 | CONTRAST "CALCULATORS MISS POINT" | **4.20 (14,140,61)** | 17.16 | 0.81% | FAIL |
| 06 | 1463 | STATEMENT "ONES WHO CLOSED ACCOUNTS" | **2.13 (123,189,148)** | **4.15 (122,122,122)** | 0.10% | FAIL |
| 07 | 1706 | STATEMENT "SMALL WINS KEEP PEOPLE" | 4.78 | 19.98 | 2.30% | FAIL (margin only) |
| 08 | 1950 | STATEMENT "SNOWBALL YOU'VE QUIT" | 4.71 | 19.87 | 2.13% | FAIL (margin only) |
| 09 | 2191 | STATEMENT "FOLLOW NUMBERS" | **2.13 (123,189,148)** | **4.09 (123,123,123)** | 0.17% | FAIL |

3/10 pass. Same failure pattern reproduced in the parallel batch
`data/audit/16/review-full/audit-report.json` (there: frame-00 caption 4.34 — glyph
rgb(117,117,117) = textDim on bg rgb(248,248,248) — and frame-03 4.50 razor).

### 0.1a GATE RULE (re-verified, quoted from the gate source, 2026-08-30)

`scripts/frame-audit.js` L20 / L332 / L354-357: "Exit 1 if any check FAILS";
per-frame `pass: violations.length === 0`; run fails when ANY frame has a
violation. **There is no "N-of-10" threshold** — the "3/10 frames passed"
lines in earlier reports were counts, not a gate rule. Consequence: this
stage's COL-23 gate cannot pass on palette alone (7 of the 10 sampled
frames carry non-palette violations after the fix); the layout/FRM-02 side
must land for the gate to exit 0. Recorded so no later stage misreads the
count as a pass rule.

### 0.2 Element identity per failing measurement (from `diagnose-col23.mjs` + column dumps)

- **frames 01/02 headline (144,145)** — a ~3px-wide VERTICAL LINE spanning
  x195 (f01) / x84-87 (f03) across the whole headline+caption probe bands
  (528 fg px = 176 rows x 3px), shown by the column dump. On frame-03/04 the
  same element (x84-87, 4px) measures (115,115,115) = `textDim` at ~full
  coverage -> 4.50/4.84. On 01/02 it is at ~80% partial coverage
  (144 ~= 0.81*115 + 0.19*249). A `textDim` line at PARTIAL AA coverage —
  geometry, not a palette role at full coverage.
- **frame-05 cap (14,140,61) = 4.20** — accent green value text of the CONTRAST
  scene whose body sits at y~1060-1139 (headline-zone lower band); the caption
  probe catches only its bottom AA rows at ~96% coverage AND the grained bg.
  Pure accent (0,136,48) vs pure white = 4.60, but (14,140,61) vs grained
  rgb(251,251,251) = 4.20. Colour headroom issue (see claim card) + boundary
  geometry.
- **frames 06/09 cap (123,189,148) = 2.13** — the CinematicStatementScene's
  ACCENT STAKE (1px line, strokeWidth 3, `stroke={colors.accent}`, x1=x2=textCx)
  at ~50% AA coverage inside the caption band. The layout lane's own diagnostic
  (`data/audit/16/diagnose-geometry.mjs`) puts the horizon ridge/stake at output
  y1258-1271 and the phrase block bottom at y1075-1090 under the
  `CAPTION_RESERVE_Y = 110` translate (compositions/layout-constants.js) +
  camera — i.e. scene decor is translated INTO the two probe bands.
  50%-coverage AA blends CAP at ~2:1 — NO flat colour, however dark, can pass
  4.5:1 there. Unfixable in the colour lane; geometry (FRM-02) + SFR.
- **frames 06/09 headline (122,122,122) = 4.15 / (123,123,123) = 4.09** — a wide
  light-gray band at y970-1016, x259-626, n=7920, mode (135) ~= ink (#111111)
  at ~50-55% opacity over bg (0.55*17+0.45*249 = 121). That is an
  opacity-blended ink fill/phrase mid-ramp, NOT a role colour at full coverage.
  No palette change fixes a ~55%-opacity blend (same convex-bound argument).
  Timing/placement issue -> FRM-02 + SFR.
- **frames 07/08 margin leaks** (top-margin y110-178 n=587; headline-right-margin
  y1224-1246) — stage/atmosphere decor above the SAFE rect / leaking past the
  right edge of the headline zone. Geometry (FRM-02 scope), not colour.

### 0.3 Flat-background check (A2.1 / PART 4.6)

All sampled bg bands are flat within the constant: bg modes rgb(248-253), grain
amplitude ~+-2-3. No bg regression. The flat value that MATTERS and that no one
checked: the grained white bg is NOT #FFFFFF anymore — it measures rgb(248-253)
at the pixel level. Role colours solved against pure #FFFFFF therefore measure
SHORT of their register guarantee at the pixel level (COL-23's whole purpose,
per its register note: "pixel-level confirmation of COL-02/05's role-level
guarantee"). That is this lane's defect and this stage's colour fix.

---

## CLAIM-color-16-001 — COL-02/COL-05 solve target is 4.6:1 against PURE bg, which
measures below 4.5:1 against the grained rendered bg

```
ASSERTION   WCAG AA normal-text contrast (>=4.5:1, unrounded) is measured
            against the actual rendered background; the repo solves accent
            (COL-02) and textDim (COL-05) to 4.60-4.64:1 / 4.61-4.62:1 against
            pure #FFFFFF (tokens.js pickAccentL/pickTextDimL default target
            4.6), which measures 4.45-4.47:1 against the real grained bg
            (measured mode rgb(248-253) on ch-01 renders) and 4.20-4.50:1 at
            the pixel gate — a real shortfall below the 4.5 floor.
SPEC REF    MOTION-GRAPHICS-MANUAL A2.4 (L92-111: "Contrast is a hard gate,
            computed not eyeballed"; 4.5:1 normal text; "Ratios cannot be
            rounded up — #777777 at 4.47:1 does not meet a 4.5:1 requirement");
            CHECK-REGISTER COL-02 (L215), COL-05 (L218), COL-23 (L236, note).
SOURCES     [1] first-party: w3.org/WAI/WCAG22/Understanding/contrast-minimum
            — "contrast is measured with respect to the specified background
            over which the text is rendered in normal usage"; 4.5:1 normal
            text; ratios not rounded (4.499 fails); (L1+0.05)/(L2+0.05) with
            sRGB 0.04045/12.92/2.4 piecewise relative luminance.
            [2] third-party: webaim.org/articles/contrast/ — "#777777 ...
            4.47:1 contrast ratio — does not meet this requirement"; AA
            threshold 4.5:1 normal text, unrounded.
            [3] w3.org/WAI/WCAG22/Techniques/general/G145 — for aliased
            letters measure "two pixels in from the edge of the letter"
            (repo's worst-pixel estimateForeground is thus STRICTER than
            WCAG's own AA measurement convention; not loosened here).
RE-VERIFIED YES — both live pages fetched 2026-08-30; thresholds and formula
            unchanged. NOTE: CHECK-REGISTER §3.3 L206's "clears >=4.5:1
            against a *pure* bg" is RE-VERIFIED: CHANGED — the pixel gate
            (COL-23) measures the real grained bg, and the roles fail there.
CURRENT     tokens.js L168 `pickAccentL(hue, chroma, bgHex, target = 4.6)`;
            L193 `pickTextDimL(bgHex, target = 4.6)`; paletteFromHues calls
            both with the default (L217-218). ch-01 white: accent #008830 =
            4.6009:1 vs pure, 4.4668:1 vs rgb(251,251,251) (computed);
            textDim #757575 = 4.6075:1 vs pure, 4.450:1 vs rgb(251,251,251)
            (computed). Measured at the gate: frame-03/04 textDim 4.50/4.70/4.84
            (razor), frame-05 accent 4.20 (AA+grained), review-full batch
            textDim 4.34 on bg 248.
DELTA       Roles land 0.03-0.30 below the 4.5 floor against the grained bg.
            Target sweep (computed, all 17 channels): 5.0-vs-pure gives rgb(251)-
            based accent 4.83-4.96 and textDim 4.86; the FINAL implemented 5.3-
            vs-pure gives (measured on real frames, per Phase 3 counter-check)
            full-coverage roles 4.99-5.47 against the grained bg — textDim
            5.02:1 and accent 4.99:1 on the worst draw rgb(248), 5.15/5.12 on
            rgb(251); margin >=0.49 across the measured grained range. COL-03
            survives: accent/textPrimary 3.30-3.56 (floor 2.5). AA-blend pixel
            failures (45-96% coverage, 50-55% opacity) stay 2.19-4.44:1 after
            the fix — bounded by the convex blend argument, geometry lane.
PLAN        Delete: default `target = 4.6` in pickAccentL/pickTextDimL; the
            "against a PURE bg" comment framing on L26-28/L204.
            Replace with: `target = 5.3` — two measured passes (5.0 then 5.3,
            both verified against re-rendered frames; 5.0 left frame-03's
            AA-phased line pixel at 4.40-4.44, the 5.3 harden carries full-
            coverage roles >=5.02 and the ~94%-coverage line pixel to ~4.44-4.80
            depending on the AA draw) — with comments stating the target exists
            so COL-02/05 clear the COL-23 pixel gate measured against the
            grained RENDERED bg, and that opacity/coverage-blend failures are
            geometry (FRM-02), not palette.
```

## Phase 2 — change + verification (2026-08-30)

### P2.1 Change applied (delete-then-replace on OWNED file `src/skills/remotion-render/styles/tokens.js`)

ONE claim (CLAIM-color-16-001), ONE file, four hunks, two measured passes:

1. `export function pickAccentL(hue, chroma, bgHex, target = 4.6)` -> `target = 5.3`
   (with the doc comment: 5.3 is the smallest target whose ~94%-coverage AA
   blend clears 4.5 on the darkest grained draw; convex-bound failures belong
   to FRM-02 — quoted in full in the file).
2. `function pickTextDimL(bgHex, target = 4.6)` -> `target = 5.3`.
3. Header block L23-28: "PURE white or PURE black background" -> "measured
   against the actual rendered background (pure bg + CanvasGrain) — the
   5.3-vs-pure solve target leaves headroom for the grained white bg".
4. `paletteFromHues` doc L213-216: "holds against a PURE bg" -> "holds when
   measured against the actual rendered (grained) bg".

Diff hash (working tree vs HEAD, `git diff -- tokens.js`, UTF-8):
`3743F05B0CC97540825AE31B1BBB1DA8159D9C7B407FE5B4B314916D72465F66`
(full diff also contains the UNRELATED Stage-12 dot-grid block that was
already uncommitted in the working tree before this session; the claim's
bytes are hunks 1-4 only). Diff copy: `data/audit/16/tokens-final.diff.txt`.

Pass-1 record: target 5.0 first (claim card as originally written); re-render
showed frame-03's line pixel at 4.40-4.44 (bg draw 248/249 jitter) — a
94%-coverage AA pixel, not the 96%/4.70 the card's DELTA had assumed.
Recorded the divergence, hardened to 5.3 (pass 2), re-rendered, re-audited.
The claim itself did not change; the parameter was amended by measurement.

### P2.2 Gate re-verification (live module, defaults now 5.3)

All 17 channels, `paletteFromHues` + `checkPaletteGates` + grained checks
(white-mode grained rgb(251) and worst-draw rgb(248) both probed):
- accent vs grained: 5.12-5.25:1 (vs rgb(251)); worst draw rgb(248): 4.99:1
  (ch-01 #007D26; verified in Phase 3)
- textDim vs grained: 5.02:1 on rgb(248) / 5.15:1 on rgb(251) (white),
  5.32 (black)
- c02 (accent/bg) 5.30-5.34 (gate >=4.5); c03 (accent/textPrimary) 3.30-3.56
  (gate >=2.5); c04 17.62-18.88 (gate >=3); c05 (textDim/bg) 5.32-5.33
  (gate >=4.5); c06 60.0-162.7 deg (gate >=60) — ALL 17 PASS.
- c01 18.88 (white) / 17.62 (black) exceeds the 17:1 ceiling — the register's
  SUPERSEDED row (CHECK-REGISTER L193/L214; intentional #111 / ~92% white
  spec); byte-identical before and after this change (ink untouched).
- `data/audit/3/verify-final.mjs` re-run: c02 5.00-5.05, c03 3.49-3.52,
  c05 5.03 in its legacy black-mode view (it omits `bgMode`, so it evaluates
  every channel as black — pre-existing harness staleness, noted, not touched).
  Its c01>17 "FAIL"s are the same superseded row. No regressions anywhere.

### P2.3 Pixel gate, re-rendered frames (10/10 re-rendered at native 1.0 via
`render-frame.mjs` idx 0/244/488/731/975/1219/1463/1706/1950/2191; same SRT/VO;
`node scripts/frame-audit.js data/audit/16/review-oldts`)

| frame | pre-change | post-change (target 5.3) | lane |
|---|---|---|---|
| 00 | PASS | PASS | — |
| 01 | cap 12.00 / head **3.03** | cap 12.18 / head **3.03** (144,144,144) | GEOMETRY: ink#111-family at ~45-55% opacity ramp inside headline band |
| 02 | cap 12.07 / head **2.97** | cap 12.00 / head **3.07** (143) | GEOMETRY (same ramp) |
| 03 | cap 4.50 / head 4.50 (razor) | cap **4.44** / head **4.44** (116 on 249) | GEOMETRY: full-ink textDim 3-4px vertical line x84-87, AA-phased 94-100% coverage across draws (frame-04 same element: 4.80 — passes on its draw) |
| 04 | cap 4.70 / head 4.84 | cap **4.80** / head **4.80** PASS | palette (improved) |
| 05 | cap **4.20** | cap **4.96** (PASS-bar; margin leak 0.80% stays) | palette FIXED the contrast; remaining fail = top-margin leak -> GEOMETRY/FRM-02 |
| 06 | cap **2.13** / head **4.15** | cap **2.19** / head **3.94** | GEOMETRY: accent stake ~50% AA blend (convex cap ~2.3; unfixable) + phrase ramp |
| 07 | cap 4.78 / margin leak 2.30% | cap **5.36** (PASS-bar; leak 1.13%) | palette FIXED contrast; margin leak -> GEOMETRY/FRM-02 |
| 08 | cap 4.71 / leak 2.13% | cap **5.47** (PASS-bar; leak 1.27%) | palette FIXED contrast; margin leak -> GEOMETRY/FRM-02 |
| 09 | cap **2.13** / head **4.09** | cap **2.26** / head **3.98** (+0.14% margin) | GEOMETRY (stake + ramp), unfixable by ink |

Palette-lane result: every FULL-COVERAGE role pixel now clears 4.5 by real
margin on rendered frames (+0.1 to +0.76 improvement on frames 04/05/07/08).
The 7 remaining failing frames carry geometry-lane violations only
(opacity ramps 45-55%, AA-phased line work, stake ~50% blend — all bounded
by the convex blend argument for ANY flat colour — and margin leaks).

Gate outcome: 2/10 PASS (00, 04), run FAILS (exit 1) — REQUIRES the layout
lane's fixes below; this lane's contribution is the contrast real-margin
headroom and the classification.

### P2.4 Shared-file requests (SFR) — colour lane cannot fix these; orchestrator/layout lane

> NOTE: superseded in mechanism + exactness by P2.6 below (P2.6 gives the
> re-grounded code paths, verbatim edits and measured/predicted numbers for the
> three still-open causes 01/02/03/06/09). P2.4 retained for history.

- **SFR-16-COL-1 (FRM-02 / layout):** `DesignSpace` translateY
  (`CAPTION_RESERVE_Y=110`, motion-graphics.jsx L1140 + layout-constants.js)
  pushes stage content INTO the headlineText (y964-1140) / captionText
  (y1152-1248) probe bands: statement phrase text bottom at output y1075-1090,
  horizon ridge + accent stake at y1258-1271 (`data/audit/16/diagnose-geometry.mjs`).
  Frames 01/02/06/09 headline 3.03-4.00 and frames 06/09 caption 2.19/2.26 are
  direct consequences. Fixes live in compositions/ (read-only here).
- **SFR-16-COL-2 (structure-scenes):** the HERO_NUMBER vertical 3-4px line
  (x193-195 / x84-87, spans BOTH probe bands; frame-03 darker-drop darkest-pixel
  116 vs frame-04 107 = AA phase) renders at 94-100% coverage and drives the
  frame-03 4.44 razor. Draw as full-opacity stroke ink at >=2px or reposition
  off the probe bands; PART 2 line-work rule (stroke ink, not accent).
- **SFR-16-COL-3 (statement timing):** the phrase/headline words render at
  ~45-55% opacity mid-ramp INSIDE the headline band (frame-06/09 band mode 135
  = ink@~55% over bg; anchor+10 sample). noFade precedent exists at
  motion-graphics.jsx L128-146; opacity ramps must complete before the band
  or never sit in it.
- **SFR-16-COL-4 (FRM-02 / margins):** top-margin leaks (y110-178:
  frame-05 0.80%, frame-07 1.13%, frame-08 1.27%, frame-09 0.14%) and
  headline-right-margin leaks — stage/atmosphere decor above the SAFE rect.
  `data/audit/16/diagnose-margins.mjs` maps the exact leak bands.

### P2.6 Re-grounded, exact SFR edits (frames 01/02/03/06/09) — SUPERSEDES P2.4

Phase-1 re-entry. The P2.4 blocks below were placeholders; this round re-grounded
each of the three remaining root causes against the CURRENT post-palette-fix
frames (`data/audit/16/review-oldts/`, gate exit 1 on 01/02/03/06/09) by
rendering and pixel-probing them (see `P2.7`), located the exact code path for
each, and specifies verbatim old→new edits for the orchestrator/layout lane.
All three live in `src/skills/remotion-render/compositions/**`, which is
READ-ONLY here → filed as SHARED-FILE REQUESTS, not applied by this lane.

> **Pre-value source (measured, current frames, from `review-oldts/audit-report.json`):**
> frame-01 head **2.97** · frame-02 head **3.07** · frame-03 cap+head **4.41** ·
> frame-06 cap **2.14** / head **4.21** · frame-09 cap **2.19** / head **4.13**.
> Post-values below are PREDICTED (grounded in the verified mechanism and
> measured ingredient pixels), pending orchestrator apply + re-render.

---
#### SFR-16-COL-2 — ACCUMULATION vertical rules cross the headline probe at partial opacity (frames 01/02/03)

**Measured:** frames 01/02 (tray variant, `variant % 2 == 0`) drive headline
2.97/3.07; frame-03 (ledger variant, `variant % 2 == 1`) drives both caption and
headline 4.41 (razor). Element = stroke-ink (#111) vertical container rules at
reduced CSS opacity: the tray's two side rails at `opacity: 0.45`
(`quantity-scenes.jsx` L159-160) and the ledger's single left rule at
`opacity: 0.6` (L155). These are mid-beat (frame-01 rel 10/73, frame-03 rel
23/76), NOT exit-fades. Ink #111 at 45%/60% opacity over bg 249-252 blends to
rgb(143-145)/rgb(110-117) → 2.97-3.07 / 4.41; full-coverage #111 is 17:1 and
clears everywhere (PART 2 line-work: stroke ink, full opacity).

**Fix (exact edits, `compositions/scenes/quantity-scenes.jsx`):**
- L155 `background: colors.stroke, opacity: 0.6 }`  →  `background: colors.stroke, opacity: 1 }`
- L159 `background: colors.stroke, opacity: 0.45 }` →  `background: colors.stroke, opacity: 1 }`
- L160 `background: colors.stroke, opacity: 0.45 }` →  `background: colors.stroke, opacity: 1 }`

**Predicted post:** rails/rule become rgb(17) = ~17:1 → frames 01/02/03 headline
and frame-03 caption clear 4.5 by massive margin. (Visual tradeoff: the thin
2-3px container lines are now solid ink rather than 45-60% tint — acceptable
line-work; flag to mograph if a lighter tray read is wanted via a different
placement, not a sub-4.5 opacity.)

---
#### SFR-16-COL-3 — CinematicStatementScene phrase dimmed by the beat-END exit fade (`stageExitStyle`) (frames 06/09 headline)

**Measured:** frame-06/09 headline 4.21/4.13 = phrase `textPrimary #111` at
~55% opacity (rgb ~119-123; ink@55% over bg 251). **Mechanism located:**
`compositions/motion-graphics.jsx` `stageExitStyle(frame, durationInFrames)`
(L169-175) + `StageContainer` (L925-929). Each beat is its own `<Sequence>`
(L1082-1086), and inside a Sequence `useVideoConfig().durationInFrames` returns
the *sequence* duration; `rel = durationInFrames - frame` ≤ 6 (D.short) fires a
6-frame E_IN opacity fade on the whole stage. Frame-06 is beat-21 (seq dur 77),
sampled at seq-frame 74 → rel 3 → midpoint of the fade → opacity ≈ 0.5.
Verified by a frame sweep: idx 1440 (rel 51) phrase ink rgb(4); idx 1463
(rel 74) rgb(124); idx 1465 (rel 76) rgb(227) → gone. Frame-09 (beat 32, last,
seq dur 70+TAIL) is likewise inside its exit fade at idx 2191 (rel 79). COL-23
any-frame forbids on-screen text in the probe band below 4.5:1 during the fade.

**Fix (exact edit, `compositions/motion-graphics.jsx`, L169-175):** keep the
exit as a slide but never dim on-screen text below 4.5:1 — change
`return { opacity: 1 - p, translate: \`0px ${-12 * p}px\` };`
to keep `translate`, set `opacity: 1`:
`return { opacity: 1, translate: \`0px ${-12 * p}px\` };`
(Text ink #111 stays 17:1 through the exit; the -12px+(E_IN) slide remains the
transition cue.)

**Predicted post:** frames 06/09 headline become ~17:1 → clear 4.5. No new
COL-23 fail possible (direction only makes ink stronger). **Cross-lane note:**
this removes the opacity-fade from EVERY beat's exit (all channels/scenes). If
the mograph lane wants a fade elsewhere it must be placed where no text sits in
a probe band (e.g. a post-camera overlay, outside the Shot), not via stage
opacity. Tradeoff recorded here so no later lane re-introduces it.

---
#### SFR-16-COL-1 — accent stake crosses the caption probe at ~50% AA coverage (frames 06/09 caption)

**Measured:** frame-06/09 caption 2.14/2.19 = `colors.accent` stake, strokeWidth
3, at x520 output, rgb(124,187,143) = accent at ~50% pixel coverage (accent
#007D26 50%-blended over bg 251 ≈ (125,187,144); matches exactly). Convex bound:
ANY flat colour at ~50% coverage over a ~250 bg sits ≈2.2:1 — unfixable by
palette. With the layout horizon at `ATMOSPHERE_HORIZON_Y = 1200`
(not to be touched) the stake necessarily stands across caption-zone y1152-1200,
so the caption probe (y1152-1248) always contains it.

**Fix (exact edits, `compositions/scenes/abstract-scenes.jsx`, CinematicStatementScene L251-254):**
give the stake a full-coverage accent core so its darkest pixel is full accent
(~5:1) instead of a ~50% blend (~2.2:1):
`x1={Math.round(textCx)} y1={horizon} x2={Math.round(textCx)} y2={horizon - stakeH * eSubject} stroke={colors.accent} strokeWidth={6}`
(i.e. snap `textCx` to an integer column AND widen strokeWidth 3 → 6 so ≥ one
pixel column is fully inside the stroke). Predicted darkest = full accent
≈5.0-5.3:1 vs grained bg → clears 4.5.

If the mograph/layout lane prefers not to thicken the stake, the required
alternative is placement: keep the stake out of the caption reserve entirely
(which, given horizon=1200, means the statement scene cannot stand a vertical
stake into y>1152 — it must be clipped or re-anchored). Colour lane cannot do
either; exact edit above is the minimal implementable one.

---
#### P2.7 Verification evidence for P2.6 (predicted-by-mechanism, frames re-rendered at native 1.0)

Renders in `data/audit/16/review-new/`:
- frame-06 sweep beat-21 (idx 1440/1453/1457/1459/1461/1463/1465/1470): phrase
  darkest rgb(4)→rgb(2)→rgb(2)→rgb(20)→**rgb(119)**→rgb(227)→gone. Confirms the
  6-frame exit-fade location + SFR-16-COL-3.
- frames 05/07/08 darkest rgb(22/5/8) ≈ ink (17:1) at rel 85/14/14 — i.e.
  outside/barely-in their exit fades; matches the measured PASS. Same scene,
  same `textPrimary #111` at `opacity: eSubject = 1` — the failing frames are
  purely the fade, not a colour role.
- frame-06 row probe: headline-zone phrase glyph runs (y964-1067) darkest ~126-136
  neutral grey (phrase, mid-fade); accent stake at x520 y1106+ rgb(124,187,143)
  (~50% coverage) → the caption fail. Confirms SFR-16-COL-3 + SFR-16-COL-1 split.

### P2.5 Unresolved / transferred

- The three SFRs in P2.6 (frames 01/02/03/06/09) are UNRESOLVED in this lane
  (all in compositions/**, READ-ONLY here — filed as exact SHARED-FILE REQUESTS
  with verbatim old→new edits + predicted post-contrast; orchestrator applies
  and re-renders).
- Until they land, COL-23's gate cannot exit 0 (any-frame rule); this lane's
  palette work is complete and measured PASS on all full-coverage role pixels.

## Phase 3 — independent counter-check (COMPLETE)

`verify-independent` subagent, task `ses_face99943ffeHFAE06Hz6OJjtC`:
**CONFIRM.** Independent WCAG grounding re-fetched (w3.org Understanding
1.4.3 + W3C G18 "two pixels in from the edge", webaim.org "#777777 4.47:1
does not meet 4.5:1" — corroborating the unrounded rule); recomputed by hand:
textDim #6B6B6B = 5.02:1 (bg 248) / 5.15:1 (bg 251), accent #007D26 =
4.99:1 (bg 248) / 5.12:1 (bg 251), pre-fix #757575 = 4.45:1 (bg 251) — the
defect reproduces. Diff = exactly the 4 claimed hunks; the DOT_GRID block was
correctly excluded as unrelated Stage-12 work. Gate re-read + post-change
audit-report.json matches the P2.3 table exactly, and the failure set matches
the geometry-lane classification. Verifier could not itself execute node/git
beyond `git diff` (bash allow-list), so it verified by source-reading the gate
and recomputing the numbers by hand — noted here for the record.

One precision correction adopted from the verdict: the claim's ">=5.02:1 on
rgb(248)" bound holds for textDim; the ACCENT role measures 4.99:1 there —
margin still real (>=0.49), verdict unchanged. DELTA/P2.2 rows updated above.

Remaining gate status (post-palette-fix, current frames): `frame-audit` exit 1 —
frames 00/04/05/07/08 PASS, frames **01/02/03/06/09 FAIL** on COL-23
(any-frame rule) — depends on the three exact SFRs in P2.6 (compositions/**,
layout/mograph lane). This lane's palette fix is complete and verified.