# DETAIL REFERENCE — Counters, Depth, and Encoding

**Repo:** `lumeierecollection-blip/YOUTUBE`
**Scope:** `style: "motion-graphics"`, 12 channels
**Position in the doc set:** the three areas `FINISH-SPEC.md` treated at rule
level and this document treats at implementation level.

- **Part A** — counters, settles, and frame-level micro-timing
- **Part B** — backgrounds and depth, per archetype
- **Part C** — the concept → visual mapping library

Parts A0 and B0 are computed or measured from the repo, not asserted.

---

# PART A — COUNTERS, SETTLES, AND MICRO-TIMING

## A0. Two measured findings that block everything else in this part

### A0.1 — Four motion-graphics channels reference a font that isn't vendored

`config/channels.json` assigns fonts by name; `public/fonts/` holds the
`.woff2` files. Cross-referencing them:

| Font | Channels | Vendored? |
|---|---|---|
| **Fira Sans** | Quantum Canvas, Machine Anatomy, **Mind & Body Files**, **Factory Floor** | **MISSING** |
| Comic Neue | Story Mode | **MISSING** |
| Noto Serif | (1 channel) | **MISSING** |

**Four of the twelve motion-graphics channels — a third of the roster — have
no font file.** `resolveFontFamily()` in `compositions/visual.js` falls back to
`'Helvetica Neue', sans-serif`, which on headless Linux Chrome resolves to
whatever the container's default sans happens to be.

Two consequences, and the second is worse than the first:

1. Those four channels render in an unintended typeface.
2. **Every `measureText()` and `fitText()` result for them is computed against
   the wrong metrics**, so the entire layout compiler (`LAYOUT-SYSTEM` Part 4)
   produces wrong rects. Text overflows, headlines fit at the wrong size,
   caption line breaks land in the wrong places.

This is precisely the failure Remotion's `validateFontIsLoaded: true` exists to
catch, and `FINISH-SPEC` R3.x assumed it was already impossible.

**Also worth noting:** 11 vendored families are used by no channel at all
(Archivo Black, Barlow, Barlow Condensed, Crimson Pro, IBM Plex Sans, Lora,
Nunito Sans, Plus Jakarta Sans, Rubik, Source Sans 3, Source Serif 4). Dead
weight in the bundle.

### A0.2 — Only one motion-graphics font has tabular figures

I inspected the GSUB feature tables of all 20 vendored families. Results for
the six motion-graphics fonts:

| Font | `tnum` | Notes |
|---|---|---|
| **Inter** | **yes** | the only proportional font in the set with tabular figures |
| JetBrains Mono | no | monospace — digits are already equal-width by construction |
| DM Sans | **no** | 4 mg channels incl. Legal Brief, Earth Signal, Build Smart, NutriDecode |
| Roboto Condensed | **no** | Border Lines |
| Nunito | **no** | MedBrief |
| Fira Sans | — | not vendored (A0.1) |

Across all 20 families, only **Inter** and **Lora** carry `tnum`.

This matters because <cite index="200-1">most fonts use proportional spacing where a "1" is narrow and an "8" is wide, so when numbers change the text reflows and the container shifts</cite> — and <cite index="203-1">a font without `tnum` glyphs will silently do nothing, which is the failure mode people hit most often</cite>.

**Every counting number in the pipeline currently jitters horizontally as it
counts.** `ChartBar` at `mg.jsx:407` runs
`Math.round(interpolate(grow, [0, 1], [0, value]))` with no `tabular-nums` and
no reserved width. A count from 0 to 47 shifts the label under it on almost
every frame. <cite index="205-1">It's subtle, but it feels "cheap," and it makes the data harder to read because the eye has to constantly readjust to the shifting horizontal position.</cite>

## A1. Counter construction

**A1.1 — Reserve the slot, don't let the number size it.**
<cite index="201-1">An odometer counter is a fixed-slot transition, not a text-width animation. Each digit column is an `overflow: hidden` slot; a vertical strip of digits moves with `translateY`, `font-variant-numeric: tabular-nums` keeps widths consistent, and the wrapper reserves the total metric footprint. Never animate the text node width directly — that causes neighbouring labels or cards to move, and the effect becomes more obvious when the new value has more digits.</cite>

