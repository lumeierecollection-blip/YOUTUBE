# MOTION-GRAPHICS-RULES

Rules for the `motion-graphics` template (`compositions/motion-graphics.jsx`).
Every rule here traces back to real motion-design/explainer/data-viz practice
re-researched on the re-audit pass, not to an invented aesthetic. Sources are
listed at the bottom.

## 1. Purpose — the master rule
Every animated element must explain the script, not decorate it. Before adding
motion ask: "what does this movement teach?" A bar growing shows scale; a line
drawing shows a relationship forming; a node appearing shows sequence. If motion
doesn't carry meaning, remove it.
- Icons illustrate the section's subject (gavel/scales/doc/alert/phone/spark).
- Numbers count up when the voiceover cites a figure (motion as data).
- Connecting lines draw when the voiceover links two ideas (motion as interpolation).
- Background stays calm (flat color + faint dot grid + one slow-breathing ring)
  so the focal element never competes with decoration.

## 2. Charts are real infographics, not floating bars
When a section cites data, render a proper chart frame, not bars in open space:
- Draw the y-axis gridlines + value labels and the baseline BEFORE the bars
  (anticipation: grid first, then data).
- Bars spring in with overshoot + settle (squash & stretch) — `spring()` with
  moderate damping (~16) / stiffness (~90). Never a linear or plain ease-in grow.
- Stagger bars 3–5 frames apart. Faster feels rushed, slower feels sluggish.
- Values count up as the bar grows; the label under each bar lands after the bar
  (follow-through).
- Bars get rounded tops + a soft glow on the highlighted/last bar only.

## 3. One primary mover per beat
Pick the hero element of each beat and animate it first and largest. Stagger
secondary elements behind it with small delays. Never move three things at once
in the same way — simultaneous motion becomes noise and raises cognitive load.

## 4. Timing and easing
- Pops and entrances use springs with overshoot + settle (damping ~12–16,
  stiffness ~80–120) — this is what makes mograph feel alive, not robotic.
- Lines/bar-length reveals ease OUT over ~0.5 s (14 frames); a draw is a reveal,
  not a slide, so it does not overshoot its length.
- Secondary elements stagger ~4 frames after the primary.
- Hero zoom (hook) spans ~5 s easing out from 200% to 100%, then holds with a
  subtle ~1% "breathing" scale so the still scene stays alive.
- Pulses are gentle (±3–6%) and periodic; only the final/most important data
  point pulses.
- No linear motion. Anything that feels "floaty" is shortened; anything "jerky"
  gets its easing adjusted before more frames are added.

## 5. Scene header — every beat is labeled
Each non-hook, non-end scene carries a small kicker in the top-left:
`accent rule + "02" + "THE DEEP DIVE"`. Real explainer mograph labels each beat
so the viewer always knows where in the argument they are. Headers fade/pop in
first, before the scene content.

## 6. Hierarchy and readability
- The primary value/headline is largest and highest contrast (accent color).
- Support text is dimmer, smaller, left-aligned, and stays on screen long enough
  to read (no type on screen for less than ~1.5 s).
- Never stretch or warp type. Text animates by fade + small move/scale only.
- Icon + short label is preferred over paragraphs; one idea per scene.

## 7. Continuity and transitions
- Full-screen accent sweeps mark section boundaries (directional wipe).
- Within a section, elements persist; they don't blink in and out.
- The composite scene reuses the same numbered chips from the flow diagram —
  recurring elements make the "everything clicks together" payoff legible.

## 8. Restraint and safety
- Minimal simultaneous motion; calm moments make fast moments feel intentional.
- Slow zoom/breathing only, no spinning, no heavy parallax, no strobe.
- Decoration is muted: dot grid + radial glow at low opacity, single breathing
  ring. Vivid contrast is reserved for the focal data.

## Scene vocabulary (selected by the script's animation_cue / visual_cue)
| Scene         | Trigger (cue contains)                       | What it animates                              |
|---------------|----------------------------------------------|-----------------------------------------------|
| hero          | `id === "hook"`                              | hero number zoom 200%→100%, label fades in    |
| flow          | `flow diagram`, `node`, `connecting line`    | nodes pop in sequence, connector lines draw   |
| chart         | `chart`, `bar`, `timeline`, `data`, `stat`   | axis + gridlines draw, bars spring up, counters count up |
| composite     | `composite`, `illustration`, `hub`, `connect`| chips converge and draw lines into center hub |
| end           | `id === "close"` / `text_overlay`            | channel name fades, accent bar draws, CTA     |
| statement     | fallback                                     | icon + headline + support lines stagger in    |

## How to extend
- To add a scene: add a component, add a branch in `pickScene()`, keep the same
  motion constants in `TIMING`/`EASE`. Reuse existing icon paths where possible.
- Scripts should populate `animation_cue.element` + `animation_cue.action` per
  section so `pickScene` routes correctly; `visual_cue` keywords are the fallback.

## Sources (re-audit, 2026)
- mintlify.com/remotion-dev/template-prompt-to-motion-graphics-saas/skills/charts —
  charts: stagger 3–5 frames, `spring()` with moderate damping for organic motion,
  ALWAYS label axes, value labels inside/above bars when space permits, rounded
  corners + glow, "don't use linear interpolation for organic elements".
- playbooks.com/skills/dylantarre/animation-principles/data-visualization —
  Disney principles applied to charts: squash & stretch = bar overshoot + settle,
  anticipation = brief load pause before data, staging = grid/labels before data,
  follow-through = labels settle after bars, slow in/out, entry timing 300–500ms.
- 10.studio/the-complete-guide-to-creating-engaging-and-impactful-animated-infographics —
  animated counters, guide focus through movement, highlight key data, choose the
  right visual format, smooth wipes/fades between data stories.
- trydemotion.com/blog/mastering-motion-timing — easy ease (slow in/out) mimics
  physics; subtle easing reads professional, extreme easing reads cartoonish;
  consistent timing patterns create polish.
- trydemotion.com/blog/motion-design-principles-animation — slow in/slow out,
  anticipation, follow-through/overlapping, staging, appeal.
- motionstory.com.au/art-of-explaining-complex-ideas-motion-designers-framework —
  one thing per beat, edit ruthlessly, visual language serves the story.
- desktopremiere.com/motion-graphics-that-make-explainers-click — motion shows
  sequence/scale/relationship; 2D flat shapes, clean lines, limited palettes,
  muted background, vivid focal point.
- advids.co/blog/30-2d-flat-design-explainer-video-examples-to-inrpire-actions —
  2D flat design: simplified visuals, consistent icons, limited palette, contrast
  for meaning not decoration.
- observablehq.com/blog/effective-animation — animation in data-viz is best used
  sparingly; motion carries meaning (tweening, tracing, emphasis) or it's noise.
