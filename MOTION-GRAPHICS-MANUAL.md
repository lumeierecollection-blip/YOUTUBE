# MOTION-GRAPHICS STYLE MANUAL

**Repo:** `lumeierecollection-blip/YOUTUBE`
**Applies to:** `style: "motion-graphics"` only — 12 channels in `config/channels.json`:
Legal Brief · Border Lines · Quantum Canvas · Earth Signal · Fraud Files ·
Machine Anatomy · Build Smart · MedBrief · Mind & Body Files · NutriDecode ·
Skill Stack · Factory Floor
**Companion:** `MOTION-BLUEPRINT.md` (timing spine, beat model, safe zones).
This manual specifies *what appears* and *how it moves*. The blueprint
specifies *when*.
**Reconciles with:** `data/vfx-audit.md` §"STYLE 3: MOTION GRAPHICS`, whose
figures are carried forward where they don't conflict. Conflicts are named
in §9.

Every value below is either traceable to a source in §10 or derived by stated
arithmetic from one. Where sources disagree, both numbers are given and the
chosen one is justified. Nothing is a preference.

**Reading rule:** every "MUST" is a gate condition in §9. Every "MUST NOT" is
a render rejection.

---

# PART A — THE DESIGN SYSTEM

## A1. Canvas and grid

```js
export const CANVAS = {
  shorts:   { w: 1080, h: 1920, fps: 30 },
  longform: { w: 1920, h: 1080, fps: 30 },
};

// Shorts safe rect (see MOTION-BLUEPRINT §2)
export const SAFE = { top: 288, right: 888, bottom: 1248, left: 48 };
export const OPTICAL_CENTRE_X = 468;   // NOT 540
export const OPTICAL_CENTRE_Y = 768;   // (288 + 1248) / 2
```

**A1.1** — The composition grid is **8 px base**. Every x, y, width, height,
gap, padding, and radius MUST be a multiple of 8. Type sizes are exempt.

**A1.2** — The usable field is 840 × 960. Divide it into a **12-column grid**:
column width 56, gutter 8 (12 × 56 + 11 × 8 = 760, plus 40 outer padding each
side = 840). All horizontal placement snaps to column edges.

**A1.3** — Vertical zones, fixed for every beat:

| Zone | y range | Contents | Persistent? |
|---|---|---|---|
| Kicker | 288 – 360 | section rule + number + label | yes, per section |
| Stage | 392 – 940 | the beat's primary graphic | no |
| Headline | 964 – 1140 | headline / value / term | no |
| Caption | 1152 – 1248 | VO caption block, bottom-anchored | yes |
| Rail | x 48, y 288–1248 | 4 px progress rule | yes |

**A1.4** — The Stage is the only zone where a beat may place freeform
geometry. Nothing may cross a zone boundary. This is what stops the frame
reading as an unstructured pile of elements.

## A2. Colour

Each channel supplies two hues — `baseHue` and `accentHue` (OKLCH hue degrees)
in `config/channels.json` — e.g. Legal Brief is `{ baseHue: 283.8, accentHue: 15.7 }`.
All role colours (bg/accent/textPrimary/textDim/stroke/surface/raised) are derived
from those two hues in `styles/tokens.js` (`paletteFromHues`), with the role map
below; `resolveColors()` in `compositions/visual.js` maps the derived roles onto
each style's semantic colour roles.

**A2.1 — The role map is fixed and identical for all 12 channels:**

```js
{
  bg:          palette[0],              // flat, never gradient
  accent:      palette[1],              // the ONLY saturated colour
  textPrimary: palette[2],              // usually #FFFFFF
  textDim:     mix(textPrimary, bg, 0.45),
  stroke:      mix(textPrimary, bg, 0.22),   // rules, axes, borders
  surface:     mix(bg, textPrimary, 0.06),   // chip / panel fills
}
```

**A2.2 — Total colour count on screen at any frame: 6 maximum.** Counting
`bg`, `accent`, `textPrimary`, `textDim`, `stroke`, `surface`. Photographic
imagery is exempt but is capped by A2.7.

**A2.3 — Accent budget.** The accent appears on **at most one element per
beat**, and on **no more than 8 elements across a 45-second Short**. It marks
the thing the voiceover is currently naming. Nothing else. If two elements
carry accent in the same frame, the render is rejected.

**A2.4 — Contrast is a hard gate, computed not eyeballed.**
WCAG defines the thresholds and they apply directly to on-screen text:
<cite index="86-1">normal text (under 18 pt / 14 pt bold) requires 4.5:1, large text (18 pt+ / 14 pt bold+) requires 3:1, and UI components and graphics require 3:1, all at Level AA; enhanced AAA requires 7:1 for normal text</cite>.
<cite index="80-1">Large text is defined as 14 point (typically 18.66 px) bold or larger, or 18 point (typically 24 px) or larger.</cite>

Every text size in this manual exceeds 24 px, so the *floor* is the 3:1
large-text rule. **That floor is not good enough for a phone at arm's length.**
This manual therefore adopts the AAA large-text figure as the minimum and the
AAA normal-text figure as the target:

| Pair | Minimum | Target |
|---|---|---|
| `textPrimary` on `bg` | 7:1 | 12:1 |
| `accent` on `bg` | 4.5:1 | 7:1 |
| `textDim` on `bg` | 4.5:1 | 4.5:1 |
| `stroke` / icons on `bg` | 3:1 | 4.5:1 |
| caption text on any background | 7:1 | — (guaranteed by the stroke in B4) |

Ratio is computed by the WCAG relative-luminance formula.
<cite index="82-1">Ratios cannot be rounded up — #777777 at 4.47:1 does not meet a 4.5:1 requirement.</cite>
<cite index="82-1">Where a text outline is used, WCAG allows the colour of the outline to be taken as the foreground colour when measuring.</cite> That is the mechanism the caption stroke in B4 relies on.

**A2.5** — Verify all 12 channel palettes at build time, not render time. A
palette that fails is a config bug, not a render bug. (`#0A1A15` + `#10B981`
for Earth Signal and `#0A1A10` + `#22C55E` for NutriDecode both need checking
— dark-green backgrounds with mid-green accents are the likeliest failures in
the set.)

**A2.6** — `bg` is **flat**. No gradient, no vignette, no radial glow behind
it. The existing `GridBackground` radial-gradient overlay is removed.

**A2.7** — Photographic imagery is desaturated to **35% saturation** and
tinted 12% toward `accent` before compositing, so it cannot introduce a
seventh colour family. Use `@remotion/effects`: `saturation()` then `tint()`.

## A3. Typography

Fonts are per-channel and already vendored as `.woff2` in
`src/skills/remotion-render/public/fonts/`. The motion-graphics set uses
DM Sans, Roboto Condensed, Fira Sans, JetBrains Mono, Nunito, and Inter.

**A3.1 — Two weights only per channel: 400 and 700/800.** No 300, no 500, no
italic. <cite index="38-1">Use clean screen sans-serifs and avoid thin weights and overly condensed styles.</cite>

**A3.2 — The scale.** Remotion's own layout rule for 1080-wide compositions
sets the floor: main headline at least 84 px, important supporting text at
least 44 px, scaled with composition width.