The layout compiler already knows the final value, so it measures the **final
string** and reserves that width from frame 0.

```js
// at compile time
const finalStr = format(value);                       // "1,240"
const slot = measureText({ text: finalStr, ...fontStyle, validateFontIsLoaded: true });
rect.w = ceil8(slot.width);                           // reserved, never changes
```

**A1.2 — `fontVariantNumeric: 'tabular-nums'` on every numeric element**, plus
the fallback below for the five families that lack it.

**A1.3 — Fallback for non-`tnum` fonts.** Given A0.2, four of six
motion-graphics channels can't use the OpenType feature. Two options:

- **Preferred:** re-vendor DM Sans, Roboto Condensed, and Nunito from a source
  build that includes `tnum`, and verify with a GSUB check in CI. Several of
  these do ship `tnum` in their full releases; the subset in
  `public/fonts/` was stripped.
- **Fallback if that fails:** render numerals in **per-digit fixed slots** —
  each digit in its own `width: 0.62em` centred box. This works regardless of
  font features, and it is the same mechanism the odometer pattern uses. Cost:
  digits are optically evenly spaced rather than typographically spaced, which
  on a 220 px hero numeral is visible but acceptable.

**A1.4 — Never swap the whole number.** <cite index="201-1">Swapping the whole number hides which digit changed; fixed digit slots make 345 → 346 → 347 read as one controlled roll.</cite>

## A2. The counting curve

A counter has two masters: it must track the thing it labels, and it must be
readable.

**A2.1 — The counter shares the bar's easing, not its own.** If a `PROGRESS`
bar grows on a spring and its value counts on a bezier, the number and the
height disagree about where they are. Drive both from the same progress scalar.

```js
const p = spring({ frame: frame - delay, fps, config: GROW });
const h = targetH * p;
const shown = Math.round(value * p);   // same p — never a second interpolation
```

**A2.2 — But a `HERO_NUMBER` has no bar, and it must decelerate hard.**
Free-running counters churn digits at a rate the eye can't track, then stop
abruptly. Rule: **the final 25% of the count's frames must cover less than 10%
of the value.** `Easing.bezier(0.16, 1, 0.3, 1)` over `D.push` (60 f) satisfies
this — at t=0.75 the curve is already past 0.95.

**A2.3 — The digit count must never change mid-count.** Counting 0 → 1,240
passes through 7, 84, 903 — one, two, and three digits. With a reserved slot
(A1.1) the box doesn't move, but the *number* jumps around inside it.
**Start the count at a value with the same digit count as the target:** begin
at 1,000 rather than 0 for a 1,240 target, or pad with leading zeros in
`textDim`. Padding is preferred for hero numbers; a raised floor is preferred
inside charts.

**A2.4 — Thousands separators from frame 0.** Formatting must be applied to
every intermediate value, not just the final one, or the string width changes
at the 1,000 boundary even with tabular figures.

**A2.5 — Decimals are fixed at compile time.** A value rendered as `12.4%`
counts through `03.7%`, never `3.7%` then `12.4%`.

**A2.6 — Counters never count down**, and never count to a value that isn't in
`beat.data`. Both read as decoration.

## A3. Settle physics

`FINISH-SPEC` specifies overshoot percentages. This is how to hit them exactly
rather than tuning by eye.

A spring is a damped harmonic oscillator. <cite index="196-1">A damping ratio of 1.0 (critically damped) causes the spring to reach its target smoothly without oscillation; values closer to 0.0 (underdamped) increase oscillation and overshoot the target before settling.</cite> In Remotion's `spring({config: {damping, stiffness, mass}})`:

```
ζ = damping / (2 × √(stiffness × mass))
```

And the first overshoot of an underdamped step response is:

```
OS = e^(−πζ / √(1 − ζ²))
```

Inverting gives the damping needed for a target overshoot:

```
ζ = −ln(OS) / √(π² + ln²(OS))
damping = 2ζ√(stiffness × mass)
```

**A3.1 — The settle table** (mass = 1, stiffness = 180):

