---
name: remotion-render
description: Authoritative video-editor skill — complete production lifecycle from narration understanding through final-MP4 QA. Owns visual concept extraction, sentence-level coverage, asset selection, composition, motion design, caption sync, rendering, and visual QA for all three channels.
version: 2.0.0
---

# Remotion Render — Authoritative Video Editor Skill (Claude Code)

This skill delegates to the **authoritative video-editor specification** at:

**`.agents/skills/remotion-render/SKILL.md`**

That document is the single source of truth for all video production in the YOUTUBE automation project. This Claude Code entry point exists only to surface the same procedure for Claude Code workflows.

## When to Load

Load this skill before any video-related work: rendering, visual planning, QA, or editor repairs.

## What It Covers

The authoritative spec at `.agents/skills/remotion-render/SKILL.md` covers all 20 editor responsibilities:

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

## OpenCode Reconciliation

The OpenCode entry point at `.opencode/skills/remotion-render/SKILL.md` references the same authoritative spec. Both OpenCode and Claude Code load the same specification — there are no conflicting instruction sets.

## Implementation Files

- `scripts/editor/coverage-plan.mjs` — sentence→concept→beat planner
- `scripts/editor/coverage-layers.mjs` — layer constructors
- `scripts/editor/coverage-graphics.mjs` — diagrams (timeline, version, flow, relation, causal, plea, number, clock, negotiation, AI, label)
- `scripts/editor/coverage-assets.mjs` — asset resolution (Wikipedia, Commons, patent PDF, LinkedIn, Jina, label cards)
- `scripts/editor/coverage-timeline.mjs` — timeline compositions
- `scripts/editor/coverage-audit.mjs` — hard QA gate
- `scripts/editor/auto-timeline.mjs` — integration with coverage pass
- `scripts/editor/video-qa.js` — final-MP4 QA with coverage gate
- `src/skills/remotion-render/editor/EditorTimeline.jsx` — renderer
- `src/skills/remotion-render/render-editor.js` — render orchestrator
- `src/skills/remotion-render/editor/layer-math.js` — shared layer math (renderer + QA)
- `scripts/__tests__/editor-coverage.test.js` — coverage tests
- `.github/workflows/visual-storytelling-proof.yml` — GitHub Actions proof workflow
