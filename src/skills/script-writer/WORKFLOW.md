# Script Writer Skill — Workflow

## Purpose
Transforms deep-research JSON into a fully structured video script tailored to the channel's visual style. The script-writer reads research data, applies channel-specific templates, and outputs a production-ready script with timing, B-roll cues, and SFX instructions.

## Process

### Step 1 — Load Channel Configuration
Read `config/channels.json` to extract:
- `style` — determines which template to use (cinematic-documentary, minimal, motion-graphics)
- `tone` — influences voiceover phrasing and pacing
- `tts_voice` — voice ID for final TTS pass
- `colors` — referenced in B-roll style cues
- `font` — referenced in text overlay instructions

### Step 2 — Load Research Data
Read `data/research/{channel_id}/{topic-slug}.json`. Required fields:
- `topic` — the video subject
- `key_facts` — array of `{fact, source, date}`
- `strongest_angle` — the narrative hook
- `passes` — research depth indicator

### Step 3 — Select Template
Based on `style` field from channel config:

| Style | Template File | Visual Approach |
|-------|---------------|-----------------|
| `cinematic-documentary` | `templates/cinematic-documentary.js` | Slow pans, archival footage, dramatic reveals |
| `minimal` | `templates/minimal.js` | Kinetic typography, clean backgrounds, text-forward |
| `motion-graphics` | `templates/motion-graphics.js` | Animated diagrams, illustrated explainers, data viz |

### Step 4 — Generate Script Sections
The script-writer produces a JSON script object with these sections:

```
hook (0:00–0:30)
  ↓
section_1 (0:30–3:00)
  ↓
section_2 (3:00–5:30)
  ↓
section_3 (5:30–7:30)  [optional, if content warrants]
  ↓
close (7:30–8:30)
```

### Step 5 — Write Output
Save to `data/research/{channel_id}/{topic-slug}-script.json`

---

## Script Structure by Style

### Cinematic-Documentary
- **Hook**: Dramatic single statement over slow reveal shot. No intro, no channel name.
- **Body**: Each section opens with a question or tension point. Voiceover drives pacing. B-roll is atmospheric — no text overlays unless critical.
- **Close**: Callback to hook statement. End on emotional resonance, not information.
- **Pacing**: 130–140 words per minute. Allow 2–3 second pauses between sections for visual breathing room.

### Minimal (Kinetic Typography)
- **Hook**: Bold claim or statistic in large type. Text appears word-by-word synced to beat.
- **Body**: Each section is a new "screen" — background color shifts. Key terms animate on screen. Voiceover is faster, more conversational.
- **Close**: Final stat or call-to-action in oversized type. No fade — hard cut to end.
- **Pacing**: 150–160 words per minute. Text animations drive rhythm, not voiceover.

### Motion Graphics
- **Hook**: Animated diagram or map zooming into the subject. Text overlay is minimal — let the graphic tell the story.
- **Body**: Each section introduces a new illustrated element. Transitions are animated (scale, rotate, morph). Data appears as animated charts or flow diagrams.
- **Close**: Full illustration recap. Key takeaway appears as final frame.
- **Pacing**: 140–150 words per minute. Voiceover waits for graphic animations to complete.

---

## Hook Formulas (Ranked by Retention)

| Rank | Formula | Template | Example |
|------|---------|----------|---------|
| 1 | "In [year], [shocking event] changed [topic] forever." | all | "In 1986, a single decision buried 350,000 people alive." |
| 2 | "[Statistic] of [topic] will [emotional outcome]." | minimal, motion | "90% of what you know about [topic] is wrong." |
| 3 | "This is the story of [person/thing] that [unexpected result]." | cinematic-doc | "This is the story of a lighthouse that killed its keepers." |
| 4 | "Everyone thinks [common belief]. The truth is [twist]." | all | "Everyone thinks these caves are empty. The truth is terrifying." |
| 5 | "Before [event], [topic] was [state]. After, nothing was the same." | cinematic-doc | "Before the flood, this city was paradise. After, it was a graveyard." |

### Hook Rules
- Hook must be under 15 seconds of spoken word
- First word should be a number, name, or strong action verb
- Never open with the channel name or "welcome to"
- Never open with a question — make a statement

---

## Section Break Patterns

### Cinematic-Documentary
```
[VISUAL: Slow pan / archival shot] 3–5 sec silence
[VOICEOVER: Section opener — new question or tension point]
[VOICEOVER: 2–3 paragraphs of narrative]
[VISUAL: Atmospheric B-roll, no text] 2–3 sec
```

### Minimal
```
[BACKGROUND: Color shift animation] 0.5 sec
[TEXT: Section title, large type, word-by-word appear]
[VOICEOVER: Direct, punchy sentence]
[TEXT: Key stat or term animates on]
```

