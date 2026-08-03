# Script Pipeline — Detailed Workflow

## Overview
This workflow orchestrates the full script generation pipeline. Each phase is a distinct step that builds on the previous one. The pipeline is designed to be run by an agent (Task tool) or manually triggered.

---

## PHASE 1: TOPIC RESEARCH

### Step 1.1 — Load Channel Config
Read `config/channels.json` and extract for the target channel:
```json
{
  "id": 1,
  "niche": "Personal Finance (Budgeting for Beginners)",
  "style": "minimal",
  "channel_name": "Money Mind",
  "tone": "friendly-encouraging",
  "tts_voice": "en-US-JennyNeural",
  "content_pillars": ["50/30/20 budget breakdowns", "debt payoff strategies", "saving challenges", "budget tool reviews", "money mindset shifts"]
}
```

### Step 1.2 — Load Topic History
Read `data/topic-log.json` and extract:
```json
{
  "used_topics": ["topic-slug-1", "topic-slug-2"],
  "last_generated": "2026-07-27T12:00:00Z"
}
```

### Step 1.3 — Research Passes (minimum 3)

**Pass 1 — Broad Web**
Search: `"[niche keywords]" trending 2026` or `"best [niche] YouTube topics"`
Purpose: Understand current landscape, recent developments, popular angles

**Pass 2 — Narrow/Factual**
Search: Based on Pass 1 findings, search for specific facts, statistics, events
Purpose: Verify facts, find concrete data points, identify strong specific-result hooks

**Pass 3 — Practitioner**
Search: `"how to grow [niche] YouTube channel" 2026` or `"best [niche] YouTube channels"`
Purpose: See what successful channels are covering (to differentiate, not copy)

**Pass 4 — Social/Community**
Search: `site:reddit.com [niche topic]` or `"[niche] why" forum discussion`
Purpose: Find genuine audience questions and pain points (hook gold)

### Step 1.4 — Topic Ranking
Rank all researched topics by:
1. **Hook potential** — Does it have a specific-result or curiosity-gap hook?
2. **Freshness** — Is it trending now or evergreen?
3. **Differentiation** — Is it different from competitor content?
4. **RPM alignment** — Does it attract high-CPM advertisers?
5. **Visual potential** — Does the channel's style work for this topic?

---

## PHASE 2: DEDUPLICATION CHECK

### Step 2.1 — Exact Match Check
Compare selected topic against `used_topics` list. Reject if exact match.

### Step 2.2 — Semantic Similarity Check
For each topic in `used_topics`, check if the new topic is semantically similar:
- Same person/company/event? → Reject
- Same historical period/event from different angle? → Accept (different angle is OK)
- Same niche but different sub-topic? → Accept
- Overlapping facts but different framing? → Accept

### Step 2.3 — Topic Slug Generation
Generate a URL-safe slug for the topic:
- Lowercase, hyphens for spaces
- Max 60 characters
- Example: `"how-toys-r-us-failed"` or `"titanic-sinking-preventable"`

### Step 2.4 — Log the Topic
Update `data/topic-log.json`:
```json
{
  "used_topics": ["existing-topic", "new-topic-slug"],
  "last_generated": "2026-07-27T14:30:00Z"
}
```

---

## PHASE 3: HOOK OPTIMIZATION

### Step 3.1 — Load Hook Templates
Read `data/hook-templates.json` and extract:
- `niche_hook_mapping[channel_id]` — primary and secondary hook types
- `hook_rankings` — the ranked formulas

### Step 3.2 — Generate 3 Hook Variations
Using the primary hook type for this niche, generate 3 variations:

**Example for Channel 7 (Dead Companies) — primary: "specific-result"**

Variation A: "In 2017, Toys R Us filed for bankruptcy. 73,000 employees lost their jobs."

Variation B: "This company was worth $11 billion. Five years later, it was worth zero."

Variation C: "The CEO of WeWork turned down a $4 billion acquisition offer. Within two years, his company was worthless."

