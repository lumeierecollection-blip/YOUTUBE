# MOTION BLUEPRINT — Remotion Render Spec

**Repo:** `lumeierecollection-blip/YOUTUBE`
**Applies to:** `src/skills/remotion-render/compositions/*` (all three styles)
**Supersedes:** `.opencode/skills/remotion-render/MOTION-GRAPHICS-RULES.md`
(that doc covers the *motion-graphics* style only, and describes scenes the
renderer almost never actually reaches — see §0)
**Status:** spec, not yet implemented. §11 is the build order.

Every number in this document is traceable to a source in §12. Nothing here is
an invented aesthetic preference. Where sources disagree (safe zones do), the
disagreement is stated and the conservative value is used.

---

## §0 — Diagnosis: why it currently renders as words on a background

This is not a taste problem. Four specific mechanisms in the current code
produce "text on a gradient." All four are verifiable in the repo.

**0.1 — One scene per section, evenly divided.**
`motion-graphics.jsx:766` and `minimal.jsx:75` both compute:

```js
const sectionDuration = Math.floor(durationInFrames / Math.max(sections.length, 1));
```

A 45-second Short with 5 sections gives each section **270 frames (9 seconds)**.
Every scene animates its elements in over roughly 8–20 frames, then holds a
frozen frame for the remaining ~250. That is **93% static screen time**. No
amount of nicer easing fixes this; the timing model is the bug.

**0.2 — `pickScene()` falls through to `statement` on real scripts.**
`motion-graphics.jsx:98-106` routes on `animationCue` / `visualCue` keywords.
But of the six script-writer templates, only `motion-graphics*.js` emit an
`animation_cue` at all, and only on one section. Every
`cinematic-documentary` and `minimal` script — which is 44 of the 50 channels
in `config/channels.json` — arrives with no cue the router recognises. So
`pickScene` returns `"statement"`, and `StatementScene`
(`motion-graphics.jsx:726`) is: one icon, one headline, three dim text lines.
That is literally "only words." The chart, flow, and composite scenes exist in
the file and are effectively dead code in production.

**0.3 — `minimal.jsx` has no graphic layer at all.**
20 of 50 channels are on `style: "minimal"`. `MinimalSections` renders a
gradient `AbsoluteFill` and up to five `AnimatedCaption` divs. There is no
shape, no icon, no image, no chart. The style is text-only by construction.

**0.4 — The word-timing data exists and is thrown away.**
`data/tts/**/*-vo.srt` files are generated and `src/utils/captions.js` contains
a working `parseSRT()`. No composition imports it. Instead
`render.js:113` chunks the voiceover by naive word count:

```js
for (let i = 0; i < words.length; i += maxWords) chunks.push(...)
```

Those chunks all appear at the section's start frame. So on-screen text is
never synchronised to the spoken word — it drifts further out with every
section. Meanwhile `section.bRollFiles` is resolved in `render.js:285`, passed
into props, and **read zero times** in `motion-graphics.jsx`. `sfxCue` is
normalised at `render.js:133` and read zero times in every composition.

**0.5 — Blocking dependency conflict.**
Root `package.json` declares `remotion@^4.0.503` + React 19.
`src/skills/remotion-render/package.json` pins `remotion@4.0.0` + React 18.
`render.js:12-14` even carries a comment that `inputProps` doesn't reach the
component "in the installed Remotion 4.0.0," and works around it by baking
props into a generated entry file.

That pin is why none of the fixes below are currently reachable:
`@remotion/captions` (which provides `parseSrt()` and
`createTikTokStyleCaptions()`) <cite index="47-1">landed as a package providing a standard Caption shape, SRT parsing, and TikTok-style caption pagination</cite>, and <cite index="48-1">native subtitle support arrived in Remotion v4.0.216</cite> — after the pinned version.
`@remotion/transitions` and `@remotion/rough-notation` are likewise unavailable.

**Fix 0.5 first. Nothing else in this document can be built on 4.0.0.**

---

## §1 — The timing spine (the core rule)

> **A section is not a scene. A section is a container of beats.**

Replace the "one scene per section" model with a **beat timeline**. A beat is
the smallest unit of visual change: a new element, a layout shift, a value
landing, a push-in, a color change, a cut.

### 1.1 Beat cadence

Published short-form pacing guidance converges tightly:

