---
name: "terminal-inserts"
description: "Command-line terminal overlays for motion-graphics: blinking cursor, character-by-character typing, monospace JetBrains Mono, dark terminal chrome. Used for code, commands, API calls, and technical demonstrations."
---

# Terminal Inserts — Liam Johnston Skill

## Core identity

Terminal inserts show the viewer the actual command, code, or API call that powers the technology. They are not decorative — they demonstrate what the user would type, what the system would return, and how data flows. Every terminal insert is synchronized to the narration.

## Visual specification

### Chrome
- Dark terminal background (#0A0A1A or channel bg)
- Subtle border, 2px radius, 8px padding
- Three dot traffic lights (red/yellow/green) at top-left, 8px diameter, 16px apart
- Window title: channel-scoped (e.g. "gemini — connected-apps")

### Typography
- Font: JetBrains Mono (vendored in src/skills/remotion-render/public/fonts/)
- Size: 32–44px depending on content density
- Weight: 400 for body, 700 for highlighted commands
- No italic, no negative tracking

### Cursor
- Blinking block cursor, 500ms on/off cycle
- Positioned at end of current typing line
- Same colour as textPrimary

### Character-by-character typing
- Characters appear one at a time, synchronized to narration pacing
- Typing speed: 3–5 characters per second (readable, not too fast)
- Each character is a separate opacity/scale keyframe
- Completed lines hold for 1–2 seconds before next command

### Terminal bell
- Small emphasis-tick SFX on command completion
- Visual flash: background briefly lightens (10% opacity, 6 frames)

## Animation cues (from script)
- animation_cue: "character-by-character typing animation" — types the command
- animation_cue: "cursor blinking" — idle cursor after command completes
- sfx_cue: "keyboard typing, terminal bell" — typing clicks + bell on completion

## Application in AI Tested
- Hook: typing "npm install connected-apps --platform gemini" with cursor
- Setup: showing the Connected Apps Platform command
- Each terminal beat is 2–4 seconds
- Terminal insert occupies the Stage zone (392–940 vertical)
- Paired with article-highlight beat for the TechCrunch headline

## What this skill forbids
- Pre-typed text appearing instantly (must be character-by-character)
- Terminal without blinking cursor
- Non-monospace fonts
- Terminal background gradients or glass effects
- More than one terminal insert per beat
- Terminal inserts that outlast the narration beat
