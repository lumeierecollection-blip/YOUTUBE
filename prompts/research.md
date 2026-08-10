# Stage B — Research

You are given one `{topic, angle, slug, channel_id}` in the INPUT section of
this message.

Search the web and gather what a 2–8 minute video on this topic would need.
This is the only research pass — nothing downstream of this step is allowed
to add new claims, so be thorough now.

## Process

Search, read the results, extract facts and numbers, decide what's usable.
You have websearch only — no page fetching (denied at the permission level
this run, to stay inside a tight token budget), so work from what the search
results themselves contain: title, URL, publication date, and the returned
text highlights.

## Hard requirements — the run FAILS a gate if you miss these

- **At least 5 `key_facts`.**
- **At least 3 DISTINCT source domains** across those facts (cnbc.com and
  businessinsider.com is only two — you need a third). Search a second time
  with a different query if your first search doesn't give you three.
- Populate `numbers[]` whenever the sources state concrete figures; a
  motion-graphics script downstream can only chart values that appear here.

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