| Source | Recommendation |
|---|---|
| Opus.pro | <cite index="31-1">cuts every 2–4 seconds for visual variety; high-performing Shorts average one cut every 2–4 seconds</cite> |
| Aibrify | <cite index="33-1">treat every 1.5–2 seconds as a retention checkpoint; target 5–7 visual changes per 10 seconds — below 4 reads as slow, above 8 reads as noise</cite> |
| MotionEdits | <cite index="34-1">something visually meaningful happens every 3 to 5 seconds, purposefully designed rather than random</cite> |

**Rule 1.1 — At 30 fps, emit a beat every 45–90 frames (1.5–3.0 s).**
Target 5–7 beats per 300 frames. Under 4 per 300 frames fails the gate in §10.

Critically, a beat does **not** have to be a hard cut. <cite index="33-1">A text overlay replacement, a zoom, a color shift, or a reveal all reset the viewer's attention cycle — the target is stimulus density, not edit count, and a slow push-in can substitute for a cut if it delivers equivalent visual change.</cite>
This is what makes the rule implementable in Remotion without needing footage.

### 1.2 Where beats come from

Beats are **derived from the SRT**, not from section indices. Pipeline:

```
data/tts/<ch>/<slug>-vo.srt
  → parseSrt()                    (@remotion/captions)
  → Caption[]                     {text, startMs, endMs, timestampMs}
  → createTikTokStyleCaptions()   → TikTokPage[]  {text, startMs, tokens, durationMs}
  → beat boundaries               = page boundaries, merged to ≥45f, split at >90f
```

<cite index="53-1">`createTikTokStyleCaptions()` segments tokens into "pages," where a high `combineTokensWithinMilliseconds` fits many words per page and a low value produces word-by-word animation.</cite>
<cite index="48-1">Tested values: 1200–2000 ms gives multiple words per page and suits educational content; 200–500 ms gives classic word-by-word.</cite>

**Rule 1.2 — Set `combineTokensWithinMilliseconds: 1200` for all narrated
channels.** These are 140–150 WPM explainer scripts, not product demos. Drop
to 600 only for the hook section, where density is a feature.

**Rule 1.3 — Beat boundaries are audio-derived. Never section-index-derived.**
This alone fixes the drift where visuals for section 2 are still on screen
while section 3's voiceover plays.

### 1.3 Motion duration tokens

Material's motion system publishes explicit duration slots, from
<cite index="19-1">50 ms (short1), 100 ms, 150 ms, 200 ms (short4), 250 ms (medium1), 300 ms, 350 ms, 400 ms (medium4), 450 ms, up to 500 ms (long2)</cite>.
In practice, <cite index="14-1">Material suggests 150–200 ms for small elements and up to 400 ms for larger ones, and Microsoft's Fluent 2 recommends 100 ms for micro-interactions up to 500 ms for complex motion</cite>.

Converted to frames at 30 fps, this is the **only** duration table the
compositions may use:

```js
export const D = {
  micro:   4,   // 133ms — accent flash, counter tick, chip pop
  short:   6,   // 200ms — small element entrance (icon, label, dot)
  base:    9,   // 300ms — standard entrance (text line, bar, node)
  large:  12,   // 400ms — large element (headline, panel, chart frame)
  complex:15,   // 500ms — full layout shift, scene furniture rebuild
  push:   60,   // 2.0s  — slow camera push / Ken Burns, ONE at a time
  hold:   45,   // 1.5s  — minimum on-screen time for readable text (§3.3)
};
```

<cite index="12-1">Material's own guidance: adjust each duration to the distance travelled and the element's change in surface area rather than using a single duration everywhere; objects leaving the screen may use shorter durations since they need less attention.</cite>

**Rule 1.4 — Exits are one token faster than entrances.** A `base` (9f)
entrance exits in `short` (6f).

### 1.4 Easing

Remotion's own guidance is explicit and should be followed literally:

- Linear is the default for `interpolate()` and must always be overridden. <cite index="2-1">The `easing` option customises the input; by default the input is unmodified, resulting in pure linear interpolation.</cite>
- **Push with no bounce:** `Easing.spring({damping: 200})`
- **Standard decelerate:** `Easing.bezier(0.16, 1, 0.3, 1)`
- **Always clamp:** <cite index="2-1">without `extrapolateLeft`/`extrapolateRight` set to `'clamp'`, values keep growing past the input range</cite>
- **Scale animations must compensate for perception.** Remotion's timing rule states that with linear scale output, perceived scale change shrinks as the scale grows; pass `output: 'perceptual-scale'` on every scale interpolation.
- For bouncy entrances use `spring()` directly. <cite index="6-1">The default spring config overshoots slightly before settling; increase `damping` to remove the bounce.</cite>

**Rule 1.5 — No `interpolate()` call ships without an `easing` and both
`extrapolate` clamps. No scale interpolation ships without
`output: 'perceptual-scale'`.**

**Rule 1.6 — One primary mover per beat.** The hero element animates first,
largest, and unopposed — no element animates with the same motion at the same
time. Secondary elements stagger `D.micro` (4f) behind it and may overlap the
primary’s animation (offsets shorter than the animation duration; `D.micro` = 133 ms
sits inside equal.design’s 80–150 ms related-items bracket, while per-item sequences
use tighter ranges — Material ≤20 ms per item, designsystems.one 40–80 ms, UI Craft
30–80 ms). Never three elements moving the same way at the same time.

---

## §2 — Frame geometry and safe zones

All Shorts are 1080 × 1920. **The sources disagree on safe-zone margins and
this must be handled honestly, not averaged.**

Two sources trace their numbers to Google's published vertical safe-zone
overlay for advertisers:
<cite index="20-1">keep text and visuals 288 px from the top, leave 672 px free at the bottom, and use 48 px left and 192 px right</cite>, giving <cite index="21-1">an 840 × 960 px safe area positioned upper-centre, starting 288 px from the top and 48 px from the left — with the caveat that the bottom margin grows on devices with a Dynamic Island or when a viewer expands the description, so the 672 px figure reflects the collapsed state and critical content should sit at least another 100 px above that line</cite>.

Third-party tools publish looser numbers — <cite index="22-1">roughly 888 × 1500 with ~120 px top, ~300 px bottom, ~96 px right, growing to ~400 px bottom when the description is expanded</cite>, and <cite index="26-1">~180 px top, ~350 px bottom, ~120 px right, ~40 px left</cite>.

The looser numbers are what the player usually looks like. The Google numbers
are what it can look like. **Design to the Google numbers.**

**Rule 2.1 — Hard safe rect (all critical content):**

```js
export const SAFE = { top: 288, bottom: 1248, left: 48, right: 888 };
// usable: 840 × 960, upper-centre biased
```

**Rule 2.2 — Nothing below y=1248.** No CTA, no channel name, no caption. The
end-screen `SUBSCRIBE` pill in `EndScene` is currently vertically centred,
which is fine, but the channel-name block must not drift below this line.

**Rule 2.3 — The right column is 4× the left.** <cite index="21-1">Do not centre horizontally by eye; the right margin (192 px) is four times the left (48 px).</cite> Optical centre for a Short is therefore **x = 468**, not 540. Charts, hero numbers, and flow diagrams must be composed around 468.

Remotion's own layout rule is looser but consistent in direction: for
1080-wide compositions, keep key text at least 80 px from the sides and 100 px
from top and bottom. Where the two conflict, §2.1 wins for Shorts; Remotion's
rule governs the 1920×1080 longform compositions.

---

## §3 — Typography

### 3.1 Minimum sizes

Remotion's video-layout rule gives rough minimums for a 1080-wide
composition: **main headline 84 px, important supporting text 44 px**, scaled
with composition width.

The current code already scales via `u = Math.min(width, height) / 1080`, so
these become:

```js
export const TYPE = {
  hero:      220,  // hook number / single-word payoff
  headline:   84,  // Remotion minimum — do not go below
  body:       52,
  support:    44,  // Remotion minimum for supporting text
  kicker:     28,  // section label, all caps, tracked
};
```

The existing `StatementScene` uses `46 * u` for its headline and `28 * u` for
support lines. **Both are under the minimum.** On a 6-inch phone that headline
is roughly half the size it needs to be. Raise to `84 * u` / `44 * u`.

### 3.2 Words per beat

