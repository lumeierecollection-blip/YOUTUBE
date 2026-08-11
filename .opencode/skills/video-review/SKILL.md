---
name: video-review
description: Use to visually verify a rendered video BEFORE confirming it is done. Extracts real frames from the rendered MP4, runs a deterministic pixel audit against the style manual, and records the output so a vision-capable reviewer (human or model) can actually look. A render is never confirmed on assumption - frames must exist and be measured.
---

# Video Review Skill

## Purpose
The pipeline's model cannot safely claim a render "looks fine" without
evidence. This skill produces that evidence: real frames from the actual
rendered file, plus measured pixel checks against the style manual. It does
not replace a human eye - it makes an honest review possible.

## Hard rules
- A render is NOT confirmed until: (1) `video-review.js` extracted frames
  successfully, (2) `frame-audit.js` passed every frame, and (3) a
  vision-capable reviewer (human, or vision-capable model) has actually
  viewed the frames / contact sheet. Any of the three missing = not reviewed.
- Text-only models cannot see images. Do NOT claim "I looked at the frames".
  Report what the pixel audit measured, and explicitly flag anything the
  audit cannot measure as UNVERIFIED, not as fine.

## How to run
Extract frames (10 evenly spaced, or pick a count):
```
node scripts/video-review.js <video.mp4> --frames 10 --out data/audit/render-review/<run-id>
```
Audit the frames against the style manual rules:
```
node scripts/frame-audit.js data/audit/render-review/<run-id>
```
Outputs: `frame-XX.png`, `contact-sheet.png`, `manifest.json`,
`audit-report.json`. In CI the render job does this automatically and uploads
the `render-frames-<run-id>` artifact (retention 7 days).

## What the pixel audit measures (MOTION-GRAPHICS-MANUAL.md)
- A2.1 background is flat (no gradient) - margin-region channel stddev.
- A1.3 nothing renders outside the SAFE rect (top 288 / right 888 / bottom
  1248 / left 48) - foreground fraction in the margin strips.
- A1.3 Caption zone (y 1152-1248) contains text on every frame (persistent).
- A1.3 Rail (progress rule at x 48) is present and fills.
Every rule is a MUST in the manual, so a violation is a render rejection.

## What the audit CANNOT check - say UNVERIFIED, never assume
- 8px-grid compliance and zone-boundary alignment of specific elements:
  that is a code-level property (audit-layout lane, style tokens).
- Typography quality, kerning, optical weight, aesthetic judgement.
- Exact colour fidelity to tokens/OKLCH (measured bg is reported per frame;
  compare against expected palette values yourself).
- Motion, easing, timing feel - frames are stills; check MOTION-BLUEPRINT
  timing in code (audit-motion lane).
These belong to the audit lanes and to a vision-capable reviewer, and any of
them left unverified must be reported as unverified.

## Verdict protocol
1. `video-review.js` exit != 0 -> "NOT reviewed: frames incomplete".
2. `frame-audit.js` exit != 0 -> list each violating frame + timestamp and
   rule; verdict "DO NOT CONFIRM".
3. All measured checks pass -> state exactly what was measured, then hand
   the frames/contact sheet to the user (or vision-capable reviewer) for the
   final look. Nothing is "done" until that look happened.