---
name: "cinematic-camera"
description: "Camera movement grammar for motion-graphics: push-ins, pulls, pans, rolls, and safe-zone transitions. Applied to designed graphics, never to archival photographs."
---

# Cinematic Camera — Liam Johnston Skill

## Core identity

Camera movement in motion-graphics is deliberate and purposeful. Every move serves the information hierarchy — push-ins emphasize, pans reveal connections, rolls transition between concepts. Camera never moves on static photographs; it moves on designed graphics, diagrams, and typography.

## Camera moves (from MOTION-BLUEPRINT.md)

### Push-in
- Scale from 1.0 to 1.15–1.25 over 15–25 frames
- Ease-out deceleration, holds at target for 1–2 seconds
- Used to emphasize a single element (value, node, chart bar)
- Never on photographs — only on graphics, diagrams, typography

### Pull-out
- Scale from 1.15–1.25 back to 1.0 over 15–25 frames
- Used after a push-in to reveal context
- Returns to full-frame composition

### Pan
- Translate X/Y across the Stage zone (392–940 vertical)
- Speed: one full Stage width in 30–45 frames
- Used to reveal relationships between elements (diagram nodes, flow connections)
- Ease-in-out for smooth start and stop

### Roll
- Rotate 5–15 degrees over 10–15 frames, return to 0
- Used as a transition beat between sections
- Combined with opacity fade on outgoing element

### Safe-zone transitions
- Elements enter from off-canvas (beyond safe rect)
- Exit by translating out of safe rect
- Entry/exit duration: 10–15 frames
- Ease-out on entry, ease-in on exit

## Application rules
- **Never push-in or zoom on photographs** — that is the VOX domain, forbidden here
- Camera moves on designed graphics, diagrams, typography, and animated charts only
- One camera move per beat maximum
- Camera moves are paired with sound design (whoosh on pan, emphasis-tick on push-in)
- Safe rect always respected — nothing crosses top 288 / right 888 / bottom 1248 / left 48
- Scale never exceeds 1.25× — beyond that the element dominates and loses context

## What this skill forbids
- Ken Burns on any photograph or portrait
- Camera moves on static images
- Scale beyond 1.25×
- More than one camera move per beat
- Camera moves without accompanying sound design