<cite index="37-1">Keep line length short — typically 3–7 words per beat — so viewers can read instantly, with high-contrast text at consistent sizes inside safe margins.</cite>
<cite index="38-1">Aim for 1–2 lines, break phrases into logical chunks to reduce eye travel, and keep most moments to one core idea on screen — usually 5–12 words. For complex topics, break information into multiple quick screens rather than one dense paragraph.</cite>

**Rule 3.1 — Max 7 words per beat. Max 2 lines. One idea per beat.**
This replaces `chunkVoiceover`'s fixed word-count chunker, which splits
mid-phrase.

### 3.3 Minimum on-screen time

<cite index="39-1">Comfortable reading is roughly 180–220 words per minute (about 3–4 words per second); a seven-word line typically needs 1.8–2.5 seconds on screen, and a practical display-time formula is seconds = (characters ÷ 12) + 0.5, rounded up to the nearest 0.25 s to align with beats. Broadcast subtitle standards are tighter: Ofcom and BBC publish 160–180 wpm (Ofcom: pre-recorded "should not normally exceed 160 to 180 words per minute"; above 200 "difficult for many viewers"), ITC caps at ≤140 wpm (180 exceptional), and DCMP’s caps are content-tiered (120–160 wpm standard, 225–235 wpm adult theatrical) — so D.hold is a conservative minimum floor, not a reading duration.</cite>

**Rule 3.2 — Implement that formula directly:**

```js
const holdFrames = (text, fps) =>
  Math.max(D.hold, Math.ceil(((text.length / 12 + 0.5) * fps) / 7.5) * 7.5);
```

Never less than `D.hold` (45f / 1.5s). This is the constraint that caps beat
density — if the formula wants more time than the SRT page allows, shorten the
text, don't speed up the read.

### 3.4 Emphasis budget

<cite index="40-1">A practical range for a 20–30 second video is 5–8 text beats: one hook, 2–4 main points, one warning or contrast, and one closing takeaway. Too many animated elements distract and lower retention. View rates improve most when captions are readable, well-timed, and paired with selective kinetic emphasis rather than constant motion on every word.</cite>

**Rule 3.3 — Accent colour is applied to at most one token per beat**, and to
no more than 8 tokens across a 45-second Short. Everything else is
`textPrimary` or `textDim`. The current palette resolution
(`compositions/visual.js`) already gives a 3-colour palette per channel; the
accent is a scarce resource, not a default.

**Rule 3.4 — Never stretch, warp, or skew type.** Text animates by opacity,
translate, scale, and clip only.

### 3.5 Contrast

<cite index="38-1">Use clean screen sans-serifs, avoid thin weights and overly condensed styles, and guarantee contrast with one of: a solid background pill behind the text, a drop shadow with subtle blur, a stroke/outline, or a gradient panel when the background is busy.</cite>

**Rule 3.5 — Any text over b-roll or a gradient gets a stroke or a scrim.**
Never rely on the image being dark enough. `cinematic-documentary.jsx` already
darkens for captions; `minimal` and `motion-graphics` must do the same once
imagery lands.

### 3.6 Safety

<cite index="39-1">Avoid flashing text or background changes more than three times per second, especially at large screen coverage, to mitigate seizure risk. Use light motion-blur samples on large type, but disable blur on small type where it smears thin strokes.</cite>

**Rule 3.6 — Hard cap: no more than 3 full-frame luminance changes per
second.** This bounds the `ColorWipe` component and any future strobe/flash.

---

## §4 — What actually goes on screen

The master rule from the existing rules doc is correct and is kept:
**every animated element must explain the script, not decorate it.** What
follows is the vocabulary that makes it possible to satisfy §1.1's beat
cadence without a stock-footage library.

### 4.1 Beat archetypes

Each beat resolves to exactly one archetype. Every style implements all of
them; only the visual treatment differs.

| Archetype | Trigger | Screen content | Beat length |
|---|---|---|---|
| `HERO_NUMBER` | beat contains a numeral or magnitude | numeral at `TYPE.hero`, counts up, unit label lands after | 60–90f |
| `TERM_DEFINE` | beat introduces a named entity/term | term at `TYPE.headline`, rule draws under it, gloss fades in | 45–60f |
| `LIST_ITEM` | beat is item *n* of an enumeration | numbered chip springs in, prior items dim to `textDim` and shift up | 45f |
| `CONTRAST` | beat contains *but / however / instead / versus* | split frame, left holds, right slides in, divider draws | 60–75f |
| `PROGRESS` | beat describes change over time | axis draws, then bar/line draws, value counts alongside | 75–90f |
| `RELATION` | beat links two ideas | two nodes present, connector draws between them | 60f |
| `IMAGE_BEAT` | beat has a resolved `bRollFile` | image at 105% scale, slow push to 100%, scrim + caption | 60–90f |
| `STATEMENT` | fallback | headline + supporting line, icon, kicker | 45–60f |

