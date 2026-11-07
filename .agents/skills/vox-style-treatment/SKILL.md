---
name: "vox-style-treatment"
description: "Documentary explainer visual treatment with photo-safe composition, VOX signature textures, and editorial pacing."
---

# Vox-Style Documentary Explainer — Reference Skill

Sourced from real research on the Vox/Johnny Harris documentary-explainer genre — not invented. This is the standing acceptance bar for every beat this pipeline renders.

## Photo/asset treatment (per-asset, never the canvas background)

- [ ] Soft vignette pulling the eye toward center
- [ ] Halftone dots — a genuine Vox signature, not incidental (documented as deliberate: "1950s print dots on brand-new graphics") — distinct from generic grain, apply as its own texture pass
- [ ] Grain (film/paper), light-leak, slight chromatic aberration at edges — "breaking the digital feel"
- [ ] Desaturated editorial base grade (cream/navy/gray family)
- [ ] Drop shadow, grounding the cutout
- [ ] SAME grade recipe applied to every sourced photo regardless of original source/lighting — this is what makes many different stock photos read as one continuous piece instead of a mismatched slideshow
- [ ] Implemented via real, tested libraries (postprocessing / @remotion/three / a verified-license LUT) — never freehand shader math

## Fallback: cutout quality fails the rembg gate

- [ ] SCOPED, does not change the general rule: normal cutout-composited beats and typography-only beats stay exactly as established (flat white/black canvas, no background gradient)
- [ ] When a specific photo fails cutout-quality scoring, use it full-bleed for that beat instead of discarding it — same per-photo grade (vignette/halftone/grain/desaturation) as any other photo
- [ ] Add a gradient scrim WITHIN that full-bleed photo only, for text legibility where the caption sits — this lives on the photo layer, not the canvas
- [ ] Typography sits in the scrim zone, same type rules as elsewhere

## Accent color system

- [ ] Exactly ONE bold accent color per channel, reserved for the single thing that matters in a given scene
- [ ] Annotation marks (circles/arrows/callouts) use that SAME accent — annotation and palette are one system, not separate choices

## Camera + transitions

- [ ] **NO Ken Burns push/pull on photographs** — photographs remain compositionally stable with no scale animation, no artificial push-ins, no camera zooms on archival photographs or portraits
- [ ] Blur-ramp transition option: position move + Gaussian blur keyframed up then back down, for a "flashback"-style cut between photo beats
- [ ] Transition-specific SFX paired to what's actually happening (not a generic whoosh on every cut)

## Annotation/callout elements

- [ ] Hand-drawn-style circles/arrows/connector lines highlighting a specific detail within a photo, stroke-drawn on (not fade-in)
- [ ] Always in the single accent color, never competing with other colors

## Typography

- [ ] Tight kerning, strong horizontal rhythm on titles
- [ ] Text elements slide in, not hard-cut
- [ ] Chapter/section openers styled like book sections, not a generic YouTube intro card

## Maps (where relevant)

- [ ] Route lines draw on (stroke animation), not appear instantly
- [ ] Labels animate in per-location, camera moves between points
- [ ] Same accent-color system as everything else

## Structure/pacing (may require script-stage changes, not just render)

- [ ] "Visual evidence, then context" — cold open on a visual anchor BEFORE explaining it, rather than setup-then-payoff
- [ ] Verify whether current script generation (Stage C) already produces this ordering or needs a prompt change to prompts/write-script.md

## Known tension — decided, not open

SFX-on-every-beat sits against this genre's convention of reserving distinctive sounds for specific moments. Resolution: every beat gets SOME audible cue, but distinctive sounds (whooshes, projector clicks, impacts) stay reserved for moments that actually earn them.

## Hard rules for Hidden Past production

- [ ] **NO photograph zooming**: Photographs are presented with deliberate editorial framing and stable composition. Never zoom, never push-in, never scale-animate archival photographs or historical portraits.
- [ ] **Visual evidence first**: Every major narration beat must have a meaningful visual representation — genuine historical photographs, portraits, documents, maps, illustrations, or artefacts.
- [ ] **No fabricated evidence**: Do not invent historical photographs, documents, quotations, or evidence.
- [ ] **Attribution**: Track sources, creators, licences, attribution requirements and retrieval information for every asset.
