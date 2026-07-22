---
name: script-writer
description: Use after deep-research and trend-research findings have been confirmed by the user. Turns confirmed research into a Shorts or long-form YouTube script, strictly grounded in the confirmed source material, sized to the target format.
---

# Script Writer Skill

## Purpose
Convert user-confirmed research into a finished script — never generate
facts from general knowledge, only from the confirmed research handed to
this skill.

## Preconditions
Only run this after the user has explicitly confirmed which research
findings to use. If no confirmation exists yet, stop and ask for it
instead of writing a script.

## Format specs

**Shorts (target ~45-60 seconds spoken, ~110-150 words)**
- Hook in the first 2-3 seconds — a specific fact or claim, not a generic
  question
- One core idea, no tangents
- Ends on a payoff or a reason to watch the next one

**Long-form (target 8-12 minutes spoken, ~1100-1700 words)**
- Cold open hook (10-15 seconds)
- 3-5 section structure, each grounded in a distinct researched fact/angle
- Natural transitions between sections
- Close that reinforces the core takeaway

## Rules
- Every factual claim in the script must trace back to a specific item in
  the confirmed research — no exceptions.
- If the confirmed research doesn't support a claim needed for pacing,
  flag the gap to the user instead of inventing something to fill it.
- Output should note, per line or section, which research source it came
  from (for audit purposes), even if that annotation is stripped before
  final voiceover.