| Want | OS | ζ | `damping` | Used for |
|---|---|---|---|---|
| Crisp, no bounce | 0% | 1.00 | 26.8 | rules, connectors, axes |
| Barely perceptible | 4% | 0.716 | 19.2 | caption page entrance |
| Light | 8% | 0.627 | 16.8 | caption active token |
| Standard pop | 15% | 0.517 | 13.9 | icons, chips, nodes |
| Chart grow | 15% | 0.517 | 13.9 | bars |
| Never | >20% | <0.46 | <12.4 | — |

**A3.2 — Remotion's default is bouncier than anything in this style.**
<cite index="204-1">Framer Motion's defaults are stiffness 100, damping 10, mass 1</cite> — ζ = 0.5, ~16% overshoot — and Remotion's own default spring similarly overshoots slightly before settling. That's fine for a UI button and too loose for a chart bar seen 700 times a week. Every spring in this codebase declares its config explicitly.

**A3.3 — `Easing.spring({damping: 200})`** — used for the no-bounce push in
the manual — computes to ζ = 10 at stiffness 100. Heavily overdamped, which is
the intent, but be aware it's slow to reach its target; it belongs on long
pushes, never on a 9-frame entrance.

**A3.4 — Springs don't have durations. Use a bezier when you need an exact
frame count.** A spring at ζ=0.517, ω=√180=13.4 rad/s settles to within 2% in
roughly 4/(ζω) ≈ 0.58 s ≈ **17 frames** — nearly double the 9-frame `D.base`
budget. This is why the entrance patterns in `MOTION-GRAPHICS-MANUAL` §D2 use
three-keyframe `interpolate()` calls rather than springs: the frame budget is
fixed and the overshoot shape is explicit.

> **Rule A3.5 — Spring only where the duration is allowed to be emergent
> (chart grow). Bezier everywhere the frame budget is declared.**
> Roughly: bezier for text and icons, spring for bars.

## A4. The micro-timing table

Every timed event inside a beat, at frame resolution, relative to `tA` (the
anchor token frame). This is the table the compiler emits and the linter
checks.

### `HERO_NUMBER` — 60–90 f

| f | Event | Duration | Curve |
|---|---|---|---|
| tA−4 | numeral opacity 0→1 | 6 | `E.out` |
| tA−4 | numeral scale 0.92→1.00 | 9 | `E.out`, perceptual |
| tA−4 | count begins from padded floor | 60 | `E.out` |
| tA+2 | unit label RISE | 9 | `E.out` |
| tA+56 | count reaches value | — | — |
| tA+56 | `ui/click_004.ogg` −22 dB | — | — |
| tA+58 | headline RISE (drag 12 from settle) | 9 | `E.out` |
| tA+67 | **all motion complete** — hold begins | — | — |

### `PROGRESS` — 75–90 f

| f | Event | Duration | Curve |
|---|---|---|---|
| 0 | baseline rule DRAW | 10 | `E.out` |
| 8 | gridline 1 DRAW | 10 | `E.out` |
| 11, 14, 17 | gridlines 2–4 (stagger 3) | 10 each | `E.out` |
| 16 | axis labels RISE (stagger 2) | 9 | `E.out` |
| tA−4 | bar 1 GROW + counter | ~20 | spring ζ0.517 |
| +7 each | bars 2–5 (stagger 7, ratio 0.35) | ~20 | same |
| bar+12 | that bar's label RISE (drag 12) | 9 | `E.out` |
| highlight settle | `accent` applied, 1-frame switch | — | — |
| last label +9 | **hold begins** | — | — |

Stagger 7 replaces the manual's 5 — see `FINISH-SPEC` R4.1, where 5 f on a
20 f grow gave a 0.25 ratio, below the 0.3–0.6 overlap band.

### `LIST_ITEM` — 45 f each

| f | Event | Duration |
|---|---|---|
| tA−4 | new chip POP (ζ 0.517 shape, bezier keyframes) | 9 |
| tA−2 | existing chips translate up 88 px (drag 2) | 9, stagger 2 |
| tA−2 | existing chips `textPrimary`→`textDim` | 6 |
| tA | badge takes `accent` | 1 (instant) |
| tA+2 | `ui/click_001.ogg` −24 dB | — |
| tA+6 | badge returns to `stroke` | 3 |
| tA+7 | **hold begins** | — |

Stagger 5 for the items themselves (0.56 ratio on a 9 f entrance), replacing
the manual's 6.