### Step 3.3 — Hook Evaluation
Score each hook against these criteria:
- [ ] Opens with number, name, or strong action verb?
- [ ] Under 15 seconds spoken (roughly 35-40 words)?
- [ ] Creates immediate curiosity or emotional impact?
- [ ] Is a statement, not a question?
- [ ] Uses specific facts from research (not generic)?
- [ ] Matches the channel's tone?

Pick the highest-scoring hook.

### Step 3.4 — Hook Rules (NEVER violate)
- ❌ Never open with "In this video, we're going to talk about..."
- ❌ Never open with "Welcome to [channel name]"
- ❌ Never open with a question (make it a statement)
- ❌ Never use vague language ("Have you ever wondered...")
- ❌ Never promise something you can't deliver in the video

---

## PHASE 4: SCRIPT GENERATION

### Step 4.1 — Select Template by Style
| Style | Template | WPM | Section Count | Pauses |
|-------|----------|-----|---------------|--------|
| `cinematic-documentary` | Slow dramatic | 130-140 | 4-5 sections | 2-3 sec between sections |
| `minimal` | Fast punchy | 150-160 | 3-4 sections | 1 sec (hard cut) |
| `motion-graphics` | Moderate animated | 140-150 | 4-5 sections | 1.5 sec between sections |

### Step 4.2 — Script Structure

**All Styles Follow This Skeleton:**

```
[HOOK — 0:00-0:30]
- Deliver the payoff/visual FIRST, explain SECOND
- Use the selected hook formula
- Show the most dramatic visual from the video

[SECTION 1 — 0:30-2:30]
- Context and background
- End on a micro-loop tease into Section 2
- Pattern interrupt at 2:00 mark

[SECTION 2 — 2:30-5:00]
- Deep dive into core topic
- Data overlays for key statistics
- B-roll is the PRIMARY teaching tool
- Micro-loop at end (tease next section)

[SECTION 3 — 5:00-7:30]
- Escalation or investigation
- Reveal the key insight at 60-70% through video
- Strategic silence (750ms-1000ms) after major revelations

[CLOSE — 7:30-end]
- Resolution or broader implications
- Callback to hook phrase in final line
- CTA integrated naturally
```

### Step 4.3 — Apply Retention Techniques

**Micro-Loops (end of each section):**
Pick from these formulas:
- "But that's just the beginning..."
- "And that's when things got dangerous."
- "What happened next changed everything."
- "But here's what nobody talks about..."
- "And that's just the first problem."

**Pattern Interrupts (every 60-90 seconds):**
- New visual approach (different B-roll style)
- Surprising fact or statistic
- Perspective shift (zoom in/out, angle change)
- Music change or silence
- Text overlay with key number

**Strategic Silence (750-1500ms):**
Place after:
- Major revelations
- Shocking facts
- Emotional moments
- Key statistics

**Statistics with Context:**
Formula: State the number → pause → contextualize with comparison or emotional weight.
Example: "47 billion dollars. That's more than the GDP of half the countries on Earth. Gone in six months."

### Step 4.4 — Quality Checklist

Before finalizing:
- [ ] Hook is under 15 seconds spoken
- [ ] Hook opens with number, name, or action verb
- [ ] Total word count is 1,000-1,700 (8-12 min video)
- [ ] Every section has a clear visual cue
- [ ] Every section has an SFX cue
- [ ] CTA appears only after 2:00
- [ ] CTA count is 1-2 (never 3)
- [ ] No section starts with "So," "Now," or "And"
- [ ] Voiceover pacing matches template
- [ ] All key facts from research are used
- [ ] No fabricated facts
- [ ] Close callbacks to hook
- [ ] Final sentence is declarative (not a question)
- [ ] Micro-loop at end of every section
- [ ] Pattern interrupt every 60-90 seconds
- [ ] Strategic silence after reveals

---

