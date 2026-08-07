# LAYOUT SYSTEM — Editor-Grade Deterministic Composition

**Repo:** `lumeierecollection-blip/YOUTUBE`
**Replaces:** all layout code in `src/skills/remotion-render/compositions/*`
**Position in the doc set:**
`MOTION-BLUEPRINT.md` = **when** (beat timing) ·
`MOTION-GRAPHICS-MANUAL.md` = **what appears and how it moves** ·
**this document = where every pixel goes, and how the machine proves it landed there.**

---

# PART 0 — THE ALIGNMENT AUDIT

**Status: re-run 2026-08-06 against the actual current source.** The first
draft of this audit referenced a code state that no longer exists (symbols
like `SceneHeader`, `DataChartScene`, `GridBackground`, `FlowDiagramScene`,
`CompositeScene`, `extractHeroNumber`, `iconFor()`, `pickScene()` and the
`u = min(w,h)/1080` scaler are gone from HEAD). Items that are already fixed
are recorded as **CLEARED** with the fix noted; items that are still live are
marked **OPEN** and are what Parts 2–8 exist to fix.

File and line references are to `src/skills/remotion-render/` at HEAD
(commit `0da4749`, 2026-08-05; working tree has one change to
`config/channels.json`).

## 0.1 The scaler — CLEARED

The dead `u` scaler is gone. `motion-graphics.jsx:137-143` now computes a real
canvas fit and draws everything inside a fixed 1080×1920 `DesignSpace`
(`motion-graphics.jsx:145-162`) that scales as a unit:

```js
const S = Math.min(height / 1920, width / 1080);
```

Shorts: `S = 1`. Longform: `S = 0.5625`, centred — a portrait column on a
1920×1080 canvas. All coordinates inside are design-space px, so there is
exactly one unit convention per file.

## 0.2 Safe area — CLEARED for motion-graphics, OPEN for the other styles

`beats.js:27` defines `SAFE = { top: 288, bottom: 1248, left: 48, right: 888 }`
and `mg-style.js:24-30` derives `ZONES`. `motion-graphics.jsx` honours them:
rail `x 48, y 288–1248` (`mg.jsx:198`), kicker `top 312`, caption
`zoneBottom 1248` (`mg.jsx:433`), stage `392–940`, headline `964–1140`.

**OPEN — `minimal.jsx` and `cinematic-documentary.jsx` do not know the safe
rect exists.** `cinematic-documentary.jsx` puts the Shorts textOverlay at
`top: 28` (`cd.jsx:446`) — 260 px above the 288 safe line, under YouTube's
search/menu row — and pads the content column `padding: 40` (`cd.jsx:470`),
crossing the 48 px left safe line. `minimal.jsx` centers everything with no
safe-rect awareness at all.

## 0.3 The chart is not attached to its own axis — CLEARED

`DataChartScene` is gone. `ProgressScene` (`mg.jsx:705-827`) draws each bar as
an absolutely-positioned SVG rect at `top: baselineY - h` (`mg.jsx:774`) with
`baselineY = 880`, so **bar bottom == axis y exactly.** The axis line is drawn
at the same `baselineY` (`mg.jsx:744-755`). Bottom-up resolution, exactly what
Part 4 R2 mandates.

## 0.4 Axis labels detached from gridlines — CLEARED

The `right: <full parent width> + gap` bug is gone. Labels are now `position:
absolute; left: x` directly under their bar (`mg.jsx:797-814`). No detached
label rows.

## 0.5 Bar spacing uneven — CLEARED

`space-around` is gone from `motion-graphics.jsx`. `ProgressScene` computes
equal gutters: `gap = (840 - 96 - n*barW) / (n - 1)` (`mg.jsx:715`), so bars
span exactly `plotLeft`→`plotRight` with equal outer margins and equal gaps.

## 0.6 Composite hub drawn through by its spokes — CLEARED

No composite hub/spoke scene exists. The relation scene (`RelationScene`,
`mg.jsx:832-920`) draws two node circles and a single connector that starts
at the edge of node A (`248 + 44`) — the connector never crosses a node.

## 0.7 Background grid — CLEARED

The percentage dot grid is gone. `Background` (`mg.jsx:168-189`) uses a flat
`Solid` + `@remotion/effects` `dotGrid({dotSize: 8, gridSize: 80})` at 6%
opacity in `stroke` colour — a true uniform grid in both formats — plus a 4%
grain `noise`. The accent colour is not spent on decoration here.

## 0.8 Hook renders garbage text — CLEARED

The two-word regex headline is gone. `HeroScene` is gone. Headlines now come
from `subjectLabel()` / `termFromBeat()` in `mg-package.js:163-186`, which
derive a term from the beat's anchor token, not from a regex over prose.
`parseNumber` (`mg-package.js:84-117`) parses digits first and then a *bounded*
word-numeral grammar — it can parse `1986`, and it never manufactures a chart.

## 0.9 Hero numeral overflows the frame — CLEARED

`fontSize` is `TYPE.hero = 220` (`beats.js:33`) with no `scale(2)` entrance.
`HeroNumberScene` (`mg.jsx:579-605`) renders a counter `0 → value` over
`D.push` frames, clamped to the frame, centered at the optical centre
`(468, 666)` — no off-canvas spill.

