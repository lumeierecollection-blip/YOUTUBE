# Style Reference — Border Lines (ch-09), motion-graphics

## What this document is, and what it is not

Not a completed section-1.5 consolidation, for the reasons set out in
`ch-01-motion-graphics.md`. This is the authored design rationale behind ch-09's
Visual Identity Specification, written on explicit instruction, with the
derivation of every value stated.

This is the one of the three channels where the references carry **real,
specific, actionable design guidance** rather than trend copy, so more of the
specification below is sourced and less is judgement.

Query run (section 1.2):
`2026 Geopolitical Explainers motion-graphics video design trends professional editors`

## References found

| # | Reference | Tier |
|---|---|---|
| 1 | [Geopolitics Map Animation Guide for YouTube, Animaps](https://animaps.ai/guide/geopolitics-map-animation) | agency-showreel (tool vendor's practice guide) |
| 2 | [War Map Animation Maker, AnimateMyMap](https://animatemymap.com/war-map-animation) | agency-showreel |
| 3 | [Cinematic Map Video Studio, AnimateMyMap](https://animatemymap.com/) | agency-showreel |
| 4 | [How to Create Country Fill Map Animations, EasyMotion](https://easymotion.io/blog/how-to-create-country-fill-map-animations-with-ai) | agency-showreel |
| 5 | [AI Map Animation Generator, MapAnimation.io](https://mapanimation.io/) | agency-showreel |

## What the sources actually said

These are direct quotations, and they drive four fields below:

- "Geopolitical explainers rely on **controlled border, fill, and label
  sequencing** so each factual change maps cleanly to a visual change" (ref 1).
- "Use **clear date markers and one event transition per beat**. Chronological
  clarity improves retention and reduces misinterpretation" (ref 1).
- "Borders, controlled fills, and selective labels usually provide the best
  clarity. **Avoid excessive pulsing or rapid camera movement**" (ref 1).
- "Territory changes hands with **animated fills**, and **borders redraw
  themselves** as the front moves" (ref 2).
- Control includes "**smooth camera movements**" and highlighting regions by
  hex code (ref 5).

## Derivation of each authored field

| Field | Value | Derived from |
|---|---|---|
| `secondary_palette` | `#F59E0B`, `#94A3B8`, `#E2E8F0` | `visual_spec.color_grade` states it outright: "cool blue tones with **warm conflict highlights**, map-centric". The amber is that warm highlight; the other two are the slate and light neutral map labels need against a dark ground. |
| `typography_secondary` | JetBrains Mono | Available as a real woff2. Dates and coordinates are tabular data anchored to geography; ref 1's "clear date markers" makes them a first-class element. The primary Roboto Condensed is already a map-label face. |
| `core_objects` | national border line, territory fill, satellite terrain, resource site marker, supply route, date marker | Refs 1 and 2 name border lines, fills and labels as the medium itself; `visual_spec.b_roll_sources` adds satellite imagery and resource extraction; ref 1 makes the date marker a required element. **Sourced, not judged.** |
| `camera_language` | top-down, push-in, track-left, pan-right | `visual_spec.camera_angles` "satellite top-down" → `top-down`, "map territory zoom" → `push-in`. Ref 1's "avoid rapid camera movement" and ref 5's "smooth camera movements" rule out whip-style moves. `track-left` is the move that separates this channel from the other two: on a map the camera TRAVELS across geography rather than rotating in place. **Corrected after review.** |
| `transition_language` | border-draw, territory-fill, zoom-region | `visual_spec.transitions` declares four and section 2 permits three. Ref 2 names border redraw and animated fill as the two real events; ref 1's "one event transition per beat" makes `zoom-region` the third. `map-morph` is dropped: it is the one that does not correspond to a discrete factual change. |
| `framing_default` | wide | Territory only reads as territory at extent. Ref 1's border/fill/label sequencing needs the region and its neighbours in frame together. |
| `text_placement` | corner-overlay | Ref 1 requires date markers and selective labels; labels belong anchored to geography, so the persistent frame-level type has to sit out of the map's way. **Judgement**, informed by ref 1. |
| `use_of_negative_space` | low | A map fills the frame by definition. This is the deliberate opposite of ch-01's `high`. |
| `motion_curve` | ease-in-out | Ref 5's "smooth camera movements" against ref 1's "avoid excessive pulsing": symmetric easing, nothing that snaps. |

## Two values deliberately shared with ch-01

`typography_secondary` (JetBrains Mono) and `motion_curve` (ease-in-out) are the
same on Money Mind and Border Lines. That is not laziness and it was not
changed on review: tabular numerals are correct for both ledger figures and map
coordinates, and both channels' own configs ask for movement that neither snaps
nor pulses. Differentiating them cosmetically would be giving each channel a
random art style, which is the opposite of what the identity system is for.

## Unmeasured

No reference establishes a hex palette for the niche. The palette in the
specification is the channel's own declared colour, with the amber taken from
its own `color_grade` string.