**Rule 4.1 — `STATEMENT` may not exceed 30% of beats in a video.** If it
does, the beat classifier failed and the render is rejected by §10. This is
the direct guard against the §0.2 failure, where `statement` was 100%.

**Rule 4.2 — No archetype may repeat more than twice consecutively.**
This encodes the pacing warning that predictability, not speed, is what kills
retention: <cite index="30-1">retention falls off when the rhythm becomes predictable too quickly — same shot duration, same movement pattern, same callout structure — and after roughly eight or nine seconds viewers subconsciously map the structure and attention gets slippery.</cite>

### 4.2 The classifier

Beat → archetype is decided by a **pure function over the beat's own text**,
not over `animation_cue`. This is deliberate: §0.2 showed that cue-based
routing fails on 44 of 50 channels because most templates never emit cues.

```js
classifyBeat(beatText, ctx) → archetype
```

Priority order: `HERO_NUMBER` > `CONTRAST` > `PROGRESS` > `LIST_ITEM` >
`RELATION` > `TERM_DEFINE` > `IMAGE_BEAT` > `STATEMENT`.
`ctx` carries the previous two archetypes so Rule 4.2 can be enforced at
classification time by demoting to the next-priority match.

`animation_cue`, when present, **upgrades** a classification. It never
downgrades one and is never required.

### 4.3 Persistent scene furniture

Between beats, the frame must not be empty and must not fully rebuild.

- **Kicker** (top-left, inside `SAFE`): `01 · THE OVERVIEW`. Persists for the
  whole section. Animates only on section change.
- **Progress rail** (left edge, x=48, inside `SAFE`): a thin vertical rule
  that fills across the video's duration. Gives the viewer a completion cue.
- **Background:** flat channel `bg` + one low-opacity texture (dot grid). The
  existing `GridBackground` is correct and should be kept. The
  simultaneously-breathing 520px ring should be removed — it competes with
  the focal element and violates Rule 1.6.

**Rule 4.3 — Furniture never animates during a content beat.** It changes
only at section boundaries.

### 4.4 Imagery is mandatory for two styles

`cinematic-documentary` already consumes `section.bRollFiles`.
`motion-graphics` reads it zero times and `minimal` has no image path.

**Rule 4.4 — `minimal` and `motion-graphics` must implement `IMAGE_BEAT`.**
A style with no imagery cannot hit the beat cadence in §1.1 without becoming
noise. `broll.js` already resolves manifest entries to local files; the
compositions simply need to use them. Note the historical Pixabay CDN
rate-limit failure recorded in the project bible: images must be
pre-downloaded to local paths before render, never fetched from remote URLs
during concurrent frame rendering.

---

## §5 — Transitions

Currently every `Sequence` is a hard cut, with `ColorWipe` firing at frame 0
of each section — an overlay, not a transition.

`@remotion/transitions` provides the correct primitive.
<cite index="9-1">Available timings are `springTiming()` and `linearTiming()`; available presentations include `fade()`, `pushCut()`, `slide()`, `wipe()`, `flip()`, `clockWipe()`, `iris()`, and `zoomBlur()`.</cite>
<cite index="7-1">`TransitionSeries` shortens the timeline because both scenes render simultaneously during the transition: with A at 40 frames, B at 60, and a 30-frame transition, total duration is 70, not 100.</cite>

That arithmetic matters — the current `computeDurationFrames()` derives total
frames from the measured voiceover length. **Transition overlap must be added
back into the total**, or the audio gets truncated.

Constraints, verbatim from the docs:
<cite index="7-1">a transition cannot be longer than the previous or next sequence; two transitions cannot be adjacent; two overlays cannot be adjacent; a transition and an overlay cannot be adjacent; and at least one sequence must exist before or after a transition.</cite>

**Rule 5.1 — Transition budget:**