```js
export const TYPE = {
  hero:     220,  // w800 — a single number or single word
  headline:  84,  // w800 — Remotion floor. Never lower.
  value:     72,  // w800 — chart values, counters
  caption:   64,  // w800 — the VO caption (Part B)
  body:      52,  // w400
  support:   44,  // w400 — Remotion floor for supporting text
  label:     32,  // w700, tracking +2 — chart axis labels, chip text
  kicker:    28,  // w800, tracking +4, uppercase
};
```

All values multiply by `u = Math.min(width, height) / 1080`.

**A3.3 — Line length.** Max 2 lines for any text block. Max 7 words per
block. <cite index="37-1">Keep line length short — typically 3–7 words per beat — so viewers can read instantly.</cite>

**A3.4 — Measure, don't guess.** Use `measureText()` and `fitText()` from
`@remotion/layout-utils` to fit headline text into the Headline zone. A
headline that overflows must shrink in 4 px steps to a floor of 84 px, then
wrap, then truncate at the sentence boundary. It must never overflow the
zone. Deterministic measurement is the only way this survives 12 channels ×
2 videos/day without manual review.

**A3.5 — Type never stretches, warps, skews, or rotates.** Animate opacity,
translate, scale, and clip only.

**A3.6 — Tracking:** `kicker` +4, `label` +2, everything else 0. Negative
tracking is forbidden.

## A4. Icons

**A4.1 — The library is Lucide. It is not optional and not mixed.**
Rationale: it is the only library that is simultaneously (a) permissively
licensed for commercial use, (b) large enough to cover 12 unrelated niches,
and (c) built to a documented geometric standard, which is what lets an
automated pipeline pick icons without a designer checking each one.

**Licence — record this precisely in `THIRD_PARTY_LICENSES.md`:**
Lucide's own licence page states the library is released under the
**ISC License, Copyright (c) 2026 Lucide Icons and Contributors**. Separately,
a named list of roughly 110 icons inherited from the Feather project —
including `alert-circle`, `alert-triangle`, `check`, `clock`, `database`,
`dollar-sign`, `hash`, `key`, `lock`, `percent`, `search`, `server`,
`target`, `terminal`, and `trash` — carries **the MIT License, Copyright (c)
2013-present Cole Bemis**.
<cite index="68-1">With MIT or ISC licences you don't need visible attribution in the UI, but you do need to keep the licence text somewhere in your project's source.</cite>
Both notices go in the repo. Neither requires on-screen credit.

**A4.2 — Lucide's construction spec, verbatim from the design guide,
determines how icons must be rendered here:**
icons are designed on a **24 × 24 px canvas** with **at least 1 px padding**,
a **stroke width of 2 px**, **round joins**, **round caps**, and **centered
strokes**; shapes carry a **2 px border radius** if at least 8 px in size
(1 px if smaller), distinct elements sit **2 px apart**, and the standard
attribute block is:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
```

The guide also restricts icons to `<path>`, `<line>`, `<polygon>`,
`<polyline>`, `<circle>`, `<ellipse>`, and `<rect>` with **no transforms,
filters, fills, or explicit strokes**, and forbids `<use>` because referenced
element IDs are not guaranteed unique once embedded.

That last point matters directly: it means every Lucide icon is a clean set
of stroked paths, which is exactly what `evolvePath()` needs (§D2.5).

**A4.3 — Stroke weight must be recomputed at video scale. This is the single
most common way icon systems look wrong in video.**

A Lucide icon rendered at size *S* has an apparent stroke of `2 × S / 24`
pixels. At S = 240 that is a **20 px** stroke, which is roughly double the
stem weight of 84 px w800 type sitting next to it — the icon reads as a
cartoon.

**Rule:** the apparent stroke MUST land between **6 px and 12 px** at
1080-wide. Set the attribute explicitly:

```js
const strokeAttr = (renderedSizePx, targetStrokePx = 10) =>
  (targetStrokePx * 24) / renderedSizePx;
