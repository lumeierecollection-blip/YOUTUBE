# Stage C — Write Script

You are given JSON in the INPUT section of this message: the frozen research
artifact, the channel's style/tone/format/`script_template`, and (for
motion-graphics channels) its `concepts` archetype allocation. Everything you
need is in that section — you have no web access, no file access, and nothing
to ask the user for.

`seo_keywords` (may be empty): the terms trending in this channel's YouTube
category this week. Where one honestly describes what the research says, use
that word in the title and the hook — a keyword spine. Never add a claim to
fit a keyword; a keyword is wording, not a source.

Follow the style contract in your system prompt exactly — it covers
grounding (cite only from the research you were given), pacing, hook
construction, and the structural rules the renderer depends on
(`text_overlay` shape, no colour values, and for motion-graphics channels the
archetype table and the `anchor_token` verbatim rule).

**Duration cap: ALL videos must be 30-45 seconds.** At 30 fps this means
900-1350 frames.

**Voiceover word count: 76-93 words. This is a hard gate, not a guideline.**
The gate converts your word count to a duration using the channel's
words-per-minute target and the actual TTS delivery rate, then REJECTS the
script if it falls outside 30-45 seconds. 76-93 is the range that is safe
for every channel's voice, so staying inside it always passes; going under
76 fails just as hard as going over 93. Aim for the middle (~85 words).

Do NOT write short to save render time. A script under 76 words is rejected
and the whole channel produces nothing that day.

Write the full script now: `channel_id`, `topic_slug`, `format`, `hook`,
`sections[]`, and `sources_used`. Return `structured_output` matching the
provided JSON Schema exactly — nothing outside it.

## Before you finish

- **anchor_token MUST be a word or phrase that appears VERBATIM in that
  section's voiceover text.** After writing each section's voiceover, pick
  the anchor_token FROM the voiceover words you just wrote — do not invent
  it. Example: if voiceover says "Housing costs consume thirty-four point
  nine percent", valid anchors are "thirty-four point nine", "percent",
  "Housing costs". Invalid: "modification", "essentials", "allocate" (if
  those words don't appear in the voiceover). Write the voiceover FIRST,
  then extract the anchor from it.
- Every value in any beat's `data.series` is one of the research's real
  `numbers[].value` entries (copied exactly, with its real unit) — never
  invented, derived, or a binary 0/1 encoding of a contrast. If it isn't
  in `numbers[]`, it must not be charted.
- **PROGRESS beats need >=2 series points.** A PROGRESS beat with only 1
  point is rejected. Use at least 2 real numbers from `numbers[]`.
- Voiceover word count is inside the format range in the style contract.
- For motion-graphics: primary archetypes 50% or more of beats, secondary
  35% or less, excluded 0%.
- `sources_used` has 2 or more URLs that actually appear in the research's
  `key_facts`/`numbers`, and every one is used by something you wrote.
- **Write figures in digits with their unit** in the voiceover ("$352
  million", "34%", "10,000 robots", "6 levels") — the narrator's voice reads
  them as words automatically, and the video can only chart a figure it can
  read. (The anchor_token rule above still applies: an anchor copied from
  such a sentence is copied as written, digits included.)
- **EVERY sentence names something real and specific** — a person (full
  name), a place, an organization, a number (amount, percentage, count,
  date), a physical object, or a named actor doing a specific thing ("Powell
  raised rates", not "rates went up"). Take every one of them from the
  research (`key_facts`, `numbers`, `named_entities`). A sentence that would
  name nothing is replaced by one that names something from the research, or
  cut. **Never invent a name, a figure, a date or an object to meet this** —
  a sentence the research cannot make specific is cut, not decorated.
  Every named fact is about THIS video's subject: a research fact about a
  different story (an unrelated conflict, company or place the search happened
  to return) is never used, however specific it is.
  The examples below show the SHAPE only; they are not facts for this video.
  ALLOWED shape: "Jerome Powell raised rates by 0.25% on September 18." /
  "The Miami federal courthouse ruled against the company." /
  "The SEC charged the firm's founder with fraud."
  FORBIDDEN: "Rates are going up." / "Companies are adopting AI." /
  "This trend is expected to continue." / "Experts say it's complicated."
  Each sentence is scored by the number of specifics it names (0, 1, 2+);
  the script must average at least 1.5 and no sentence may score 0
  (`scripts/validate-script.cjs`). Prefer concrete nouns (a courthouse, a
  gavel, a warehouse, Powell, Miami) over abstract ones (trend, approach,
  strategy, potential, future, impact) — at least two concrete for every
  abstract one.
- **Specific does NOT mean longer.** The word count above still rules: a
  vague sentence is REPLACED by a specific one of the same length, never
  joined by an extra sentence. Five or six sentences of about 15 words each.
- **BANNED PHRASES — never use:** "This trend is expected to...", "Experts
  say...", "It's important to...", "In today's world...", "Let's dive
  into...", "Here's why...", "The key takeaway is...", "Industry leaders
  are...", "Here's what nobody tells you", "Not gonna lie", "Let me be
  honest". State the research fact itself instead.
- **STRUCTURE (the Shorts 3-second hook, docs/SCRIPT-HOOK-FORMULAS.md):**
  HOOK — the first sentence states the research's single most specific,
  surprising fact and names a person, place or number; no greeting, no
  setup. SETUP — two or three facts, each with a named entity. PAYOFF — the
  insight, tied to one specific named example from the research. CTA — one
  sentence that names the hook's subject again (so the Short loops) — never
  a generic "follow for more".
- **Shape a sentence so it can be SHOWN, when the research already gives
  you the shape.** The video draws a comparison ("42% of income versus 31%
  for owners"), a dated sequence ("the law passed in 2019 and was repealed
  in 2024" — each date with what happened), and an enumeration ("basic,
  standard, and premium") as their own compositions, and no two beats in a
  row may look alike. So when `key_facts` / `numbers` contain two figures to
  set against each other, dated events, or a list, state them that way — the
  keyword ("versus", "than", "from X to Y"), the years with their events, the
  items separated by commas — instead of burying them in one long clause.
  This changes how a real fact is worded, never which facts there are: do
  not add a comparison, a date or a list the research does not give you.
