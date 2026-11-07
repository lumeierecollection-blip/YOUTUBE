---
name: "article-highlights"
description: "Editorial highlight overlays for motion-graphics: marker-stroke animation over article headlines, key-phrase emphasis, and document callouts. Used for third-party reporting excerpts and documentation quotes."
---

# Article Highlights — Liam Johnston Skill

## Core identity

Article highlights show the viewer what reputable sources say about the technology. A marker stroke draws across key phrases as the narrator reads them, connecting the spoken claim to visible evidence. Each highlight is synchronized to the narration beat.

## Visual specification

### Marker stroke
- Draw-on animation: stroke left-to-right over highlighted text
- Stroke width: 6px at 1080 scale (recomputed per A4.3 rule)
- Colour: channel accent (the ONE accent colour per beat)
- Animation duration: 10–15 frames per phrase
- Ease: linear draw-on, no easing (constant reveal speed)

### Highlight card
- Surface panel: surface fill, radius 16, 32px padding
- Headline text: 64px w800, textPrimary
- Key phrase: accent colour, bold weight
- Citation: 32px label, textDim, small caps via tracking +2
- Source URL: 28px textDim, monospace, bottom-right of card

### Animation sequence
1. Card fades in (8 frames, opacity 0→1, translate-y 20→0)
2. Marker stroke draws across key phrase (10–15 frames)
3. Hold for 2–3 seconds while narration delivers the claim
4. Fade out (8 frames, opacity 1→0)

## Animation cues (from script)
- animation_cue: "marker stroke left-to-right over highlighted text"
- sfx_cue: "subtle bass drop" on highlight completion

## Application in AI Tested
- Hook: "50 CONNECTED APPS" highlighted on card
- Setup: "CONNECTED APPS PLATFORM" command-line highlight
- Rehook: TechCrunch headline "BEYOND GOOGLE APPS" with marker stroke
- Payoff: partner logos with channel-accent highlighting
- Each highlight beat is 3–5 seconds

## What this skill forbids
- Highlight appearing instantly (must be marker stroke draw-on)
- More than one accent-colour highlight per beat
- Highlight card without source citation
- Highlight text that doesn't match spoken words
- Highlight outlasting the narration beat

## Article source requirements
- Every highlighted article must be real and verifiable
- Source URL displayed on card
- No fabricated headlines or quotes
- Third-party reporting only (not company marketing copy)
