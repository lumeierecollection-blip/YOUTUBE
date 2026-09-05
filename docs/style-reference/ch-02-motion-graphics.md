# Style Reference — Legal Brief (ch-02), motion-graphics

## What this document is, and what it is not

Not a completed section-1.5 consolidation, for the reasons set out in
`ch-01-motion-graphics.md`: no media fetch is possible from this machine and
text sources do not carry hex palettes or easing curves. The section-1
worksheet stays open. This is the authored design rationale behind ch-02's
Visual Identity Specification, written on explicit instruction, with the
derivation of every value stated.

Query run (section 1.2):
`2026 Legal Education motion-graphics video design trends professional editors`

## References found

| # | Reference | Tier |
|---|---|---|
| 1 | [Court Animation: A Practical Guide for Modern Litigation, High Impact](https://www.highimpact.com/cases-and-insights/court-animation-a-practical-guide-for-modern-litigation) | agency-showreel |
| 2 | [Legal Graphics: Present Your Argument With Compelling Visuals, Courtroom Animation](https://courtroomanimation.com/legal-graphics-present-your-argument-with-compelling-visuals/) | agency-showreel |
| 3 | [Legal Animation Services, Split Arts](https://splitarts.com/our-services/legal-animation/) | agency-showreel |
| 4 | [Legal Animation, Austin Visuals](https://austinvisuals.com/legal-animation/) | agency-showreel |
| 5 | [Legal Graphics, Digital Evidence Group](https://digitalevidencegroup.com/legal-graphics/) | agency-showreel |
| 6 | [Legal Video Production Agency London, MHF Creative](https://mhf-creative.com/sectors/legal-videos/) | agency-showreel |
| 7 | [Legal Graphics and Animation, Pranamedia](https://www.pranamedia.com/legal-graphics-and-animation/) | agency-showreel |
| 8 | [Motion Graphics Explainer Video for Legal Marketplace (Laine)](https://www.youtube.com/watch?v=xVqjxbwfLuc) | agency-showreel (not viewable from here) |

## What the sources actually said

- The production process is "case intake and evidence review, visual strategy
  and storyboarding to define scenes and viewpoints, and animation and motion
  design to produce motion paths, camera movement, lighting, and overlays"
  (refs 1, 3). Evidence first, camera second: the object is the argument.
- "Motion adds value when disputes centre on timing, dynamic forces,
  trajectories, or multi-step procedures where individual frames alone may
  confuse jurors" (ref 1). Movement is justified by the claim being made, not
  applied for pace.

Both statements support the addendum's own reading of this channel: the
document becomes the scene, and the camera moves into the clause.

## Derivation of each authored field

| Field | Value | Derived from |
|---|---|---|
| `secondary_palette` | `#C81E3C`, `#8892B0`, `#E6E8EC` | The declared accent `#F5536B` deepened, a slate for supporting type, and a paper white for documents — this channel's core object is a printed page. **Judgement**: one accent is declared, not three. |
| `typography_secondary` | Noto Serif | Available as a real woff2. Legal instruments are set in serif; the primary DM Sans carries the channel's own voice, the serif carries quoted law. |
| `core_objects` | legal document, gavel, state map, constitutional text, police dashcam frame, case file folder | The addendum's own law example ("gavel, document, handcuffs, map, constitution text") intersected with `visual_spec.b_roll_sources`, which already names courtroom footage, legal document animations, police dashcam and constitutional imagery. Handcuffs dropped: nothing in this channel's own config asks for them. |
| `camera_language` | push-in, static, tilt-down, pan-right | `visual_spec.camera_angles`: "document close-up" and "constitutional text zoom" → `push-in`; "courtroom establishing wide" → `static`; a document on a table is come to by tilting down onto it; a clause is read left to right → `pan-right`. `top-down` was in the first draft, derived from "state map overlay" — **dropped on review**, because an overlay is a composited layer, not a camera move. |
| `transition_language` | document-reveal, dramatic-cut, map-zoom | `visual_spec.transitions` declares four and section 2 permits three. `scale-impact` is dropped as the one least tied to the declared world; the other three each carry a real act of this channel. **Judgement**, and the one most worth your review. |
| `framing_default` | close-up | Refs 1 and 3 put evidence before camera, and the document is the evidence. Wide is reserved for the courtroom establishing shot the config already names. |
| `text_placement` | upper-third | On a document close-up the lower and centre frame carry the clause being read. Type sits above it rather than over it. **Judgement.** |
| `use_of_negative_space` | medium | `visual_spec.color_grade` "dark with red accent highlights, high contrast legal drama", with a document occupying most of the frame. |
| `motion_curve` | ease-out | `visual_spec.pacing` "measured with dramatic pauses": movements arrive and settle rather than easing in and out of every beat. |

## Unmeasured

No reference above establishes a hex palette or an easing curve for this niche.
The palette in the specification is the channel's own declared colour.
