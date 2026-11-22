# Story Clarity Standard

**Repository:** lumeierecollection-blip/YOUTUBE
**Applies to:** All four production channels (1, 2, 3, 4)
**Companion:** docs/production/FOUR_CHANNEL_PRODUCTION_STANDARD.md

## 1. Purpose

Every video must be understandable to someone who knows absolutely nothing about its subject. The Margaret Clitherow benchmark proved the visual pipeline works, but its narration assumes the viewer already knows who Margaret Clitherow was, why priests were being hidden, who Guy Fawkes was, and what the Gunpowder Plot attempted. That assumption must be eliminated.

This standard defines the viewer-understanding rule, the required writing principles, and the script clarity validation gate that runs before TTS generation.

## 2. The Viewer-Understanding Rule

Every script must naturally answer these questions:

| # | Question | Why it matters |
|---|----------|----------------|
| 1 | WHO are we talking about? | Viewers can't follow unnamed people |
| 2 | WHEN did this happen? | Chronology grounds the story |
| 3 | WHERE did it happen (when location matters)? | Place provides context |
| 4 | WHAT actually happened? | The core event must be clear |
| 5 | WHY did it happen? | Motivation and cause |
| 6 | WHY should the viewer care? | Relevance and stakes |
| 7 | WHAT happened as a consequence? | Outcome and legacy |

Not every video needs seven explicit statements, but the viewer must receive the necessary context to follow the story without pausing to work out what the narration means.

## 3. Required Writing Principles

### 3.1 Introduce people with context

Never drop a name without explaining who the person is. Instead of:

"Margaret Clitherow was executed for harbouring priests."

Write:

"Margaret Clitherow was a Catholic woman in 1580s England. At the time, Catholic priests were outlawed, and she was executed for hiding one in her home."

### 3.2 Explain institutions, laws, and terminology

Unfamiliar terms must be defined at first use:

- "Priest holes" -> "secret hiding places built into Catholic homes"
- "Peine forte et dure" -> "the punishment of being pressed to death under heavy weights"
- "The Gunpowder Plot" -> "a 1605 conspiracy to blow up Parliament"

### 3.3 Explain the event before discussing its significance

Establish what happened before analyzing why it mattered. The viewer needs the facts before the interpretation.

### 3.4 Use clear transitions between people and periods

When moving from Margaret Clitherow (executed 1586) to Guy Fawkes (active 1605), bridge the gap:

"Nearly twenty years after Clitherow's death, another name from York would become infamous: Guy Fawkes."

### 3.5 Establish cause and effect without inventing certainty

Distinguish established facts from theories:

- Fact: Clitherow was executed in 1586.
- Theory: Historians theorise Guy Fawkes may have witnessed her execution.

Use language like "historians theorise," "some accounts suggest," or "records show" appropriately.

### 3.6 Avoid unexplained names, dates, titles, references

Every proper noun must be introduced with enough context for a new viewer to understand who or what it refers to.

### 3.7 Avoid unnecessary complexity and academic language

Plain words over jargon. Short sentences over long ones. One idea per sentence where possible.

### 3.8 Maintain a compelling opening hook

The hook must grab attention while still being comprehensible to a new viewer.

### 3.9 Make the ending meaningful and memorable

The closing should restate why the story matters, not trail off.

## 4. Anti-Patterns (What Fails Review)

| Anti-pattern | Example | Fix |
|--------------|---------|-----|
| Unintroduced person | "She was executed for harbouring priests." | "Margaret Clitherow, a Catholic woman, was executed..." |
| Unexplained term | "She refused pleine forte et dure." | "She refused to enter a plea, so they pressed her to death under weights..." |
| Missing chronology | "Twenty years later, Guy Fawkes..." | "Nearly twenty years after Clitherow's 1586 death, in 1605, Guy Fawkes..." |
| Unsupported causal claim | "Clitherow's death caused the Gunpowder Plot." | "Historians theorise Fawkes may have witnessed Clitherow's execution..." |
| Abrupt transition | (Clitherow -> Fawkes with no bridge) | Add a sentence bridging the two decades and connecting the themes. |
| Unclear pronoun | "He saw it and was changed." | Name who "he" is and what "it" refers to. |
| Commentary without substance | "That's a shocking reality." | Replace with specific information about what happened. |

## 5. Script Clarity Validation Gate

### 5.1 When it runs

The clarity gate runs before TTS generation, in the pipeline between script readiness and narration generation. If the gate identifies a substantive problem, the script must be revised before narration is generated.

### 5.2 What it checks

The check (scripts/check-script-clarity.mjs, powered by Gemini) reads the script as a viewer who knows nothing about the story and returns:

- what_happened: the event reported (who did what, to whom, where, when), or null
- who / where / when: as stated in the narration, or null
- question: the mystery the narration opens, or null
- answered: true only if a later sentence plainly answers the question
- answer: the sentence number that answers it, or null
- unclear: every sentence a viewer could not follow, with n (sentence number), text (the sentence), and why (what the viewer cannot tell)

### 5.3 Deterministic pre-checks

Before the AI review, deterministic checks validate:
- Script has at least one spoken sentence
- Every sentence has a speaker/subject (no dangling pronouns without antecedents)
- Chronology markers (dates, years) appear in order or with explicit bridging
- No sentence is purely commentary without information

### 5.4 Gate decision

| Result | Action |
|--------|--------|
| All clear | Proceed to TTS generation |
| Minor unclear items (1-2, non-substantive) | Log warning, proceed, note in review |
| Substantive problems (missing who/what/when/where, unanswered question, unclear references) | Block TTS — script must be revised and resubmitted |

A simple keyword check is not equivalent to genuine editorial review. The AI-assisted review is required for substantive clarity assessment.

## 6. Integration with Production Pipeline

The clarity gate is inserted into the production workflow between script readiness and generate-narration:

setup -> source-historical-images -> check-script-clarity -> generate-narration -> build-timeline -> ...

The clarity check runs in parallel with image sourcing (both depend only on setup). Narration generation waits for clarity to pass.

If clarity fails:
- The job exits non-zero
- Downstream jobs (narration, timeline, render, QA) are skipped
- The script is returned for revision
- No video is produced for that script

## 7. Channel-Specific Application

Each channel applies the same clarity standard but with its own subject matter:

- Channel 1 (History Untold): Historical figures, events, periods — requires the most context-setting (who, when, where, why)
- Channel 2 (AI Tool Reviews): Tools, features, pricing — explain what the tool does before comparing it
- Channel 3 (Celebrity Feuds): Court cases, people, rulings — explain who the people are and what the case is about
- Channel 4 (Sports Rivalries): Teams, matches, tactics — explain the rivalry and what happened before analyzing why

Each channel's niche_rules in config/channels.json must be consistent with this standard.