**Minor residual — leading-zero counter.** `formatCounter` (`mg.jsx:121-125`)
pads to the digit count of the max value, so a $13,600 counter starts at
`00,000` and ticks `05,000 → 13,600`. Cosmetic, but it reads as a bug and is
fixable in the deterministic layer (§5.2).

## 0.10 `remotion.config.js` is entirely inert — OPEN

`render.js` renders via `bundle()` + `renderMedia()` from `@remotion/bundler`
and `@remotion/renderer` — the SSR path, not the CLI.

Remotion is explicit that <cite index="143-1">the configuration file has no effect when using these APIs</cite> and <cite index="138-1">has no effect when using SSR APIs</cite>. The <cite index="137-1">config file only applies to CLI commands</cite>; for programmatic renders, options like the OpenGL renderer must be passed as `chromiumOptions.gl` to `renderMedia()` directly.

So all four lines of `remotion.config.js` are silently discarded:

```js
Config.setVideoImageFormat("jpeg");      // ignored
Config.setOverwriteOutput(true);         // ignored
Config.setPublicDir("public");           // ignored
Config.setChromiumOpenGlRenderer("angle"); // ignored
```

`setPublicDir` being ignored is the dangerous one — it means `staticFile()`
resolution in the SSR render depends on default behaviour, not on what the
config claims. **This also invalidates the advice in `MOTION-GRAPHICS-MANUAL.md`
§A6.2:** setting `Config.setChromiumOpenGlRenderer('angle')` in
`remotion.config.js` does nothing here. It must be
`renderMedia({ chromiumOptions: { gl: 'angle' } })`.

## 0.11 `renderMedia()` ships with no quality settings — CLEARED

`render.js:278-290` passes `codec`, `audioCodec`, `enforceAudioTrack`,
`outputLocation`, `browserExecutable`, `concurrency`, `timeoutInMilliseconds`.
That's it.

No `crf`, no `imageFormat`, no `pixelFormat`, no `jpegQuality`,
no `chromiumOptions`. For flat-colour graphics with hard type edges — the
worst case for lossy intermediates and chroma subsampling — every one of those
is left to a default chosen for general video. §5.6 fixes this.

**CLEARED 2026-08-06** — `render.js` now passes `imageFormat: 'png'`, `crf: 16`,
`pixelFormat: 'yuv420p'`, and `chromiumOptions: { gl: 'angle' }` per §5.6, and
`verify-compositions.js` opens its browser with `gl: 'angle'` too.

## 0.12 Additional defects, current

