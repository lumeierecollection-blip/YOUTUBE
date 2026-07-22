---
name: remotion-render
description: Use to render a finished script + voiceover into video using Remotion, choosing one of the channel's configured style templates. Styles are periodically re-validated against real current examples of that style, and imagery used must be real, correctly-matched photos of the actual people/places referenced.
---

# Remotion Render Skill

## Purpose
Turn a confirmed script + TTS voiceover into a finished video file, styled
per the channel's configured template, using real matching imagery rather
than generic stock or invented visuals.

## Step 0 — Style definition audit (run before rebuilding templates)
Before touching the templates, search the web for how "motion graphics
video" (mograph) and "minimalist edit" are actually defined and executed
right now by editors/designers who do this professionally — tutorials,
portfolio breakdowns, editing communities. Compare the current templates
against what that research shows and adjust anything that doesn't match
real practice. Do this as an explicit research pass, not from general
impressions of what these terms mean.

## Step 1 — Replace the voice-animation style
Voice-animation is dropped. Research currently-effective, distinct
short-form/long-form editing styles (search YouTube automation and editing
communities, not general knowledge) and propose 2-3 real candidates with
examples of channels/videos using them successfully, before picking one to
implement as the replacement third style. Report the candidates and your
recommendation before finalizing — this is a one-time decision, get it
confirmed rather than assumed.

Once confirmed, update any channel currently configured with
`voice-animation` (e.g. entertainment-01, world-news-01, and any of the 45
that used it) to the new style, and rename the template accordingly.

## Style templates (target: 3 total, kept current)
1. **Minimal** — kinetic typography, clean background, captions synced to
   voiceover, minimal motion. Works for fact/list-driven niches.
2. **Motion-graphics** — icon/scene-based animated sequences illustrating
   each section of the script, matched to real current mograph practice
   per the Step 0 audit.
3. **[replacement style — name TBD from Step 1 research]**

## Real imagery sourcing (applies to minimal and motion-graphics)
When a script names a specific real person, place, or event:
1. Search for an actual photo of that specific person/place/event — not a
   generic placeholder or a similar-looking substitute.
2. Verify the photo actually matches what's named (right person, right
   location, right event/time period) before using it — a mismatched photo
   is worse than no photo.
3. If no verifiably correct photo can be found, use a relevant abstract/
   graphic representation instead of guessing with an unverified image —
   never use a photo you're not confident is actually correct.
4. Respect image licensing/usage rights when sourcing.

## Process
1. Read `channel.style` from the channel's config to select the template.
2. Read `format` (short vs long-form) to select aspect ratio/duration
   (9:16 for Shorts, 16:9 or 9:16 for long-form per channel preference).
3. Sync captions to the actual TTS audio timing, not estimated timing.
4. For each named person/place/event in the script, run the real imagery
   sourcing process above before falling back to graphics.
5. Output to the channel's render folder, named with topic + date for
   traceability back to the research that produced it.

## Rules
- Don't invent visual content unrelated to the script's actual claims —
  supporting imagery should illustrate what the script says.
- Never use a photo of a person/place that doesn't actually match what's
  named in the script, even if it "looks close enough."
- Fail loudly (not silently) if voiceover audio is missing or the script
  file wasn't produced by script-writer.