### `TERM_DEFINE` — 45–60 f

| f | Event | Duration |
|---|---|---|
| tA−4 | icon POP | 9 |
| tA | term RISE | 9 |
| tA+6 | rule DRAW under term (drag 6) | 14 |
| tA+20 | **hold begins** | — |

### `RELATION` — 60 f

| f | Event | Duration |
|---|---|---|
| 0 | node A POP (or carried) | 9 |
| tA−4 | node B POP | 9 |
| tA | connector DRAW A→B (drag 4) | 14 |
| tA+14 | headline RISE | 9 |
| tA+23 | **hold begins** | — |

**A4.1 — Every archetype declares a "hold begins" frame.** That is the frame
verification check C17 (`FINISH-SPEC` Part 7) tests: the frame before and the
frame after must be pixel-identical.

**A4.2 — No archetype has any event after "hold begins" except the caption
highlight and the progress rail.**

## A5. What must never animate

Restated at implementation level, because each of these is currently animated
somewhere in `motion-graphics.jsx`:

| Never animate | Currently at | Why |
|---|---|---|
| Axis line after its draw | `mg.jsx:522` `scaleX(axisP)` runs on a slow spring | the axis is a reference frame; a moving reference frame is unreadable |
| The last bar, after settle | `mg.jsx:411` `pulse = 1 + 0.05·sin(...)` | perpetual sine on the focal element — the definition of robotic |
| Background | `mg.jsx:213` breathing ring | `FINISH-SPEC` R4.10 |
| Gridlines after draw | opacity tied to a running spring | same as axis |
| Text letter-spacing or weight | — | reflows every glyph |
| Corner radius | — | shimmers on scale |
| Anything during silence | — | `MANUAL` §C2.4 |

---

# PART B — BACKGROUNDS AND DEPTH, PER ARCHETYPE

## B0. Why depth is a problem here specifically

Every channel in the network is a dark theme, and <cite index="191-1">shadows are less effective in a dark theme because they have less contrast with the dark background colours and appear less visible</cite>. Material's answer is structural: <cite index="191-1">surfaces become lighter at higher elevations, when they are closer to the implied light source, via semi-transparent overlays whose alpha is calculated from elevation</cite>, with <cite index="194-1">elevation overlay transparencies ranging from 0% for the lowest level to 16% for the highest</cite>.

So the current code's approach — `boxShadow: 0 0 28px accent55` on the
highlighted bar, radial gradient glows behind the composite hub — is doing the
opposite of what a dark theme needs. It's adding *light* where depth calls for
a *surface lightness step*, and the glow is spending the accent colour on
atmosphere (`FINISH-SPEC` R14).

Material also warns that <cite index="195-1">more saturated colours tend to visually "vibrate" against darker backgrounds, making them harder to read</cite> — which is the same phenomenon as §0.4 of `FINISH-SPEC`, where accents at 1.7:1 against text read as vibration rather than emphasis.

## B1. The elevation ladder

Three levels only, expressed as OKLCH lightness against the channel's
`baseHue`. Calibrated to Material's 0–16% overlay intent, but declared as
absolute L rather than as an overlay, so it composites once and never
overdraws.

| Level | Name | L | Used by |
|---|---|---|---|
| **E0** | `bg` | 0.16 | the ground plane, always |
| **E1** | `surface` | 0.23 | chips, panels, node fills, image frames |
| **E2** | `raised` | 0.29 | the one focal element in a beat, if it needs a fill |
| — | `stroke` | 0.50 | outlines at every level (amended from 0.40 — COL-04 needs ≥3:1; see data/audit/3 ledger A-1) |

**B1.1 — E3 does not exist in this style.** Material's ladder goes to 24 dp
because an app has modals over sheets over cards. A 45-second Short has a
ground plane and things on it. Capping at E2 also keeps `stroke` at L 0.40
clearly separated from the highest surface (Δ L 0.21), so an outline is legible
against every elevation.

**B1.2 — Elevation is never animated.** An element does not "rise" from E1 to
E2. It either is the focal element or it isn't. Animating elevation is a UI
idiom (hover, press) with no analogue in linear video.