### Motion Graphics
```
[GRAPHIC: Previous element scales out] 0.5 sec
[GRAPHIC: New illustrated element enters from edge]
[VOICEOVER: Explains what the graphic will show]
[GRAPHIC: Animated build of diagram/chart/flow]
[VOICEOVER: Walks through the animation step by step]
```

---

## Voiceover Pacing Guidelines

| Style | WPM | Pause Between Sections | Pause After Hook |
|-------|-----|----------------------|------------------|
| Cinematic-Documentary | 130–140 | 2–3 sec | 1–2 sec |
| Minimal | 150–160 | 1 sec (hard cut) | 0.5 sec |
| Motion Graphics | 140–150 | 1.5 sec | 1 sec |

### Pacing Rules
- Never rush the first sentence after the hook — let it land
- Slow down for emotional moments (death, failure, tragedy)
- Speed up for lists, numbers, or exciting reveals
- End sections on a strong word, not a filler word
- Total script word count target: 1,000–1,200 words for 8-minute video

---

## CTA Placement Rules

### Primary CTA (Subscribe/Like)
- **Placement**: End of Section 2 OR beginning of Section 3
- **Format**: Natural language, not "please subscribe"
- **Examples**:
  - "If this kind of deep dive is your thing, you know what to do."
  - "More stories like this — link's in the description."
  - "Hit subscribe if you want the next chapter."

### Secondary CTA (Video/Playlist)
- **Placement**: During close section
- **Format**: End screen reference
- **Example**: "The full playlist is on screen now. Start from the beginning."

### CTA Rules
- Never put CTA in the hook or first 60 seconds
- Never use more than 2 CTAs per video
- CTA must feel earned — only after delivering value
- CTA must match the channel's tone (no cheerful CTAs on dark channels)

---

## Quality Checklist

### Before Export
- [ ] Hook is under 15 seconds of spoken word
- [ ] Hook opens with a number, name, or action verb
- [ ] Total word count is between 1,000–1,200 words
- [ ] Every section has a clear visual cue (B-roll, graphic, or text)
- [ ] Every section has an SFX cue for transitions
- [ ] CTA appears only after the 2-minute mark
- [ ] CTA count is 1 or 2 (never 3)
- [ ] No section starts with "So," "Now," or "And"
- [ ] Voiceover pacing matches the template's WPM target
- [ ] All key facts from research JSON are used or explicitly noted as unused
- [ ] No fabricated facts — every claim traces to a research source
- [ ] Close callbacks to the hook statement
- [ ] Final sentence is a strong, declarative statement (not a question)

### Style-Specific Checks
**Cinematic-Documentary:**
- [ ] At least 2 sections have 2+ second visual-only pauses
- [ ] No text overlays unless absolutely necessary
- [ ] B-roll descriptions are atmospheric, not literal

**Minimal:**
- [ ] Every section has a text animation cue
- [ ] Background color shifts at least 3 times
- [ ] Text is short enough to read in under 3 seconds

**Motion Graphics:**
- [ ] Every section has a graphic element described
- [ ] At least one animated data visualization (chart, map, diagram)
- [ ] Transitions between graphics are specified (scale, morph, slide)

---

## Output Schema

The script JSON written to `data/research/{channel_id}/{topic-slug}-script.json`:

```json
{
  "channel_id": "ch-01",
  "topic": "How Toys R Us Failed",
  "topic_slug": "toys-r-us-failure",
  "style": "cinematic-documentary",
  "tone": "investigative-dramatic",
  "total_words": 1100,
  "estimated_duration_seconds": 480,
  "sections": [
    {
      "id": "hook",
      "timing": "0:00–0:30",
      "word_count": 50,
      "voiceover": "In 2017, Toys R Us filed for bankruptcy. 73,000 employees lost their jobs. The company that defined childhood... was dead.",
      "visual_cue": "Slow zoom on abandoned Toys R Us storefront. Lights flickering.",
      "sfx_cue": "Low drone, subtle wind",
      "b_roll": ["empty toy store aisles", "Toys R Us logo in rain", "bankruptcy headline montage"],
      "text_overlay": null,
      "transition_out": "Fade to black, 1.5 sec"
    },
    {
      "id": "section_1",
      "timing": "0:30–3:00",
      "word_count": 350,
      "voiceover": "...",
      "visual_cue": "...",
      "sfx_cue": "...",
      "b_roll": ["..."],
      "text_overlay": null,
      "transition_out": "..."
    }
  ],
  "cta_primary": {
    "placement": "section_2_start",
    "text": "If this kind of deep dive is your thing, you know what to do."
  },
  "cta_secondary": {
    "placement": "close",
    "text": "The full playlist is on screen now."
  },
  "production_notes": "Total B-roll clips needed: ~25. Recommend 4K archival footage sourcing."
}
```
