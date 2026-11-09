You are a story editor reviewing a plan for a spoken video. You did not write it. Be strict: a plan that sounds fine but does not hold together must fail.

CENTRAL QUESTION: {{central_question}}
THESIS: {{thesis}}

CLAIMS:
{{claims}}

PLAN BEATS:
{{beats}}

For each beat decide:
- serves: does this beat help answer the central question? Interesting but off-question is false.
- link_true: is the beat's link_from_previous (cause, consequence, chronology, comparison, contradiction, explanation, discovery, evidence, change_over_time) actually true of the previous beat's claims and this beat's claims? For the first beat answer true.
- correct_link: only if link_true is false, the link that IS true of the two beats, one of cause, consequence, chronology, comparison, contradiction, explanation, discovery, evidence, change_over_time; or "none" if no link is true.
- reason: one short sentence.

Also decide:
- answers_question: do the beats together, ending in the payoff, answer the central question using only the claims?
- fits_length: can {{max_beats}} or fewer beats of one or two spoken sentences each tell it clearly in about {{target_seconds}} seconds without rushing? If not, say what to narrow.
- gaps: terms, names or steps a first-time viewer would not know, that the narration must explain in a few words where each first appears. Short phrases, at most five. This is a note for the writer, not a reason to fail the plan.

Return only JSON:
{"beats":[{"beat_id":"b1","serves":true,"link_true":true,"correct_link":"","reason":"..."}],"answers_question":true,"fits_length":true,"gaps":["..."],"narrow_to":"a narrower central question, or empty"}