**B1.3 — At most one E2 element per frame**, and it is the same element that
carries `accent`. Elevation and accent are two expressions of the same
decision: *this is what the voiceover is naming right now.*

**B1.4 — Zero `boxShadow`, network-wide.** The single permitted `drop-shadow`
remains the caption's, backing up its stroke over photography.

## B2. Per-archetype background treatment

The background is not one thing. Each archetype needs a different amount of
ground under it, and getting this wrong is what makes a frame read as either
empty or cluttered.

| Archetype | Ground | Stage surface | Dot grid | Notes |
|---|---|---|---|---|
| `HERO_NUMBER` | E0 flat | **none** | 6% | The numeral is the only object. Any panel behind it competes. Maximum negative space in the set. |
| `TERM_DEFINE` | E0 flat | **none** | 6% | Icon + term + rule float on the ground. |
| `LIST_ITEM` | E0 flat | E1 chips | 4% | Chips already introduce a second lightness; drop the grid so the frame doesn't get busy. |
| `CONTRAST` | E0 flat | E1 left, **E1 right** | 4% | Both panels at E1. The *right* panel takes `accent` on its key element, not a higher elevation — the divider does the separating. |
| `PROGRESS` | E0 flat | **none** | **0%** | A chart is already a grid. A dot grid behind gridlines is visual noise and interferes at low bitrate. |
| `RELATION` | E0 flat | E1 nodes | 6% | The grid helps read the spatial relationship between nodes. |
| `IMAGE_BEAT` | E0 flat | image at E1 frame | **0%** | Image occupies the Stage; grid would show only at the margins, which reads as an accident. |
| `STATEMENT` | E0 flat | **none** | 6% | |

**B2.1 — The dot grid density is the only background variable.** 6% / 4% / 0%,
nothing between, decided by the archetype and not by the channel.

**B2.2 — The transition between grid densities happens at the section wipe, not
mid-section.** If two adjacent beats in one section need different densities,
the section uses the lower of the two throughout. A background that changes
density between beats reads as a flicker.

**B2.3 — Absolute pitch, 64 px, square.** Never percentage-based
(`LAYOUT-SYSTEM` §0.7 — the current grid is 237×211 on Shorts and 422×119 on
longform).

**B2.4 — Dot diameter 4 px at the 8 px grid.** The current 3 px is below the
threshold where a dot survives H.264 quantisation at all.

## B3. Background across the video

**B3.1 — The ground plane L never changes within a video.** No mood grading, no
section-level tint shift, no hue rotation. `moodFromVisualCue()` and
`moodFromContent()` in `visual.js` — which grade sections to `outrage`,
`crisis`, `nostalgia`, or `neutral` from regex over the voiceover — do not
apply to this style and should not be wired into it. A colour grade that
changes because a sentence contains the word "dark" is exactly the kind of
inference `LAYOUT-SYSTEM` Part 7 removes.

**B3.2 — The one permitted global change is the progress rail filling.** 4 px,
`stroke`, linear, over the whole duration. It is imperceptible frame to frame
and legible at a glance — which is the correct profile for the only continuous
motion in the video.

**B3.3 — The end card is the exception.** It may lift the ground to E1 for its
final 45 frames as a visual full-stop. One step, at a section boundary, once
per video.

## B4. Negative space

**B4.1 — At least 45% of the Stage slot must be ground at every frame.**
840 × 548 = 460,320 px²; occupied geometry may not exceed 253,000 px². The
compiler knows every rect, so this is a Tier 1 check, not a judgement call.

**B4.2 — Negative space is not the same as an empty zone.** The Kicker,
Headline, and Caption slots are always occupied. What varies is Stage density,
and `HERO_NUMBER` is deliberately the sparsest frame in any video — that
contrast is what makes it land.

**B4.3 — No element may sit closer than 24 px to another element's bounding
box.** Below that, two elements read as one object with a seam.

## B5. Forbidden background treatments

Vignette · radial gradient · linear gradient · animated noise · particles ·
light leaks · film grain (in this style — see `FINISH-SPEC` R2.3) · parallax ·
blur-behind · any texture at above 8% opacity · any background element that
uses `accent` · mood-based grading (B3.1) · the breathing ring.

---

# PART C — THE CONCEPT → VISUAL MAPPING LIBRARY

