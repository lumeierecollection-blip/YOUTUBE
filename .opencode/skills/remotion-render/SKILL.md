---
name: remotion-render
description: Use to render a finished script + voiceover into video using Remotion, choosing one of the channel's configured style templates. Styles are periodically re-validated against real current examples of that style, and imagery used must be real, correctly-matched photos of the actual people/places referenced.
---

# Remotion Render Skill

This skill is an OpenCode-specific entry point that delegates to the **authoritative video-editor specification** at `.agents/skills/remotion-render/SKILL.md`.

## Authority

The complete editor specification — covering narration understanding, visual concept extraction, sentence-level coverage, asset selection, photograph/PNG usage, visual composition, scene and beat planning, motion design, camera movement, transitions, caption synchronization, music integration, channel-specific treatment, mobile-first layout, Remotion implementation, rendering, visual inspection, technical QA, and final video acceptance — lives in:

**`.agents/skills/remotion-render/SKILL.md`**

That document is the single source of truth. This OpenCode skill entry point exists only to surface the same procedure for OpenCode workflows. Any change to editor behavior must be made in `.agents/skills/remotion-render/SKILL.md` first; this file is kept in sync by reference only.

## OpenCode-Specific Steps

When invoked through OpenCode:

1. Read `.agents/skills/remotion-render/SKILL.md` (the authoritative spec).
2. Confirm the target channel's configuration in `config/channels.json`.
3. Confirm TTS voiceover exists at `data/tts/<channel>/<stem>-vo.mp3` and `-vo-words.json`.
4. Run the coverage pipeline through GitHub Actions:
   - `node scripts/editor/auto-timeline.mjs --channel <ch> --script <path> --coverage`
   - Render via `render-editor.js` through Remotion on the Actions runner.
   - Run `scripts/editor/video-qa.js` for final-MP4 QA including coverage audit.
5. Upload MP4, QA report, contact sheet, coverage plan/report, and timeline as workflow artifacts.
6. Inspect artifacts; correct failures; repeat until acceptance criteria pass.

## Rules (from authoritative spec)

- Visuals must correspond to the narration; every important concept gets a beat.
- Multiple important concepts receive multiple meaningful beats.
- Photographs must be relevant and correctly matched.
- PNGs must be clean and deliberately composed.
- No meaningless particle effects or decorative motion.
- Movement must have purpose, direction, start/end, duration, physical sense.
- Beat timing follows narration and music.
- No public uploads. No credentials exposed. Do not push to `main`.
