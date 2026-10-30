# Stage A — Discover Topics

You are given JSON in the INPUT section of this message: every channel's
`id`, `niche`, `content_pillars`, `tone`, and the topics/slugs it has used in
the last 90 days.

For EACH channel in the input, find ONE specific, dated video topic.

## Process

Search, read the results, decide. You have websearch only — no page fetching
(denied at the permission level this run, to stay inside a tight token
budget), so ground your choice in what the search results themselves
contain: title, URL, publication date, and the returned text highlights.

## Rules

- The topic must sit inside one of that channel's `content_pillars`. Pillars
  are scope boundaries, not topics — "tenant rights" is a pillar; "the
  notice period your landlord actually has to give you" is a topic.
- Search the web. A topic must be grounded in something real and current: a
  ruling, a study, a rule change, a widely-reported event, a live debate.
  Do not invent a topic from general knowledge alone.
- `why_now` must state what makes it timely right now, in your own words,
  based on what you found. "Evergreen" is not an acceptable answer — even an
  evergreen subject needs a specific, current reason it's worth covering
  today (a new study, an anniversary, a recent case, renewed public
  attention).
- **HARD GATE — the pipeline will fail and produce nothing if you submit a
  duplicate.** Do not reuse any slug in the channel's `recent_topics` list.
  Do not pick a topic that is a rephrasing of one already used — same core
  subject, new wording still counts as reused. The dedup check that runs
  after you is fuzzy: if 60% or more of the content words (excluding stop
  words like "the", "in", "a", "of", "and", "how", "why", "to") overlap
  between your proposed topic and any entry in `recent_topics`, the pipeline
  rejects it as a duplicate.

  **Before finalising each topic, perform this self-check:**
  1. List the content words of your proposed topic (strip stop words).
  2. For each entry in the channel's `recent_topics`, list its content words.
  3. If the overlap (shared words ÷ total unique words across both lists) is
     ≥ 0.6, pick a different topic — do not submit this one.

  **Examples of what gets rejected:**
  - `recent_topics` contains "deep-work-ai-age-focus-superpower" → reject
    "Deep Work in the AI Age: Why Focus Is Your Superpower 2026" — adding
    a year suffix does not escape the 60% overlap check.
  - `recent_topics` contains "medicare-advantage-clawbacks-2026" → reject
    "Medicare Advantage Clawbacks and 2026 Rule Changes" — still ≥ 60%.
  - `recent_topics` contains any humanoid-robots topic → reject "Humanoid
    Robots Enter the Factory Floor" — core subject is identical.

  If every current story for a channel is too similar to something already in
  `recent_topics`, search for a different story within the same
  `content_pillars`. A story on a different subtopic within the niche is
  always available.
- No two channels in this batch may receive the same topic, even across
  different niches.
- `slug`: lowercase, hyphens only, 8–60 characters, derived from the topic.
- `pillar`: the exact `content_pillars` string this topic falls under.

## Strict visual channels (`strict_visual: true`)

Some channels draw every beat and refuse a text card. Their context carries
`topic_visual_rule`; follow it when choosing and when ordering the three
candidates. Concretely:

- Pick a topic whose FACTS are drawable: a dated event, a named place, a
  measured figure, a list, a comparison, a physical object or a process.
- Do not pick a topic whose only facts are "researcher X analysed Y", an
  API/product release note, or a paper abstract with no measurements. The
  script stage cannot state a figure that the sources do not contain, and
  the render is refused rather than inventing one.
- `subjects` should include the pictureable place, object, company or agency,
  not only the authors. The best candidate is one whose story has both a
  real asset (logo/photo) and facts a chart, map, timeline or process can
  draw.
- Order the three candidates best-first under these rules; the pipeline
  reserves the first non-duplicate and re-tries the next one if the chosen
  topic's script cannot be grounded.

## Focus pillar (when present)

A channel may carry `focus_pillar`: the content pillar its recent topics
have covered least. Choose that channel's topic inside `focus_pillar` (and
set `pillar` to it), unless a `trending_this_week` topic fits another pillar
better. A topic is a specific, dated event, study, ruling or change inside
the pillar — never the pillar's own name or a rewording of it
("industrial automation" is a pillar, not a topic).

## Trending this week (when present)

A channel may carry `trending_this_week`: the top videos in its YouTube
category over the last 7 days, ranked by views per day. These topics are
producing views this week — when one of them fits the channel's
`content_pillars`, pick it (or the specific angle inside it that fits the
niche) and research it. When none fits, ignore the list and choose as
usual.

A trending title or tag is a SIGNAL of interest, never a fact. Everything
the topic, `angle` and `why_now` claim must come from your own search
results, exactly as above — never from the trending title itself.

## What to omit

If you cannot ground a channel's topic in a real source after searching,
**omit that channel from the output** rather than inventing one. A shorter
list of real topics beats a complete list with one fabricated entry — the
matrix that consumes this output simply runs with fewer channels that day.

## Output

Return `structured_output` matching the provided JSON Schema: a `topics`
array with one entry per channel you could ground, each with `channel_id`,
`topic`, `angle`, `why_now`, `slug`, `pillar`.

## Re-ask after a rejection (when `previous_rejections` is present)

`previous_rejections` lists candidates from your previous answer that the pipeline's validator refused, each with the reason. Do not
propose any of them again, and do not propose another story of the same kind (a vendor announcement, a product or API release, a
partnership). Choose stories whose search results state their own figures, and put the main figure or the measured outcome in the
topic TITLE itself (a count, a percentage, an amount of money, a quarter or a year-on-year change). Two independent outlets must
report the story. Everything still has to come from your own search results; never add a figure to make a title pass.