- **`minimal.jsx` and `cinematic-documentary.jsx` are fully emergent layout**
  (Part 1's root cause still applies to them): flex-column centering
  (`minimal.jsx:86-93`, `cd.jsx:359-367`), hardcoded font sizes (`minimal.jsx:45`,
  `cd.jsx:131,373`), no text measurement or fit, and `sectionDuration =
  durationInFrames / sections.length` (`minimal.jsx:75`) with no audio timing.
- **`chunkVoiceover` (Part 7 D2) is still live** at `render.js:118` and
  `verify-compositions.js:38` — word-count chunking that ignores phrase
  boundaries and SRT timing, feeding the two emergent styles.
- **~~The Part 7 D6 entry-file workaround~~ — CLEARED.** `render.js` and
  `verify-compositions.js` now pass props via `inputProps` to both
  `selectComposition()` and `renderMedia()`/`renderStill()`, and apply the exact
  frame count by overriding `durationInFrames` on the selected composition
  object. Empirically verified on 4.0.505 (a green `inputProps` probe and a
  1-frame composition rendered as a 30-frame / 1.0 s video). The generated
  `render-entry.jsx` / `verify-entry.jsx` files and `writeRenderEntry()` are
  deleted.
- **Caption and headline are content-measured at render time, not declared.**
  `CaptionLayer` (`mg.jsx:429-472`) and `HeadlineBox` (`mg.jsx:480-530`) use
  `width: max-content`, `translate: "-50%"` and `fitTextOnNLines()` inside the
  browser — exactly the "measure during render" model §4 R3 replaces.
- **`ListRunScene` chips are flex + content-sized**, stacked at a computed
  `bottom` (`mg.jsx:1045-1088`) — emergent within the run.
- **The 8 px grid is declared but never enforced.** `GRID = { base: 8, cols:
  12, col: 56, gutter: 8, pad: 40 }` (`mg-style.js:33`) is exported and then
  unused. No coordinate in the codebase is snapped or asserted (§3.5, R4).
- **No layout verification tier exists.** `verify-compositions.js` renders
  stills and does pixel probes (stddev, mean colour, accent counts) but no
  bounding-box-vs-safe-rect assertion, no measured-vs-compiled check, and
  nothing like Tier 1 L1–L12 (Part 6).
- **One-accent discipline (L7) is not enforced.** The rail fill and the kicker
  rule both use `accent` continuously (`mg.jsx:208-217, 242-247`), so accent
  is spent on furniture and on the active token simultaneously.
- **Caption slot is hardcoded, not declared.** `bottom: 1920 - CAPTION.
  zoneBottom` (`mg.jsx:433`) re-derives a position from a constant instead of
  reading a slot rect (§3).

---

# PART 1 — ROOT CAUSE

Reading 0.2 through 0.6 together, there is one cause:

> **The layout is emergent, not declared.**

Positions are the *output* of nested flexbox rules interacting with
content-sized children, percentage constraints, and `align-items` on
variable-height columns. Nobody — not the author, not the pipeline, not a
verifier — can state where an element will be before Chrome lays it out. So
nothing can be checked, and every fix is a guess followed by a re-render.

That is the opposite of how a video editor works. **In an editor, every layer
has explicit x, y, width, height, in-point, and out-point.** You can read them
off the inspector. You can type into them. The canvas is a consequence of those
numbers, not a negotiation with them.

Remotion supports both models. Its own guidance leans toward the explicit one:
keep `interpolate()` calls inline in the `style` prop and use individual CSS
transform properties (`scale`, `translate`, `rotate`) rather than composing a
`transform` string, precisely so values remain legible and editable in Studio.
And `visualControl()` exists to make a hardcoded constant tweakable — <cite index="116-1">it renders a named control with a slider in the Studio's right sidebar, and once you're happy with the value you save it back into the code, with the caveat that saving only works if the first argument is static, because static analysis is performed on the source file</cite>.

One correction worth stating plainly, because it changes what's buildable:
**Remotion Studio is not a drag-and-drop editor.** <cite index="111-1">It is a development tool, not a video editing application — you cannot drag and drop elements or add effects through a visual interface, and all changes are made by editing React code and saving the file.</cite> The drag-and-drop canvas with a zoomable timeline, inline text editing, and layer resize belongs to the **Editor Starter** and **Timeline** products, which are <cite index="115-1">governed by the Remotion License and their own specific licence, free for individuals and small companies as a one-time purchase, with larger companies required to subscribe to the Company License</cite>.

So: don't buy an editor. **Build the editor's data model** — explicit,
inspectable, numeric — and let the pipeline write into it instead of a human.
That is what Parts 2–4 specify.

---

# PART 2 — THE SHOT SPEC

The Shot Spec is the editor's inspector, expressed as data. One per beat.
It is written in named roles and slots, not pixels, and it compiles to
absolute pixels deterministically.

## 2.1 Shape

```jsonc
{
  "id": "b07",
  "archetype": "PROGRESS",
  "startFrame": 412,
  "durationInFrames": 84,
  "anchorTokenIndex": 3,

  "layers": [
    {
      "role": "kicker",
      "slot": "kicker",
      "content": { "index": 2, "label": "The Deep Dive" },
      "enter": { "pattern": "RISE", "atFrame": 0 },
      "exit":  { "pattern": "NONE" }
    },
    {
      "role": "chart",
      "slot": "stage",
      "align": "bottom-left",
      "content": { "unit": "%", "series": [
        { "label": "2019", "value": 12 },
        { "label": "2024", "value": 47, "highlight": true }
      ]},
      "enter": { "pattern": "CHART_BUILD", "atFrame": "anchor-4" },
      "exit":  { "pattern": "FADE", "atFrame": "end-6" }
    },
    {
      "role": "headline",
      "slot": "headline",
      "align": "left",
      "content": { "text": "Reported cases, share of total" },
      "fit": { "maxSize": 84, "minSize": 64, "maxLines": 2 },
      "enter": { "pattern": "RISE", "atFrame": "anchor+8" },
      "exit":  { "pattern": "FADE", "atFrame": "end-6" }
    }
  ]
}
```

**2.1.1** — `slot` names a region from the slot table (Part 3). A layer may
never carry raw x/y. **2.1.2** — `align` positions the layer *inside* its slot
using one of nine anchors. **2.1.3** — `atFrame` accepts an integer, or
`anchor±n`, or `end−n`. Nothing else. **2.1.4** — `fit` declares the text
box contract; the compiler resolves the actual font size (§5.2).

## 2.2 The English layer

The spec above is what the compiler eats. What the *script/beat stage* writes,
and what a person reads in a review, is one line per layer:

```
b07  PROGRESS  412+84
  kicker   in kicker                    rise at 0
  chart    in stage, bottom-left        build at anchor-4, fade at end-6
  headline in headline, left, fit 84/64/2  rise at anchor+8, fade at end-6
```

**2.2.1** — This form is generated from the JSON, not hand-authored, and is
written to `data/shots/<channel>/<slug>.shots.txt` on every run. It is the
review artifact: a human or an agent reads 40 lines and knows the whole video's
layout without opening a renderer.

**2.2.2** — This is also what makes the system correctable in plain language.
"Move the headline above the chart" is a slot swap in one line, not a hunt
through nested flexbox.

## 2.3 What the spec forbids

- No layer may declare pixels.
- No layer may declare a colour. Colour comes from the role map
  (`MOTION-GRAPHICS-MANUAL` §A2.1).
- No layer may declare an easing. Easing comes from the pattern.
- Two layers may not occupy the same slot in overlapping frames, except
  `caption` + `kicker` + `rail`, which are declared persistent.

Each restriction removes a dimension in which 12 channels × 2 videos/day can
drift apart.

---

# PART 3 — THE SLOT TABLE

Every number is absolute, in a 1080 × 1920 frame, derived from the safe rect
(`MOTION-BLUEPRINT` §2) and the 8 px grid. **These are the only positions that
exist in the system.**

```js
export const SLOTS_SHORTS = {
  //          x     y     w     h
  kicker:   {  48,  288,  840,   72 },
  stage:    {  48,  392,  840,  548 },
  headline: {  48,  964,  840,  176 },
  caption:  {  88, 1152,  760,   96 },   // bottom-anchored at 1248, centred on 468; 2 lines may grow upward into headline's lower 48 px
  rail:     {  48,  288,    4,  960 },
};

export const SLOTS_LONGFORM = {
  kicker:   { 160,  100, 1600,   72 },
  stage:    { 160,  196, 1600,  560 },
  headline: { 160,  780, 1600,  144 },
  caption:  { 456,  884, 1008,   96 },   // bottom-anchored at 980, centred on 960
  rail:     { 160,  100,    4,  824 },
};
```

**3.1 — Arithmetic check, stated so it can be re-verified:**
kicker top 288 = safe top. rail bottom 288 + 960 = 1248 = safe bottom.
caption bottom 1152 + 96 = 1248 = safe bottom. All full-width slot right
edges 48 + 840 = 888 = safe right. caption is inset (88 → 848) so it can be
centred on the optical centre 468 (§3.4). Longform caption bottom 884 + 96 =
980 = safe bottom, centred on 960. Every value is a multiple of 4; every resolved width
and height is a multiple of 8. The two table values that are multiples of 4 but
not of 8 are deliberate: the rail width 4 (a 4 px stroke rule, TYP-18) and the
stage height 548 (392–940, confirmed by the live renderers) — grid
multiples apply to resolved rects, not to these two structural constants.

**3.1.1 — Corrected 2026-08-06.** The first draft of this table placed the
Shorts caption at `{ 150, 1148, 780, 100 }` and the Longform caption at
`{ 460, 944, 1000, 100 }`. Both fail the very checks this document defines:
Shorts caption right edge 150 + 780 = 930 exceeds the safe right 888 (L2),
its centre 540 contradicts §3.4's optical centre 468, and none of its
coordinates sit exactly on the 8 px grid (L3 records displacements up to 4);
Longform caption bottom 944 + 100 = 1044 exceeds the safe bottom 980 (L2).
`layout/run-lint.js` proves the original values fail L2 and the corrected
tables pass Tier 1 L1–L3.

**3.2 — Longform uses Remotion's own layout floor** — for 1080-wide
compositions, keep key text at least 80 px from the sides and 100 px from top
and bottom — scaled to 1920 wide → 160 px sides, and 100 px vertically, which
is where those numbers come from. Longform has no platform UI overlay, so the
Shorts safe rect does not apply.

**3.3 — The nine anchors** inside a slot: `top-left`, `top`, `top-right`,
`left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`.

**3.4 — Optical centre.** When a layer anchors `center` or `top`/`bottom` in a
Shorts slot, the centre used is the **slot's own centre (x = 468)**, never the
frame centre (540). Because every slot is inset to the safe rect, this is
automatic — which is the point of expressing everything in slots.

**3.5 — Grid step is 8 px.** The compiler rounds every resolved coordinate to
the nearest 8 and asserts the rounding moved it by ≤ 4. A rounding error larger
than that means a slot or a measurement is wrong.

**3.6 — `stage` is the only slot with freeform interior geometry**, and it is
subdivided by the same 12-column grid (56 px columns, 8 px gutters, 40 px outer
padding — 12 × 56 + 11 × 8 + 80 = 840). Chart bars, nodes, and chips snap to
column edges.

**3.7 — Slots never overlap (Shorts).** The one exception is a 2-line caption growing
upward into the bottom 48 px of `headline`, which is why `headline` is
176 tall but its content box is 128 (§5.3). **Longform caveat (corrected
2026-08-07):** in `SLOTS_LONGFORM` the caption slot (884–980) overlaps the
headline slot (780–924) by 40 px in the static table — the two-line caption
(980 − 143 = 837) also collides with the headline content box (780–876).
The longform table therefore keeps the same §3.7 rule, but the headline
content box must be kept clear when a two-line caption is active, exactly as
in Shorts. The longform rail spans 100–924 (it ends at the headline slot
bottom, not the safe bottom) — documented because, unlike the Shorts rail,
it is not full-safe-height.

---

# PART 4 — THE COMPILER

`compositions/layout/compile.js` — pure layout math, synchronous, runs in Node.
Text measurement is NOT performed inside compile.js: the @remotion/layout-utils
measurement functions throw outside a browser (machine-verified on the installed
4.0.506, and documented: “Only works in the browser, not in Node.js or Bun.”,
ESCLAY-5-1, resolved 2026-08-07, option 1). Measurement runs in the browser once,
before render, through layout/measure.js (font gate armed); its results are passed
into compile() as input, and compile resolves geometry from them.

```
ShotSpec[] ──compile()──▶ ResolvedFrame[]
```

A `ResolvedFrame` is a flat list of absolutely-positioned rects:

```jsonc
{
  "beatId": "b07",
  "rects": [
    { "role": "kicker",   "x": 48,  "y": 288,  "w": 840, "h": 40,
      "fontSize": 28, "lines": 1 },
    { "role": "chart",    "x": 88,  "y": 456,  "w": 760, "h": 420 },
    { "role": "headline", "x": 48,  "y": 964,  "w": 840, "h": 96,
      "fontSize": 84, "lines": 1 }
  ]
}
```

## 4.1 The four rules the compiler enforces

**R1 — Absolute only.** Every rect is emitted as
`{position:'absolute', left, top, width, height}`. **The renderer contains no
`display: flex` anywhere in the Stage, Headline, or Caption layers.** Flex is
permitted only *inside* a single leaf primitive (e.g. centring a numeral in a
node circle), never between siblings whose relative position matters.

This is the fix for 0.3, 0.5, 0.6, and 0.12 in one move. A bar cannot float
above its axis if the axis is at y = 876 and the bar's rect is
`{y: 876 − h, h}`.

**R2 — Bottom-up for anything that grows.** Bars, counters, and stacked lists
resolve their **bottom** edge first and extend upward. The current code
resolves tops and lets flex push things around.

**R3 — Measure before place (browser-time).** Any rect whose size depends on
text is measured in the browser through layout/measure.js — the gated wrappers,
so an unloaded font throws — *before* compile() runs, and the measured widths
and line counts are passed into compile() as input. Nothing is measured inside
compile.js (the library throws in Node), and nothing is measured *during* a
render frame.

**R4 — Round then assert.** Snap to 8 px, assert displacement ≤ 4 px, assert
the rect is inside its slot, assert the slot is inside the safe rect. Any
failure throws with the beat id and role. **A layout error becomes a build
error, not a bad frame.**

## 4.2 The component contract

```tsx
<Layer rect={rect} enter={enter} exit={exit}>
  <ChartPrimitive data={...} />
</Layer>
```

`<Layer>` applies `position: absolute` + the rect, and applies the entrance /
exit interpolation inline in the `style` prop using individual CSS transform
properties — `scale`, `translate`, `rotate` — rather than a composed
`transform` string, per Remotion's own markup guidance, which keeps values
legible and Studio-editable. Primitives never position themselves.

## 4.3 Where `visualControl()` fits

Once the layout is explicit, the manual-editor loop becomes real. Wrap the
constants that are genuinely a matter of taste — kicker tracking, chart bar
gutter, caption stroke width — in `visualControl()`. In the Studio they appear
as named sliders in the right sidebar, and the tuned value **saves back into
the source file**, subject to the constraint that the first argument must be a
static string because saving relies on static analysis of the source.

That gives exactly the workflow asked for: automated by default, manually
adjustable when something looks wrong, and the adjustment persists as code for
all 12 channels rather than as a one-off tweak.

**4.3.1** — Only design constants go in `visualControl()`. Never slot
coordinates (those are derived), never per-video values (those are data).

---

# PART 5 — DETERMINISTIC TEXT AND OUTPUT

Text is where "automated" usually degrades into "misaligned," because string
length varies per video and nothing in the current code accounts for it.

## 5.1 The font gate

`measureText()` results are cached and duplicate calls return the cached
result — which means **a measurement taken before fonts load is cached wrong
for the whole render.** Remotion's rule is to only call measurement functions
after fonts are loaded, and to pass `validateFontIsLoaded: true` so the call
throws if the font isn't ready rather than silently returning fallback metrics.

**Rule 5.1** — Every `measureText()` call in this system passes
`validateFontIsLoaded: true`. The existing `wait-for-fonts.js` must resolve
before compile, not before render.

**Rule 5.2** — Measurement and render must use **identical** font properties.
Remotion's guidance is to define one `fontStyle` object and spread it into both
`measureText()` and the element's `style`. Any divergence — a letter-spacing
set in CSS but not in the measurement — produces exactly the kind of
1-to-10 px misalignment that reads as sloppy.

## 5.2 Fitting

`fitText()` returns the optimal font size for a given width; cap it rather than
using it raw.

```js
const { fontSize } = fitText({ text, withinWidth: rect.w, fontFamily, fontWeight: '800' });
const size = Math.min(fontSize, fit.maxSize);   // 84 for headline
```

If `size < fit.minSize` (64), fall to two lines via `fillTextBox()`, which
reports `exceedsBox` as words are added against a `maxBoxWidth` and `maxLines`.
If it still exceeds, truncate at the last sentence boundary. **Never let text
overflow; never let it shrink below the Remotion floor of 84 px headline /
44 px supporting.**

## 5.3 Line-count-aware slots

Because the compiler knows the line count before render, the `headline` slot
publishes its occupied height, and the caption compiler uses it to decide
whether a 2-line caption may grow upward (§3.7). This is the kind of
cross-element constraint that is impossible with emergent flex layout and
trivial with a compile step.

## 5.4 No borders on measured elements

Remotion's own measuring rule: avoid padding and border, and use `outline`
instead of `border` to prevent layout differences. All chips and panels in this
system use `outline` for their 2 px edge.

## 5.5 The DOM confirmation probe

The compiler already knows every rect, so browser measurement is a *check*,
not a source of truth.

An audit-only composition wraps each `<Layer>` with a ref and reads
`getBoundingClientRect()`. Remotion applies a `scale()` transform to the video
container which affects those values, so every measurement must be divided by
`useCurrentScale()`:

```tsx
const scale = useCurrentScale();
const rect = ref.current.getBoundingClientRect();
const measured = { w: rect.width / scale, h: rect.height / scale };
```

Compare `measured` against the compiled rect. Tolerance **±2 px**. Anything
larger means CSS is fighting the compiler and the offending style is removed.

*(Verify against the installed version how browser output is surfaced from
`renderStill()` before wiring this into CI — the probe's value doesn't depend
on the transport, and the static check in §4.1 R4 catches most of it anyway.)*

## 5.6 Encoder settings — the "why does it look soft" fix

Because `remotion.config.js` is inert on the SSR path (§0.10), **every quality
option must be passed to `renderMedia()` explicitly**:

```js
await renderMedia({
  composition, serveUrl, outputLocation, browserExecutable,
  codec: 'h264',
  audioCodec: 'aac',
  enforceAudioTrack: true,
  imageFormat: 'png',                       // lossless intermediates
  crf: 16,                                  // below the h264 default
  pixelFormat: 'yuv420p',                   // required for wide playback
  chromiumOptions: { gl: 'angle' },         // NOT via the config file
  concurrency: 2,
});
```

**5.6.1 — `imageFormat: 'png'` is the important one.** Flat colour fields with
hard-edged type are the worst case for JPEG: ringing around glyph edges and
blocking in large flat areas. PNG intermediates cost render time and disk and
remove that entirely. This is a direct cause of "looks low quality" that has
nothing to do with design.

**5.6.2** — Delete `remotion.config.js` or reduce it to Studio-only concerns,
with a comment stating it does not affect `render.js`. Leaving inert config
next to a live render path is how the next person loses an afternoon.

---

# PART 6 — THE VERIFICATION LOOP

Three tiers. Tier 1 needs no browser. Tier 2 needs one still. Tier 3 is the
only one that renders video.

## Tier 1 — Spec lint (Node, milliseconds, runs on every build)

Operates on `ResolvedFrame[]`. No rendering.

| # | Check |
|---|---|
| L1 | Every rect lies inside its slot |
| L2 | Every slot lies inside the safe rect |
| L3 | Every x, y, w, h is a multiple of 8 (±4 rounding recorded) |
| L4 | No two non-persistent rects overlap in the same frame range |
| L5 | Every text rect has a measured size and a resolved `fontSize` |
| L6 | No `fontSize` below 84 (headline) / 64 (caption) / 44 (support) |
| L7 | Exactly one `accent` role per frame |
| L8 | Bar bottoms == axis y, exactly (guards 0.3 from ever returning) |
| L9 | Chart gutters equal within 1 px (guards 0.5) |
| L10 | Axis label right edge is 12 px from gridline start (guards 0.4) |
| L11 | Every beat has ≥1 layer and ≤5 layers |
| L12 | No layer's `atFrame` resolves outside `[0, durationInFrames]` |

L8–L10 exist because those are the three defects that produced the current
look. **A verification suite should encode the bugs you actually had.**

## Tier 2 — Still probe (one `renderStill()` per archetype)

Render one still per archetype at its anchor frame. Run the DOM probe (§5.5).
Assert measured == compiled within ±2 px. Assert no element's bounding box
crosses the safe rect.

**Twelve stills — one per archetype per format — cover the layout surface of
all 12 channels.** Run this on every code change; it is seconds, not minutes.

## Tier 3 — Frame QA (contact sheet, per video)

ffmpeg contact sheet at 1 frame every 15. Checks:

| # | Check |
|---|---|
| F1 | ≥4 visually distinct frames per 10-second span |
| F2 | Frame 0 and final frame match for loop quality |
| F3 | No frame is >92% single-colour (catches empty/black frames) |
| F4 | No frame contains a bounding-box overflow of the safe rect |
| F5 | Text edge sharpness: no ringing halo (regression test for 5.6.1) |

**6.1 — The self-correction loop.** When Tier 1 or 2 fails, the failure names
the beat, the role, and the constraint. That is a machine-actionable
instruction — *"b07 headline resolved to fontSize 58, below the 64 floor"* —
which the pipeline can act on by re-fitting or shortening the text and
recompiling, without a render and without a human. Only Tier 3 failures need a
person.

This is the "recheck if it looks right" mechanism: it works because the layout
is declared, so "right" is a computable property rather than an opinion.

---

# PART 7 — THE DELETE LIST

**Updated 2026-08-06 to match the current source.** Items D1–D7 and D10 from
the first draft are **already cleared** (see Part 0) and are not listed. These
are the deletions that are still live. Delete them. Do not refactor them.

| # | Delete | File | Why |
|---|---|---|---|
| D1 | Every `display: flex` between siblings in Stage/Headline/Caption | `motion-graphics.jsx` (`CaptionLayer`, `HeadlineBox`, `ListRunScene`), `minimal.jsx`, `cinematic-documentary.jsx` | the root cause (Part 1); replaced by `Layer.jsx` rects |
| D2 | `chunkVoiceover()` | `render.js:118`, `verify-compositions.js:38` | word-count chunking that ignores phrase boundaries and SRT timing |
| D3 | `remotion.config.js` (or reduce to Studio-only + a comment) | `remotion.config.js` | inert on the SSR render path (§0.10) |
| D4 | Radial gradients and vignette overlay used as the main background | `minimal.jsx:57-71`, `cinematic-documentary.jsx` (`Vignette`, `SectionBackground`) | decoration spending the accent budget; rebuild on the slot model |
| D5 | `minimal.jsx` `MinimalSections` in full | `minimal.jsx:73` | text on a gradient; rebuild on the slot model |
| D6 | ~~The generated-entry-file `inputProps` workaround~~ — **CLEARED 2026-08-06** | ~~`render.js:243-269`, `verify-compositions.js:126-148`~~ | verified on 4.0.505: `inputProps` reaches the component and `durationInFrames` override works; entry files and `writeRenderEntry()` deleted |
| D7 | `sectionDuration = durationInFrames / sections.length` time-slicing | `minimal.jsx:75` | ignores audio; replaced by SRT-derived timing |

**7.1** — D1, D2, D4, D5, D7 are all the same species as before: *inferring
structure at render time*. D2 infers phrasing by word count, D7 infers timing
by proportional slicing. Structure and timing come from the Shot Spec / SRT
now. Nothing in a composition parses a sentence or divides a timeline.

---

# PART 8 — RESTRUCTURE

## 8.1 Target tree

```
src/skills/remotion-render/
├── layout/
│   ├── slots.js            # Part 3 tables. Pure data.
│   ├── compile.js          # Part 4. Pure layout math, Node. No measurement (browser-fed).
│   ├── measure.js          # measureText/fitText/fillTextBox wrappers + font gate
│   └── lint.js             # Tier 1 checks L1–L12
├── spec/
│   ├── schema.js           # Shot Spec type + validator
│   ├── fromBeats.js        # Beat[] → ShotSpec[]
│   └── toEnglish.js        # ShotSpec[] → .shots.txt review artifact
├── layers/
│   └── Layer.jsx           # rect + enter/exit. The ONLY positioning component.
├── primitives/
│   ├── Chart.jsx  Node.jsx  Chip.jsx  Rule.jsx  Panel.jsx  Icon.jsx
├── beats/
│   ├── HeroNumber.jsx  TermDefine.jsx  ListItem.jsx  Contrast.jsx
│   ├── Progress.jsx    Relation.jsx    ImageBeat.jsx  Statement.jsx
├── styles/
│   ├── motion-graphics.jsx    # composes Layer + beats. No layout math.
│   ├── minimal.jsx
│   └── cinematic-documentary.jsx
├── audit/
│   ├── Probe.jsx           # §5.5 DOM confirmation
│   └── stills.js           # Tier 2 runner
├── captions/
│   ├── fromSrt.js          # parseSrt → createTikTokStyleCaptions → pages
│   └── CaptionLayer.jsx    # MOTION-GRAPHICS-MANUAL Part B
├── Root.jsx                # registers styles + every beat archetype separately
└── render.js               # explicit renderMedia options (§5.6)
```

**8.2 — `Root.jsx` registers each beat archetype as its own `<Composition>`.**
Remotion's multi-scene rule recommends registering scenes individually in the
root file so a sequence can be double-clicked to jump to that composition, and
recommends inlining `durationInFrames` so it stays editable. With 8 archetypes
× 2 formats, that's 16 extra compositions — and it means any archetype can be
opened, scrubbed, and tuned in isolation, which is the closest thing to an
editor inspector available without buying one.

**8.3 — Every layout number lives in `layout/slots.js` and nowhere else.**
Grep for a bare integer in `styles/` or `beats/` and it should return nothing
but frame counts.

## 8.4 Build order

| # | Step | Verifiable by |
|---|---|---|
| 0 | ~~Version fix: align render subpackage to `remotion@^4.0.503` + React 19; add `@remotion/captions`, `transitions`, `paths`, `shapes`, `layout-utils`, `effects`; delete the entry-file workaround (Part 7 D6)~~ — **DONE 2026-08-06** | `inputProps` reaches the component (green probe) + duration override renders 30 f / 1.0 s |
| 1 | ~~`layout/slots.js` + `layout/lint.js`~~ — **DONE 2026-08-06** | `npm run lint:layout` — L1–L3 pass on 12 hand-written fixtures; the lint also catches the first-draft caption slots (§3.1.1) |
| 2 | ~~`spec/schema.js` + `spec/toEnglish.js`~~ — **DONE 2026-08-06** | `npm run lint:spec` — 15 checks; the Part 2.1 fixture validates and renders to `.shots.txt` |
| 3 | `layout/measure.js` with the font gate | `measureText` throws on an unloaded font |
| 4 | `layout/compile.js` | L1–L12 pass on all 3 existing scripts |
| 5 | `layers/Layer.jsx` + `primitives/` | Tier 2 stills within ±2 px |
| 6 | `beats/Progress.jsx` first | L8, L9, L10 pass — the three chart bugs |
| 7 | Remaining 7 archetypes | 16 compositions render as stills |
| 8 | `captions/` | caption gates from MANUAL Part H |
| 9 | `styles/motion-graphics.jsx` | one full Short, Tier 3 |
| 10 | Apply the delete list in full | grep confirms Part 7 D1–D7 gone |
| 11 | `minimal` + `cinematic-documentary` on the same spine | Tier 3 per style |
| 12 | Matrix rollout | — |

**8.5** — Steps 1–2 require no browser and no render (compile.js itself
stays Node-pure; its measurement input comes from the browser step 3). Roughly
half the work here is verifiable in milliseconds, which is the whole point of
moving layout out of the DOM.

---

# PART 9 — WHY THIS READS AS EDITED RATHER THAN GENERATED

The audit and the published craft literature agree on the same short list, and
it's worth naming what each rule in this document is actually buying.

Practitioners are consistent that <cite index="132-1">a consistent colour palette and grid across every scene is one of the handful of habits separating good motion graphics from great, and that great motion graphics is not about flashy effects but about clarity, timing, and a story that holds together, built by editors who plan before they animate</cite>. The failure mode is equally consistently described: <cite index="127-1">inconsistently applied visual elements — colour schemes, typography, graphic styles — make motion graphics look unprofessional, disjointed, or confusing, and the remedy is a style guide that is actually adhered to</cite>, using <cite index="127-1">contrast, hierarchy, and alignment to create visual order</cite>.

And on why the current output feels wrong without an obvious culprit:
<cite index="135-1">alignment isn't about making things look straight — it's about flow, order, and professionalism; designers correct it with grid systems, aligning elements to improve readability and balance, and viewers might not notice perfect alignment, but they'll feel it</cite>. That is precisely the class of error the re-audit still finds in §0.12 — content-measured captions, emergent list chips, and a declared grid that nothing snaps to: individually unnameable, collectively the whole impression.

Mapping that to what's specified here:

| Reads as amateur | Cause found in this repo | Fixed by |
|---|---|---|
| Inconsistent spacing | declared grid that nothing enforces, content-measured text | §3 slot table, §4 R1/R4, 8 px grid |
| Things not aligned to each other | emergent flex layout in caption/headline/list/minimal/cinematic | §4 compiler, Tier 1 L1–L4 |
| Elements colliding with UI | Shorts safe rect unknown to minimal + cinematic | §3.1, L2, F4 |
| Text of random sizes / overflowing | no measurement | §5.1–5.3 |
| Soft or ringing type | JPEG intermediates, no CRF | §5.6.1 |
| Nonsense on-screen words | regex/proportional inference at render time | Part 7 D2, D7 |
| Everything moving at once | always-animated rail + kicker furniture | D1, one-primary-mover |
| Colour used decoratively | accent spent on rail/kicker/active-token at once | L7 |

**9.1 — The non-negotiable:** the thing that makes output look machine-made is
not that a machine made it. It's that the machine was *guessing* — inferring a
headline from a regex, letting flexbox decide where a bar lands, hoping a
percentage grid reads as a grid. Every guess in the pipeline is replaced here
by a declared value that is checked before a frame is drawn.

---

# PART 10 — SOURCES

**Remotion (first-party):**
`remotion.dev/docs/config` and `remotion.dev/docs/renderer` — the configuration
file has no effect when using the SSR / renderer APIs ·
`remotion.dev/docs/gl-options` — the config file only applies to CLI commands;
pass `chromiumOptions.gl` to `renderMedia()` ·
`remotion.dev/docs/studio/visual-control` — `visualControl()` renders a named
sidebar control and saves the value back to source; the first argument must be
static · `remotion.dev/docs/visual-editing` — saving default props back to code ·
`remotion.dev/docs/editor-starter/` and `/docs/timeline/` and
`/docs/buy-a-video-editor` — the drag-and-drop canvas and zoomable timeline are
separate licensed products · `remotion.dev/docs/ssr-node` ·
`remotion.dev/docs/4-0-migration` (`imageFormat` naming) ·
`github.com/remotion-dev/skills` → `remotion-markup/measuring-dom-nodes.md`
(`useCurrentScale()` division), `remotion-markup/measuring-text.md`
(`measureText` caching, `validateFontIsLoaded`, matching font properties,
`outline` over `border`, `fitText`, `fillTextBox`),
`remotion-markup/multi-scene-video.md` (per-scene compositions, inlined
durations), `remotion-markup/SKILL.md` and `remotion-markup/timing.md`
(inline `interpolate()` in `style`, individual transform properties),
`remotion-create/video-layout.md` (80 px side / 100 px vertical floors, 84 px
headline / 44 px supporting minimums)

**Third-party, on Remotion Studio's actual scope:**
`iconpolls.com/blogs/remotion-review-2026-...` — Studio is a development tool,
not a drag-and-drop editor

**Craft:**
`filmbaker.com/blog/5-motion-graphics-mistakes-video-editors-make...` —
consistent palette and grid across scenes; planning over effects ·
`linkedin.com/advice/0/what-common-mistakes-avoid-motion-graphics-design...` —
inconsistent style reads as unprofessional; contrast, hierarchy, alignment ·
`dev.to/riyasharma312/how-a-graphic-designer-can-correct-common-design-mistakes` —
viewers feel alignment rather than notice it

**In-repo, audited (2026-08-06 re-run):**
`src/skills/remotion-render/compositions/motion-graphics.jsx` ·
`minimal.jsx` · `cinematic-documentary.jsx` · `beats.js` · `mg-package.js` ·
`mg-style.js` · `render.js` · `render-entry.jsx` · `verify-compositions.js` ·
`verify-entry.jsx` · `remotion.config.js` · `config/channels.json` ·
`data/scripts/ch-01/movile-cave-shorts-script.json`

**Companion documents:**
`MOTION-BLUEPRINT.md` (beat timing, safe rect derivation, transition budget) ·
`MOTION-GRAPHICS-MANUAL.md` (design system, captions, icons, movement, VO
relation) — **note the correction to its §A6.2 recorded in §0.10 above.**
