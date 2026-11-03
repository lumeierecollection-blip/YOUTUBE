---
name: remotion-video-review
description: Authoritative video-review skill — inspect rendered Remotion MP4s for creative and technical quality. Delegates to `.agents/skills/remotion-video-review/SKILL.md`.
version: 1.0.0
---

# Remotion Video-Review — Authoritative Video Review Skill (Claude Code)

This skill delegates to the **authoritative video-review specification** at:

**`.agents/skills/remotion-video-review/SKILL.md`**

That document is the single source of truth for inspecting rendered Remotion MP4s. This Claude Code entry point exists only to surface the same procedure for Claude Code workflows.

## When to Load

Load this skill before inspecting any rendered MP4: reviewing QA output, examining frames, or writing a creative review.

## What It Covers

The authoritative spec covers all 15 review requirements: locating the MP4, technical properties via FFprobe, frame extraction at beats and transitions, contact sheets, full-resolution frame inspection, beginning/middle/end sampling, narration-audio alignment, caption timing/readability, image quality/composition/cropping/contrast/text placement, meaningful-motion checks, repeated-visuals detection, filler detection, black/frozen/abrupt-frame detection, and producing a timestamped creative review with specific corrections.

## OpenCode Reconciliation

The OpenCode entry point at `.opencode/skills/remotion-video-review/SKILL.md` references the same authoritative spec. Both OpenCode and Claude Code load the same specification — there are no conflicting instruction sets.

## Implementation Files

- `.opencode/skills/remotion-video-review/SKILL.md` — OpenCode entry point
- `.agents/skills/remotion-video-review/SKILL.md` — authoritative specification
- `scripts/video-review/inspect-props.mjs` — FFprobe duration/codec/resolution
- `scripts/video-review/extract-frames.mjs` — FFmpeg frame extraction
- `scripts/video-review/contact-sheet.mjs` — FFmpeg contact sheet

## Separation from rendering

This skill reviews a finished MP4. It does not call Remotion, does not render, and is independent of `remotion-render`.