```

| Rendered size | `strokeWidth` attribute | Apparent stroke |
|---|---|---|
| 64 px | 2.25 | 6 px |
| 96 px | 2.25 | 9 px |
| 120 px | 2.00 (native) | 10 px |
| 180 px | 1.47 | 11 px |
| 240 px | 1.20 | 12 px |
| 320 px | 0.90 | 12 px |

**A4.4 — Icon sizes are fixed to four steps:** 64, 120, 180, 240.
Nothing between.

**A4.5 — Icon colour is `stroke` by default and `accent` only when the icon
*is* the accent element for that beat** (A2.3). Icons are never `textDim`.

**A4.6 — One icon per beat, maximum three on screen.** Three only in
`LIST_ITEM` and `RELATION` beats.

**A4.7 — Icon selection is keyword-driven and channel-scoped.** Each channel
declares an icon map in its config:

```jsonc
"icon_map": {
  "default": "circle-help",
  "terms": {
    "contract|clause|agreement": "file-text",
    "court|judge|ruling":        "gavel",
    "deadline|expires|days":     "clock",
    "fine|penalty|cost":         "banknote",
    "risk|warning|illegal":      "triangle-alert"
  }
}
```

Matching is longest-key-first against the beat's text. If nothing matches,
use `default`. **A beat MUST NOT invent an icon name at render time** — every
name resolves against the vendored set or the render fails loudly. Silent
fallback to a generic icon is how the current `iconFor()` ends up drawing a
sparkle on every beat.

**A4.8 — Lucide does not carry brand logos** — the project has an explicit
policy against them for legal and consistency reasons. Do not attempt to
source logos elsewhere. Named companies are rendered as **wordmarks in the
channel font**, never as logos.

## A5. Shape and line primitives

Use `@remotion/shapes`, which provides `<Rect>`, `<Circle>`, `<Ellipse>`,
`<Triangle>`, `<Star>`, `<Pie>`, `<Polygon>` plus their `make*()` path
functions. Hand-rolled `<div>` shapes are forbidden — they can't be
path-animated.

**A5.1 — The permitted primitive set for this style is exactly six:**

| Primitive | Use | Spec |
|---|---|---|
| Rule | dividers, underlines, axes | 4 px, `stroke`, radius 2 |
| Chip | list items, labels, nodes | `surface` fill, 2 px `stroke` border, radius 16, padding 16×24 |
| Node | flow/relation points | circle, r 44, `surface` fill, 3 px `accent` border |
| Bar | data | radius 8 top corners only, min height 6 px |
| Connector | relations | 4 px `stroke`, drawn via `evolvePath()` |
| Panel | grouped content | `surface`, radius 24, 32 px padding, no shadow |

**A5.2 — No shadows, no bevels, no glass, no blur-behind.** The project
already removed `GlassCard.tsx` for exactly this reason. `dropShadow()` from
`@remotion/effects` is permitted in one place only: the caption (§B4).

**A5.3 — Corner radius is 8, 16, or 24. Nothing else.** Circles excepted.

## A6. Background and texture

**A6.1** — Layer order, bottom to top, is fixed:

1. Flat `bg` fill
2. Dot grid — `dotGrid()` from `@remotion/effects`, `stroke` at **6% opacity**
3. Stage content
4. Headline / kicker / rail
5. Caption
6. Grain — `noise()` at **4% opacity** (the existing vfx-audit specifies
   5–10% for the minimal style; motion-graphics is flatter and takes the
   lower end)

**A6.2** — `@remotion/effects` runs on WebGL2, and renders require
`Config.setChromiumOpenGlRenderer('angle')`. This must be set in
`remotion.config.js` before any effect is used, or CI renders will silently
differ from local ones.

**A6.3 — The background never animates during a beat.** The current
`GridBackground` breathes a 520 px ring continuously; that is removed. It
competes with the focal element for no informational gain, and violates the
one-primary-mover rule.

**A6.4 — No particles.** `data/vfx-audit.md` lists particle counts of
20–500+; those figures belong to the cinematic-documentary style. In
motion-graphics, particles are decoration that carries no meaning and they
are forbidden here.

---

# PART B — CAPTIONS

This is the most-watched element in the frame and currently the least
specified. Everything in this part is mandatory and exact.

## B1. Why captions exist here at all — and the tension to resolve

There is a real conflict in the evidence, and it must be resolved
deliberately rather than ignored.

Mayer's **redundancy principle** states that people learn more deeply from
graphics and narration than from graphics, narration, *and* on-screen text —
<cite index="58-1">supported in 16 out of 16 experimental tests, with a median effect size of 0.86</cite>. Read naively, that says: don't put the voiceover on screen.

But that research measures *learning outcomes in attentive, audio-on
conditions*. Short-form social video is watched muted by default, and in that
condition <cite index="43-1">animated text often carries the message entirely, helping viewers understand the point quickly and stay engaged without narration</cite>. With no audio, on-screen text is not redundant — it is the only channel.

**Resolution — the rule this manual adopts:**

> Captions carry the **spoken words**. Graphics carry the **structure**.
> They never say the same thing twice.

Concretely: if the voiceover says "penalties reached four hundred thousand,"
the caption shows those words and the Stage shows a bar rising to a labelled
value. The Stage does **not** also print the sentence. The redundancy
principle applies to *explanatory prose duplicated as graphics captions* —
which this manual forbids in B7 — not to the transcript line.

## B2. Geometry

```js
export const CAPTION = {
  zoneTop:     1152,
  zoneBottom:  1248,        // == SAFE.bottom. Nothing goes below.
  anchor:      'bottom',    // block grows upward from zoneBottom
  maxWidth:    760,         // centred on OPTICAL_CENTRE_X = 468
  maxLines:    2,
  lineHeight:  1.12,
  align:       'center',
};
```

**B2.1** — The block is **bottom-anchored**. A one-line page and a two-line
page share the same bottom edge, so the caption never jumps vertically
between pages. This is non-obvious and matters: a vertically jumping caption
block is read as a glitch.

**B2.2** — Two lines at 64 px × 1.12 = 143 px, which overflows the 96 px
zone upward into the Headline zone. **This is permitted and is the one
zone-crossing exception in the manual** — but only upward, only for the
caption, and the Headline zone must therefore be kept clear of content in its
bottom 48 px whenever a two-line caption page is active.

**B2.3** — Captions are horizontally centred on x = 468, not 540. See A1.

**B2.4** — The caption is the **only** element permitted below y = 1140.

## B3. Segmentation — how words become pages

Broadcast subtitling gives hard, tested numbers. They are stricter than
social-video convention and this manual follows them, because the alternative
is guessing.

**Line length.** <cite index="89-1">Netflix's style guide allows a maximum of two lines per cue; three-line cues are not permitted, and the limit is 42 characters per line.</cite> For vertical video that limit shrinks: <cite index="93-1">the narrower screen means fewer characters per line — roughly 60% of the landscape limit.</cite>

> **42 × 0.6 ≈ 25.** Max **25 characters per line**, max 2 lines,
> max **7 words** per page.

**Reading speed.** Sources disagree and the disagreement is meaningful:
<cite index="94-1">Netflix caps adult content at 17 characters per second and children's at 13</cite>; other summaries of the English guide give <cite index="90-1">20 CPS for adult content and 17 for children's</cite>; and <cite index="93-1">the BBC's 160–180 WPM works out to about 15 CPS — deliberately slower, because BBC guidelines target broadcast audiences including elderly viewers and people with reading difficulties, whereas streaming services targeting younger reading-fluent audiences allow faster speeds</cite>. A general working figure is <cite index="87-1">12–14 CPS or 180 WPM</cite>.

The audience here is mobile, distracted, and often reading while a graphic is
also changing. **Adopt the conservative end: 15 CPS maximum.**

```js
export const CAPTION_LIMITS = {
  maxCharsPerLine: 25,
  maxLines:        2,
  maxWords:        7,
  maxCPS:          15,
  minDurationMs:   833,   // 5/6 s
  maxDurationMs:   5000,
  minGapFrames:    2,
};
```

**Duration bounds.** <cite index="94-1">Netflix requires cues to display for at least 5/6 of a second (about 833 ms) and no more than 7 seconds.</cite> The 7 s ceiling is a dialogue-subtitle figure; for a narrated Short a page held 7 s means the beat cadence has failed, so this manual caps at **5 s**.

**The gap rule — this is the one most often missed.**
<cite index="93-1">The 2-frame minimum gap between subtitles is crucial: without it, your brain doesn't register that the subtitle has changed, and you end up re-reading the same text — zero-gap subtitles that visually blur together are one of the most common mistakes in amateur subtitle files.</cite>

> **Every caption page MUST be separated from the next by ≥2 blank frames.**
> The exit animation (B5.3) must complete inside that gap.

**Generation.** Pages come from `createTikTokStyleCaptions()`.
<cite index="53-1">It segments tokens into pages, where a high `combineTokensWithinMilliseconds` fits many words per page and a low value produces word-by-word animation.</cite>
<cite index="53-1">The API expects whitespace to be included in the `text` field before each word — spaces are the delimiters, and omitting them merges everything into a single line or page.</cite>

Setting: **`combineTokensWithinMilliseconds: 1200`** for all sections;
**600** for the hook only. Then post-process every page against
`CAPTION_LIMITS` and split any page that violates one.

## B4. Caption typography and contrast treatment

```js
{
  fontFamily:            channelFont,
  fontWeight:            800,
  fontSize:              64 * u,
  lineHeight:            1.12,
  letterSpacing:         0,
  textTransform:         'none',        // NOT uppercase — see B4.4
  color:                 colors.textPrimary,
  WebkitTextStrokeWidth:  8 * u,
  WebkitTextStrokeColor:  colors.bg,
  paintOrder:            'stroke fill', // stroke behind fill, or glyphs erode
  filter: `drop-shadow(0 ${4*u}px ${12*u}px ${colors.bg}CC)`,
}
```

**B4.1 — The stroke is the contrast guarantee, not a decoration.**
<cite index="38-1">Guarantee contrast with a solid background pill, a drop shadow with subtle blur, a stroke/outline, or a gradient panel when the background is busy.</cite> A stroke is chosen over a pill because a pill occupies a fixed rectangle that fights the Stage geometry, and over a scrim because a scrim dims the imagery underneath.

WCAG permits this: <cite index="82-1">the colour of a text outline or border can be used as the text or foreground colour when measuring contrast</cite>. So `textPrimary` glyphs stroked in `bg` meet the ratio against *any* background, including photography.

**B4.2 — `paintOrder: 'stroke fill'` is mandatory.** Without it Chrome paints
the stroke over the fill and an 8 px stroke on 64 px type eats roughly a
quarter of every stem.

**B4.3 — No background pill, no box, no bar.** The project already removed
TikTok-style caption bars in an earlier visual-unification pass; that decision
stands.

**B4.4 — Sentence case, not uppercase.** All-caps costs roughly 10–15%
reading speed at a fixed size and this manual is already at a 15 CPS ceiling.
Uppercase is reserved for the kicker (28 px) and nothing else.

**B4.5 — Punctuation is preserved.** Commas and full stops are reading cues.
Em-dashes are replaced with commas; ellipses are removed.

## B5. The pop-in animation — frame by frame

At 30 fps. `f0` is the page's first frame. No value here is approximate.

### B5.1 Page entrance (the whole block)

| Property | Frames | From → To | Easing |
|---|---|---|---|
| `opacity` | f0 → f5 | 0 → 1 | `Easing.bezier(0.16, 1, 0.3, 1)` |
| `scale` | f0 → f5 → f8 | 0.88 → 1.04 → 1.00 | `[bezier(0.16,1,0.3,1), bezier(0.33,1,0.68,1)]` |
| `translateY` | f0 → f6 | +14 px → 0 | `Easing.bezier(0.16, 1, 0.3, 1)` |

Total entrance: **8 frames (267 ms)** — the `D.short`/`D.base` band from the
blueprint, and inside Material's 150–400 ms window for small-to-medium
elements.

The 1.04 overshoot is the "pop." It is not stylistic garnish: overshoot is
what distinguishes a mechanical fade from motion that reads as physical. The
existing `data/vfx-audit.md` specifies scale-in as `0→115%→100%` over 8–12
frames for icons; **the caption uses a smaller overshoot (104%) because 115%
on 64 px type at 780 px width visibly clips the safe width and reads as
bouncy rather than crisp.** Icons keep 115% (§D2.1).

Implementation, following Remotion's own markup rule that `interpolate()`
stays inline in the `style` prop and uses individual CSS transform properties
rather than a `transform` string:

```tsx
style={{
  opacity: interpolate(frame, [0, 5], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  }),
  scale: interpolate(frame, [0, 5, 8], [0.88, 1.04, 1.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: [Easing.bezier(0.16, 1, 0.3, 1), Easing.bezier(0.33, 1, 0.68, 1)],
    output: 'perceptual-scale',
  }),
  translate: interpolate(frame, [0, 6], ['0px 14px', '0px 0px'], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  }),
}}
```

`output: 'perceptual-scale'` is required on every scale interpolation —
Remotion's timing rule states that with linear scale output the perceived
change shrinks as the scale grows, and this option compensates.

**B5.2 — Words do not animate individually on entrance.** The whole page pops
as one block. Per-word entrance at 7 words × 4-frame stagger = 28 frames,
which is 933 ms before the page is fully legible — more than the minimum page
duration. Per-word motion is reserved for the *highlight* (B6), which is a
different thing.

**B5.3 — Page exit.** Starts at `pageEnd − 3`:

| Property | Frames | From → To | Easing |
|---|---|---|---|
| `opacity` | −3 → end | 1 → 0 | `Easing.bezier(0.33, 0, 0.67, 1)` |
| `scale` | −3 → end | 1.00 → 0.97 | same, `perceptual-scale` |

Exit is 3 frames — one token faster than the 8-frame entrance, per the
blueprint's exit rule and Material's guidance that <cite index="12-1">objects leaving the screen may have shorter durations, as they require less attention</cite>.

Exit completes **inside** the 2-frame gap plus 1 frame of the preceding page.

**B5.4 — No slide-in from the side. No typewriter. No blur-in. No rotation.**
Slide-in forces horizontal eye travel on text that is about to be read.
Typewriter caps reading speed at the type rate, which cannot meet 15 CPS.

## B6. Active-word highlight

This is the element that reads as "modern short-form" and it is the one place
where per-token motion belongs.

Each `TikTokPage` carries `tokens`, each with `fromMs` and `toMs`. The token
whose window contains the current frame is **active**. Exactly one token is
active at a time; if none matches (a pause), the last active token remains
active.

| State | Colour | Scale | Opacity |
|---|---|---|---|
| Not yet spoken | `textPrimary` | 1.00 | 0.55 |
| Active | `accent` | 1.00 → 1.08 → 1.02 | 1.00 |
| Already spoken | `textPrimary` | 1.00 | 1.00 |

**B6.1 — Timing of the active transition,** where `t0` = the frame at
`token.fromMs`:

| Property | Frames | From → To | Easing |
|---|---|---|---|
| `color` | t0 | instant switch to `accent` | none |
| `scale` | t0 → t0+3 → t0+6 | 1.00 → 1.08 → 1.02 | `[bezier(0.16,1,0.3,1), bezier(0.33,1,0.68,1)]` |
| `opacity` | t0−1 → t0+1 | 0.55 → 1.00 | `bezier(0.16,1,0.3,1)` |

On deactivation (`token.toMs`): colour returns to `textPrimary` over 3 frames,
scale returns to 1.00 over 3 frames, opacity **stays at 1.00**.

**B6.2 — Colour switches on a single frame, scale eases.** A 3-frame colour
crossfade at 30 fps reads as mush; an instant switch reads as a hit. Scale
must ease or it strobes.

**B6.3 — Scale 1.08 on an inline token must not reflow the line.** Apply
`display: inline-block` and `transform-origin: center bottom` per token, and
reserve the 8% by measuring the page at 1.08 with `measureText()` when
deciding line breaks. A caption that reflows mid-page is a render rejection.

**B6.4 — The highlight accent is exempt from the A2.3 one-accent-per-beat
budget.** It is a continuous reading aid, not an emphasis mark. But it is the
*only* exemption, and it means the Stage graphic MUST NOT also use accent
during a beat where the caption is running — which in practice is every beat.
**Consequence: Stage accent is applied only in the 4-frame window where a
value lands or a node is named, and the caption highlight suppresses to
`textPrimary` for those 4 frames.** One accent on screen, always.

**B6.5 — Never highlight more than one token.** Never highlight a token
before it is spoken. Never leave a token highlighted after the page ends.

## B7. Forbidden in captions

- Emoji, of any kind
- Bouncing, wobbling, rotating, or shaking text
- Karaoke-style colour *wipes* across a word (colour is per-token, binary)
- Words appearing one at a time on entrance (B5.2)
- Any second text block on screen simultaneously with the caption, other than
  the Headline and the kicker
- Caption text duplicating the Headline text — if the caption says the words,
  the Headline shows a *different* thing (a number, a term, a label)
- Uppercase
- Caption below y = 1248

---

# PART C — THE RELATION BETWEEN VISUALS AND VOICEOVER

This is the part that decides whether the video teaches or merely decorates.
It is grounded in the most replicated body of evidence available on the
question — Mayer's multimedia learning research, where each principle below
carries a stated number of supporting experiments and a median effect size.

## C1. The five principles that bind, with their evidence

**C1.1 — Temporal contiguity.** <cite index="58-1">People learn more deeply when corresponding animation and narration are presented simultaneously rather than successively — supported in 9 out of 9 experimental tests, median effect size 1.22.</cite> <cite index="64-1">The rationale is that simultaneity ensures the corresponding words and pictures are in working memory at the same time, removing the need to hold one in memory while waiting for the other.</cite>

This is the largest effect in the set. It is the governing law of this
manual.

> **The graphic that represents a concept must be on screen while the words
> that name that concept are spoken.**

**C1.2 — Spatial contiguity.** <cite index="58-1">Corresponding words and pictures presented near rather than far from each other — 22 out of 22 tests, median effect size 1.10.</cite>

> **A label belongs adjacent to the thing it labels, never in a legend, never
> in a corner.** Bar values sit on or immediately above their bar. Node
> labels sit on the node. There are no keys or legends in this style.

**C1.3 — Coherence.** <cite index="58-1">People learn more deeply when extraneous material is excluded rather than included — 23 out of 23 tests, median effect size 0.86.</cite>

> **Every element must be removable-testable:** if deleting it does not
> change what the viewer understands, delete it. This is the formal basis for
> A6.3 (no breathing ring), A6.4 (no particles), and A5.2 (no shadows).

**C1.4 — Redundancy.** <cite index="58-1">Graphics and narration beat graphics, narration, and on-screen text — 16 out of 16 tests, median effect size 0.86.</cite> Resolved for the muted-viewing case in B1.

> **The Stage never prints the sentence the caption is already showing.**

**C1.5 — Signalling.** <cite index="57-1">People learn better when cues that highlight the organisation of the essential material are added — apply it by using arrows, call-outs, and highlighting to emphasise important content.</cite>

> **This is what the accent colour and the kicker are for.** The kicker tells
> the viewer where they are in the argument; the accent tells them what to
> look at right now. Both are signalling devices, and neither may be used
> decoratively.

## C2. The synchronisation law

**C2.1 — The anchor token.** Every beat declares one **anchor token** — the
word in the voiceover that names the thing the Stage is showing. For
`HERO_NUMBER` it is the numeral. For `TERM_DEFINE` it is the term. For
`PROGRESS` it is the value. The classifier that produces beats
(`MOTION-BLUEPRINT` §4.2) MUST emit `anchorTokenIndex` alongside each beat.

**C2.2 — The sync window.** Let `tA` be the frame at the anchor token's
`fromMs`. The Stage element's entrance animation MUST begin in:

```
[tA − 4, tA + 2]     (−133 ms to +67 ms)
```

The −4 allowance exists because an 8-frame entrance beginning 4 frames early
reaches its settled state at roughly `tA + 4`, which is the moment the word
finishes landing. That is *simultaneity in perception*, which is what
temporal contiguity actually measures. Anything earlier is successive
presentation; anything later than +2 reads as lag.

**C2.3 — Setup lines lead, named entities don't.** The existing script
template note — "Voiceover leads the data. 'Look at this' BEFORE visual
appears" — is correct and is not in conflict. The *setup clause* precedes the
graphic; the *anchor token* is simultaneous with it. Formally: the Stage may
be empty during the setup clause, and MUST be populated within the sync
window of the anchor token.

**C2.4 — Nothing on the Stage may animate when no token is being spoken**
other than the single permitted idle behaviour in D5. Silence is a held
frame, not an excuse for drift.

**C2.5 — One concept per beat.** If a beat's text names two concepts, the
classifier splits it into two beats. Never two anchor tokens.

## C3. What each layer is allowed to say

| Layer | Carries | Never carries |
|---|---|---|
| Caption | the spoken words, verbatim | paraphrase, summary, commentary |
| Headline | the *named entity* or *value* — a term, a number, a label | sentences, the caption text |
| Stage | the *relationship* — magnitude, sequence, comparison, structure | text longer than 3 words per element |
| Kicker | position in the argument | content |
| Icon | the *category* of the subject | anything the headline already says |

**C3.1** — Headline and caption MUST NOT share more than 2 words. Checked
automatically.

**C3.2** — The Stage may only carry text as: chart axis labels, bar values,
node labels, and chip text. Each capped at 3 words.

---

# PART D — MOVEMENT

## D1. The motion tokens

Carried forward unchanged from `MOTION-BLUEPRINT` §1.3, derived from
Material's published duration slots — <cite index="19-1">50 ms, 100 ms, 150 ms, 200 ms, 250 ms, 300 ms, 350 ms, 400 ms, 450 ms, 500 ms</cite> — with <cite index="14-1">150–200 ms for small elements and up to 400 ms for larger ones per Material, and 100 ms for micro-interactions up to 500 ms for complex motion per Fluent 2</cite>.

```js
export const D = {
  micro: 4, short: 6, base: 9, large: 12, complex: 15, push: 60, hold: 45,
};
export const E = {
  out:    Easing.bezier(0.16, 1, 0.3, 1),   // entrances — Remotion's own default
  settle: Easing.bezier(0.33, 1, 0.68, 1),  // overshoot return
  in:     Easing.bezier(0.33, 0, 0.67, 1),  // exits
  push:   Easing.spring({ damping: 200 }),  // no-bounce move
};
```

**D1.1 — Linear is banned.** `data/vfx-audit.md` already states linear is
never used for text or motion. Remotion's docs confirm the default
`interpolate()` behaviour is linear unless an `easing` is supplied, so every
call must supply one.

**D1.2 — Every `interpolate()` clamps both ends.** Without
`extrapolateLeft`/`extrapolateRight` set to `'clamp'`, values keep growing
past the input range.

**D1.3 — Every `scale` interpolation sets `output: 'perceptual-scale'`.**

## D2. The five entrance patterns — and nothing else

Only these five exist. A beat picks one per element.

### D2.1 POP — icons, chips, nodes, values

| Property | Frames | From → To | Easing |
|---|---|---|---|
| `scale` | 0 → 5 → 9 | 0 → 1.15 → 1.00 | `[E.out, E.settle]` |
| `opacity` | 0 → 3 | 0 → 1 | `E.out` |

The 0 → 115% → 100% curve over 8–12 frames is taken directly from the
existing `data/vfx-audit.md` icon-animation spec and is retained.

### D2.2 RISE — headlines, labels, supporting text

| Property | Frames | From → To | Easing |
|---|---|---|---|
| `translateY` | 0 → 9 | +24 px → 0 | `E.out` |
| `opacity` | 0 → 6 | 0 → 1 | `E.out` |

No scale. Text that scales while it fades reads as blurry at 30 fps.

### D2.3 DRAW — rules, connectors, axes, icon strokes

Uses `evolvePath()` from `@remotion/paths`, which
<cite index="101-1">animates an SVG path from invisible to full length, taking a progress value where 0 is invisible and 1 is fully drawn, and returning `strokeDasharray` and `strokeDashoffset` values to pass to the `<path>` element</cite>.

| Property | Frames | From → To | Easing |
|---|---|---|---|
| `progress` | 0 → 14 | 0 → 1 | `E.out` |

**A draw never overshoots.** A line reaching past its own endpoint and
snapping back is physically incoherent — the line has a defined length.
Overshoot belongs to POP only.

### D2.4 GROW — bars, gauges, fills

| Property | Frames | From → To | Config |
|---|---|---|---|
| `height` | 0 → ~20 | 0 → target | `spring({ damping: 16, stiffness: 90 })` |
| counter | 0 → ~20 | 0 → value | driven by the same spring |
| label | 10 → 19 | RISE | `E.out` |

Spring with visible overshoot is correct here and is the one place it is used
on a dimension. <cite index="6-1">The default spring config overshoots slightly before settling; increasing damping removes the bounce</cite> — damping 16 keeps a small, deliberate overshoot.

Label lands **after** the bar (follow-through), per the chart rules already
established in `MOTION-GRAPHICS-RULES.md` §2, which are carried forward whole.

### D2.5 TRACE — icon reveal (use sparingly)

Because every Lucide icon is stroked paths with no fills, an icon can be
drawn on rather than popped in. Apply `evolvePath()` to each subpath in
order, 10 frames each, staggered `D.micro` (4f).

**Limit: one TRACE per video.** It costs 20–40 frames and is only worth it on
the single most important icon — typically the hook's.

## D3. Exits

| Element | Pattern | Frames |
|---|---|---|
| Caption page | fade + 0.97 scale | 3 |
| Stage element | fade + `translateY −12` | 6 |
| Headline | fade only | 6 |
| Whole Stage at section change | handled by `TransitionSeries` wipe | 12 |

**D3.1 — Exits are always shorter than entrances** (blueprint rule, Material
rationale). **D3.2 — Exits never overshoot. D3.3 — Elements never exit the
way they entered** — a POP does not un-POP; it fades.

## D4. Stagger

**D4.1 — Secondary elements lag the primary by `D.micro` (4 frames).**
**D4.2 — Chart bars stagger 5 frames** (the 3–5 frame charting norm already
recorded in `MOTION-GRAPHICS-RULES.md`). **D4.3 — List items stagger 6
frames.** **D4.4 — Maximum 4 staggered elements.** Five at 6 frames is 30
frames of entrance, which exceeds the minimum beat length.

**D4.5 — One primary mover per beat.** The hero element animates first,
largest, alone. Never three elements moving the same way at once.

## D5. Idle — what happens for the other 70% of a beat

A beat is 45–90 frames; its entrance consumes 9–20. **Something must occupy
the remainder without becoming a second mover.**

Exactly one idle behaviour is permitted per beat, and only one:

| Idle | Applies to | Spec |
|---|---|---|
| Caption highlight | always | B6 — this alone satisfies most beats |
| Counter | `HERO_NUMBER`, `PROGRESS` | value counts across `D.push` (60f) |
| Slow push | `IMAGE_BEAT` | scale 1.05 → 1.00 over `D.push`, `E.push` |
| Rail fill | always | 4 px rule, continuous, linear, imperceptible |

**D5.1 — No idle pulsing, no breathing, no floating, no drift.** The current
composition breathes the background ring and pulses the final chart bar; both
are removed. A held frame with an active caption highlight is not a dead
frame — the highlight *is* the motion.

**D5.2 — If a beat has no caption running and no counter, it is too long.**
Shorten it and let the next beat start.

## D6. Camera

**D6.1 — There is no camera in this style.** No zoom on the composition, no
parallax, no 3D. `data/vfx-audit.md` lists 3–5 depth layers at 0.2–1.2×
parallax and slow camera push for motion graphics; **that conflicts with the
project's own architectural decision to strip Three.js/WebGL in favour of
pure CSS/SVG, and with the flat-2D language this manual specifies. Parallax
is not used.** The only translation of the whole frame is the
`TransitionSeries` wipe at section boundaries.

**D6.2 — The single exception is `IMAGE_BEAT`,** where the *image* — not the
composition — pushes 1.05 → 1.00.

## D7. Forbidden motion

Rotation of any element other than a `<Pie>` sweep · spin · flip · 3D
transforms · bounce beyond the specified 1.15 / 1.08 / 1.04 overshoots ·
motion blur · shake · wobble · elastic easing · strobing · anything moving
during silence · more than 3 full-frame luminance changes per second (the
flash-safety ceiling from the blueprint) · `zoomBlur()` and `flip()` from
`@remotion/transitions`, which exist and are not to be used.

---

# PART E — ASSETS

## E1. Icons

**E1.1 — Vendored, not fetched.** Install `lucide-static`, copy the SVG set
into `src/skills/remotion-render/public/icons/`, and reference via
`staticFile()`. Remotion's asset rule is that files go in `public/` and are
referenced with `staticFile()`. Never fetch an icon over the network at
render time — the project already hit a Pixabay CDN rate-limit failure caused
by Remotion's concurrent frame rendering hitting remote URLs, and the fix was
pre-downloading to local paths. The same failure mode applies to icons.

**E1.2 — Vendor only what's used.** Each channel's `icon_map` is the
allow-list; a build step copies the union of all 12 maps plus the defaults.
Expect 60–120 icons total, not 1,500.

**E1.3 — Strip and normalise on vendoring:** remove `width`/`height`
attributes (size is set at render), keep `viewBox="0 0 24 24"`, set
`stroke="currentColor"`, and set `stroke-width` at render per A4.3.

**E1.4 — `THIRD_PARTY_LICENSES.md` records both the ISC notice and the
Feather MIT notice** (A4.1).

## E2. Photography

**E2.1 — Motion-graphics uses photography sparingly:** `IMAGE_BEAT` is
capped at **20% of beats** for this style. It is a diagram style; images are
evidence, not wallpaper.

**E2.2 — Only for named real subjects** — a person, a place, an object the
script names. Never as generic texture. This follows the repo README's own
commitment that real verified photos are used for named people and places and
never mismatched stock or generic filler.

**E2.3 — Resolution floor.** Source images MUST exceed the canvas in both
dimensions before any push. For a 1080 × 1920 Short with a 1.05 push, the
minimum source is **1134 × 2016**. Below that, upscaling blur is guaranteed —
a defect already logged on this project.

**E2.4 — Pre-download to local paths before render** (E1.1).

**E2.5 — Treatment:** desaturate to 35%, tint 12% toward `accent`, no grain
beyond the global 4%, no vignette. Composited inside the Stage zone at radius
24, never full-bleed — full-bleed is the cinematic-documentary language.

**E2.6 — Every image beat carries a 32 px `label` credit line** in `textDim`
at the Stage's bottom-left, inside the safe rect.

## E3. Data and charts

**E3.1 — Numbers come from the research JSON, never from regex over the
voiceover.** The current `extractStats()` scrapes numerals with a regular
expression and will happily chart "1986" as a quantity. Charts render only
from an explicit `beat.data` array:

```jsonc
"data": {
  "unit": "%",
  "series": [
    { "label": "2019", "value": 12 },
    { "label": "2024", "value": 47, "highlight": true }
  ]
}
```

**E3.2 — If `beat.data` is absent, the beat is not a chart beat.** It falls
back to `HERO_NUMBER` or `STATEMENT`. No inference.

**E3.3 — Maximum 5 series points.** Six or more is unreadable at 840 px wide.

**E3.4 — Chart construction order** (carried forward from
`MOTION-GRAPHICS-RULES.md` §2, unchanged): baseline and gridlines and axis
labels DRAW first; bars GROW staggered 5 frames; values count with the bar;
labels RISE after the bar. Only the `highlight: true` point takes accent.

**E3.5 — Axis labels sit adjacent to their axis; values sit on their bar.**
Spatial contiguity, C1.2. No legends.

## E4. Sound effects

Already vendored and license-clear: `src/audio/kenney_impact/`,
`src/audio/kenney_interface/`, indexed in `src/audio/sfx-manifest.json`.

**E4.1** — One SFX per beat maximum. **E4.2** — Section wipe →
`transitions/close_00n.ogg` at −18 dB. Value settle → `ui/click_004.ogg` at
−22 dB. List chip → `ui/click_001.ogg` at −24 dB. **E4.3** — SFX fires on the
frame the *visual* lands, never on the word. **E4.4** — Master −14 LUFS
integrated, VO peaks ≤ −3 dBFS.

Remotion hosts a sound set at `remotion.media` usable via `<Audio>` from
`@remotion/sfx`, including `whoosh.wav`, `whip.wav`, `page-turn.wav`,
`switch.wav`, and `ding.wav` — but the set is dominated by meme stings
(`vine-boom`, `wilhelm-scream`, `windows-xp-error`, `bruh`) that are wrong for
this catalogue. Pull `whoosh.wav` for wipes if the Kenney transition set
proves too dry; take nothing else.

## E5. Fonts

**E5.1** — Local `.woff2` only, already vendored, loaded through
`fonts-loader.js`. No Google Fonts network calls at render time.
**E5.2** — Two weights per channel (A3.1). **E5.3** — `wait-for-fonts.js` must
resolve before the first frame renders, or frame 0 ships with fallback metrics
and the whole video is measured wrong.

## E6. Prohibited assets

Brand logos of any kind (A4.8) · stock video · emoji · gradients as fills ·
3D models · Lottie files · any font not in `public/fonts/` · any image fetched
at render time · any icon outside the vendored Lucide set.

---

# PART F — BEAT ARCHETYPES, FULLY STORYBOARDED

Each entry specifies exactly what occupies each zone and what moves when.
`tA` = anchor token frame (C2.1). Frame numbers are relative to beat start.

## F1. HERO_NUMBER — 60–90 frames

| Zone | Content |
|---|---|
| Kicker | section rule + number + label (persistent) |
| Stage | the numeral at `TYPE.hero` (220 px w800), `accent`, centred on x=468, y=666 |
| Headline | the unit / what it measures — `TYPE.headline`, `textPrimary` |
| Caption | running |

| Frame | Event |
|---|---|
| tA−4 | numeral POP begins, counting from 0 |
| tA−4 → tA+56 | counter runs 0 → value, `E.out`, over `D.push` |
| tA+8 | headline RISE |
| tA+56 | counter settles, `ui/click_004.ogg` at −22 dB |
| tA+56 → end | held; caption highlight is the only motion |

Counter formatting: thousands separators from the start, so digit count never
changes and the numeral never reflows.

## F2. TERM_DEFINE — 45–60 frames

| Zone | Content |
|---|---|
| Stage | icon at 180 px, `stroke`, centred x=468 y=600 |
| Headline | the term, `TYPE.headline`, `textPrimary`; a 4 px `accent` rule DRAWs beneath it |
| Caption | running |

| Frame | Event |
|---|---|
| tA−4 | icon POP |
| tA | term RISE |
| tA+6 | rule DRAW, 14 frames, left-to-right, width = measured term width |
| tA+20 → end | held |

The rule is the accent element for this beat. The icon is `stroke`, not
accent.

## F3. LIST_ITEM — 45 frames per item

Items accumulate in the Stage. Prior items **do not exit** — they dim to
`textDim` and shift up by 88 px.

| Zone | Content |
|---|---|
| Stage | up to 4 chips stacked, 88 px pitch, left-aligned at x=88 |
| Headline | the list's own title, set once at the first item, held |
| Caption | running |

| Frame | Event |
|---|---|
| tA−4 | new chip POP at the stack's bottom slot |
| tA−4 → tA+5 | existing chips translate up 88 px, `E.out`, staggered 2 frames |
| tA−4 → tA+5 | existing chips fade `textPrimary` → `textDim` |
| tA | chip's numeral badge takes `accent` for 6 frames, then `stroke` |
| tA+2 | `ui/click_001.ogg` at −24 dB |

Max 4 visible. A fifth item drops the first with a 6-frame fade.

## F4. CONTRAST — 60–75 frames

| Zone | Content |
|---|---|
| Stage | split vertically at x=468; left panel = the "before", right = the "after"; 4 px `stroke` divider DRAWs top-to-bottom |
| Headline | the pivot word ("but", "instead") is *not* shown; the headline is the consequence |
| Caption | running |

| Frame | Event |
|---|---|
| 0 | left panel already present (carried from the previous beat if possible) |
| tA−6 | divider DRAW, 12 frames, top → bottom |
| tA−4 | right panel POP, scale from 0.92 |
| tA+4 | right panel's key element takes `accent` |

Left panel is `textDim`; right panel is `textPrimary`. The eye is told which
side is the answer without a word.

## F5. PROGRESS — 75–90 frames

Full chart. Construction order from E3.4.

| Frame | Event |
|---|---|
| 0 | baseline rule DRAW, 10 frames |
| 8 | gridlines DRAW, staggered 3 frames each |
| 16 | axis labels RISE |
| tA−4 | first bar GROW |
| +5 each | subsequent bars GROW, staggered 5 frames |
| bar+10 | that bar's value counter completes |
| bar+12 | that bar's label RISEs |
| highlight bar settle | `accent` applied; `ui/click_004.ogg` at −22 dB |

The Stage may not contain a chart and an icon simultaneously.

## F6. RELATION — 60 frames

| Zone | Content |
|---|---|
| Stage | two nodes (r=44) at x=248 and x=688, y=666; connector between them |
| Headline | the nature of the relation, ≤4 words |
| Caption | running |

| Frame | Event |
|---|---|
| 0 | node A POP (or carried from previous beat) |
| tA−4 | node B POP |
| tA+4 | connector DRAW, 14 frames, A → B |
| tA+18 | headline RISE |

Direction matters: the connector always draws from the concept mentioned
first in the sentence toward the one mentioned second.

## F7. IMAGE_BEAT — 60–90 frames (≤20% of beats)

| Zone | Content |
|---|---|
| Stage | image, radius 24, inset to the Stage zone, treated per E2.5 |
| Headline | who or what it is |
| Stage bottom-left | 32 px credit line, `textDim` |
| Caption | running |

| Frame | Event |
|---|---|
| tA−4 | image fades in over 9 frames, scale 1.05 |
| tA−4 → tA+56 | push 1.05 → 1.00, `E.push` |
| tA+6 | headline RISE |

## F8. STATEMENT — 45–60 frames (≤30% of beats)

The fallback. Icon at 120 px + headline. Icon POP at tA−4, headline RISE at
tA. Nothing else.

**If STATEMENT exceeds 30% of a video's beats, the classifier has failed and
the render is rejected.** This is the direct guard against the current
behaviour, where the fallback scene renders 100% of the time.

---

# PART G — WHAT MAY VARY ACROSS THE 12 CHANNELS

**Locked — identical for all 12:** zone layout, safe rect, grid, type scale,
motion tokens, easing curves, entrance patterns, caption geometry, caption
animation, highlight behaviour, beat archetypes, chart construction order,
SFX map, licence handling.

**Per-channel — declared in `config/channels.json`, nowhere else:**

| Field | Constraint |
|---|---|
| `thumbnail_spec.baseHue` / `accentHue` | 2 hues, derived roles must pass A2.4 and COL-01..06 |
| `font` | one of the vendored families; 2 weights |
| `icon_map` | keyword → Lucide name, names must exist in the vendored set |
| `tone` | affects script wording only, never motion |
| `channel_name` | kicker + end screen |

**G1 — Style differentiation across the 12 channels is carried entirely by
palette, font, and icon vocabulary.** That is sufficient: Fraud Files in
JetBrains Mono on `#0A0A1A`/`#22C55E` with a `shield`/`file-search`/`banknote`
icon set does not look like NutriDecode in DM Sans on `#0A1A10`/`#22C55E`
with `apple`/`flame`/`scale`.

