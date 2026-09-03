# CHECK REGISTER â€” What Is Being Checked

**Repo:** `lumeierecollection-blip/YOUTUBE`
**Partner to:** `CROSSCHECK-PROTOCOL.md`
**Relationship:** the protocol defines *how* a change is verified â€” three
phases, eight lanes, an independent counter-check. **This document defines
*what* is verified.** The protocol without this is a process with no content.
This without the protocol is a wishlist.

**Scope:** `style: "motion-graphics"` (6 channels as of the 50->17 portfolio
cut: Money Mind, Legal Brief, Border Lines, Fraud Files, Skill Stack,
Factory Floor â€” corrected 2026-08-16, was stale at "12 channels").

---

# PART 0 â€” HOW TO USE THIS

## 0.1 One check, one ID, one owner, one method

Every check in the pipeline appears here exactly once and carries:

| Field | Meaning |
|---|---|
| **ID** | stable, unique, never reused |
| **Check** | the assertion, phrased so it can only be true or false |
| **Method** | how it is measured â€” an actual command or procedure |
| **Threshold** | the number or condition that separates pass from fail |
| **T** | tier (0â€“4, see Â§1) |
| **Sev** | BLOCKER / MAJOR / MINOR (see Â§2) |
| **Stage** | the `CROSSCHECK-PROTOCOL` Part 4 stage it gates |
| **State** | what it evaluates to on the repo *today* |
| **Src** | where the requirement comes from |

## 0.2 The ID collision â€” read this before wiring anything

The five spec documents grew their own numbering, and it collides. **These
must not be used as identifiers in code or in agent output:**

| Old ID | Appears in | Meant | Now |
|---|---|---|---|
| `L1â€“L12` | LAYOUT-SYSTEM Â§6 | layout lint | `LAY-*` |
| `D1â€“D14` | LAYOUT-SYSTEM Part 7 | **deletions** | `DEL-*` |
| `D1â€“D15` | DETAIL-REFERENCE Part D | **checks** â€” collides with the above | `AST-*`, `MOT-*`, `ENC-*` |
| `C1â€“C17` | FINISH-SPEC Part 7 | config + frame checks | `COL-*`, `MOT-*`, `RND-*` |
| `P1â€“P6` | FINISH-SPEC Â§1.3 | palette gates | `COL-01â€¦06` |
| `F1â€“F5` | LAYOUT-SYSTEM Â§6 Tier 3 | frame QA | `FRM-*` |
| `H1â€“H8` | DETAIL-REFERENCE Â§C5 | data honesty | `ENC-2*` |
| `R01â€“R30` | FINISH-SPEC Part 6 | the robot list | `DEL-*` |
| `R2.1`, `R3.5`â€¦ | FINISH-SPEC prose | rules, not checks | not identifiers |

**Two different `D1`s existed, meaning two different things, in two documents
an agent is told to read.** That alone justifies this file.

**0.2.1 â€” From here, only the IDs in this register are valid.** Agent
ledgers, lint output, gate reports, and commit messages reference `LAY-07`,
never `L7` or `Â§3.1`.

## 0.3 The namespace

| Prefix | Domain | Owning lane |
|---|---|---|
| `LAY` | geometry, slots, safe zones, alignment, compiler | `audit-layout` |
| `TYP` | type, measurement, captions, crispness | `audit-type` |
| `COL` | palette, contrast, elevation, background | `audit-color` |
| `MOT` | timing, easing, springs, stagger, holds | `audit-motion` |
| `ENC` | archetypes, charts, representation, data honesty | `audit-encoding` |
| `AUD` | sound effects, levels, sync | `audit-audio` |
| `RND` | render options, encoder, CI | `audit-render` |
| `AST` | fonts, icons, images, licences | `audit-assets` |
| `DEL` | absence â€” things that must no longer exist | the owning lane |
| `FRM` | whole-frame visual QA | orchestrator |
| `SCR` | daily-pipeline script generation â€” grounding, archetype/anchor sync, pacing | `discover-topics` / `research-and-script` workflow jobs (not a CROSSCHECK lane â€” see Â§3.10) |
| `VIS` | visual storytelling — strategy routing, visual states, icon subordination | `visual/diagnostics.js` (per render, not a CROSSCHECK lane — see §3.12) |
| `SLOP` | anti-slop gate â€” frame density, scene variety, static regression guards | `render-and-qa.js` (not a CROSSCHECK lane â€” see Â§3.11, `ANTI-SLOP.md`) |

---

# PART 1 â€” TIERS AND EVIDENCE STANDARDS

A check's tier is decided by **what evidence proves it**, not by how important
it is.

| T | Name | Runs | Cost | Evidence |
|---|---|---|---|---|
| **0** | Config | on `channels.json` / `package.json` change | ms | parsed file + computed value |
| **1** | Static lint | every build | ms | `ResolvedFrame[]` in Node; no browser, no model |
| **2** | Still probe | every code change | seconds | `renderStill()` + `getBoundingClientRect()` Ã· `useCurrentScale()` |
| **3** | Frame QA | per rendered video | minutes | ffmpeg contact sheet, 1 frame / 15 |
| **4** | Judgement | per stage | agent time | three-phase protocol, human-readable verdict |

## 1.1 Evidence rules

- **E1 â€” A check may not be marked pass by reading the code.** Tier 1 needs
  a computed value from the compiler; Tier 2 needs a measured rect; Tier 3
  needs a frame. "I changed it so it should be fine" is not evidence, and
  this project's own history is why: render reports proved unreliable here,
  which is how frame-by-frame contact sheets became the standard.
- **E2 â€” Tier 4 is the smallest possible category.** Anything a linter can
  decide belongs in Tier 1. If a Tier 4 check keeps producing the same
  verdict, promote it to Tier 1 and delete the judgement call.
- **E3 â€” A tier-1 check that has never failed on a real input is untested.**
  Feed it a fixture that should fail before trusting it.
- **E4 â€” `UNVERIFIABLE` is a distinct state from `FAIL`** and never counts
  toward a gate.

---

# PART 2 â€” SEVERITY

| Sev | Meaning | On failure |
|---|---|---|
| **BLOCKER** | output is broken, wrong, or legally exposed | stage cannot pass; no further lanes dispatched |
| **MAJOR** | output is visibly amateur or measurably degraded | stage cannot pass; other lanes may continue |
| **MINOR** | polish; accumulates into a cheap look | logged; may carry one stage, not two |

**2.1** â€” Every licence and child-of-licence check is BLOCKER regardless of
visual impact. **2.2** â€” Every check whose failure produces *silently wrong
output* â€” wrong font metrics, regex-derived numbers, an inert config â€” is
BLOCKER, because it cannot be caught downstream by looking at a frame.

---

# PART 3 â€” THE REGISTER

State column: **FAIL** = measured or computed as failing today Â·
**PASS** Â· **N/B** = not yet built Â· **UNK** = not yet measured.

## 3.1 `LAY` â€” geometry, slots, alignment

| ID | Check | Method | Threshold | T | Sev | Stage | State |
|---|---|---|---|---|---|---|---|
| LAY-01 | Every rect lies inside its declared slot | compiler assertion | 0 violations | 1 | BLOCKER | 6 | N/B |
| LAY-02 | Every slot lies inside the safe rect | `slots.js` vs `SAFE` | 0 violations | 1 | BLOCKER | 4 | **PASS** |
| LAY-03 | Safe-rect constants exist in the codebase | `grep -rn "288\|888\|1248" src/` | â‰¥1 hit in `slots.js` | 1 | BLOCKER | 4 | **PASS** |
| LAY-04 | All x/y/w/h are multiples of 8 | compiler, post-round | 100% | 1 | MAJOR | 6 | **PASS** |
| LAY-05 | Rounding displaced no rect by >4 px | compiler assertion | â‰¤4 px | 1 | MAJOR | 6 | **PASS** |
| LAY-06 | No two non-persistent rects overlap in a frame range | compiler | 0 overlaps | 1 | MAJOR | 6 | N/B |
| LAY-07 | Bar bottoms equal the axis y exactly | compiler | Î” = 0 px | 1 | BLOCKER | 8 | **FAIL** â€” 36 px float |
| LAY-08 | Chart gutters equal within 1 px | compiler | â‰¤1 px variance | 1 | MAJOR | 8 | **FAIL** â€” 42/84 split |
| LAY-09 | Axis label right edge is 12 px from gridline start | compiler | 12 Â± 1 px | 1 | MAJOR | 8 | **FAIL** â€” 108 px |
| LAY-10 | No layer declares a raw pixel coordinate | `grep` in `styles/`, `beats/`; `compositions/` raw dupes tracked (D2: stale 1148) | 0 hits outside frame counts | 1 | MAJOR | 7 | **FAIL** |
| LAY-11 | Zero sibling flex in Stage / Headline / Caption | `grep -rn "display: *[\"']flex"` | 0 hits | 1 | BLOCKER | 7 | **FAIL** |
| LAY-12 | Measured rect matches compiled rect | Tier 2 probe Ã· `useCurrentScale()` (doc conflict 4.0.111 vs 4.0.125, resolved by 4.0.505 install) | Â±2 px | 2 | BLOCKER | 7 | N/B |
| LAY-13 | No element crosses the safe rect at render | Tier 2 probe | 0 crossings | 2 | BLOCKER | 7 | **FAIL** |
| LAY-14 | Composite connectors do not overpaint the hub | paint order + geometry | 0 intersections | 1 | MAJOR | 9 | **FAIL** |
| LAY-15 | Rotation pivots sit at the geometric centre | compiler | Î” = 0 px | 1 | MINOR | 9 | **FAIL** â€” 1.5 px |
| LAY-16 | Every beat has â‰¥1 and â‰¤5 layers | compiler | 1â€“5 | 1 | MINOR | 6 | N/B |
| LAY-17 | Every `atFrame` resolves inside the beat | compiler | in `[0, dur]` | 1 | MAJOR | 6 | N/B |
| LAY-18 | Stage occupancy â‰¤55% of slot area | compiler | â‰¤253,000 pxÂ² | 1 | MINOR | 12 | N/B |
| LAY-19 | No two rects within 24 px of each other | compiler | â‰¥24 px | 1 | MINOR | 12 | N/B |
| LAY-20 | Scale factor `u` is not a no-op | `grep "Math.min(width, height) / 1080"` | 1 hit @ compositions/mg-style.js:150-151 (scaleUnit, applied — not a no-op; stage-4 ledger's "0 hits" was stale) | 1 | MAJOR | 4 | **PASS** |

## 3.2 `TYP` â€” type, measurement, captions, crispness

| ID | Check | Method | Threshold | T | Sev | Stage | State |
|---|---|---|---|---|---|---|---|
| TYP-01 | `measureText` throws on an unloaded font | `validateFontIsLoaded: true` fixture | throws | 1 | BLOCKER | 5 | N/B |
| TYP-02 | Measurement and render share one `fontStyle` object | code review + probe | identical | 1 | BLOCKER | 5 | N/B |
| TYP-03 | No headline below 84 px | compiler | â‰¥84 Ã— u | 1 | MAJOR | 6 | **FAIL** â€” 46 px |
| TYP-04 | No supporting text below 44 px | compiler | â‰¥44 Ã— u | 1 | MAJOR | 6 | **FAIL** â€” 28 px |
| TYP-05 | Caption â‰¤25 chars per line | caption compiler | â‰¤25 | 1 | MAJOR | 10 | N/B |
| TYP-06 | Caption â‰¤2 lines, â‰¤7 words per page | caption compiler | â‰¤2 / â‰¤7 | 1 | MAJOR | 10 | N/B |
| TYP-07 | Caption â‰¤15 characters per second | page duration Ã· chars | â‰¤15 CPS | 1 | MAJOR | 10 | N/B |
| TYP-08 | Caption page duration in range | `compositions/beats.js` `buildCaptionPages` window enforcement, gated by `gateCaptions` | 833â€“5000 ms | 1 | MAJOR | 10 | **PASS 2026-09-03** - the window-enforcement pass ran BEFORE the clause-boundary repair, and the repair moves a word across a boundary and moves the timing with it (`left.endMs = tok.toMs`, `right.startMs = ...`), shrinking one of the two pages. Nothing re-checked afterwards, and the final clamp only rescues the LAST page, so a page that satisfied the floor before the repair could end up under it and stay there. Seven ch-fixture cues were short for exactly this reason. The pass is now a named function run again after the repair; a second merge cannot re-strand a dangling word because the merged page ends where the right page ended, a boundary the repair already walked. 47 pages -> 42, all in range |
| TYP-09 | â‰¥2 blank frames between caption pages | compiler | â‰¥2 | 1 | MAJOR | 10 | N/B |
| TYP-10 | Headline and caption share â‰¤2 words | compiler | â‰¤2 | 1 | MINOR | 10 | N/B |
| TYP-11 | Caption is SRT-derived, not word-count chunked | `grep chunkVoiceover` | 0 hits | 1 | BLOCKER | 10 | **PASS** - 2026-08-30 (wrapper deleted; both call sites call `chunkTextClauseAware` directly) |
| TYP-12 | Exactly one active caption token per frame | compiler | =1 | 1 | MAJOR | 10 | N/B |
| TYP-13 | Highlight scale does not reflow the line | measured at 1.08 | 0 reflow | 2 | MAJOR | 10 | N/B |
| TYP-14 | Every entrance ends at integer translate | compiler | integer | 1 | MAJOR | 11 | N/B |
| TYP-15 | Every resting scale is exactly 1.0 | compiler | =1.000 | 1 | MAJOR | 11 | N/B |
| TYP-16 | No `willChange` on a held element | compiler | 0 | 1 | MINOR | 11 | N/B |
| TYP-17 | `outline` used, never `border` | `grep -rn "border:"` | 0 hits | 1 | MINOR | 7 | **FAIL** |
| TYP-18 | Stroke widths are 2 or 4 px only | compiler | âˆˆ {2,4} | 1 | MINOR | 7 | **FAIL** â€” 1, 3 px |
| TYP-19 | No uppercase body or caption text | `grep textTransform` | 0 in caption/body | 1 | MINOR | 10 | **FAIL** |
| TYP-20 | No glyph-edge chroma fringing | contact-sheet edge scan | 0 regions | 3 | MAJOR | 16 | UNK |
| TYP-21 | Caption/chunk breaks are clause-boundary aware â€” never end a page/chunk on an article, preposition, conjunction, or a number split from its unit | `buildCaptionPages` clause-boundary repair (`compositions/beats.js`) for motion-graphics; `chunkTextClauseAware` (same file) for minimal/cinematic-documentary's plain-text chunking | 0 violations | 1 | MAJOR | 10 | **PASS** - motion-graphics-rebuild-v2, 2026-08-16 (real shipped defect: "...found: 1,980 meters below the"); repair pass only, no separate verifying gate function yet â€” see Â§4.1 |
| TYP-22 | Adjacent caption word tokens are separated by a real space, not zero-gap inline-blocks | visual confirmation on a rendered frame ("finishedinmonthswith") | 0 concatenated words | 3 | MAJOR | 10 | **PASS** - `CaptionLine` now inserts a literal space text node between `CaptionToken` spans (motion-graphics-rebuild-v2) |

## 3.3 `COL` â€” palette, contrast, elevation, background

`COL-01â€¦06` are the six palette gates, run across all 50 channels.

**3.3.0 â€” motion-graphics-rebuild-v2 amendment (superseding some rows below).**
Real reference frames were measured against the OKLCH tonal-elevation `bg`
this section's gates were built for and showed a colour wash: `bg` derived
at E0 lightness (0.16) with chroma 0.03 at the channel's `baseHue` is never
truly neutral â€” a channel with a green `accentHue` got a green-tinted "dark"
background (measured mean RGB (9,38,23)), not a neutral one. `bg` is now
flat `#FFFFFF` or `#000000` per a new `channels.json` field, `bg_mode`; see
`styles/tokens.js` header for the full rationale. Consequences for the rows
below:
- **COL-01's 17:1 ceiling is superseded, not met.** The rebuild's explicit
  colour spec is literal: white-mode text `#111111` on `#FFFFFF` (measured
  18.88:1), black-mode text ~92% white (`#EBEBEB`) on `#000000` (measured
  17.62:1) â€” both over the old ceiling. The ceiling existed to avoid harsh
  eye-strain contrast on a *tonal* dark bg; a pure white/black bg with a
  near-black/near-white ink is the explicit design now, not an oversight.
  Re-open this row only if a future pass revisits the exact ink values.
- **COL-06 (`accent hue >= 60Â° from base hue`) no longer applies.** `bg` has
  no hue any more, so there is no `baseHue` to measure the accent against.
  Retained here for history; `baseHue` is still accepted as a dead parameter
  in `paletteFromHues()` so old call sites don't throw, but nothing reads it.
- **COL-02â€“05 still apply, re-solved for the new `bg`.** `accent`'s
  lightness is now solved per bg polarity (`pickAccentL` in `styles/
  tokens.js`) so COL-02 clears >=4.5:1 against a *pure* bg instead of the old
  tonal one; `textDim` is solved the same way for COL-05. Measured 2026-08-16
  across all 17 current channels: COL-02 4.60-4.64:1, COL-03 3.80-4.10:1,
  COL-05 4.61-4.62:1, all PASS (see the channel table replacing the old
  50-channel one â€” portfolio is now 17, not 50).

| ID | Check | Method | Threshold | T | Sev | Stage | State |
|---|---|---|---|---|---|---|---|
| COL-01 | `textPrimary / bg` contrast | WCAG relative luminance | 7:1 <= r <= 17:1 | 0 | BLOCKER | 3 | **SUPERSEDED** â€” 17.62-18.88 (see 3.3.0); intentional per the explicit `#111`/`~92% white` spec |
| COL-02 | `accent / bg` contrast | WCAG | >=4.5:1 | 0 | BLOCKER | 3 | **PASS** - 4.60-4.64 (17 channels, 2026-08-16) |
| COL-03 | `accent / textPrimary` contrast | WCAG | >=2.5:1 | 0 | MAJOR | 3 | **PASS** - 3.80-4.10 |
| COL-04 | `stroke / bg` contrast | WCAG | >=3:1 | 0 | MAJOR | 3 | **PASS** - 17.62-18.88 (stroke reuses the ink colour) |
| COL-05 | `textDim / bg` contrast | WCAG | >=4.5:1 | 0 | MINOR | 3 | **PASS** - 4.61-4.62 |
| COL-06 | Accent hue >=60 deg from base hue | OKLCH hue circle | >=60 deg | 0 | MAJOR | 3 | **RETIRED** â€” bg has no hue in the flat bg_mode system (see 3.3.0) |
| COL-07 | No `#FFFFFF`, `#000000`, or R=G=B in `thumbnail_spec` | parse `channels.json` | 0 | 0 | MAJOR | 3 | **PASS** - 0 (whole-file `.colors` legacy field = T-colors follow-up) |
| COL-08 | No hex literals in `thumbnail_spec` | parse `channels.json` | 0 | 0 | MAJOR | 3 | **PASS** - 0 (whole-file `.colors` legacy field = T-colors follow-up) |
| COL-09 | No two channels share both hues | parse | 0 duplicates | 0 | MAJOR | 3 | **PASS** - 50/50 unique |
| COL-10 | Within a niche cluster, accent hues >=40 deg apart | parse + cluster map | >=40 deg | 0 | MINOR | 3 | N/A - all 50 niches unique, no cluster map exists |
| COL-11 | Exactly one `accent` element per frame | compiler | =1 | 1 | MAJOR | 9 | **FAIL** |
| COL-12 | Zero `boxShadow` in the style | `grep -rn "boxShadow"` | 0 hits | 1 | MAJOR | 12 | **PASS** - 0 hits (motion-graphics-rebuild-v2, 2026-08-16) |
| COL-13 | Zero gradient fills | `grep -rn "gradient"` | 0 hits | 1 | MAJOR | 12 | **PASS-with-amendment** - 0 CSS/code gradient hits as-written, but the class-level "0 code hits" does NOT hold since 61ded3d (2026-08-27): four designed SVG environment fills in scenes/stage.jsx (paper-fall/sub-floor/atmo-haze/shot-falloff) are invisible to the case-sensitive pattern and are carved out under DEL-12/18 amendments |
| COL-14 | Elevation âˆˆ {E0, E1, E2} only | compiler | â‰¤3 levels | 1 | MINOR | 12 | **RETIRED** â€” the elevation ladder itself is gone (surface/raised collapse to bg, see 3.3.0); a panel/chip separates from bg with a stroke border, not a tonal fill |
| COL-15 | â‰¤1 E2 element per frame | compiler | â‰¤1 | 1 | MINOR | 12 | **RETIRED** â€” see COL-14 |
| COL-16 | Elevation is never animated | compiler | 0 transitions | 1 | MINOR | 12 | **RETIRED** â€” see COL-14 |
| COL-17 | Dot-grid density matches the archetype table | compiler | exact | 1 | MINOR | 12 | N/B |
| COL-18 | Dot-grid density constant within a section | compiler | 1 value | 1 | MINOR | 12 | N/B |
| COL-19 | Dot grid uses absolute square pitch | `grep` for `%` in grid | 0 hits | 1 | MAJOR | 12 | **PASS** - `dotGrid({dotSize, gridSize})` takes fixed px, not `%` |
| COL-20 | Ground-plane luminance constant across the video | contact sheet | Î” â‰¤1% except end card | 3 | MINOR | 16 | UNK |
| COL-21 | No banding: no monotonic step over 200 px | contact-sheet scan | 0 regions | 3 | MINOR | 16 | UNK |
| COL-22 | No mood-based colour grading | `grep moodFrom` | 0 hits in style | 1 | MAJOR | 12 | **PASS** - `moodFromVisualCue`/`moodFromContent` deleted from `visual.js` (motion-graphics-rebuild-v2); 0 code hits, only removal-comments |
| COL-23 | Rendered text/background WCAG contrast | `scripts/frame-audit.js` `estimateForeground()` + `wcagContrast()` on caption/headline zones (inset past the rail column) | >=4.5:1 | 3 | MAJOR | 16 | **PASS** - 12/12 sampled frames, real render (ch-01, 2026-08-16); source of COL-02/05's role-level guarantee, this is the pixel-level confirmation of it |

## 3.4 `MOT` â€” timing, easing, springs, holds

| ID | Check | Method | Threshold | T | Sev | Stage | State |
|---|---|---|---|---|---|---|---|
| MOT-01 | Beats are SRT-derived, not section-index divided | `grep "durationInFrames / .*sections"` | 0 hits | 1 | BLOCKER | 9 | **PASS** - 2026-08-26 (visual-generation overhaul): confirmed real and worse than the grep implies — `minimal.jsx` divided by section COUNT (equal screen time regardless of narration length) and `cinematic-documentary.jsx`'s `computeLayout` used a hardcoded dramatic-pacing weight that also never looked at word count (neither matched this row's own grep pattern, so this was never actually caught). `beats.js`'s new `realSectionWindows`/`sectionFrameWindows` give both styles the same real-per-word-SRT timing motion-graphics already had (word-count-proportional fallback when no SRT exists), threaded through `render.js` -> both compositions' new `sectionWindows` prop |
| MOT-02 | 4â€“8 beats per rolling 300 frames | beat timeline | 4â€“8 | 1 | MAJOR | 9 | **FAIL** |
| MOT-03 | Every beat â‰¥ its `holdFrames(text)` | compiler | â‰¥ | 1 | MAJOR | 9 | N/B |
| MOT-04 | No `interpolate()` without an easing | `grep` + AST scan | 0 | 1 | MAJOR | 7 | **FAIL** |
| MOT-05 | No `interpolate()` without both clamps | AST scan | 0 | 1 | MAJOR | 7 | **FAIL** |
| MOT-06 | Every scale interpolation sets `perceptual-scale` | AST scan | 100% | 1 | MINOR | 7 | **FAIL** |
| MOT-07 | Stagger offset Ã· duration âˆˆ [0.3, 0.6] | compiler | in range | 1 | MAJOR | 11 | N/B |
| MOT-08 | No two layers in a beat share a start frame | compiler | 0 collisions | 1 | MAJOR | 11 | N/B |
| MOT-09 | Every spring's damping ratio Î¶ âˆˆ [0.46, 1.0] | Î¶ = d / 2âˆš(kÂ·m) | in range | 1 | MAJOR | 11 | UNK |
| MOT-10 | Drag values match the relationship table | compiler | exact | 1 | MINOR | 11 | N/B |
| MOT-11 | Every archetype declares a "hold begins" frame | compiler | present | 1 | MAJOR | 11 | N/B |
| MOT-12 | No event after "hold begins" except caption + rail | compiler | 0 | 1 | MAJOR | 11 | N/B |
| MOT-13 | Last entrance frame == first hold frame, pixel-identical | contact sheet | identical | 3 | MAJOR | 16 | UNK |
| MOT-14 | Frames inside a hold differ by <0.5% of pixels | contact sheet | <0.5% | 3 | MAJOR | 16 | **FAIL** â€” sine pulse |
| MOT-15 | Translations >200 px follow an arc | compiler | arc present | 1 | MINOR | 11 | N/B |
| MOT-16 | Seeded jitter is deterministic | `grep "Math.random"` | 0 hits | 1 | BLOCKER | 11 | UNK |
| MOT-17 | Jitter touches only timing and overshoot | compiler | no pos/size/colour | 1 | MINOR | 11 | N/B |
| MOT-18 | Motion blur only inside a transition subtree | `visual/composition.js` `gateMotionBlur` over every source file in `visual/`, `compositions/`, `compositions/scenes/`, `.../elements/` and `effects/`, via `run-visual-tests.js` | 0 outside a transition subtree | 1 | MINOR | 12 | **PASS 2026-09-03** - was `N/B` for a real reason: `gateMotionBlur` had been written and exported and was called by nothing, so the check existed in code and in this table while never running. Now wired in and scanning 44 files. Proven non-vacuous rather than assumed: a planted `blur(interpolate(frame, ...))` in a scene file fails it, and the identical line under `transitions/` passes |
| MOT-19 | â‰¤3 full-frame luminance changes per second | contact sheet | â‰¤3 | 3 | BLOCKER | 16 | UNK |
| MOT-20 | â‰¥4 visually distinct frames per 10 s | contact sheet | â‰¥4 | 3 | MAJOR | 16 | **FAIL** |
| MOT-21 | Transition frames added back into total duration | compiler vs audio length | â‰¥ audio | 1 | BLOCKER | 9 | N/B |

