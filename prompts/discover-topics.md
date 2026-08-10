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
- Do not reuse any slug in the channel's used-topics list, and do not pick a
  topic that is a rephrasing of one already used (same core subject, new
  wording still counts as reused).
- No two channels in this batch may receive the same topic, even across
  different niches.
- `slug`: lowercase, hyphens only, 8–60 characters, derived from the topic.
- `pillar`: the exact `content_pillars` string this topic falls under.

## What to omit

If you cannot ground a channel's topic in a real source after searching,
**omit that channel from the output** rather than inventing one. A shorter
list of real topics beats a complete list with one fabricated entry — the
matrix that consumes this output simply runs with fewer channels that day.

## Output

Return `structured_output` matching the provided JSON Schema: a `topics`
array with one entry per channel you could ground, each with `channel_id`,
`topic`, `angle`, `why_now`, `slug`, `pillar`.
