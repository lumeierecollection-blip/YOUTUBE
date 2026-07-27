# VFX Audit — Visual Effects & Polish Practices (2025-2026)

Sourced from editing tutorials, motion-design portfolios, and creator breakdowns. Every technique tied to a real source.

---

## STYLE 1: CINEMATIC DOCUMENTARY

### Film Grain
- **Overlay**: 35mm grain, 8-15% opacity, Overlay or Soft Light blend
- **Luminosity blend**: Strongest in midtones, fades at shadows/highlights
- **When**: Throughout for documentary tone; heavier for archival/flashback
- **Order**: Apply AFTER color grading, never before
- **Sources**: FilterGrade (2026), Luttie.app, InVideo LUT guide, Motion Designer tutorial

### Color Grading
- **LUTs**: Kodak 2383 (warm/teal shadows), Fuji 3510 (cool/softer) at 50-70% strength
- **Contrast**: Curves after LUT — lift midtones slightly, soften highlight rolloff
- **Shadows**: Bring down for moody documentary feel
- **Temperature**: Slight warm shift (+10-20)
- **Grade order**: Correct → LUT → grain → subtle blur (0.5-1px Gaussian)
- **Sources**: InVideo, AAA Presets, Motion Designer tutorial

### Vignette
- **Opacity**: 20-40% (subtle)
- **Feather**: 200-400px radius
- **Color**: Dark brown/charcoal (NOT pure black)
- **Blend**: Multiply or Overlay
- **Sources**: WeDesignMotion, Enchanted Media

### Light Leaks
- **Opacity**: 20-60%
- **Blend**: Screen or Add
- **Duration**: 15-45 frames per use
- **When**: Scene transitions, memory/flashback, time period changes
- **Sources**: WeDesignMotion, Enchanted Media, KirtanFX

### Chromatic Aberration
- **Intensity**: 2-8 pixels RGB separation (subtle)
- **When**: Constant subtle for realism; intensify during tension/horror
- **Sources**: Slice Media, Chris Moran TikTok

### Camera Shake
- **Subtle**: wiggle(freq: 2, amp: 1-2px) — barely perceptible
- **Dramatic**: 10-15px amplitude, 8-12 frames, heavy ease-out
- **Handheld**: wiggle(freq: 4-6, amp: 3-5px)
- **Sources**: Chris Moran, OlafMotion

### Depth/Parallax Layering
- **Layers**: 3-5 minimum (background, mid, foreground)
- **Speed ratios**: Background 0.2-0.4x, Mid 0.6-0.8x, Foreground 1.0-1.2x
- **Particles**: Floating dust at various z-depths for atmosphere
- **Sources**: Motion Designer, Pixflow, DEmotion, Lemmino case study

### Transitions
- **90%+ should be hard cuts**
- Slow cross-dissolve: passage of time
- Zoom through layers: entering new scale (max 1-2x per video)
- Light leak: memory shift (sparingly)
- **Sources**: Medium Vox article, LEMMiNO case study, Adyatma Ramadhan

---

## STYLE 2: MINIMAL / KINETIC TYPOGRAPHY

### Text Animation
- **Ease Out**: Fast arrival, strong deceleration (steep cliff graph)
- **Overshoot**: 3rd keyframe 4-6 frames past target, 5-10px overshoot
- **Scale-in**: 0→115%→100%, overshoot to 96% before settling, 8-12 frames
- **Per-character**: Range Selector on Opacity, Shape: Square, +4px position offset
- **Minimum readability**: 12 frames per word at 30fps
- **Sources**: DJordanMedia, OlafMotion, DEmotion, Studio7mm