## PHASE 5: OUTPUT & TRACKING

### Step 5.1 — Generate Script JSON
Save to `data/scripts/{channel_id}/{topic-slug}.json`:

```json
{
  "channel_id": "7",
  "channel_name": "Dead Companies",
  "topic": "How Toys R Us Failed",
  "topic_slug": "toys-r-us-failure",
  "style": "cinematic-documentary",
  "tone": "investigative-dramatic",
  "generated_at": "2026-07-27T14:30:00Z",
  "total_words": 1150,
  "estimated_duration_seconds": 510,
  "hook": {
    "type": "specific-result",
    "text": "In 2017, Toys R Us filed for bankruptcy. 73,000 employees lost their jobs. The company that defined childhood... was dead.",
    "spoken_duration_seconds": 12,
    "visual_cue": "Slow zoom on abandoned Toys R Us storefront. Lights flickering.",
    "sfx_cue": "Low drone, subtle wind"
  },
  "sections": [
    {
      "id": "section_1",
      "timing": "0:30-2:30",
      "word_count": 280,
      "voiceover": "...",
      "visual_cue": "...",
      "sfx_cue": "...",
      "b_roll": ["..."],
      "text_overlay": null,
      "transition_out": "...",
      "micro_loop": "But that's just the beginning. What happened next would take down a $11 billion empire.",
      "pattern_interrupt": "New fact at 2:00 — 'What most people don't know is that Toys R Us actually tried to sell to Amazon in 2000.'"
    }
  ],
  "close": {
    "word_count": 150,
    "voiceover": "...",
    "callback_to_hook": true,
    "final_line": "73,000 jobs. 11 billion dollars. And it all started with one bad decision."
  },
  "cta_primary": {
    "placement": "section_2_start",
    "text": "If this kind of deep dive is your thing, you know what to do."
  },
  "cta_secondary": {
    "placement": "close",
    "text": "The full playlist is on screen now."
  },
  "research_sources": [
    { "fact": "...", "source": "...", "date": "..." }
  ],
  "production_notes": "Total B-roll clips needed: ~25. Recommend 4K archival footage sourcing."
}
```

### Step 5.2 — Update Topic Log
Add to `data/topic-log.json`:
```json
{
  "used_topics": ["existing-topic", "new-topic-slug"],
  "last_generated": "2026-07-27T14:30:00Z"
}
```

### Step 5.3 — Report to User
Return summary:
```
Script generated for [Channel Name]
Topic: [Topic]
Hook: [Hook text]
Hook Type: [specific-result] (71% avg 30-sec retention)
Word Count: 1,150
Estimated Duration: 8.5 minutes
Sections: 5
Research Sources: 12
```

---

## AUTOMATION SCHEDULE

### Recommended Cadence
| Content Type | Frequency | Script Length | Notes |
|-------------|-----------|---------------|-------|
| Long-form | 2x/week (Tue/Fri) | 1,000-1,700 words | Primary content |
| Shorts | 3x/week (Mon/Wed/Sat) | 110-150 words | Clips from long-form or standalone |

### Pipeline Trigger
The pipeline can be triggered:
1. **Manually**: User says "generate script for channel X"
2. **Scheduled**: Cron job triggers for each channel on its day
3. **Batch**: Generate multiple scripts in one run

---

## ERROR HANDLING

### Topic Exhaustion
If no unique topics can be found:
1. Broaden search terms
2. Look at trending news in adjacent niches
3. Consider sub-topics within the niche (deeper dives)
4. Flag to user for manual topic suggestion

### Research Gaps
If research doesn't support a needed claim:
1. Flag the gap explicitly
2. Don't invent facts
3. Suggest alternative angles that ARE supported
4. Let user decide: skip, research more, or use placeholder

### Hook Failure
If none of the ranked hooks work for a topic:
1. Try combining two hook types
2. Use the strongest fact from research as the hook
3. Fall back to "curiosity-gap" (lowest rank but always works)
