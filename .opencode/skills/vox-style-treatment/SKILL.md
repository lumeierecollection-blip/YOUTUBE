---
name: vox-style-treatment
description: Reference this skill whenever generating, treating, or reviewing a beat in the Remotion render pipeline -- documentary explainer motion graphics style (Vox/Johnny Harris genre), covering photo treatment, accent-color discipline, camera/transitions, annotation, typography, maps, and pacing. Use when building or QA-ing any beat's visual output.
---

# Vox-Style Documentary Explainer -- Reference Skill

Sourced from real research on the Vox/Johnny Harris documentary-explainer
genre -- not invented. This is the standing acceptance bar for every beat
this pipeline renders, referenced automatically, not just during one-off
fix passes.

## Photo/asset treatment (per-asset, never the canvas background)
- [ ] Soft vignette pulling the eye toward center
- [ ] Grain (film/paper/halftone), light-leak, slight chromatic aberration
      at edges -- "breaking the digital feel"
- [ ] Desaturated editorial base grade (cream/navy/gray family)
- [ ] Drop shadow, grounding the cutout
- [ ] SAME grade recipe applied to every sourced photo regardless of
      original source/lighting -- this is what makes many different stock
      photos read as one continuous piece instead of a mismatched slideshow
- [ ] Implemented via real, tested libraries (postprocessing /
      @remotion/three / a verified-license LUT) -- never freehand shader math

## Accent color system
- [ ] Exactly ONE bold accent color per channel, reserved for the single
      thing that matters in a given scene
- [ ] Annotation marks (circles/arrows/callouts) use that SAME accent --
      annotation and palette are one system, not separate choices

## Camera + transitions
- [ ] Ken Burns push/pull on photos
- [ ] Blur-ramp transition option: position move + Gaussian blur keyframed
      up then back down, for a "flashback"-style cut between photo beats
- [ ] Transition-specific SFX paired to what's actually happening (not a
      generic whoosh on every cut)

## Annotation/callout elements
- [ ] Hand-drawn-style circles/arrows/connector lines highlighting a
      specific detail within a photo, stroke-drawn on (not fade-in)
- [ ] Always in the single accent color, never competing with other colors

## Typography
- [ ] Tight kerning, strong horizontal rhythm on titles
- [ ] Text elements slide in, not hard-cut
- [ ] Chapter/section openers styled like book sections, not a generic
      YouTube intro card

## Maps (where relevant)
- [ ] Route lines draw on (stroke animation), not appear instantly
- [ ] Labels animate in per-location, camera moves between points
- [ ] Same accent-color system as everything else

## Structure/pacing (may require script-stage changes, not just render)
- [ ] "Visual evidence, then context" -- cold open on a visual anchor
      BEFORE explaining it, rather than setup-then-payoff
- [ ] Verify whether current script generation (Stage C) already produces
      this ordering or needs a prompt change to prompts/write-script.md

## Known tension -- decided, not open
SFX-on-every-beat sits against this genre's convention of reserving
distinctive sounds for specific moments. Resolution: every beat gets SOME
audible cue, but distinctive sounds (whooshes, projector clicks, impacts)
stay reserved for moments that actually earn them.
