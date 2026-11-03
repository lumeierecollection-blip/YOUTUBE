---
name: remotion-video-review
description: Authoritative video-review skill — inspect rendered Remotion MP4s for creative and technical quality. Extracts frames at beats and transitions, builds contact sheets, checks framing/motion/captions/audio alignment, and produces a timestamped creative review. Separate from remotion-render; it reviews, it does not render.
version: 1.0.0
---

# Remotion Video-Review — Authoritative Video Review Skill

This skill is the **primary authority** for inspecting a finished Remotion MP4. It owns the complete visual-review lifecycle:

1. Locating the actual final MP4 (never a placeholder or old artifact)
2. Duration and technical properties via FFprobe
3. Extracting representative frames at meaningful timestamps
4. Extracting frames around scene transitions
5. Creating a readable contact sheet
6. Inspecting individual frames at full resolution
7. Checking beginning, middle, and end
8. Checking narration and audio alignment
9. Checking caption timing and readability
10. Checking image quality, composition, cropping, contrast, text placement
11. Checking whether motion is meaningful
12. Identifying repeated or visually monotonous scenes
13. Identifying irrelevant images and generic filler
14. Identifying abrupt transitions, black frames, frozen frames, broken rendering
15. Producing a timestamped creative review with specific corrections

## Core Principle: A File on Disk Is Not a Reviewed Video

A successful render, a passing test suite, a JSON report, or a contact sheet existing on disk does **not** prove a video looks good. Only actually looking at the extracted frames establishes that.

## Prerequisites (verify before every session)

FFmpeg and FFprobe are required. Verify executables and versions:

```
ffmpeg -version
ffprobe -version
```

If absent, install a free, safe Windows build; do not use a paid service or API. If FFmpeg/FFprobe cannot be obtained, you cannot extract frames or run technical checks — do **not** claim the video was visually reviewed. Record the limitation honestly.

## Outputs (save to disk for every inspected MP4)

- MP4 identification: path, size, duration, codec, resolution
- Extracted frames at beat/transition timestamps
- Contact sheet image
- Timestamped creative-review report (markdown) with defects + specific corrections

## Helper scripts (`scripts/video-review/`)

- `inspect-props.mjs` — duration/codec/resolution via FFprobe
- `extract-frames.mjs` — frames at given timestamps via FFmpeg
- `contact-sheet.mjs` — contact sheet via FFmpeg `tile`

These shell out to ffmpeg/ffprobe; they are machine tools, not a substitute for looking at frames.

## Separation from rendering

This skill reviews a finished MP4. It does not call Remotion, does not render, and does not decide what to render. It tells you whether what was rendered actually communicates the narration. It is loaded independently of `remotion-render`.