### Background Treatments
- **Noise/grain**: 5-10% opacity, fine grain, Overlay blend
- **Gradient**: Subtle 2-3 color stops, slow animated shift
- **Paper texture**: 10-20% opacity, behind type only
- **Base color**: Off-white (#F2F2F2) or deep dark (not pure black/white)
- **Sources**: Vox style analysis, Chris Moran, WeDesignMotion

### Color Accent
- **1 accent color per video** (max 2)
- **Apply only on words carrying core meaning**
- **Same accent throughout entire video**
- **Sources**: Studio7mm, Vox style analysis

### Motion Restraint
- Don't animate every word — hold on important concepts
- Don't use same animation twice in a row
- Don't use motion on every element simultaneously
- Don't use more than 3 animation types per project
- **Sources**: Wisp CMS, Medium Vox article, Joey Sendaydiego (Vox), OlafMotion

### Clean Transitions
- **Hard cut**: 90%+ of transitions
- **Slide**: Moving to new topic, 4-8 frames
- **Fade to black**: End of major section, 12-20 frames
- **Sources**: OlafMotion, Envato Tuts+, Studio7mm

---

## STYLE 3: MOTION GRAPHICS

### Layer Depth/Parallax
- **Layers**: 3-5 depth layers
- **Speed ratios**: Background 0.2-0.4x, Mid 0.6-0.8x, Foreground 1.0-1.2x
- **Z-spacing**: Uneven (closer near camera, further at distance)
- **Camera**: Slow push (0.03 speed, center-focused)
- **Cut transitions**: Soft cuts at 240ms, ease-in-out
- **Sources**: Animly, Videcue, OlafMotion, GSAP explainer skills

### Icon Animation
- **Pop-in**: Scale 0→115%→100%, overshoot to 96% → settle, 8-12 frames
- **Assemble from parts**: Pieces fly in from edges, snap with bounce ease
- **Morph**: Shape morph using paths, ease-in-out 12-16 frames
- **Bounce**: CustomBounce with squash-and-stretch
- **Number count-up**: 0 to final, 20-30 frames
- **Sources**: Videcue, GSAP, DEmotion, DJordanMedia

### Particle Effects
- **Atmospheric**: 20-50 particles, slow drift, subtle opacity
- **Dramatic**: 100-300 particles, faster, more opaque
- **Explosive**: 500+ particles, very fast, short lifespan
- **Lifespan**: 1-3s sparks, 3-8s atmospheric
- **Sources**: Motion Designer, Boris FX, Noble Desktop, DEmotion

### Color Transitions
- **Gradient wipe**: 12-20 frames, ease-in-out
- **Palette shift**: Hue rotation 5-15% over 30s, subtle
- **Kurzgesagt palette**: Navy #2A3A4B, Teal #3DD5C0, Warm #FF6F61, #FFD166
- **Sources**: Videcue, Animly, VideoCue

### 3D Elements
- **Use frequency**: 10-20% of scenes max
- **Camera**: Slow, purposeful — push-in on payoffs, orbit for spatial
- **Style**: Match flat-shading (no photorealistic textures)
- **Sources**: Kurzgesagt production breakdown, OlafMotion, DEmotion

---

## ORDER OF OPERATIONS (Universal)

1. Upscale (if needed)
2. Color correct per clip
3. Apply LUT at 50-70%
4. Add grain at 8-15% (AFTER grade)
5. Add subtle blur (0.5-1px Gaussian)
6. Add overlays (light leaks, dust) last

## EASING REFERENCE

| Curve | Use | Feeling |
|-------|-----|---------|
| Ease Out | Entrances | Snappy, confident |
| Ease In | Exits | Smooth, fading |
| Ease In-Out | Continuous motion | Polished, fluid |
| Overshoot | Impact moments | Bouncy, energetic |
| Linear | NEVER for text/motion | Robotic, amateur |

---

*Sources: FilterGrade, Luttie.app, InVideo, AAA Presets, DJordanMedia, DEmotion, OlafMotion, Studio7mm, Animly, Videcue, 10 Studio, WeDesignMotion, Enchanted Media, KirtanFX, Boris FX, Noble Desktop, Chris Moran, GSAP, Medium, Joey Sendaydiego (Vox)*