## C0. The encoding hierarchy

This is the one part of visual design with a genuine experimental foundation.
Cleveland and McGill ranked how accurately people decode quantitative
information from different visual channels, and the ordering has held up:
<cite index="180-1">position along a common scale, then positions along non-aligned scales, then length, direction and angle, then area, then volume and curvature, then shading and colour saturation</cite>. <cite index="182-1">Two types of position judgment were found most accurate, length judgments second, angle and slope third, and area judgments last.</cite>

With magnitudes: <cite index="184-1">position judgments were 1.4 to 2.5 times more accurate than length and 1.96 times more accurate than angle</cite>. And on layout specifically: <cite index="184-1">adjacent bars score best, closely followed by separated bars and horizontally aligned stacked bars, while unaligned stacked bars and vertically aligned bars are the worst — because aligned bars involve judging position along a common scale while unaligned bars involve length judgments</cite>.

The ranking has been <cite index="181-1">replicated and extended using large-scale online experiments and across bar charts, scatterplots, and pie charts</cite>, though with the honest caveat that <cite index="181-1">perceptual effectiveness is not fixed: task type, data distribution, and visualization context strongly mediate performance</cite>. Treat it as a strong default, not a law.

**C0.1 — The operative rule for this pipeline:**

> **Encode magnitude by position on a common scale wherever possible. Never
> encode magnitude by area, angle, or colour saturation.**

That single rule removes pie charts, donut charts, bubble charts, treemaps,
word clouds, and 3D anything from the vocabulary — all of which are what an
automated system reaches for when it wants a frame to look "designed."

## C1. The mapping table

Concept type → encoding → archetype → constraint. **This table is exhaustive.
A beat whose concept isn't in it resolves to `STATEMENT`.**

| Concept in the voiceover | Encoding | Archetype | Constraint |
|---|---|---|---|
| A single magnitude | the number itself | `HERO_NUMBER` | never a gauge, ring, or filled shape |
| A magnitude vs a baseline | position on a common scale | `PROGRESS`, 2 bars | shared axis, adjacent |
| Change over time (2 points) | position on a common scale | `PROGRESS`, 2 bars | never a line with 2 points |
| Change over time (3–5 points) | position on a common scale | `PROGRESS`, bars | never a smoothed curve |
| A proportion of a whole | position, not angle | `PROGRESS`, single bar with a marked total | **never a pie or donut** |
| Ranked comparison (2–5 items) | position, adjacent bars | `PROGRESS` | sorted by value, not alphabetically |
| Two opposed states | position, split frame | `CONTRAST` | left = before, right = after, always |
| An ordered sequence | vertical position + index | `LIST_ITEM` | numbered, max 4 visible |
| An unordered set | position, chips | `LIST_ITEM` without numerals | max 4 |
| A causal or structural link | position + connector | `RELATION` | direction follows sentence order |
| A named entity or term | category, not magnitude | `TERM_DEFINE` | icon is `stroke`, never `accent` |
| A real person, place, object | the photograph | `IMAGE_BEAT` | ≤20% of beats |
| Anything else | — | `STATEMENT` | ≤30% of beats |

## C2. Chart construction rules that follow from C0

**C2.1 — Bars are adjacent, not separated, when there are ≤3.** Adjacent
scores best. With 4–5, use equal gutters (`LAYOUT-SYSTEM` §0.5 — never
`space-around`).

**C2.2 — Bars are vertically oriented and share a horizontal baseline.** This
makes every comparison a position judgment along a common scale — the top of
the ranking.

**C2.3 — Never stack.** Unaligned stacked bars are among the worst-performing
layouts, and a stacked bar in a 9:16 frame at 5 series is unreadable regardless.

**C2.4 — The y-axis starts at zero. Always.** A truncated axis converts a
position judgment into a misleading one. If the differences are too small to
see from zero, the beat is a `HERO_NUMBER` about the difference, not a chart.

**C2.5 — Values are printed on their bars.** Position gets the comparison
right; the printed number gets the magnitude right. Both, always — and
adjacent, per spatial contiguity (22/22 experiments, effect size 1.10).

**C2.6 — Maximum 5 series points** (`MANUAL` §E3.3), and they are sorted by
value unless the axis is time, in which case chronological.