**G2 — A channel MUST NOT introduce a new motion pattern, a new archetype, a
new zone, or a new primitive.** If a channel genuinely needs one, it goes in
this manual for all 12 or it doesn't ship.

**G3 — `production_notes` in generated scripts MUST NOT contain colour or
motion instructions.** The current `motion-graphics-shorts.js` template
interpolates `colors.bg` and `colors.accent` into `visual_cue` prose; that is
removed. Colour lives in config; motion lives here.

---

# PART H — VERIFICATION GATE

These extend the gate in `MOTION-BLUEPRINT` §10. All are automatable; none
require a human to look at a frame except H14–H16.

**Static — beat timeline and props:**

1. `STATEMENT` ≤ 30% of beats
2. No archetype repeats >2× consecutively
3. Every beat has exactly one `anchorTokenIndex`
4. Every Stage entrance begins within `[tA−4, tA+2]`
5. No caption page exceeds 25 chars/line, 2 lines, or 7 words
6. No caption page exceeds 15 CPS
7. Every caption page duration ∈ [833 ms, 5000 ms]
8. Every caption page is separated by ≥2 blank frames
9. Headline and caption share ≤2 words
10. Exactly one `accent` element per frame
11. Every icon name resolves in the vendored set
12. Every chart beat has explicit `beat.data`; no regex-derived numbers
13. Every source image ≥ 1134 × 2016

