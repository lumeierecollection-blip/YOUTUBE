---
name: niche-discovery
description: Use to find and evaluate new channel niches when scaling the number of channels (e.g. going from 5 to 50). Combines YouTube trend data with web/social research to pick niches that are currently performing well AND likely to stay relevant, then recommends a video style per niche. Never invents a niche or its supporting numbers.
---

# Niche Discovery Skill

## Purpose
Pick each additional channel's niche from real, current data — not from a
generic "good niche ideas" list. Every niche recommended here must trace
back to an actual search result.

## Process (per candidate niche)

1. **Broad category sweep.** Search YouTube (via trend-research) across
   candidate categories not already covered by existing channels — pull
   real view counts, upload frequency, and recency for top channels/videos
   in each.
2. **Durability check (separate pass, don't skip this).** Search the web
   for whether this category is a short-lived spike (one viral event) or
   has a track record of sustained interest — look for multi-month/year
   search or view trend signals, not just this week's numbers. A niche
   that's only hot because of a single recent event should be flagged as
   lower-durability, not silently excluded or included.
3. **Practitioner/community check.** Search what other automation/niche
   YouTubers say about this category's monetization and audience
   durability — this is a real signal, cite it, don't guess at it.
4. **Style fit.** Based on what the actual top-performing videos in that
   niche look like (checked via search, not assumed), recommend one of the
   three existing styles:
   - fact/list/stat-heavy content → minimal
   - narrative, personal, or emotionally-driven content → the researched
     third style (see remotion-render skill — determined by research, not
     fixed in advance)
   - process/explainer/how-it-works content → motion-graphics
5. **De-duplication.** Check the new niche isn't a near-duplicate of an
   already-configured channel's niche (compare against `config/channels.json`).

## Output (per niche, before creating any channel config)
- Niche name
- Evidence it's currently performing well (with real numbers/sources)
- Evidence for or against durability (explicit, not assumed)
- Recommended style + why
- Any practitioner/community notes found

Log this to a `niche-candidates.md` (or similar) file in the repo as each
niche is confirmed, so there's a durable record of why each channel's
niche was chosen — don't only put this in chat output.

## Rules
- Never propose a niche without at least one real search backing the
  "currently performing well" claim and a separate real search backing
  the durability claim — these are two different questions, don't
  conflate them into one search.
- Never fabricate view counts, growth percentages, or trend language —
  if a number wasn't returned by an actual API/search call, don't state a
  specific number at all; describe it qualitatively instead ("multiple top
  videos in the last month" rather than a made-up percentage).
- If fewer than 45 niches turn up strong evidence, report that back rather
  than padding the list with weak candidates — quality over hitting the
  exact number.
