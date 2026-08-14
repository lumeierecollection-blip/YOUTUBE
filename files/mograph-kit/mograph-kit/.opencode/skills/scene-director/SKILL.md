---
name: scene-director
description: Decide the exact visual treatment for every individual scene of a video before it renders — which primitive, which transition, which asset, which timing — instead of letting a generic blueprint guess. Use this whenever building a scene plan, generating a shot list, choosing components or transitions for a script, or whenever renders come out inconsistent, mismatched, or generically templated across scenes.
---

# Scene Director

The blueprint is the reason every video looks the same and every scene looks
slightly wrong. A blueprint picks components by keyword. A director picks them
by what the line of narration is doing.

This skill runs **once per video, before any rendering**, and emits a scene plan
that the renderer executes literally. The renderer should make zero aesthetic
decisions.

## Input

The script, split into beats, with per-beat narration text and TTS duration in
seconds. Nothing else.

## Output

`plans/<video-id>.scene-plan.json`. One object per scene. Every field mandatory —
if you cannot fill a field, the plan is not done.

```json
{
  "video_id": "...",
  "canvas": { "w": 1080, "h": 1920, "fps": 30 },
  "grid": { "column_x": 96, "baseline_y": 640, "safe_bottom": 380 },
  "scenes": [
    {
      "index": 0,
      "narration": "exact line of VO",
      "duration_frames": 84,
      "function": "hook",
      "energy": 9,
      "dominant_element": { "type": "hero_word", "content": "COLLAPSE", "size_px": 220 },
      "supporting_elements": [],
      "shot_card": "flash-cut-title",
      "entrance": { "curve": "cubic-bezier(0.16,1,0.3,1)", "frames": 12, "overshoot_pct": 5 },
      "exit": { "curve": "cubic-bezier(0.7,0,0.84,0)", "frames": 8 },
      "stagger_frames": 3,
      "transition_out": { "type": "match-cut-on-color", "carries": "accent" },
      "asset": null,
      "reason": "Opening line is a stated shock. One word, maximum size, no competition."
    }
  ]
}
```

## The decision rules

Work through these in order for each scene. Do not skip to picking a component.

**1. What is this scene's function?** One of: hook, setup, escalation, turn,
evidence, payoff, cta. The function determines everything downstream. A hook and
an evidence scene should not look alike.

**2. What is its energy, 1-10?** Read the narration. A number, a contradiction,
or a reversal is high energy. A qualifier or a bridge is low. Then check the
sequence: energy must not be flat across scenes and must not sawtooth randomly.
Aim for a rising staircase with one drop before the payoff. If your energy column
reads 7,7,7,7 the video will feel monotonous no matter how good each scene is.

**3. What is the one thing the viewer must see?** Exactly one dominant element
per scene. If you list two, you have failed this step — pick one and demote the
other. The dominant element gets 3-4x the visual weight of anything else.

**4. Which shot card?** Look it up in the video-shotcraft skill by function and
energy. Copy its parameters verbatim into `entrance`/`exit`. Never write a curve
you invented. If nothing matches, name the nearest card and record the deviation
in `reason`.

**5. What carries across the cut?** Every `transition_out` must name something
that survives into the next scene — a color, a shape's position, a motion vector,
a continuing count. If nothing carries, the cut will read as a slideshow. Never
use the same transition twice in a row.

**6. What asset, if any?** Prefer none. An asset is only justified when the
narration names a concrete thing that typography cannot express. If you do use
one: it must be at or above canvas resolution (upscaling is the visible blur in
your current output), pre-downloaded to a local path before render (remote URLs
get rate-limited by Remotion's concurrent frame fetching), and consistent in
art style with the other assets in the same video.

## Consistency pass (run after all scenes are planned)

Before emitting the plan, check the whole sequence:

- Every scene's dominant element sits on the same `column_x` or is deliberately centered. Two competing alignments across a video is what reads as "everything is everywhere."
- No transition type repeats back to back.
- Energy curve rises overall with exactly one dip.
- Total planned frames matches total TTS duration within 2 frames per scene.
- Every `shot_card` value exists in the shot library. Grep to confirm — do not assume.
- No scene has more than 3 elements on screen at once.

Fail any of these and revise the plan before rendering. Rendering a bad plan
wastes far more than fixing it.

## Model routing

This skill is the reasoning-heavy step and it runs once per video, so it is worth
the better model. The renderer that executes the plan is mechanical and can run
on the cheapest model available — it is only translating JSON into TSX.
