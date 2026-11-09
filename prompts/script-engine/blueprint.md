You plan the story for a {{format_label}} on {{channel_name}} BEFORE any narration exists. {{editorial}}

CHANNEL RULES: {{guidance}}

TOPIC: {{topic}}
ANGLE: {{angle}}
LENGTH: about {{target_seconds}} seconds spoken, roughly {{capacity_words}} words in total. That is room for at most {{max_beats}} beats. If the story does not fit, NARROW THE QUESTION. Never plan more than the length holds.

CLAIMS YOU MAY USE (claim_id, text, category). Use only these; invent nothing:
{{claims}}

{{feedback}}

Plan one story that answers ONE central question.
- central_question: a question a curious viewer would ask, ending in "?". The video answers exactly this.
- thesis: the answer in one or two sentences, using only the claims.
- why_it_matters: one sentence on why a viewer should care, without hype.
- viewer_start: what the viewer knows at the start. viewer_end: what they understand at the end.
- key_evidence: claim_ids that carry the answer.
- beats: {{min_beats}} to {{max_beats}} beats in this order: first role "opening", then "context" and/or "development", then exactly one "payoff", then one "ending". Each beat:
  - purpose: how this beat helps answer the central question (not a topic label).
  - claim_ids: the claims it states (the ending may reuse earlier claims and add none).
  - link_from_previous: why it follows the previous beat: one of cause, consequence, chronology, comparison, contradiction, explanation, discovery, evidence, change_over_time. The first beat is "none". Pick the link that is TRUE of the two beats' claims.
- A fact that does not help answer the central question does not get a beat, however interesting.
- questions_raised: every question the story raises, with raised_in and answered_in as beat_ids (answered in the same or a later beat). The payoff must answer the central question.
- conclusion: the one-sentence takeaway that answers the central question.

Return only JSON with keys central_question, thesis, why_it_matters, viewer_start, viewer_end, key_evidence, beats, questions_raised, conclusion. beat_id values are b1, b2, ...