**Static — palette, run once per config change:**

14. All 12 palettes pass A2.4 at every specified pair

**Visual — ffmpeg contact sheet, 1 frame every 15:**

15. ≥4 visually distinct frames per 10-second span
16. No frame shows text crossing the safe rect
17. Frame 0 and final frame compared for loop match

**H18 — No render is described as working without a rendered PNG frame.**
The project's standing rule; it applies to every claim in this document being
implemented.

---

# §10 — SOURCES

**Remotion (first-party):**
`remotion.dev/docs/interpolate` · `/spring` · `/easing` ·
`/transitioning` · `/transitions/` · `/transitions/timings/springtiming` ·
`/captions/api` · `/captions/caption` · `/captions/create-tiktok-style-captions` ·
`/paths/` · `/paths/evolve-path` · `/paths/get-length` · `/standalone` (package
inventory: `@remotion/shapes`, `@remotion/layout-utils`, `@remotion/noise`) ·
`github.com/remotion-dev/skills` → `remotion-markup/SKILL.md`,
`remotion-markup/timing.md`, `remotion-markup/transitions.md`,
`remotion-markup/effects.md`, `remotion-markup/sfx.md`,
`remotion-markup/images.md`, `remotion-markup/text-highlights.md`,
`remotion-create/video-layout.md`

