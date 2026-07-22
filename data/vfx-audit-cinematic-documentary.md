# VFX Audit — Cinematic Documentary Style

## Research Sources
- MagnatesMedia (YouTube) — financial/business documentary breakdowns
- ColdFusion (YouTube) — tech/business documentary pacing and effects
- Company Man (YouTube) — clean business documentary with data overlays
- Documentary editing communities — pacing, layering, color science

## Effects Checklist (each traced to source)

### 1. Film Grain Overlay
- **Source**: MagnatesMedia, ColdFusion — standard documentary treatment
- **Intensity**: 8-15% opacity
- **When**: All sections; increase during tension/dramatic moments
- **Implementation**: Fine grain for modern feel, coarser for archival/nostalgic
- **Files needed**: grain-fine.png, grain-coarse.png

### 2. Color Grading — Warm/Cool Split
- **Source**: MagnatesMedia financial docs, Company Man
- **Intensity**: 20-40% grade shift
- **When**: Full video; shifts at section transitions
- **Implementation**: Warm golden for nostalgia/history, cold blue/steel for modern/crisis
- **LUTs needed**: lut-warm-nostalgia.cube, lut-cold-crisis.cube, lut-outrage-red.cube

### 3. Subtle Vignette
- **Source**: Standard documentary/film technique
- **Intensity**: 15-25% opacity
- **When**: All sections
- **Implementation**: Dark edges, draws eye to center

### 4. Slow Zoom / Ken Burns on Stills
- **Source**: MagnatesMedia, ColdFusion
- **Rate**: 0.5-2% per second
- **When**: Still image sections
- **Implementation**: Always zoom toward subject's face or key detail. Never zoom out.
- **Note**: Most common technique for keeping static imagery alive

### 5. Light Leak / Subtle Flare
- **Source**: MagnatesMedia transition moments
- **Intensity**: 5-12%
- **When**: Transitions and key reveals ONLY
- **Note**: Max 3-4 per long-form video. Never decorative.

### 6. Animated Data Overlays
- **Source**: ColdFusion, Company Man
- **Intensity**: 15-30% opacity
- **When**: Data/financial sections
- **Implementation**: Numbers, charts animate in synced to voiceover. Use channel accent color (#C9A227) for key figures.

### 7. Lower Third Text Reveals
- **Source**: Company Man, MagnatesMedia
- **Intensity**: 10-20%
- **When**: Person/company introductions
- **Implementation**: Clean sans-serif, slight animation. Minimal motion.

### 8. Dramatic Pacing Cuts
- **Source**: MagnatesMedia collapse/failure sequences
- **When**: Crisis sections
- **Implementation**: Fast cuts (0.5-1s) during tension, slow cuts (3-4s) for payoff
- **Pacing curve**: Opening slow → Rising action acceleration → Climax fast → Resolution slow

### 9. Depth/Parallax Layering
- **Source**: ColdFusion compositing sequences
- **Intensity**: 10-20%
- **When**: Composite sections
- **Implementation**: Foreground/background with differential movement

### 10. Chromatic Aberration (Subtle)
- **Source**: MagnatesMedia dramatic reveals
- **Intensity**: 3-8%
- **When**: Dramatic moments ONLY
- **Note**: Max 2-3 uses per video, only at key reveals

## Pacing Guidelines

| Section | Shot Duration | Notes |
|---------|--------------|-------|
| Opening (hook) | 2-3s per shot | Let the hook breathe |
| Rising action | 1.5-2s per shot | Gradual acceleration |
| Climax/tension | 0.5-1s per shot | Fast cuts, peak tension |
| Resolution | 3-4s per shot | Slow down, let takeaway land |

## Color Palette

| Mood | Hex | Usage |
|------|-----|-------|
| Nostalgia | #D4A853 | Warm gold for history/childhood sections |
| Crisis | #1A3A5C | Cold steel blue for modern/failure sections |
| Outrage | #8B1A1A | Deep red for PE fee extraction / anger sections |
| Neutral | #2A2A2A | Dark grey for transitions |
| Text primary | #FFFFFF | All main text |
| Text accent | #C9A227 | Key figures, channel branding |

## Implementation Notes for Remotion

- Grain: Apply as CSS `mix-blend-mode: overlay` with opacity animation
- Color grading: Use CSS `filter: sepia() hue-rotate() saturate()` or Remotion's `< interpolateColor >`
- Vignette: CSS `radial-gradient` overlay
- Ken Burns: Remotion `spring()` with scale/position interpolation
- Data overlays: Remotion `< Sequence >` with `spring()` animations
- Pacing cuts: Remotion `< Sequence >` timing + `durationInFrames` control