## 3.5 `ENC` â€” archetypes, charts, representation, honesty

| ID | Check | Method | Threshold | T | Sev | Stage | State |
|---|---|---|---|---|---|---|---|
| ENC-01 | `STATEMENT` <=30% of beats | classifier output | <=30% | 1 | BLOCKER | 9 | **PASS** - 2026-08-26 (visual-storytelling overhaul, second pass). The first pass reconnected authored beats but left the RENDER side icon-first, so this stayed PARTIAL at 63%. Both remaining causes are now gone: `deriveScene` (mg-package.js) no longer resolves an icon for every beat before the archetype switch (that single line was the icon-first mechanism), and `StageScene` routes through a visual director (`visual/director.js`) that reads the beat's own narration plus its gate-checked data and picks a visual STRATEGY, with `CINEMATIC_STATEMENT` - a composed depth frame carrying no icon - as the only terminal fallback. Measured on three real production-CLI renders: statement ratio 0.0 (ch-02 legal), 0.0 (ch-48 process), 0.2 (ch-01 finance); icon-hero ratio 0.0 on all three. `MAX_AUTHORED_BEAT_FRAMES` also no longer discards authored beats over 8s - it densifies one concept into more visual states instead - which is what had been forcing 3 of 5 sections onto the fragment classifier |
| ENC-02 | No archetype repeats >2Ã— consecutively | classifier | â‰¤2 | 1 | MAJOR | 9 | N/B |
| ENC-03 | Every beat has exactly one `anchorTokenIndex` | classifier | =1 | 1 | BLOCKER | 9 | N/B |
| ENC-04 | Stage entrance begins in `[tAâˆ’4, tA+2]` | compiler | in window | 1 | MAJOR | 9 | N/B |
| ENC-05 | Routing is text-based, not cue-based | `grep pickScene` | 0 hits | 1 | BLOCKER | 9 | **PASS** - 2026-08-30 stage-15 remeasure (0 code hits; Stage-9 ledger recorded CHANGED→PASS) |
| ENC-06 | No number is regex-scraped from prose | `grep extractStats\|extractHeroNumber` | 0 hits | 1 | BLOCKER | 9 | **PASS** - 2026-08-30 stage-15 remeasure (0 code hits; Stage-9 ledger recorded CHANGED→PASS) |
| ENC-07 | No headline is regex-derived from the voiceover | `grep` the two-word match | 0 hits | 1 | BLOCKER | 9 | **FAIL** |
| ENC-08 | Every chart beat has explicit `beat.data` | compiler | 100% | 1 | BLOCKER | 8 | **FAIL** |
| ENC-09 | â‰¤5 series points per chart | compiler | â‰¤5 | 1 | MAJOR | 8 | N/B |
| ENC-10 | Axis origin is zero | compiler | =0 | 1 | BLOCKER | 8 | UNK |
| ENC-11 | No stacked bar layout | compiler | 0 | 1 | MAJOR | 8 | N/B |
| ENC-12 | No pie, donut, gauge, bubble, treemap, 3D | `grep` + compiler | 0 | 1 | MAJOR | 8 | UNK |
| ENC-13 | Highlighted point is the anchor's referent, not `max()` | compiler | match | 1 | MAJOR | 8 | UNK |
| ENC-14 | Values printed adjacent to their bar | compiler | â‰¤24 px | 1 | MAJOR | 8 | **FAIL** |
| ENC-15 | Colour never encodes magnitude | compiler | 0 mappings | 1 | MAJOR | 8 | N/B |
| ENC-16 | â‰¤4 Stage layers per frame | compiler | â‰¤4 | 1 | MINOR | 9 | N/B |
| ENC-17 | Archetype mix matches the channel's `concepts` | compiler vs config | â‰¥50% / â‰¤35% / 0% | 1 | MINOR | 9 | N/B |
| ENC-18 | `IMAGE_BEAT` â‰¤20% of beats | compiler | â‰¤20% | 1 | MINOR | 9 | N/B |
| ENC-19 | `bRollFiles` is actually consumed | `grep` in style file | â‰¥1 hit | 1 | MAJOR | 9 | **PASS** - this row was already stale before the 2026-08-26 visual-generation overhaul session (which re-verified, not re-fixed, it): `render.js` -> `image-assets.js` -> `mg-package.js`/`beats.js` -> `ImageBeatScene` is a real, live chain today (confirmed by direct grep + a real render). Whoever's fix closed this didn't update the row |
| ENC-20 | Percentages shown only when the script states one | compiler vs script | 100% | 1 | MAJOR | 8 | UNK |
| ENC-21 | Two values share an axis only if they share a unit | compiler | 100% | 1 | MAJOR | 8 | UNK |
| ENC-22 | Single-point data renders as `HERO_NUMBER`, not a chart | classifier | 100% | 1 | MINOR | 8 | UNK |
| ENC-23 | Time comparisons use equal intervals or state them | compiler | 100% | 1 | MINOR | 8 | UNK |
| ENC-24 | No rounding that changes order of magnitude | compiler | 0 | 1 | MAJOR | 8 | UNK |
| ENC-25 | Numeric rect reserves the final formatted string width | compiler | reserved | 1 | MAJOR | 11 | **PASS** - 2026-08-21, closes SFR-T-11-1/T-11-2 (audit/11 ledger Sec.2.4): `layout/measure.js`'s `needsFixedSlots()`/`reserveCounterWidth()` are now consumed by `beats/HeroNumber.jsx`, `beats/Progress.jsx`, and the production-wired `compositions/motion-graphics.jsx` (`HeroNumberScene`, `ProgressScene`) — a channel on DM Sans/Nunito now renders per-digit `0.62em` fixed slots (A1.3) with the wrapper reserved to the final string's measured width; every other channel's rendering is unchanged (tnum/mono was already de-facto PASS per T-11-03) |
| ENC-26 | Counter start has the same digit count as the target | compiler | equal | 1 | MINOR | 11 | **PASS** - probe evidence T-11-01 (audit/11, 58 real HERO counters, 0 d5fails); `ProgressScene`'s counter (motion-graphics.jsx, previously the one legacy counter with no digit-count floor at all) now routes through the new `progressCounterText()`, matching `beats/Progress.jsx`'s existing raised-floor `counterText` |
| ENC-27 | Counter bounding box byte-identical across the count | contact sheet | identical | 3 | MAJOR | 16 | PASS (mechanism) - same 2026-08-21 fixed-slot fix as ENC-25 removes the only known cause of DM Sans/Nunito jitter (audit/11 D14 probe: offsetWidth swung 449->646 pre-fix); re-verified this session via a real render (`data/audit/12/pull-quote-probe.mjs`'s HERO_NUMBER re-check, `/opt/pw-browsers/chromium`) rather than the stage-16 formal contact sheet, which has not been re-run — leaving the Stage column's formal gate open until it is |
| ENC-28 | Thousands separators applied to every intermediate value | compiler | 100% | 1 | MINOR | 11 | **PASS** - probe evidence T-11-02 (audit/11); unchanged by this session, listed for completeness alongside ENC-25/26/27 per SFR-T-11-3 |
| ENC-29 | A HERO_NUMBER beat's value never also appears as a caption token during that beat's on-screen window (no fact stated twice simultaneously) | `stripHeroNumberTokens` (`compositions/mg-package.js`) | 0 duplicates | 1 | MAJOR | 9 | **PASS** - motion-graphics-rebuild-v2, 2026-08-16 (real shipped defect: hero "1,980" repeated verbatim in the caption) |
| ENC-30 | A counter's displayed value never exceeds the value it is counting toward (no unclamped spring/easing overshoot reaching the number itself) | compiler | 0 excursions above target | 1 | MAJOR | 11 | **PASS** - 2026-08-21, real defect found and fixed this session: `ProgressScene`'s bar-value label (motion-graphics.jsx, `fmtValue(s.value * g)`) fed the raw, unclamped `growSpring` output straight into the displayed number; `growSpring`'s config (damping 16, stiffness 90) is underdamped (critical damping = 2*sqrt(90) ~= 18.97 > 16), so the spring overshoots past 1 and the counter visibly counted past its target before settling back — the "counts up then jumps back" defect class this session's motivating research was scoped around, independent of any font. Replaced with `progressCounterText()`, which clamps progress to [0,1] before formatting (mirrors `beats/Progress.jsx`'s existing A2.6 `Math.min` clamp); the bar's own height is deliberately left unclamped (A3.1's ~15% overshoot is an intentional shape bounce) |
| ENC-31 | An IMAGE_BEAT that loses its archetype (no manifest match after the topic-broadened retry, or the ENC-18 20% cap) is logged, never silent | `<slug>-<format>-image-gaps.json` (render.js) + `::warning::` per gap | 0 unlogged downgrades | 1 | MAJOR | 9 | **NEW** - 2026-08-22, closes a real silent-downgrade bug: `buildMgPackage` (mg-package.js) rewrote an unmatched IMAGE_BEAT to STATEMENT (icon+headline) with zero logging, and separately did the same, also silently, for beats bumped by the ENC-18 cap. Now: `image-assets.js`'s `resolveImageAssets` retries once against the video's topic when a section's own cues match nothing (never a blind first-asset guess — still routed through select.js's keyword-overlap match); if that still comes up empty, mg-package.js falls back to HERO_NUMBER only when the beat's own text carries a number (`parseNumber`, the same signal the adjacent PROGRESS fallback already used — never a chart, since a plain text beat carries no `data.series`), else STATEMENT — and every such downgrade, plus every ENC-18-cap downgrade, is pushed onto the package's new `imageGaps` array, which render.js always writes to `<slug>-<format>-image-gaps.json` (even when empty, so the file's presence itself confirms the check ran) and echoes as a GitHub-Actions-recognized `::warning::` per gap |

## 3.6 `AUD` â€” sound

| ID | Check | Method | Threshold | T | Sev | Stage | State |
|---|---|---|---|---|---|---|---|
| AUD-01 | Sound is triggered by a VISUAL EVENT and every event is explainable | `visual/diagnostics.js` `summarizeSound` + `qa-scripts/audio-qa.mjs` on the rendered mp4 | `semanticMatchRate` = 1, every event audible | 1 | MAJOR | **PASS** - 2026-08-26 (third pass). SUPERSEDES the second-pass close: that resolved one sound per section by keyword-matching the script's free-text `sfx_cue` against file tags and fired it at frame zero of the section, so it played because a section began rather than because anything happened on screen, and it matched the narration's WORDS not the picture (a cue reading "low sub-bass drone" scored against "click, ui, button"). `sfx.js` and the `sfxCue` plumbing are deleted; `visual/sound-design.js` schedules from visual states instead. Verified in the rendered mp4 by `audio-qa.mjs`: 9/9 events present, measured RMS within 0.1-2.3 dB of each event's target. `sfx_cue` is also REMOVED from `schemas/script.mg.json`, because `opencode-agent.js` puts the whole schema into every script prompt with `JSON.stringify(schema)` - a field nothing reads costs tokens on every run. The mg schema is now 7 est. tokens smaller than before this pass. `schemas/script.section.json` keeps it for minimal / cinematic-documentary, which are not part of this overhaul. Do not reintroduce a keyword matcher on top of it |
| AUD-02 | ≤3 SFX per beat, ≥12 frames apart, each explainable | compiler (`MAX_EVENTS_PER_BEAT`, `MIN_GAP_FRAMES`) | ≤3, gap≥12 | 1 | MINOR | 13 | FAIL→amended 2026-08-29 (stage 13). The ≤1 threshold never matched the compiler: `sound-design.js` ships `MAX_EVENTS_PER_BEAT=3`/`MIN_GAP_FRAMES=12` as documented design, and the PASS record is incompatible with a ≤1 cap — row 304's own "9/9 events present" counts 9 events across 5 beats. Stage-13 measurement of the QA inputs: 9 events/5 beats (ch-01), 12 events/5 beats (ch-48), 15 events/8 beats (ch-02 real script); beats with >1 event = 4/5, 5/5, 6/8; max 3; tightest actual gap 15 f. Texture ticks repeat inside one audible state by design; non-repetition events land exactly on visual-state start frames |
| AUD-03 | SFX fires on the visual-land frame, not the word | compiler | match | 1 | MINOR | 13 | **PASS** - 2026-08-29 stage 13: anchorCheck exact (26 events at localDelta 0, 10 on-grid ticks inside repeat states, 0 OTHER); scheduler keys only off visualStates; SoundEvent mounts at the same atFrame |
| AUD-04 | Gains match the SFX map | compiler | exact | 1 | MINOR | 13 | **PASS** - 2026-08-29 stage 13: 0 vol/target/missing violations across all QA inputs; 26/26 files present |
| AUD-05 | Every SFX file is local, never a remote URL | `grep https` in audio | 0 hits | 1 | BLOCKER | 13 | **PASS** - 2026-08-29 stage 13: 0 https in audio.js/sound-design.js/sfx-library.js; attribution URLs are text records in sfx-manifest.json only; runtime loads via staticFile() |
| AUD-06 | Every SFX file's licence permits monetised use | licence log | 100% | 0 | BLOCKER | 13 | **PASS** - 2026-08-29 stage 13: 26/26 licence records in sfx-library.js + sfx-library.measured.json; Kenney CC0 + Mixkit commercial use verified from first-party sources |
| AUD-07 | Master is −14 LUFS integrated | ffmpeg `ebur128` on a real render | −14 ±0.5 | 3 | MAJOR | 13 | N/B - 2026-08-29 stage 13: UNVERIFIABLE (no compositor/render on this machine); venue = production render + `audio-qa.mjs` ebur128 (stage 16/17) |
| AUD-08 | VO peaks ≤ −3 dBFS | ffmpeg | ≤ −3 | 3 | MINOR | 13 | N/B - 2026-08-29 stage 13: UNVERIFIABLE (`vo.mp3` is a silent placeholder, measured 73.13 s, byte-identical to the staged file); venue = a real TTS render (stage 16/17) |
| AUD-09 | Audio track duration â‰¥ video duration | probe | â‰¥ | 3 | BLOCKER | 16 | UNK |

## 3.7 `RND` â€” render, encoder, CI

| ID | Check | Method | Threshold | T | Sev | Stage | State |
|---|---|---|---|---|---|---|---|
| RND-01 | Render subpackage matches root Remotion version | parse both `package.json` | equal | 0 | BLOCKER | 1 | **PASS** - stale before the 2026-08-26 session (re-verified, not re-fixed): both now pin `^4.0.503` |
| RND-02 | React versions match | parse | equal | 0 | BLOCKER | 1 | **PASS** - stale before the 2026-08-26 session (re-verified, not re-fixed): both now pin `^19.2.8` |
| RND-03 | `@remotion/captions` installed and â‰¥4.0.216 | parse | present | 0 | BLOCKER | 1 | **PASS** - stale before the 2026-08-26 session (re-verified, not re-fixed): `^4.0.503` in both `package.json`s, confirmed actually installed and importable |
| RND-04 | `inputProps` reaches the component | fixture render | reaches | 2 | BLOCKER | 1 | **FAIL** |
| RND-05 | The generated-entry-file workaround is gone | `grep` | 0 hits | 1 | MAJOR | 1 | **FAIL** |
| RND-06 | `renderMedia` sets `imageFormat: 'png'` | parse `render.js` | present | 1 | MAJOR | 14 | **PASS** - 2026-08-29 stage 14: render.js:291 `imageFormat: "png"` |
| RND-07 | `renderMedia` sets an explicit `crf` | parse | present | 1 | MAJOR | 14 | **PASS** - 2026-08-29 stage 14: render.js:292 `crf: 16` |
| RND-08 | `renderMedia` sets `pixelFormat` | parse | present | 1 | MINOR | 14 | **PASS** - 2026-08-29 stage 14: render.js:293 `pixelFormat: "yuv420p"`; byte-confirmed in stage-14 clip ffprobe (pix_fmt=yuv420p) |
| RND-09 | `chromiumOptions.gl` passed to `renderMedia`, not the config file | parse | present | 1 | BLOCKER | 14 | **PASS** - 2026-08-29 stage 14: render.js:294 `chromiumOptions: { gl: "swangle" }`; config file deleted (RND-10) |
| RND-10 | `remotion.config.js` is deleted or annotated as CLI-only | file check | one of | 1 | MAJOR | 14 | **PASS** - 2026-08-29 stage 14: file deleted (git status: ` D`), Test-Path False; nothing imports or loads it |
| RND-11 | No config-file setting is relied on by the SSR path | code review | 0 | 4 | BLOCKER | 14 | **PASS** - 2026-08-29 stage 14: zero `Config.set` repo-wide; publicDir verified as bundler default from installed `@remotion/bundler` source (dist/bundle.js:182,256-258) |
| RND-12 | One full Short renders per mg channel | CI | 6/6 | 3 | BLOCKER | 16 | N/B - 2026-08-29 stage 14: denominator restated 12/12 -> 6/6 per register scope header (corrected 2026-08-16; 12/12 predated the 50->17 portfolio cut). CI not dispatchable from this session (`gh` 2.97.0 unauthenticated, no token). Evidence stands: 2026-08-26 ch-02 clean run (1/6), plus stage-14 real-path clip (270x480 yuv420p h264) and full-length runs reaching `renderMedia`. Row gates at stage 16 |
| RND-13 | Frame 0 and final frame match for loop quality | contact sheet | match | 3 | MINOR | 16 | UNK |
| RND-14 | No frame is >92% a single colour | contact sheet | 0 frames | 3 | MAJOR | 16 | UNK |

**3.7.1 â€” `verify-compositions.js` never actually ran on Linux/CI before 2026-08-26.**
Two real defects, unrelated to this session's actual work but found while using it to verify that work: (1) its `CHROME` constant was a hardcoded Windows path, so it always fell through to Remotion trying to download its own Chrome Headless Shell, which any egress-restricted environment (including a real GitHub Actions runner with default egress) refuses; (2) its `openBrowser({...})` call passed the whole options object as the `browser` positional argument (`openBrowser(browser, options)` in the installed `@remotion/renderer`), so even with a real `browserExecutable` set, it was silently discarded. Fixed: `CHROME` now reuses `render.js`'s own cross-platform `findChrome()` (extracted to `find-chrome.js` so importing it doesn't also run `render.js`'s top-level `main()`), and the `openBrowser` call now passes `(undefined, options)`. With both fixed, this session got a real still-render pass on the `movile-cave` ch-fixture for the first time and it surfaced two more real, previously-uncatchable findings, left **undiagnosed this session** (out of scope for a visual-generation-overhaul session to chase an unrelated pre-existing bug to ground): `mg f900 pixels near accent: 0 -> accent MISSING`, and `mg f505/1210/1565 IMAGE_BEAT stage stddev ~10.5-10.9 -> STAGE FLAT` despite the fixture's referenced b-roll files existing on disk. Whether these are real current defects in `motion-graphics.jsx` or the fixture's hardcoded check frame numbers (505/900/1210/1565/...) having drifted from what the current beat timeline actually puts at those archetypes could not be determined without further investigation.

## 3.8 `AST` â€” fonts, icons, images, licences

| ID | Check | Method | Threshold | T | Sev | Stage | State |
|---|---|---|---|---|---|---|---|
| AST-01 | Every font in `channels.json` has a `.woff2` | cross-reference | 100% | 0 | BLOCKER | 2 | **PASS** - 13 families / 25 files (SFR-001) |
| AST-02 | Every numeral font exposes `tnum`, or the fallback is flagged | fontTools GSUB read | 100% | 0 | MAJOR | 2 | **PASS** - 3 mg families tnum; 5 channels flagged (data/audit/2/tnum-features.txt) |
| AST-03 | No vendored font is unused | cross-reference | 0 unused | 0 | MINOR | 2 | **PASS** - 0 unused (21 files removed, claim-assets-002) |
| AST-04 | Fonts resolve before the first frame | `wait-for-fonts` gate | resolved | 2 | BLOCKER | 5 | UNK |
| AST-05 | Two weights per channel, no more | parse | <=2 | 0 | MINOR | 2 | **PASS** - 0 exceed (claim card) |
| AST-06 | Every icon name resolves in the vendored Lucide set | compiler | 100% | 1 | BLOCKER | 9 | **PASS** — 95/95 (claim-assets-006) |
| AST-07 | Icon apparent stroke âˆˆ [6, 12] px | compiler arithmetic | in range | 1 | MAJOR | 9 | UNK |
| AST-08 | Icon sizes âˆˆ {64, 120, 180, 240} | compiler | in set | 1 | MINOR | 9 | UNK |
| AST-09 | Lucide ISC notice present | file check | present | 0 | BLOCKER | 2 | **PASS** — verbatim (claim-assets-005) |
| AST-10 | Feather MIT notice present for the inherited icons | file check | present | 0 | BLOCKER | 2 | **PASS** - verbatim (claim-assets-005) |
| AST-11 | No brand logos anywhere in the asset set | manual + `grep` | 0 | 4 | BLOCKER | 2 | **PASS** - 0 (claim-assets-006) |
| AST-12 | Every source image â‰¥1134 Ã— 2016 | probe each file | 100% | 0 | MAJOR | 9 | UNK |
| AST-13 | No asset fetched over the network at render time | `grep https` in compositions | 0 hits | 1 | BLOCKER | 9 | UNK |
| AST-14 | Every image for a named person or place is verified real | source log | 100% | 4 | BLOCKER | 9 | UNK |
| AST-15 | A `b-roll-manifest-<channelId>.json` is trusted only when its own `topic_slug` matches the script actually being rendered | `broll.js` `loadManifest()` guard, threaded from `render.js`'s `script.topic_slug` | 100% | 1 | BLOCKER | 9 | **PASS** - motion-graphics-rebuild-v2, 2026-08-16 (this is PART 0's content-routing bug: a stale ch-01 manifest from an unrelated dev-test topic could otherwise leak wrong-channel imagery into a real render; mirrors the guard `src/utils/pipeline.js`'s `loadTopicBrollManifest` already had for the copyright/disclosure/quality gates, now applied on the render path too) |
| AST-16 | A fetched asset's own title shares at least one real keyword with the query it was fetched for | `fetch-library.js` `keywordsOfTitle` filter | 0 zero-overlap assets admitted | 1 | MAJOR | pre-render | **PARTIAL** - 2026-08-22, real defect found on a real render (`data/audit/12/multi-image-beat-*`): a Met search for "credit card debt" returned a Baroque "Charity" allegory painting (partially nude woman with nude children) — zero title/query keyword overlap, the Met's own search relevance, not this pipeline's, decided it was close enough. Now rejected mechanically at fetch time. Marked PARTIAL, not PASS: a second real example from the same run — a Wikimedia photo titled "Rid of credit card debt" that is actually a bullet cartridge (a title pun, not a literal subject) — has full title/query overlap and passes this filter while still being visually wrong. No check in this pipeline verifies image CONTENT against the query, only text metadata; closing that gap needs real vision-content verification, which does not exist here. Both bad assets removed from `data/asset-library/index.json` and their files deleted; SKILL.md's spot-check guidance extended to cover this |
| AST-17 | An asset-library photo is reachable with the id `render.js` actually passes | `run-visual-tests.js` (resolves each catalogued asset by its own query, asserts the numeric id does NOT resolve, and greps the call site) | 100% resolvable | 1 | BLOCKER | 9 | **PASS** - 2026-08-27. Found by tracing, not by a render: both image sources are keyed by the SLUG form (`index.json` stores `"channelId": "ch-01"`, manifests are `b-roll-manifest-ch-01.json`, files live under `public/asset-library/ch-01/`) while `scripts/render-and-qa.js` invokes the CLI with `String(c.id)` and `render.js` passed that argument straight through. Every lookup compared `"1"` against `"ch-01"` and returned nothing, so EVERY photo in the library was unreachable in production — and `IMAGE_EVIDENCE`, whose only trigger is "a real sourced asset exists for this section" (no text detector, by design), could never fire on any beat of any video. `render.js` now passes `channel.channel_id`; `loadChannel()` already accepted either spelling. Verified by reverting the call site, which fails the check |

## 3.9 `FRM` â€” whole-frame QA

| ID | Check | Method | T | Sev | Stage |
|---|---|---|---|---|---|
| FRM-01 | Contact sheet generated at 1 frame / 15 for every render | ffmpeg | 3 | BLOCKER | 16 |
| FRM-02 | No frame shows text crossing the safe rect | visual + probe | 3 | BLOCKER | 16 |
| FRM-03 | Every archetype appears at least once across the 12 renders | sheet review | 4 | MINOR | 16 |
| FRM-04 | No two channels' frames are indistinguishable at a glance | sheet review | 4 | MAJOR | 16 |
| FRM-05 | A human would not identify the output as auto-generated | sheet review | 4 | MAJOR | 16 |

**FRM-05 is the only genuinely subjective check in the register**, and it is
deliberately last. It is not a substitute for the 130 above it; it is the
sanity check that they were the right 130.

## 3.10 `SCR` â€” daily-pipeline script generation

**These gate a different process than everything above them.** `LAY` through
`FRM` gate the CROSSCHECK-PROTOCOL render-audit (`.github`/local, run once as
an engineering pass on the Remotion renderer itself). `SCR` gates the
*daily* `discover-topics` â†’ `research-and-script` workflow â€” the Claude-Code-
in-CI pipeline that replaced the pillar-cycling bug and the placeholder
research writer (see the script-pipeline rebuild notes). Every `SCR` check
runs per-video, before TTS, implemented in `scripts/gate-research.js` and
`scripts/gate-script.js`.

| ID | Check | Method | Threshold | T | Sev | Stage | State |
|---|---|---|---|---|---|---|---|
| SCR-01 | Every `key_fact.source_url` is well-formed (full "was actually fetched" verification needs the Stage B tool-call transcript, not implemented) | `gate-research.js` | 100% well-formed | 1 | BLOCKER | pre-TTS | **NEW** â€” not yet run against a live workflow (no `ANTHROPIC_API_KEY` configured) |
| SCR-02 | >=5 key facts, >=3 distinct source domains | `gate-research.js` | >=5 / >=3 | 1 | BLOCKER | pre-TTS | **NEW** |
| SCR-03 | Every `beat.anchor_token` appears verbatim in its section's `voiceover` | `gate-script.js` | 100% | 1 | BLOCKER | pre-TTS | **NEW** |
| SCR-04 | Every `PROGRESS` beat has `data.series` with >=2 points | `gate-script.js` | >=2 | 1 | BLOCKER | pre-TTS | **NEW** |
| SCR-05 | No `data.series` value is absent from the research `numbers[]` | `gate-script.js` | 100% | 1 | BLOCKER | pre-TTS | **NEW** |
| SCR-06 | Archetype mix matches the channel's `concepts` allocation (soft â€” only checked when `channels.json` declares `concepts` for that channel; none do yet) | `gate-script.js` | >=50% / <=35% / 0% | 1 | MAJOR | pre-TTS | **NEW**, and effectively N/A until `concepts` is added per DETAIL-REFERENCE Â§C4 |
| SCR-07 | `STATEMENT` <=30% of beats | `gate-script.js` | <=30% | 1 | MAJOR | pre-TTS | **NEW** |
| SCR-08 | Voiceover word count implies a plausible WPM for the channel's style at the format's midpoint duration (soft sanity check â€” real duration is decided later from actual audio length) | `gate-script.js` | within 0.5x-1.5x of style target | 1 | MAJOR | pre-TTS | **NEW** |
| SCR-09 | Slug not present in `topic-log.json` for that channel | `reserve-topics.js` | 0 collisions | 1 | BLOCKER | pre-research | **NEW** |
| SCR-10 | Topic is not a near-duplicate of the last 90 days (token overlap <0.6) | `topic-log.cjs isDuplicate()` (reused, not reimplemented) | <0.6 | 1 | MAJOR | pre-research | **NEW** |
| SCR-11 | No two channels received the same slug this run | `reserve-topics.js` | 0 collisions | 1 | BLOCKER | pre-research | **NEW** |
| SCR-12 | `text_overlay` is an object or null, never a string | `--json-schema` at the CLI boundary, re-checked in `gate-script.js` | 100% | 1 | BLOCKER | pre-TTS | **NEW** |
| SCR-13 | No hex colour value anywhere in the script JSON | `gate-script.js` regex | 0 hits | 1 | MAJOR | pre-TTS | **NEW** â€” a real hex literal (`#0A1020`) already exists in `data/research/1/pay-frequency-budgeting-script.json`'s `visual_cue`, predating this gate |
| SCR-14 | `sources_used` >=3 and every URL appears in the research file | `gate-script.js` | 100% | 1 | BLOCKER | pre-TTS | **NEW** |
| SCR-15 | The writer directed the visuals: >=60% of beats carry `visual.strategy`, and not all the same one | `gate-script.js` | >=60%, mix>1 | 1 | MAJOR | pre-TTS | **NEW** — before this, `prompts/style-contract.md` told the writer to omit the block, so `authored plan ratio` was 0 on every script and every beat of every video was planned by keyword match in `visual/director.js` |

**3.10.1 â€” SCR-05 is the enforcement point for `ENC-06`/`ENC-08`.** A number
only reaches a chart if the research pass logged it with a source, closing
the loop that otherwise ends in `extractStats()` regexing a value out of
prose at render time (still the render-time behavior today â€” `SCR-05`
constrains what the *script* is allowed to contain, it does not yet change
what `mg-package.js` does with it; see `schemas/script.mg.json`'s header
note on that gap).

**3.10.2 â€” SCR-01 and SCR-10 are honest approximations, not full
implementations.** Read the check's Method column before trusting its
State â€” `gate-research.js` and `gate-script.js` both document, inline, the
gap between what they claim to check and what would be needed to check it
fully.

## 3.11 `SLOP` â€” anti-slop gate (motion-graphics rebuild PART 9)

Like `SCR`, gates the *daily* pipeline (`scripts/render-and-qa.js`, after
`frame-audit.js`), not the one-time `FRM` engineering audit above. Full
spec, rationale, and the "why not a vision model" note live in
`ANTI-SLOP.md` â€” this row only registers IDs per Â§0.2's rule. **All rows
are currently `WARN`, not `BLOCKER`**: `render-and-qa.js` logs every
verdict to `data/audit/slop-check.log` but the gate never fails the job
(see `ANTI-SLOP.md`'s rationale for shipping warn-only first).

| ID | Check | Method | T | Sev (nominal) | Stage | State |
|---|---|---|---|---|---|---|
| SLOP-01 | No rendered frame >40% empty | `slop-check.js checkFrameEmptiness` (pixel) | 3 | MAJOR | post-render | **NEW**, WARN |
| SLOP-02 | Every non-`LIST_ITEM` beat's scene carries real visual content | `slop-check.js checkSceneHasVisual` (structural, over `mg` package) | 1 | MAJOR | post-render | **NEW**, WARN |
| SLOP-03 | At least one element bleeds off a frame edge per scene | `slop-check.js checkEdgeBleed` (pixel) â€” **weak signal, see `ANTI-SLOP.md` row 5** | 3 | MINOR | post-render | **NEW**, WARN |
| SLOP-04 | No untreated/unattributed image reaches an `IMAGE_BEAT` frame | `slop-check.js checkImageTreatment` (structural) | 1 | MINOR | post-render | **NEW**, WARN |
| SLOP-05 | No hexagon-node/connector-line primitives exist in `motion-graphics.jsx` | `slop-check.js checkStaticSource` (static regression guard, not per-render) | 1 | BLOCKER | build-time | **NEW**, WARN |
| SLOP-06 | No raw `interpolate()` call bypasses the `ease()`/`easeScale()` bezier default | `slop-check.js checkStaticSource` (static regression guard) | 1 | MAJOR | build-time | **NEW**, WARN |
| SLOP-07 | No two adjacent non-`LIST_ITEM` beats share an archetype | `slop-check.js checkEntranceDiversity` (structural) | 1 | MAJOR | post-render | **NEW**, WARN â€” confirmed firing on a real script (`ch-02` "what-to-say-traffic-stop"): long `STATEMENT`-only runs, a real finding, not a false positive |
| SLOP-08 | `Kicker` never renders a channel name or free-text section label | `slop-check.js checkStaticSource` (static regression guard) | 1 | BLOCKER | build-time | **NEW**, WARN |
| SLOP-09 | Cold model review of residual judgement rows | `slop-check.js coldModelReview` via `scripts/opencode-agent.js`, `--with-model-review` only, off by default | 4 | MINOR | post-render | **NEW**, unverified against a live Cerebras call â€” see `ANTI-SLOP.md` |

**3.11.1** â€” Rows already covered by an existing, reused gate are NOT
duplicated here: flat background and text contrast are `frame-audit.js`
(unchanged), duplicated on-screen facts are `mg-package.js`'s
`gateMgHeadlineOverlap`, and caption mid-phrase breaks are `beats.js`'s
`gateCaptions`. `ANTI-SLOP.md`'s table is the complete 12-row list;
`SLOP-*` only covers the rows that needed genuinely new code.

---

## 3.12 `VIS` - visual storytelling (second-pass overhaul)

Computed by `src/skills/remotion-render/visual/diagnostics.js` on **every**
render and written to `data/renders/<ch>/<slug>-<format>-visual-report.json`;
warnings are echoed as `::warning::` annotations. Like `SCR` and `SLOP`,
these gate the daily pipeline, not the CROSSCHECK render audit.

These exist because the honest failure mode of a visual overhaul is a
renderer that LOOKS rebuilt while most beats quietly still take the generic
path. `VIS-02` and `VIS-04` are the two numbers that make that impossible
to hide.

| ID | Check | Method | Threshold | T | Sev | State |
|---|---|---|---|---|---|---|
| VIS-01 | Every registered strategy routes to a scene the router handles, and no two share one | `assertStrategyRegistryIsSound()` + `visual/run-visual-tests.js` | 0 problems | 1 | BLOCKER | **PASS** - 55/55 tests |
| VIS-02 | `iconHeroRatio` = 0 (an icon is never the primary visual) | `diagnostics.js` | 0 | 1 | BLOCKER | **PASS** - 0.0 on all 3 real renders |
| VIS-03 | Beats average >=2 visual states (concepts progress) | `diagnostics.js` | >=2 | 1 | MAJOR | **PASS** - 4.2 to 4.8 |
| VIS-04 | `genericFallbackRatio` <=0.4 (beats produce a readable concept) | `diagnostics.js` | <=0.4 | 1 | MAJOR | **PASS** - 0.0 on all 3 |
| VIS-05 | No single visual state holds >5s | `diagnostics.js` | <=5s | 1 | MAJOR | **PASS** - max 3.13s |
| VIS-06 | >2 distinct strategies per video (not templated) | `diagnostics.js` | >2 | 1 | MAJOR | **PASS** - 4 to 5 per video |
| VIS-07 | Every fallback records a machine-readable reason | `diagnostics.js` `fallbackReasons` | 100% | 1 | MAJOR | **PASS** |
| VIS-08 | A geofence/distance concept renders a spatial visual, not a numeral | `run-visual-tests.js` PART-23 gate + rendered frame | spatial | 3 | BLOCKER | **PASS** - frame-verified, see 3.12.1 |
| VIS-09 | The anchored visual state starts on the beat's real anchor frame | `run-visual-tests.js` | +/-1 frame | 1 | MAJOR | **PASS** |
| VIS-10 | Visual states tile the beat window with no gaps at any duration/anchor | `run-visual-tests.js` | 0 gaps | 1 | MAJOR | **PASS** - 15 duration x anchor combinations |
| VIS-11 | A beat prints at most 8 words on screen (supporting text, not a subtitle) | `diagnostics.js` `maxWordsOnOneBeat` + `run-visual-tests.js` | <=8 | 1 | MAJOR | **PASS** - max 8 (legal), 3 (finance), 0 (tech) |
| VIS-12 | `textNarrationRatio` stays low (the picture is not reciting the narration) | `diagnostics.js` | <=0.35 | 1 | MAJOR | **PASS** - 0.221 / 0.05 / 0.00 |
| VIS-13 | Full narration captions are OFF unless a channel opts in | `render.js` `showCaptions` = `channel.captions === "burned-in"` | opt-in only | 1 | MAJOR | **PASS** - no channel in `channels.json` sets it today |
| VIS-14 | Two beats never draw the same composition | `diagnostics.js` `VIS-SAME-COMPOSITION` | 0 repeats | 1 | MINOR | **PASS** - clean on all 3 after variants were added to DOCUMENT_EVIDENCE / GEOSPATIAL_RADIUS / PROCESS / ACCUMULATION |
| VIS-15 | A declared composition-variant count is backed by a scene that branches on it | `run-visual-tests.js` (reads the scene sources) | 0 false declarations | 1 | MAJOR | **PASS** - guard verified to fail when a declaration is falsified |
| VIS-16 | Sound events are spaced, capped, explained and never boosted to unity | `run-visual-tests.js` + `diagnostics.js` `summarizeSound` | 0 warnings | 1 | MAJOR | **PASS** - 0 AUD-* warnings on all 3 |
| VIS-17 | Every sound-library entry's duration/peak/RMS is MEASURED from the file | `qa-scripts/fetch-sfx-library.mjs` + `run-visual-tests.js` | 26/26 measured | 1 | MAJOR | **PASS** |
| VIS-18 | Every strategy the director can prefer is actually selectable | `run-visual-tests.js` (signals table vs `STRATEGY_PREFERENCE`) | 0 unreachable | 1 | BLOCKER | **PASS** - found `DATA_CHART` and `SCALE_COMPARISON` with NO detector, unreachable on every beat ever rendered; both now detected, guard verified to fire on the pre-fix source |
| VIS-19 | A comparison keeps both its values; a chart keeps all of them | `run-visual-tests.js` | 0 dropped | 1 | MAJOR | **PASS** - `detectComparison` accepted >=2 while `ComparisonScene` slices to 2, so a 4-figure beat rendered 2 and silently discarded the rest |
| VIS-20 | No scene draws outside the safe rect | `run-visual-tests.js` calls the renderer's own `documentPageGeometry()` against the renderer's own `SAFE` / `CAPTION_RESERVE_Y`, both imported from `compositions/layout-constants.js` | inside | 1 | MAJOR | **PASS** - see 3.12.3; caught all 3 `DOCUMENT_EVIDENCE` page variants 62-132px below `SAFE.bottom` once captions were turned off, and later the clause overhanging `SAFE.right` by 30px on 2 framings |
| VIS-21 | Every scene component parses as JSX | `run-visual-tests.js` (esbuild, per file) | 0 errors | 1 | BLOCKER | **PASS** - the text-based checks cannot see a syntax error; one reached a bundler 15 minutes into a render |
| VIS-22 | No module in `visual/` exports something nothing imports | `run-visual-tests.js` | 0 dead | 1 | MINOR | **PASS** - removed `planAll`, `strategyNames` |
| VIS-23 | Every import in the scene graph names something that is actually exported | `run-visual-tests.js` (esbuild `bundle: true` from `scenes/index.jsx` and `motion-graphics.jsx`) | 0 unresolved | 1 | BLOCKER | **PASS** - verified to fail on both real modes: an importer naming a helper that moved, and a re-export surface that drops a name 4 scenes import |
| VIS-24 | No scene references an identifier nothing binds | `visual/scope-check.js` (`@babel/parser`, scope walk) via `run-visual-tests.js` | 0 free identifiers | 1 | BLOCKER | **PASS** - see 3.12.4; found TWO shipped `ReferenceError`s no other check could see |
| VIS-25 | A sound is chosen for the MATERIAL the picture is made of | `sound-design.js` `MATERIAL_CHARACTER` + `assertSoundMapIsSound` + `run-visual-tests.js` (through `soundEventsForBeat`, not `pickAsset`) | different materials pick different characters | 1 | MINOR | **PASS** - `shot.material` was on every plan and read by nothing in the audio path; only `impact` / `emphasis` / `transition` can discriminate on a 26-file library and the guard fails if the map ever pretends otherwise |
| VIS-26 | The anchor frame is not empty — the picture has arrived by the time the key word is spoken | `qa-scripts/inspect-anchors.mjs` (renderStill on each beat's real SRT anchor frame, ink measured from the pixels) | >=0.4% ink | 3 | MAJOR | **PASS** - see 3.12.5. Found THREE shipped instances no code reading would have caught: `DATA_CHART` (empty axis, four figures reading 0 on the frame saying "ninety"), `CINEMATIC_STATEMENT` (blank frame, 0.1% ink — the phrase IS the scene), `TRANSFORMATION` (0.34%, the plotted curve had zero length). The floor is deliberately low: it is not a quality bar, a frame at 1.2% can still be a thin diagram in a void |
| VIS-27 | A scene that a strategy routed to actually draws something — the plan's asset reaches the scene in the shape the scene reads | `compositions/scenes/evidence-scenes.jsx` `ImageEvidenceScene` + the derived-frame IMAGE_BEAT probes in `verify-compositions.js` | every IMAGE_EVIDENCE beat renders ink | 2 | BLOCKER | **FIXED 2026-09-03** - `director.js` puts a bare path STRING in `plan.payload.asset`; the scene was written for an object and its `||` short-circuited on the truthy string, so `asset.path` was `undefined` and the guard early-returned `null`. Every IMAGE_EVIDENCE beat rendered an empty stage: 21 of the ch-fixture script's 32 beats, the whole timeline after frame 837. Nothing caught it because NO pixel probe in `verify-compositions.js` could affect its exit code — the file had exactly one `process.exitCode = 1`, for the static mg gates, and then printed `ALL STYLES OK` unconditionally, so on any run whose static gates passed, four failing pixel probes still exited 0. (On this fixture the process did exit 1 throughout, but for an unrelated reason: the `captions` static gate was failing on seven ch-fixture SRT cues shorter than the 833ms floor — a separate defect, since fixed under TYP-08.) Its three IMAGE_BEAT probes were also hardcoded to 505/1210/1565 — all beat-START frames, two of them shared with the preceding beat, where an empty stage is correct |

**3.12.1 - VIS-08 is frame-verified, not inferred.** The 150-metre geofence
beat from the real ch-02 script was rendered through the production CLI and
its frames inspected (`qa/pass3/geofence-*.png`).

Frame-verified TWICE, because the first pass at it was not good enough. The
original renderer showed "150 / meters" centred on a flat background - the
data, not the idea. The second-pass replacement drew a perspective floor
grid, an ellipse and fourteen scattered rectangles: spatial, but read cold
it is a grid, an oval and some squares, and nothing in it says CITY.

What the current frames show is a plan-view MAP - an irregular street
network with arterials and a diagonal, city blocks, building footprints - a
true circle laid over it, an accent pin on the incident, device pins
standing ON buildings with the twelve inside the boundary filled and those
outside dimmed, "150 m" as a dimension on the drawn radius, and a camera
that opens at the scale of one address and pulls back as the boundary
grows. Muted, the frame still says: this corner, this boundary, these
buildings inside it.

**3.12.2 - what VIS-05 does and does not prove.** It measures time between
STATE changes. A first render passed it while the picture sat still, because
most scenes only react to their own named states and ignored the sustaining
states that densification adds. `SustainCamera` (`scenes/index.jsx`) now
gives sustaining states a real (small) camera move, so the metric and the
picture agree. It remains a structural proxy: it cannot prove a scene's
named states are individually interesting, only that something changes.

**3.12.3 - VIS-20 passed for a while against geometry the renderer had
stopped drawing.** This is the failure mode worth recording, because the
check never went red while it was wrong.

The constants and the page maths lived in `.jsx` files. Node cannot import
`.jsx`, so the check recovered `SAFE` and `CAPTION_RESERVE_Y` by regex over
`primitives.jsx` and recomputed the page from `DOCUMENT_PAGE_TOP` and
`DOCUMENT_PAGES`. That duplicate was correct until the scene began scaling
the page to its shot frame; from then on the check verified a geometry the
renderer no longer drew, and passed on every run.

The fix was structural, not a better regex: `compositions/layout-constants.js`
is a pure `.js` module holding the constants **and** `documentPageGeometry()`,
imported by both the scene and the check. `primitives.jsx` re-exports the
constants so existing scene imports are unchanged. With one model and two
callers, the check immediately found a real defect the duplicate had been
hiding — the pulled-out clause is set 30px wider than the page on each side,
so on the `close` and `grounded` framings of variant 1 it spanned 112..918
against a safe rect of 48..888. The clamp now budgets for the overhang.

Two consequences worth keeping:

- Anything a test or a gate needs to reason about goes in a `.js` module,
  not a component file. Parsing source text to recover a renderer's numbers
  is a duplicate by another name.
- `VIS-23` exists because moving code between modules is exactly when
  imports break, and per-file parsing (`VIS-21`) cannot see across a module
  boundary. It bundles the graph and fails on a name that is imported but
  never exported.

**3.12.4 - VIS-24, and two `ReferenceError`s that were in the tree while
the suite reported 64 green.** Converting the scenes to lay out against
their shot frame introduced two crashes, both of which survived every check
in this file:

- `OppositionComparison` (`quantity-scenes.jsx`) read `f.w`, `f.cx` and
  `f.h`. `f` was not a parameter, not a declaration, and not a module
  binding. Every qualitative COMPARISON beat would have thrown.
- `abstract-scenes.jsx` called `shotFrame` without importing it. Every
  `VISUAL_METAPHOR` and every `CINEMATIC_STATEMENT` beat would have thrown
  — including the terminal fallback, which is the one scene that has to
  work when nothing else does.

Why nothing caught them: the text-based checks do not model scope; `VIS-21`
parses each file alone and only proves it is syntactically valid; `VIS-23`
bundles the graph, but a free identifier is a legal reference to a global
as far as any bundler is concerned. And the renders did not catch them
because neither branch fired in the clips that had been rendered — a
qualitative comparison needs a beat with no numeric series, and the
metaphor scenes need a beat nothing else claims.

That last point is the one to keep: **a rendered frame proves the path it
rendered, and nothing else.** Frame inspection is still the acceptance
test, but it is not coverage, and treating one render as coverage is how
two guaranteed crashes sat in the tree behind a green suite.

`visual/scope-check.js` walks the AST (`@babel/parser`, JSX) and reports
any identifier referenced in a function with no binding in that function,
any enclosing function, module scope, or a short list of real globals. It
is deliberately conservative — every binding anywhere in a function counts
for the whole function, so it does not model block scope, shadowing or the
temporal dead zone, and it will not catch a use-before-declare. It catches
exactly the class that shipped. Both bugs were re-introduced afterwards to
confirm the check fails on them.

**3.12.5 - VIS-26, and why the anchor frame gets its own check.** Every
beat has one frame that matters more than the rest: the one where its key
token is actually spoken, from the SRT. Three scenes shipped with nothing
drawn on it, and all three were invisible to code review because each was
individually reasonable:

- `DATA_CHART` anchored its `bars` state, so the state that draws EVERY bar
  began exactly when the key token was spoken. The frame of the narration
  saying "ninety" was an empty axis with four figures reading 0.
- `CINEMATIC_STATEMENT` anchored its `subject` state, and that phrase is the
  entire content of the terminal fallback, so the frame came back blank —
  0.1% ink, bbox 100x1%.
- `TRANSFORMATION` anchored its `grow` state, which draws the whole plotted
  curve; at the anchor the path had zero length. 0.34% ink in a 9%-tall band.

This is NOT the same rule as the counter check above it. There the question
was whether a figure contradicts the element it labels, and the answer
depends on whether the anchored state introduces the quantity or resolves
it. Here the question is whether ANYTHING is on screen, and an anchored
state that introduces the entire composition always answers no.

The fix in each case was to anchor the state that RESOLVES the picture
rather than the one that builds it — `highlight` instead of `bars`, `settle`
instead of `grow` — or, for the statement, to drive the phrase from
`useValueProgress` so it lands on the anchor instead of starting there.

**No structural check is claimed for this.** A rule like "the states before
the anchor must outweigh it" was considered and rejected: it produces false
positives on `SCALE_COMPARISON` and `CINEMATIC_STATEMENT`, both of which are
correct for other reasons. The gate is the rendered pixel and nothing else,
which is the honest position — the same reason this register keeps saying a
rendered frame is the acceptance test.

A related fix came out of the same measurements: `progressOf` now returns 1
for a state with a window of one frame or less. When a sentence leads with
its key figure the anchor lands on the beat's opening frame, every state
before the anchored one is squeezed to a degenerate window, and those states
read as not-yet-started on the one frame anyone is looking at.
`SCALE_COMPARISON` measured 0.24% ink for exactly this reason. You cannot
animate something in in a single frame; the honest reading is that it is
established, not absent. That change alone took it to 3.0%.

**3.12.6 - WHAT THE PIXEL AUDIT STILL SAYS, AFTER ALL OF THIS.** Twenty-two
anchor frames rendered through the real composition across four scripts,
measured for ink coverage, bounding box and centroid. The honest summary:

| | before this pass | after |
|---|---|---|
| median anchor ink | 1.4% | 1.4% |
| frames under 1% ink | 9 / 22 | 7 / 22 |
| frames empty at the anchor | 3 | 0 |
| `GEOSPATIAL_RADIUS` | 35-47% | 32-46% |

Bounding boxes moved a lot — `DOCUMENT_EVIDENCE` 62x41% to 85x78%,
`VISUAL_METAPHOR` 82x36% to 98x81%, `PROCESS` 55x94% to 96x94%,
`SCALE_COMPARISON` 95x22% to 100x44% — so compositions now reach across the
frame instead of sitting in a band. **Ink did not move.** The scenes are
wider, not heavier.

**`GEOSPATIAL_RADIUS` is still the only scene that fills its frame, by an
order of magnitude, and it is still the only one nobody called a template.**
That was the finding at the start of this pass and it is the finding at the
end of it. The difference is not the subject and it is no longer ground,
depth, framing or camera — every scene has those now. It is that the map
draws MASS (filled blocks, a filled radius, a street grid with weight) while
the other fifteen draw LINE (2-4px strokes on an empty field). At
1080x1920 a 3px stroke is 0.28% of the width; you cannot reach 30% ink with
strokes, whatever you stage them on.

Closing that gap means giving the other fifteen scenes real filled mass, and
that is per-scene design work, not another shared layer. It is not done, and
this register should not imply otherwise: the composition layer removed the
`cx 0.43` monoculture and the empty-anchor class of defect, and it did not
make the frames dense.

**3.12.7 — closing part of the mass gap: 11 of the 15 LINE scenes given real
fill.** Same method as 3.12.6 (`qa-scripts/inspect-anchors.mjs`, the same
three fixtures plus the real ch-02 script), a baseline captured before any
edit this pass, the same tool re-run after. Before/after ink, same anchor
frames:

| Strategy | before | after |
|---|---|---|
| DOCUMENT_EVIDENCE | 4.7% / 3.4% / 4.7% | 25.8% / 17.5% / 18.5% |
| VISUAL_METAPHOR | 1.9% | 21.9% |
| COMPARISON (qualitative/Opposition) | 2.8% | 15.6% |
| PROCESS | 2.3% / 2.1% | 17.7% / 18.0% |
| DATA_CHART | 0.8% / 1.3% | 11.6% / 18.0% |
| TIMELINE | 1.4% | 11.0% |
| COMPARISON (quantitative) | 0.7% | 8.8% |
| ACCUMULATION (tray, v0) | 1.2% | 4.4% |
| TRANSFORMATION | 0.6% | 5.0% |
| INTERFACE_SIMULATION | 0.8% | 3.5% |
| RELATIONSHIP | 0.5% | 1.0% (anchor frame lands before `links` fires — see below) |

**What actually changed, per scene, and why it was a fill, not a redesign.**
Each of these had a specific, findable root cause, not "make it bigger":

- `DocumentEvidenceScene` and `InterfaceSimulationScene` (`evidence-scenes.jsx`)
  filled their page/window with `colors.bg` or `fill="none"`. In this token
  system (`styles/tokens.js`) `bg`/`surface`/`raised` are the SAME flat
  `#FFFFFF`/`#000000` as the canvas — the page and the window chrome were
  invisible containers, drawn as nothing but their own stroke outline. This
  is the same class of bug on two different scenes, not a style choice; the
  fix is the fill GEOSPATIAL_RADIUS already used (`colors.stroke` at low
  opacity) applied to the two scenes that had never gotten it.
- `RelationshipScene` nodes had the identical `fill={colors.bg}` bug (an
  invisible disc with a 3px ring). Links were 1.8-4px hairlines. Fixed to
  filled discs and 6-13px bands — the weakest scene in the system barely
  moved on THIS anchor frame because the anchor lands during the `nodes`
  state, before `links` fires; the link fix is real but this fixture's SRT
  timing doesn't exercise it at the sampled frame. Recorded honestly rather
  than claimed fixed by a number that didn't move.
- `VisualMetaphorScene` five rings were stroke-only ellipses. Added a filled
  disc per ring at equal low opacity (0.1); same-colour translucent layers
  compose additively wherever they overlap, so the centre (under all five)
  reads densest and it falls off toward the boundary with no per-ring
  ordering logic required. This is what `stage.jsx`'s own material comment
  ("field: isolines of a potential") already specified and no scene drew.
- `OppositionComparison` (`quantity-scenes.jsx`) had 9 hairline "strata" per
  side with real canvas gaps between them. Reduced to 6 filled bands
  (alternating tone) per side — literal: sedimentary strata are filled rock
  layers, and the code's own name for the technique had a filled answer
  sitting unused.
- `DataChartScene`, `ComparisonScene` (quantitative), `AccumulationScene`
  (tray variant) — bars/items were `fill="none"` except one highlighted
  element. Standard filled-bar/filled-unit convention, matching the
  ledger variant `AccumulationScene` already used for the same concept.
- `TransformationScene` — added a filled area between the plotted curve and
  its starting level (an area chart), closed and filled with the same
  points the line already plots. Answers "how much changed", which a bare
  4px line did not.
- `ProcessScene` / `TimelineScene` fills existed but at 0.05-0.09 opacity —
  under `stage.jsx`'s OWN documented finding two paragraphs above this one
  in this file's history ("5% opacity lands ~12/255 from bg, below the ink
  threshold"). Raised to 0.11-0.16, the same range `Ground`'s alphas
  already sit in.

**Not touched, with reason:** `CauseEffectScene` (already flow-ribbon strokes
up to 9px from the prior pass, 2.4% ink, no specific rendered defect found
this pass), `BeforeAfterScene` (the sparse-outline/dense-fill contrast
between its two sides IS the concept), `ScaleComparisonScene` (already
mostly filled once grown), `CinematicStatementScene` (register 3.12.5
already treats its low ink as correct for a deliberately sparse terminal
fallback), `GeospatialRadiusScene` (the benchmark; untouched — its own
before/after ink moved 38.3%->36.2% and 47.0%->47.0% on IDENTICAL code
across two separate render passes, which is measurement noise in the
headless render, not a regression, and is recorded here so it isn't
mistaken for one later).

**A real, unrelated, blocking bug found and fixed to make ANY of this
measurable:** `package.json` was missing four dependencies
(`@remotion/media`, `@remotion/three`, `@react-three/postprocessing`,
`postprocessing`) that `compositions/*.jsx`, `beats/*.jsx` and
`effects/PhotoTreatment.jsx` already imported (from the unrelated
vox-style-treatment work on `main`). Without them `@remotion/bundler` cannot
resolve the module graph at all — `inspect-anchors.mjs` and `render.js`
both fail before rendering a single frame. Added at the versions already
pinned elsewhere in the file (`4.0.503`) or latest compatible.

**QA run this pass:** `node visual/run-visual-tests.js` — 69/69 passed,
including the anti-template shot-signature check (`no two strategies share a
whole shot signature`), after these edits. One real production render
(`node render.js shorts 48 …`, not `renderStill`) for the tech-process
fixture: 5 beats, 21 states, 0 fallback reasons, 0 warnings, 12 sound events,
a real MP4 written to `data/renders/48/`; frames pulled from the actual
encoded video (not `renderStill`) at six timestamps and inspected. All
changes above were viewed as rendered PNGs, before and after, not judged
from the ink number alone.

**Still not proven, honestly:** `IMAGE_EVIDENCE` — no real sourced asset
resolved in this sandbox on any fixture run (imagery: 0/N every time), so it
remains unverified per PART 47, not claimed fixed. Real TTS/EdgeTTS audio is
still blocked in this environment — every number in this entry is
FIXTURE-VERIFIED (generated SRT timing, silent placeholder audio), not
PRODUCTION-VERIFIED against real speech. `RelationshipScene`'s link-band fix
specifically needs a frame where `links`/`weight` are active to see
rendered, which this pass's fixtures did not sample.

**3.12.8 — the element layer: designed objects replacing primitive
assembly, not more mass on the same primitives.** 3.12.7 closed the
mass gap (fills instead of hairlines) without changing what the scenes
were built FROM — a filled rectangle is still a rectangle. This pass's
brief was narrower and harder: trace each target scene back to the
primitive-assembly problem, remove it, and rebuild the visual body on
actual designed objects with internal structure
(`compositions/scenes/elements/*.jsx`, new this pass), while leaving the
semantic/director/composition/camera/sound infrastructure untouched.

New element files, each a real object with internal parts, not a
primitive with a new name:

- `elements/machine.jsx` — `MachineBody` (casing with wall/floor/ties),
  `Gate` (two facing jaws with a real aperture), `MaterialSlug` (a
  discrete body of material).
- `elements/circuit.jsx` — `CircuitNode` (a component with a status
  light), `CircuitTrace` (a right-angle PCB-style connection),
  `SignalPacket` (the thing actually travelling).
- `elements/document.jsx` — `DocumentSheet`: depth shadow, a folded
  corner, a letterhead region distinct from body rhythm, a margin
  annotation bracket, a page number — a constructed page, not a bordered
  rectangle with ruled bars.
- `elements/interface.jsx` — `WindowChrome`, `NavRail`, `StatusBar`: a
  real windowed-application region hierarchy (title bar + tab, a
  navigation rail, a status strip), still fully abstract (no invented
  product identity, `dataNeeds: []` unchanged).
- `elements/chart.jsx` — `ChartColumn`: a three-face block (front/top/
  side, one ink at three opacities, no gradient) instead of a flat
  rectangle, shared by COMPARISON and DATA_CHART.
- `elements/transform.jsx` — `MorphShape` (corner-rounding + proportion
  interpolation, not a swapped rectangle), `ContentVessel` (a bounded
  container for BEFORE_AFTER's field so it is one object's contents
  changing, not an unbounded cell grid).

Strategies rebuilt on these, each with a specific traced defect, not a
restyle:

- **CAUSE_EFFECT** — the flow-lanes version (already thickened twice, in
  earlier passes) was still curved strokes converging through two chevron
  strokes: primitives with more width. Rebuilt as a gated duct
  (`MachineBody` + `Gate` + `MaterialSlug`). Found and fixed a real timing
  bug in the process: `link` (the anchored state) drove the gate's close
  amount from raw `progressOf`, which is 0 at the exact frame the anchor
  lands — the causal word landing with no gate reaction on screen. Fixed
  by driving it from `useValueProgress` (reaches 1 at the anchor, the same
  technique GEOSPATIAL_RADIUS's `lock` already uses) and adding
  `resolves: true` to `strategies.js`'s `CAUSE_EFFECT.link`, matching the
  existing precedent (`lock`, `total`, `settle`, `highlight`). Also fixed
  a real composition defect found on the first render: upstream material
  collapsed to a narrow band near the gate instead of using the casing's
  width — rewritten so the queue is evenly spread when the gate is open
  and compresses toward the gate as it closes, which is the backlog made
  of the same objects rather than a separate indicator.
- **PROCESS** — was one universal template (a roller-and-workpiece
  machine) regardless of subject, which PART 12 explicitly forbids.
  `sup.stages` is confirmed to be a bare count with no per-stage labels
  anywhere in the data pipeline (`director.js`: `supporting.stages =
  payload.stages || 3`), so per-stage NAMES cannot be shown without
  inventing content. What CAN change without inventing anything is the
  OBJECT FAMILY: a deterministic keyword read of the beat's own text
  (`processFamily`, the same technique `VisualMetaphorScene` already uses
  for its `mode`) now selects "circuit" (a request/signal moving through
  system components — `CircuitNode`/`CircuitTrace`/`SignalPacket` mounted
  on a `MachineBody` board) for a digital/software subject, or keeps the
  existing roller-and-gate machine ("mechanism" family) otherwise. A real
  defect surfaced building this: `CircuitNode`'s unlit fill opacity was
  0.09-0.13, under the render's own documented ink-visibility floor, so
  the circuit family's anchor frame came back under `ANCHOR_INK_FLOOR`
  the first time it rendered — raised to a floor that stays visible
  regardless of lit state.
- **DOCUMENT_EVIDENCE** — extended past 3.12.7's paper-fill fix into a
  constructed page: depth shadow, a folded corner, a letterhead region,
  a margin annotation bracket beside the located clause, a page number.
  No new document text — the only words drawn are still the beat's real
  pulled narration phrase.
- **INTERFACE_SIMULATION** — chrome + three loose rectangles became a
  real region hierarchy (nav rail, status bar, tab), still fully
  abstract per PART 23 (no product identity invented).
- **ACCUMULATION** (tray variant) — was a grid (even rows/columns); now a
  pile — items overlap, a mound tapers (fewer items fit per layer up),
  each item carries a small seeded rotation/scale, with a ground shadow
  that grows with the pile. Deterministic from `i` alone, same
  no-`Math.random` rule as the rest of the file.
- **COMPARISON / DATA_CHART** — flat bars became `ChartColumn` blocks
  (front/top/side faces). Two strategies sharing one element is the kind
  of primitive reuse PART 10 explicitly allows ("may share individual
  primitives... may NOT share the same overall composition") — verified
  they do NOT also share a shot signature (see 3.12.8's new check below),
  which is the actual test of whether reuse became duplication.
- **TRANSFORMATION** — added `MorphShape` at the curve's head: an object
  whose own height (scaled to the from/to magnitude) and corner-rounding
  change, not a dot riding a line. The plotted curve + area fill from
  3.12.7 stays as the trajectory evidence; the block is the value as an
  object.
- **BEFORE_AFTER** — the sparse/dense cell field (a real, meaningful
  contrast, kept) is now held inside a `ContentVessel` — one bounded
  object whose contents change, not a borderless grid.
- **TIMELINE** — event markers' rectangular caps became pennants (a flag
  planted in the ground), a small but real object-silhouette change; the
  post/shadow/footing construction from the prior pass is unchanged.

**Not touched, with reason:** GEOSPATIAL_RADIUS (the benchmark, PART 20
explicit "do not regress it" — re-measured this pass at 39.4%/47.0% ink,
unchanged), CINEMATIC_STATEMENT (PART 21: "do not force mechanisms into
sentences that do not contain mechanisms" — it is deliberately
object-free typography-in-a-shot and no rendered defect was found this
pass), RELATIONSHIP, VISUAL_METAPHOR, SCALE_COMPARISON (not named in this
pass's target list; re-measured unchanged at 21.9% ink for VISUAL_METAPHOR
on the same fixture as a spot check).

**QA extended, not just re-run:**

- A new check, "no two strategies share BOTH a shot signature and an
  object family" (`run-visual-tests.js`), reads each strategy's actual
  scene source to extract which `elements/*` components it references,
  combines that with the existing material/framing/camera/depth
  signature, and flags a strategy pair only if BOTH match — sharing an
  element alone (COMPARISON/DATA_CHART both use `ChartColumn`;
  CAUSE_EFFECT/PROCESS both use `MachineBody`) is confirmed fine because
  their full shot signatures differ (verified directly:
  `CAUSE_EFFECT=field|acting-left|track-right|layered` vs
  `PROCESS=mechanism|columnar|descend|layered`).
- The existing "no module exports something nothing imports" check only
  ever scanned `visual/*.js`. Extended to also scan
  `compositions/scenes/elements/*.jsx` — and immediately found a real
  dead export building this pass (`BackedUpLevel`, written for
  CAUSE_EFFECT's backlog, then orphaned when that backlog became queue
  compression instead of a separate indicator). The check still counts
  raw name occurrences including comments (a pre-existing limitation, not
  fixed this pass), so it did not catch `BackedUpLevel` automatically —
  found by hand, removed by hand, recorded here so the gap in the check's
  method is not silently relied on again.

**QA run this pass:** `node visual/run-visual-tests.js` — 70/70 passing
(69 from 3.12.7 plus the one new check). One real production render
(`node render.js shorts 48 …`) for the tech-process fixture — 5 beats, 21
states, 0 fallback reasons, 0 warnings, 12 sound events — with frames
pulled from the actual encoded MP4, not `renderStill`, and inspected.
Every strategy listed as "rebuilt" above was rendered and its PNG looked
at, not inferred from the ink number; several (CAUSE_EFFECT, PROCESS
circuit family) needed a second or third render after a defect was found
on the first look, per PART 32's own instruction not to claim success
without one.

**Still not proven, honestly:** the same IMAGE_EVIDENCE and real-TTS caveats
from 3.12.7 hold unchanged. Additionally: `ink%` from `inspect-anchors.mjs`
was observed to shift by a large margin (PROCESS mechanism family: ~18%
in one measurement run, ~30-38% in another, on byte-identical unmodified
code, confirmed via `git diff` showing zero change to `ProcessScene`
between runs) — almost certainly the corner-based background sampling
being thrown off by the renderer's own background noise/dot-grid texture
on a large near-threshold fill, not a real visual difference (the PNGs
from both runs were visually inspected and are indistinguishable). Noted
here rather than chased further; it is why this entry leans on rendered
PNGs, described directly, rather than presenting ink percentages as the
evidence.

---

**3.12.9 — killing the two named bad patterns: fake-3D-bevel bars and the
concentric-ring ground.** A third, larger directive ("MAJOR VISUAL
REBUILD — DELETE THE OLD VISUAL LANGUAGE AND REBUILD THE MOTION SYSTEM")
arrived after 3.12.8 shipped, naming four specific renders from THAT pass
as bad patterns that must not survive: "the grey 3D bar chart", "the green
$340 block", "the concentric-ring background", "arbitrary decorative
geometry" — the message was cut off after that list, before its full
9-phase scope (a `visualLanguage` field on every strategy's contract, a
forbidden-default-pattern audit across all 16 strategies, a full
material-aware SFX rebuild, camera-choreography rebuild, typography
rebuild, and a final production render with audio inspection) could be
read in full.

**What this entry covers is the two named patterns that could be traced to
an exact cause and fixed with evidence in the time available — not the
full 9-phase rebuild, which is honestly out of reach of one pass and is
recorded as remaining work below, not silently dropped.**

- **"the grey 3D bar chart" / "the green $340 block".** Both are
  `ChartColumn` (`elements/chart.jsx`, added in 3.12.8): three `<path>`
  faces at three opacities faking an isometric block. Read cold, that IS a
  bevelled 3D bar with a number over it — decoration bolted onto a
  rectangle, and PART 11 of the new directive explicitly forbids exactly
  this ("do NOT use fake 3D bevels just to make a bar feel designed").
  Deleted, not patched. Replaced with:
  - `StackedMass` (`elements/chart.jsx`, rewritten) — a quantity as a
    stack of discrete, separately-drawn unit segments (isotype/pictogram
    convention: segment count derived from the real value, nothing
    invented), no fake depth faces.
  - `BalanceBeam` (`elements/balance.jsx`, new) — COMPARISON's two
    quantities as a literal weighing scale: fulcrum, tilting beam, two
    pans, real value delta driving the tilt angle. Weighing is the
    non-decorative reading of "comparison" (PART 28's carve-out: geometry
    earns its place when the story specifically requires it), and it
    gives COMPARISON an object unmistakably different from DATA_CHART's
    freestanding columns even though both now share `StackedMass` as
    their underlying material — sharing a primitive is fine, sharing the
    whole composition is the violation (PART 10, restated in 3.12.8).
  - `ComparisonScene`'s quantitative branch and `DataChartScene` rewired
    to the new elements. The old dashed-line-plus-arrow "gap" annotation
    in `ComparisonScene` is gone — the balance's tilt already encodes the
    difference, so a diagram annotating a diagram was dropped rather than
    kept.
  - Rendered and pixel-inspected: `finance-accumulation.fixture.json`
    (COMPARISON, "$340 vs $0" — the exact beat the "$340 block" callout
    matches) and `uncovered-strategies.fixture.json` (DATA_CHART, 4-region
    series). Both PNGs show flat stacked-unit columns / a tilting scale;
    no bevel, no isometric faces.

- **"the concentric-ring background".** Traced past the scene layer to
  shared staging infrastructure: `FieldGround` (`compositions/scenes/
  stage.jsx`), the ground texture drawn under every strategy whose
  material is `field` (COMPARISON among them, per `visual/composition.js`'s
  `STRATEGY_MATERIAL` table) — nine concentric ellipses centred at a FIXED
  screen point, unconditionally, regardless of what any given beat needed.
  That is the pattern PART 28 forbids by definition: decorative geometry
  that appears because it is the layer's default, not because the story
  asked for it. Rewritten to a family of wavy horizontal contour bands
  (still "isolines of a potential" — the concept `FieldGround` documents
  itself as representing — just not a bullseye). Separately,
  `VisualMetaphorScene` (`abstract-scenes.jsx`) drew its OWN five
  concentric ellipses for four of its five notion-driven "modes"
  (`closing`/`converging`/`revealing`/`destabilising`); only `loading`'s
  compressing bars were not rings. Replaced with `PressureWalls`
  (`elements/pressure.jsx`, new) — four solid walls closing on or opening
  away from the subject, standoff distance driven by the same per-mode
  progress math the rings used. `converging` (the no-keyword-match
  default) was folded into `closing` rather than kept as a fifth
  near-duplicate bucket. `loading`'s bars are unchanged — they were never
  rings and PART 28 explicitly allows geometry the story requires.
  Rendered and pixel-inspected via the `FieldGround` fix (COMPARISON
  frames, since no fixture currently drives VISUAL_METAPHOR); the
  `PressureWalls` code path itself is covered by the full test suite's
  "every scene component parses" / "no identifier that does not exist" /
  "scene graph resolves" checks but has NOT been rendered and looked at —
  recorded as unverified below, not claimed as proven.

- **QA changes.** `visual/run-visual-tests.js`'s hand-maintained
  `ELEMENT_NAMES` list (object-family anti-template check, added 3.12.8)
  updated: `ChartColumn` removed, `StackedMass` / `BalanceBeam` /
  `PressureWalls` added, and the already-dead `BackedUpLevel` entry
  (deleted from `machine.jsx` in 3.12.8, but left in this list) finally
  removed.

**QA run this pass:** `node visual/run-visual-tests.js` — 70/70 passing,
unchanged count (this pass swapped element implementations, it did not
add or remove a strategy or a check). Rendered via
`qa-scripts/inspect-anchors.mjs --all-states` against
`finance-accumulation.fixture.json` (channel 1) both before and after the
`FieldGround` fix, and against `uncovered-strategies.fixture.json`
(channel 1) after — all PNGs opened and looked at, not inferred from ink
percentages alone.

**What this pass explicitly did NOT attempt, so it is not claimed done:**
the directive's full 9-phase scope. In particular: no `visualLanguage` (or
purpose/entities/relationship/mechanism/muteRelationship/
prohibitedRepresentations/preferredReferences/cameraIntent/motionIntent/
material/soundIntent) field was added to any strategy's contract; the
remaining 13 strategies were not individually re-audited against the full
forbidden-default-pattern list (centred box, three-column cards, arrow
flowchart, circles-connected-by-lines, horizontal timeline, stacked
rectangles, rectangle+label, giant centred number, decorative grid); no
SFX/material-sound redesign, no camera-choreography rebuild, no
typography-system rebuild, and no full production render with audio
inspection were done. These are real, large, separately-schedulable
pieces of work, not implied by this entry — a future pass should treat
this section as a starting point, not a completed rebuild.

---

**3.12.10 — fresh audit for a fourth, still-larger directive ("MAJOR
VISUAL REBUILD — DELETE THE OLD VISUAL LANGUAGE AND REBUILD THE MOTION
SYSTEM"), plus one completed high-leverage fix: real camera
choreography.** This directive named four new reference repos
(`iart-ai/motion-design-skills`, `haidrrrry/claude-remotion-skill`,
`Liamrjohnston/remotion-motion-graphics-skill`, `remotion-dev/skills`)
and a 24-phase scope covering every strategy, camera, typography, motion,
materials and sound. What follows is the Phase 0 audit and the one phase
carried through to a real, rendered, committed fix — not a claim that the
other 23 phases are done.

**Phase 0 finding that changes the audit's shape: there is a second,
parallel rendering path this repo's last three passes never touched.**
`Root.jsx` registers three composition sets —
`compositions/cinematic-documentary.jsx`, `compositions/minimal.jsx`,
`compositions/motion-graphics.jsx` — and `motion-graphics.jsx` (1813
lines) is not just a thin wrapper around `SemanticScene`
(`compositions/scenes/index.jsx`, the system 3.12.7-3.12.9 rebuilt). It
contains its OWN inline scene components — `HeroNumberScene`,
`TermDefineScene`, `ContrastScene`, `ProgressScene`, `RelationScene`,
`StatementScene`, `ImageBeatScene` (`motion-graphics.jsx:956-1485`) — and
a `StageScene` router (`motion-graphics.jsx:1508-1531`) that is
EXACTLY the box/bar/node-and-arrow vocabulary this whole rebuild exists
to remove: `ContrastScene` is bars, `RelationScene` is nodes connected by
lines, `StatementScene` is a lone centred icon. The router's own comment
(`motion-graphics.jsx:1487-1507`) states why this still exists: it is a
LEGACY PATH that only fires when `beat.visualPlan` is absent — real
production beats always carry one (built by `visual/director.js` via
`buildMgPackage`), so this switch is reachable only by callers that
construct beats without going through that pipeline
(`verify-compositions.js` fixtures, older tests) and by `LIST_ITEM`
(routed separately, before this switch, as a chip-accumulation system
that was already real and out of scope). Separately, `primitives/*.jsx`
(`Chart.jsx`, `Chip.jsx`, `Icon.jsx`, `Node.jsx`, `Panel.jsx`, `Rule.jsx`)
and `beats/*.jsx` (`Contrast.jsx`, `HeroNumber.jsx`, `ImageBeat.jsx`,
`ListItem.jsx`, `Progress.jsx`, `PullQuote.jsx`, `Relation.jsx`,
`Statement.jsx`, `TermDefine.jsx`) exist as FILES but a grep of
`motion-graphics.jsx`'s imports shows only `Panel` from `primitives/` is
actually imported — the `beats/*.jsx` versions of these same names are
not the ones `motion-graphics.jsx` renders (it defines its own inline
copies); whether `beats/*.jsx` is reachable from `minimal.jsx` or
`cinematic-documentary.jsx` was not checked this pass and is recorded
here as unverified, not assumed.

**Recorded, not yet acted on:** Phase 16 says delete an old primitive
system unless "actually required," and says rewrite a test that protects
rejected behaviour rather than keep the behaviour for the test's sake.
The legacy `StageScene` switch is required, today, for
`verify-compositions.js` and older tests to run at all. Deleting it
correctly means first making those callers build a real `visualPlan` (or
retiring the tests that cannot), which is real, separate, scoped work —
not done this pass. Recorded here so it is not silently rediscovered
later: this is what Phase 16 refers to for this repo, its exact location
is `motion-graphics.jsx:1508-1531` plus the seven scene functions above
it, and the blocker is the two callers named in the router's own comment.

**Phase 11 (camera), completed and verified.** `Shot` and `Plane`
(`compositions/scenes/stage.jsx`) drove every camera move — all 16
strategies, via the shared `STRATEGY_CAMERA` table in
`visual/composition.js` — through one continuous
`ease(p, EASE_IN_OUT)` from `cam.from` to `cam.to`, linearly across the
beat's ENTIRE duration. That is the exact pattern
`Liamrjohnston/remotion-motion-graphics-skill`'s
`skills/cinematic-camera/SKILL.md` names as rejected ("slow zoom as the
only camera idea", "single A->B interpolation") — and it is a SHARED
infrastructure defect, not a per-strategy one, so it affected every
strategy's shot identically regardless of how good that strategy's
objects were. Replaced with `cameraCurve()`
(`compositions/scenes/stage.jsx`): hold at the start framing, a short
decisive move, hold at the end framing, timed to the beat's own anchored
state (`visual/states.js`) so the camera's arrival lines up with when the
anchor's content actually lands, per the same file's camera rig
("repeated adjacent keys create holds... camera moves to the next
action; action completes during the hold"). `Plane`'s parallax now reads
off the identical curve so depth layers stay synced to the camera instead
of drifting on their own schedule. `composition.js` itself — the
`CAMERA_MOVES` presets, `STRATEGY_CAMERA` table, `composeShot` — is
unchanged; this is purely how the existing values are traversed over
time. 70/70 checks pass; rendered via `inspect-anchors.mjs --all-states`
against `finance-accumulation.fixture.json`, TRANSFORMATION's
establish→anchor frames inspected directly and show the camera actually
travelling rather than a flat linear drift.

**Checked and found already real, not rebuilt:**
- **PROCESS's mechanism family**
  (`compositions/scenes/structure-scenes.jsx:296-502`, `CircuitProcess`
  at `515-578`) is not BOX→ARROW→BOX. It is a track with roller stations
  and a workpiece that descends, narrows and gains colour as it is
  worked, camera descending with it — "material moving through a
  system," one of Phase 3's own listed acceptable structures, built in
  3.12.8. Judged KEEP; not touched this pass.
- **Material-aware SFX** (Phase 15's premise: "the current sound system
  has not yet properly incorporated MATERIAL") — already exists.
  `visual/sound-design.js`'s `MATERIAL_CHARACTER` table
  (`sound-design.js:312-325`) maps each of the 8 shot materials to
  preferred asset characters for the 3 roles the actual 26-file CC0
  library can discriminate (`impact`, `emphasis`, `transition`), and
  `pickAsset` (`sound-design.js:342-358`) narrows its pool by the beat's
  real `shot.material` before falling back. The same code is explicit
  about where this stops: most roles have exactly one character in the
  library, so no material choice is possible for them, and the comment
  says so rather than claiming otherwise. Judged KEEP; not touched this
  pass.

**Not done this pass, so not claimed done:** the remaining 5 untouched
strategies (RELATIONSHIP, IMAGE_EVIDENCE, SCALE_COMPARISON,
INTERFACE_SIMULATION, BEFORE_AFTER) have not been individually
re-audited against this directive's forbidden-pattern list; Phase 10
(typography as the visual, not a label in a box) was not attempted;
Phase 14 (material identity beyond the sound layer) was not attempted;
the legacy `motion-graphics.jsx` beats-switch deletion described above
was not attempted; no full production render across all 16 strategies
was done this pass. These remain real, open work.

---

**3.12.11 — the legacy path, confirmed dead and deleted.** A fifth
directive ("FINAL VISUAL REBUILD — DELETE THE OLD LANGUAGE, DO NOT LAYER
ON TOP") asked for the §3.12.10 finding to be independently re-confirmed
by tracing production execution end to end, not assumed from the prior
note — and then deleted, not merely marked deprecated, if still true.

**Confirmed, by source tracing, not by re-reading the old comment:**
- Every caller that reaches `compositions/motion-graphics.jsx`'s
  `StageScene` router builds its beats through
  `compositions/mg-package.js`'s `buildMgPackage`: `render.js:268` and
  `verify-compositions.js:125` both bundle `Root.jsx` (the real entry —
  confirmed via `remotion.config.js` carrying no separate entry override),
  and `qa-sample.js:20` imports `buildMgPackage` directly.
- `buildMgPackage` sets `b.visualPlan = null` for exactly one case —
  `archetype === "LIST_ITEM"` (`mg-package.js:683-686`) — and LIST_ITEM
  beats never reach `StageScene` at all: `BeatStages`
  (`motion-graphics.jsx`, then ~1657-1678) filters them out before the
  map that renders `StageScene`, because they are handled by the
  separate, real `ListRuns`/chip system instead.
- For every other archetype, `b.visualPlan = planVisual(b, ...)` runs
  unconditionally, and `planVisual` (`visual/director.js:341-372`) always
  returns a real plan object via one of three paths — `authored`,
  `deterministic`, or an `emergency` fallback to `TERMINAL_STRATEGY` —
  with no code path that returns null or undefined.
- Therefore `StageScene`'s `if (beat.visualPlan) return <SemanticScene
  .../>` fires for every beat that reaches it, unconditionally, in every
  real caller. The archetype-keyed `switch` below it — and the seven
  scene functions it called (`HeroNumberScene`, `TermDefineScene`,
  `ContrastScene`, `ProgressScene`, `RelationScene`, `StatementScene`,
  `ImageBeatScene`) — is not "legacy-mostly," it is provably unreachable
  from every currently existing caller. §3.12.10's "mainly through
  verify-compositions.js" was itself imprecise: that file also goes
  through `buildMgPackage`, so it never hit the switch either.
- Separately traced and confirmed fully orphaned: `_motion-entry.jsx` is
  a second, self-registering Remotion root (`registerRoot`) that nothing
  bundles — not `remotion.config.js`, not `render.js`, not
  `verify-compositions.js` — built against `beats/*.jsx` (a directory,
  distinct from the live `compositions/beats.js` constants file of the
  same basename) and hardcoded fixture data predating the current
  `visualPlan`/`visual/states.js` architecture entirely. `beats/*.jsx`
  had exactly one importer: `_motion-entry.jsx`. `primitives/{Chart,Chip,
  Icon,Node}.jsx` had exactly one importer each: the corresponding
  `beats/*.jsx` file. `primitives/Rule.jsx` had zero importers anywhere.
  `layers/Layer.jsx` had exactly one importer group: `beats/*.jsx`.
  `primitives/Panel.jsx` was the one exception — checked and confirmed
  used by the LIVE `ListRuns` chip system (`motion-graphics.jsx`, the
  "MANUAL A5.1" flat-card comment), so it was kept.

**Deleted:** `StageScene`'s archetype switch and six of its seven scene
functions (`HeroNumberScene`, `TermDefineScene`, `ContrastScene`,
`ProgressScene`, `RelationScene`, `StatementScene` —
`compositions/motion-graphics.jsx`, 458 lines removed total across both
cuts); the call site rewired to call `SemanticScene` directly.
`_motion-entry.jsx`; the whole `beats/` directory (9 files:
`Contrast.jsx`, `HeroNumber.jsx`, `ImageBeat.jsx`, `ListItem.jsx`,
`Progress.jsx`, `PullQuote.jsx`, `Relation.jsx`, `Statement.jsx`,
`TermDefine.jsx`); `primitives/Chart.jsx`, `Chip.jsx`, `Icon.jsx`,
`Node.jsx`, `Rule.jsx`; `layers/Layer.jsx` (and both now-empty
directories).

**Deliberately NOT deleted, and why this is not a hedge:** `ImageBeatScene`
(the seventh scene function). It was equally unreachable by the same
proof, but unlike the other six it is not primitive-vocabulary decoration
— it drives `effects/PhotoTreatment.jsx`, a real `@react-three/
postprocessing` pipeline (Vignette, Noise, ChromaticAberration, DotScreen,
a generated 3D LUT) for cutout-vs-fullbleed photo treatment, and the LIVE
image path (`ImageEvidenceScene`, `compositions/scenes/evidence-scenes.jsx`)
was checked and confirmed to use none of that — it renders a plain `<Img>`
with a bare CSS `objectFit`. Deleting `ImageBeatScene` would have deleted
that unported capability with it. That is a real, separate, larger
decision — whether IMAGE_EVIDENCE's photo treatment deserves the WebGL
pipeline, and whether the integration work (ThreeCanvas/Suspense/
PostFxReadyGate) is worth it for this repo's actual asset library — not
"is this old primitive vocabulary." Left in place, unreferenced, flagged
with an explicit comment at its definition explaining exactly this, so it
is a deliberate open decision and not a silently preserved dead system.

**QA run this pass:** `node visual/run-visual-tests.js` — 70/70 passing,
unchanged (this deletion touched no strategy, state, or check). Two real
bundle+render passes via `inspect-anchors.mjs` after the deletion —
`finance-accumulation.fixture.json` (ACCUMULATION, TRANSFORMATION,
COMPARISON, CINEMATIC_STATEMENT) and `tech-process.fixture.json`
(PROCESS, INTERFACE_SIMULATION, CAUSE_EFFECT, TIMELINE) — both bundled
and rendered cleanly, ink numbers unchanged from before the deletion.
LIST_ITEM's `ListRuns` chip path (the one thing this deletion could have
broken, since it shares `primitives/Panel.jsx`) was not exercised by
either fixture this pass — neither contains a LIST_ITEM beat — so it is
verified by code-tracing (Panel's import untouched, ListRuns' own code
untouched) rather than by a render. Recorded as such, not claimed
render-verified.

---

**3.12.12 — the ImageBeatScene decision, made: ported, not left as
archaeology.** A sixth directive ("FINAL INTEGRATION + DESTRUCTION PASS")
required §3.12.11's deliberately-open `ImageBeatScene` question be
resolved to one of exactly two outcomes — port its capability, or delete
it outright — rather than left indefinitely unreferenced.

**Outcome: A, ported.** `effects/PhotoTreatment.jsx` (the real
`@react-three/postprocessing` pipeline — vignette, print-halftone grain,
chromatic aberration, a generated 3D LUT) is a small, self-contained
component (`{ src, treatment, width, height }` in, a `<ThreeCanvas>` out)
with no dependency on anything else `ImageBeatScene` or
`motion-graphics.jsx` privately held, which made this a clean swap rather
than a rewrite. `compositions/scenes/evidence-scenes.jsx`'s
`ImageEvidenceScene` had its plain `<Img objectFit=.../>` replaced with
`<PhotoTreatment .../>` inside the same reveal/scale wrapper the scene
already had, sized from the same `shotFrame()` rect it already computed.

**A real bug the render caught, not the code review:** `ThreeCanvas`
requires integer `width`/`height`; `shotFrame()`'s `f.w`/`f.h` are
coverage-derived floats. First render threw `TypeError: The "height"
prop of the <ThreeCanvas /> component must be an integer, but is
927.3600000000001.` Fixed with `Math.round()` on both dimensions at the
`PhotoTreatment` call site.

**Verified with an actual sourced photo, per the directive's own
"render an actual sourced image, inspect the result" requirement** — not
claimed from code reading alone, per `PhotoTreatment.jsx`'s own
documented history of a prior "renders without crashing, frame is blank
white" failure mode. New one-off script
`qa-scripts/qa-render-image-evidence.mjs` drives the REAL
`buildMgPackage`/`planVisual` pipeline (not a hand-built `mg` package —
`visual/director.js:206-214` selects IMAGE_EVIDENCE whenever
`ctx.asset` is truthy, which `imageForSection` supplies) against the one
real, non-fixture photo in this repo's asset library
(`public/asset-library/ch-01/piggy-bank-savings-all-of-our-savings-to-
the-homeland-0.png`) and rendered real frames via `renderStill`. The
rendered PNG shows the actual photo — a real 1920s Italian savings-bond
piggy bank illustration, "TUTTO IL NOSTRO RISPARMIO ALLA PATRIA" — with
a visible vignette and warm editorial grade at the frame edges; not
blank, not a placeholder.

**Then, and only then, the legacy implementation was removed**, per the
directive's own ordering ("if porting: ... remove the old legacy
implementation"): `ImageBeatScene`
(`compositions/motion-graphics.jsx`, 146 lines including its
`IMAGE_STAGE_*`/`FULLBLEED_STAGE_*` constants and the "unreachable, left
in place on purpose" comment from §3.12.11 — that comment's job is done,
so it went too) and the now-unused `PhotoTreatment` import in that same
file (its only consumer in `motion-graphics.jsx` was the deleted
function). `qa-scripts/qa-render-image-beat.mjs`, the old one-off
verification script for the deleted `ImageBeatScene`/archetype-driven
path, was deleted as well — it hand-built an `mg` package with no
`visualPlan`, which is exactly the shape §3.12.11 proved `SemanticScene`
no longer accepts.

**QA run this pass:** `node visual/run-visual-tests.js` — 70/70, unchanged.
Bundle+render via `inspect-anchors.mjs` against `finance-accumulation.
fixture.json` after the `ImageBeatScene` deletion — clean, ink numbers
unchanged. `qa-render-image-evidence.mjs`'s own render, described above,
is the one that actually exercises the new code path.

---

**3.12.13 — RELATIONSHIP rebuilt: bound mass, not a node graph.** A
seventh directive ("MOTION-GRAPHICS REBUILD — FINAL VISUAL-LANGUAGE
PASS") re-audited the repository fresh (re-confirmed §3.12.11/§3.12.12's
deletions and the Panel.jsx/PhotoTreatment findings still hold — nothing
had regressed) and named RELATIONSHIP explicitly: "circle — line —
circle... if a line is the only thing communicating the relationship,
redesign it."

**What was there:** N filled circles arranged in a full ring, a straight
line drawn between every pair, the first-drawn pair rendered heavier as
"the strongest relationship." Read cold, that is exactly circle-line-
circle — a node graph — regardless of the circles having real fill and
the lines having real width (both already fixed in 3.12.7/3.12.8; the
STRUCTURE was never touched). Worse, checking `visual/director.js:440`
and `text-budget.js`'s `entityLabels()` against what the scene claimed
found a real grounding problem: `entityLabels` returns distinct content
words in first-MENTION order — no frequency, no strength, no direction.
"The first pair is strongest" was inventing a hierarchy the extraction
never produced, not reading one.

**Rebuilt around what the data actually supports** — N named entities,
equally, no claimed hierarchy — as entities spread along the top of the
shot, each drawing a real curved strand down into a shared, irregular
`BoundMass` (a seeded-jitter closed polygon, not a circle) low in the
frame: "these are bound up in the same situation," which is the honest
reading of "named together in one sentence," without asserting who
drives whom.

**Two real defects the render caught, not code review, fixed in a second
pass:** (1) five labels at the original spacing/size collided —
"REGULATOR" and "CLEARING" rendered as one illegible word,
"REGULATORCLEARING" — fixed by staggering alternating labels to a second
baseline and widening the spread (0.68→0.84 of shot width) rather than
just shrinking type. (2) the first pass's "bow" offset (26-30px against
~800px strands) was imperceptible — the pre-bind frame read as a
wireframe cone of straight spokes converging to one exact pixel, which is
the same "generic nodes/connector lines" grammar under a different name.
Fixed by giving each strand a real bow (90-130px, alternating direction)
and its own jittered landing point on the bound mass instead of one
shared exact point.

**QA run this pass:** `node visual/run-visual-tests.js` — 70/70,
unchanged. Rendered via `inspect-anchors.mjs --all-states` against
`uncovered-strategies.fixture.json` (the fixture that covers
RELATIONSHIP) twice — once before the label/bow fix (caught both
defects), once after (labels legible, strands read as gathered cords
converging into a bound mass, not a diagram).

**Not done this pass:** the other 15 strategies were not re-walked
against this directive's per-strategy list (sections 9-25) beyond what
3.12.7-3.12.12 already covered; no camera-variety pass (PUSH/PULL/
LATERAL/REVEAL/FOLLOW per strategy, beyond the existing hold-move-settle
curve from 3.12.10); no typography-rhythm pass; no material-behaviour
audit beyond sound; no full 16-strategy production render; no muted
human-review pass. Recorded plainly, not implied solved.

---

**3.12.14 — RELATIONSHIP, rebuilt a SECOND time: the first rebuild's
mistake was fixing the geometry, not the idea.** An eighth directive
treated §3.12.13's chain-of-cords-converging-on-a-bound-mass rebuild
itself as a rejected reference, and it was right to: on honest
re-inspection that render was still "labelled things + connectors + one
shared convergence point" with the connector curved instead of straight
and the convergence point de-circled instead of round. Bowing the line
and de-circling the node changed the render, not the underlying visual
IDEA (a radial-convergence diagram), which is exactly the failure this
whole rebuild exists to catch — restyling a bad concept and mistaking the
restyle for a redesign.

**The actual fix: remove the connector element entirely.** Rebuilt again
around `ChainLink` (`compositions/scenes/structure-scenes.jsx`) — a
stadium-ring cross-section (thick stroke, open centre; a ring because the
object drawn IS a ring, not a circle standing in for "a node"). Entities
are physical links that interlock directly: even-indexed links horizontal,
odd-indexed vertical (exactly how real chain links alternate to
interlock), starting spread apart with visible gaps and pulling together
into an overlapping row as the beat plays. Nothing is drawn BETWEEN the
entities — the entities' own overlap IS the connection. `BoundMass` and
the whole strand-and-convergence approach from §3.12.13 were deleted, not
kept alongside the new version.

**Two real defects the render caught across three iterations, not code
review:** (1) first render — labels overlapping the chain body, worst on
"HOUSE" (a horizontal link sitting between two much-taller ROTATED
neighbours) — traced to computing label clearance from a link's OWN
rotation only, when adjacent rotated links are what actually crowd a
label at this spacing. (2) second render, after using each link's own
rotated extent — still collided, because the "weight" state grows every
link toward `settleTint`'s max (1.22x) and clearance was still being
measured off some links' un-rotated `linkH`; the real worst case at any
position is a NEIGHBOURING vertical link, so clearance now uses `linkW`
(the tall dimension) at `SETTLE_MAX` for every label regardless of that
label's own link's rotation. Third render: clean — all five labels clear
of the chain body and of each other at every inspected state.

**QA run this pass:** `node visual/run-visual-tests.js` — 70/70,
unchanged. Rendered three times via `inspect-anchors.mjs --all-states`
against `uncovered-strategies.fixture.json` — defect found and fixed
after render 1, a second defect found and fixed after render 2, clean on
render 3. Muted/label-removed test applied by inspection: the frame
reads as "several distinct pieces locking into one chain" without
reading any text.

**Not done this pass:** same open scope as §3.12.13 — the other 15
strategies were not re-walked against this directive's per-strategy list,
no camera-variety pass, no typography-rhythm pass, no material-behaviour
audit beyond sound, no full 16-strategy production render, no muted
human-review pass across the whole system. RELATIONSHIP itself is the
one strategy verified to this directive's actual standard so far.

---

**3.12.15 — PROCESS's circuit family: a genuine regression found by fresh
rendering, not by re-reading old code.** A ninth directive's opening
instruction — "do not trust previous reports, verify against the current
filesystem" — was applied literally: rather than relying on §3.12.8's
description of PROCESS ("a track with roller stations... not boxes"),
the tech-process fixture was re-rendered fresh under the current code.
§3.12.8's description was accurate for PROCESS's MECHANISM family, but
wrong as a description of the whole strategy — the fixture's actual beat
text ("intake, then review, then approval") matches
`DIGITAL_PROCESS`'s keyword `request`, routing it to the CIRCUIT family
instead, which nobody had rendered and looked at since it was built.

**What the render showed:** three rounded squares, numbered 1/2/3,
joined top-to-bottom by a single straight line, a small dot inside each
square. That is box-arrow-box rotated 90 degrees — the exact pattern
this whole rebuild exists to remove, present in a strategy self-reported
as already fixed.

**Root cause, found by reading `elements/circuit.jsx` against the render:**
`CircuitTrace`'s path *can* draw a right-angle bend, but every node shared
one x-coordinate (`trackX`), so `x1 === x2` on every call and the bend
math degenerated to a straight line. `CircuitNode` was a rounded square
with a small dot — nothing about it read as "electronic component" rather
than "labelled box."

**Fixed, not patched:** `CircuitNode` (`elements/circuit.jsx`) rebuilt as
a DIP-package chip — a body plus real pins (short perpendicular legs) on
both edges and a pin-1 notch, the one feature that unambiguously reads as
"component" rather than "box." `CircuitProcess`
(`compositions/scenes/structure-scenes.jsx`) rebuilt to zigzag alternate
nodes left/right of the centreline instead of stacking them on one axis —
a real PCB convention (routing around components), and structurally what
makes the traces actually bend, not merely cosmetic. `SignalPacket`'s
path updated to travel the same zigzag. Labels moved to whichever side
each node now sits on.

**QA run this pass:** `node visual/run-visual-tests.js` — 70/70,
unchanged. Rendered twice via `inspect-anchors.mjs --all-states` against
`tech-process.fixture.json` — before (confirmed the box-line-box defect
directly) and after (both PROCESS variants: bent traces, pinned chip
packages, signal packet following the bend, response leaving the board
at arrival). Read cold with the numbers covered, the frame now describes
"a signal moving through chip components on a circuit board," not "three
connected boxes."

**Not done this pass:** PROCESS's MECHANISM family (the roller/workpiece
track) was not re-rendered this pass — §3.12.8's description of it was
not contradicted by anything found here, but per this same directive's
own standard it has not been freshly re-verified either, and is recorded
as such rather than assumed. The other 14 strategies remain unaudited
against this directive. No camera-variety pass, no typography-rhythm
pass, no material-behaviour audit beyond sound, no full 16-strategy
production render, no muted human-review pass across the whole system.

---


# PART 4 â€” THE ABSENCE REGISTER (`DEL`)

Deletions are verified by proving *nothing matches*, which makes them the
cheapest and most reliable checks in the system. All are Tier 1, all run in
Stage 15, all are a single `grep` returning zero hits.

| ID | Must not exist | Pattern | Sev |
|---|---|---|---|
| DEL-01 | ~~The no-op scale factor~~ **RETIRED, INVERTED 2026-08-30** | ~~`Math.min(width, height) / 1080`~~ | ~~MAJOR~~ |
| DEL-02 | Percentage dot grid + breathing ring | `GridBackground` | MAJOR |
| DEL-03 | `ColorWipe` overlay | `ColorWipe` | MAJOR |
| DEL-04 | Regex stat scrapers | `extractStats\|extractHeroNumber\|extractFlowLines` | BLOCKER |
| DEL-05 | The two-word headline regex | `[A-Za-z]+)\\s+([A-Za-z]+` | BLOCKER |
| DEL-06 | Keyword icon ladder | `iconFor` | MAJOR |
| DEL-32 | Unconditional per-beat icon resolution | `resolveIcon` called outside an `iconRole === "secondary"` guard | BLOCKER |
| DEL-33 | Icon-only stage scene | `StatementScene` reachable for a beat carrying a `visualPlan` | BLOCKER |
| DEL-07 | Cue-based scene routing | `pickScene` | BLOCKER |
| DEL-08 | Sibling flex in content zones (mg-style path) | `display: *["']flex` in mg-style Stage/Headline/Caption; `minimal`/`cinematic-documentary` = OTHER-STYLE per Part 6 (amended 2026-08-30); carved: motion-graphics.jsx:940 dead `Centered` (line 940), :1024 leaf-internal chip (line 1024) — line numbers as of post-sweep 2026-08-30 | BLOCKER |
| DEL-09 | Word-count caption chunking | `chunkVoiceover` | BLOCKER |
| DEL-10 | `space-around` | `space-around` | MAJOR |
| DEL-11 | Inert `remotion.config.js` reliance | `Config.set` referenced by `render.js` | BLOCKER |
| DEL-12 | Bar glow / radial gradients / accent gridlines (outside the designed ground shading) | `boxShadow\|radial-gradient\|radialGradient\|linearGradient` — EXCEPT the four `scenes/stage.jsx` environment fills `paper-fall`/`sub-floor`/`atmo-haze`/`shot-falloff` (ink-on-bg alpha ≤14%, no hue; render-QA'd §3.12.11) and `visual/composition.js` parallax plane ratios (run-visual-tests ≥2×) | MAJOR |
| DEL-13 | `MinimalSections` text-on-gradient | `MinimalSections` | MAJOR |
| DEL-14 | `inputProps` entry-file workaround | generated entry path in the production SSR path (`render.js` / real `Root.jsx`) — amended 2026-08-30: `qa-sample.js` refactored to `inputProps` (SFR-DEL14-1, option A); `data/audit/*/_*-entry.jsx` QA-harness shims carved as instrumentation | MAJOR |
| DEL-15 | Linear easing | `Easing.linear\|easing: *undefined` | MAJOR |
| DEL-16 | Idle sine pulses | `Math.sin(` outside arc helper | MAJOR |
| DEL-17 | ~~Pure white / pure black~~ **RETIRED, INVERTED 2026-08-16** | ~~`#FFFFFF\|#FFF\b\|#000000\|#000\b`~~ | ~~MAJOR~~ |
| DEL-18 | Gradient fills | `(?i)gradient` — same four-`stage.jsx` carve as DEL-12; everything else live still fails | MAJOR |
| DEL-19 | `border:` in styles | `border: ` | MINOR |
| DEL-20 | JPEG intermediates | `imageFormat.*jpeg` | MAJOR |
| DEL-21 | ~~Text transform / skew / rotate~~ **AMENDED 2026-08-30** | `skew\|rotate(` on body/caption/supporting text — `skew` 0 hits; excepted: vertical causal-marker label (structure-scenes.jsx:726, LAY-15-governed pivot); scene/`<g>` canvas transforms are shape-scope, out of scope by definition | MINOR |
| DEL-22 | Mood-based colour grading | `moodFrom` | MAJOR |
| DEL-23 | `Math.random` | `Math.random` | BLOCKER |
| DEL-24 | Particle systems | `particle` | MINOR |
| DEL-25 | ~~Parallax / depth layers~~ **AMENDED 2026-08-30** | `parallax` — carved: the positive-checked DEPTH-plane system (`visual/composition.js` DEPTH_PROFILES + `Shot`/`planeOffset`, `stage.jsx` Plane, run-visual-tests.js depth tests, COL-20); any OTHER parallax (outside the plane system, or a plane without a blur/saturate/opacity depth anchor) still FAILs | MINOR |
| DEL-26 | Three.js / WebGL geometry | `three\|THREE\.` case-bound (`THREE\.`, `react-three`) — amended 2026-08-30: carved the verified `effects/` pipeline (`PhotoTreatment.jsx`, `CanvasGrain.jsx`, `PostFxReadyGate.jsx` via `@remotion/three` + `@react-three/postprocessing`, §3.12.12); any 3D object geometry or fake-3D lit scene outside it still FAILs (§3.12.9) | MAJOR |
| DEL-27 | Uppercase captions | `textTransform.*uppercase` in caption | MINOR |
| DEL-28 | ~~Global film grain in this style~~ **RETIRED-scoped 2026-08-30** — `grain` allowed only as CanvasGrain (`effects/CanvasGrain.jsx` + its mg Background mount), PhotoTreatment's per-photo grain, and the word in "fine-grained" (beats.js:909,1083); any other `grain` in mg live code fails. Positive checks: data/audit/17 measurements + synthetic controls, §3.12.12 render, frame-audit blurredStddev/chromaStddev | MINOR |
| DEL-29 | Remote asset fetch at render | `https://` in compositions | BLOCKER |
| DEL-30 | ~~Hex literals in `channels.json`~~ **RETIRED, INVERTED 2026-08-30** — hex is the sanctioned palette and lives ONLY inside a channel's `colors` block: `#[0-9A-Fa-f]{6}` outside `colors` = 0 hits (68/68 inside). Script-side sibling: SCR-13 | MAJOR |
| DEL-31 | Kicker scaffolding (channel name, or a raw section id, as kicker text) | `channelName` or `sections[idx].id` read inside `Kicker`/`SectionKickers` (`compositions/motion-graphics.jsx`) | MAJOR |

**4.1 â€” A `DEL` check passing is not evidence the replacement works.** Every
`DEL` pairs with a positive check elsewhere in the register. Deleting
`pickScene` (DEL-07) without `ENC-05` passing means the router is gone and
nothing routes.

**4.2 â€” DEL-17 is retired and inverted, not just retired (motion-graphics-
rebuild-v2, 2026-08-16).** Real reference frames show a flat pure-white or
pure-black background with black/white ink â€” the opposite of what DEL-17
assumed. `bg` is now literally `#FFFFFF` or `#000000` per channel (`styles/
tokens.js`, gated by a new `bg_mode` field in `channels.json`); see Â§3.3.0
for the full reasoning and the COL-01 ceiling consequence. DEL-09's grep
hit 0 from 2026-08-30 (stage-15 sweep): the `chunkVoiceover` wrapper is
deleted from render.js and verify-compositions.js, and both call sites call
the clause-boundary-aware `chunkTextClauseAware` directly, so the grep no
longer matches by name; TYP-21 is the real behavioural check.

**4.3 — Stage-15 DEL amendment set (delete-list sweep, 2026-08-30).** Rows
amended per §4.2's DEL-17 precedent (amendment, not deletion; every case
backed by live evidence in the stage-15 lane ledgers `data/audit/15/*.ledger.md`):

- **DEL-01** — RETIRED, INVERTED 2026-08-30: its pattern's only live hit
  is `scaleUnit()` at `compositions/mg-style.js:155`, the LAY-20 u-scaler
  (MANUAL A3.2), NOT the deleted no-op (Part 0.1's dead scaler is
  structurally replaced by the DesignSpace S-fit, motion-graphics.jsx:294).
  LAY-20's "applied" wording is stale: `scaleUnit` has 0 call sites
  repo-wide; the convention is carried by the fixed 1080×1920 design space
  (u=1 both formats). The dead export should be wired into MG_TYPE scaling
  or removed under a hygiene notice; neither is a DEL-01 deletion.
- **DEL-08** — re-scoped to the mg-style path per Part 6: `minimal`/
  `cinematic-documentary` flex is OTHER-STYLE (their own rebuilds). Live
  mg-path hits are gone: SFR-LAY15-1 rebuilt the evidence-scenes.jsx:174
  role strip absolute. Carved: motion-graphics.jsx:940 (dead `Centered`),
  :1024 (leaf-internal chip; both line numbers shifted by the stage-15 deletions).
- **DEL-12 / DEL-18** — patterns extended to SVG camelCase after the real
  blind spot: the kebab-case patterns could never match SVG
  `<radialGradient>` / `<linearGradient>` elements, so four designed
  ink-on-bg environment fills in `scenes/stage.jsx` (paper-fall / sub-floor /
  atmo-haze / shot-falloff, alpha ≤14%, no hue, render-QA'd §3.12.11) were
  invisible to the gate for 3 days. Amended patterns + carve; COL-13's
  stale PASS corrected.
- **DEL-14** — scoped to the production SSR path (`render.js` / real
  `Root.jsx`): `qa-sample.js` refactored to `inputProps` (SFR-DEL14-1,
  option A); `data/audit/*/_*-entry.jsx` QA-harness shims carved as
  instrumentation.
- **DEL-21** — `rotate(` scoped to body/caption/supporting text; the
  vertical causal-marker label (structure-scenes.jsx:726) is a designed,
  LAY-15-governed feature; scene/`<g>` canvas transforms are shape-scope.
- **DEL-25** — the positive-checked DEPTH-plane system (`visual/composition.js`
  DEPTH_PROFILES + `Shot`/`planeOffset`, `stage.jsx` Plane, run-visual-tests.js
  depth tests, COL-20) carved; other parallax still FAILs.
- **DEL-26** — three.js/WebGL confined to the verified @remotion/three +
  @react-three/postprocessing effects pipeline (§3.12.12); pattern made
  case-bound (`THREE\.`, `react-three`) so the English word "three" is not
  a false positive; any 3D object geometry or fake-3D lit scene still FAILs.
- **DEL-28** — channel/photo grain carved as the designed feature
  (CanvasGrain + PhotoTreatment + "fine-grained" in beats.js); any other
  `grain` in mg live code fails.
- **DEL-30** — hex is the sanctioned palette and lives ONLY inside a
  channel's `colors` block (68/68 hits inside); hex outside `colors` = 0
  hits. Script-side sibling: SCR-13.

---

# PART 5 â€” KNOWN STATE, TODAY

Measured or computed from the repo as it stands. This is the baseline the
protocol is working against.

| Domain | Total | FAIL | UNK | N/B |
|---|---|---|---|---|
| `LAY` | 20 | 11 | 0 | 9 |
| `TYP` | 20 | 6 | 1 | 13 |
| `COL` | 22 | 11 | 5 | 6 |
| `MOT` | 21 | 7 | 4 | 10 |
| `ENC` | 28 | 11 | 9 | 8 |
| `AUD` | 9 | 1 | 7 | 1 |
| `RND` | 14 | 12 | 2 | 0 |
| `AST` | 14 | 6 | 7 | 1 |
| **Total** | **148** | **65** | **35** | **48** |

**5.1 â€” 22 of the 65 failures are BLOCKER.** The heaviest concentration is
`RND` (12 of 14 checks failing), which is why Stage 1 is the dependency
unblock: almost nothing downstream is even testable until the render path is
on a current Remotion and passing explicit options.

**5.2 â€” 35 UNK is not 35 passes.** They are unmeasured. Several â€” the SFX
licence log, image resolution, brand-logo absence â€” are BLOCKER-severity and
have simply never been checked.

**5.3 â€” 48 N/B are checks against components that don't exist yet.** They
cannot pass or fail until the rebuild reaches their stage. Do not let an
agent report them as green.

---

# PART 6 â€” WHAT IS DELIBERATELY NOT CHECKED

Stating the boundary matters as much as stating the checks, because an
unstated exclusion gets silently filled in by an agent.

| Not checked | Why |
|---|---|
| Script factual accuracy | owned by `deep-research`, upstream of this register |
| Voiceover quality, pronunciation, pacing | TTS layer; a separate audit |
| Thumbnail composition | `thumbnail-maker` skill |
| Topic selection, titles, tags | `trend-research` and `channel-branding` |
| Retention or CTR outcomes | `weekly-learning`; a feedback loop, not a gate |
| `minimal` and `cinematic-documentary` styles | this register is motion-graphics only; they need their own |
| Whether a design choice is *good* | only whether it matches a verified source. FRM-05 is the single exception, and it is advisory |
| Aesthetic preference between two compliant options | out of scope by design â€” if it matters, it becomes a rule with a source |

**6.1 â€” The last two rows are the important ones.** This register cannot tell
you a video is good. It can tell you nothing in it is measurably wrong. Those
are different claims, and conflating them is how a fully-green pipeline ships
something nobody wants to watch.

---

# PART 7 â€” ADDING A CHECK

1. It needs a **source** â€” a first-party doc, a measurement, or a defect that
   actually occurred here. "It looks better" is not a source.
2. It needs a **method** that another agent can run and get the same answer.
3. It needs a **threshold**, not an adjective.
4. It goes in the **lowest tier that can decide it**. If a linter can, it is
   Tier 1 and never Tier 4.
5. It gets the **next free ID in its domain**. IDs are never reused, even
   after a check is retired â€” retired checks stay listed with `RETIRED` and
   the reason.
6. If it encodes a defect that happened, **say so in the row**. LAY-07,
   LAY-08, and LAY-09 exist because those three chart bugs shipped. A
   register that only encodes theory misses the things you already got wrong.

---

# PART 8 â€” PROVENANCE

Every check traces to one of:

- **`MOTION-BLUEPRINT.md`** â€” beat timing, safe-rect derivation, transitions
- **`MOTION-GRAPHICS-MANUAL.md`** â€” design system, captions, icons, movement,
  the Mayer principles behind `ENC-03`/`ENC-04`/`ENC-14`
- **`LAYOUT-SYSTEM.md`** â€” the alignment audit behind `LAY-*`, the deletions
  behind `DEL-01â€¦14`, the inert-config finding behind `RND-09â€¦11`
- **`FINISH-SPEC.md`** â€” the 50-palette contrast computation behind `COL-*`,
  the subpixel state machine behind `TYP-14â€¦16`, `DEL-15â€¦30`
- **`DETAIL-REFERENCE.md`** â€” the font-binary audit behind `AST-01`/`AST-02`,
  the damping-ratio table behind `MOT-09`, Cleveland & McGill behind
  `ENC-09â€¦15`
- **Direct measurement of this repo** â€” `AST-01`, `AST-02`, `COL-01â€¦09`,
  `LAY-07â€¦09`, `LAY-20`, `RND-01â€¦03`, `ENC-19`, `AUD-01`

**8.1 â€” Checks sourced from the five spec docs inherit those docs' citations,
and those citations are themselves subject to `CROSSCHECK-PROTOCOL` Phase 1
re-verification.** A check is not exempt from being wrong because it is
written down here.

