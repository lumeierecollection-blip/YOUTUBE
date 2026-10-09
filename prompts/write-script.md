# Stage C — Write Script (narrative engine)

You are given JSON in the INPUT section of this message: the frozen research
artifact, the channel's style/tone/format/`script_template`, and (for
motion-graphics channels) its `concepts` archetype allocation. Everything you
need is in that section — you have no web access, no file access, and nothing
to ask the user for.

You are writing a YouTube Short. It will be read aloud by a narrator. It must
sound like a person talking, not a news wire. **This is not a summary. It is a
story with a hook, tension, a re-hook, and a payoff.** The viewer clicks away
in the first 3 seconds unless you give them a reason to stay.

**Every fact, name, number and date comes from the research and is about THIS
video's subject.** The examples below show SHAPE only — they are not facts for
this video. Never invent a figure, a name, a date or a consequence to make the
story work: if the research cannot support a beat, tell the story the research
DOES support. A research fact about a different story is never used.

`seo_keywords` (may be empty): the terms trending in this channel's YouTube
category this week. Where one honestly describes what the research says, use
that word in the title and the hook. A keyword is wording, never a source.

Follow the style contract in your system prompt — grounding, pacing and the
structural rules the renderer depends on (`text_overlay` shape, no colour
values).

## Length — a hard gate

**Voiceover word count: 92-107 words in total. This is a BLOCKER gate, not a
guideline.** The gate converts words to seconds at the narrator's real pace and
rejects anything outside 36-52 seconds; under 92 fails exactly like over 107.
Aim for about 100 words.

**The target per beat — count as you write:**

    HOOK:     10–14 words
    SETUP:    30–40 words
    RE-HOOK:  10–18 words
    PAYOFF:   30–42 words
    CLOSE:     8–14 words
    Total:    92–107 words

These are ranges to land inside, not ceilings to stay under. That is 9-10
sentences in all, each carrying ONE fact.

Count the words before returning. If your script is under 92
words, expand the setup and payoff with specific facts. If it
is over 107, cut the least essential sentence. The word count
is a hard requirement.

## STRUCTURE — five beats, in this order, as five sections

Write `sections` as exactly five objects with these ids, in this order:
`hook`, `setup`, `rehook`, `payoff`, `close`. `hook` (the top-level field) is
the HOOK sentence, word for word.

1. **HOOK** (section `hook`, ONE sentence, 10–14 words). A promise, a shock, a
   contradiction, or stakes — never a setup, never a fact without a stake. The
   first sentence IS the punch. One of:
   - Contradiction: "Banks said the money was safe. It disappeared in 48 hours."
     → as ONE sentence: "The money banks called safe disappeared in 48 hours."
   - Stakes: "Buy a house this year and you'll pay $40,000 more than last year's buyer."
   - Mystery: "The FBI found $3 million in a storage unit, and its owner was already dead."
   - Specific shock: "One line in your mortgage contract costs $200 a month."
   Never: "Here's what happened", "Let me tell you", "Have you ever wondered",
   a person's name first, "According to", "The report".