**C2.7 — Colour never encodes magnitude.** Colour saturation is at the bottom
of the ranking. All bars are `accent`-free except the single highlighted one,
and the highlight marks *the point being discussed*, not *the largest value*.

## C3. Forbidden encodings

| Never | Why |
|---|---|
| Pie / donut chart | angle, ~1.96× less accurate than position |
| Bubble / packed circles | area, ranked last |
| 3D bars, extruded anything | volume, ranked below area |
| Treemap | area, and unreadable at 840 px |
| Word cloud | encodes nothing |
| Heatmap / colour-coded magnitude | shading + saturation, bottom of the ranking |
| Radial / gauge / progress ring | angle |
| Smoothed line through <6 points | implies data that doesn't exist |
| Truncated axis | C2.4 |
| Dual-axis chart | two common scales is no common scale |
| Animated chart *type* change | there is one right encoding; showing two says neither was chosen |

## C4. Per-channel concept vocabulary

Each of the 12 motion-graphics channels declares the concepts it actually
handles, which constrains the classifier and prevents a legal channel from
producing a bubble chart because one sentence mentioned "size."

```jsonc
// config/channels.json, per channel
"concepts": {
  "primary":   ["CONTRAST", "TERM_DEFINE", "LIST_ITEM"],
  "secondary": ["HERO_NUMBER", "PROGRESS"],
  "excluded":  ["IMAGE_BEAT"]
}
```

Starting allocations, derived from what each channel's scripts are actually
about:

| Channel | Primary | Secondary |
|---|---|---|
| Legal Brief | `CONTRAST`, `TERM_DEFINE`, `LIST_ITEM` | `HERO_NUMBER` |
| Border Lines | `RELATION`, `CONTRAST` | `HERO_NUMBER`, `IMAGE_BEAT` |
| Quantum Canvas | `RELATION`, `TERM_DEFINE` | `PROGRESS` |
| Earth Signal | `PROGRESS`, `HERO_NUMBER` | `RELATION` |
| Fraud Files | `PROGRESS`, `HERO_NUMBER`, `LIST_ITEM` | `RELATION` |
| Machine Anatomy | `RELATION`, `LIST_ITEM` | `TERM_DEFINE` |
| Build Smart | `LIST_ITEM`, `CONTRAST` | `HERO_NUMBER` |
| MedBrief | `TERM_DEFINE`, `PROGRESS` | `CONTRAST` |
| Mind & Body Files | `CONTRAST`, `TERM_DEFINE` | `PROGRESS` |
| NutriDecode | `PROGRESS`, `CONTRAST` | `HERO_NUMBER` |
| Skill Stack | `LIST_ITEM`, `RELATION` | `TERM_DEFINE` |
| Factory Floor | `RELATION`, `PROGRESS` | `LIST_ITEM` |

**C4.1 — Primary archetypes must be ≥50% of a video's beats. Secondary ≤35%.
Excluded, 0%.** This is what makes twelve channels on one engine feel like
twelve channels rather than one template — the *rhythm of representation*
differs, not just the palette.

**C4.2 — This is the second differentiation axis**, alongside palette, font,
and icon vocabulary (`MANUAL` Part G). It is the strongest of the four,
because it changes what the video *does*, not what it looks like.

## C5. Honesty constraints

These are not aesthetic. A pipeline producing 700 videos a week with no human
reviewing each frame needs them enforced in code.

| # | Rule |
|---|---|
| H1 | Every charted number traces to `beat.data`, never to regex over prose |
| H2 | Axis starts at zero |
| H3 | No value is rounded in a way that changes its order of magnitude |
| H4 | A percentage is only shown as a percentage if the script states a percentage |
| H5 | Two values may only share an axis if they share a unit |
| H6 | A comparison across time uses equal intervals, or states the intervals |
| H7 | The highlighted bar is the one the voiceover names, not the largest |
| H8 | If a beat's `data` has one point, it is a `HERO_NUMBER`, not a one-bar chart |

---

# PART D — VERIFICATION ADDITIONS

Extends `FINISH-SPEC` Part 7.

**Tier 0 — asset gate:**

