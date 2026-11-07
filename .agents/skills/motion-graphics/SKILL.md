---
name: "motion-graphics"
description: "Premium motion-graphics explainer treatment: kinetic typography, animated diagrams, data flows, shape primitives, and deliberate transitions. No black screens, no text-only slides."
---

# Motion Graphics — Liam Johnston Skill

## Core identity

A motion-graphics explainer is not a slide deck. Every beat must show something moving, changing, connecting, or being built. The viewer should understand the technology through the visuals alone, even with sound off.

## Visual rules (from MOTION-GRAPHICS-MANUAL.md)

### Canvas
- **1080 × 1920 @ 30 FPS**, vertical 9:16 Shorts
- Safe rect: top 288, right 888, bottom 1248, left 48
- Optical centre: x=468, y=768 (NOT 540)
- 8px base grid; 12-column layout; column width 56, gutter 8

### Colour (max 6 on screen: bg, accent, textPrimary, textDim, stroke, surface)
- **bg**: flat, never gradient, no vignette, no radial glow
- **accent**: exactly ONE saturated colour per channel, at most one element per beat, max 8 elements across the Short
- **textPrimary**: usually #FFFFFF
- **textDim**: mix(textPrimary, bg, 0.45)
- **stroke**: mix(textPrimary, bg, 0.22) for rules, axes, borders
- **surface**: mix(bg, textPrimary, 0.06) for chip/panel fills
- Contrast: textPrimary on bg minimum 7:1 (AAA large-text), accent on bg minimum 4.5:1

### Typography (two weights only: 400 and 700/800)
- hero: 220px w800 — single number or single word
- headline: 84px w800 — never lower (Remotion floor)
- value: 72px w800 — chart values, counters
- caption: 64px w800 — VO caption block
- body: 52px w400
- support: 44px w400
- label: 32px w700, tracking +2
- kicker: 28px w800, tracking +4, uppercase
- Tracking: kicker +4, label +2, everything else 0
- Type never stretches, warps, skews, or rotates — animate opacity, translate, scale, clip only

### Icons (Lucide only, ISC/MIT licensed)
- 24×24 canvas, 2px stroke, round joins/caps, 2px border radius if ≥8px
- Apparent stroke at video scale: 6–12px (target 10px)
- Sizes: 64, 120, 180, 240 only
- One icon per beat, max 3 on screen (LIST_ITEM and RELATION only)
- Keyword-driven selection against channel icon map — never invent icon names
- No brand logos — named companies rendered as wordmarks in channel font

### Shapes (six primitives only)
| Primitive | Spec |
|---|---|
| Rule | 4px stroke, radius 2 |
| Chip | surface fill, 2px stroke border, radius 16, padding 16×24 |
| Node | circle r44, surface fill, 3px stroke border, accent when highlighted |
| Bar | radius 8 top corners only, min height 6px |
| Connector | 4px stroke, drawn via evolvePath() |
| Panel | surface, radius 24, 32px padding, no shadow |

- No shadows, bevels, glass, or blur-behind (dropShadow permitted for caption only)
- Corner radius: 8, 16, or 24 only

### Background and texture
Layer order bottom to top:
1. Flat bg fill
2. Dot grid (6% opacity)
3. Stage content
4. Headline/kicker/rail
5. Caption
6. Grain (noise, 4% opacity)

Background never animates during a beat. No particles.

## Beat timing (from MOTION-BLUEPRINT.md)
- **A beat every 45–90 frames (1.5–3.0s)** at 30fps
- Target 5–7 beats per 300 frames (10 seconds)
- Under 4 beats per 300 frames fails the gate
- A section is a container of beats, not a single scene
- Beat = smallest unit of visual change: new element, layout shift, value landing, push-in, color change, cut

## Kinetic typography
- Text slides in, never hard-cuts
- Animate opacity, translate, scale, clip only — no stretch/warp/rotate
- Measure text with measureText(), fit to zone in 4px steps to floor of 84px
- Max 2 lines per text block, max 7 words per block

## Caption rules
- Captions carry the spoken words; graphics carry the structure — never the same thing twice
- Caption text: 64px w800, bottom-anchored
- Caption uses dropShadow (the one permitted dropShadow use)
- Synchronised to per-word SRT timings — never chunked by naive word count

## Data flows and diagrams
- Connectors: 4px stroke, evolvePath() animation (draw on, not appear instantly)
- Bars: radius 8 top corners only, min height 6px
- Nodes: circle r44, surface fill, 3px stroke border, accent when highlighted
- Chips: surface fill, 2px stroke border, radius 16, padding 16×24

## What this skill forbids
- Black screen with occasional words
- Text-only scenes
- Slideshow of static images
- Gradients on bg
- Shadows/bevels/glass/blur-behind (except caption dropShadow)
- Particles
- More than one accent element per beat
- More than 6 colours on screen
- More than 3 icons on screen
- Brand logos (render as wordmarks)
- Animated background during a beat