2. **SETUP** (section `setup`, 3 sentences, 30–40 words). Just enough context for
   the payoff to land. Each sentence adds one specific fact — a number, a name,
   a place, an action — and starts with a DIFFERENT kind of subject. The LAST
   setup sentence ends on a question the viewer now has (a literal question,
   or a line that withholds the answer) — and the question NAMES its figure,
   place, person or object ("Where did the $91 million go?", never "Where did it
   all go?"): a nameless question is a words-only card, and the re-hook right
   after it would be a second one in a row.
3. **RE-HOOK** (section `rehook`, 1-2 sentences, 10–18 words). The second hook,
   right where the viewer might leave. It FLIPS the setup ("Except the bank
   made one mistake.") or RAISES the stakes ("And the person who signed it
   worked for the buyer."). It still names something specific. Never "But
   wait, there's more", "Here's the thing", "What happened next".
4. **PAYOFF** (section `payoff`, 3 sentences, 30–42 words). Deliver the hook's
   promise: (1) the reveal, (2) the consequence, (3) the specific number or
   action. It names a person, place or organization AND a specific number.
   No hedging: never "may", "could", "might", "possibly" — state the fact the
   video was built to deliver.
5. **CLOSE** (section `close`, ONE sentence, 8–14 words). What the viewer does
   with what they now know — a specific action, or the payoff's most concrete
   detail. Never "stay informed", "follow for more", "thanks for watching",
   "the future is uncertain". A close that states a fact still needs that fact
   from the research.

## SHOW IT — every sentence is one picture (short-video-scripter rules, carried in)

The renderer draws one picture per sentence from what the sentence NAMES. A
sentence that names nothing drawable becomes a words-only card; the renderer
allows at most one words-only card in any three sentences, so a script of
abstractions cannot be arranged at all. Write so each sentence has a thing to
show:

- **What the renderer can draw from a sentence** — name these where the research
  gives them, in the sentence that needs the picture:
  a figure with its unit ("$352 million", "34%") → a number or chart (two figures
  → bars); a stated rise or fall with its subject ("fell", "doubled", "tumbled")
  → a trend line; a place by name → its map; a named person, company, court or
  building → a real photo or logo; a physical object (banknotes, a tanker, a gold
  bar) → the object; a cause and its effect in one sentence → a flow diagram; a
  risk, threat, crime, approval or tracking word → a drawn symbol; dated events →
  a timeline; three or more things in a comma list → a list. A sentence that
  names none of these is a words-only card.
- **One idea per sentence, one drawable thing per idea** — a person, a place,
  an object, a figure with its unit, a dated event. Never two ideas to save
  words; never an idea with nothing to point at.
- **The hook survives muted autoplay.** Its first words are what is on screen
  in the first two seconds, so it names the concrete thing (the number, the
  place, the object) — not a feeling about it.
- **Confirm the hook before anything else (the 2-5 s beat most drafts skip).**
  The FIRST setup sentence is proof the hook's promise is real: the document,
  the amount, the place, the date — the thing that can be shown. Not
  background.
- **Escalate: each sentence is bigger or closer than the last** — a larger
  figure, a nearer place, a more specific person, a worse or better
  consequence. If a sentence could swap places with the one before it, it is
  not escalating; cut or reorder it. Escalate with the research's facts only.
- **Pay off in steps, one idea per step** (reveal, consequence, number), each
  step a different drawable thing.
- **Close on the loop or the act.** Either the CLOSE echoes the HOOK's own key
  noun or number (the last frame can feed the first for a rewatch), or it names
  the one specific action. Both must still come from the research.
- **Drama is made of the research's own facts, never added to them.** Board run
  37919459134 ch-9 lost the video to the claims gate for "vanished from global
  radar" and "Washington pulled the plug" — vivid verbs the research never
  states. Where the research says "17 vessels were sanctioned", the sentence says
  that, with its number; a sharper-sounding verb the research does not contain is
  an invented claim and the channel is skipped. Escalate by choosing the
  biggest, nearest fact the research DOES state, in the order that builds.
- A sentence that is only a judgement ("That changes everything", "It matters")
  is words-only. Allowed at most once in three sentences, and only when the
  research gives no object for it — never invent an object to avoid it.

## RULES

- **Every sentence earns the next.** Read it aloud; if it doesn't make you
  want the next sentence, rewrite it. No summaries — a sentence that restates
  what the viewer already knows is cut. The script only moves forward.
- **Vary the subject.** A person's name may START at most ONE sentence in the
  whole script, and never as a full name ("Jerome Powell raised…" is banned;
  "Powell raised…" may open one sentence). Other sentences start with a
  pronoun, an action, a place, a number, a time, a question or an object.
- **Vary the structure.** No two consecutive sentences start with the same
  word. Mix: subject-verb ("The Fed raised rates."), question ("Why now?"),
  number first ("0.25% — that's the increase."), place first ("In Washington,
  …"), time first ("On September 18, …"), action first ("Raising rates was the
  only option.").
- **Every sentence names something**: a person, place, organization, number,
  date or physical object — on average 1.5 or more per sentence, and at least
  two concrete nouns (a courthouse, a $100 bill, Powell, Miami) for every
  abstract one (trend, strategy, impact, future).
- **Sound like a person.** Contractions ("it's", "won't", "they're"). Average
  12 to 18 words a sentence; NO sentence over 25 words. Active voice.
- **Write figures in digits with their unit** ("$352 million", "34%", "10,000
  robots") — the narrator reads them as words, and the video can only chart a
  figure it can read.
- **Shape a sentence so it can be SHOWN** when the research gives the shape: a
  comparison with its keyword ("42% versus 31%", "from X to Y"), dated events
  with their dates, a list with commas. This changes wording, never which facts
  there are.

## BANNED

Banned OPENINGS (no sentence starts with): a person's full name, "According
to", "Officials said", "The report states", "Data shows", "In a statement",
"This trend", "Experts say", "Let's dive into", "Here's why".

Banned PHRASES (anywhere): "This trend is expected to", "It's important to",
"In today's world", "The key takeaway is", "Industry leaders are", "As we look
ahead", "It remains to be seen", "Only time will tell", "At the end of the
day", "Here's what nobody tells you", "Not gonna lie", "Let me be honest".

## Check before you finish — rewrite until every line is true

- The HOOK is one sentence and promises something specific (a number, a shock,
  a contradiction or a stake).
- The last SETUP sentence ends on a question the viewer now has.
- The RE-HOOK flips the setup or raises the stakes.
- The PAYOFF names a specific number and outcome, with no "may / could / might".
- The CLOSE is one specific, actionable sentence, or echoes the hook's own
  key noun or number.
- The first SETUP sentence proves the hook with something that can be shown.
- No two sentences swap places without loss (each is bigger or closer than the
  one before); at most one sentence in three names nothing drawable.
- 0 banned openings, 0 banned phrases, 0 sentences over 25 words, at most 1
  sentence starting with a person's name, no two consecutive sentences
  starting with the same word.
- Every sentence names a person, place, organization, number, date or object
  from the research about this subject.
- 92-107 words in all.
- `sources_used` has 2 or more URLs that appear in the research's
  `key_facts` / `numbers`, and every one is used by something you wrote.
- If you were given the motion-graphics beat schema: each `anchor_token` is
  copied VERBATIM from its own section's voiceover, and every `data.series`
  value is a real research `numbers[].value` (a PROGRESS beat needs >= 2).

Write the full script now: `channel_id`, `topic_slug`, `format`, `hook`,
`sections[]`, and `sources_used`. Return `structured_output` matching the
provided JSON Schema exactly — nothing outside it.
