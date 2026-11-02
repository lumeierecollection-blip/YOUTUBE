---
name: remotion-render
description: Authoritative video-editor skill — complete production lifecycle from narration understanding through final-MP4 QA.
---

# Remotion Render — Authoritative Video Editor Skill

This reference is a **pointer to the authoritative specification**. All video production in the YOUTUBE automation project is governed by:

**`.agents/skills/remotion-render/SKILL.md`**

That document is the single source of truth and covers all 20 editor responsibilities:

1. Understanding the narration
2. Visual concept extraction
3. Sentence-level visual planning
4. Asset selection and verification
5. Photograph usage
6. PNG cutout usage
7. Visual composition
8. Scene and beat planning
9. Motion design
10. Camera movement
11. Transitions
12. Caption placement and synchronization
13. Music and sound integration
14. Channel-specific visual treatment
15. Mobile-first layout
16. Remotion implementation
17. Rendering
18. Visual inspection
19. Technical QA
20. Final video acceptance

## Quick Commands

The implementation lives in `scripts/editor/`:

- **Coverage plan**: `node scripts/editor/auto-timeline.mjs --channel <ch> --script <path> --coverage`
- **Final-MP4 QA**: `node scripts/editor/video-qa.js --video <mp4> --timeline <timeline.json> --out <qa.json> --contact <contact.jpg>`
- **Tests**: `node --test scripts/__tests__/editor-*.test.js`

## GitHub Actions

Proof workflow: `.github/workflows/visual-storytelling-proof.yml` — runs TTS, coverage timeline, Remotion render, and QA on GitHub-hosted runners for channels 1, 2, and 48. Never publishes.
