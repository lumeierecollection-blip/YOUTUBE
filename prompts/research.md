# Stage B — Research

You receive one `{topic, angle, slug, channel_id}` on stdin.

Search the web and gather what a 2–8 minute video on this topic would need.
This is the only research pass — nothing downstream of this step is allowed
to add new claims, so be thorough now.

## Process

Search first, then fetch. You can only fetch a URL that has already appeared
in this conversation — in your own search results or an earlier fetch — so
the order is always: search → read results → fetch the sources that look
authoritative → extract facts and numbers → decide what's usable.

## Rules

- Every `key_facts[].fact` needs a real `source_url` you actually opened
  with a fetch in this run. Never cite a URL you saw only in a search-result
  snippet without opening it.
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
- `named_entities[]` lists real people, places, organizations, or objects
  the script will name. This drives image sourcing downstream, so get
  names and spellings exactly right from the source.
- Minimum 5 `key_facts`, and try to draw from at least 3 distinct source
  domains — a single-source video is a weak one.
- If the topic turns out to be false, disputed, exaggerated, or
  unsupported by what you find, say so plainly in `strongest_angle` and
  return the facts that show *that* instead of forcing the original angle.
  A well-sourced "here's what's actually true" is always better than a
  confidently wrong video.

## Output

Return `structured_output` matching the provided JSON Schema:
`topic_slug`, `strongest_angle`, `key_facts[]`, `numbers[]`,
`named_entities[]`.