| Boundary | Presentation | Timing | Frames |
|---|---|---|---|
| Beat → beat (same section) | none (hard cut) | — | 0 |
| Section → section | `wipe()` in accent | `linearTiming` | 12 (400ms) |
| Into close | `fade()` | `linearTiming` | 15 |
| Hook → section 1 | `pushCut()` | `springTiming` | 9 |

**Rule 5.2 — Add `Σ(transitionFrames)` back into `durationInFrames`.**

**Rule 5.3 — When using `springTiming()`, set
`durationRestThreshold: 0.001`.** <cite index="11-1">The default of 0.005 treats the animation as finished at 99.5% progress, which produces a slightly noticeable cutoff on transitions; the docs recommend 0.001, accepting a slightly longer animation.</cite>

**Rule 5.4 — No spinning, no 3D flips, no heavy parallax.** `flip()` and
`zoomBlur()` are available and are not to be used. This preserves the earlier
architectural decision to strip WebGL/Three.js in favour of pure CSS/SVG.

---

## §6 — Audio

`sfxCue` is normalised in `render.js:133` and read nowhere.
`src/audio/sfx-manifest.json` and the Kenney libraries are already vendored
and license-clear.

**Rule 6.1 — Every section-boundary transition carries one SFX hit.**
Use the local Kenney files, not remote URLs. (Remotion hosts a sound-effect
set at `remotion.media` for use via `<Audio>` from `@remotion/sfx`, but these
are mostly meme stings — `vine-boom`, `wilhelm-scream`, `windows-xp-error` —
and are wrong for this catalogue. The one exception worth pulling is
`whoosh.wav` for wipes.)

**Rule 6.2 — SFX map:**

| Event | Sound | Gain |
|---|---|---|
| Section wipe | `transitions/close_00n.ogg` | −18 dB |
| `HERO_NUMBER` counter settle | `ui/click_004.ogg` | −22 dB |
| `LIST_ITEM` chip | `ui/click_001.ogg` | −24 dB |
| End screen | one impact hit | −16 dB |

**Rule 6.3 — Max one SFX per beat.** Silence is the contrast that makes the
hits land.

**Rule 6.4 — Master to −14 LUFS integrated**, per the loudness standard
already established in the project bible. Note that a separate published
Shorts recommendation is <cite index="28-1">mixing dialogue to −3 dB and background music to −18 dB because mobile speakers are tinny</cite> — that is a peak/relative guide, not a replacement for the integrated LUFS target. Keep both: −14 LUFS integrated, VO peaks no higher than −3 dBFS, beds ~15 dB under VO.

---

## §7 — Per-style differentiation

The three styles must not converge. Same beat spine, different vocabulary.

### 7.1 `minimal` (20 channels)

The point is restraint, not absence. Currently it has absence.

- Background: flat `bg`, no gradient, no texture.
- Beats: `TERM_DEFINE`, `LIST_ITEM`, `HERO_NUMBER`, `STATEMENT` only.
  No charts, no flow diagrams.
- One geometric primitive per beat: a rule, a dot, a box, a bracket.
  `@remotion/rough-notation` is the right tool — it draws highlights, circles,
  underlines, strike-throughs, boxes, and brackets, with `progress` driven
  from `useCurrentFrame()` so it stays deterministic and frame-synced.
- Motion: translate + opacity only. No springs with overshoot.
  `Easing.bezier(0.16, 1, 0.3, 1)` everywhere.
- `IMAGE_BEAT`: full-bleed, desaturated, one per 3 beats maximum.

### 7.2 `motion-graphics` (12 channels)

- Full archetype set. This is where `PROGRESS` and `RELATION` earn their keep.
- The existing chart rules from `MOTION-GRAPHICS-RULES.md` §2 are sound and
  carry over unchanged: gridlines and axis labels draw *before* the bars,
  bars spring in with overshoot (`damping ~16, stiffness ~90`), stagger 3–5
  frames, values count up as bars grow, labels land after bars.
- The one change: those scenes must actually be *reached*. Under §4.2's
  text-based classifier they will be.
- Springs with visible overshoot are permitted here and only here.

### 7.3 `cinematic-documentary` (18 channels)

- Image-led. `IMAGE_BEAT` is the default, `STATEMENT` the exception.
- Ken Burns push: `D.push` (60f), 105% → 100%. Movement must be perceptible —
  the earlier audit found the push too slow to read as motion.