**Icons:**
`lucide.dev/license` (ISC + Feather MIT, verified verbatim) ·
`lucide.dev/contribute/icon-design-guide` (24 px grid, 1 px padding, 2 px
stroke, round caps/joins, centred strokes, allowed SVG elements, no `<use>`) ·
`github.com/lucide-icons/lucide` · `dev.to/usapopopooon/...` (attribution
obligations under MIT/ISC) · `mantlr.com/blog/best-open-source-icon-libraries-compared`

**Cognitive basis for VO↔visual relation:**
Mayer, R. E. & Fiorella, L., "Principles for Reducing Extraneous Processing in
Multimedia Learning," *The Cambridge Handbook of Multimedia Learning*, ch. 12
(coherence 23/23 d=0.86; redundancy 16/16 d=0.86; spatial contiguity 22/22
d=1.10; temporal contiguity 9/9 d=1.22) ·
`edtechuvic.ca/.../principles-for-reducing-extraneous-processing...pdf` ·
`lucidea.com/blog/mayers-12-principles-of-multimedia-learning/` (signalling
application) · `jsu.edu/online/faculty/cognitive-theory-of-multimedia-learning.html`

**Captions and subtitles:**
`subtitlesedit.com/blog/netflix-subtitle-guidelines-line-length-characters`
(42 chars/line, 2 lines max) ·
`subtitlesedit.com/blog/netflix-subtitle-style-guide-explained` (17 CPS adult,
833 ms–7 s duration) · `gothamlab.com/netflix-subtitle-delivery-requirements-complete-guide/`
(20 CPS English adult — note the conflict) ·
`subhero.io/blog/subtitle-standards-guide` (BBC 160–180 WPM ≈ 15 CPS; portrait
≈ 60% of landscape line length; 2-frame minimum gap) ·
`support.limecraft.com/.../subtitling-spotting-rules` (12–14 CPS working
figure) · `hanna-eng.com/guides/normes-sous-titrage/` (per-language CPS
variance)

