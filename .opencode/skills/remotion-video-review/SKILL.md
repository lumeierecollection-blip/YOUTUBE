---
name: remotion-video-review
description: Inspect rendered Remotion MP4s for creative and technical quality: extract frames at beats and transitions, build contact sheets, check framing/motion/captions/audio alignment, and produce a timestamped creative review. Separate from the Remotion rendering skill (remotion-render); it reviews, it does not render.
version: 1.0.0
---

# Remotion Video-Review Skill

This skill teaches OpenCode how to **actually inspect a rendered MP4** — it is separate from the Remotion rendering skill (`remotion-render`), which only produces the file. A render existing on disk, a passing test suite, or a JSON report does **not** prove a video looks good. This skill is what establishes that.

## Prerequisites (verify before every session)

FFmpeg and FFprobe are required for frame extraction, contact sheets, and technical inspection. Verify the executables and versions:

```
ffmpeg -version
ffprobe -version
```

- If present, note the version and use them below.
- If absent, install a free, safe Windows build (e.g. ffmpeg.org / gyan.dev FFmpeg) or add it to PATH. Do **not** use a paid service or API.
- If FFmpeg/FFprobe cannot be obtained in this environment, you cannot extract frames or run the technical checks. **Do not claim the video was visually reviewed.** Record the limitation honestly and stop at the identification stage.

This environment does not have FFmpeg/FFprobe on PATH and has no network to install them, so frame extraction and contact-sheet generation cannot be executed here. See the "Environment limitation" section below.

## The 15 inspection requirements

For every rendered MP4, work through all of these. Record timestamps for every observation.

1. **Locate the final MP4.** Confirm the exact file produced by the render step (e.g. `data/renders/<channel>/<stem>-coverage.mp4`), not a placeholder or an old artifact.
2. **Duration and technical properties.** Run `ffprobe` to confirm container, codec (h264/aac), resolution (1080x1920), FPS (30), and duration matches the timeline (`durationInFrames / fps`).
3. **Extract representative frames.** Pull frames at meaningful timestamps (beat starts, concept changes) using FFmpeg `-ss`.
4. **Extract frames around scene transitions.** Frame the boundary between consecutive beats so you can judge whether the transition is clean or abrupt.
5. **Create a readable contact sheet.** Use FFmpeg `tile` to lay out representative frames into a single contact-sheet image for quick scanning.
6. **Inspect individual frames at full resolution.** Zoom into each extracted frame to read text, check credits, and verify composition.
7. **Check beginning, middle, and end.** Do not judge the whole video from one spot; sample the hook, the middle beats, and the closing beat.
8. **Check narration and audio alignment.** Confirm the visual on screen at each moment matches what is being narrated (use the word timings / captions).
9. **Check caption timing and readability.** Confirm captions sit inside their beat span, are large enough (>=24px equivalent), have a scrim/dark background, and remain on screen long enough to read.
10. **Check image quality, composition, cropping, contrast, text placement.** Verify each image is the right asset, correctly cropped/fit, legible, with credits visible and not covered.
11. **Check whether motion is meaningful.** Every pan/zoom/drift should reveal information, direct attention, establish context, or transition beats — never arbitrary blanket movement.
12. **Identify repeated or visually monotonous scenes.** Consecutive beats with the same composition or a held image too long.
13. **Identify irrelevant images and generic filler.** Label cards, random imagery, or generic diagrams unrelated to the narration.
14. **Identify abrupt transitions, black frames, frozen frames, and broken rendering.** Black stretches, near-static holds > 4s, flashes, missing assets.
15. **Produce a timestamped creative review with specific corrections.** A dated, timestamped list of defects and the exact fix for each (e.g. "at 12.4s the diagram holds static for 5s — add purposeful motion or split the beat").

## Outputs

For each inspected MP4, save:
- The MP4 identification (path, size, duration, codec, resolution).
- The extracted frames (individual JPG/PNG at beat/transition timestamps).
- The contact sheet image.
- A timestamped creative-review report (markdown) listing defects with timestamps and specific corrections.

Evidence must be saved to disk — a review that isn't saved isn't a review.

## Helper scripts (`scripts/video-review/`)

- `extract-frames.mjs` — extract frames at given timestamps via FFmpeg.
- `contact-sheet.mjs` — build a contact sheet via FFmpeg `tile`.
- `inspect-props.mjs` — report duration/codec/resolution via FFprobe.

These scripts shell out to `ffmpeg` / `ffprobe`. They are CI/machine tools; they are not a substitute for actually looking at the frames.

## Environment limitation (this machine)

FFmpeg and FFprobe are **not installed** on this Windows machine and there is no network to install them. Therefore:
- Frame extraction, contact-sheet generation, and FFprobe technical checks **cannot be executed here**.
- No MP4 has been rendered on this machine (no FFmpeg encoder), so there is nothing to inspect.
- **No visual review has been performed, and none can be claimed.**

The skill file and helper scripts are correct and ready to run on any machine with FFmpeg/FFprobe (including the GitHub Actions runner, which installs FFmpeg). When FFmpeg becomes available, run the full 15-step inspection on each channel MP4 and save the evidence listed above.

## Separation from rendering

This skill reviews a finished MP4. It does not call Remotion, does not render, and does not decide what to render. It tells you whether what was rendered actually communicates the narration.
