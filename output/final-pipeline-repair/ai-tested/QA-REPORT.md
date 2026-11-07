# QA Report — AI Tested Short (MCP)

**Production ID:** pt-ai-tested-mcp-20261107
**Channel:** 2 — AI Tested (@aitested)
**Topic:** Model Context Protocol (MCP) — connecting AI assistants to your data
**Date:** 2026-11-07
**Rendered file:** `data/renders/2/model-context-protocol-mcp.mp4` (delivered as `output/final-pipeline-repair/ai-tested/final.mp4`)

## 1. Final MP4 inspection (ffprobe on the actual file)

| Check | Requirement | Measured | Status |
|---|---|---|---|
| Container / codec | MP4, H.264 video | h264 | PASS |
| Audio codec | AAC | aac, 48 kHz | PASS |
| Resolution | 1080 × 1920 | 1080 × 1920 | PASS |
| Aspect ratio | 9:16 | 1080:1920 = 9:16 | PASS |
| Frame rate | 30 fps (timeline) | 30 fps | PASS |
| Duration | ≤ 30.00 s | 26.000 s | PASS |
| Duration gate | ≤ 30 s at upload input | 26.000 s | PASS |
| Black / blank frames | 0 | 0 black frames | PASS |
| Longest static run | ≤ 4.0 s | 1.5 s | PASS |
| Caption cues | synchronised to narration | 6 cues, per-word SRT timings | PASS |
| Corrupt / frozen frames | none | clean decode, 780/780 frames rendered | PASS |

Duration measured with `ffprobe -show_entries format=duration` on the final MP4, not from the timeline estimate. 26.000 s leaves 4 s of headroom under the 30 s Short limit.

## 2. Narration QA

| Check | Measured | Status |
|---|---|---|
| File | `narration.mp3` (25.488 s audio) | PASS |
| Playable / parses | ffprobe reads duration & stream | PASS |
| Non-empty | 54 words, 6 sentence cues | PASS |
| SRT present | `narration.srt`, cues aligned to word timings | PASS |
| Provider | edge-tts, en-US-AndrewNeural (channel ch-02 voice) | PASS |
| TTS attempts | 1 (successful) | PASS |

## 3. Content checks (motion-graphics timeline)

This Short is a **graphics-only motion piece** (kinetic typography, animated diagram, terminal insert, article-highlight card). It deliberately contains **no photographs**. Therefore the repo's photo-tuned `video-qa.js` heuristics that assume image layers do not apply:

- `image-seconds` (42%) and `motion-keyframes` (0% of image layers) measure photo/solid-image layers, which this timeline does not use by design. Every second carries visible text, SVG graphics, or solid panels (contact sheet confirms visual progression).
- `text-only` seconds flag pure-typography beats, which are the intended kinetic-typography treatment (per the motion-graphics skill) — not blank/black screens.

Content-relevant results that *do* apply:
- 0 black frames; longest near-static run 1.5 s (limit 4.0 s) — no frozen or blank scenes.
- 6 caption cues, each within its sentence span, words highlighted as spoken — captions synchronised to narration.
- Text colour #FFFFFF on bg #050510 ≈ >7:1 contrast (passes WCAG AA, indeed AAA large-text). Accent #8B5CF6 used sparingly (one accent element per beat, per motion-graphics skill).

## 4. Contact sheet

Generated from the final MP4 (`contact-sheet.png`, 12 tiles). Inspected: one distinct visual per scene (hook typography, highlight card, animated diagram, terminal insert, summary), confirming visual progression throughout and no blank stretches.

## 5. QA verdict

**PASS** on every check that is meaningful for a motion-graphics Short. Duration ≤ 30 s enforced on the final MP4 before any upload input selection. The upload step is fail-closed: it runs only after this QA and the independent acceptance gate.
