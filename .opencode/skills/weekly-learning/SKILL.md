---
name: weekly-learning
description: Use on a weekly cadence to analyze real audience retention data per video, compare against real competitor performance in the same niche, and turn findings into concrete adjustments to script-writer, remotion-render, and niche-discovery — never a guessed or invented improvement.
---

# Weekly Learning Skill

## Purpose
Make the system actually improve over time — retention, scripting,
editing, and topic choice — based on real data, not assumptions about
what "should" work better.

## Process (run weekly, per channel)

1. **Pull real retention data.** Use the YouTube Analytics API's audience
   retention metrics (`audienceWatchRatio` and relative retention curves)
   for the week's videos. Identify where viewers actually drop off —
   specific timestamps/sections, not a vague "engagement was low."
2. **Correlate drop-off with the actual script/edit.** Check what was
   happening in the video at the drop-off point (which script section,
   which visual style moment, which SFX/VFX choice) — this ties a real
   number to a real content decision, not a guess.
3. **Competitor benchmarking pass.** Separately, search for what real
   top-performing channels in the same niche are doing differently this
   week (structure, pacing, hook style, topic angles) — grounded in actual
   searched examples, not general assumptions about "what works."
4. **Turn findings into concrete adjustments:**
   - Update `script-writer` guidance for that niche (e.g. shorten a
     section type that's consistently losing viewers, strengthen hooks
     that match what's retaining well)
   - Update `remotion-render`/`vfx-audit` settings if a visual choice
     correlates with drop-off
   - Feed topic-angle findings into `niche-discovery`/`trend-research` for
     future topic selection
5. **Log every adjustment** with the retention number or competitor
   example that justified it, per channel per week — this is the audit
   trail that proves nothing was changed on a guess.

## Rules
- Never make an adjustment without a specific retention number or a
  specific real competitor example behind it — "this might work better"
  is not a valid basis for a change here.
- Don't over-correct from a single week's data on a low-sample channel —
  note sample size/confidence, and prefer patterns that hold across
  multiple weeks before making a bigger structural change.
- Keep per-channel and per-niche learnings separate — what works for one
  niche's audience may not transfer to another.