| # | Check |
|---|---|
| D1 | Every font named in `channels.json` has a matching `.woff2` in `public/fonts/` (**currently fails for 6 channels** — A0.1) |
| D2 | Every font used for numerals exposes `tnum` in its GSUB table, or the channel is flagged for the fixed-slot fallback (**currently fails for 4 of 6 mg fonts** — A0.2) |
| D3 | No vendored font is unused (currently 11 are) |

**Tier 1 — spec lint:**

| # | Check |
|---|---|
| D4 | Every numeric rect reserves the width of its final formatted string |
| D5 | Every counter's start value has the same digit count as its target |
| D6 | Every spring config's ζ falls in [0.46, 1.0] |
| D7 | Every archetype declares a "hold begins" frame, and no event follows it except caption and rail |
| D8 | Stage occupancy ≤55% of the slot area |
| D9 | No two rects within 24 px of each other |
| D10 | Dot-grid density is constant within a section |
| D11 | Archetype mix matches the channel's `concepts` allocation (≥50% primary, ≤35% secondary, 0% excluded) |
| D12 | No chart has a non-zero axis origin, >5 points, or a stacked layout |
| D13 | The highlighted series point is the anchor token's referent, not `max()` |

**Tier 3 — frame QA:**

| # | Check |
|---|---|
| D14 | Counter region's bounding box is byte-identical across every frame of the count (catches tabular-figure failure directly) |
| D15 | Ground plane luminance is constant across the video except at the end card |

---

# PART E — SOURCES

**Graphical perception:**
Cleveland, W. S. & McGill, R., "Graphical Perception: Theory, Experimentation,
and Application to the Development of Graphical Methods," *JASA* 79 (1984) —
the ten elementary perceptual tasks and their ranking ·
Cleveland & McGill, *Science* 229:4716 (1985) ·
`flowingdata.com/2010/03/20/graphical-perception-learn-the-fundamentals-first/` ·
`arxiv.org/pdf/2503.00086` — position 1.4–2.5× more accurate than length,
1.96× more accurate than angle; adjacent bars best, unaligned stacked worst ·
`arxiv.org/pdf/2602.20022` — replication at scale; task and context mediate
effectiveness · `arxiv.org/pdf/2107.07477` — Mackinlay's ranking by data type

**Dark-theme depth:**
`github.com/material-components/material-components-android/blob/master/docs/theming/Dark.md`
— shadows are less effective on dark; elevation overlays instead ·
`material.io` dark theme guidance via `needlety.com/design/color/dark-theme.html`
— overlay range 0%→16%, `#121212` base ·
`codelabs.developers.google.com/codelabs/design-material-darktheme` —
saturated colours vibrate against dark backgrounds ·
`developer.android.com/develop/ui/compose/designsystems/material`

**Numerals:**
`animationpatterns.art/animations/number-counter-odometer-transition/` — fixed
digit slots, never animate text width, swapping the whole number hides which
digit changed · `dev.to/alanwest/tabular-numbers-in-css-...` — a font without
`tnum` glyphs silently does nothing · `npmjs.com/package/countup.js` ·
`loke.dev/blog/css-font-variant-numeric-tabular-nums` ·
`gomakethings.com/preventing-layout-shift-with-numbers-using-css/`

**Spring physics:**
`mintlify.com/jtrivedi/Wave/api/spring` — damping ratio 1.0 critically damped,
below 1.0 overshoots · `carmenansio.com/articles/spring-physics-css/` — damped
harmonic oscillator form; stiffness/damping/mass interaction ·
`blog.maximeheckel.com/posts/the-physics-behind-spring-animations/` — Framer
Motion defaults (stiffness 100, damping 10, mass 1) ·
`motion.dev/tutorials/js-spring` ·
`developer.android.com/develop/ui/views/animations/spring-animation`
*(Overshoot↔damping-ratio formulas in A3 are standard control-theory step
response, applied here — derived, not quoted.)*

**Measured from the repo:**
`config/channels.json` cross-referenced against
`src/skills/remotion-render/public/fonts/` (A0.1) · GSUB feature-table
inspection of all 20 vendored `.woff2` families via fontTools (A0.2) ·
`src/skills/remotion-render/compositions/motion-graphics.jsx` ·
`src/skills/remotion-render/compositions/visual.js`