- Source images must exceed canvas resolution before render; upscaling below
  1080×1920 produces the blur already logged as a defect.
- Text: lower-third-style but raised above `SAFE.bottom`, always with scrim.
- No springs. Everything eases.

---

## §8 — The script contract

The renderer can only be as good as its input. `script-writer` must emit, per
section:

```jsonc
{
  "id": "section_2",
  "voiceover": "...",
  "beats": [                          // NEW — optional but authoritative
    { "text": "...", "archetype": "HERO_NUMBER", "value": 1980, "unit": "m" }
  ],
  "b_roll": ["...", "..."],           // must resolve via broll.js
  "sfx_cue": "...",
  "text_overlay": null | { "text": "..." }
}
```

**Rule 8.1 — `beats` is optional.** When absent, §4.2's classifier derives
them from the SRT. This is non-negotiable: the system must produce good video
from scripts that predate this spec, because 44 of 50 channels have such
scripts today.

**Rule 8.2 — `text_overlay` is an object in some templates and a string in
others.** `cinematic-documentary.jsx:354` renders `{section.textOverlay}`
directly as a React child; if an object arrives it throws. Normalise to
`{text}` in `render.js` and read `.text` in every composition.

**Rule 8.3 — Scripts must not carry style-specific colour values.**
`motion-graphics-shorts.js` currently interpolates `colors.bg` and
`colors.accent` into `visual_cue` prose. Colour belongs to
`config/channels.json` → `resolveColors()`. Remove it from the script layer.

---

## §9 — Renderer contract

```js
// compositions/beats.js  — NEW, shared by all three styles
parseSrtToBeats(srtText, fps, opts) → Beat[]
classifyBeat(text, ctx)             → Archetype
holdFrames(text, fps)               → number

// Beat
{ startFrame, durationInFrames, text, tokens, archetype, data }
```

Each composition maps `Beat[]` → `TransitionSeries`, one
`TransitionSeries.Sequence` per beat, archetype component inside.
Scene furniture (§4.3) sits *outside* the series in a parent `AbsoluteFill`
so it survives cuts.

Per Remotion's multi-scene rule, each archetype goes in its own file under
`compositions/beats/`, and `durationInFrames` values should be inlined rather
than computed so they remain editable in Studio. Registering individual
archetypes as their own compositions in `Root.jsx` also makes them
independently previewable — worth doing given how much of this is unverified.

---

## §10 — Acceptance gate

The project's standing rule already holds: never claim a visual change works
without a rendered frame. These are the automated checks that must pass before
a render is considered postable.

Static (parse the beat timeline, no render needed):

1. **Beat density** — every rolling 300-frame window contains ≥4 and ≤8 beats.
2. **Statement ratio** — `STATEMENT` ≤ 30% of beats.
3. **Repetition** — no archetype appears >2× consecutively.
4. **Hold time** — every beat's `durationInFrames` ≥ `holdFrames(text)`.
5. **Word count** — no beat exceeds 7 words.
6. **Safe zone** — no positioned element's bounding box crosses `SAFE`.
7. **Duration** — `Σ beats + Σ transitions` ≥ audio length + tail.
8. **Type scale** — no text below 84 px (headline) / 44 px (support) × `u`.

Visual (ffmpeg contact sheet, the standard already adopted in this project):

9. **Sample 1 frame every 15** across the render. Fewer than 4 visually
   distinct frames per 10-second span fails.
10. **Frame 0 and final frame** compared for loop quality — <cite index="33-1">a clean match between the final frame and the opening supports re-watching, a retention signal worth more than the pacing cost</cite>.

The static checks belong in `verify-compositions.js`, which currently only
smoke-tests b-roll resolution.

---

## §11 — Build order

Strictly sequential. Each step is independently verifiable.

0. **Unblock.** Align `src/skills/remotion-render/package.json` to root
   (`remotion@^4.0.503`, React 19). Add `@remotion/captions`,
   `@remotion/transitions`, `@remotion/rough-notation`. Confirm `inputProps`
   reaches the component and delete the generated-entry-file workaround in
   `render.js`. **Nothing below works until this lands.**