**Typography and readability:**
`gabrielpulecio.com/what-is-kinetic-typography/` (180–220 WPM, display-time
formula, 3-flash/sec safety cap) · `influencers-time.com` (3–7 words per beat,
1–2 lines, contrast treatments, thin-weight warning)

**Contrast:**
`webaim.org/articles/contrast/` (no rounding up; outline colour may be used as
foreground) · `webaim.org/resources/contrastchecker/` ·
`itaccessibility.arizona.edu/.../Quick-Reference-Cards-Accessibility-at-Arizona-Color-Contrast.pdf`
(4.5:1 / 3:1 / 3:1 / 7:1 table) · `brand.ucla.edu/fundamentals/accessibility/color-type`
(large-text definition: 14 pt bold ≈ 18.66 px, 18 pt ≈ 24 px)

**Motion timing:**
`material-components-android/docs/theming/Motion.md` (50–500 ms slots) ·
`m1.material.io/motion/duration-easing.html` (duration scales with distance;
exits shorter) · `equal.design/blog/5-rules-for-motion-in-ui-transitions`
(Material 150–200/400 ms; Fluent 2 100–500 ms)

**In-repo, carried forward:**
`data/vfx-audit.md` §Style 3 (icon pop 0→115%→100% over 8–12 f; counter
20–30 f; easing table) — parallax, particles, and 3D from that section are
explicitly *not* carried, see D6.1 and A6.4 ·
`.opencode/skills/remotion-render/MOTION-GRAPHICS-RULES.md` §2 (chart
construction order, 3–5 f bar stagger) · `data/visual-editing-guide.md` ·
`README.md` (real verified photos for named subjects)
