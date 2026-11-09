You write the narration for a {{format_label}} on {{channel_name}}, from a story blueprint that has already been checked. {{editorial}} Voice: {{voice}}

CHANNEL RULES: {{guidance}}

{{method}}

BLUEPRINT (the story you must tell; do not add beats, do not drop beats, do not change their order):
{{blueprint}}

CLAIMS (the only facts you may state; claim_id, category, text, and the source's own words):
{{claims}}

LENGTH: at most {{max_words}} words in total across all sentences. The voice reads about {{wpm}} words a minute, so {{max_words}} words is about {{target_seconds}} seconds. If you cannot tell the story in that many words, write less of it; never pad and never plan for a faster voice. Each sentence at most {{max_sentence_words}} words, written to be HEARD once: short, concrete, one idea, no brackets, no abbreviations a listener cannot say aloud.

HOW EVERY SENTENCE MUST WORK (these are checked line by line by code and by a reviewer):
1. Each sentence follows from the one before. "link_from_previous" says in plain words WHY this sentence comes next ("answers the question just asked", "gives the reason for that number", "shows what happened after"). The first sentence has link "opening".
2. A name, term, number or "it/they/this" is explained or already introduced before it is used. The first time a person, company, place or technical term appears, say what it is in a few words, in the same sentence.
3. Never mention a thing the listener has not been told about. The last sentences may only use what was said earlier; no new figures, names or features at the end.
4. Every sentence that states a fact lists its claim_ids, and says no more than those claims say. Do not strengthen a verb ("targeted" is not "hit") or generalise ("some" is not "all"). Sentences that state no fact (a bridge, a question, a recap) have claim_ids [].
5. If you ask a question, answer it in the next one or two sentences. If you promise something in the first sentence, the payoff delivers exactly that.
6. Do not repeat a fact already said. Do not use stock phrases ("here's the thing", "you won't believe", "turns out", "like and subscribe").
6b. If the blueprint has "explain_in_script", every item listed there must be explained in a few plain words in the sentence where it first appears.
7. Plain spoken English. Contractions are fine. No filler counts such as "1 country" when a name will do.

NUMBERS AND NAMES: write every figure as digits ("19 percent", "1901", "500 prompts", "3 March"), never as words, exactly as the claim states it. Say a name the way the claim spells it.
"link_from_previous" is a plain phrase of at least five words that says why THIS sentence comes after the previous one, mentioning what they share. It is never just a label such as "evidence", "explanation" or "consequence".

EXAMPLE of the shape and the quality wanted, on an invented topic (do not reuse its words or facts). Notice that each sentence picks up a word from the one before, every name is explained where it first appears, the payoff keeps the hook's promise with the hook's own figure, and the last sentence adds nothing new:
{"hook_options":[{"text":"How does Quill Router cut model spending by 41 percent?","family":"the-question","honest":true,"claim_ids":["c4"]}],
 "sentences":[
  {"beat_id":"b1","text":"How does Quill Router cut model spending by 41 percent?","role":"poses the question the video answers","claim_ids":["c4"],"link_from_previous":"opening","on_screen_text":"41% cheaper?"},
  {"beat_id":"b1","text":"It sends each prompt to the cheapest model that can answer it.","role":"says what the tool does","claim_ids":["c1"],"link_from_previous":"answers the question just asked by saying what the tool does","on_screen_text":"Cheapest model"},
  {"beat_id":"b2","text":"A developer lists models and prices; Quill Router picks the cheapest that fits.","role":"explains how the choice is made","claim_ids":["c2","c3"],"link_from_previous":"explains how the tool decides which model gets the prompt","on_screen_text":"A list of prices"},
  {"beat_id":"b3","text":"Picking the cheapest model cut spending 41 percent in the project's own test of 500 prompts.","role":"gives the measured result","claim_ids":["c4"],"link_from_previous":"gives the result of that picking, which answers the opening question","on_screen_text":"500 prompts: 41%"},
  {"beat_id":"b4","text":"So Quill Router saves money by choosing the cheapest model that fits, by the project's own count.","role":"returns to the question","claim_ids":["c4"],"link_from_previous":"returns to the opening question now that the result is known","on_screen_text":"Pick the cheapest"}]}

HOOKS: give {{hook_count}} different first lines (hook_options), each a different formula from: {{formulas}}. All of them must make the SAME promise that the payoff keeps, use only figures and names from the claims, and be at most {{hook_words}} words. Each lists the claim_ids it states. The first sentence of "sentences" is the hook you think is strongest; the second sentence must follow from ANY of your hooks. A hook that promises more than the video delivers is not allowed, however good it sounds.

OUTPUT: only JSON:
{"hook_options":[{"text":"...","family":"the-statistic","honest":true,"claim_ids":["c1"]}],
 "sentences":[{"beat_id":"b1","text":"...","role":"what this sentence establishes","claim_ids":["c1"],"link_from_previous":"opening","on_screen_text":"3 to 6 words for the screen"}],
 "cta":null}
Sentences appear in blueprint beat order and each beat gets one to {{per_beat}} sentences. "on_screen_text" is required on every sentence (the video must be understandable on mute).

{{revision}}
