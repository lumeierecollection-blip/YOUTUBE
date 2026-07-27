---
name: script-pipeline
description: Full script generation pipeline — researches topics per channel, checks for duplicates, selects optimal hooks based on retention data, and generates production-ready scripts with strong hooks and retention structure.
---

# Script Pipeline Skill

## Purpose
End-to-end script generation that ensures every video has:
1. A unique, researched topic (never repeated on the same channel)
2. A hook optimized for 30-second retention (using ranked formulas)
3. A structure that maximizes watch time (micro-loops, pattern interrupts, strategic silence)

## When to Use
- Before rendering any video (this is the first step in the pipeline)
- When the user asks to "generate a script" or "make a video for channel X"
- As part of the automated pipeline (scheduled or manual trigger)

## Prerequisites
- `config/channels.json` must exist with channel configurations
- `data/topic-log.json` must exist (deduplication tracking)
- `data/hook-templates.json` must exist (hook formulas)
- Internet access for web research

## Process

### Phase 1: Topic Research
1. Read `config/channels.json` to get channel niche, style, and tone
2. Read `data/topic-log.json` to get previously used topics for this channel
3. Run 3-4 search passes per the `deep-research` skill:
   - Pass 1: Broad web search on the niche
   - Pass 2: Narrow/factual pass with specific terms
   - Pass 3: Practitioner pass (what other YouTube channels in this niche are covering)
   - Pass 4: Social/community pass (Reddit, forums, trending discussions)
4. Filter out any topics that overlap with `used_topics` in the topic log
5. Rank remaining topics by: trending potential, freshness, RPM alignment, hook potential

### Phase 2: Topic Selection & Deduplication
1. From researched topics, select the top candidate
2. Check against `topic-log.json` for semantic duplicates (not just exact matches)
3. If topic is too similar to an existing one, reject and try next candidate
4. Once confirmed unique, log it to `topic-log.json`

### Phase 3: Hook Optimization
1. Read `data/hook-templates.json` → `niche_hook_mapping` for this channel ID
2. Select the primary hook type for this niche
3. Generate 3 hook variations using the ranked formulas
4. Pick the hook with highest expected retention (specific-result > contrarian > direct-promise)
5. Ensure hook follows rules:
   - Under 15 seconds spoken
   - Opens with number, name, or strong action verb
   - No "welcome to" or channel name
   - No questions as openers (make statements)

### Phase 4: Script Generation
1. Read channel config for style, tone, pacing
2. Load the appropriate template (cinematic-documentary, minimal, or motion-graphics)
3. Generate script following the `script-writer` skill's workflow
4. Apply retention techniques:
   - Micro-loops at end of each section
   - Pattern interrupts every 60-90 seconds
   - Strategic silence after reveals (750-1500ms)
   - Callback close to hook
   - Statistics with context
5. Output the full script JSON per the schema

### Phase 5: Update Tracking
1. Add the topic to `data/topic-log.json` under the channel's `used_topics`
2. Update `last_generated` timestamp
3. Save the script to `data/scripts/{channel_id}/{topic-slug}.json`

## Output
- Script JSON file at `data/scripts/{channel_id}/{topic-slug}.json`
- Updated `data/topic-log.json` with the new topic logged
- Summary to user with: topic, hook, word count, estimated duration, sections

## Rules
- Never generate a topic that's already in the channel's `used_topics` list
- Every fact in the script must come from actual web research (not general knowledge)
- Hook must be from the ranked formulas — don't invent new hook styles
- Follow the channel's style template exactly (pacing, transitions, SFX)
- If research doesn't support a needed claim, flag the gap — don't invent
