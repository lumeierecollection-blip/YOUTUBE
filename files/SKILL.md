---
name: mograph-critic
description: Look at rendered video frames and diagnose why the motion graphics look amateur, then fix and re-render. Use this whenever a render finishes, whenever the user says the output looks robotic, misaligned, stiff, cheap, or "not like real motion graphics", and before claiming any visual change works. Always use this instead of reasoning about animation code without looking at pixels.
---

# Mograph Critic

You cannot judge motion from source code. Render, look, diagnose, fix, re-render.

## The loop

```
render sample → free deterministic check → (only if needed) vision check → fix → repeat
```

Hard cap: **3 iterations per composition**. On the 3rd failure write `qa/BLOCKED.md`
with what you changed each round and what the report still says, then stop.

## Step 1 — Render a cheap sample

Never QA a full-length final render. Render 6 seconds at half resolution:

```bash
npx remotion render <CompId> out/qa.mp4 \
  --frames=0-179 --scale=0.5 --concurrency=1 --jpeg-quality=70
```

If a shot is long, render the first 2s and last 2s separately — entrances and
exits are where robotic motion shows.

## Step 2 — Free deterministic check (always run this first)

```bash
python scripts/qa_frames.py --video out/qa.mp4 --report qa/report.json --sheet qa/sheet.jpg
```

This costs nothing and catches most of the real defects. It reports:

- **`velocity_linearity`** per moving span — the number that matters most. It is
  velocity uniformity: 1.0 means the element travels at perfectly constant speed,
  which is exactly what makes everything look robotic. A proper ease-out lands
  around 0.1–0.4; ease-in-out around 0.4–0.6. **Anything at or above 0.80 is a
  hard defect. Fix it before you look at anything else** — it is the single
  highest-leverage change in this whole document.
- **`margin_violations`** — content inside the unsafe zone. For 1080x1920 Shorts,
  the default safe area is 9% left/right, 10% top, 20% bottom expressed as
  fractions, so it holds at any render scale. The bottom band is large because
  YouTube's UI covers it.
- **`alignment_clusters`** — how many distinct left-edge x positions elements use.
  More than 3 on one frame means there is no grid. Real mograph uses 1–2.
- **`holds`** — frames where nothing changes. A dead hold longer than 0.5s in a
  Short is a defect; something should always be settling, drifting, or breathing.
- **`contrast_fail`** — text whose luminance sits too close to what's behind it.
- **`popcorn`** — elements entering on the same frame. Real mograph staggers.

Fix everything the free check flags. Do not spend a vision call yet.

## Step 3 — Vision check (only when Step 2 is clean and it still looks wrong)

`qa_frames.py` also writes a contact sheet: 12 frames in a 4x3 grid, ~1280px wide,
one image. That is deliberately one image, not 12 — one image is one cheap call.

```bash
python scripts/vision_critic.py --sheet qa/sheet.jpg --out qa/critique.json
```

The critic is asked three questions and nothing else:

1. What is the single worst thing about this frame sequence?
2. Name the specific element (by position and content) that is wrong.
3. What concrete change fixes it — a number, not an adjective.

Reject any critique that returns adjectives without numbers ("make it smoother")
and re-ask once with "give me frame counts and easing curve names."

**The critic model must support vision.** Most free OpenCode Zen models do not.
Set `VISION_MODEL` to a vision-capable model; if none is configured, `vision_critic.py`
exits non-zero and you should say so plainly rather than pretending you looked.

## Step 4 — Fix

Every fix must cite a shot recipe card from the video-shotcraft skill. Copy its
actual parameters. If no card matches, say so and pick the nearest one rather
than inventing curve values.

## Step 5 — Prove it

Re-render, re-run `qa_frames.py`, and report the before/after numbers side by side.
A fix that does not move a number in the report is not a fix.

## What "robotic" actually means, mechanically

When someone says the render looks robotic, it is almost always one of these five,
in this order of frequency:

1. **Linear interpolation.** Everything moves at constant speed. Nothing in the
   physical world does this. Fix: cubic-bezier ease-out on entrances (fast in,
   slow settle), ease-in on exits.
2. **Simultaneity.** Six things appear on frame 0 together. Fix: stagger by 2-4
   frames, in reading order.
3. **No overshoot.** Elements arrive exactly at their target and stop dead. Fix:
   overshoot 3-8% and settle back over ~6 frames. Use spring where the card says spring.
4. **No hierarchy.** Every element is the same size and weight, so the eye has
   nowhere to go. Fix: one dominant element per scene at 3-4x the size of the
   secondary.
5. **Cuts with no connective tissue.** Scenes replace each other. Fix: something
   must carry across the cut — a color, a shape, a continuing motion vector.

## What not to do

- Do not add more effects to fix a timing problem. Glow does not fix linearity.
- Do not tune values by feel across many files at once. One composition, one
  variable, one render.
- Do not report "visual quality improved" without the report diff.
