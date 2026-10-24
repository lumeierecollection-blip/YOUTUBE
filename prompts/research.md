# Stage B — Research

You are given one `{topic, angle, slug, channel_id}` in the INPUT section of
this message.

Search the web and gather what this video topic needs. Keep research LEAN —
you need 3-4 hard facts with numbers, not an exhaustive survey. One focused
search call is usually enough. This is the only research pass — nothing
downstream is allowed to add new claims.

## Named, specific facts only

The script written from your research must name a real person, place,
organization, number or object in EVERY sentence — it can only name what
you give it. So every `key_facts[].fact` names at least one person, place,
organization or number, and `named_entities[]` lists them. Do not write
abstract summaries ("adoption is growing", "experts warn of risks"). If a
search returns only abstract commentary, search again for the specific
people, companies, places and figures behind it.

`trending_entities` (in the INPUT; may be null): the people, places,
organizations, other names and numbers appearing in this week's top trending
YouTube titles for this channel's category. If one of them is part of this
topic, gather at least one verifiable fact about it, with its source. They
are leads, not facts: a trending title proves nothing, every fact still
needs a source URL your own search returned, and an entity unrelated to this
topic is ignored — never force it in. When `trending_entities` is null:
research this topic's specifics anyway — every fact names a person, place,
organization or number.

## Strict visual channels (`strict_visual: true` in the INPUT)

When `strict_visual` is true, the video draws EVERY sentence as a real
chart, map, timeline, list, comparison or counter and refuses a text card.
A script gate rejects any sentence that states nothing of that kind, and the
writer may only say what you found, so facts that are only "who did what"
make the topic unwritable. A fact is drawable when it states one of:

- a measured FIGURE with its unit (a price, a count, a percentage, a size);
- TWO OR MORE dated points (a before/after pair, a sequence of dated events);
  a single date alone is not enough;
- a named PLACE (city, site, route, facility), not just an institution's name;
- a LIST of three or more named items, or a step-by-step PROCESS;
- a COMPARISON of two named things on the same measure.

So search for the numbers, dates, places, lists and comparisons behind the
story, not only for who announced or studied it. Aim for at least four
`key_facts`, three or more of them drawable by the list above, each stating
the figure, date or place in the fact itself (put the same figure in
`numbers[]`). A publication date ("Published on October 1, 2026") or a
university's name is where the story was reported, not a fact the story
contains; it does not count. If, after the searches, the sources hold no
drawable facts, still return what they do state and say so plainly in
`strongest_angle` - never invent a figure, date or place to fill the gap.
(`scripts/strict-prescreen.mjs` measures this on your output and the
pipeline moves to another candidate topic when it is starved.)

## Process

Search, read the results, extract facts and numbers, decide what's usable.
You have websearch only — no page fetching (denied at the permission level
this run, to stay inside a tight token budget), so work from what the search
results themselves contain: title, URL, publication date, and the returned
text highlights.

## Hard requirements — the run FAILS a gate if you miss these

- **At least 3 `key_facts`.**
- **At least 2 DISTINCT source domains** across those facts. The run FAILS
  its research gate if your key_facts don't span two different hostnames.
  If your first search only returns sources from one domain, run a second
  search specifically for a different kind of source.
- Populate `numbers[]` whenever the sources state concrete figures; a
  motion-graphics script downstream can only chart values that appear here.

## Quotations (optional, up to 3)

If a search result contains a sentence that a NAMED person said (or that a named
source states about itself), put it in `quotes[]` with `text` copied WORD FOR
WORD from the search result (6 to 40 words, no paraphrase, no "...", no joining
of two sentences), the `speaker`, the `source_name` and the `source_url`. The
text is checked character for character against the raw search results and
dropped if it does not appear there. If no result holds a real statement, leave
`quotes` empty. Never write one from memory.

## Rules

- Every `key_facts[].fact` needs a real `source_url` that actually appeared
  in your search results this run. Never cite a URL you did not see returned
  by a search, and never reconstruct or guess a URL.
- Prefer primary sources: court documents, government/agency pages,
  peer-reviewed papers, company filings, official statistics. Secondary
  reporting (news coverage) is fine when it's the best available source, but
  say so via `source_name`.
- `confidence: "high"` means two independent sources agree on the fact.
  Otherwise `"medium"`. If you can't get to at least medium confidence
  (i.e. you have exactly one source and it's not authoritative), leave the
  fact out rather than including it.
- `numbers[]` is for quantities the video would put on screen — the exact
  figures a chart or a big-number beat would show. Every entry needs `unit`
  and `source_url`. **Do not derive, estimate, round beyond what the source
  states, or convert units** — copy the number as reported.
- A figure that appears in any `key_fact` must ALSO appear in `numbers[]` — including compound figures: a "6-3 ruling" is two entries (`value: 6` and `value: 3`, both `unit: "votes"`, same `source_url`), a "150-meter radius" is one entry (`value: 150`, `unit: "meters"`). The script gate can only chart values that appear in `numbers[]`, so a figure you omit silently caps what the video can show.
- `named_entities[]` lists real people, places, organizations, or objects
  the script will name. This drives image sourcing downstream, so get
  names and spellings exactly right from the source.
- If the topic turns out to be false, disputed, exaggerated, or
  unsupported by what you find, say so plainly in `strongest_angle` and
  return the facts that show *that* instead of forcing the original angle.
  A well-sourced "here's what's actually true" is always better than a
  confidently wrong video.

## Output

Return `structured_output` matching the provided JSON Schema:
`topic_slug`, `strongest_angle`, `key_facts[]`, `numbers[]`,
`named_entities[]`.