1. `compositions/beats.js` — `parseSrtToBeats` + `classifyBeat` +
   `holdFrames`. Unit-test the classifier against the three existing scripts
   in `data/scripts/`. Assert `STATEMENT` ≤ 30% on all three.
2. Wire the SRT into `render.js` props. Log the beat timeline. No render yet.
3. Static gate checks 1–8 in `verify-compositions.js`.
4. Rebuild `minimal.jsx` on the beat spine. Simplest style, proves the model.
   Render one Short. Contact sheet.
5. Rebuild `motion-graphics.jsx`. The existing scene components are mostly
   reusable — they were never the problem, the router and the timing were.
6. Rebuild `cinematic-documentary.jsx` + `IMAGE_BEAT` for the other two.
7. `TransitionSeries` + duration re-derivation (§5.2).
8. SFX layer (§6).
9. Visual gate checks 9–10.
10. Only then: matrix rollout.

---

## §12 — Sources

Remotion (first-party):
- `remotion.dev/docs/interpolate` — easing option, clamping behaviour
- `remotion.dev/docs/spring` — overshoot, damping
- `remotion.dev/docs/transitioning` — TransitionSeries arithmetic, adjacency rules
- `remotion.dev/docs/transitions/` — presentation and timing inventory
- `remotion.dev/docs/transitions/timings/springtiming` — `durationRestThreshold`
- `remotion.dev/docs/captions/api`, `/caption`, `/create-tiktok-style-captions` — Caption type, `parseSrt()`, page segmentation
- `github.com/remotion-dev/skills` → `remotion-markup/timing.md`,
  `remotion-markup/transitions.md`, `remotion-markup/multi-scene-video.md`,
  `remotion-markup/sfx.md`, `remotion-markup/text-highlights.md`,
  `remotion-create/video-layout.md` — official agent rules: `perceptual-scale`,
  `Easing.bezier(0.16,1,0.3,1)`, safe margins, minimum type sizes, scene-per-file

Motion timing:
- `material-components-android/docs/theming/Motion.md` — duration slot values (50–1000 ms; the 16 slots: short1 50ms, short2 100ms, short3 150ms, short4 200ms, medium1 250ms, medium2 300ms, medium3 350ms, medium4 400ms, long1 450ms, long2 500ms, long3 550ms, long4 600ms, extraLong1 700ms, extraLong2 800ms, extraLong3 900ms, extraLong4 1000ms)
- `m1.material.io/motion/duration-easing.html` — duration scales with distance and surface change
- `equal.design/blog/5-rules-for-motion-in-ui-transitions` — Material 150–200 ms small / 400 ms large; Fluent 2 100–500 ms

Short-form pacing:
- `opus.pro/blog/ideal-youtube-shorts-length-format-retention` — cuts every 2–4 s
- `aibrify.com/blog/short-form-video-editing-captions-b-roll-guide` — 5–7 visual changes per 10 s, stimulus density over edit count, loop-frame match
- `motionedits.com/the-art-of-pacing-how-we-edit-for-maximum-engagement` — meaningful change every 3–5 s
- `djdesignerlab.com/editing-for-impact-...` — predictable rhythm as the failure mode

Typography and captions:
- `gabrielpulecio.com/what-is-kinetic-typography/` — 180–220 WPM, seven-word line 1.8–2.5 s, `(chars ÷ 12) + 0.5` formula, 3-flashes-per-second safety cap, motion blur on large type only
- `influencers-time.com` (three articles) — 3–7 words per beat, 1–2 lines, 5–12 words per moment, 5–8 text beats per 20–30 s video, contrast treatments
- `crepal.ai/blog/aivideo/blog-how-to-create-tiktok-style-captions-remotion/` — tested `combineTokensWithinMilliseconds` values, v4.0.216 subtitle support

Safe zones (sources conflict — see §2):
- `aicarousels.com/free-tools/youtube-safe-zone-checker` — 288/672/48/192, from Google's overlay
- `somake.ai/blog/youtube-shorts-aspect-ratio` — same, plus 840×960 rect, Dynamic Island caveat, 4× right-margin note
- `postplanify.com/tools/youtube-shorts-safe-zone-checker` — looser ~888×1500
- `adverthunt.com/tools/ad-safe-zone-checker/youtube` — looser ~180/350/120/40
- `getkoro.app/blog/youtube-shorts-dimensions` — audio level guidance
